-- ============================================================
-- BUSINESS SETTINGS TABLES (Phase 9A)
-- ============================================================

-- Core business settings per client
CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL UNIQUE,
    business_name TEXT,
    business_phone TEXT,
    business_website TEXT,
    business_address TEXT,
    timezone TEXT DEFAULT 'America/Los_Angeles',
    contact_name TEXT,
    contact_email TEXT,
    after_hours_behavior TEXT DEFAULT 'callback',
    unanswerable_behavior TEXT DEFAULT 'message',
    escalation_phone TEXT,
    max_call_duration_minutes INTEGER DEFAULT 5,
    post_call_email BOOLEAN DEFAULT true,
    post_call_log BOOLEAN DEFAULT true,
    post_call_text BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business hours per day
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_open BOOLEAN DEFAULT true,
    open_time TIME,
    close_time TIME,
    UNIQUE(client_id, day_of_week)
);

-- Services offered
CREATE TABLE IF NOT EXISTS business_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_text TEXT,
    duration_text TEXT,
    ai_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQs
CREATE TABLE IF NOT EXISTS business_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies
CREATE TABLE IF NOT EXISTS business_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS business_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend agent_templates for vertical wizard support
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS prompt_template TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS default_services JSONB;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS default_faqs JSONB;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS default_policies JSONB;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS wizard_enabled BOOLEAN DEFAULT true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_locations ENABLE ROW LEVEL SECURITY;

-- Startup admins see all business data in their org
CREATE POLICY "org_business_settings" ON business_settings FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);
CREATE POLICY "org_business_hours" ON business_hours FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);
CREATE POLICY "org_business_services" ON business_services FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);
CREATE POLICY "org_business_faqs" ON business_faqs FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);
CREATE POLICY "org_business_policies" ON business_policies FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);
CREATE POLICY "org_business_locations" ON business_locations FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    ))
);

-- Client users see their own data
CREATE POLICY "client_own_business_settings" ON business_settings FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
CREATE POLICY "client_own_business_hours" ON business_hours FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
CREATE POLICY "client_own_business_services" ON business_services FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
CREATE POLICY "client_own_business_faqs" ON business_faqs FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
CREATE POLICY "client_own_business_policies" ON business_policies FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
CREATE POLICY "client_own_business_locations" ON business_locations FOR ALL USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
