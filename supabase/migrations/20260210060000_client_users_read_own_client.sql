-- Allow client users to read and update their own client record
-- This enables: sidebar client name display, dashboard color loading/saving

-- Helper function to get the current user's client_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_client_id() RETURNS UUID AS $$
  SELECT client_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Client users can read their own client record
CREATE POLICY "client_read_own" ON clients FOR SELECT USING (
    id = public.get_user_client_id()
);

-- Client admins can update their own client record (e.g. dashboard_color)
CREATE POLICY "client_admin_update_own" ON clients FOR UPDATE USING (
    id = public.get_user_client_id()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'client_admin')
);
