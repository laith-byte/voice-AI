-- ============================================================
-- AUTOMATION TABLES (Phase 10B)
-- ============================================================
-- Three tables for the recipe-based automation system:
-- 1. automation_recipes — templates defined by startup admin
-- 2. client_automations — per-client enabled recipes with config
-- 3. automation_logs — execution history for debugging

-- 1. Recipe templates (startup admin configures these)
CREATE TABLE automation_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    long_description TEXT,
    icon TEXT,
    category TEXT DEFAULT 'general',
    n8n_webhook_url TEXT NOT NULL,
    n8n_workflow_id TEXT,
    config_schema JSONB NOT NULL DEFAULT '[]',
    what_gets_sent JSONB,
    is_active BOOLEAN DEFAULT true,
    is_coming_soon BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Client-enabled recipes
CREATE TABLE client_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    recipe_id UUID REFERENCES automation_recipes(id) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, recipe_id)
);

-- 3. Execution logs
CREATE TABLE automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_automation_id UUID REFERENCES client_automations(id) NOT NULL,
    call_log_id UUID REFERENCES call_logs(id),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    error_message TEXT,
    response_code INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_logs_client ON automation_logs(client_automation_id);
CREATE INDEX idx_automation_logs_executed ON automation_logs(executed_at DESC);
CREATE INDEX idx_client_automations_client ON client_automations(client_id) WHERE is_enabled = true;

-- RLS
ALTER TABLE automation_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Startup admins manage recipes for their org
CREATE POLICY "org_recipes" ON automation_recipes FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    )
);

-- Clients can READ recipes (browse gallery) but not modify
CREATE POLICY "client_read_recipes" ON automation_recipes FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM clients WHERE id IN (
            SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
        )
    )
);

-- Startup admins manage client automations across their org
CREATE POLICY "org_client_automations" ON client_automations FOR ALL USING (
    client_id IN (
        SELECT id FROM clients WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
        )
    )
);

-- Clients manage their own automations
CREATE POLICY "client_own_automations" ON client_automations FOR ALL USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- Automation logs follow the same pattern as client_automations
CREATE POLICY "org_automation_logs" ON automation_logs FOR ALL USING (
    client_automation_id IN (
        SELECT id FROM client_automations WHERE client_id IN (
            SELECT id FROM clients WHERE organization_id IN (
                SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
            )
        )
    )
);

CREATE POLICY "client_own_automation_logs" ON automation_logs FOR ALL USING (
    client_automation_id IN (
        SELECT id FROM client_automations WHERE client_id IN (
            SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
        )
    )
);
