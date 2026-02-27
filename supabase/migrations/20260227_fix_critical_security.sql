-- CRITICAL-03: Fix make_subscriptions RLS (replace USING(true) with org-scoped policies)
DROP POLICY IF EXISTS "Service role manages Make subs" ON public.make_subscriptions;

CREATE POLICY "startup_manage_make_subs" ON public.make_subscriptions
  FOR ALL USING (
    public.is_startup_user()
    AND client_id IN (
      SELECT id FROM public.clients WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "client_read_own_make_subs" ON public.make_subscriptions
  FOR SELECT USING (
    client_id = public.get_user_client_id()
  );

-- CRITICAL-04: Fix n8n_subscriptions RLS (replace USING(true) with org-scoped policies)
DROP POLICY IF EXISTS "Service role manages n8n subs" ON public.n8n_subscriptions;

CREATE POLICY "startup_manage_n8n_subs" ON public.n8n_subscriptions
  FOR ALL USING (
    public.is_startup_user()
    AND client_id IN (
      SELECT id FROM public.clients WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "client_read_own_n8n_subs" ON public.n8n_subscriptions
  FOR SELECT USING (
    client_id = public.get_user_client_id()
  );

-- CRITICAL-05: Add RLS policies to agent_call_handling (RLS already enabled, but no policies)
CREATE POLICY "startup_manage_agent_call_handling" ON public.agent_call_handling
  FOR ALL USING (
    public.is_startup_user()
    AND client_id IN (
      SELECT id FROM public.clients WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "client_read_own_agent_call_handling" ON public.agent_call_handling
  FOR SELECT USING (
    client_id = public.get_user_client_id()
  );

-- CRITICAL-08: Restrict increment_total_calls to service_role only
-- This RPC is called from the Retell webhook handler which uses createServiceClient()
-- (bypasses RLS, no auth.uid()). Adding auth.uid() checks would break the webhook call.
REVOKE EXECUTE ON FUNCTION public.increment_total_calls FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_total_calls TO service_role;

-- CRITICAL-01: Add allowed_origins column to widget_config for origin validation
ALTER TABLE public.widget_config ADD COLUMN IF NOT EXISTS allowed_origins TEXT[] DEFAULT NULL;
