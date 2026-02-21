-- ============================================================================
-- Migration: Make and n8n webhook subscription tables
-- Follows the same schema as zapier_subscriptions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Make Subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS make_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hook_url TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'call.completed',
  api_key_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE make_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages Make subs"
  ON make_subscriptions FOR ALL USING (true);

-- ---------------------------------------------------------------------------
-- 2. n8n Subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS n8n_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hook_url TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'call.completed',
  api_key_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE n8n_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages n8n subs"
  ON n8n_subscriptions FOR ALL USING (true);
