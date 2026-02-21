-- Add conversation_flow_id column to agents table
-- This stores the Retell conversation flow ID as a reliable fallback,
-- in case the Retell agent response_engine update fails after flow creation.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS conversation_flow_id TEXT;
