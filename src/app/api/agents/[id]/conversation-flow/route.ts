import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import { DEFAULT_FLOW_TEMPLATE } from "@/lib/prompt-tree-types";

// Helper: fetch from Retell API (same pattern as config/route.ts)
async function retellFetch(
  path: string,
  apiKey: string,
  options?: RequestInit
) {
  return fetch(`https://api.retellai.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

// Resolve Retell API key for an agent (same pattern as config/route.ts)
async function resolveApiKey(agent: {
  retell_api_key_encrypted: string | null;
  organization_id: string;
}): Promise<string | null> {
  return (
    (agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted)
      : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY ||
    null
  );
}

// GET: Fetch conversation flow for an agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      "retell_agent_id, retell_api_key_encrypted, platform, organization_id"
    )
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey = await resolveApiKey(agent);
  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No Retell API key configured" },
      { status: 500 }
    );
  }

  try {
    // Fetch agent from Retell to check response_engine type
    const isChat =
      agent.platform === "retell-chat" || agent.platform === "retell-sms";
    const endpoint = isChat
      ? `/get-chat-agent/${agent.retell_agent_id}`
      : `/get-agent/${agent.retell_agent_id}`;
    const agentRes = await retellFetch(endpoint, retellApiKey);

    if (!agentRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch agent from Retell" },
        { status: agentRes.status }
      );
    }

    const retellAgent = await agentRes.json();
    const engine = retellAgent.response_engine;

    // Check if agent already uses a conversation flow
    if (engine?.type === "conversation-flow" && engine.conversation_flow_id) {
      const flowRes = await retellFetch(
        `/v2/get-conversation-flow/${engine.conversation_flow_id}`,
        retellApiKey
      );

      if (!flowRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch conversation flow" },
          { status: flowRes.status }
        );
      }

      const flow = await flowRes.json();
      return NextResponse.json({
        exists: true,
        flow,
        conversation_flow_id: engine.conversation_flow_id,
      });
    }

    // Agent doesn't have a conversation flow yet
    return NextResponse.json({
      exists: false,
      flow: null,
      conversation_flow_id: null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch conversation flow" },
      { status: 500 }
    );
  }
}

// PUT: Create or update conversation flow for an agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();

  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      "retell_agent_id, retell_api_key_encrypted, platform, organization_id"
    )
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey = await resolveApiKey(agent);
  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No Retell API key configured" },
      { status: 500 }
    );
  }

  try {
    const isChat =
      agent.platform === "retell-chat" || agent.platform === "retell-sms";

    // Build the flow payload
    const flowPayload: Record<string, unknown> = {
      nodes: body.nodes ?? DEFAULT_FLOW_TEMPLATE.nodes,
      start_node_id: body.start_node_id ?? DEFAULT_FLOW_TEMPLATE.start_node_id,
      start_speaker: body.start_speaker ?? DEFAULT_FLOW_TEMPLATE.start_speaker,
    };

    if (body.global_prompt !== undefined)
      flowPayload.global_prompt = body.global_prompt;
    if (body.model_choice !== undefined)
      flowPayload.model_choice = body.model_choice;
    if (body.model_temperature !== undefined)
      flowPayload.model_temperature = body.model_temperature;
    if (body.begin_tag_display_position !== undefined)
      flowPayload.begin_tag_display_position = body.begin_tag_display_position;
    if (body.begin_after_user_silence_ms !== undefined)
      flowPayload.begin_after_user_silence_ms =
        body.begin_after_user_silence_ms;
    if (body.tools !== undefined) flowPayload.tools = body.tools;
    if (body.knowledge_base_ids !== undefined)
      flowPayload.knowledge_base_ids = body.knowledge_base_ids;
    if (body.default_dynamic_variables !== undefined)
      flowPayload.default_dynamic_variables = body.default_dynamic_variables;
    if (body.tool_call_strict_mode !== undefined)
      flowPayload.tool_call_strict_mode = body.tool_call_strict_mode;

    // Check if agent already has a conversation flow
    const agentEndpoint = isChat
      ? `/get-chat-agent/${agent.retell_agent_id}`
      : `/get-agent/${agent.retell_agent_id}`;
    const agentRes = await retellFetch(agentEndpoint, retellApiKey);

    if (!agentRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch agent from Retell" },
        { status: agentRes.status }
      );
    }

    const retellAgent = await agentRes.json();
    const engine = retellAgent.response_engine;

    if (engine?.type === "conversation-flow" && engine.conversation_flow_id) {
      // Update existing flow
      const updateRes = await retellFetch(
        `/v2/update-conversation-flow/${engine.conversation_flow_id}`,
        retellApiKey,
        {
          method: "PATCH",
          body: JSON.stringify(flowPayload),
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error("Retell flow update error:", err);
        return NextResponse.json(
          { error: "Failed to update conversation flow" },
          { status: updateRes.status }
        );
      }

      const updatedFlow = await updateRes.json();
      return NextResponse.json({
        exists: true,
        flow: updatedFlow,
        conversation_flow_id: engine.conversation_flow_id,
      });
    }

    // Create new conversation flow
    const createRes = await retellFetch(
      "/v2/create-conversation-flow",
      retellApiKey,
      {
        method: "POST",
        body: JSON.stringify(flowPayload),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("Retell flow create error:", err);
      return NextResponse.json(
        { error: "Failed to create conversation flow" },
        { status: createRes.status }
      );
    }

    const newFlow = await createRes.json();
    const newFlowId = newFlow.conversation_flow_id;

    // Update agent to use the new conversation flow
    const updateAgentEndpoint = isChat
      ? `/update-chat-agent/${agent.retell_agent_id}`
      : `/update-agent/${agent.retell_agent_id}`;

    const agentUpdateRes = await retellFetch(
      updateAgentEndpoint,
      retellApiKey,
      {
        method: "PATCH",
        body: JSON.stringify({
          response_engine: {
            type: "conversation-flow",
            conversation_flow_id: newFlowId,
          },
        }),
      }
    );

    if (!agentUpdateRes.ok) {
      const err = await agentUpdateRes.text();
      console.error("Retell agent update error:", err);
      // Flow was created but agent wasn't linked — return partial success
      return NextResponse.json(
        {
          exists: true,
          flow: newFlow,
          conversation_flow_id: newFlowId,
          warning: "Flow created but agent was not linked. Try saving again.",
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      exists: true,
      flow: newFlow,
      conversation_flow_id: newFlowId,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save conversation flow" },
      { status: 500 }
    );
  }
}
