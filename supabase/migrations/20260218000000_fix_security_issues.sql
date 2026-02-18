-- =============================================================================
-- Fix all 8 Supabase Security Advisor issues
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ERROR 1: Enable RLS on campaign_config
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.campaign_config ENABLE ROW LEVEL SECURITY;

-- Startup users: full access to campaign_config in their org (via agents → clients → org)
CREATE POLICY "startup_manage_campaign_config" ON public.campaign_config
  FOR ALL USING (
    public.is_startup_user()
    AND agent_id IN (
      SELECT a.id FROM public.agents a
        JOIN public.clients c ON a.client_id = c.id
       WHERE c.organization_id = public.get_user_org_id()
    )
  );

-- Client users: read-only access to their own agent's campaign config
CREATE POLICY "client_read_own_campaign_config" ON public.campaign_config
  FOR SELECT USING (
    agent_id IN (
      SELECT a.id FROM public.agents a
       WHERE a.client_id = public.get_user_client_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ERROR 2: Enable RLS on client_solutions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.client_solutions ENABLE ROW LEVEL SECURITY;

-- Startup users: full access to client_solutions in their org
CREATE POLICY "startup_manage_client_solutions" ON public.client_solutions
  FOR ALL USING (
    public.is_startup_user()
    AND client_id IN (
      SELECT id FROM public.clients WHERE organization_id = public.get_user_org_id()
    )
  );

-- Client users: read their own solutions
CREATE POLICY "client_read_own_solutions" ON public.client_solutions
  FOR SELECT USING (
    client_id = public.get_user_client_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- WARNING 1-4: Fix mutable search_path on all 4 functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix get_user_org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id() RETURNS UUID AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Fix is_startup_user
CREATE OR REPLACE FUNCTION public.is_startup_user() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role LIKE 'startup_%')
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Fix get_user_client_id
CREATE OR REPLACE FUNCTION public.get_user_client_id() RETURNS UUID AS $$
  SELECT client_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Fix increment_total_calls
CREATE OR REPLACE FUNCTION public.increment_total_calls(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.client_onboarding
  SET total_calls_since_live = COALESCE(total_calls_since_live, 0) + 1
  WHERE client_id = p_client_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- WARNING 5: Fix overly permissive RLS on zapier_subscriptions
-- Replace USING (true) with proper org-scoped policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role manages Zapier subs" ON public.zapier_subscriptions;

-- Startup users: full access to zapier subscriptions in their org
CREATE POLICY "startup_manage_zapier_subs" ON public.zapier_subscriptions
  FOR ALL USING (
    public.is_startup_user()
    AND client_id IN (
      SELECT id FROM public.clients WHERE organization_id = public.get_user_org_id()
    )
  );

-- Client users: read their own zapier subscriptions
CREATE POLICY "client_read_own_zapier_subs" ON public.zapier_subscriptions
  FOR SELECT USING (
    client_id = public.get_user_client_id()
  );

-- Service role bypasses RLS by default, so no explicit policy needed for it
