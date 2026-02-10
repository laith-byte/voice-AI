-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    agent_id UUID REFERENCES agents(id) NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    tags TEXT[] DEFAULT '{}',
    dynamic_vars JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(agent_id);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    agent_id UUID REFERENCES agents(id) NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    start_date DATE,
    calling_days TEXT[] DEFAULT '{mon,tue,wed,thu,fri}',
    calling_hours_start TIME DEFAULT '09:00',
    calling_hours_end TIME DEFAULT '17:00',
    timezone_mode TEXT DEFAULT 'auto',
    timezone TEXT,
    retry_attempts INTEGER DEFAULT 2,
    retry_interval_hours INTEGER DEFAULT 4,
    calling_rate INTEGER DEFAULT 5,
    calling_rate_minutes INTEGER DEFAULT 1,
    phone_number_ids UUID[],
    cycle_numbers BOOLEAN DEFAULT false,
    leads_source TEXT DEFAULT 'existing',
    leads_tag_filter TEXT,
    total_leads INTEGER DEFAULT 0,
    completed_leads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_agent ON campaigns(agent_id);

-- Create campaign_leads junction table
CREATE TABLE IF NOT EXISTS campaign_leads (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_called_at TIMESTAMPTZ,
    PRIMARY KEY (campaign_id, lead_id)
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for startup users
DO $$ BEGIN
    CREATE POLICY "org_users_leads" ON leads FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "org_users_campaigns" ON campaigns FOR ALL USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for client users
DO $$ BEGIN
    CREATE POLICY "client_own_leads" ON leads FOR ALL USING (
        agent_id IN (SELECT id FROM agents WHERE client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "client_own_campaigns" ON campaigns FOR ALL USING (
        agent_id IN (SELECT id FROM agents WHERE client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "client_own_campaign_leads" ON campaign_leads FOR ALL USING (
        campaign_id IN (SELECT id FROM campaigns WHERE agent_id IN (SELECT id FROM agents WHERE client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
