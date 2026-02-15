-- ============================================================
-- Phase 1: Pricing Plans Overhaul Migration
-- Adds ~28 new columns to client_plans, creates plan_addons
-- and client_addons tables, seeds default plans and add-ons.
-- ============================================================

-- 1A: ALTER TABLE client_plans — add new columns
ALTER TABLE client_plans
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS is_custom_pricing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_numbers_included INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS concurrent_calls INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS knowledge_bases INTEGER DEFAULT 1,
  -- Analytics gates
  ADD COLUMN IF NOT EXISTS analytics_full BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_evaluation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_tagging BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_misunderstood BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS topic_management BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_digest BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_export BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_reporting BOOLEAN DEFAULT false,
  -- Automation gates
  ADD COLUMN IF NOT EXISTS sms_notification BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS caller_followup_email BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_recipes INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS google_calendar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_integration BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_integration BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_forwarding BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS api_access BOOLEAN DEFAULT false,
  -- Agent config gates
  ADD COLUMN IF NOT EXISTS voice_selection TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS llm_selection TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS raw_prompt_editor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS functions_tools BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pronunciation_dict BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_call_analysis_config BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_outbound BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mcp_configuration BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS speech_settings_full BOOLEAN DEFAULT false,
  -- Support gates
  ADD COLUMN IF NOT EXISTS priority_support BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dedicated_account_manager BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_call BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_agent_buildout BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_guarantee BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hipaa_compliance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_branding BOOLEAN DEFAULT false,
  -- Display
  ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- 1B: CREATE TABLE plan_addons
CREATE TABLE IF NOT EXISTS plan_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10,2),
  one_time_price NUMERIC(10,2),
  addon_type TEXT NOT NULL DEFAULT 'recurring', -- 'recurring' | 'one_time'
  category TEXT DEFAULT 'general',
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_addons ENABLE ROW LEVEL SECURITY;

-- Startup users can manage add-ons
CREATE POLICY "org_plan_addons" ON plan_addons FOR ALL USING (
  organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- Public read for pricing page (same pattern as client_plans)
CREATE POLICY "public_read_plan_addons" ON plan_addons FOR SELECT USING (
  is_active = true
);


-- CREATE TABLE client_addons
CREATE TABLE IF NOT EXISTS client_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES plan_addons(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- 'active' | 'cancelled'
  stripe_subscription_item_id TEXT,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_addons ENABLE ROW LEVEL SECURITY;

-- Startup users can manage client add-ons
CREATE POLICY "org_client_addons" ON client_addons FOR ALL USING (
  client_id IN (SELECT id FROM clients WHERE organization_id = public.get_user_org_id())
  AND public.is_startup_user()
);

-- Client users can read their own add-ons
CREATE POLICY "client_read_own_addons" ON client_addons FOR SELECT USING (
  client_id IN (SELECT client_id FROM users WHERE id = auth.uid())
);


-- 1C: Update existing plans with new column values (preserves rows referenced by clients)

-- Update Starter plan ($499/mo)
UPDATE client_plans SET
  slug = 'starter',
  tagline = 'Perfect for small businesses',
  description = 'Everything you need to get started with AI voice agents.',
  badge = NULL,
  monthly_price = 499,
  yearly_price = 4790,
  setup_fee = 0,
  agents_included = 1,
  phone_numbers_included = 1,
  call_minutes_included = 400,
  concurrent_calls = 5,
  knowledge_bases = 1,
  overage_rate = 0.35,
  is_custom_pricing = false,
  -- Analytics
  analytics_full = true, ai_evaluation = true, ai_auto_tagging = true, ai_misunderstood = true,
  topic_management = true, daily_digest = true, analytics_export = true, custom_reporting = true,
  -- Automations
  sms_notification = true, caller_followup_email = true, max_recipes = NULL,
  google_calendar = true, slack_integration = true, crm_integration = true,
  webhook_forwarding = true, api_access = true,
  -- Agent config
  voice_selection = 'full', llm_selection = 'full', raw_prompt_editor = true, functions_tools = true,
  pronunciation_dict = true, post_call_analysis_config = true, campaign_outbound = true,
  mcp_configuration = true, speech_settings_full = true,
  -- Support
  priority_support = true, dedicated_account_manager = true, onboarding_call = true,
  custom_agent_buildout = true, sla_guarantee = true, hipaa_compliance = true, custom_branding = true,
  -- Display
  sort_order = 0, is_active = true, is_highlighted = false,
  features = '["1 AI Voice Agent", "400 minutes/mo", "1 Phone Number", "$0.35/min overage", "All Features Included"]'::jsonb,
  updated_at = NOW()
WHERE name = 'Starter'
  AND organization_id = (SELECT id FROM organizations LIMIT 1);

-- Update Professional plan ($899/mo)
UPDATE client_plans SET
  slug = 'professional',
  tagline = 'For growing businesses',
  description = 'Advanced features and integrations for scaling your AI operations.',
  badge = 'Most Popular',
  monthly_price = 899,
  yearly_price = 8630,
  setup_fee = 0,
  agents_included = 3,
  phone_numbers_included = 3,
  call_minutes_included = 800,
  concurrent_calls = 10,
  knowledge_bases = 3,
  overage_rate = 0.30,
  is_custom_pricing = false,
  -- Analytics
  analytics_full = true, ai_evaluation = true, ai_auto_tagging = true, ai_misunderstood = true,
  topic_management = true, daily_digest = true, analytics_export = true, custom_reporting = true,
  -- Automations
  sms_notification = true, caller_followup_email = true, max_recipes = NULL,
  google_calendar = true, slack_integration = true, crm_integration = true,
  webhook_forwarding = true, api_access = true,
  -- Agent config
  voice_selection = 'full', llm_selection = 'full', raw_prompt_editor = true, functions_tools = true,
  pronunciation_dict = true, post_call_analysis_config = true, campaign_outbound = true,
  mcp_configuration = true, speech_settings_full = true,
  -- Support
  priority_support = true, dedicated_account_manager = true, onboarding_call = true,
  custom_agent_buildout = true, sla_guarantee = true, hipaa_compliance = true, custom_branding = true,
  -- Display
  sort_order = 1, is_active = true, is_highlighted = true,
  features = '["3 AI Voice Agents", "800 minutes/mo", "3 Phone Numbers", "$0.30/min overage", "All Features Included"]'::jsonb,
  updated_at = NOW()
WHERE name = 'Professional'
  AND organization_id = (SELECT id FROM organizations LIMIT 1);

-- Update Enterprise plan (custom pricing)
UPDATE client_plans SET
  slug = 'enterprise',
  tagline = 'For large organizations',
  description = 'Custom solutions with dedicated support and unlimited capabilities.',
  badge = NULL,
  monthly_price = NULL,
  yearly_price = NULL,
  setup_fee = 0,
  agents_included = 10,
  phone_numbers_included = 10,
  call_minutes_included = 5000,
  concurrent_calls = 50,
  knowledge_bases = 10,
  overage_rate = 0.25,
  is_custom_pricing = true,
  -- Analytics
  analytics_full = true, ai_evaluation = true, ai_auto_tagging = true, ai_misunderstood = true,
  topic_management = true, daily_digest = true, analytics_export = true, custom_reporting = true,
  -- Automations
  sms_notification = true, caller_followup_email = true, max_recipes = NULL,
  google_calendar = true, slack_integration = true, crm_integration = true,
  webhook_forwarding = true, api_access = true,
  -- Agent config
  voice_selection = 'full', llm_selection = 'full', raw_prompt_editor = true, functions_tools = true,
  pronunciation_dict = true, post_call_analysis_config = true, campaign_outbound = true,
  mcp_configuration = true, speech_settings_full = true,
  -- Support
  priority_support = true, dedicated_account_manager = true, onboarding_call = true,
  custom_agent_buildout = true, sla_guarantee = true, hipaa_compliance = true, custom_branding = true,
  -- Display
  sort_order = 2, is_active = true, is_highlighted = false,
  features = '["Custom AI Voice Agents", "Custom minutes/mo", "Custom Phone Numbers", "$0.25/min overage", "All Features Included"]'::jsonb,
  updated_at = NOW()
WHERE name = 'Enterprise'
  AND organization_id = (SELECT id FROM organizations LIMIT 1);

-- Seed 5 add-ons (upsert by name to avoid duplicates)
INSERT INTO plan_addons (organization_id, name, description, monthly_price, one_time_price, addon_type, category, sort_order) VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Extra AI Agent', 'Add an additional AI voice agent to your plan.', 75, NULL, 'recurring', 'usage', 0),
  ((SELECT id FROM organizations LIMIT 1), 'Extra Phone Number', 'Add an additional phone number.', 10, NULL, 'recurring', 'usage', 1),
  ((SELECT id FROM organizations LIMIT 1), 'Done-For-You Agent Build', 'We build and configure your AI agent for you.', NULL, 500, 'one_time', 'service', 2),
  ((SELECT id FROM organizations LIMIT 1), 'Custom Automation Setup', 'Custom automation workflow built to your specifications.', NULL, 1000, 'one_time', 'service', 3),
  ((SELECT id FROM organizations LIMIT 1), 'Strategy Call', 'Monthly strategy call with our AI voice experts.', 200, NULL, 'recurring', 'support', 4)
ON CONFLICT DO NOTHING;
