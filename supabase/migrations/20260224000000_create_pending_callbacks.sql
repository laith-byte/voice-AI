CREATE TABLE pending_callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) NOT NULL,
    agent_id UUID REFERENCES agents(id) NOT NULL,
    caller_phone TEXT NOT NULL,
    caller_name TEXT,
    question TEXT NOT NULL,
    original_call_id TEXT,
    original_call_log_id UUID REFERENCES call_logs(id),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'answered', 'calling_back', 'completed', 'failed', 'expired'
    )),
    business_owner_answer TEXT,
    callback_retell_call_id TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 2,
    next_attempt_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/Los_Angeles',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_pending_callbacks_ready ON pending_callbacks (status, next_attempt_at) WHERE status = 'answered';
CREATE INDEX idx_pending_callbacks_retell_call ON pending_callbacks (callback_retell_call_id) WHERE callback_retell_call_id IS NOT NULL;
-- RLS enabled with no policies = deny all non-service-role access.
-- This table is only accessed via service role in API routes (tools, webhooks, cron).
ALTER TABLE pending_callbacks ENABLE ROW LEVEL SECURITY;
