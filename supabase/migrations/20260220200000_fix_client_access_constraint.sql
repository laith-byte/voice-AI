-- Add a partial unique index on (client_id, feature) for rows where agent_id IS NULL.
-- This allows the upsert with onConflict: "client_id,feature" to work correctly
-- for global (non-agent-specific) permission rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_access_client_feature
  ON client_access (client_id, feature)
  WHERE agent_id IS NULL;
