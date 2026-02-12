import Handlebars from "handlebars";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

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
  callback: "offer to schedule a callback",
  message: "take a message and email it to the business owner",
  hours: "tell them the business hours and suggest they call back",
  transfer: "transfer the call to the escalation phone number",
  website: "apologize and suggest they visit the website",
};

// Default prompt template used when no template is associated with the agent
const DEFAULT_PROMPT_TEMPLATE = `You are a friendly, professional AI receptionist for {{business_name}}.
{{#if business_address}}
You are located at {{business_address}}.
{{/if}}
{{#if business_phone}}
The business phone number is {{business_phone}}.
{{/if}}
{{#if business_website}}
The business website is {{business_website}}.
{{/if}}

BUSINESS HOURS:
{{#each business_hours}}
{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}
{{/each}}

{{#if services.length}}
SERVICES WE OFFER:
{{#each services}}
- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price}} ({{price}}){{/if}}
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
- If the caller asks about something not covered above, {{unanswerable_behavior}}
- If calling outside business hours, {{after_hours_behavior}}
- Keep calls concise and under {{max_call_duration}} minutes
- Always be warm, helpful, and professional
- Never make up information — if unsure, {{unanswerable_behavior}}
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
  promptTemplate?: string | null
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

  const templateSource = promptTemplate || DEFAULT_PROMPT_TEMPLATE;
  const template = Handlebars.compile(templateSource, { noEscape: true });

  const data = {
    business_name: settings.business_name || "our business",
    business_phone: settings.business_phone || "",
    business_address: settings.business_address || "",
    business_website: settings.business_website || "",
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
    unanswerable_behavior:
      BEHAVIOR_LABELS[settings.unanswerable_behavior] || settings.unanswerable_behavior,
    max_call_duration: settings.max_call_duration_minutes || 5,
  };

  return template(data).trim();
}

/**
 * Regenerates the system prompt for a client's agent and pushes it to Retell.
 * Called after any Business Settings save.
 */
export async function regeneratePrompt(clientId: string): Promise<void> {
  const supabase = await createServerClient();

  // Get the agent linked to this client, plus template if available
  const { data: agent } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (!agent?.retell_agent_id) {
    // No agent for this client yet — skip silently (happens during onboarding before agent creation)
    return;
  }

  // Check if there's a template with a prompt_template
  const { data: templateLink } = await supabase
    .from("client_onboarding")
    .select("vertical_template_id")
    .eq("client_id", clientId)
    .single();

  let promptTemplate: string | null = null;
  if (templateLink?.vertical_template_id) {
    const { data: tmpl } = await supabase
      .from("agent_templates")
      .select("prompt_template")
      .eq("id", templateLink.vertical_template_id)
      .single();
    promptTemplate = tmpl?.prompt_template || null;
  }

  const generatedPrompt = await generatePrompt(clientId, promptTemplate);

  // Get business settings for max_call_duration
  const { data: settings } = await supabase
    .from("business_settings")
    .select("max_call_duration_minutes")
    .eq("client_id", clientId)
    .single();

  // Decrypt the API key
  const apiKey = agent.retell_api_key_encrypted
    ? decrypt(agent.retell_api_key_encrypted)
    : process.env.RETELL_API_KEY;

  if (!apiKey) {
    throw new Error("No Retell API key available");
  }

  // Push to Retell
  const res = await fetch(`https://api.retellai.com/v2/agents/${agent.retell_agent_id}`, {
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
      max_call_duration_ms: (settings?.max_call_duration_minutes || 5) * 60 * 1000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Retell API error:", err);
    throw new Error(`Failed to update Retell agent: ${res.status}`);
  }
}
