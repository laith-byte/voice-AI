-- ============================================================
-- Add Salesforce and GoHighLevel CRM integrations
-- The oauth_connections.provider is already a TEXT column with no CHECK
-- constraint, so new providers work automatically. This migration
-- seeds automation recipes for the two new CRM providers.
-- ============================================================

DO $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM organizations LIMIT 1;
    IF org_id IS NULL THEN
        RAISE NOTICE 'No organization found — skipping CRM recipe seed';
        RETURN;
    END IF;

    -- Salesforce CRM recipe
    INSERT INTO automation_recipes (
      organization_id, name, description, long_description, icon, category,
      execution_type, provider, is_active, is_coming_soon,
      config_schema, what_gets_sent
    ) VALUES (
      org_id,
      'Salesforce CRM',
      'Sync calls to Salesforce contacts and log activities',
      'Automatically look up or create Salesforce contacts when calls come in. Every completed call is logged as a Task record on the contact, including duration, summary, and call details.',
      '☁️',
      'crm',
      'native',
      'salesforce',
      true,
      false,
      '[{"key":"oauth","label":"Connect Salesforce","type":"oauth_connect","provider":"salesforce","required":true}]'::jsonb,
      '["Caller phone number","Call duration","Call summary","Call direction","Call status"]'::jsonb
    ) ON CONFLICT DO NOTHING;

    -- GoHighLevel CRM recipe
    INSERT INTO automation_recipes (
      organization_id, name, description, long_description, icon, category,
      execution_type, provider, is_active, is_coming_soon,
      config_schema, what_gets_sent
    ) VALUES (
      org_id,
      'GoHighLevel CRM',
      'Sync calls to GoHighLevel contacts and log notes',
      'Automatically look up or create GoHighLevel contacts when calls come in. Every completed call is logged as a note on the contact with full call details including duration and AI-generated summary.',
      '🚀',
      'crm',
      'native',
      'gohighlevel',
      true,
      false,
      '[{"key":"oauth","label":"Connect GoHighLevel","type":"oauth_connect","provider":"gohighlevel","required":true}]'::jsonb,
      '["Caller phone number","Call duration","Call summary","Call direction","Call status"]'::jsonb
    ) ON CONFLICT DO NOTHING;
END $$;
