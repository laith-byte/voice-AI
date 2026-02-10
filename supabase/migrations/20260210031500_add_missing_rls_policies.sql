-- Add missing RLS policies for tables that have RLS enabled but no policies

-- Users: allow reading own row
DO $$ BEGIN
    CREATE POLICY "users_read_own" ON users FOR SELECT USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users: allow updating own row
DO $$ BEGIN
    CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Startup users can read all users in their org (for members page)
DO $$ BEGIN
    CREATE POLICY "startup_read_org_users" ON users FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organizations: users can read their own org
DO $$ BEGIN
    CREATE POLICY "org_read_own" ON organizations FOR SELECT USING (
        id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organizations: startup users can update their org
DO $$ BEGIN
    CREATE POLICY "org_update_own" ON organizations FOR UPDATE USING (
        id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Stripe connections
ALTER TABLE stripe_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_stripe_connections" ON stripe_connections FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client access
DO $$ BEGIN
    CREATE POLICY "org_client_access" ON client_access FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phone numbers
DO $$ BEGIN
    CREATE POLICY "org_phone_numbers" ON phone_numbers FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Webhook logs
DO $$ BEGIN
    CREATE POLICY "org_webhook_logs" ON webhook_logs FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Widget config
ALTER TABLE widget_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_widget_config" ON widget_config FOR ALL USING (
        agent_id IN (SELECT id FROM agents WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI analysis config
ALTER TABLE ai_analysis_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_ai_analysis_config" ON ai_analysis_config FOR ALL USING (
        agent_id IN (SELECT id FROM agents WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_topics" ON topics FOR ALL USING (
        agent_id IN (SELECT id FROM agents WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Solutions
ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_solutions" ON solutions FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client plans
ALTER TABLE client_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_client_plans" ON client_plans FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pricing tables
ALTER TABLE pricing_tables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_pricing_tables" ON pricing_tables FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Agent templates
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_agent_templates" ON agent_templates FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organization settings
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_settings" ON organization_settings FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Whitelabel settings
ALTER TABLE whitelabel_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_whitelabel" ON whitelabel_settings FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Email templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_email_templates" ON email_templates FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "org_integrations" ON integrations FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
