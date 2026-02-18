-- Activate 3 "Coming Soon" automation recipes: Notion, SMS Reminders, QuickBooks

-- 1. Call Notes → Notion
UPDATE automation_recipes
SET
  is_coming_soon = false,
  is_active = true,
  execution_type = 'native',
  provider = 'notion',
  n8n_webhook_url = NULL,
  config_schema = '[
    {
      "key": "notion_api_key",
      "label": "Notion API Key",
      "type": "text",
      "required": true,
      "placeholder": "ntn_...",
      "help_text": "Create an internal integration at notion.so/my-integrations and paste the API key here."
    },
    {
      "key": "database_id",
      "label": "Notion Database ID",
      "type": "text",
      "required": true,
      "placeholder": "e.g. abc123def456...",
      "help_text": "The ID of the Notion database to add call notes to. Found in the database URL."
    },
    {
      "key": "include_transcript",
      "label": "Include Full Transcript",
      "type": "toggle",
      "default": false,
      "help_text": "If enabled, the full call transcript will be added to the Notion page body."
    },
    {
      "key": "trigger",
      "label": "Trigger On",
      "type": "select",
      "options": ["all_calls", "completed_only", "missed_only"],
      "default": "all_calls"
    }
  ]'::jsonb
WHERE id = '3a6f462a-8e86-4fc2-ae04-e93584187464';

-- 2. SMS Appointment Reminders
UPDATE automation_recipes
SET
  is_coming_soon = false,
  is_active = true,
  execution_type = 'native',
  provider = 'twilio-sms',
  n8n_webhook_url = NULL,
  config_schema = '[
    {
      "key": "business_name",
      "label": "Business Name",
      "type": "text",
      "required": true,
      "placeholder": "e.g. Acme Dental",
      "help_text": "Your business name as it will appear in SMS messages."
    },
    {
      "key": "reminder_phone",
      "label": "Default Reminder Phone",
      "type": "text",
      "required": false,
      "placeholder": "+1234567890",
      "help_text": "Override phone number for reminders. If empty, the caller''s number is used."
    },
    {
      "key": "reminder_hours_before",
      "label": "Reminder Hours Before",
      "type": "number",
      "default": 24,
      "help_text": "How many hours before the appointment to send a reminder SMS."
    },
    {
      "key": "include_confirmation",
      "label": "Send Confirmation SMS",
      "type": "toggle",
      "default": true,
      "help_text": "Send an immediate confirmation SMS after each call with appointment details."
    },
    {
      "key": "trigger",
      "label": "Trigger On",
      "type": "select",
      "options": ["all_calls", "completed_only"],
      "default": "completed_only"
    }
  ]'::jsonb
WHERE id = '8f74bf16-b705-4b80-ae7d-470745b75d41';

-- 3. QuickBooks Invoicing
UPDATE automation_recipes
SET
  is_coming_soon = false,
  is_active = true,
  execution_type = 'native',
  provider = 'quickbooks',
  n8n_webhook_url = NULL,
  config_schema = '[
    {
      "key": "oauth_connect",
      "label": "Connect QuickBooks",
      "type": "oauth_connect",
      "provider": "quickbooks",
      "required": true
    },
    {
      "key": "default_item_name",
      "label": "Default Service Name",
      "type": "text",
      "default": "Phone Consultation",
      "placeholder": "e.g. Phone Consultation",
      "help_text": "The default line item name on generated invoices."
    },
    {
      "key": "default_rate",
      "label": "Default Rate ($)",
      "type": "number",
      "default": 0,
      "help_text": "Default rate per call. Set to 0 to create $0 draft invoices for manual pricing."
    },
    {
      "key": "trigger",
      "label": "Trigger On",
      "type": "select",
      "options": ["all_calls", "completed_only"],
      "default": "completed_only"
    }
  ]'::jsonb
WHERE id = '8370ec72-97c4-45bb-8976-f5086f7de938';
