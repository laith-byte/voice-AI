-- Pricing Update: Adjust minutes, overage rates, and enable all features for all plans.
-- Starter: 400 min, $0.35/min overage, all features
-- Professional: 800 min, $0.30/min overage, all features
-- Enterprise: $0.25/min overage, all features

-- Update Starter plan
UPDATE client_plans SET
  call_minutes_included = 400,
  overage_rate = 0.35,
  -- Enable all features
  analytics_full = true, ai_evaluation = true, ai_auto_tagging = true, ai_misunderstood = true,
  topic_management = true, daily_digest = true, analytics_export = true, custom_reporting = true,
  sms_notification = true, caller_followup_email = true, max_recipes = NULL,
  google_calendar = true, slack_integration = true, crm_integration = true,
  webhook_forwarding = true, api_access = true,
  voice_selection = 'full', llm_selection = 'full', raw_prompt_editor = true, functions_tools = true,
  pronunciation_dict = true, post_call_analysis_config = true, campaign_outbound = true,
  mcp_configuration = true, speech_settings_full = true,
  priority_support = true, dedicated_account_manager = true, onboarding_call = true,
  custom_agent_buildout = true, sla_guarantee = true, hipaa_compliance = true, custom_branding = true,
  features = '["1 AI Voice Agent", "400 minutes/mo", "1 Phone Number", "$0.35/min overage", "All Features Included"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'starter';

-- Update Professional plan
UPDATE client_plans SET
  call_minutes_included = 800,
  overage_rate = 0.30,
  -- Enable all features
  analytics_full = true, ai_evaluation = true, ai_auto_tagging = true, ai_misunderstood = true,
  topic_management = true, daily_digest = true, analytics_export = true, custom_reporting = true,
  sms_notification = true, caller_followup_email = true, max_recipes = NULL,
  google_calendar = true, slack_integration = true, crm_integration = true,
  webhook_forwarding = true, api_access = true,
  voice_selection = 'full', llm_selection = 'full', raw_prompt_editor = true, functions_tools = true,
  pronunciation_dict = true, post_call_analysis_config = true, campaign_outbound = true,
  mcp_configuration = true, speech_settings_full = true,
  priority_support = true, dedicated_account_manager = true, onboarding_call = true,
  custom_agent_buildout = true, sla_guarantee = true, hipaa_compliance = true, custom_branding = true,
  features = '["3 AI Voice Agents", "800 minutes/mo", "3 Phone Numbers", "$0.30/min overage", "All Features Included"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'professional';

-- Update Enterprise plan
UPDATE client_plans SET
  overage_rate = 0.25,
  -- Enable all features
  api_access = true,
  features = '["Custom AI Voice Agents", "Custom minutes/mo", "Custom Phone Numbers", "$0.25/min overage", "All Features Included"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'enterprise';
