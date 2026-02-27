# Migration Rollback Guide

## General Strategy

Supabase migrations are forward-only by default. Rollbacks must be performed manually. Follow these principles:

1. **Always back up** before running migrations in production
2. **Test rollbacks** in staging before applying to production
3. **Additive migrations are safe** — adding columns/tables rarely needs rollback
4. **Destructive migrations need care** — dropping columns, renaming, or changing types require data preservation

## Rollback Patterns

### Adding a column
```sql
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
```

### Adding a table
```sql
DROP TABLE IF EXISTS table_name CASCADE;
```

### Adding an index
```sql
DROP INDEX IF EXISTS index_name;
```

### Adding RLS policies
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

### Renaming a column
```sql
ALTER TABLE table_name RENAME COLUMN new_name TO old_name;
```

## Recent Migration Rollbacks

Below are reverse SQL statements for recent critical migrations. Run these in order (newest first) to roll back.

### `20260227_fix_medium_security.sql`

This migration added two `SECURITY DEFINER` functions and a performance index.

```sql
-- Revert MEDIUM-19: Drop performance index
DROP INDEX IF EXISTS idx_call_logs_agent_date;

-- Revert MEDIUM-09: Drop atomic test call counter
DROP FUNCTION IF EXISTS increment_test_calls_used(UUID);

-- Revert MEDIUM-02: Drop atomic automation counter
DROP FUNCTION IF EXISTS increment_automation_counter(UUID, TEXT);
```

### `20260227_fix_critical_security.sql`

This migration replaced overly-permissive RLS policies with org-scoped ones, added RLS policies to `agent_call_handling`, restricted `increment_total_calls` to `service_role`, added `allowed_origins` to `widget_config`, and replaced public plan_addons read policy.

```sql
-- Revert HIGH-11: Restore public read on plan_addons
DROP POLICY IF EXISTS "authenticated_read_plan_addons" ON public.plan_addons;
CREATE POLICY "public_read_plan_addons" ON public.plan_addons
  FOR SELECT USING (true);

-- Revert CRITICAL-01: Remove allowed_origins column from widget_config
ALTER TABLE public.widget_config DROP COLUMN IF EXISTS allowed_origins;

-- Revert CRITICAL-08: Restore public/anon/authenticated execute on increment_total_calls
GRANT EXECUTE ON FUNCTION public.increment_total_calls TO public, anon, authenticated;

-- Revert CRITICAL-05: Drop agent_call_handling policies
DROP POLICY IF EXISTS "startup_manage_agent_call_handling" ON public.agent_call_handling;
DROP POLICY IF EXISTS "client_read_own_agent_call_handling" ON public.agent_call_handling;

-- Revert CRITICAL-04: Restore original n8n_subscriptions policy
DROP POLICY IF EXISTS "startup_manage_n8n_subs" ON public.n8n_subscriptions;
DROP POLICY IF EXISTS "client_read_own_n8n_subs" ON public.n8n_subscriptions;
CREATE POLICY "Service role manages n8n subs"
  ON n8n_subscriptions FOR ALL USING (true);

-- Revert CRITICAL-03: Restore original make_subscriptions policy
DROP POLICY IF EXISTS "startup_manage_make_subs" ON public.make_subscriptions;
DROP POLICY IF EXISTS "client_read_own_make_subs" ON public.make_subscriptions;
CREATE POLICY "Service role manages Make subs"
  ON make_subscriptions FOR ALL USING (true);
```

> **WARNING**: Rolling back the critical security migration restores the overly-permissive
> `USING(true)` policies on `make_subscriptions` and `n8n_subscriptions`, removes org-scoped
> restrictions on `plan_addons`, and re-grants public execute on `increment_total_calls`.
> Only roll back if there is a functional regression — these security fixes should stay in
> production whenever possible.

### `20260225230954_add_first_message_template.sql`

```sql
ALTER TABLE agent_templates DROP COLUMN IF EXISTS first_message_template;
```

### `20260225000000_add_flow_templates_to_agent_templates.sql`

```sql
ALTER TABLE agent_templates DROP COLUMN IF EXISTS default_flow_nodes;
ALTER TABLE agent_templates DROP COLUMN IF EXISTS agent_name;
```
