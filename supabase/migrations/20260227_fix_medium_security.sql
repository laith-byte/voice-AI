-- MEDIUM-02: Atomic automation counter increment
CREATE OR REPLACE FUNCTION increment_automation_counter(p_id UUID, p_field TEXT)
RETURNS void AS $$
BEGIN
  IF p_field = 'trigger_count' THEN
    UPDATE client_automations SET trigger_count = trigger_count + 1, last_triggered_at = NOW() WHERE id = p_id;
  ELSIF p_field = 'error_count' THEN
    UPDATE client_automations SET error_count = error_count + 1 WHERE id = p_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MEDIUM-09: Atomic test call counter
CREATE OR REPLACE FUNCTION increment_test_calls_used(p_client_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE client_onboarding SET test_calls_used = test_calls_used + 1, updated_at = NOW() WHERE client_id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MEDIUM-19: Performance index for call_logs queries
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_date ON call_logs(agent_id, created_at DESC);
