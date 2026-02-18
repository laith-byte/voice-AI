-- ============================================================================
-- Migration: Eight marketing features
-- 1. Branded/Verified Caller ID (ALTER phone_numbers)
-- 2. SIP Trunking (CREATE sip_trunks)
-- 3. PII Redaction (CREATE pii_redaction_configs)
-- 4. Zapier Integration (CREATE zapier_subscriptions)
-- 5. Conversation Flows (CREATE conversation_flows)
-- 6. Plan Gates (ALTER client_plans + UPDATE)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Branded / Verified Caller ID
-- ---------------------------------------------------------------------------

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS caller_id_name TEXT,
  ADD COLUMN IF NOT EXISTS caller_id_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cnam_status TEXT DEFAULT 'none'; -- 'none','pending','verified'

-- ---------------------------------------------------------------------------
-- 2. SIP Trunking
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sip_trunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),
  label TEXT NOT NULL,
  sip_uri TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  codec TEXT DEFAULT 'PCMU',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sip_trunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org SIP trunks"
  ON sip_trunks FOR ALL USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. PII Redaction
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pii_redaction_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  redact_phone_numbers BOOLEAN DEFAULT true,
  redact_emails BOOLEAN DEFAULT true,
  redact_ssn BOOLEAN DEFAULT true,
  redact_credit_cards BOOLEAN DEFAULT true,
  redact_names BOOLEAN DEFAULT false,
  custom_patterns JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

ALTER TABLE pii_redaction_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own PII config"
  ON pii_redaction_configs FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid())
    OR client_id IN (SELECT id FROM clients WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 4. Zapier Integration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS zapier_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hook_url TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'call.completed',
  api_key_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zapier_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages Zapier subs"
  ON zapier_subscriptions FOR ALL USING (true);

-- ---------------------------------------------------------------------------
-- 5. Conversation Flows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  name TEXT NOT NULL DEFAULT 'Main Flow',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversation_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own flows"
  ON conversation_flows FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid())
    OR client_id IN (SELECT id FROM clients WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 6. Plan Gate Columns
-- ---------------------------------------------------------------------------

ALTER TABLE client_plans
  ADD COLUMN IF NOT EXISTS branded_caller_id BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_caller_id BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sip_trunking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pii_redaction BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendly_integration BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS zapier_integration BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversation_flows BOOLEAN DEFAULT false;

-- Enable for all plans (since pricing update enabled everything)
UPDATE client_plans SET
  branded_caller_id = true,
  verified_caller_id = true,
  sip_trunking = true,
  pii_redaction = true,
  calendly_integration = true,
  zapier_integration = true,
  conversation_flows = true
WHERE slug IN ('starter', 'professional', 'enterprise');
