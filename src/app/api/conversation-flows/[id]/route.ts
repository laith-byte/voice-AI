import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import {
  CALENDAR_TOOLS,
  CALENDLY_TOOLS,
  HUBSPOT_TOOLS,
  injectClientId,
  addAuthHeaders,
} from "@/lib/oauth/register-agent-tools";

// ---------------------------------------------------------------------------
// Node types — includes integration actions
// ---------------------------------------------------------------------------

interface FlowNode {
  id: string;
  type:
    | "message"
    | "question"
    | "condition"
    | "transfer"
    | "end"
    | "check_availability"
    | "book_appointment"
    | "crm_lookup"
    | "webhook";
  data: {
    text?: string;
    nextNodeId?: string;
    options?: { label: string; nextNodeId: string }[];
    condition?: string;
    trueNodeId?: string;
    falseNodeId?: string;
    transferNumber?: string;
    // Integration fields
    provider?: "google" | "calendly";
    webhookUrl?: string;
    webhookMethod?: "POST" | "GET";
  };
}

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

  // Strip unsafe keys
  const { id: _id, client_id: _cid, created_at: _ca, ...safeBody } = body;

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
// POST — deploy flow to Retell (prompt + tools)
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { id } = await params;

  // Fetch the flow
  const { data: flow, error: flowError } = await supabase
    .from("conversation_flows")
    .select("*, agents(retell_agent_id, retell_api_key_encrypted, organization_id)")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  if (flowError || !flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  if (!flow.agent_id) {
    return NextResponse.json({ error: "Flow must be linked to an agent" }, { status: 400 });
  }

  const agent = flow.agents as Record<string, unknown> | null;
  if (!agent?.retell_agent_id) {
    return NextResponse.json({ error: "Agent not linked to Retell" }, { status: 400 });
  }

  // Compile nodes into a structured prompt + collect required tools
  const nodes = flow.nodes as FlowNode[];
  const { prompt, requiredProviders } = compileFlowToPrompt(nodes);

  // Get Retell API key
  const apiKey =
    (agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted as string)
      : null) ||
    (await getIntegrationKey(agent.organization_id as string, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Retell API key not found" }, { status: 500 });
  }

  const retellAgentId = agent.retell_agent_id as string;

  // --- Fetch current agent config to get existing tools ---
  const agentConfigRes = await fetch(
    `https://api.retellai.com/get-agent/${retellAgentId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  let existingTools: Record<string, unknown>[] = [];
  let usesLlmId = false;
  let llmId: string | null = null;

  if (agentConfigRes.ok) {
    const agentConfig = await agentConfigRes.json();
    const engine = agentConfig.response_engine;

    if (engine?.llm_id) {
      usesLlmId = true;
      llmId = engine.llm_id;
      const llmRes = await fetch(
        `https://api.retellai.com/get-retell-llm/${llmId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (llmRes.ok) {
        const llm = await llmRes.json();
        existingTools = llm.general_tools || llm.tools || [];
      }
    } else if (engine?.llm) {
      existingTools = engine.llm.tools || engine.llm.general_tools || [];
    }
  }

  // --- Build the tools array for this flow ---
  const flowToolDefs: Record<string, unknown>[] = [];
  const flowToolNames = new Set<string>();

  for (const provider of requiredProviders) {
    let toolSet: Record<string, unknown>[] = [];
    if (provider === "google") {
      toolSet = CALENDAR_TOOLS as unknown as Record<string, unknown>[];
    } else if (provider === "calendly") {
      toolSet = CALENDLY_TOOLS as unknown as Record<string, unknown>[];
    } else if (provider === "hubspot") {
      toolSet = HUBSPOT_TOOLS as unknown as Record<string, unknown>[];
    }

    const prepared = addAuthHeaders(injectClientId(toolSet, clientId!));
    for (const tool of prepared) {
      if (!flowToolNames.has(tool.name as string)) {
        flowToolNames.add(tool.name as string);
        flowToolDefs.push(tool);
      }
    }
  }

  // Add webhook tools for any webhook nodes
  let webhookIdx = 0;
  for (const node of nodes) {
    if (node.type === "webhook" && node.data.webhookUrl) {
      webhookIdx++;
      const toolName = `flow_webhook_${webhookIdx}`;
      flowToolNames.add(toolName);
      flowToolDefs.push({
        type: "custom",
        name: toolName,
        description: node.data.text || `Send data to webhook endpoint #${webhookIdx}`,
        url: node.data.webhookUrl,
        method: node.data.webhookMethod || "POST",
        speak_during_execution: true,
        execution_message_description: "One moment while I process that",
        speak_after_execution: true,
        timeout_ms: 5000,
        parameters: {
          type: "object",
          properties: {
            caller_name: { type: "string", description: "The caller's name" },
            caller_phone: { type: "string", description: "The caller's phone number" },
            caller_email: { type: "string", description: "The caller's email if provided" },
            notes: { type: "string", description: "Any relevant notes from the conversation" },
          },
          required: [],
        },
      });
    }
  }

  // Add transfer_call tools for transfer nodes
  let transferIdx = 0;
  for (const node of nodes) {
    if (node.type === "transfer" && node.data.transferNumber) {
      transferIdx++;
      const toolName = `transfer_call_${transferIdx}`;
      flowToolNames.add(toolName);
      flowToolDefs.push({
        type: "transfer_call",
        name: toolName,
        description: node.data.text
          ? `Transfer the call: ${node.data.text}`
          : `Transfer the call to ${node.data.transferNumber}`,
        transfer_destination: {
          type: "predefined",
          number: node.data.transferNumber,
        },
        transfer_option: {
          type: "warm_transfer",
          show_transferee_as_caller: false,
          on_hold_music: "ringtone",
        },
        speak_during_execution: true,
        execution_message_description: "Let the caller know you are transferring them now.",
        execution_message_type: "prompt",
      });
    }
  }

  // Merge: keep existing tools that aren't overridden by flow tools
  const mergedTools = [
    ...existingTools.filter((t) => !flowToolNames.has(t.name as string)),
    ...flowToolDefs,
  ];

  // --- Push prompt + tools to Retell ---
  if (usesLlmId && llmId) {
    const llmUpdateRes = await fetch(
      `https://api.retellai.com/update-retell-llm/${llmId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          general_prompt: prompt,
          general_tools: mergedTools,
        }),
      }
    );

    if (!llmUpdateRes.ok) {
      const err = await llmUpdateRes.text();
      console.error("Retell LLM update failed:", err);
      return NextResponse.json({ error: "Failed to deploy flow to Retell" }, { status: 500 });
    }
  } else {
    const agentUpdateRes = await fetch(
      `https://api.retellai.com/update-agent/${retellAgentId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response_engine: {
            type: "retell-llm",
            llm: {
              general_prompt: prompt,
              general_tools: mergedTools,
            },
          },
        }),
      }
    );

    if (!agentUpdateRes.ok) {
      const err = await agentUpdateRes.text();
      console.error("Retell agent update failed:", err);
      return NextResponse.json({ error: "Failed to deploy flow to Retell" }, { status: 500 });
    }
  }

  // Mark flow as active and increment version
  await supabase
    .from("conversation_flows")
    .update({
      is_active: true,
      version: (flow.version || 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    success: true,
    prompt_preview: prompt,
    tools_registered: flowToolDefs.map((t) => t.name),
  });
}

// ---------------------------------------------------------------------------
// Compiler — converts flow nodes into a Retell prompt + determines tools
// ---------------------------------------------------------------------------

function compileFlowToPrompt(nodes: FlowNode[]): {
  prompt: string;
  requiredProviders: Set<string>;
} {
  const requiredProviders = new Set<string>();

  if (!nodes.length) return { prompt: "", requiredProviders };

  const lines: string[] = [];
  lines.push(
    "You are a professional AI voice assistant. Follow this conversation flow while maintaining a natural, conversational tone.\n"
  );
  lines.push("CONVERSATION FLOW:\n");

  let webhookCounter = 0;
  let transferCounter = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const step = i + 1;

    switch (node.type) {
      case "message":
        lines.push(`${step}. Say: "${node.data.text || ""}"`);
        break;

      case "question":
        lines.push(`${step}. Ask: "${node.data.text || ""}"`);
        if (node.data.options && node.data.options.length > 0) {
          for (const opt of node.data.options) {
            lines.push(
              `   - If the caller says "${opt.label}": acknowledge their choice and continue.`
            );
          }
        } else {
          lines.push(
            `   Listen to the caller's response, then continue to the next step.`
          );
        }
        break;

      case "condition":
        lines.push(
          `${step}. Evaluate: ${node.data.condition || "the situation"}`
        );
        lines.push(`   - If yes: continue to the next step.`);
        lines.push(
          `   - If no: adapt your response accordingly and continue.`
        );
        break;

      case "transfer":
        if (node.data.transferNumber) {
          transferCounter++;
          const transferToolName = `transfer_call_${transferCounter}`;
          lines.push(
            `${step}. ${node.data.text || "Let the caller know you're transferring them."} Then use the "${transferToolName}" tool to transfer the call.`
          );
        } else {
          lines.push(
            `${step}. ${node.data.text || "Transfer the call to the appropriate person or department."}`
          );
        }
        break;

      case "end":
        lines.push(
          `${step}. ${node.data.text || "End the conversation politely. Thank the caller for their time."}`
        );
        break;

      // --- Integration nodes ---

      case "check_availability": {
        const provider = node.data.provider || "google";
        requiredProviders.add(provider === "calendly" ? "calendly" : "google");
        const toolName =
          provider === "calendly"
            ? "check_calendly_availability"
            : "check_availability";
        lines.push(
          `${step}. ${node.data.text || "Ask the caller what date they'd like to schedule for."} Then use the "${toolName}" tool to check available time slots for that date. Read back the available times and ask the caller to pick one.`
        );
        break;
      }

      case "book_appointment": {
        const provider = node.data.provider || "google";
        requiredProviders.add(provider === "calendly" ? "calendly" : "google");
        const toolName =
          provider === "calendly"
            ? "book_calendly_appointment"
            : "book_appointment";
        lines.push(
          `${step}. ${node.data.text || "Confirm the selected time with the caller."} Then use the "${toolName}" tool to book the appointment. Collect the caller's name and contact info (phone/email) for the booking. Confirm the booking details once complete.`
        );
        break;
      }

      case "crm_lookup":
        requiredProviders.add("hubspot");
        lines.push(
          `${step}. ${node.data.text || "Use the \"lookup_caller\" tool with the caller's phone number to check if they're an existing contact."} If found, greet them by name and reference their account. If not found, proceed to collect their information.`
        );
        break;

      case "webhook": {
        if (node.data.webhookUrl) {
          webhookCounter++;
          const toolName = `flow_webhook_${webhookCounter}`;
          lines.push(
            `${step}. ${node.data.text || "Collect relevant caller information."} Then use the "${toolName}" tool to send the data (caller name, phone, email, and any relevant notes from the conversation).`
          );
        } else {
          // No webhook URL configured — include as a data collection step without tool reference
          lines.push(
            `${step}. ${node.data.text || "Collect relevant caller information (name, phone, email, and any relevant notes)."}`
          );
        }
        break;
      }
    }
  }

  lines.push("");
  lines.push("GUIDELINES:");
  lines.push(
    "- Keep responses concise and natural-sounding for voice conversation."
  );
  lines.push(
    "- If the caller goes off-script, gently guide them back to the flow."
  );
  lines.push(
    "- Be empathetic and professional throughout the conversation."
  );
  lines.push(
    "- If you cannot resolve something, offer to transfer to a human agent."
  );
  lines.push(
    "- When using tools, let the caller know you're working on it (e.g., 'Let me check that for you')."
  );

  return { prompt: lines.join("\n"), requiredProviders };
}
