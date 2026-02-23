-- INTEGRATION REQUESTS TABLE
-- Allows clients to request admin-side integrations (OAuth, phone numbers)
-- that require credentials they can't provide themselves.

CREATE TABLE integration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('integration', 'phone_number')),
    recipe_id UUID REFERENCES automation_recipes(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
    requested_by UUID REFERENCES auth.users(id) NOT NULL,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate pending integration requests for the same client + recipe
CREATE UNIQUE INDEX idx_integration_requests_pending_recipe
    ON integration_requests (client_id, recipe_id)
    WHERE status = 'pending' AND recipe_id IS NOT NULL;

-- Prevent duplicate pending phone number requests for the same client
CREATE UNIQUE INDEX idx_integration_requests_pending_phone
    ON integration_requests (client_id)
    WHERE status = 'pending' AND request_type = 'phone_number';

-- Index for fast lookup of pending requests
CREATE INDEX idx_integration_requests_org_status
    ON integration_requests (organization_id, status);

CREATE INDEX idx_integration_requests_client
    ON integration_requests (client_id);

ALTER TABLE integration_requests ENABLE ROW LEVEL SECURITY;

-- Startup admins can see and manage all requests for their organization
CREATE POLICY "org_integration_requests" ON integration_requests FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role LIKE 'startup_%'
    )
);

-- Client users can insert requests for their own client
CREATE POLICY "client_insert_integration_requests" ON integration_requests FOR INSERT WITH CHECK (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);

-- Client users can read their own requests
CREATE POLICY "client_read_integration_requests" ON integration_requests FOR SELECT USING (
    client_id IN (
        SELECT client_id FROM users WHERE id = auth.uid() AND role LIKE 'client_%'
    )
);
