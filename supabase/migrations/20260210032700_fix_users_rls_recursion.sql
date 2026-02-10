-- Fix infinite recursion in users RLS policy
-- The startup_read_org_users policy references the users table in its own USING clause

-- Drop the recursive policy
DROP POLICY IF EXISTS "startup_read_org_users" ON users;

-- Create a SECURITY DEFINER function to safely get the current user's org_id
-- This bypasses RLS so it won't cause recursion
CREATE OR REPLACE FUNCTION public.get_user_org_id() RETURNS UUID AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create a SECURITY DEFINER function to safely check if user is a startup role
CREATE OR REPLACE FUNCTION public.is_startup_user() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role LIKE 'startup_%')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate the policy for startup users to read all users in their org (no recursion)
CREATE POLICY "startup_read_org_users" ON users FOR SELECT USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- Also update all other policies that reference users table in subqueries
-- to use the helper functions instead, preventing potential recursion issues

-- stripe_connections
DROP POLICY IF EXISTS "org_stripe_connections" ON stripe_connections;
CREATE POLICY "org_stripe_connections" ON stripe_connections FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- client_access
DROP POLICY IF EXISTS "org_client_access" ON client_access;
CREATE POLICY "org_client_access" ON client_access FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id = public.get_user_org_id())
    AND public.is_startup_user()
);

-- phone_numbers
DROP POLICY IF EXISTS "org_phone_numbers" ON phone_numbers;
CREATE POLICY "org_phone_numbers" ON phone_numbers FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- webhook_logs
DROP POLICY IF EXISTS "org_webhook_logs" ON webhook_logs;
CREATE POLICY "org_webhook_logs" ON webhook_logs FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- widget_config
DROP POLICY IF EXISTS "org_widget_config" ON widget_config;
CREATE POLICY "org_widget_config" ON widget_config FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE organization_id = public.get_user_org_id())
);

-- ai_analysis_config
DROP POLICY IF EXISTS "org_ai_analysis_config" ON ai_analysis_config;
CREATE POLICY "org_ai_analysis_config" ON ai_analysis_config FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE organization_id = public.get_user_org_id())
);

-- topics
DROP POLICY IF EXISTS "org_topics" ON topics;
CREATE POLICY "org_topics" ON topics FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE organization_id = public.get_user_org_id())
);

-- solutions
DROP POLICY IF EXISTS "org_solutions" ON solutions;
CREATE POLICY "org_solutions" ON solutions FOR ALL USING (
    organization_id = public.get_user_org_id()
);

-- client_plans
DROP POLICY IF EXISTS "org_client_plans" ON client_plans;
CREATE POLICY "org_client_plans" ON client_plans FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- pricing_tables
DROP POLICY IF EXISTS "org_pricing_tables" ON pricing_tables;
CREATE POLICY "org_pricing_tables" ON pricing_tables FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- agent_templates
DROP POLICY IF EXISTS "org_agent_templates" ON agent_templates;
CREATE POLICY "org_agent_templates" ON agent_templates FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- organization_settings
DROP POLICY IF EXISTS "org_settings" ON organization_settings;
CREATE POLICY "org_settings" ON organization_settings FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- whitelabel_settings
DROP POLICY IF EXISTS "org_whitelabel" ON whitelabel_settings;
CREATE POLICY "org_whitelabel" ON whitelabel_settings FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- email_templates
DROP POLICY IF EXISTS "org_email_templates" ON email_templates;
CREATE POLICY "org_email_templates" ON email_templates FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- integrations
DROP POLICY IF EXISTS "org_integrations" ON integrations;
CREATE POLICY "org_integrations" ON integrations FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- Also fix the original schema policies that had the same subquery pattern
DROP POLICY IF EXISTS "org_users_all" ON clients;
CREATE POLICY "org_users_all" ON clients FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

DROP POLICY IF EXISTS "org_users_agents" ON agents;
CREATE POLICY "org_users_agents" ON agents FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

DROP POLICY IF EXISTS "org_users_calls" ON call_logs;
CREATE POLICY "org_users_calls" ON call_logs FOR ALL USING (
    organization_id = public.get_user_org_id() AND public.is_startup_user()
);

-- Update organizations policy too
DROP POLICY IF EXISTS "org_read_own" ON organizations;
CREATE POLICY "org_read_own" ON organizations FOR SELECT USING (
    id = public.get_user_org_id()
);

DROP POLICY IF EXISTS "org_update_own" ON organizations;
CREATE POLICY "org_update_own" ON organizations FOR UPDATE USING (
    id = public.get_user_org_id() AND public.is_startup_user()
);
