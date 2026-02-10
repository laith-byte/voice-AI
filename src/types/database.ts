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
  created_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: "active" | "inactive" | "suspended";
  language: string;
  dashboard_theme: string;
  custom_css: string | null;
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
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  setup_fee: number;
  agents_included: number;
  call_minutes_included: number;
  overage_rate: number | null;
  features: Record<string, unknown> | null;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  stripe_setup_price_id: string | null;
  sort_order: number;
  is_active: boolean;
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
  organization_id: string;
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
