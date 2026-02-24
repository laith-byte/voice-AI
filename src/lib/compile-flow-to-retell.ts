// ---------------------------------------------------------------------------
// FlowNode → Retell Conversation Flow Compiler
// ---------------------------------------------------------------------------
// Converts the linear FlowNode[] format (used by onboarding + Flows page)
// into Retell's native ConversationFlowData format (nodes + edges + tools).
//
// This replaces `compileFlowToPrompt()` so that flows deploy as
// `response_engine.type = "conversation-flow"` instead of "retell-llm",
// ensuring coherence with the Prompt Tree Editor.
// ---------------------------------------------------------------------------

import type { FlowNode } from "@/lib/conversation-flow-templates";
import type {
  ConversationFlowData,
  ConversationFlowTool,
  ConversationFlowCustomTool,
  RetellNode,
  RetellConversationNode,
  RetellEndNode,
  RetellTransferCallNode,
  RetellEdge,
} from "@/lib/prompt-tree-types";

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

let _nodeCounter = 0;
function makeNodeId(prefix: string): string {
  _nodeCounter++;
  return `${prefix}_${_nodeCounter}_${Date.now().toString(36)}`;
}

function makeEdgeId(sourceId: string, idx: number): string {
  return `edge_${sourceId}_${idx}`;
}

/** Reset counter (for testing) */
export function resetCounter(): void {
  _nodeCounter = 0;
}

// ---------------------------------------------------------------------------
// Tool builders (match the shapes in register-agent-tools.ts)
// ---------------------------------------------------------------------------

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

function buildCalendarTools(
  clientId: string,
  provider: "google" | "calendly"
): ConversationFlowTool[] {
  if (provider === "calendly") {
    return [
      {
        type: "custom",
        tool_id: "check_calendly_availability",
        name: "check_calendly_availability",
        description:
          "Check available appointment slots on Calendly for a given date.",
        url: `${APP_URL}/api/tools/calendly/availability`,
        method: "POST",
        timeout_ms: 5000,
        speak_during_execution: true,
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description:
                "The date to check availability for, in YYYY-MM-DD format",
            },
          },
          required: ["date"],
        },
        headers: { "x-client-id": clientId },
      } as ConversationFlowCustomTool,
      {
        type: "custom",
        tool_id: "book_calendly_appointment",
        name: "book_calendly_appointment",
        description:
          "Book an appointment on Calendly at a specific time.",
        url: `${APP_URL}/api/tools/calendly/book`,
        method: "POST",
        timeout_ms: 5000,
        speak_during_execution: true,
        parameters: {
          type: "object",
          properties: {
            start_time: {
              type: "string",
              description: "ISO 8601 datetime for appointment start",
            },
            name: { type: "string", description: "Caller's full name" },
            email: { type: "string", description: "Caller's email address" },
            phone: { type: "string", description: "Caller's phone number" },
          },
          required: ["start_time", "name", "email"],
        },
        headers: { "x-client-id": clientId },
      } as ConversationFlowCustomTool,
    ];
  }

  // Google Calendar
  return [
    {
      type: "custom",
      tool_id: "check_availability",
      name: "check_availability",
      description:
        "Check available appointment slots for a given date.",
      url: `${APP_URL}/api/tools/calendar/availability`,
      method: "POST",
      timeout_ms: 5000,
      speak_during_execution: true,
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "The date to check availability for, in YYYY-MM-DD format",
          },
          duration_minutes: {
            type: "number",
            description:
              "How long the appointment should be in minutes. Default 60.",
          },
        },
        required: ["date"],
      },
      headers: { "x-client-id": clientId },
    } as ConversationFlowCustomTool,
    {
      type: "custom",
      tool_id: "book_appointment",
      name: "book_appointment",
      description:
        "Book an appointment at a specific time.",
      url: `${APP_URL}/api/tools/calendar/book`,
      method: "POST",
      timeout_ms: 5000,
      speak_during_execution: true,
      parameters: {
        type: "object",
        properties: {
          start_time: {
            type: "string",
            description: "ISO 8601 datetime for appointment start",
          },
          end_time: {
            type: "string",
            description: "ISO 8601 datetime for appointment end",
          },
          summary: {
            type: "string",
            description: "Brief title for the appointment",
          },
          attendee_name: {
            type: "string",
            description: "Caller's full name",
          },
          attendee_email: {
            type: "string",
            description: "Caller's email address",
          },
          attendee_phone: {
            type: "string",
            description: "Caller's phone number",
          },
          notes: {
            type: "string",
            description: "Additional notes for the appointment",
          },
        },
        required: ["start_time", "end_time", "summary"],
      },
      headers: { "x-client-id": clientId },
    } as ConversationFlowCustomTool,
  ];
}

function buildCrmLookupTool(clientId: string): ConversationFlowCustomTool {
  return {
    type: "custom",
    tool_id: "lookup_caller",
    name: "lookup_caller",
    description:
      "Look up a caller by phone number in the CRM to check if they are an existing contact.",
    url: `${APP_URL}/api/tools/hubspot/lookup`,
    method: "POST",
    timeout_ms: 5000,
    speak_during_execution: true,
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "The caller's phone number",
        },
      },
      required: ["phone"],
    },
    headers: { "x-client-id": clientId },
  };
}

function buildWebhookTool(
  name: string,
  node: FlowNode
): ConversationFlowCustomTool {
  return {
    type: "custom",
    tool_id: name,
    name,
    description:
      node.data.text || `Send conversation data to webhook endpoint`,
    url: node.data.webhookUrl!,
    method: node.data.webhookMethod || "POST",
    timeout_ms: 5000,
    speak_during_execution: true,
    parameters: {
      type: "object",
      properties: {
        caller_name: {
          type: "string",
          description: "The caller's name",
        },
        caller_phone: {
          type: "string",
          description: "The caller's phone number",
        },
        caller_email: {
          type: "string",
          description: "The caller's email if provided",
        },
        notes: {
          type: "string",
          description: "Any relevant notes from the conversation",
        },
      },
      required: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

export interface CompileResult {
  flowData: ConversationFlowData;
  /** Tool definitions that should be registered at the flow level */
  tools: ConversationFlowTool[];
}

/**
 * Compile FlowNode[] into Retell's native ConversationFlowData.
 *
 * The resulting data can be sent directly to Retell's
 * `/create-conversation-flow` or `/update-conversation-flow` endpoints,
 * and the agent's `response_engine.type` should be set to `"conversation-flow"`.
 */
export function compileFlowToRetellNodes(
  flowNodes: FlowNode[],
  clientId: string
): CompileResult {
  if (!flowNodes.length) {
    return {
      flowData: {
        nodes: [],
        start_node_id: null,
        start_speaker: "agent",
        tools: [],
      },
      tools: [],
    };
  }

  resetCounter();

  const retellNodes: RetellNode[] = [];
  const tools: ConversationFlowTool[] = [];
  const toolNames = new Set<string>();

  // Helper to add tools without duplicates
  function addTools(newTools: ConversationFlowTool[]) {
    for (const t of newTools) {
      if (!toolNames.has(t.name)) {
        toolNames.add(t.name);
        tools.push(t);
      }
    }
  }

  // First pass: create all Retell nodes with IDs so we can wire edges
  const nodeIds: string[] = [];
  for (let i = 0; i < flowNodes.length; i++) {
    const fn = flowNodes[i];
    const nodeId = makeNodeId(fn.type);
    nodeIds.push(nodeId);
  }

  // Second pass: build each RetellNode with edges pointing to the next node
  let webhookIdx = 0;

  for (let i = 0; i < flowNodes.length; i++) {
    const fn = flowNodes[i];
    const nodeId = nodeIds[i];
    const nextNodeId = i < flowNodes.length - 1 ? nodeIds[i + 1] : undefined;
    const yPos = i * 300;

    switch (fn.type) {
      // ── Message → conversation node ──────────────────────────────
      case "message": {
        const edges: RetellEdge[] = [];
        if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt: "After delivering this message, move to the next step.",
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: Message`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text: fn.data.text || "Greet the caller.",
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }

      // ── Question → conversation node with option edges ───────────
      case "question": {
        const edges: RetellEdge[] = [];
        if (fn.data.options && fn.data.options.length > 0) {
          // Each option gets an edge — but in the linear model they all
          // point to the next node. The prompt condition captures the option.
          for (let oi = 0; oi < fn.data.options.length; oi++) {
            const opt = fn.data.options[oi];
            edges.push({
              id: makeEdgeId(nodeId, oi),
              destination_node_id: nextNodeId,
              transition_condition: {
                type: "prompt",
                prompt: `The caller responds with "${opt.label}" or something similar.`,
              },
            });
          }
          // Add a catch-all edge for unexpected responses
          if (nextNodeId) {
            edges.push({
              id: makeEdgeId(nodeId, fn.data.options.length),
              destination_node_id: nextNodeId,
              transition_condition: {
                type: "prompt",
                prompt:
                  "The caller responds with something else or is ready to continue.",
              },
            });
          }
        } else if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt:
                "The caller has answered the question. Continue to the next step.",
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: Question`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text: fn.data.text || "Ask the caller a question.",
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }

      // ── Condition → conversation node with conditional logic ─────
      case "condition": {
        // We use a conversation node with the condition as instruction text.
        // The edges represent "yes" and "no" paths — in the linear model
        // both currently go to the next node, but the prompt captures the logic.
        const edges: RetellEdge[] = [];
        if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt: `The condition is met: ${fn.data.condition || "proceed"}`,
            },
          });
          edges.push({
            id: makeEdgeId(nodeId, 1),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt: `The condition is NOT met — adapt your response accordingly and continue.`,
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: Evaluate`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text: `Evaluate: ${fn.data.condition || "the situation"}. Based on the caller's responses and the conversation so far, determine whether this condition is met and proceed accordingly.`,
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }

      // ── Transfer → transfer_call node ────────────────────────────
      case "transfer": {
        if (fn.data.transferNumber) {
          const failEdge: RetellEdge = {
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt: "Transfer failed or was not completed.",
            },
          };
          retellNodes.push({
            id: nodeId,
            type: "transfer_call",
            name: `Step ${i + 1}: Transfer`,
            display_position: { x: 0, y: yPos },
            transfer_destination: {
              type: "predefined",
              number: fn.data.transferNumber,
            },
            transfer_option: {
              type: "warm_transfer",
              show_transferee_as_caller: false,
              on_hold_music: "ringtone",
            },
            edge: failEdge,
            speak_during_execution: true,
            instruction: fn.data.text
              ? { type: "prompt", text: fn.data.text }
              : {
                  type: "prompt",
                  text: "Let the caller know you are transferring them now.",
                },
          } satisfies RetellTransferCallNode);
        } else {
          // No number — fall back to a conversation node
          const edges: RetellEdge[] = [];
          if (nextNodeId) {
            edges.push({
              id: makeEdgeId(nodeId, 0),
              destination_node_id: nextNodeId,
              transition_condition: {
                type: "prompt",
                prompt: "After attempting the transfer, continue.",
              },
            });
          }
          retellNodes.push({
            id: nodeId,
            type: "conversation",
            name: `Step ${i + 1}: Transfer`,
            display_position: { x: 0, y: yPos },
            instruction: {
              type: "prompt",
              text:
                fn.data.text ||
                "Transfer the call to the appropriate person or department.",
            },
            edges,
          } satisfies RetellConversationNode);
        }
        break;
      }

      // ── End → end node ───────────────────────────────────────────
      case "end": {
        retellNodes.push({
          id: nodeId,
          type: "end",
          name: `Step ${i + 1}: End`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text:
              fn.data.text ||
              "End the conversation politely. Thank the caller for their time.",
          },
        } satisfies RetellEndNode);
        break;
      }

      // ── Check Availability → conversation node + calendar tools ──
      case "check_availability": {
        const provider = fn.data.provider || "google";
        addTools(buildCalendarTools(clientId, provider));
        const toolName =
          provider === "calendly"
            ? "check_calendly_availability"
            : "check_availability";
        const edges: RetellEdge[] = [];
        if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt:
                "After checking availability and presenting options to the caller, continue.",
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: Check Availability`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text: `${fn.data.text || "Ask the caller what date they'd like to schedule for."} Then use the "${toolName}" tool to check available time slots for that date. Read back the available times and ask the caller to pick one.`,
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }

      // ── Book Appointment → conversation node + calendar tools ────
      case "book_appointment": {
        const provider = fn.data.provider || "google";
        addTools(buildCalendarTools(clientId, provider));
        const toolName =
          provider === "calendly"
            ? "book_calendly_appointment"
            : "book_appointment";
        const edges: RetellEdge[] = [];
        if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt:
                "After booking the appointment and confirming details, continue.",
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: Book Appointment`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text: `${fn.data.text || "Confirm the selected time with the caller."} Then use the "${toolName}" tool to book the appointment. Collect the caller's name and contact info (phone/email) for the booking. Confirm the booking details once complete.`,
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }

      // ── CRM Lookup → conversation node + hubspot tool ────────────
      case "crm_lookup": {
        addTools([buildCrmLookupTool(clientId)]);
        const edges: RetellEdge[] = [];
        if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt:
                "After looking up the caller and greeting them appropriately, continue.",
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: CRM Lookup`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text:
              fn.data.text ||
              'Use the "lookup_caller" tool with the caller\'s phone number to check if they\'re an existing contact. If found, greet them by name and reference their account. If not found, proceed to collect their information.',
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }

      // ── Webhook → conversation node + custom tool ────────────────
      case "webhook": {
        if (fn.data.webhookUrl) {
          webhookIdx++;
          const toolName = `flow_webhook_${webhookIdx}`;
          addTools([buildWebhookTool(toolName, fn)]);
          const edges: RetellEdge[] = [];
          if (nextNodeId) {
            edges.push({
              id: makeEdgeId(nodeId, 0),
              destination_node_id: nextNodeId,
              transition_condition: {
                type: "prompt",
                prompt: "After sending the data, continue.",
              },
            });
          }
          retellNodes.push({
            id: nodeId,
            type: "conversation",
            name: `Step ${i + 1}: Webhook`,
            display_position: { x: 0, y: yPos },
            instruction: {
              type: "prompt",
              text: `${fn.data.text || "Collect relevant caller information."} Then use the "${toolName}" tool to send the data (caller name, phone, email, and any relevant notes from the conversation).`,
            },
            edges,
          } satisfies RetellConversationNode);
        } else {
          // No URL — just a data collection step
          const edges: RetellEdge[] = [];
          if (nextNodeId) {
            edges.push({
              id: makeEdgeId(nodeId, 0),
              destination_node_id: nextNodeId,
              transition_condition: {
                type: "prompt",
                prompt: "After collecting the information, continue.",
              },
            });
          }
          retellNodes.push({
            id: nodeId,
            type: "conversation",
            name: `Step ${i + 1}: Collect Info`,
            display_position: { x: 0, y: yPos },
            instruction: {
              type: "prompt",
              text:
                fn.data.text ||
                "Collect relevant caller information (name, phone, email, and any relevant notes).",
            },
            edges,
          } satisfies RetellConversationNode);
        }
        break;
      }

      // ── Request Callback → conversation node ─────────────────────
      case "request_callback": {
        const edges: RetellEdge[] = [];
        if (nextNodeId) {
          edges.push({
            id: makeEdgeId(nodeId, 0),
            destination_node_id: nextNodeId,
            transition_condition: {
              type: "prompt",
              prompt:
                "After arranging the callback, continue.",
            },
          });
        }
        retellNodes.push({
          id: nodeId,
          type: "conversation",
          name: `Step ${i + 1}: Request Callback`,
          display_position: { x: 0, y: yPos },
          instruction: {
            type: "prompt",
            text:
              fn.data.text ||
              "Let the caller know that their question will be emailed to the team, and someone will call them back with an answer. Collect their name, phone number, and a brief description of their question.",
          },
          edges,
        } satisfies RetellConversationNode);
        break;
      }
    }
  }

  // Build the global prompt (guidelines that apply across all nodes)
  const globalPrompt = [
    "GUIDELINES:",
    "- Keep responses concise and natural-sounding for voice conversation.",
    "- If the caller goes off-script, gently guide them back to the flow.",
    "- Be empathetic and professional throughout the conversation.",
    "- If you cannot resolve something, offer to transfer to a human agent.",
    "- When using tools, let the caller know you're working on it (e.g., 'Let me check that for you').",
  ].join("\n");

  const flowData: ConversationFlowData = {
    nodes: retellNodes,
    start_node_id: nodeIds[0] || null,
    start_speaker: "agent",
    global_prompt: globalPrompt,
    model_choice: { model: "gpt-4.1", type: "cascading" },
    tools,
  };

  return { flowData, tools };
}
