-- First, deduplicate existing rows where agent_id IS NULL.
-- Keep the row with the latest created_at (or highest id if no created_at).
DELETE FROM client_access a
USING client_access b
WHERE a.agent_id IS NULL
  AND b.agent_id IS NULL
  AND a.client_id = b.client_id
  AND a.feature = b.feature
  AND a.id < b.id;

-- Add a partial unique index on (client_id, feature) for rows where agent_id IS NULL.
-- This allows the upsert with onConflict: "client_id,feature" to work correctly
-- for global (non-agent-specific) permission rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_access_client_feature
  ON client_access (client_id, feature)
  WHERE agent_id IS NULL;
