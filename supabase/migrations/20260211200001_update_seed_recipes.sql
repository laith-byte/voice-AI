-- ============================================================
-- UPDATE SEED RECIPES for Native OAuth
-- ============================================================
-- Update existing recipes to use execution_type/provider,
-- rename Zapier → Webhook, remove old CRM combined recipe,
-- and add native OAuth versions.

DO $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM organizations LIMIT 1;
    IF org_id IS NULL THEN
        RAISE NOTICE 'No organization found — skipping recipe update';
        RETURN;
    END IF;

    -- Update existing Google Sheets recipe to native
    UPDATE automation_recipes
    SET execution_type = 'native',
        provider = 'google-sheets',
        n8n_webhook_url = NULL,
        config_schema = '[
            {"key": "oauth_connect", "label": "Google Account", "type": "oauth_connect", "required": true, "provider": "google"},
            {"key": "spreadsheet_id", "label": "Spreadsheet", "type": "resource_picker", "required": true, "picker_type": "google-sheet", "depends_on": "oauth_connect", "placeholder": "Select a spreadsheet"},
            {"key": "trigger", "label": "Which calls to log", "type": "select", "options": ["All calls", "Completed only", "Missed only"], "default": "All calls"}
        ]'::jsonb,
        description = 'Automatically logs call data to your Google Sheet',
        long_description = 'Connect your Google account and select a spreadsheet. After each call, a new row is automatically added with the caller''s info, call summary, and outcome. No manual data entry required.',
        updated_at = NOW()
    WHERE organization_id = org_id AND name = 'New Lead → Google Sheets';

    -- Update existing Google Calendar recipe to native
    UPDATE automation_recipes
    SET execution_type = 'native',
        provider = 'google-calendar',
        n8n_webhook_url = NULL,
        config_schema = '[
            {"key": "oauth_connect", "label": "Google Account", "type": "oauth_connect", "required": true, "provider": "google"},
            {"key": "calendar_id", "label": "Calendar", "type": "resource_picker", "required": true, "picker_type": "google-calendar", "depends_on": "oauth_connect", "placeholder": "Select a calendar"},
            {"key": "default_duration", "label": "Default Appointment Duration", "type": "select", "options": ["30 minutes", "45 minutes", "60 minutes", "90 minutes"], "default": "60 minutes"}
        ]'::jsonb,
        description = 'Real-time availability check + booking during live calls',
        long_description = 'Connect your Google Calendar so your AI agent can check availability and book appointments in real-time during phone calls. Callers hear available times and can book on the spot.',
        updated_at = NOW()
    WHERE organization_id = org_id AND name = 'Appointment → Google Calendar';

    -- Update existing Slack recipe to native
    UPDATE automation_recipes
    SET execution_type = 'native',
        provider = 'slack',
        n8n_webhook_url = NULL,
        config_schema = '[
            {"key": "oauth_connect", "label": "Slack Workspace", "type": "oauth_connect", "required": true, "provider": "slack"},
            {"key": "channel_id", "label": "Channel", "type": "resource_picker", "required": true, "picker_type": "slack-channel", "depends_on": "oauth_connect", "placeholder": "Select a channel"},
            {"key": "notify_on", "label": "Notify on", "type": "select", "options": ["All calls", "Missed calls only", "Completed calls only"], "default": "All calls"},
            {"key": "include_transcript", "label": "Include full transcript", "type": "toggle", "default": false, "help_text": "Transcripts can be long — only enable if your channel can handle it."}
        ]'::jsonb,
        description = 'Get real-time call alerts in your Slack channel',
        long_description = 'Connect your Slack workspace and select a channel. After each call, your team gets an instant notification with the caller''s number, call summary, and outcome.',
        updated_at = NOW()
    WHERE organization_id = org_id AND name = 'Slack Notifications';

    -- Update Missed Call Follow-up to email type
    UPDATE automation_recipes
    SET execution_type = 'email',
        updated_at = NOW()
    WHERE organization_id = org_id AND name = 'Missed Call Follow-up';

    -- Delete old "New Lead → CRM" combined recipe (replaced by native HubSpot)
    DELETE FROM automation_recipes
    WHERE organization_id = org_id AND name = 'New Lead → CRM';

    -- Insert native HubSpot recipe
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        execution_type, provider, n8n_webhook_url,
        config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'HubSpot CRM',
        'Pre-call caller ID + post-call contact sync',
        'Connect HubSpot to give your AI agent caller context before the call starts. Known callers are greeted by name. After each call, contacts are automatically created or updated with call details.',
        '📋',
        'leads',
        'native',
        'hubspot',
        NULL,
        '[
            {"key": "oauth_connect", "label": "HubSpot Account", "type": "oauth_connect", "required": true, "provider": "hubspot"},
            {"key": "trigger", "label": "When to sync contacts", "type": "select", "options": ["All calls", "Completed only"], "default": "All calls"}
        ]'::jsonb,
        '["Caller name (if found)", "Caller phone number", "Call summary", "Call outcome", "Date & time of call"]'::jsonb,
        true, false, 5
    ) ON CONFLICT DO NOTHING;

    -- Rename Zapier → Webhook / Custom Integration
    UPDATE automation_recipes
    SET name = 'Webhook / Custom Integration',
        description = 'Send call data to any webhook URL',
        long_description = 'Paste any webhook URL to receive call data. Works with Zapier, Make, GoHighLevel, Salesforce, Zoho, and 7,000+ apps. Your account manager can configure this for you.',
        icon = '🔗',
        execution_type = 'webhook',
        config_schema = '[
            {"key": "webhook_url", "label": "Webhook URL", "type": "webhook_config", "required": true, "placeholder": "https://hooks.example.com/...", "help_text": "Paste any webhook URL. Works with Zapier, Make, GoHighLevel, Salesforce, Zoho, and 7,000+ apps. Your account manager can configure this for you."},
            {"key": "trigger", "label": "Which events to send", "type": "select", "options": ["All calls", "Completed only", "Missed only"], "default": "All calls"}
        ]'::jsonb,
        updated_at = NOW()
    WHERE organization_id = org_id AND name = 'Zapier Integration';

END $$;
