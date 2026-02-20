-- ============================================================
-- FIX: Add missing columns to client_onboarding
-- The go-live route and step 4 route write to these columns
-- but they were never created in previous migrations.
-- ============================================================

-- SMS phone number (saved during step 4 for SMS agents)
ALTER TABLE client_onboarding
  ADD COLUMN IF NOT EXISTS sms_phone_number TEXT;

-- Go-live deployment tracking fields
ALTER TABLE client_onboarding
  ADD COLUMN IF NOT EXISTS chat_widget_deployed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_phone_configured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;
