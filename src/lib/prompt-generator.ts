import Handlebars from "handlebars";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { filterToolsForRetell } from "@/lib/compile-flow-to-retell";

// Re-export from standalone module (no Next.js deps) so seed scripts can import directly
export { AGENT_PERSONALITIES, generateFlowPromptTemplate, generateFirstMessageTemplate, type AgentPersonality } from "./prompt-templates";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatTime(time: string | null): string {
  if (!time) return "";
  // time comes as HH:MM:SS from Postgres — format to 12-hour
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

const BEHAVIOR_LABELS: Record<string, string> = {
  callback: "use the request_callback tool to email the business owner and arrange a callback with the answer",
  message: "take a message and email it to the business owner",
  hours: "tell them the business hours and suggest they call back",
  transfer: "warm transfer the call to the escalation phone number",
  website: "apologize and suggest they visit the website",
};

const AFTER_HOURS_INSTRUCTIONS: Record<string, string> = {
  callback:
    "If the caller needs something that requires a warm transfer or a human: use the request_callback tool to email the business owner and arrange a callback. Tell the caller you'll get back to them soon — we will call them back immediately with the answer, or first thing the next business morning if it's overnight. The caller should never know a human was involved — keep the experience seamless as if you handled it yourself.",
  message:
    "If the caller needs something that requires a warm transfer or a human: take a detailed message including the caller's name, phone number, and what they need. Email it to the business owner. Let the caller know someone will get back to them during business hours.",
  hours:
    "If the caller needs something you can't answer: politely let them know they've reached you outside business hours. Tell them your business hours and suggest they call back during those times. Offer to take a quick message if they'd like.",
};

const UNANSWERABLE_INSTRUCTIONS: Record<string, string> = {
  transfer:
    "If the caller asks something you can't answer: warm transfer to the escalation phone number. If the transfer fails, take a detailed message and email it to the business owner.",
  message:
    "If the caller asks something you can't answer: take a detailed message including what they need, and email it to the business owner.",
  callback:
    "If the caller asks something you can't answer: use the request_callback tool to email the business owner and arrange a callback with the answer. Tell the caller you'll get back to them soon.",
  website:
    "If the caller asks something you can't answer: apologize and suggest they visit the business website for more information.",
};

// Default prompt template used when no template is associated with the agent
const DEFAULT_PROMPT_TEMPLATE = `## Identity

You are a friendly, professional AI receptionist for {{business_name}}.
{{#if business_address}}
You are located at {{business_address}}.
{{/if}}
{{#if business_phone}}
The business phone number is {{business_phone}}.
{{/if}}
{{#if business_website}}
The business website is {{business_website}}.
{{/if}}

## Response Guidelines

VOICE SPEECH RULES:
- Say phone numbers digit by digit with pauses, then confirm by reading back
- Use natural language for dates and times, never numeric formats
- Say dollar amounts in words, never symbols
- Spell out URLs and emails slowly, offer to repeat
- Say addresses slowly with pauses, always confirm by reading back
- After collecting critical info, read it back for confirmation

REAL-TIME CONVERSATION HANDLING:
- If interrupted, stop and address what the caller said
- Use brief acknowledgments while listening: "Mm-hmm," "I see," "Got it"
- After 3-5 seconds of silence: "Are you still there?"
- Before transferring, give a callback number in case of disconnection

## Task Instructions

BUSINESS HOURS ({{timezone}}):
{{#each business_hours}}
{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}
{{/each}}

{{#if services.length}}
SERVICES WE OFFER:
{{#each services}}
- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price}} ({{price}}){{/if}}{{#if ai_notes}}
  [Agent Note: {{ai_notes}}]{{/if}}
{{/each}}
{{/if}}

{{#if faqs.length}}
FREQUENTLY ASKED QUESTIONS:
{{#each faqs}}
Q: {{question}}
A: {{answer}}
{{/each}}
{{/if}}

{{#if policies.length}}
POLICIES:
{{#each policies}}
{{name}}: {{description}}
{{/each}}
{{/if}}

{{#if locations.length}}
LOCATIONS:
{{#each locations}}
- {{name}}: {{address}}{{#if phone}} ({{phone}}){{/if}}
{{/each}}
{{/if}}

CALL HANDLING RULES:

During business hours:
- {{unanswerable_instructions}}
- Never make up information — if unsure, follow the escalation steps above.

After hours:
- Help the caller normally with anything you can answer from the knowledge base above.
- {{after_hours_instructions}}

General:
- Keep calls concise and under {{max_call_duration}} minutes
- Always be warm, helpful, and professional
`;

const DEFAULT_CHAT_PROMPT_TEMPLATE = `## Identity

You are a friendly, professional AI chat assistant for {{business_name}}.
{{#if business_address}}
You are located at {{business_address}}.
{{/if}}
{{#if business_phone}}
The business phone number is {{business_phone}}.
{{/if}}
{{#if business_website}}
The business website is {{business_website}}.
{{/if}}

## Response Guidelines

CHAT CONVERSATION RULES:
- Keep responses concise and scannable — use short paragraphs
- Use bullet points for lists of 3 or more items
- Format important information clearly (bold key details)
- Be conversational but professional
- Respond promptly and stay on topic
- If sharing links or URLs, format them as clickable text

## Task Instructions

BUSINESS HOURS ({{timezone}}):
{{#each business_hours}}
{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}
{{/each}}

{{#if services.length}}
SERVICES WE OFFER:
{{#each services}}
- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price}} ({{price}}){{/if}}{{#if ai_notes}}
  [Agent Note: {{ai_notes}}]{{/if}}
{{/each}}
{{/if}}

{{#if faqs.length}}
FREQUENTLY ASKED QUESTIONS:
{{#each faqs}}
Q: {{question}}
A: {{answer}}
{{/each}}
{{/if}}

{{#if policies.length}}
POLICIES:
{{#each policies}}
{{name}}: {{description}}
{{/each}}
{{/if}}

{{#if locations.length}}
LOCATIONS:
{{#each locations}}
- {{name}}: {{address}}{{#if phone}} ({{phone}}){{/if}}
{{/each}}
{{/if}}

CHAT HANDLING RULES:

During business hours:
- If the visitor asks something you can't answer: let them know you'll find the answer and get back to them soon. As a last resort, take a detailed message and email it to the business owner.
- Never make up information — if unsure, follow the escalation steps above.

After hours:
- Help the visitor normally with anything you can answer from the knowledge base above.
- If they need something that requires a human: tell the visitor you'll get back to them soon. Internally, email a detailed summary to the business owner. Follow up once the business owner responds. The visitor should never know a human was involved — keep the experience seamless.

General:
- Always be warm, helpful, and professional
`;

const DEFAULT_SMS_PROMPT_TEMPLATE = `## Identity

You are a friendly, professional AI SMS assistant for {{business_name}}.
{{#if business_address}}
You are located at {{business_address}}.
{{/if}}
{{#if business_phone}}
The business phone number is {{business_phone}}.
{{/if}}
{{#if business_website}}
The business website is {{business_website}}.
{{/if}}

## Response Guidelines

SMS CONVERSATION RULES:
- Keep responses under 160 characters when possible for SMS readability
- Be concise and direct — every character counts in SMS
- Use simple language, avoid complex formatting
- If sharing URLs, keep them short
- Be conversational but professional
- Respond promptly and stay on topic

## Task Instructions

BUSINESS HOURS ({{timezone}}):
{{#each business_hours}}
{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}
{{/each}}

{{#if services.length}}
SERVICES WE OFFER:
{{#each services}}
- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price}} ({{price}}){{/if}}{{#if ai_notes}}
  [Agent Note: {{ai_notes}}]{{/if}}
{{/each}}
{{/if}}

{{#if faqs.length}}
FREQUENTLY ASKED QUESTIONS:
{{#each faqs}}
Q: {{question}}
A: {{answer}}
{{/each}}
{{/if}}

{{#if policies.length}}
POLICIES:
{{#each policies}}
{{name}}: {{description}}
{{/each}}
{{/if}}

{{#if locations.length}}
LOCATIONS:
{{#each locations}}
- {{name}}: {{address}}{{#if phone}} ({{phone}}){{/if}}
{{/each}}
{{/if}}

SMS HANDLING RULES:

During business hours:
- If the customer asks something you can't answer: let them know you'll find the answer and get back to them soon. As a last resort, take a detailed message and email it to the business owner.
- Never make up information — if unsure, follow the escalation steps above.

After hours:
- Help the customer normally with anything you can answer from the knowledge base above.
- If they need something that requires a human: tell the customer you'll get back to them soon. Internally, email a detailed summary to the business owner. Follow up once the business owner responds. The customer should never know a human was involved — keep the experience seamless.

General:
- Always be warm, helpful, and professional
`;

interface HoursRow {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface ServiceRow {
  name: string;
  description: string | null;
  price_text: string | null;
  ai_notes: string | null;
}

interface FaqRow {
  question: string;
  answer: string;
}

interface PolicyRow {
  name: string;
  description: string;
}

interface LocationRow {
  name: string;
  address: string;
  phone: string | null;
}

/**
 * Fetches all business data for a client and compiles the system prompt.
 * Returns the generated prompt string (does NOT push to Retell).
 */
export async function generatePrompt(
  clientId: string,
  promptTemplate?: string | null,
  agentType?: string
): Promise<string> {
  const supabase = await createServerClient();

  const [settingsRes, hoursRes, servicesRes, faqsRes, policiesRes, locationsRes] =
    await Promise.all([
      supabase.from("business_settings").select("*").eq("client_id", clientId).single(),
      supabase.from("business_hours").select("*").eq("client_id", clientId).order("day_of_week"),
      supabase
        .from("business_services")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_faqs")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_policies")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_locations")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const settings = settingsRes.data;
  if (!settings) {
    throw new Error("Business settings not found for client");
  }

  const defaultTemplate = agentType === "sms" ? DEFAULT_SMS_PROMPT_TEMPLATE : agentType === "chat" ? DEFAULT_CHAT_PROMPT_TEMPLATE : DEFAULT_PROMPT_TEMPLATE;
  const templateSource = promptTemplate || defaultTemplate;
  const template = Handlebars.compile(templateSource, { noEscape: true });

  const data = {
    business_name: settings.business_name || "our business",
    business_phone: settings.business_phone || "",
    business_address: settings.business_address || "",
    business_website: settings.business_website || "",
    timezone: settings.timezone || "local time",
    business_hours: (hoursRes.data || []).map((h: HoursRow) => ({
      day: DAY_NAMES[h.day_of_week] || `Day ${h.day_of_week}`,
      open: formatTime(h.open_time),
      close: formatTime(h.close_time),
      closed: !h.is_open,
    })),
    services: (servicesRes.data || []).map((s: ServiceRow) => ({
      name: s.name,
      description: s.description || "",
      price: s.price_text || "",
      ai_notes: s.ai_notes || "",
    })),
    faqs: (faqsRes.data || []).map((f: FaqRow) => ({
      question: f.question,
      answer: f.answer,
    })),
    policies: (policiesRes.data || []).map((p: PolicyRow) => ({
      name: p.name,
      description: p.description,
    })),
    locations: (locationsRes.data || []).map((l: LocationRow) => ({
      name: l.name,
      address: l.address,
      phone: l.phone || "",
    })),
    after_hours_behavior:
      BEHAVIOR_LABELS[settings.after_hours_behavior] || settings.after_hours_behavior,
    after_hours_instructions:
      AFTER_HOURS_INSTRUCTIONS[settings.after_hours_behavior] ||
      AFTER_HOURS_INSTRUCTIONS.callback,
    unanswerable_behavior:
      BEHAVIOR_LABELS[settings.unanswerable_behavior] || settings.unanswerable_behavior,
    unanswerable_instructions:
      UNANSWERABLE_INSTRUCTIONS[settings.unanswerable_behavior] ||
      UNANSWERABLE_INSTRUCTIONS.transfer,
    max_call_duration: settings.max_call_duration_minutes || 5,
  };

  return template(data).trim();
}

/**
 * Regenerates the system prompt for a client's agent and pushes it to Retell.
 * Called after any Knowledge Base save.
 */
export async function regeneratePrompt(clientId: string): Promise<void> {
  const supabase = await createServerClient();

  // Get the agent linked to this client, plus template if available
  const { data: agent } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted, platform")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (!agent?.retell_agent_id) {
    // No agent for this client yet — skip silently (happens during onboarding before agent creation)
    return;
  }

  const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";

  // Check if there's a template with a prompt_template
  const { data: templateLink } = await supabase
    .from("client_onboarding")
    .select("vertical_template_id")
    .eq("client_id", clientId)
    .single();

  let promptTemplate: string | null = null;
  let firstMessageTemplate: string | null = null;
  if (templateLink?.vertical_template_id) {
    const { data: tmpl } = await supabase
      .from("agent_templates")
      .select("prompt_template, first_message_template")
      .eq("id", templateLink.vertical_template_id)
      .single();
    promptTemplate = tmpl?.prompt_template || null;
    firstMessageTemplate = tmpl?.first_message_template || null;
  }

  const agentTypeStr = agent.platform === "retell-sms" ? "sms" : isChat ? "chat" : "voice";
  let generatedPrompt = await generatePrompt(clientId, promptTemplate, agentTypeStr);

  // Append Retell dynamic variable for callback context (voice agents only).
  // {{callback_context}} is empty for normal calls, filled by the outbound callback cron.
  // This MUST be appended AFTER Handlebars compilation so Handlebars doesn't consume it.
  if (!isChat) {
    generatedPrompt += "\n\n{{callback_context}}";
  }

  // Compile first message template with business name
  let compiledFirstMessage: string | null = null;
  if (firstMessageTemplate) {
    const { data: biz } = await supabase
      .from("business_settings")
      .select("business_name")
      .eq("client_id", clientId)
      .single();
    const compiled = Handlebars.compile(firstMessageTemplate, { noEscape: true });
    compiledFirstMessage = compiled({ business_name: biz?.business_name || "our business" }).trim();
  }

  // Get knowledge base settings for max_call_duration and escalation phone
  const { data: settings } = await supabase
    .from("business_settings")
    .select("max_call_duration_minutes, unanswerable_behavior, escalation_phone")
    .eq("client_id", clientId)
    .single();

  // Decrypt the API key
  const apiKey = agent.retell_api_key_encrypted
    ? decrypt(agent.retell_api_key_encrypted)
    : process.env.RETELL_API_KEY;

  if (!apiKey) {
    throw new Error("No Retell API key available");
  }

  if (isChat) {
    // Push to Retell Chat Agent API
    const res = await fetch(
      `https://api.retellai.com/update-chat-agent/${agent.retell_agent_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response_engine: {
            llm: {
              system_prompt: generatedPrompt,
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Retell Chat API error:", err);
      throw new Error(`Failed to update Retell chat agent: ${res.status}`);
    }
  } else {
    // Build transfer_call tool if escalation is configured
    const transferTool =
      settings?.unanswerable_behavior === "transfer" && settings?.escalation_phone
        ? {
            type: "transfer_call" as const,
            name: "transfer_to_human",
            description:
              "Transfer the call to a human agent when the caller explicitly requests to speak with a person, or when you cannot resolve their issue.",
            transfer_destination: {
              type: "predefined" as const,
              number: settings.escalation_phone,
            },
            transfer_option: {
              type: "warm_transfer" as const,
              show_transferee_as_caller: false,
              on_hold_music: "ringtone" as const,
            },
            speak_during_execution: true,
            execution_message_description:
              "Let the caller know you are transferring them now.",
            execution_message_type: "prompt" as const,
          }
        : null;

    // Fetch current agent config to get existing LLM ID or inline config
    const agentConfigRes = await fetch(
      `https://api.retellai.com/get-agent/${agent.retell_agent_id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    let usesLlmId = false;
    let llmId: string | null = null;
    let existingTools: Record<string, unknown>[] = [];
    let existingStates: Record<string, unknown>[] = [];
    let existingStartingState: string | undefined;

    if (agentConfigRes.ok) {
      const agentConfig = await agentConfigRes.json();
      const engine = agentConfig.response_engine;
      if (engine?.llm_id) {
        usesLlmId = true;
        llmId = engine.llm_id;
        // Fetch existing tools from the standalone LLM
        const llmRes = await fetch(
          `https://api.retellai.com/get-retell-llm/${llmId}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (llmRes.ok) {
          const llm = await llmRes.json();
          existingTools = llm.general_tools || [];
          existingStates = llm.states || [];
          existingStartingState = llm.starting_state;
          if (existingStates.length > 0) {
            console.log("[regeneratePrompt] Preserving", existingStates.length, "states, starting_state:", existingStartingState);
          }
        }
      } else if (engine?.llm) {
        // Inline LLM — preserve existing tools (e.g. from flow deployments)
        existingTools = engine.llm.general_tools || engine.llm.tools || [];
      }
    }

    // Build request_callback tool for callback pipeline
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
    if (!APP_URL) {
      console.warn("NEXT_PUBLIC_APP_URL not set — callback tool URL will be empty");
    }
    const callbackTool = {
      type: "custom" as const,
      name: "request_callback",
      description:
        "Use this when you cannot answer a caller's question and need to get the answer from the business owner. This emails the business owner and arranges a callback. You MUST collect the caller's phone number before using this tool.",
      url: `${APP_URL || ""}/api/tools/callback?client_id=${clientId}`,
      method: "POST",
      header: { Authorization: `Bearer ${process.env.RETELL_TOOLS_API_KEY}` },
      speak_during_execution: true,
      execution_message_description:
        "Let the caller know you are looking into their question",
      speak_after_execution: true,
      timeout_ms: 5000,
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The caller's question that you cannot answer",
          },
          caller_phone: {
            type: "string",
            description: "The caller's phone number — ask them before calling this tool",
          },
          caller_name: {
            type: "string",
            description: "The caller's name if provided",
          },
        },
        required: ["question", "caller_phone"],
      },
    };

    // Merge tools: remove old transfer_to_human and request_callback, add new ones
    const toolsWithoutOld = existingTools.filter(
      (t) => t.name !== "transfer_to_human" && t.name !== "request_callback"
    );
    const mergedToolsRaw = [
      ...toolsWithoutOld,
      ...(transferTool ? [transferTool] : []),
      callbackTool,
    ];

    // Filter out custom tools with non-public URLs (e.g. localhost) so Retell
    // doesn't reject the entire PATCH. These tools only work in production.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergedTools = filterToolsForRetell(mergedToolsRaw as any);

    if (usesLlmId && llmId) {
      // Push prompt + tools to the standalone LLM
      const llmUpdateRes = await fetch(
        `https://api.retellai.com/update-retell-llm/${llmId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            general_prompt: generatedPrompt,
            general_tools: mergedTools,
            ...(compiledFirstMessage && { begin_message: compiledFirstMessage }),
            ...(existingStates.length > 0 && {
              states: existingStates,
              starting_state: existingStartingState,
            }),
          }),
        }
      );

      if (!llmUpdateRes.ok) {
        const err = await llmUpdateRes.text();
        console.error("Retell LLM update error:", err);
        throw new Error(`Failed to update Retell LLM: ${llmUpdateRes.status}`);
      }

      // Still update agent-level settings (max duration)
      await fetch(`https://api.retellai.com/update-agent/${agent.retell_agent_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_call_duration_ms: (settings?.max_call_duration_minutes || 5) * 60 * 1000,
        }),
      });
    } else {
      // Push to Retell Voice Agent API (inline LLM)
      const res = await fetch(`https://api.retellai.com/update-agent/${agent.retell_agent_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response_engine: {
            llm: {
              general_prompt: generatedPrompt,
              general_tools: mergedTools,
              ...(compiledFirstMessage && { begin_message: compiledFirstMessage }),
            },
          },
          max_call_duration_ms: (settings?.max_call_duration_minutes || 5) * 60 * 1000,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Retell API error:", err);
        throw new Error(`Failed to update Retell agent: ${res.status}`);
      }
    }
  }
}
