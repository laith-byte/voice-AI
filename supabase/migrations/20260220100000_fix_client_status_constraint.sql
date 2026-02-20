-- Fix the clients.status CHECK constraint to include values used by
-- Stripe webhook handlers ('cancelled', 'past_due').
-- The original constraint only allowed ('active', 'inactive', 'suspended'),
-- causing silent failures when webhooks tried to set these statuses.

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'cancelled', 'past_due'));
