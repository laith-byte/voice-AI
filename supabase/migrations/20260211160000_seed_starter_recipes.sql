-- ============================================================
-- SEED STARTER RECIPES (Phase 10C)
-- ============================================================
-- Pre-populate automation_recipes with 6 starter recipes
-- + 3 "Coming Soon" placeholders.
-- Each recipe includes config_schema for the dynamic setup form
-- and what_gets_sent for the setup modal info section.
--
-- n8n_webhook_url values are placeholders — replace with actual
-- n8n webhook URLs once the workflows are built.

-- Helper: get the first organization (for single-org installs)
DO $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM organizations LIMIT 1;
    IF org_id IS NULL THEN
        RAISE NOTICE 'No organization found — skipping recipe seed';
        RETURN;
    END IF;

    -- 1. New Lead → Google Sheets
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'New Lead → Google Sheets',
        'Automatically adds caller info to your spreadsheet',
        'When a new caller contacts your business, their information is automatically added as a new row in your Google Sheet. Perfect for tracking leads without manual data entry.',
        '📊',
        'leads',
        'https://n8n.invarialabs.com/webhook/placeholder-google-sheets',
        '[
            {"key": "sheet_url", "label": "Google Sheet URL", "type": "url", "required": true, "placeholder": "https://docs.google.com/spreadsheets/d/...", "help_text": "The full URL of your Google Sheet. Make sure it is shared with edit access."},
            {"key": "sheet_name", "label": "Sheet Name (tab)", "type": "text", "required": false, "placeholder": "Sheet1", "default": "Sheet1", "help_text": "The name of the tab to add rows to."},
            {"key": "trigger", "label": "Which calls to log", "type": "select", "options": ["All calls", "Completed only", "Missed only"], "default": "All calls"}
        ]'::jsonb,
        '["Date & time of call", "Caller name (if provided)", "Caller phone number", "Call summary", "Call duration", "Call outcome"]'::jsonb,
        true, false, 1
    ) ON CONFLICT DO NOTHING;

    -- 2. Appointment → Google Calendar
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'Appointment → Google Calendar',
        'Creates calendar events when callers book appointments',
        'When your AI agent books an appointment during a call, a Google Calendar event is automatically created. The event includes the caller''s name, phone number, and any notes from the conversation.',
        '📅',
        'scheduling',
        'https://n8n.invarialabs.com/webhook/placeholder-google-calendar',
        '[
            {"key": "calendar_email", "label": "Google Calendar Email", "type": "email", "required": true, "placeholder": "yourname@gmail.com", "help_text": "The Google account whose calendar will receive the events."},
            {"key": "default_duration", "label": "Default Event Duration", "type": "select", "options": ["30 minutes", "45 minutes", "60 minutes", "90 minutes"], "default": "60 minutes"},
            {"key": "trigger", "label": "When to create events", "type": "select", "options": ["All calls", "Completed only"], "default": "Completed only"}
        ]'::jsonb,
        '["Appointment date & time", "Caller name", "Caller phone number", "Appointment type", "Notes from the call"]'::jsonb,
        true, false, 2
    ) ON CONFLICT DO NOTHING;

    -- 3. Slack Notifications
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'Slack Notifications',
        'Get real-time call alerts in your Slack channel',
        'Receive instant notifications in your Slack channel whenever a call comes in. Each notification includes the caller''s number, a quick summary of the call, and the outcome — so your team stays in the loop without checking the dashboard.',
        '💬',
        'notifications',
        'https://n8n.invarialabs.com/webhook/placeholder-slack',
        '[
            {"key": "slack_webhook_url", "label": "Slack Webhook URL", "type": "url", "required": true, "placeholder": "https://hooks.slack.com/services/T.../B.../xxx", "help_text": "Go to your Slack workspace → Settings → Apps → Incoming Webhooks to get this URL."},
            {"key": "notify_on", "label": "Notify on", "type": "select", "options": ["All calls", "Missed calls only", "Completed calls only"], "default": "All calls"},
            {"key": "include_transcript", "label": "Include full transcript", "type": "toggle", "default": false, "help_text": "Transcripts can be long — only enable if your channel can handle it."}
        ]'::jsonb,
        '["Caller phone number", "Call duration", "Call summary", "Call outcome", "Full transcript (optional)"]'::jsonb,
        true, false, 3
    ) ON CONFLICT DO NOTHING;

    -- 4. Missed Call Follow-up Email
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'Missed Call Follow-up',
        'Auto-email when you miss a call with a link to schedule',
        'When a call goes unanswered or the caller hangs up before speaking with your agent, an automatic follow-up email is sent (if the caller''s email was captured). The email includes your business info and a link to schedule a callback.',
        '📧',
        'notifications',
        'https://n8n.invarialabs.com/webhook/placeholder-missed-followup',
        '[
            {"key": "reply_to_email", "label": "Reply-To Email", "type": "email", "required": true, "placeholder": "hello@yourbusiness.com", "help_text": "Replies to the follow-up email will go to this address."},
            {"key": "email_subject", "label": "Email Subject", "type": "text", "required": false, "placeholder": "We missed your call!", "default": "We missed your call — let us help!"},
            {"key": "scheduling_url", "label": "Scheduling Link (optional)", "type": "url", "required": false, "placeholder": "https://calendly.com/yourbusiness", "help_text": "A link to your online scheduling page. Will be included in the email."}
        ]'::jsonb,
        '["Caller phone number", "Time of missed call", "Business name & contact info", "Scheduling link (if provided)"]'::jsonb,
        true, false, 4
    ) ON CONFLICT DO NOTHING;

    -- 5. New Lead → CRM
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'New Lead → CRM',
        'Auto-create contacts in HubSpot or Salesforce',
        'Automatically creates a new contact in your CRM whenever a new caller reaches your business. The contact is populated with the caller''s phone number, name (if provided), and a summary of the call. Works with HubSpot and Salesforce.',
        '📋',
        'leads',
        'https://n8n.invarialabs.com/webhook/placeholder-crm',
        '[
            {"key": "crm_type", "label": "CRM Platform", "type": "select", "required": true, "options": ["HubSpot", "Salesforce"]},
            {"key": "api_key", "label": "API Key", "type": "text", "required": true, "placeholder": "Your CRM API key", "help_text": "For HubSpot: Settings → Integrations → API Key. For Salesforce: Setup → Security Token."},
            {"key": "pipeline_id", "label": "Pipeline / Deal Stage (optional)", "type": "text", "required": false, "placeholder": "e.g. New Leads", "help_text": "The pipeline or stage to assign new contacts to."},
            {"key": "trigger", "label": "When to create contacts", "type": "select", "options": ["All calls", "Completed only"], "default": "All calls"}
        ]'::jsonb,
        '["Caller name (if provided)", "Caller phone number", "Call summary", "Call outcome", "Date & time of call"]'::jsonb,
        true, false, 5
    ) ON CONFLICT DO NOTHING;

    -- 6. Zapier Integration
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'Zapier Integration',
        'Connect to 5,000+ apps via Zapier webhooks',
        'Forward your call data to any Zapier webhook, unlocking integrations with over 5,000 apps. Use this to build custom workflows — send data to your project management tool, CRM, email marketing platform, or anything else Zapier supports.',
        '🔄',
        'integrations',
        'https://n8n.invarialabs.com/webhook/placeholder-zapier',
        '[
            {"key": "zapier_webhook_url", "label": "Zapier Webhook URL", "type": "url", "required": true, "placeholder": "https://hooks.zapier.com/hooks/catch/...", "help_text": "Create a Zap with a \"Webhooks by Zapier\" trigger and paste the webhook URL here."},
            {"key": "trigger", "label": "Which events to send", "type": "select", "options": ["All calls", "Completed only", "Missed only"], "default": "All calls"}
        ]'::jsonb,
        '["Call ID", "Caller phone number", "Call duration", "Call status", "Call summary", "Full transcript", "Recording URL", "Post-call analysis"]'::jsonb,
        true, false, 6
    ) ON CONFLICT DO NOTHING;

    -- ============================================================
    -- COMING SOON PLACEHOLDERS
    -- ============================================================

    -- 7. Call Notes → Notion (Coming Soon)
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'Call Notes → Notion',
        'Auto-save call summaries to your Notion workspace',
        'Automatically creates a new page in your Notion database after every call, with the call summary, transcript, and caller info neatly formatted.',
        '📝',
        'integrations',
        'https://n8n.invarialabs.com/webhook/placeholder-notion',
        '[]'::jsonb,
        '["Call summary", "Full transcript", "Caller info", "Date & time"]'::jsonb,
        false, true, 7
    ) ON CONFLICT DO NOTHING;

    -- 8. SMS Appointment Reminders (Coming Soon)
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'SMS Appointment Reminders',
        'Text patients reminders before their appointments',
        'Automatically sends SMS reminders to callers who booked appointments. Configurable timing — send 24 hours before, 2 hours before, or both.',
        '📱',
        'scheduling',
        'https://n8n.invarialabs.com/webhook/placeholder-sms-reminders',
        '[]'::jsonb,
        '["Appointment date & time", "Business name", "Appointment type"]'::jsonb,
        false, true, 8
    ) ON CONFLICT DO NOTHING;

    -- 9. QuickBooks Invoicing (Coming Soon)
    INSERT INTO automation_recipes (
        organization_id, name, description, long_description, icon, category,
        n8n_webhook_url, config_schema, what_gets_sent,
        is_active, is_coming_soon, sort_order
    ) VALUES (
        org_id,
        'QuickBooks Invoicing',
        'Auto-generate invoices after service appointments',
        'Automatically creates a draft invoice in QuickBooks when a caller books a service appointment. Includes the service type and estimated pricing from your business settings.',
        '💰',
        'integrations',
        'https://n8n.invarialabs.com/webhook/placeholder-quickbooks',
        '[]'::jsonb,
        '["Service booked", "Estimated price", "Caller info", "Appointment date"]'::jsonb,
        false, true, 9
    ) ON CONFLICT DO NOTHING;

END $$;
