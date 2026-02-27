import { createClient as createServerClient, createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { RETELL_API_BASE } from "@/lib/retell";

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
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

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
 * Compiles all business data into a well-formatted text document
 * suitable for a Retell Knowledge Base.
 */
async function compileBusinessKnowledgeText(
  clientId: string
): Promise<{ text: string; businessName: string; businessPhone?: string; businessAddress?: string }> {
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

  const businessName = settings.business_name || "Business";
  const sections: string[] = [];

  // Business Info
  sections.push(`# ${businessName} — Business Information`);
  if (settings.business_phone) sections.push(`Phone: ${settings.business_phone}`);
  if (settings.business_address) sections.push(`Address: ${settings.business_address}`);
  if (settings.business_website) sections.push(`Website: ${settings.business_website}`);
  if (settings.timezone) sections.push(`Timezone: ${settings.timezone}`);

  // Hours
  const hours = (hoursRes.data || []) as HoursRow[];
  if (hours.length > 0) {
    sections.push("");
    sections.push("## Business Hours");
    for (const h of hours) {
      const day = DAY_NAMES[h.day_of_week] || `Day ${h.day_of_week}`;
      if (h.is_open) {
        sections.push(`${day}: ${formatTime(h.open_time)} - ${formatTime(h.close_time)}`);
      } else {
        sections.push(`${day}: Closed`);
      }
    }
  }

  // Services
  const services = (servicesRes.data || []) as ServiceRow[];
  if (services.length > 0) {
    sections.push("");
    sections.push("## Services");
    for (const s of services) {
      let line = `- ${s.name}`;
      if (s.description) line += `: ${s.description}`;
      if (s.price_text) line += ` (${s.price_text})`;
      if (s.ai_notes) line += `\n  Note: ${s.ai_notes}`;
      sections.push(line);
    }
  }

  // FAQs
  const faqs = (faqsRes.data || []) as FaqRow[];
  if (faqs.length > 0) {
    sections.push("");
    sections.push("## Frequently Asked Questions");
    for (const f of faqs) {
      sections.push(`Q: ${f.question}`);
      sections.push(`A: ${f.answer}`);
      sections.push("");
    }
  }

  // Policies
  const policies = (policiesRes.data || []) as PolicyRow[];
  if (policies.length > 0) {
    sections.push("");
    sections.push("## Policies");
    for (const p of policies) {
      sections.push(`${p.name}: ${p.description}`);
    }
  }

  // Locations
  const locations = (locationsRes.data || []) as LocationRow[];
  if (locations.length > 0) {
    sections.push("");
    sections.push("## Locations");
    for (const l of locations) {
      let line = `- ${l.name}: ${l.address}`;
      if (l.phone) line += ` (${l.phone})`;
      sections.push(line);
    }
  }

  return {
    text: sections.join("\n"),
    businessName,
    businessPhone: settings.business_phone,
    businessAddress: settings.business_address,
  };
}

/**
 * Regenerates the Knowledge Base for a client's agent and links it in Retell.
 * Called after any Knowledge Base save (replaces regeneratePrompt).
 */
export async function regenerateKnowledgeBase(clientId: string): Promise<void> {
  const supabase = await createServerClient();
  const adminDb = await createServiceClient();

  // Get agents linked to this client
  const { data: agents } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted, platform, organization_id")
    .eq("client_id", clientId);

  if (!agents?.length) {
    // No agents for this client yet — skip silently
    return;
  }

  // Compile business data into text
  const { text, businessName, businessPhone, businessAddress } = await compileBusinessKnowledgeText(clientId);
  const kbName = `${businessName} — Business Profile`;

  for (const agent of agents) {
    if (!agent.retell_agent_id) continue;

    const apiKey = agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted)
      : process.env.RETELL_API_KEY;

    if (!apiKey) {
      console.error(`No Retell API key available for agent ${agent.id}`);
      continue;
    }

    // Find existing business_profile KB source for this agent
    const { data: existingSource } = await supabase
      .from("knowledge_base_sources")
      .select("id, retell_kb_id")
      .eq("agent_id", agent.id)
      .eq("source_type", "business_profile")
      .limit(1)
      .single();

    // Delete old KB from Retell if it exists
    if (existingSource?.retell_kb_id) {
      try {
        await fetch(
          `${RETELL_API_BASE}/delete-knowledge-base/${existingSource.retell_kb_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
      } catch (err) {
        console.error("Failed to delete old KB from Retell:", err);
      }

      // Delete from our database
      await adminDb
        .from("knowledge_base_sources")
        .delete()
        .eq("id", existingSource.id);
    }

    // Create new KB in Retell
    const createRes = await fetch(`${RETELL_API_BASE}/create-knowledge-base`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        knowledge_base_name: kbName,
        knowledge_base_texts: [{ title: kbName, text }],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => `HTTP ${createRes.status}`);
      console.error("Retell KB creation failed:", err);
      continue;
    }

    const kbData = await createRes.json();
    const newKbId = kbData.knowledge_base_id;

    if (!newKbId) {
      console.error("Retell KB creation returned no ID");
      continue;
    }

    // Save to our database
    await adminDb.from("knowledge_base_sources").insert({
      agent_id: agent.id,
      source_type: "business_profile",
      name: kbName,
      content: text,
      retell_kb_id: newKbId,
      status: "active",
    });

    // Link KB to the agent in Retell
    const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";

    // Fetch current agent config to get existing KB IDs
    const agentEndpoint = isChat
      ? `${RETELL_API_BASE}/get-chat-agent/${agent.retell_agent_id}`
      : `${RETELL_API_BASE}/get-agent/${agent.retell_agent_id}`;

    const agentConfigRes = await fetch(agentEndpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    let existingKbIds: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agentConfig: Record<string, any> | null = null;
    if (agentConfigRes.ok) {
      agentConfig = await agentConfigRes.json();
      existingKbIds = agentConfig!.knowledge_base_ids || [];
    }

    // Remove old business_profile KB IDs, add new one
    const oldKbId = existingSource?.retell_kb_id;
    const filteredKbIds = existingKbIds.filter((id: string) => id !== oldKbId);
    const updatedKbIds = [...filteredKbIds, newKbId];

    // Update agent with new KB IDs
    const updateEndpoint = isChat
      ? `${RETELL_API_BASE}/update-chat-agent/${agent.retell_agent_id}`
      : `${RETELL_API_BASE}/update-agent/${agent.retell_agent_id}`;

    const updateRes = await fetch(updateEndpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ knowledge_base_ids: updatedKbIds }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.text().catch(() => `HTTP ${updateRes.status}`);
      console.error("Failed to link KB to agent:", err);
    }

    // NOTE: System prompt is managed by regeneratePrompt() in prompt-generator.ts.
    // Do NOT set general_prompt here — it would overwrite the detailed business prompt.
  }
}
