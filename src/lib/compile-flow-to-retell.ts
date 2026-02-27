// ---------------------------------------------------------------------------
// FlowNode → Retell LLM States Compiler
// ---------------------------------------------------------------------------
// Converts FlowNode[] (onboarding + Flows page) into retell-llm multi-state
// format (states[] + general_tools[]).
//
// WHY: Retell does NOT allow changing response_engine type after creation
// ("Cannot update response engine of agent version > 0"). Since agents are
// created as retell-llm, we MUST stay within that engine type.
//
// The Prompt Tree Editor already handles retell-llm states via
// convertLLMToFlow() and convertFlowToLLM(), so these states will
// render as visual nodes in the editor.
//
// TOOLS: Uses Retell-native tool types (end_call, transfer_call) where
// possible — these work without custom URLs. Custom tools (calendar, CRM,
// webhook) require a public APP_URL and are only generated in production.
// ---------------------------------------------------------------------------

import type { FlowNode } from "@/lib/conversation-flow-templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetellLLMState {
  name: string;
  state_prompt: string;
  edges: RetellLLMStateEdge[];
  tools?: RetellLLMTool[];
}

export interface RetellLLMStateEdge {
  destination_state_name: string;
  description: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RetellLLMTool = Record<string, any>;

export interface CompileResult {
  states: RetellLLMState[];
  starting_state: string;
  general_prompt: string;
  general_tools: RetellLLMTool[];
}

/**
 * Filter out custom tools that have non-public URLs (localhost, private IPs).
 * Call this before sending state.tools to Retell — Retell rejects custom tools
 * with non-public hostnames. The compiler always generates all tools so the
 * editor can display them; this function strips the ones Retell can't call.
 */
export function filterToolsForRetell(tools: RetellLLMTool[]): RetellLLMTool[] {
  return tools.filter((t) => {
    if (t.type !== "custom") return true; // native tools always OK
    return isPublicUrl(t.url as string || "");
  });
}

/**
 * Filter state-level tools for all states before sending to Retell.
 */
export function filterStatesForRetell(states: RetellLLMState[]): RetellLLMState[] {
  return states.map((s) => {
    if (!s.tools || s.tools.length === 0) return s;
    const filtered = filterToolsForRetell(s.tools);
    if (filtered.length === s.tools.length) return s; // all tools pass — no change
    // Destructure to remove old tools, then add filtered (or omit if empty).
    // JSON.stringify omits undefined values, so Retell won't see an empty tools array.
    const { tools: _old, ...rest } = s;
    return filtered.length > 0 ? { ...rest, tools: filtered } : rest;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL environment variable is required");
  return url;
}

function isPublicUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      host !== "0.0.0.0" &&
      !host.startsWith("192.168.") &&
      !host.startsWith("10.")
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tool builders — Native Retell tools (no URL needed, work everywhere)
// ---------------------------------------------------------------------------

function buildEndCallTool(): RetellLLMTool {
  return {
    type: "end_call",
    name: "end_call",
    description: "End the phone call when the conversation is complete.",
  };
}

function buildTransferCallTool(name: string, node: FlowNode): RetellLLMTool {
  return {
    type: "transfer_call",
    name,
    description: node.data.text
      ? `Transfer the call: ${node.data.text}`
      : "Transfer the call to the appropriate department or person.",
    transfer_destination: node.data.transferNumber
      ? { type: "predefined", number: node.data.transferNumber }
      : { type: "inferred", prompt: "Determine the appropriate transfer destination based on the caller's needs." },
    transfer_option: { type: "warm_transfer", show_transferee_as_caller: false, on_hold_music: "ringtone" },
    speak_during_execution: true,
    execution_message_description: "Let the caller know you are transferring them now",
    execution_message_type: "prompt",
  };
}

// ---------------------------------------------------------------------------
// Tool builders — Custom tools (require public APP_URL for Retell validation)
// ---------------------------------------------------------------------------

function buildCalendarTools(clientId: string, provider: "google" | "calendly"): RetellLLMTool[] {
  if (provider === "calendly") {
    return [
      {
        type: "custom",
        name: "check_calendly_availability",
        description: "Check available appointment slots on Calendly.",
        url: `${getAppUrl()}/api/tools/calendly/availability`,
        method: "POST",
        speak_during_execution: true,
        execution_message_description: "Let the caller know you are checking the calendar",
        speak_after_execution: true,
        timeout_ms: 5000,
        parameters: { type: "object", properties: { date: { type: "string", description: "Date in YYYY-MM-DD format" } }, required: ["date"] },
        headers: { "x-client-id": clientId },
      },
      {
        type: "custom",
        name: "book_calendly_appointment",
        description: "Book an appointment on Calendly.",
        url: `${getAppUrl()}/api/tools/calendly/book`,
        method: "POST",
        speak_during_execution: true,
        execution_message_description: "Let the caller know you are booking the appointment",
        speak_after_execution: true,
        timeout_ms: 5000,
        parameters: { type: "object", properties: { start_time: { type: "string", description: "ISO 8601 datetime" }, name: { type: "string", description: "Caller's name" }, email: { type: "string", description: "Caller's email" }, phone: { type: "string", description: "Caller's phone" } }, required: ["start_time", "name", "email"] },
        headers: { "x-client-id": clientId },
      },
    ];
  }
  return [
    {
      type: "custom",
      name: "check_availability",
      description: "Check available appointment slots for a given date.",
      url: `${getAppUrl()}/api/tools/calendar/availability`,
      method: "POST",
      speak_during_execution: true,
      execution_message_description: "Let the caller know you are checking the calendar",
      speak_after_execution: true,
      timeout_ms: 5000,
      parameters: { type: "object", properties: { date: { type: "string", description: "Date in YYYY-MM-DD format" }, duration_minutes: { type: "number", description: "Duration in minutes. Default 60." } }, required: ["date"] },
      headers: { "x-client-id": clientId },
    },
    {
      type: "custom",
      name: "book_appointment",
      description: "Book an appointment at a specific time.",
      url: `${getAppUrl()}/api/tools/calendar/book`,
      method: "POST",
      speak_during_execution: true,
      execution_message_description: "Let the caller know you are booking the appointment",
      speak_after_execution: true,
      timeout_ms: 5000,
      parameters: { type: "object", properties: { start_time: { type: "string", description: "ISO 8601 datetime for start" }, end_time: { type: "string", description: "ISO 8601 datetime for end" }, summary: { type: "string", description: "Brief title" }, attendee_name: { type: "string", description: "Caller's name" }, attendee_email: { type: "string", description: "Caller's email" }, attendee_phone: { type: "string", description: "Caller's phone" }, notes: { type: "string", description: "Additional notes" } }, required: ["start_time", "end_time", "summary"] },
      headers: { "x-client-id": clientId },
    },
  ];
}

function buildCrmTool(clientId: string): RetellLLMTool[] {
  return [{
    type: "custom",
    name: "lookup_caller",
    description: "Look up a caller by phone number in the CRM.",
    url: `${getAppUrl()}/api/tools/hubspot/lookup`,
    method: "POST",
    speak_during_execution: true,
    execution_message_description: "Let the caller know you are looking them up",
    speak_after_execution: true,
    timeout_ms: 5000,
    parameters: { type: "object", properties: { phone: { type: "string", description: "Caller's phone number" } }, required: ["phone"] },
    headers: { "x-client-id": clientId },
  }];
}

function buildWebhookTool(name: string, node: FlowNode): RetellLLMTool | null {
  if (!node.data.webhookUrl) return null;
  return {
    type: "custom", name,
    description: node.data.text || "Send conversation data to webhook",
    url: node.data.webhookUrl,
    method: node.data.webhookMethod || "POST",
    speak_during_execution: true,
    execution_message_description: "One moment while I process that",
    speak_after_execution: true,
    timeout_ms: 5000,
    parameters: { type: "object", properties: { caller_name: { type: "string", description: "Caller's name" }, caller_phone: { type: "string", description: "Caller's phone number" }, caller_email: { type: "string", description: "Caller's email if provided" }, notes: { type: "string", description: "Relevant notes from the conversation" } }, required: [] },
  };
}

// ---------------------------------------------------------------------------
// State name helper
// ---------------------------------------------------------------------------

function makeStateName(index: number, type: string): string {
  const typeLabel: Record<string, string> = {
    message: "message", question: "question", condition: "evaluate",
    transfer: "transfer", end: "end-call", check_availability: "check-availability",
    book_appointment: "book-appointment", crm_lookup: "crm-lookup",
    webhook: "webhook", request_callback: "request-callback",
  };
  return `step-${index + 1}_${typeLabel[type] || type}`;
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

export function compileFlowToRetellStates(
  flowNodes: FlowNode[],
  clientId: string
): CompileResult {
  if (!flowNodes.length) {
    return { states: [], starting_state: "", general_prompt: "", general_tools: [] };
  }

  const states: RetellLLMState[] = [];
  const stateNames = flowNodes.map((fn, i) => makeStateName(i, fn.type));
  let webhookIdx = 0, transferIdx = 0;

  for (let i = 0; i < flowNodes.length; i++) {
    const fn = flowNodes[i];
    const name = stateNames[i];
    const next = i < flowNodes.length - 1 ? stateNames[i + 1] : undefined;
    const edges: RetellLLMStateEdge[] = [];

    switch (fn.type) {
      case "message":
        if (next) edges.push({ destination_state_name: next, description: "After delivering this message, move to the next step." });
        states.push({ name, state_prompt: fn.data.text || "Greet the caller.", edges });
        break;

      case "question":
        if (next) edges.push({ destination_state_name: next, description: "The caller has answered the question. Continue." });
        states.push({ name, state_prompt: fn.data.text || "Ask the caller a question.", edges });
        break;

      case "condition":
        if (next) {
          edges.push({ destination_state_name: next, description: `Evaluate: ${fn.data.condition || "the situation"}. If met, proceed. If not, adapt accordingly and continue.` });
        }
        states.push({ name, state_prompt: `Evaluate: ${fn.data.condition || "the situation"}. Determine if condition is met and proceed.`, edges });
        break;

      case "transfer": {
        transferIdx++;
        const toolName = `transfer_call_${transferIdx}`;
        const tool = buildTransferCallTool(toolName, fn);
        if (next) edges.push({ destination_state_name: next, description: "If transfer fails, continue." });
        const transferPrompt = fn.data.text || "Let the caller know you're transferring them.";
        states.push({ name, state_prompt: `${transferPrompt} Use the "${toolName}" tool to transfer the call.`, edges, tools: [tool] });
        break;
      }

      case "end": {
        const endTool = buildEndCallTool();
        states.push({
          name,
          state_prompt: fn.data.text || "End the conversation politely. Thank the caller. Use the \"end_call\" tool to hang up.",
          edges: [],
          tools: [endTool],
        });
        break;
      }

      case "check_availability": {
        const prov = fn.data.provider || "google";
        const calTools = buildCalendarTools(clientId, prov);
        const tn = prov === "calendly" ? "check_calendly_availability" : "check_availability";
        const relevantTool = calTools.find(t => t.name === tn);
        if (next) edges.push({ destination_state_name: next, description: "After checking availability, continue." });
        const checkText = fn.data.text || "Ask what date they'd like.";
        if (relevantTool) {
          states.push({ name, state_prompt: `${checkText} Use "${tn}" to check slots.`, edges, tools: [relevantTool] });
        } else {
          states.push({ name, state_prompt: `${checkText} Ask the caller for their preferred date and check the calendar for available appointment slots.`, edges });
        }
        break;
      }

      case "book_appointment": {
        const prov = fn.data.provider || "google";
        const calTools = buildCalendarTools(clientId, prov);
        const tn = prov === "calendly" ? "book_calendly_appointment" : "book_appointment";
        const relevantTool = calTools.find(t => t.name === tn);
        if (next) edges.push({ destination_state_name: next, description: "After booking, continue." });
        const bookText = fn.data.text || "Confirm the time.";
        if (relevantTool) {
          states.push({ name, state_prompt: `${bookText} Use "${tn}" to book. Collect name/contact info.`, edges, tools: [relevantTool] });
        } else {
          states.push({ name, state_prompt: `${bookText} Confirm the appointment details and collect the caller's name, email, and phone number to complete the booking.`, edges });
        }
        break;
      }

      case "crm_lookup": {
        const crmTools = buildCrmTool(clientId);
        const relevantTool = crmTools.find(t => t.name === "lookup_caller");
        if (next) edges.push({ destination_state_name: next, description: "After looking up caller, continue." });
        if (relevantTool) {
          states.push({ name, state_prompt: fn.data.text || 'Use "lookup_caller" with the caller\'s phone to check if they\'re known.', edges, tools: [relevantTool] });
        } else {
          states.push({ name, state_prompt: fn.data.text || "Ask the caller for their name and phone number so you can look them up in the system.", edges });
        }
        break;
      }

      case "webhook": {
        webhookIdx++;
        const toolName = `flow_webhook_${webhookIdx}`;
        const tool = buildWebhookTool(toolName, fn);
        if (next) edges.push({ destination_state_name: next, description: "After sending data, continue." });
        const webhookText = fn.data.text || "Collect caller info.";
        if (tool) {
          states.push({ name, state_prompt: `${webhookText} Use "${toolName}" to send data.`, edges, tools: [tool] });
        } else {
          states.push({ name, state_prompt: `${webhookText} Collect the caller's name, phone number, email, and any relevant notes.`, edges });
        }
        break;
      }

      case "request_callback":
        if (next) edges.push({ destination_state_name: next, description: "After arranging callback, continue." });
        states.push({ name, state_prompt: fn.data.text || "Let caller know someone will call back. Collect name, phone, and question.", edges });
        break;
    }
  }

  return {
    states,
    starting_state: stateNames[0] || "",
    general_prompt: [
      "GUIDELINES:",
      "- Keep responses concise and natural for voice.",
      "- If caller goes off-script, gently guide them back.",
      "- Be empathetic and professional.",
      "- When using tools, let the caller know you're working on it.",
    ].join("\n"),
    general_tools: [],
  };
}
