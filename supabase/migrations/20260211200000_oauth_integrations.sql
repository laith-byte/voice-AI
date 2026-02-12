-- ============================================================
-- OAUTH INTEGRATIONS (Native OAuth for Google, Slack, HubSpot)
-- ============================================================

-- 1. New table: oauth_connections
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'google', 'slack', 'hubspot'
    access_token TEXT NOT NULL, -- encrypted via crypto.ts
    refresh_token TEXT, -- encrypted
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    provider_email TEXT, -- display: "Connected as user@gmail.com"
    provider_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, provider)
);

CREATE INDEX idx_oauth_connections_client ON oauth_connections(client_id);

-- RLS
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;

-- Clients see their own connections
CREATE POLICY "client_own_connections" ON oauth_connections FOR ALL USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- Startup admins see connections for their org's clients
CREATE POLICY "org_client_connections" ON oauth_connections FOR ALL USING (
    client_id IN (
        SELECT id FROM clients WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
        )
    )
);

-- 2. Add execution_type and provider columns to automation_recipes
ALTER TABLE automation_recipes ADD COLUMN IF NOT EXISTS execution_type TEXT DEFAULT 'webhook';
ALTER TABLE automation_recipes ADD COLUMN IF NOT EXISTS provider TEXT;

-- Make n8n_webhook_url nullable (native recipes don't need it)
ALTER TABLE automation_recipes ALTER COLUMN n8n_webhook_url DROP NOT NULL;
