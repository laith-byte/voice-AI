-- ============================================================
-- CRM INTEGRATIONS: Housecall Pro + Jobber
-- ============================================================
-- Three new tables for CRM sync infrastructure:
-- 1. integration_events — user-visible sync history
-- 2. integration_retry_queue — exponential backoff retry queue
-- 3. service_category_mappings — maps services to CRM categories
-- Plus: automation recipes for both providers and HVAC agent template

-- 1. Integration events — user-visible sync history
CREATE TABLE IF NOT EXISTS integration_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    direction TEXT DEFAULT 'outbound',
    entity_type TEXT,
    entity_id TEXT,
    call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_integration_events_client ON integration_events(client_id, created_at DESC);
CREATE INDEX idx_integration_events_provider ON integration_events(provider, created_at DESC);
CREATE INDEX idx_integration_events_call_log ON integration_events(call_log_id) WHERE call_log_id IS NOT NULL;

-- 2. Integration retry queue — failed API calls retried with exponential backoff
CREATE TABLE IF NOT EXISTS integration_retry_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_retry_queue_pending ON integration_retry_queue(next_attempt_at)
    WHERE status = 'pending';
CREATE INDEX idx_retry_queue_client ON integration_retry_queue(client_id, status);

-- 3. Service category mappings — maps business_services to CRM job types
CREATE TABLE IF NOT EXISTS service_category_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    internal_service_id UUID REFERENCES business_services(id) ON DELETE CASCADE,
    internal_service_name TEXT NOT NULL,
    external_category_id TEXT,
    external_category_name TEXT,
    default_duration_minutes INT DEFAULT 60,
    default_price_cents INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, provider, internal_service_id)
);

CREATE INDEX idx_service_mappings_client ON service_category_mappings(client_id, provider);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_category_mappings ENABLE ROW LEVEL SECURITY;

-- integration_events: startup admins see events for clients in their org
CREATE POLICY "org_integration_events" ON integration_events FOR ALL USING (
    client_id IN (
        SELECT id FROM clients WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
        )
    )
);

-- integration_events: clients see their own events
CREATE POLICY "client_own_integration_events" ON integration_events FOR ALL USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- integration_retry_queue: startup admins manage retries for their org
CREATE POLICY "org_retry_queue" ON integration_retry_queue FOR ALL USING (
    client_id IN (
        SELECT id FROM clients WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
        )
    )
);

-- integration_retry_queue: clients see their own retries
CREATE POLICY "client_own_retry_queue" ON integration_retry_queue FOR ALL USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- service_category_mappings: startup admins manage for their org
CREATE POLICY "org_service_mappings" ON service_category_mappings FOR ALL USING (
    client_id IN (
        SELECT id FROM clients WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
        )
    )
);

-- service_category_mappings: clients manage their own mappings
CREATE POLICY "client_own_service_mappings" ON service_category_mappings FOR ALL USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- ============================================================
-- Seed automation recipes for Housecall Pro and Jobber
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

    -- Housecall Pro CRM recipe
    INSERT INTO automation_recipes (
      organization_id, name, description, long_description, icon, category,
      execution_type, provider, is_active, is_coming_soon,
      config_schema, what_gets_sent
    ) VALUES (
      org_id,
      'Housecall Pro CRM',
      'Sync calls to Housecall Pro customers and create jobs',
      'Automatically look up or create Housecall Pro customers when calls come in. Every completed call is logged as a note on the customer. Optionally create jobs with service line items, scheduling, and estimates.',
      '🏠',
      'crm',
      'native',
      'housecallpro',
      true,
      false,
      '[{"key":"oauth","label":"Connect Housecall Pro","type":"oauth_connect","provider":"housecallpro","required":true},{"key":"trigger","label":"Trigger on","type":"select","options":["All calls","Completed only","Missed only"],"default":"Completed only"},{"key":"auto_create_job","label":"Auto-create job from call","type":"toggle","default":false,"help_text":"When enabled, a job will be created in Housecall Pro after each qualifying call"}]'::jsonb,
      '["Caller phone number","Caller name","Call duration","Call summary","Service requested","Urgency level"]'::jsonb
    ) ON CONFLICT DO NOTHING;

    -- Jobber CRM recipe
    INSERT INTO automation_recipes (
      organization_id, name, description, long_description, icon, category,
      execution_type, provider, is_active, is_coming_soon,
      config_schema, what_gets_sent
    ) VALUES (
      org_id,
      'Jobber CRM',
      'Sync calls to Jobber clients and create requests',
      'Automatically look up or create Jobber clients when calls come in. Every completed call creates a service request with full call details. Optionally create jobs and quotes directly from call data.',
      '📋',
      'crm',
      'native',
      'jobber',
      true,
      false,
      '[{"key":"oauth","label":"Connect Jobber","type":"oauth_connect","provider":"jobber","required":true},{"key":"trigger","label":"Trigger on","type":"select","options":["All calls","Completed only","Missed only"],"default":"Completed only"},{"key":"auto_create_request","label":"Auto-create request from call","type":"toggle","default":true,"help_text":"When enabled, a service request will be created in Jobber after each qualifying call"}]'::jsonb,
      '["Caller phone number","Caller name","Call duration","Call summary","Service requested","Urgency level"]'::jsonb
    ) ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- Seed HVAC agent template
-- ============================================================

INSERT INTO agent_templates (
    name, vertical, icon, wizard_enabled,
    prompt_template,
    default_services, default_faqs, default_policies
) VALUES (
    'HVAC Service',
    'hvac',
    '❄️',
    true,
    E'You are a professional, knowledgeable AI receptionist for {{business_name}}, an HVAC service company{{#if business_address}} located at {{business_address}}{{/if}}.\n\nBUSINESS HOURS:\n{{#each business_hours}}\n{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}\n{{/each}}\n\nSERVICES WE OFFER:\n{{#each services}}\n- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price}} ({{price}}){{/if}}\n{{/each}}\n\nFREQUENTLY ASKED QUESTIONS:\n{{#each faqs}}\nQ: {{question}}\nA: {{answer}}\n{{/each}}\n\nPOLICIES:\n{{#each policies}}\n{{name}}: {{description}}\n{{/each}}\n\nEMERGENCY TRIAGE PROTOCOL:\n- If the caller reports a gas leak, carbon monoxide alarm, or electrical burning smell, treat as IMMEDIATE EMERGENCY. Advise them to evacuate and call 911 first, then schedule emergency service.\n- If the caller reports no heat in freezing temperatures, no AC in extreme heat, flooding/water damage from HVAC, or complete system failure, treat as URGENT. Prioritize same-day dispatch.\n- For all other requests (maintenance, tune-ups, estimates, minor issues), schedule at the next available routine appointment.\n\nSERVICE AREA VERIFICATION:\n- Always confirm the caller''s service address is within our coverage area.\n- If unsure, take their address and let them know we''ll confirm and call back.\n\nSEASONAL AWARENESS:\n- During summer months (May-September), prioritize AC-related calls and mention our AC tune-up specials.\n- During winter months (October-April), prioritize heating-related calls and mention our furnace inspection specials.\n- Always mention seasonal maintenance packages when appropriate.\n\nWARRANTY CHECK:\n- Ask if the equipment is under warranty when discussing repairs.\n- Note the equipment brand and approximate age if the caller knows it.\n- Mention that warranty coverage will be verified by our technician on-site.\n\nAPPOINTMENT BOOKING:\n- Collect: name, phone, email, service address, issue description, equipment type/age if known.\n- Classify urgency: emergency (same-day), urgent (next available), routine (schedule at convenience).\n- Offer available time slots and confirm the booking.\n- Mention what the technician will do during the visit.\n\nCALL HANDLING RULES:\n- If the caller asks about something not covered above, {{unanswerable_behavior}}\n- If calling outside business hours, {{after_hours_behavior}}\n- Keep calls concise and under {{max_call_duration}} minutes\n- Always be helpful, professional, and empathetic\n- Never make up information — if unsure, {{unanswerable_behavior}}',
    '[
        {"name": "AC Repair", "description": "Diagnose and repair air conditioning systems", "price_text": "Service call starting at $89"},
        {"name": "AC Installation", "description": "New central air conditioning system installation", "price_text": "Free estimate"},
        {"name": "Heating Repair", "description": "Furnace, heat pump, and boiler repair", "price_text": "Service call starting at $89"},
        {"name": "Furnace Installation", "description": "New furnace or heating system installation", "price_text": "Free estimate"},
        {"name": "Maintenance & Tune-Up", "description": "Seasonal HVAC maintenance and system tune-ups", "price_text": "Starting at $79"},
        {"name": "Duct Work", "description": "Duct cleaning, repair, and installation", "price_text": "Free estimate"},
        {"name": "Thermostat", "description": "Smart thermostat installation and programming", "price_text": "Starting at $149 including installation"},
        {"name": "Indoor Air Quality", "description": "Air purifiers, humidifiers, and filtration systems", "price_text": "Free consultation"},
        {"name": "Emergency Service", "description": "24/7 emergency HVAC repair", "price_text": "Emergency rates apply"}
    ]'::jsonb,
    '[
        {"question": "Do you offer emergency service?", "answer": "Yes, we offer 24/7 emergency HVAC service. Emergency calls are prioritized and we aim to have a technician at your location as quickly as possible. Emergency service rates may apply."},
        {"question": "What brands do you service?", "answer": "We service all major HVAC brands including Carrier, Trane, Lennox, Rheem, Goodman, Daikin, York, and more. Our technicians are factory-trained on most major brands."},
        {"question": "Is the repair covered under warranty?", "answer": "Warranty coverage depends on the age and brand of your equipment. Our technician will check your warranty status during the service visit. If your system is still under manufacturer warranty, we will work directly with the manufacturer."},
        {"question": "How long does a typical service call take?", "answer": "A standard diagnostic and repair visit typically takes 1-2 hours. More complex repairs or installations may take longer. We will give you a time estimate once our technician diagnoses the issue."},
        {"question": "Do you offer financing?", "answer": "Yes, we offer flexible financing options for major repairs and new system installations. Ask about our 0% financing options for qualifying customers."},
        {"question": "What is included in a maintenance tune-up?", "answer": "Our tune-up includes a comprehensive system inspection, filter replacement, coil cleaning, refrigerant level check, electrical connection tightening, thermostat calibration, and a safety inspection."}
    ]'::jsonb,
    '[
        {"name": "Cancellation Policy", "description": "Please provide at least 4 hours notice for cancellations or reschedules. Same-day cancellations may be subject to a trip charge."},
        {"name": "Emergency Surcharge", "description": "After-hours, weekend, and holiday emergency calls may include an additional surcharge. The surcharge amount will be communicated before dispatch."},
        {"name": "Warranty Terms", "description": "All repairs come with a 90-day labor warranty. Parts warranties vary by manufacturer. New installations include a 1-year labor warranty in addition to manufacturer warranties."},
        {"name": "Service Area", "description": "We service the greater metropolitan area within a 30-mile radius. Service outside this area may incur additional travel charges."}
    ]'::jsonb
) ON CONFLICT DO NOTHING;
