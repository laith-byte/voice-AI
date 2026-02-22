-- Bump current_step for in-progress onboardings on step 5+ (old Test/Go Live → new 6/7)
UPDATE client_onboarding
SET current_step = current_step + 1
WHERE status = 'in_progress' AND current_step >= 5;

-- Track flow deployment status during onboarding
ALTER TABLE client_onboarding
  ADD COLUMN IF NOT EXISTS conversation_flow_deployed BOOLEAN DEFAULT false;
