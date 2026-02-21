-- Usage alert settings table for threshold-based email notifications
CREATE TABLE IF NOT EXISTS usage_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('minutes_threshold', 'cost_threshold', 'calls_threshold')),
  threshold_value NUMERIC NOT NULL,
  threshold_percent INTEGER,
  is_enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, alert_type)
);

-- RLS policies
ALTER TABLE usage_alert_settings ENABLE ROW LEVEL SECURITY;

-- Startup admins can manage alerts for their org's clients
CREATE POLICY "startup_manage_usage_alerts" ON usage_alert_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN users u ON u.organization_id = c.organization_id
      WHERE c.id = usage_alert_settings.client_id
        AND u.id = auth.uid()
        AND u.role IN ('startup_admin', 'startup_member')
    )
  );

-- Client users can manage their own alerts
CREATE POLICY "client_manage_own_usage_alerts" ON usage_alert_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.client_id = usage_alert_settings.client_id
        AND u.role IN ('client_admin', 'client_member')
    )
  );
