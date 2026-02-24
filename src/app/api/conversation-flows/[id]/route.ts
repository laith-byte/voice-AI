import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import { compileFlowToRetellNodes } from "@/lib/compile-flow-to-retell";
import type { FlowNode } from "@/lib/conversation-flow-templates";

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
// POST — deploy flow (compile to native Retell conversation-flow, push to agent)
// ---------------------------------------------------------------------------

const EXTERNAL_API_TIMEOUT_MS = 15_000; // 15s timeout for external API calls

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { id } = await params;

  // Fetch the flow with the linked agent (include platform for endpoint routing)
  const { data: flow, error: flowError } = await supabase
    .from("conversation_flows")
    .select("*, agents(id, retell_agent_id, retell_api_key_encrypted, organization_id, platform, conversation_flow_id)")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  if (flowError || !flow) {
    console.error("[conversation-flows] Flow lookup failed:", flowError?.message);
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

  // Compile FlowNodes into Retell's native conversation-flow format
  const nodes = flow.nodes as FlowNode[];
  const { flowData } = compileFlowToRetellNodes(nodes, clientId!);

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
  const isChat =
    agent.platform === "retell-chat" || agent.platform === "retell-sms";

  console.log("[conversation-flows] Deploying flow", id, "→ agent", retellAgentId, "platform:", agent.platform, "isChat:", isChat, "nodes:", flowData.nodes.length);

  // Build the conversation-flow payload for Retell API
  const flowPayload: Record<string, unknown> = {
    nodes: flowData.nodes,
    start_node_id: flowData.start_node_id,
    start_speaker: flowData.start_speaker ?? "agent",
    model_choice: flowData.model_choice ?? { model: "gpt-4.1", type: "cascading" },
  };
  if (flowData.global_prompt) flowPayload.global_prompt = flowData.global_prompt;

  // Only include tools with valid public URLs — Retell rejects localhost/private hostnames
  if (flowData.tools && flowData.tools.length > 0) {
    const validTools = flowData.tools.filter((t) => {
      if ("url" in t && typeof t.url === "string") {
        try {
          const hostname = new URL(t.url).hostname;
          return hostname !== "localhost" && !hostname.startsWith("127.") && !hostname.startsWith("192.168.") && !hostname.startsWith("10.");
        } catch {
          return false;
        }
      }
      return true; // non-custom tools (no URL) are always valid
    });
    if (validTools.length > 0) flowPayload.tools = validTools;
  }

  // Check if agent already has a conversation flow on Retell
  let existingFlowId: string | null = (agent.conversation_flow_id as string) || null;

  try {
    const getEndpoint = isChat
      ? `https://api.retellai.com/get-chat-agent/${retellAgentId}`
      : `https://api.retellai.com/get-agent/${retellAgentId}`;
    const agentConfigRes = await fetch(getEndpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
    });

    if (agentConfigRes.ok) {
      const agentConfig = await agentConfigRes.json();
      const engine = agentConfig.response_engine;

      // Extract existing conversation_flow_id if the agent uses that engine type
      if (engine?.type === "conversation-flow") {
        const cfId = engine.conversation_flow_id || engine["conversation-flow-id"];
        if (cfId) existingFlowId = cfId;
      }
    }
  } catch (fetchErr) {
    console.warn("[conversation-flows] GET agent failed, will create new flow:", fetchErr);
  }

  // Create or update the Retell conversation flow
  let retellFlowId: string;

  try {
    if (existingFlowId) {
      // Update existing flow
      const updateRes = await fetch(
        `https://api.retellai.com/update-conversation-flow/${existingFlowId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(flowPayload),
          signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
        }
      );

      if (updateRes.ok) {
        retellFlowId = existingFlowId;
        console.log("[conversation-flows] Updated existing Retell flow:", retellFlowId);
      } else if (updateRes.status === 404) {
        // Flow was deleted on Retell side — fall through to create
        existingFlowId = null;
        console.warn("[conversation-flows] Existing flow not found on Retell, creating new one");
        // Create below
        const createRes = await fetch(
          "https://api.retellai.com/create-conversation-flow",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(flowPayload),
            signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
          }
        );
        if (!createRes.ok) {
          const err = await createRes.text();
          console.error("[conversation-flows] Create flow failed:", createRes.status, err);
          return NextResponse.json(
            { error: "Failed to create conversation flow. Please try again." },
            { status: 500 }
          );
        }
        const newFlow = await createRes.json();
        retellFlowId = newFlow.conversation_flow_id;
        console.log("[conversation-flows] Created new Retell flow:", retellFlowId);
      } else {
        const err = await updateRes.text();
        console.error("[conversation-flows] Update flow failed:", updateRes.status, err);
        return NextResponse.json(
          { error: "Failed to update conversation flow. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // Create new flow
      const createRes = await fetch(
        "https://api.retellai.com/create-conversation-flow",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(flowPayload),
          signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
        }
      );
      if (!createRes.ok) {
        const err = await createRes.text();
        console.error("[conversation-flows] Create flow failed:", createRes.status, err);
        return NextResponse.json(
          { error: "Failed to create conversation flow. Please try again." },
          { status: 500 }
        );
      }
      const newFlow = await createRes.json();
      retellFlowId = newFlow.conversation_flow_id;
      console.log("[conversation-flows] Created new Retell flow:", retellFlowId);
    }
  } catch (err) {
    console.error("[conversation-flows] Retell API call timed out or failed:", err);
    return NextResponse.json(
      { error: "Deployment timed out. Please try again." },
      { status: 504 }
    );
  }

  // Link the agent to the conversation flow (set response_engine.type = "conversation-flow")
  try {
    const updateAgentEndpoint = isChat
      ? `https://api.retellai.com/update-chat-agent/${retellAgentId}`
      : `https://api.retellai.com/update-agent/${retellAgentId}`;

    const agentUpdateRes = await fetch(updateAgentEndpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response_engine: {
          type: "conversation-flow",
          conversation_flow_id: retellFlowId,
        },
      }),
      signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
    });

    if (!agentUpdateRes.ok) {
      const err = await agentUpdateRes.text();
      console.error("[conversation-flows] Agent link failed:", agentUpdateRes.status, err);
      // Non-fatal — flow was created, just not linked yet
      console.warn("[conversation-flows] Flow created but agent link failed. Will retry on next load.");
    }
  } catch (linkErr) {
    console.error("[conversation-flows] Agent link timed out:", linkErr);
  }

  // Save the Retell flow ID to our agents table for future lookups
  await supabase
    .from("agents")
    .update({ conversation_flow_id: retellFlowId })
    .eq("id", agent.id as string);

  // Mark flow as active and increment version in our DB
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

  console.log("[conversation-flows] Deploy succeeded for flow", id, "→ Retell flow", retellFlowId);

  return NextResponse.json({
    success: true,
    retell_flow_id: retellFlowId,
    nodes_deployed: flowData.nodes.length,
    tools_registered: (flowData.tools || []).map((t) => t.name),
  });
}


