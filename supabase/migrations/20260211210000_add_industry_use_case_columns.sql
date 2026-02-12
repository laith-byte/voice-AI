-- ============================================================
-- ADD INDUSTRY × USE CASE COLUMNS TO AGENT_TEMPLATES
-- ============================================================
-- Extends agent_templates for the 8×4 vertical template matrix:
--   8 industries × 4 use cases = 32 templates

ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS use_case TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS industry_icon TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS use_case_icon TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS use_case_description TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS default_hours JSONB;

-- Unique constraint: one template per industry + use_case combination
-- NULL values are treated as distinct, so old templates without industry/use_case are fine
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_industry_use_case
    ON agent_templates (industry, use_case)
    WHERE industry IS NOT NULL AND use_case IS NOT NULL;

-- Disable old vertical-only templates so they don't appear in the new wizard
UPDATE agent_templates SET wizard_enabled = false
WHERE vertical IS NOT NULL AND industry IS NULL;
