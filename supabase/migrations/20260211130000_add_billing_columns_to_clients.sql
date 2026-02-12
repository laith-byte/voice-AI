-- Add billing-related columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES client_plans(id);

-- Allow client users to read active plans from their org (for billing page)
CREATE POLICY "client_users_read_active_plans" ON client_plans
  FOR SELECT USING (
    is_active = true
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
