-- Allow portal clients to read wizard-enabled templates for the onboarding wizard
-- The existing "org_agent_templates" policy only permits startup admins (FOR ALL).
-- This adds a separate SELECT policy for all authenticated users on wizard-enabled rows.

CREATE POLICY "clients_read_wizard_templates"
  ON agent_templates
  FOR SELECT
  USING (wizard_enabled = true AND auth.role() = 'authenticated');
