-- ============================================================
-- INVARIA LABS — COMPLETE DATABASE SCHEMA
-- Run in Supabase SQL Editor
-- Source of truth: CLAUDE.md
-- ============================================================

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    language TEXT DEFAULT 'English',
    dashboard_theme TEXT DEFAULT 'light',
    custom_css TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('startup_admin', 'startup_member', 'client_admin', 'client_member')),
    organization_id UUID REFERENCES organizations(id),
    client_id UUID REFERENCES clients(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENT TABLES
-- ============================================================

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    client_id UUID REFERENCES clients(id),
    name TEXT NOT NULL,
    description TEXT,
    platform TEXT DEFAULT 'retell',
    retell_agent_id TEXT NOT NULL,
    retell_api_key_encrypted TEXT NOT NULL,
    knowledge_base_id TEXT,
    knowledge_base_name TEXT,
    webhook_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE widget_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) NOT NULL UNIQUE,
    agent_image_url TEXT,
    widget_layout TEXT DEFAULT 'original',
    description TEXT DEFAULT 'Our assistant is here to help.',
    branding TEXT,
    background_image_url TEXT,
    launcher_image_url TEXT,
    google_font_name TEXT DEFAULT 'DM Sans',
    color_preset TEXT DEFAULT '#2563eb',
    custom_css TEXT,
    autolaunch_popup BOOLEAN DEFAULT true,
    launch_message TEXT DEFAULT 'Hello. How may I assist you?',
    launch_message_enabled BOOLEAN DEFAULT false,
    popup_message TEXT DEFAULT 'launch',
    popup_message_enabled BOOLEAN DEFAULT false,
    terms_of_service_url TEXT,
    privacy_policy_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_analysis_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) NOT NULL UNIQUE,
    summary_enabled BOOLEAN DEFAULT false,
    summary_custom_prompt TEXT,
    evaluation_enabled BOOLEAN DEFAULT false,
    evaluation_custom_prompt TEXT,
    auto_tagging_enabled BOOLEAN DEFAULT false,
    auto_tagging_mode TEXT DEFAULT 'auto',
    auto_tagging_custom_prompt TEXT,
    misunderstood_queries_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) NOT NULL UNIQUE,
    rate_mode TEXT DEFAULT 'minmax',
    min_calls INTEGER DEFAULT 1,
    max_calls INTEGER DEFAULT 20,
    min_minutes INTEGER DEFAULT 1,
    max_minutes INTEGER DEFAULT 60,
    fixed_calls INTEGER DEFAULT 20,
    fixed_minutes INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENT ACCESS & PERMISSIONS
-- ============================================================

CREATE TABLE client_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    agent_id UUID REFERENCES agents(id),
    feature TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, agent_id, feature)
);
-- Features: 'workflows', 'phone_numbers', 'analytics', 'conversations',
-- 'knowledge_base', 'topics', 'agent_settings', 'leads', 'campaigns'

-- ============================================================
-- PHONE NUMBERS & CALL LOGS
-- ============================================================

CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    client_id UUID REFERENCES clients(id),
    agent_id UUID REFERENCES agents(id),
    number TEXT NOT NULL,
    retell_number_id TEXT,
    type TEXT DEFAULT 'standard',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    client_id UUID REFERENCES clients(id),
    agent_id UUID REFERENCES agents(id),
    retell_call_id TEXT UNIQUE NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    status TEXT,
    duration_seconds INTEGER,
    from_number TEXT,
    to_number TEXT,
    recording_url TEXT,
    transcript JSONB,
    post_call_analysis JSONB,
    summary TEXT,
    evaluation TEXT,
    tags TEXT[],
    metadata JSONB,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_call_logs_agent ON call_logs(agent_id);
CREATE INDEX idx_call_logs_client ON call_logs(client_id);
CREATE INDEX idx_call_logs_started ON call_logs(started_at DESC);

-- ============================================================
-- WORKFLOWS / SOLUTIONS
-- ============================================================

CREATE TABLE solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_solutions (
    client_id UUID REFERENCES clients(id),
    solution_id UUID REFERENCES solutions(id),
    PRIMARY KEY (client_id, solution_id)
);

-- ============================================================
-- BILLING & SAAS
-- ============================================================

CREATE TABLE stripe_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
    stripe_account_id TEXT,
    is_connected BOOLEAN DEFAULT false,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    setup_fee DECIMAL(10,2) DEFAULT 0,
    agents_included INTEGER DEFAULT 1,
    call_minutes_included INTEGER DEFAULT 5,
    overage_rate DECIMAL(10,4),
    features JSONB,
    stripe_monthly_price_id TEXT,
    stripe_yearly_price_id TEXT,
    stripe_setup_price_id TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    plan_ids UUID[] NOT NULL,
    default_view TEXT DEFAULT 'monthly',
    button_shape TEXT DEFAULT 'rounded',
    background_color TEXT,
    button_color TEXT DEFAULT '#2563eb',
    highlight_enabled BOOLEAN DEFAULT true,
    highlight_plan_id UUID REFERENCES client_plans(id),
    highlight_label TEXT DEFAULT 'Popular',
    highlight_color TEXT DEFAULT '#1f2937',
    badge_color TEXT DEFAULT '#f59e0b',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    text_provider TEXT DEFAULT 'OpenAI',
    voice_provider TEXT DEFAULT 'Retell',
    retell_agent_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SETTINGS
-- ============================================================

CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
    dashboard_logo_url TEXT,
    login_page_logo_url TEXT,
    openai_api_key_encrypted TEXT,
    gdpr_enabled BOOLEAN DEFAULT true,
    hipaa_enabled BOOLEAN DEFAULT false,
    payment_success_redirect_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whitelabel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
    favicon_url TEXT,
    website_title TEXT DEFAULT 'Invaria Labs',
    color_theme TEXT DEFAULT '#2563eb',
    loading_icon TEXT DEFAULT 'ring',
    loading_icon_size TEXT DEFAULT 'lg',
    domain TEXT,
    domain_valid BOOLEAN DEFAULT false,
    backend_domain TEXT,
    sending_domain TEXT,
    sending_domain_valid BOOLEAN DEFAULT false,
    sender_address TEXT DEFAULT 'sales',
    sender_name TEXT DEFAULT 'Invaria Labs',
    email_logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN (
        'two_factor', 'password_setup', 'password_reset', 'startup_invite'
    )),
    subject TEXT NOT NULL,
    greeting TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, template_type)
);

CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('retell', 'elevenlabs', 'vapi', 'openai')),
    name TEXT NOT NULL DEFAULT 'Default Integration',
    api_key_encrypted TEXT NOT NULL,
    is_connected BOOLEAN DEFAULT true,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, provider, name)
);

CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    agent_id UUID REFERENCES agents(id),
    event TEXT NOT NULL,
    import_result TEXT,
    forwarding_result TEXT,
    platform_call_id TEXT,
    raw_payload JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_webhook_logs_timestamp ON webhook_logs(timestamp DESC);
CREATE INDEX idx_webhook_logs_agent ON webhook_logs(agent_id);

-- ============================================================
-- LEADS & CAMPAIGNS
-- ============================================================

CREATE TABLE leads (
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
CREATE INDEX idx_leads_agent ON leads(agent_id);

CREATE TABLE campaigns (
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
CREATE INDEX idx_campaigns_agent ON campaigns(agent_id);

CREATE TABLE campaign_leads (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_called_at TIMESTAMPTZ,
    PRIMARY KEY (campaign_id, lead_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Startup admins/members see all data in their organization
CREATE POLICY "org_users_all" ON clients FOR ALL USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
);

CREATE POLICY "org_users_agents" ON agents FOR ALL USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
);

CREATE POLICY "org_users_calls" ON call_logs FOR ALL USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%')
);

-- Client users only see their own client data
CREATE POLICY "client_own_data" ON call_logs FOR SELECT USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);

CREATE POLICY "client_own_agents" ON agents FOR SELECT USING (
    client_id IN (SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%')
);
