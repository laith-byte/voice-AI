-- Add columns for storing pre-generated flow nodes and agent persona name
-- on each agent_template row, so templates can be managed entirely from Supabase.

ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS default_flow_nodes JSONB;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS agent_name TEXT;
