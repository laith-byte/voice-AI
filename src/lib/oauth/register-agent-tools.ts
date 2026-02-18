import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://portal.invarialabs.com";

// Tool definitions for Retell custom tools (exported for reuse by flow deployer)
export const CALENDAR_TOOLS = [
  {
    type: "custom",
    name: "check_availability",
    description:
      "Check available appointment slots for a given date. Use this when a caller wants to schedule an appointment.",
    url: `${APP_URL}/api/tools/calendar/availability`,
    method: "POST",
    speak_during_execution: true,
    execution_message_description:
      "Let the caller know you are checking the calendar for available times",
    speak_after_execution: true,
    timeout_ms: 5000,
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date to check availability for, in YYYY-MM-DD format",
        },
        duration_minutes: {
          type: "number",
          description: "How long the appointment should be in minutes. Default 60.",
        },
      },
      required: ["date"],
    },
    response_variables: {
      available_slots: "$.slots",
      earliest_slot: "$.earliest",
    },
  },
  {
    type: "custom",
    name: "book_appointment",
    description:
      "Book an appointment at a specific time. Use this after the caller confirms a time slot.",
    url: `${APP_URL}/api/tools/calendar/book`,
    method: "POST",
    speak_during_execution: true,
    execution_message_description:
      "Let the caller know you are booking the appointment",
    speak_after_execution: true,
    timeout_ms: 5000,
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
          description: "The caller's name",
        },
        attendee_phone: {
          type: "string",
          description: "The caller's phone number",
        },
        attendee_email: {
          type: "string",
          description: "The caller's email (if provided)",
        },
      },
      required: ["start_time", "end_time"],
    },
    response_variables: {
      booking_confirmed: "$.success",
      event_time: "$.event_time",
    },
  },
];

export const CALENDLY_TOOLS = [
  {
    type: "custom",
    name: "check_calendly_availability",
    description:
      "Check available appointment slots on Calendly for a given date. Use this when a caller wants to schedule an appointment via Calendly.",
    url: `${APP_URL}/api/tools/calendly/availability`,
    method: "POST",
    speak_during_execution: true,
    execution_message_description:
      "Let the caller know you are checking Calendly for available times",
    speak_after_execution: true,
    timeout_ms: 5000,
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date to check availability for, in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
    response_variables: {
      available_slots: "$.slots",
      earliest_slot: "$.earliest",
    },
  },
  {
    type: "custom",
    name: "book_calendly_appointment",
    description:
      "Book an appointment via Calendly. Use this after the caller confirms a time slot.",
    url: `${APP_URL}/api/tools/calendly/book`,
    method: "POST",
    speak_during_execution: true,
    execution_message_description:
      "Let the caller know you are booking the appointment on Calendly",
    speak_after_execution: true,
    timeout_ms: 5000,
    parameters: {
      type: "object",
      properties: {
        event_type_uri: {
          type: "string",
          description: "The Calendly event type URI to book",
        },
        start_time: {
          type: "string",
          description: "ISO 8601 datetime for appointment start",
        },
        invitee_name: {
          type: "string",
          description: "The caller's name",
        },
        invitee_email: {
          type: "string",
          description: "The caller's email (if provided)",
        },
        invitee_phone: {
          type: "string",
          description: "The caller's phone number",
        },
      },
      required: ["event_type_uri", "start_time"],
    },
    response_variables: {
      booking_confirmed: "$.success",
      booking_url: "$.booking_url",
    },
  },
];

export const HUBSPOT_TOOLS = [
  {
    type: "custom",
    name: "lookup_caller",
    description:
      "Look up a caller's information by their phone number. Use this at the start of the call to personalize the conversation.",
    url: `${APP_URL}/api/tools/hubspot/lookup`,
    method: "POST",
    speak_during_execution: false,
    speak_after_execution: true,
    timeout_ms: 5000,
    parameters: {
      type: "object",
      properties: {
        caller_phone_number: {
          type: "string",
          description: "The caller's phone number in E.164 format",
        },
      },
      required: ["caller_phone_number"],
    },
    response_variables: {
      caller_found: "$.found",
      caller_name: "$.caller_name",
      caller_company: "$.company",
    },
  },
];

async function getRetellApiKeyForClient(
  clientId: string
): Promise<{ apiKey: string; retellAgentId: string } | null> {
  const supabase = await createServiceClient();

  // Get the client's agent
  const { data: agent } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_api_key_encrypted, organization_id")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (!agent?.retell_agent_id) return null;

  const apiKey =
    (agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted)
      : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!apiKey) return null;

  return { apiKey, retellAgentId: agent.retell_agent_id };
}

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

export function injectClientId(
  tools: Record<string, unknown>[],
  clientId: string
): Record<string, unknown>[] {
  return tools.map((tool) => ({
    ...tool,
    // Append client_id to tool URL so our API endpoints know which client's tokens to use
    url: `${tool.url}?client_id=${clientId}`,
  }));
}

export function addAuthHeaders(
  tools: Record<string, unknown>[]
): Record<string, unknown>[] {
  const apiKey = process.env.RETELL_TOOLS_API_KEY;
  if (!apiKey) return tools;

  return tools.map((tool) => ({
    ...tool,
    header: { Authorization: `Bearer ${apiKey}` },
  }));
}

export async function registerAgentTools(
  clientId: string,
  provider: string
): Promise<void> {
  const retell = await getRetellApiKeyForClient(clientId);
  if (!retell) return;

  // Fetch current agent config
  const agentRes = await retellFetch(
    `/get-agent/${retell.retellAgentId}`,
    retell.apiKey
  );
  if (!agentRes.ok) return;

  const agent = await agentRes.json();
  const engine = agent.response_engine;

  // Get current tools
  let currentTools: Record<string, unknown>[] = [];
  let usesLlmId = false;
  let llmId: string | null = null;

  if (engine?.llm_id) {
    usesLlmId = true;
    llmId = engine.llm_id;
    const llmRes = await retellFetch(
      `/get-retell-llm/${llmId}`,
      retell.apiKey
    );
    if (llmRes.ok) {
      const llm = await llmRes.json();
      currentTools = llm.general_tools || llm.tools || [];
    }
  } else if (engine?.llm) {
    currentTools = engine.llm.tools || engine.llm.general_tools || [];
  }

  // Determine which tools to add, injecting client_id into URLs
  let newTools: Record<string, unknown>[] = [];
  if (provider === "google") {
    newTools = addAuthHeaders(
      injectClientId(CALENDAR_TOOLS as unknown as Record<string, unknown>[], clientId)
    );
  } else if (provider === "hubspot") {
    newTools = addAuthHeaders(
      injectClientId(HUBSPOT_TOOLS as unknown as Record<string, unknown>[], clientId)
    );
  } else if (provider === "calendly") {
    newTools = addAuthHeaders(
      injectClientId(CALENDLY_TOOLS as unknown as Record<string, unknown>[], clientId)
    );
  }

  // Filter out any existing tools with the same names
  const newToolNames = new Set(newTools.map((t) => t.name));
  const filteredTools = currentTools.filter(
    (t) => !newToolNames.has(t.name as string)
  );
  const updatedTools = [...filteredTools, ...newTools];

  // Update via Retell API
  if (usesLlmId && llmId) {
    await retellFetch(`/update-retell-llm/${llmId}`, retell.apiKey, {
      method: "PATCH",
      body: JSON.stringify({ general_tools: updatedTools }),
    });
  } else {
    await retellFetch(
      `/update-agent/${retell.retellAgentId}`,
      retell.apiKey,
      {
        method: "PATCH",
        body: JSON.stringify({
          response_engine: {
            type: "retell-llm",
            llm: { tools: updatedTools },
          },
        }),
      }
    );
  }
}

export async function unregisterAgentTools(
  clientId: string,
  provider: string
): Promise<void> {
  const retell = await getRetellApiKeyForClient(clientId);
  if (!retell) return;

  // Fetch current agent config
  const agentRes = await retellFetch(
    `/get-agent/${retell.retellAgentId}`,
    retell.apiKey
  );
  if (!agentRes.ok) return;

  const agent = await agentRes.json();
  const engine = agent.response_engine;

  let currentTools: Record<string, unknown>[] = [];
  let usesLlmId = false;
  let llmId: string | null = null;

  if (engine?.llm_id) {
    usesLlmId = true;
    llmId = engine.llm_id;
    const llmRes = await retellFetch(
      `/get-retell-llm/${llmId}`,
      retell.apiKey
    );
    if (llmRes.ok) {
      const llm = await llmRes.json();
      currentTools = llm.general_tools || llm.tools || [];
    }
  } else if (engine?.llm) {
    currentTools = engine.llm.tools || engine.llm.general_tools || [];
  }

  // Determine which tool names to remove
  let toolNamesToRemove: string[] = [];
  if (provider === "google") {
    toolNamesToRemove = CALENDAR_TOOLS.map((t) => t.name);
  } else if (provider === "hubspot") {
    toolNamesToRemove = HUBSPOT_TOOLS.map((t) => t.name);
  } else if (provider === "calendly") {
    toolNamesToRemove = CALENDLY_TOOLS.map((t) => t.name);
  }

  const removeSet = new Set(toolNamesToRemove);
  const updatedTools = currentTools.filter(
    (t) => !removeSet.has(t.name as string)
  );

  // Update via Retell API
  if (usesLlmId && llmId) {
    await retellFetch(`/update-retell-llm/${llmId}`, retell.apiKey, {
      method: "PATCH",
      body: JSON.stringify({ general_tools: updatedTools }),
    });
  } else {
    await retellFetch(
      `/update-agent/${retell.retellAgentId}`,
      retell.apiKey,
      {
        method: "PATCH",
        body: JSON.stringify({
          response_engine: {
            type: "retell-llm",
            llm: { tools: updatedTools },
          },
        }),
      }
    );
  }
}
