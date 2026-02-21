-- ============================================================================
-- Migration: Create waitlist_entries and call_feedback tables for tool endpoints
-- ============================================================================

-- Waitlist entries for callers waiting for availability
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  caller_phone TEXT NOT NULL,
  caller_name TEXT,
  service_requested TEXT,
  preferred_time TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'booked', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_users_waitlist" ON waitlist_entries FOR ALL USING (
  client_id IN (SELECT id FROM clients WHERE organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
  ))
);

CREATE POLICY "client_own_waitlist" ON waitlist_entries FOR ALL USING (
  client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);

-- Call feedback / satisfaction ratings
CREATE TABLE IF NOT EXISTS call_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  caller_phone TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE call_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_users_call_feedback" ON call_feedback FOR ALL USING (
  client_id IN (SELECT id FROM clients WHERE organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
  ))
);

CREATE POLICY "client_own_call_feedback" ON call_feedback FOR ALL USING (
  client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
