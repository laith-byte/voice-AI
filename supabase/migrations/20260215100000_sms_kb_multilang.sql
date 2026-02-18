-- SMS Agent: Expand agent_type check constraint to include 'sms'
ALTER TABLE client_onboarding DROP CONSTRAINT IF EXISTS client_onboarding_agent_type_check;
ALTER TABLE client_onboarding ADD CONSTRAINT client_onboarding_agent_type_check
  CHECK (agent_type IN ('voice', 'chat', 'sms'));

-- SMS Agent: Add phone_number to agents for SMS agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Knowledge Base: Sources tracking
CREATE TABLE IF NOT EXISTS knowledge_base_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('document', 'text', 'url', 'file')),
    name TEXT NOT NULL,
    content TEXT,
    url TEXT,
    retell_kb_id TEXT,
    file_size_bytes INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base: RLS policies
ALTER TABLE knowledge_base_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent KB sources"
  ON knowledge_base_sources FOR SELECT
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      JOIN users u ON u.client_id = a.client_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert KB sources for their agents"
  ON knowledge_base_sources FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT a.id FROM agents a
      JOIN users u ON u.client_id = a.client_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update KB sources for their agents"
  ON knowledge_base_sources FOR UPDATE
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      JOIN users u ON u.client_id = a.client_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete KB sources for their agents"
  ON knowledge_base_sources FOR DELETE
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      JOIN users u ON u.client_id = a.client_id
      WHERE u.id = auth.uid()
    )
  );

-- Multi-language: Add language column to client_onboarding
ALTER TABLE client_onboarding ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en-US';
