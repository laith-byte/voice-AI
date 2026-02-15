import { createServiceClient } from "@/lib/supabase/server";

export interface PlanAccess {
  plan_id: string | null;
  plan_name: string | null;
  plan_slug: string | null;

  // Usage limits
  agents_included: number;
  phone_numbers_included: number;
  call_minutes_included: number;
  concurrent_calls: number;
  knowledge_bases: number;
  overage_rate: number | null;

  // Computed from add-ons
  total_agents_allowed: number;
  total_phone_numbers_allowed: number;

  // Analytics gates
  analytics_full: boolean;
  ai_evaluation: boolean;
  ai_auto_tagging: boolean;
  ai_misunderstood: boolean;
  topic_management: boolean;
  daily_digest: boolean;
  analytics_export: boolean;
  custom_reporting: boolean;

  // Automation gates
  sms_notification: boolean;
  caller_followup_email: boolean;
  max_recipes: number | null;
  google_calendar: boolean;
  slack_integration: boolean;
  crm_integration: boolean;
  webhook_forwarding: boolean;
  api_access: boolean;

  // Agent config gates
  voice_selection: string;
  llm_selection: string;
  raw_prompt_editor: boolean;
  functions_tools: boolean;
  pronunciation_dict: boolean;
  post_call_analysis_config: boolean;
  campaign_outbound: boolean;
  mcp_configuration: boolean;
  speech_settings_full: boolean;

  // Support gates
  priority_support: boolean;
  dedicated_account_manager: boolean;
  onboarding_call: boolean;
  custom_agent_buildout: boolean;
  sla_guarantee: boolean;
  hipaa_compliance: boolean;
  custom_branding: boolean;

  // Active add-ons
  addons: {
    id: string;
    addon_id: string;
    name: string;
    quantity: number;
    category: string;
  }[];
}

const DEFAULTS: PlanAccess = {
  plan_id: null,
  plan_name: null,
  plan_slug: null,
  agents_included: 1,
  phone_numbers_included: 1,
  call_minutes_included: 0,
  concurrent_calls: 5,
  knowledge_bases: 1,
  overage_rate: null,
  total_agents_allowed: 1,
  total_phone_numbers_allowed: 1,
  analytics_full: false,
  ai_evaluation: false,
  ai_auto_tagging: false,
  ai_misunderstood: false,
  topic_management: false,
  daily_digest: false,
  analytics_export: false,
  custom_reporting: false,
  sms_notification: false,
  caller_followup_email: false,
  max_recipes: 3,
  google_calendar: false,
  slack_integration: false,
  crm_integration: false,
  webhook_forwarding: false,
  api_access: false,
  voice_selection: "default",
  llm_selection: "default",
  raw_prompt_editor: false,
  functions_tools: false,
  pronunciation_dict: false,
  post_call_analysis_config: false,
  campaign_outbound: false,
  mcp_configuration: false,
  speech_settings_full: false,
  priority_support: false,
  dedicated_account_manager: false,
  onboarding_call: false,
  custom_agent_buildout: false,
  sla_guarantee: false,
  hipaa_compliance: false,
  custom_branding: false,
  addons: [],
};

export async function getClientPlanAccess(clientId: string): Promise<PlanAccess> {
  const supabase = await createServiceClient();

  // 1. Get client's plan_id
  const { data: client } = await supabase
    .from("clients")
    .select("plan_id")
    .eq("id", clientId)
    .single();

  if (!client?.plan_id) {
    return { ...DEFAULTS };
  }

  // 2. Get plan details
  const { data: plan } = await supabase
    .from("client_plans")
    .select("*")
    .eq("id", client.plan_id)
    .single();

  if (!plan) {
    return { ...DEFAULTS, plan_id: client.plan_id };
  }

  // 3. Get active add-ons
  const { data: clientAddons } = await supabase
    .from("client_addons")
    .select("id, addon_id, quantity, plan_addons(name, category)")
    .eq("client_id", clientId)
    .eq("status", "active");

  const addons = (clientAddons || []).map((ca: Record<string, unknown>) => {
    const addonInfo = ca.plan_addons as Record<string, unknown> | null;
    return {
      id: ca.id as string,
      addon_id: ca.addon_id as string,
      name: (addonInfo?.name as string) || "",
      quantity: (ca.quantity as number) || 1,
      category: (addonInfo?.category as string) || "general",
    };
  });

  // 4. Compute totals from add-ons
  const extraAgents = addons
    .filter((a) => a.name === "Extra AI Agent")
    .reduce((sum, a) => sum + a.quantity, 0);
  const extraPhones = addons
    .filter((a) => a.name === "Extra Phone Number")
    .reduce((sum, a) => sum + a.quantity, 0);

  return {
    plan_id: plan.id,
    plan_name: plan.name,
    plan_slug: plan.slug || null,

    agents_included: plan.agents_included || 1,
    phone_numbers_included: plan.phone_numbers_included || 1,
    call_minutes_included: plan.call_minutes_included || 0,
    concurrent_calls: plan.concurrent_calls || 5,
    knowledge_bases: plan.knowledge_bases || 1,
    overage_rate: plan.overage_rate ?? null,

    total_agents_allowed: (plan.agents_included || 1) + extraAgents,
    total_phone_numbers_allowed: (plan.phone_numbers_included || 1) + extraPhones,

    analytics_full: plan.analytics_full ?? false,
    ai_evaluation: plan.ai_evaluation ?? false,
    ai_auto_tagging: plan.ai_auto_tagging ?? false,
    ai_misunderstood: plan.ai_misunderstood ?? false,
    topic_management: plan.topic_management ?? false,
    daily_digest: plan.daily_digest ?? false,
    analytics_export: plan.analytics_export ?? false,
    custom_reporting: plan.custom_reporting ?? false,

    sms_notification: plan.sms_notification ?? false,
    caller_followup_email: plan.caller_followup_email ?? false,
    max_recipes: plan.max_recipes ?? 3,
    google_calendar: plan.google_calendar ?? false,
    slack_integration: plan.slack_integration ?? false,
    crm_integration: plan.crm_integration ?? false,
    webhook_forwarding: plan.webhook_forwarding ?? false,
    api_access: plan.api_access ?? false,

    voice_selection: plan.voice_selection || "default",
    llm_selection: plan.llm_selection || "default",
    raw_prompt_editor: plan.raw_prompt_editor ?? false,
    functions_tools: plan.functions_tools ?? false,
    pronunciation_dict: plan.pronunciation_dict ?? false,
    post_call_analysis_config: plan.post_call_analysis_config ?? false,
    campaign_outbound: plan.campaign_outbound ?? false,
    mcp_configuration: plan.mcp_configuration ?? false,
    speech_settings_full: plan.speech_settings_full ?? false,

    priority_support: plan.priority_support ?? false,
    dedicated_account_manager: plan.dedicated_account_manager ?? false,
    onboarding_call: plan.onboarding_call ?? false,
    custom_agent_buildout: plan.custom_agent_buildout ?? false,
    sla_guarantee: plan.sla_guarantee ?? false,
    hipaa_compliance: plan.hipaa_compliance ?? false,
    custom_branding: plan.custom_branding ?? false,

    addons,
  };
}
