-- =============================================================================
-- Migration: Restructure Business Settings → Knowledge Base + Agent Settings
-- =============================================================================

-- 1. Add agent_id to post_call_actions for per-agent scoping
ALTER TABLE post_call_actions
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Drop old unique constraint and add new one
ALTER TABLE post_call_actions
  DROP CONSTRAINT IF EXISTS post_call_actions_client_id_action_type_key;

DO $$ BEGIN
  ALTER TABLE post_call_actions
    ADD CONSTRAINT post_call_actions_client_agent_action_key
    UNIQUE (client_id, agent_id, action_type);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- Migrate existing rows: set agent_id to client's primary agent
UPDATE post_call_actions pca
SET agent_id = (
  SELECT a.id FROM agents a
  WHERE a.client_id = pca.client_id
  ORDER BY a.created_at ASC
  LIMIT 1
)
WHERE pca.agent_id IS NULL;

-- Delete webhook action rows (no longer supported)
DELETE FROM post_call_actions WHERE action_type = 'webhook';


-- 2. Add agent_id to pii_redaction_configs for per-agent scoping
ALTER TABLE pii_redaction_configs
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Drop old unique constraint and add new one
ALTER TABLE pii_redaction_configs
  DROP CONSTRAINT IF EXISTS pii_redaction_configs_client_id_key;

DO $$ BEGIN
  ALTER TABLE pii_redaction_configs
    ADD CONSTRAINT pii_redaction_configs_client_agent_key
    UNIQUE (client_id, agent_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- Migrate existing rows: set agent_id to client's primary agent
UPDATE pii_redaction_configs prc
SET agent_id = (
  SELECT a.id FROM agents a
  WHERE a.client_id = prc.client_id
  ORDER BY a.created_at ASC
  LIMIT 1
)
WHERE prc.agent_id IS NULL;


-- 3. Create agent_call_handling table for per-agent call handling config
CREATE TABLE IF NOT EXISTS agent_call_handling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  after_hours_behavior TEXT DEFAULT 'take_message',
  unanswerable_behavior TEXT DEFAULT 'take_message',
  escalation_phone TEXT,
  max_call_duration_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id)
);

-- Seed agent_call_handling from existing business_settings
INSERT INTO agent_call_handling (agent_id, client_id, after_hours_behavior, unanswerable_behavior, escalation_phone, max_call_duration_minutes)
SELECT
  a.id,
  a.client_id,
  COALESCE(bs.after_hours_behavior, 'take_message'),
  COALESCE(bs.unanswerable_behavior, 'take_message'),
  bs.escalation_phone,
  COALESCE(bs.max_call_duration_minutes, 15)
FROM agents a
JOIN business_settings bs ON bs.client_id = a.client_id
ON CONFLICT (agent_id) DO NOTHING;
