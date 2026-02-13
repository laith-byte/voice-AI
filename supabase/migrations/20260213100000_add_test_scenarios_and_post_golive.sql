-- ============================================================
-- ADDENDUM #2 — SCHEMA ADDITIONS
-- Adds test_scenarios to agent_templates and post-go-live
-- tracking columns to client_onboarding.
-- ============================================================

-- 1. Test scenarios per template (populated by Migration B)
ALTER TABLE agent_templates
  ADD COLUMN IF NOT EXISTS test_scenarios JSONB DEFAULT '[]'::jsonb;

-- 2. Post-go-live tracking on client_onboarding
ALTER TABLE client_onboarding
  ADD COLUMN IF NOT EXISTS first_call_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_calls_since_live INTEGER DEFAULT 0;

-- 3. Atomic counter increment RPC
CREATE OR REPLACE FUNCTION increment_total_calls(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE client_onboarding
  SET total_calls_since_live = COALESCE(total_calls_since_live, 0) + 1
  WHERE client_id = p_client_id;
END;
$$;
