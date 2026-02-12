-- ============================================================
-- POST-CALL ACTIONS TABLE (Phase 10A)
-- ============================================================
-- Stores per-client post-call action configurations.
-- Each action type (email_summary, sms_notification, etc.)
-- has an is_enabled toggle and a config JSONB for type-specific settings.

CREATE TABLE post_call_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'email_summary',
        'sms_notification',
        'caller_followup_email',
        'daily_digest',
        'webhook'
    )),
    is_enabled BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, action_type)
);

ALTER TABLE post_call_actions ENABLE ROW LEVEL SECURITY;

-- Startup admins can manage post-call actions for their org's clients
CREATE POLICY "org_post_call_actions" ON post_call_actions FOR ALL USING (
    client_id IN (
        SELECT id FROM clients WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
        )
    )
);

-- Client users can manage their own post-call actions
CREATE POLICY "client_own_post_call_actions" ON post_call_actions FOR ALL USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- Index for fast lookup during webhook execution
CREATE INDEX idx_post_call_actions_client_enabled ON post_call_actions(client_id) WHERE is_enabled = true;
