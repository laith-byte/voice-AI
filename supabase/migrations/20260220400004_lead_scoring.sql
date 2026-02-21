-- ============================================================
-- LEAD SCORING: Add score columns to leads + scoring_rules table
-- ============================================================

-- Add scoring columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification TEXT DEFAULT 'unscored'
  CHECK (qualification IN ('unscored', 'cold', 'warm', 'hot', 'qualified'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON leads(qualification);

-- Scoring rules table (per-client, optionally per-agent)
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  rules JSONB NOT NULL DEFAULT '[
    {"criterion": "call_completed", "points": 20, "label": "Call completed successfully"},
    {"criterion": "duration_over_2min", "points": 10, "label": "Call lasted over 2 minutes"},
    {"criterion": "appointment_booked", "points": 30, "label": "Appointment booked"},
    {"criterion": "callback_requested", "points": 15, "label": "Callback requested"},
    {"criterion": "positive_sentiment", "points": 10, "label": "Positive sentiment detected"},
    {"criterion": "repeat_caller", "points": 5, "label": "Repeat caller"},
    {"criterion": "voicemail_left", "points": 5, "label": "Voicemail left"}
  ]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, agent_id)
);

-- RLS for lead_scoring_rules
ALTER TABLE lead_scoring_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "org_users_scoring_rules" ON lead_scoring_rules FOR ALL USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN users u ON u.organization_id = c.organization_id
            WHERE u.id = auth.uid() AND u.role LIKE 'startup_%'
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "client_own_scoring_rules" ON lead_scoring_rules FOR ALL USING (
        client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
