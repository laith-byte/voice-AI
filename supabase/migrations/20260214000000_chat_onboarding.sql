-- Add chat onboarding support
ALTER TABLE client_onboarding
  ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'voice'
    CHECK (agent_type IN ('voice', 'chat')),
  ADD COLUMN IF NOT EXISTS chat_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS chat_offline_behavior TEXT DEFAULT 'message';

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS chat_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS chat_offline_behavior TEXT DEFAULT 'message';
