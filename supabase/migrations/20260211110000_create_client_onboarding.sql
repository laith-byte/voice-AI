-- ============================================================
-- CLIENT ONBOARDING TABLE (Phase 9B)
-- ============================================================

CREATE TABLE IF NOT EXISTS client_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL UNIQUE,
    status TEXT DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'completed', 'skipped'
    )),
    current_step INTEGER DEFAULT 1,
    vertical_template_id UUID REFERENCES agent_templates(id),
    -- Step 2 data
    business_name TEXT,
    business_phone TEXT,
    business_website TEXT,
    business_address TEXT,
    contact_name TEXT,
    contact_email TEXT,
    -- Step 4 data
    after_hours_behavior TEXT DEFAULT 'callback',
    unanswerable_behavior TEXT DEFAULT 'message',
    escalation_phone TEXT,
    max_call_duration_minutes INTEGER DEFAULT 5,
    post_call_email_summary BOOLEAN DEFAULT true,
    post_call_log BOOLEAN DEFAULT true,
    post_call_followup_text BOOLEAN DEFAULT false,
    -- Step 5 data
    test_calls_used INTEGER DEFAULT 0,
    test_call_completed BOOLEAN DEFAULT false,
    -- Step 6 data
    phone_number_option TEXT,
    go_live_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE client_onboarding ENABLE ROW LEVEL SECURITY;

-- Startup admins see all
CREATE POLICY "org_client_onboarding" ON client_onboarding FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);

-- Client users see their own
CREATE POLICY "client_own_onboarding" ON client_onboarding FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
