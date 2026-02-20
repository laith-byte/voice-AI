// TypeScript types matching CLAUDE.md database schema exactly

export type UserRole = "startup_admin" | "startup_member" | "client_admin" | "client_member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  organization_id: string;
  client_id: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: "active" | "inactive" | "suspended" | "cancelled" | "past_due";
  language: string;
  dashboard_theme: string;
  custom_css: string | null;
  dashboard_color: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  organization_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  platform: string;
  retell_agent_id: string;
  retell_api_key_encrypted: string;
  knowledge_base_id: string | null;
  knowledge_base_name: string | null;
  webhook_url: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  id: string;
  agent_id: string;
  agent_image_url: string | null;
  widget_layout: string;
  description: string;
  branding: string | null;
  background_image_url: string | null;
  launcher_image_url: string | null;
  google_font_name: string;
  color_preset: string;
  custom_css: string | null;
  autolaunch_popup: boolean;
  launch_message: string;
  launch_message_enabled: boolean;
  popup_message: string;
  popup_message_enabled: boolean;
  terms_of_service_url: string | null;
  privacy_policy_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiAnalysisConfig {
  id: string;
  agent_id: string;
  summary_enabled: boolean;
  summary_custom_prompt: string | null;
  evaluation_enabled: boolean;
  evaluation_custom_prompt: string | null;
  auto_tagging_enabled: boolean;
  auto_tagging_mode: string;
  auto_tagging_custom_prompt: string | null;
  misunderstood_queries_enabled: boolean;
  created_at: string;
}

export interface Topic {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CampaignConfig {
  id: string;
  agent_id: string;
  rate_mode: string;
  min_calls: number;
  max_calls: number;
  min_minutes: number;
  max_minutes: number;
  fixed_calls: number;
  fixed_minutes: number;
  created_at: string;
}

export interface ClientAccess {
  id: string;
  client_id: string;
  agent_id: string | null;
  feature: string;
  enabled: boolean;
  created_at: string;
}

export interface PhoneNumber {
  id: string;
  organization_id: string;
  client_id: string | null;
  agent_id: string | null;
  number: string;
  retell_number_id: string | null;
  type: string;
  caller_id_name: string | null;
  caller_id_verified: boolean;
  cnam_status: string;
  created_at: string;
}

export interface CallLog {
  id: string;
  organization_id: string;
  client_id: string | null;
  agent_id: string | null;
  retell_call_id: string;
  direction: "inbound" | "outbound" | null;
  status: string | null;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  recording_url: string | null;
  transcript: Record<string, unknown>[] | null;
  post_call_analysis: Record<string, unknown> | null;
  summary: string | null;
  evaluation: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Solution {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StripeConnection {
  id: string;
  organization_id: string;
  stripe_account_id: string | null;
  is_connected: boolean;
  connected_at: string | null;
  created_at: string;
}

export interface ClientPlan {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  tagline: string | null;
  description: string | null;
  badge: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  setup_fee: number;
  is_custom_pricing: boolean;
  agents_included: number;
  phone_numbers_included: number;
  call_minutes_included: number;
  concurrent_calls: number;
  knowledge_bases: number;
  overage_rate: number | null;
  features: Record<string, unknown> | null;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  stripe_setup_price_id: string | null;
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
  // Feature gates (eight features)
  branded_caller_id: boolean;
  verified_caller_id: boolean;
  sip_trunking: boolean;
  pii_redaction: boolean;
  calendly_integration: boolean;
  zapier_integration: boolean;
  conversation_flows: boolean;
  // Support gates
  priority_support: boolean;
  dedicated_account_manager: boolean;
  onboarding_call: boolean;
  custom_agent_buildout: boolean;
  sla_guarantee: boolean;
  hipaa_compliance: boolean;
  custom_branding: boolean;
  // Display
  sort_order: number;
  is_active: boolean;
  is_highlighted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanAddon {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  monthly_price: number | null;
  one_time_price: number | null;
  addon_type: "recurring" | "one_time";
  category: string;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClientAddon {
  id: string;
  client_id: string;
  addon_id: string;
  quantity: number;
  status: "active" | "cancelled";
  stripe_subscription_item_id: string | null;
  activated_at: string;
  cancelled_at: string | null;
  created_at: string;
}

export interface PricingTable {
  id: string;
  organization_id: string;
  name: string;
  plan_ids: string[];
  default_view: string;
  button_shape: string;
  background_color: string | null;
  button_color: string;
  highlight_enabled: boolean;
  highlight_plan_id: string | null;
  highlight_label: string;
  highlight_color: string;
  badge_color: string;
  is_active: boolean;
  created_at: string;
}

export interface AgentTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  text_provider: string;
  voice_provider: string;
  retell_agent_id: string | null;
  vertical: string | null;
  prompt_template: string | null;
  default_services: Record<string, unknown>[] | null;
  default_faqs: Record<string, unknown>[] | null;
  default_policies: Record<string, unknown>[] | null;
  icon: string | null;
  wizard_enabled: boolean;
  industry: string | null;
  use_case: string | null;
  industry_icon: string | null;
  use_case_icon: string | null;
  use_case_description: string | null;
  default_hours: Record<string, unknown>[] | null;
  test_scenarios: Record<string, unknown>[] | null;
  created_at: string;
}

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  dashboard_logo_url: string | null;
  login_page_logo_url: string | null;
  openai_api_key_encrypted: string | null;
  gdpr_enabled: boolean;
  hipaa_enabled: boolean;
  payment_success_redirect_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhitelabelSettings {
  id: string;
  organization_id: string;
  favicon_url: string | null;
  website_title: string;
  color_theme: string;
  loading_icon: string;
  loading_icon_size: string;
  domain: string | null;
  domain_valid: boolean;
  backend_domain: string | null;
  sending_domain: string | null;
  sending_domain_valid: boolean;
  sender_address: string;
  sender_name: string;
  email_logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  organization_id: string;
  template_type: "two_factor" | "password_setup" | "password_reset" | "startup_invite";
  subject: string;
  greeting: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  organization_id: string;
  provider: "retell" | "elevenlabs" | "vapi" | "openai";
  name: string;
  api_key_encrypted: string;
  is_connected: boolean;
  connected_at: string;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  organization_id: string | null;
  agent_id: string | null;
  event: string;
  import_result: string | null;
  forwarding_result: string | null;
  platform_call_id: string | null;
  raw_payload: Record<string, unknown> | null;
  timestamp: string;
  created_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  agent_id: string;
  phone: string;
  name: string | null;
  tags: string[];
  dynamic_vars: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  agent_id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  start_date: string | null;
  calling_days: string[];
  calling_hours_start: string;
  calling_hours_end: string;
  timezone_mode: string;
  timezone: string | null;
  retry_attempts: number;
  retry_interval_hours: number;
  calling_rate: number;
  calling_rate_minutes: number;
  phone_number_ids: string[] | null;
  cycle_numbers: boolean;
  leads_source: string;
  leads_tag_filter: string | null;
  total_leads: number;
  completed_leads: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignLead {
  campaign_id: string;
  lead_id: string;
  status: "pending" | "calling" | "completed" | "failed";
  attempts: number;
  last_called_at: string | null;
}

// --- Business Settings & Related Tables ---

export interface BusinessSettings {
  id: string;
  client_id: string;
  business_name: string | null;
  business_phone: string | null;
  business_website: string | null;
  business_address: string | null;
  timezone: string;
  contact_name: string | null;
  contact_email: string | null;
  after_hours_behavior: string;
  unanswerable_behavior: string;
  escalation_phone: string | null;
  max_call_duration_minutes: number;
  post_call_email: boolean;
  post_call_log: boolean;
  post_call_text: boolean;
  chat_welcome_message: string | null;
  chat_offline_behavior: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  id: string;
  client_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export interface BusinessService {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  price_text: string | null;
  duration_text: string | null;
  ai_notes: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessFaq {
  id: string;
  client_id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessPolicy {
  id: string;
  client_id: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessLocation {
  id: string;
  client_id: string;
  name: string;
  address: string;
  phone: string | null;
  is_primary: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// --- Onboarding ---

export interface ClientOnboarding {
  id: string;
  client_id: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  current_step: number;
  vertical_template_id: string | null;
  business_name: string | null;
  business_phone: string | null;
  business_website: string | null;
  business_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  after_hours_behavior: string;
  unanswerable_behavior: string;
  escalation_phone: string | null;
  max_call_duration_minutes: number;
  post_call_email_summary: boolean;
  post_call_log: boolean;
  post_call_followup_text: boolean;
  test_calls_used: number;
  test_call_completed: boolean;
  phone_number_option: string | null;
  go_live_at: string | null;
  completed_at: string | null;
  first_call_notified_at: string | null;
  checkin_email_sent_at: string | null;
  total_calls_since_live: number;
  agent_type: "voice" | "chat" | "sms";
  chat_welcome_message: string | null;
  chat_offline_behavior: string;
  language: string;
  sms_phone_number: string | null;
  chat_widget_deployed: boolean;
  sms_phone_configured: boolean;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

// --- Post-Call Actions ---

export interface PostCallActions {
  id: string;
  client_id: string;
  action_type: "email_summary" | "sms_notification" | "caller_followup_email" | "daily_digest" | "webhook";
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Automations ---

export interface AutomationRecipe {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  long_description: string | null;
  icon: string | null;
  category: string;
  n8n_webhook_url: string | null;
  n8n_workflow_id: string | null;
  config_schema: Record<string, unknown>[];
  what_gets_sent: Record<string, unknown> | null;
  is_active: boolean;
  is_coming_soon: boolean;
  sort_order: number;
  execution_type: string;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientAutomation {
  id: string;
  client_id: string;
  recipe_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  last_triggered_at: string | null;
  trigger_count: number;
  error_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  client_automation_id: string;
  call_log_id: string | null;
  status: "success" | "failed" | "skipped";
  error_message: string | null;
  response_code: number | null;
  executed_at: string;
}

// --- OAuth & Integrations ---

export interface OAuthConnection {
  id: string;
  client_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  provider_email: string | null;
  provider_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseSource {
  id: string;
  agent_id: string;
  source_type: "document" | "text" | "url" | "file";
  name: string;
  content: string | null;
  url: string | null;
  retell_kb_id: string | null;
  file_size_bytes: number | null;
  status: string;
  created_at: string;
}

// --- Eight Features Tables ---

export interface SipTrunk {
  id: string;
  organization_id: string;
  client_id: string | null;
  label: string;
  sip_uri: string;
  username: string | null;
  password_encrypted: string | null;
  codec: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PiiRedactionConfig {
  id: string;
  client_id: string;
  enabled: boolean;
  redact_phone_numbers: boolean;
  redact_emails: boolean;
  redact_ssn: boolean;
  redact_credit_cards: boolean;
  redact_names: boolean;
  custom_patterns: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export interface ZapierSubscription {
  id: string;
  client_id: string;
  hook_url: string;
  event: string;
  api_key_hash: string;
  is_active: boolean;
  created_at: string;
}

export interface ConversationFlow {
  id: string;
  client_id: string;
  agent_id: string | null;
  name: string;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}
