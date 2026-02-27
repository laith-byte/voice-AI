import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import { compileFlowToRetellStates, filterStatesForRetell } from "@/lib/compile-flow-to-retell";
import type { FlowNode } from "@/lib/conversation-flow-templates";
import { logger } from "@/lib/logger";
import { RETELL_API_BASE } from "@/lib/retell";

// ---------------------------------------------------------------------------
// CRUD handlers
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { id } = await params;

  const { data, error } = await supabase
    .from("conversation_flows")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { id } = await params;
  const body = await request.json();

  // Whitelist allowed fields to prevent manipulation of is_active, version, etc.
  const safeBody: Record<string, unknown> = {};
  if (body.name !== undefined) safeBody.name = body.name;
  if (body.agent_id !== undefined) safeBody.agent_id = body.agent_id;
  if (body.nodes !== undefined) safeBody.nodes = body.nodes;
  if (body.edges !== undefined) safeBody.edges = body.edges;

  const { data, error } = await supabase
    .from("conversation_flows")
    .update({ ...safeBody, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { id } = await params;

  const { error } = await supabase
    .from("conversation_flows")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ---------------------------------------------------------------------------
// POST — deploy flow (compile to retell-llm states, push to agent's LLM)
// ---------------------------------------------------------------------------
// Retell does NOT allow changing response_engine type after creation
// ("Cannot update response engine of agent version > 0"). So we stay within
// the existing retell-llm engine and push multi-state prompts via
// /update-retell-llm/{llm_id}. The Prompt Tree Editor reads these states
// via convertLLMToFlow() and displays them as visual nodes.
// ---------------------------------------------------------------------------

const EXTERNAL_API_TIMEOUT_MS = 15_000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { id } = await params;

  // Fetch the flow with the linked agent
  const { data: flow, error: flowError } = await supabase
    .from("conversation_flows")
    .select("*, agents(id, retell_agent_id, retell_api_key_encrypted, organization_id, platform)")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  if (flowError || !flow) {
    logger.warn("Flow lookup failed", { error: String(flowError?.message) });
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  if (!flow.agent_id) {
    return NextResponse.json({ error: "Flow must be linked to an agent" }, { status: 400 });
  }

  const agent = flow.agents as Record<string, unknown> | null;
  if (!agent?.retell_agent_id) {
    return NextResponse.json(
      { error: "Agent is not fully configured. Please go back and recreate the agent." },
      { status: 400 }
    );
  }

  // Resolve API key
  const apiKey =
    (agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted as string)
      : null) ||
    (await getIntegrationKey(agent.organization_id as string, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured. Please check your integrations settings." },
      { status: 500 }
    );
  }

  const retellAgentId = agent.retell_agent_id as string;
  const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";

  // Step 1: GET the agent to find response_engine.llm_id
  const getEndpoint = isChat
    ? `${RETELL_API_BASE}/get-chat-agent/${retellAgentId}`
    : `${RETELL_API_BASE}/get-agent/${retellAgentId}`;

  let llmId: string | null = null;

  try {
    const agentRes = await fetch(getEndpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
    });

    if (agentRes.ok) {
      const agentConfig = await agentRes.json();
      const engine = agentConfig.response_engine;

      if (engine?.type === "retell-llm" && engine.llm_id) {
        llmId = engine.llm_id;
      } else if (engine?.llm_id) {
        // Fallback: try llm_id even if type doesn't match exactly
        llmId = engine.llm_id;
      }
    } else {
      const errText = await agentRes.text();
      console.error("[conversation-flows] GET agent failed:", agentRes.status, errText);
    }
  } catch (err) {
    console.error("[conversation-flows] GET agent error:", err);
  }

  if (!llmId) {
    return NextResponse.json(
      {
        error: "Could not find LLM ID for this agent. The agent may need to be recreated.",
        debug_hint: "Agent response_engine does not contain llm_id. Check Retell dashboard.",
      },
      { status: 400 }
    );
  }

  // Step 2: GET existing LLM to preserve all fields (general_prompt, tools, begin_message, etc.)
  // Retell may or may not do incremental PATCHes, so we do a full read-modify-write to be safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingLLM: Record<string, any> = {};

  try {
    const llmRes = await fetch(
      `${RETELL_API_BASE}/get-retell-llm/${llmId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
      }
    );
    if (llmRes.ok) {
      existingLLM = await llmRes.json();
    } else {
      logger.warn("GET LLM failed", { status: llmRes.status });
    }
  } catch (err) {
    logger.warn("GET LLM error", { error: String(err) });
  }

  // Step 3: Compile FlowNodes into retell-llm states
  const nodes = flow.nodes as FlowNode[];
  const compiled = compileFlowToRetellStates(nodes, clientId!);

  logger.info("Deploying flow", {
    flowId: id,
    llmId,
    statesCount: compiled.states.length,
    toolsCount: compiled.general_tools.length,
    startingState: compiled.starting_state,
    existingPromptLength: (existingLLM.general_prompt || "").length,
    existingToolsCount: (existingLLM.general_tools || []).length,
  });

  // Step 4: Build PATCH payload — merge new states with all existing LLM fields
  // We preserve everything that exists and only overwrite states + starting_state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const llmPayload: Record<string, any> = {};

  // Preserve all existing fields that matter
  if (existingLLM.general_prompt) llmPayload.general_prompt = existingLLM.general_prompt;
  if (existingLLM.begin_message !== undefined) llmPayload.begin_message = existingLLM.begin_message;

  // Tools: compiled states now carry per-state tools (state.tools).
  // Clear general_tools to avoid duplicates between general_tools and state.tools.
  // If the compiled output has general_tools, merge them; otherwise set empty.
  if (compiled.general_tools.length > 0) {
    const existingTools: Record<string, unknown>[] = existingLLM.general_tools || [];
    const newToolNames = new Set(compiled.general_tools.map(t => t.name as string));
    const keptTools = existingTools.filter(t => !newToolNames.has(t.name as string));
    llmPayload.general_tools = [...keptTools, ...compiled.general_tools];
  } else {
    // Tools live on individual states now — clear general_tools to prevent
    // "Tool name must be unique" errors from stale entries.
    llmPayload.general_tools = [];
  }

  // Set the new states — filter out custom tools with non-public URLs
  // (Retell rejects them). The compiler always generates all tools so the
  // editor can display them; we only strip non-deployable ones for Retell.
  llmPayload.states = filterStatesForRetell(compiled.states);
  llmPayload.starting_state = compiled.starting_state;

  try {
    const updateRes = await fetch(
      `${RETELL_API_BASE}/update-retell-llm/${llmId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(llmPayload),
        signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("[conversation-flows] LLM update failed:", updateRes.status, errText);
      return NextResponse.json(
        {
          error: "Failed to deploy flow to Retell. Please try again.",
          debug_status: updateRes.status,
          debug_retell_error: errText,
          debug_endpoint: `${RETELL_API_BASE}/update-retell-llm/${llmId}`,
          debug_payload_summary: {
            states_count: compiled.states.length,
            tools_count: compiled.general_tools.length,
            starting_state: compiled.starting_state,
          },
        },
        { status: 502 }
      );
    }

    const updatedLLM = await updateRes.json();
    logger.info("Deploy PATCH response", {
      flowId: id,
      llmId,
      responseStatesCount: (updatedLLM.states || []).length,
      responseStartingState: updatedLLM.starting_state,
      stateNames: (updatedLLM.states || []).map((s: { name: string }) => s.name),
      stateTools: (updatedLLM.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`),
    });

    // Verification read-back: GET the LLM to confirm states + tools persisted
    try {
      const verifyRes = await fetch(
        `${RETELL_API_BASE}/get-retell-llm/${llmId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
        }
      );
      if (verifyRes.ok) {
        const verifyLlm = await verifyRes.json();
        const verifyCount = (verifyLlm.states || []).length;
        logger.info("Deploy VERIFIED", {
          llmId,
          statesCount: verifyCount,
          startingState: verifyLlm.starting_state,
          stateTools: (verifyLlm.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`),
        });
        if (verifyCount === 0) {
          console.error(
            "[conversation-flows] DEPLOY VERIFICATION FAILED:",
            "Retell accepted the PATCH but LLM has 0 states!",
            "Compiled", compiled.states.length, "states were not persisted."
          );
        }
      }
    } catch (verifyErr) {
      logger.warn("Deploy verification read-back failed", { error: String(verifyErr) });
    }
  } catch (err) {
    console.error("[conversation-flows] LLM update timed out:", err);
    return NextResponse.json(
      { error: "Deployment timed out. Please try again." },
      { status: 504 }
    );
  }

  // Step 4: Mark flow as active and increment version
  await supabase
    .from("conversation_flows")
    .update({
      is_active: true,
      version: (flow.version || 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Deactivate any other flows for this agent
  await supabase
    .from("conversation_flows")
    .update({ is_active: false })
    .eq("client_id", clientId)
    .eq("agent_id", flow.agent_id)
    .neq("id", id);

  return NextResponse.json({
    success: true,
    llm_id: llmId,
    states_deployed: compiled.states.length,
    tools_registered: compiled.general_tools.map((t) => t.name),
    state_tools: compiled.states
      .filter((s) => s.tools && s.tools.length > 0)
      .map((s) => ({ state: s.name, tools: s.tools!.map((t) => t.name) })),
  });
}
