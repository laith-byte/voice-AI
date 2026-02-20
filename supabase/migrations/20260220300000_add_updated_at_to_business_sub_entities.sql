-- Add missing updated_at column to business sub-entity tables.
-- The PATCH API routes set updated_at on every edit, but these tables
-- were created without the column, causing 500 errors on all edits.

ALTER TABLE business_faqs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE business_services
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE business_policies
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE business_locations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
