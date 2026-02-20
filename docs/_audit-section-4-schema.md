# Audit Section 4: Database Queries vs. Schema Verification

**Auditor**: schema-auditor
**Date**: 2026-02-20
**Scope**: All Supabase queries in `src/` cross-referenced against `supabase/schema.sql` + 31 migration files

---

## Methodology

1. Read `supabase/schema.sql` (base schema) and all 31 migration files in chronological order to build the complete schema state.
2. Searched every `.from()`, `.select()`, `.insert()`, `.update()`, `.upsert()`, `.delete()`, and `.rpc()` call across the entire `src/` directory (462+ Supabase query call sites found).
3. Cross-referenced each query's table name, column references, data types, NOT NULL constraints, foreign keys, and RPC function existence.

---

## Summary

| Category | Count |
|----------|-------|
| Critical (will cause runtime errors) | 5 |
| High (will cause silent data issues or constraint violations) | 4 |
| Medium (schema drift / allowlist mismatch) | 4 |
| Low (TypeScript type drift from schema) | 6 |
| **Total findings** | **19** |

---

## Critical Issues

### C-1. RPC function `increment_field` does not exist in any migration

**File**: `src/app/api/onboarding/test-call/route.ts:43`
**Query**:
```ts
await supabase.rpc("increment_field", {
  table_name: "client_onboarding",
  field_name: "test_calls_used",
  row_client_id: clientId,
});
```
**Schema reality**: No function named `increment_field` exists in any migration. The only RPC function defined is `increment_total_calls(p_client_id UUID)` (created in `20260213100000_add_test_scenarios_and_post_golive.sql`).

**Impact**: This RPC call always fails. The code has a fallback (`if (incrementError)`) that does a manual SELECT + UPDATE, so the feature still works -- but the RPC failure generates a console error on every test call and wastes a round-trip.

---

### C-2. `users` table insert missing NOT NULL `name` column (Stripe webhook)

**File**: `src/app/api/webhooks/stripe/route.ts:304`
**Query**:
```ts
await supabase.from("users").upsert({
  id: userId,
  email,
  organization_id: orgId,
  client_id: clientId,
  role: "client_admin",
}, { onConflict: "id" });
```
**Schema reality**: The `users` table has `name TEXT NOT NULL`. This upsert does not provide a `name` value.

**Impact**: For new user rows (INSERT path of upsert), this will fail with a NOT NULL constraint violation. Existing users (UPDATE path) would not be affected since `name` already has a value. This means new clients provisioned via Stripe checkout who don't already have a user row will fail to get their user record created.

---

### C-3. `users` table insert missing NOT NULL `name` column (auth invite)

**File**: `src/app/api/auth/route.ts:134-144`
**Query**:
```ts
await serviceClient.from("users").upsert({
  id: inviteData.user.id,
  email: email,
  organization_id: organization_id,
  role: role,
}, { onConflict: "id" });
```
**Schema reality**: Same issue as C-2. The `name TEXT NOT NULL` column is not provided.

**Impact**: Team member invitations will fail to create the user row if it doesn't already exist. The invite link will work (auth user exists) but the user will have no matching row in the `users` table, causing the middleware user lookup to fail.

---

### C-4. `client_access` upsert uses non-existent unique constraint

**File**: `src/app/api/webhooks/stripe/route.ts:343-344`
**Query**:
```ts
await supabase.from("client_access").upsert(rows, {
  onConflict: "client_id,feature",
});
```
**Also in**: `src/app/(startup)/clients/[id]/client-access/page.tsx:182`
```ts
.upsert(upserts, { onConflict: "client_id,feature" })
```
**Schema reality**: The `client_access` table's unique constraint is `UNIQUE(client_id, agent_id, feature)` -- a 3-column constraint. The upsert specifies `onConflict: "client_id,feature"` which is a 2-column combination that has no unique index.

**Impact**: The upsert will always perform INSERT (never UPDATE), potentially creating duplicate rows with different `agent_id` values (NULL vs actual). If there are already rows with matching `(client_id, NULL, feature)`, Postgres may raise a conflict error. This is the permission-setting code path -- failure means new clients from Stripe checkout don't get their feature access configured.

---

### C-5. `webhook_logs` insert without `organization_id` (error logging path)

**File**: `src/app/api/webhooks/retell/route.ts:336`
**Query**:
```ts
await supabase.from("webhook_logs").insert({
  event: "error",
  raw_payload: { error: String(error) },
  import_result: "failed",
  timestamp: new Date().toISOString(),
});
```
**Schema reality**: After migration `20260220100001_fix_webhook_logs_nullable_org.sql`, `organization_id` was made nullable. However, this was a recent fix. The query is now valid.

**Status**: This was a bug that was already fixed by the migration. **No current issue** -- downgrading this. (Keeping note for documentation completeness.)

*Revised Critical count: 4 active critical issues.*

---

## High-Severity Issues

### H-1. `business_settings` PATCH allowlist references non-existent columns

**File**: `src/app/api/business-settings/route.ts:54-63`
**Allowlist**:
```ts
const ALLOWED_FIELDS = [
  "business_name", "contact_email", "contact_phone", "website_url",
  "address", "city", "state", "zip", "country", "timezone",
  "description", "industry", "greeting_message", "after_hours_message",
  "voicemail_message", "hold_message", "transfer_message",
  "business_hours", "logo_url", "primary_color", "language",
  "after_hours_behavior", "unanswerable_behavior", "escalation_phone",
  "max_call_duration_minutes", "post_call_email", "post_call_log",
  "post_call_text",
];
```
**Schema reality** (business_settings table columns):
- `business_name` -- EXISTS
- `contact_email` -- EXISTS (as `contact_email`)
- `contact_phone` -- DOES NOT EXIST (actual column: `business_phone`)
- `website_url` -- DOES NOT EXIST (actual column: `business_website`)
- `address` -- DOES NOT EXIST (actual column: `business_address`)
- `city` -- DOES NOT EXIST
- `state` -- DOES NOT EXIST
- `zip` -- DOES NOT EXIST
- `country` -- DOES NOT EXIST
- `timezone` -- EXISTS
- `description` -- DOES NOT EXIST
- `industry` -- DOES NOT EXIST
- `greeting_message` -- DOES NOT EXIST
- `after_hours_message` -- DOES NOT EXIST
- `voicemail_message` -- DOES NOT EXIST
- `hold_message` -- DOES NOT EXIST
- `transfer_message` -- DOES NOT EXIST
- `business_hours` -- DOES NOT EXIST (this is a separate table)
- `logo_url` -- DOES NOT EXIST
- `primary_color` -- DOES NOT EXIST
- `language` -- DOES NOT EXIST
- `after_hours_behavior` -- EXISTS
- `unanswerable_behavior` -- EXISTS
- `escalation_phone` -- EXISTS
- `max_call_duration_minutes` -- EXISTS
- `post_call_email` -- EXISTS
- `post_call_log` -- EXISTS
- `post_call_text` -- EXISTS

**Missing from allowlist** (columns that exist but aren't listed):
- `contact_name`
- `chat_welcome_message`
- `chat_offline_behavior`

**Impact**: 16 of 28 allowlisted field names do not correspond to actual columns. When users try to update these via the PATCH endpoint, Supabase will silently ignore the non-existent columns (the update succeeds but the data isn't saved). The fields `contact_phone`, `website_url`, and `address` are particularly problematic as users may expect these to save but they map to different column names (`business_phone`, `business_website`, `business_address`).

---

### H-2. `post_call_email_summary` and `post_call_followup_text` written to `business_settings` but don't exist there

**File**: `src/app/api/onboarding/step/[step]/route.ts:113-115`
**Query** (step 4 handler writes to `business_settings`):
```ts
if (body.post_call_email_summary !== undefined)
  callSettingsPayload.post_call_email_summary = body.post_call_email_summary;
if (body.post_call_followup_text !== undefined)
  callSettingsPayload.post_call_followup_text = body.post_call_followup_text;
```
**Schema reality**: `business_settings` has `post_call_email BOOLEAN` and `post_call_text BOOLEAN`, not `post_call_email_summary` or `post_call_followup_text`. These column names only exist on the `client_onboarding` table.

**Impact**: The Supabase update to `business_settings` with these non-existent column names will cause the update to fail (Postgres will reject unknown columns), returning a 500 error for step 4 saves during onboarding.

---

### H-3. `contact_name` field written to `business_settings` but not in upsert on step 2

**File**: `src/app/api/onboarding/step/[step]/route.ts:66-77`
**Query** (step 2 upsert to business_settings):
```ts
const settingsPayload = {
  client_id: clientId,
  business_name: body.business_name || null,
  business_phone: body.business_phone || null,
  business_website: body.business_website || null,
  business_address: body.business_address || null,
  updated_at: now,
};
```
**Schema reality**: The `business_settings` table has `contact_name` and `contact_email` columns, and the onboarding step 2 body includes `contact_name` and `contact_email`. However, these fields are only saved to the `client_onboarding` record (line 62-63), not to `business_settings`.

**Impact**: After onboarding, `business_settings.contact_name` and `business_settings.contact_email` remain NULL. The prompt generator and post-call actions read from `business_settings`, so contact info collected during onboarding is effectively lost for those features.

---

### H-4. TypeScript `Client` type missing status values `cancelled` and `past_due`

**File**: `src/types/database.ts:32`
```ts
status: "active" | "inactive" | "suspended";
```
**Schema reality**: After migration `20260220100000_fix_client_status_constraint.sql`, the valid values are `('active', 'inactive', 'suspended', 'cancelled', 'past_due')`.

**Impact**: TypeScript code using the `Client` type would get type errors if it tries to handle `cancelled` or `past_due` statuses. Since most queries use `any` casts, the runtime impact is limited, but it indicates drift between types and schema.

---

## Medium-Severity Issues

### M-1. TypeScript `WebhookLog` type has non-nullable `organization_id`

**File**: `src/types/database.ts:356`
```ts
organization_id: string;
```
**Schema reality**: After migration `20260220100001_fix_webhook_logs_nullable_org.sql`, `organization_id` can be NULL.

**Impact**: Code reading webhook logs could throw TypeScript errors when `organization_id` is null, or code creating webhook logs might incorrectly assume this field is required.

---

### M-2. TypeScript `Client` type missing columns added by migrations

**File**: `src/types/database.ts:27-38`

Missing columns:
- `dashboard_color TEXT` (added by `20260210050000_add_dashboard_color_to_clients.sql`)
- `stripe_customer_id TEXT` (added by `20260211130000_add_billing_columns_to_clients.sql`)
- `stripe_subscription_id TEXT` (added by same migration)
- `plan_id UUID` (added by same migration)

**Impact**: TypeScript consumers of the `Client` type won't have these properties typed, requiring casts or `any` to access them.

---

### M-3. TypeScript `AgentTemplate` type missing all migration-added columns

**File**: `src/types/database.ts:288-297`

Missing columns (all added by various migrations):
- `vertical TEXT`
- `prompt_template TEXT`
- `default_services JSONB`
- `default_faqs JSONB`
- `default_policies JSONB`
- `icon TEXT`
- `wizard_enabled BOOLEAN`
- `industry TEXT`
- `use_case TEXT`
- `industry_icon TEXT`
- `use_case_icon TEXT`
- `use_case_description TEXT`
- `default_hours JSONB`
- `test_scenarios JSONB`

**Impact**: The onboarding wizard and template pages query all these columns extensively. Since they use `any` casts, no runtime error occurs, but the types are significantly out of date.

---

### M-4. TypeScript `PhoneNumber` type missing caller ID columns

**File**: `src/types/database.ts:123-132`

Missing columns (added by `20260216000000_eight_features.sql`):
- `caller_id_name TEXT`
- `caller_id_verified BOOLEAN`
- `cnam_status TEXT`

**Impact**: The caller ID feature in `src/app/api/phone-numbers/caller-id/route.ts` writes to these columns. Works at runtime due to `any` casts, but types are incomplete.

---

## Low-Severity Issues (TypeScript Type Drift)

### L-1. `Agent` type missing `phone_number` column
**File**: `src/types/database.ts:40-54`
**Added by**: `20260215100000_sms_kb_multilang.sql` -- `ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone_number TEXT`

### L-2. No TypeScript types for tables created after initial schema
Missing types entirely for:
- `business_settings`
- `business_hours`
- `business_services`
- `business_faqs`
- `business_policies`
- `business_locations`
- `client_onboarding`
- `post_call_actions`
- `automation_recipes`
- `client_automations`
- `automation_logs`
- `oauth_connections`
- `knowledge_base_sources`
- `sip_trunks`
- `pii_redaction_configs`
- `zapier_subscriptions`
- `conversation_flows`
- `plan_addons`
- `client_addons`

### L-3. `ClientPlan` type missing feature-gate columns from `20260216000000_eight_features.sql`
Missing: `branded_caller_id`, `verified_caller_id`, `sip_trunking`, `pii_redaction`, `calendly_integration`, `zapier_integration`, `conversation_flows`

### L-4. `automation_recipes` columns `execution_type` and `provider` not reflected in any type
**Added by**: `20260211200000_oauth_integrations.sql`

### L-5. `client_onboarding` columns from recent bugfix migration not reflected in any type
**Added by**: `20260220000000_fix_onboarding_missing_columns.sql` -- `sms_phone_number`, `chat_widget_deployed`, `sms_phone_configured`, `phone_number`

### L-6. `client_onboarding.language` column not reflected in any type
**Added by**: `20260215100000_sms_kb_multilang.sql`

---

## Schema Drift Analysis (Bugfix Migrations)

The following recent bugfix migrations (Feb 20) corrected schema issues that were causing runtime failures:

| Migration | What it fixed | Still referenced in code? |
|-----------|--------------|--------------------------|
| `20260220000000_fix_onboarding_missing_columns.sql` | Added `sms_phone_number`, `chat_widget_deployed`, `sms_phone_configured`, `phone_number` to `client_onboarding` | Yes -- `go-live/route.ts` and `step/[step]/route.ts` write all four columns |
| `20260220100000_fix_client_status_constraint.sql` | Expanded status CHECK to include `cancelled`, `past_due` | Yes -- `webhooks/stripe/route.ts` writes both values |
| `20260220100001_fix_webhook_logs_nullable_org.sql` | Made `organization_id` nullable | Yes -- error-path webhook log insert omits `organization_id` |

All three bugfix migrations are consistent with the code that depends on them.

---

## Tables Verified (No Issues Found)

The following tables had all queries verified as matching the schema:

- `organizations` -- all SELECT/UPDATE queries reference valid columns
- `agents` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `call_logs` -- all INSERT/UPDATE/SELECT queries valid (including `status: "in_progress"` which has no CHECK constraint, so any string is valid)
- `widget_config` -- all INSERT/SELECT/UPDATE queries valid
- `ai_analysis_config` -- all INSERT/SELECT/UPDATE queries valid
- `topics` -- all INSERT/SELECT/DELETE queries valid
- `campaign_config` -- all SELECT/UPDATE queries valid
- `phone_numbers` -- all INSERT/SELECT/UPDATE queries valid (including new caller_id columns)
- `solutions` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `stripe_connections` -- all INSERT/SELECT/UPDATE/UPSERT queries valid
- `client_plans` -- all INSERT/SELECT/UPDATE queries valid
- `pricing_tables` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `organization_settings` -- all INSERT/SELECT/UPDATE queries valid
- `whitelabel_settings` -- all SELECT/UPDATE queries valid
- `email_templates` -- all SELECT/INSERT/UPDATE queries valid
- `integrations` -- all INSERT/SELECT/DELETE queries valid
- `leads` -- all INSERT/SELECT/UPDATE/DELETE/UPSERT queries valid
- `campaigns` -- all INSERT/SELECT/UPDATE queries valid
- `campaign_leads` -- no direct queries found (managed through campaigns)
- `business_hours` -- all INSERT/SELECT/UPSERT queries valid
- `business_services` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `business_faqs` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `business_policies` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `business_locations` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `client_onboarding` -- all INSERT/SELECT/UPDATE queries valid (after bugfix migration)
- `post_call_actions` -- all SELECT/UPSERT queries valid
- `automation_recipes` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `client_automations` -- all SELECT/UPSERT/UPDATE queries valid
- `automation_logs` -- all INSERT/SELECT queries valid
- `oauth_connections` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `knowledge_base_sources` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `sip_trunks` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `pii_redaction_configs` -- all INSERT/SELECT/UPDATE queries valid
- `zapier_subscriptions` -- all INSERT/SELECT/DELETE queries valid
- `conversation_flows` -- all INSERT/SELECT/UPDATE/DELETE queries valid
- `plan_addons` -- all SELECT queries valid
- `client_addons` -- all SELECT queries valid
- `client_solutions` -- all INSERT/SELECT/DELETE queries valid

---

## RPC Functions Verified

| Function | Defined in Migration | Called from Code | Match? |
|----------|---------------------|-----------------|--------|
| `increment_total_calls(p_client_id UUID)` | `20260213100000_add_test_scenarios_and_post_golive.sql` | `src/app/api/webhooks/retell/route.ts:235` | YES |
| `increment_field(table_name, field_name, row_client_id)` | **NONE** | `src/app/api/onboarding/test-call/route.ts:43` | **NO -- C-1** |
| `get_user_org_id()` | `20260210032700_fix_users_rls_recursion.sql` | Used in RLS policies only | N/A |
| `is_startup_user()` | Same migration | Used in RLS policies only | N/A |
| `get_user_client_id()` | `20260210060000_client_users_read_own_client.sql` | Used in RLS policies only | N/A |

---

## Recommendations (Priority Order)

1. **C-2/C-3**: Add `name` field to user upserts in Stripe webhook and auth invite routes (use email prefix or "New Member" as default)
2. **C-1**: Replace `increment_field` RPC call with direct `increment_total_calls` or remove the RPC attempt entirely (the fallback works)
3. **C-4**: Either create a partial unique index `UNIQUE(client_id, feature) WHERE agent_id IS NULL` on `client_access`, or change the upsert to include `agent_id: null` and use the existing 3-column constraint
4. **H-1**: Align the `business_settings` PATCH allowlist with actual column names
5. **H-2**: Fix column name mapping: `post_call_email_summary` -> `post_call_email`, `post_call_followup_text` -> `post_call_text` when writing to `business_settings`
6. **H-3**: Include `contact_name` and `contact_email` in the step 2 business_settings upsert
7. **H-4/M-1-4/L-1-6**: Update TypeScript types in `src/types/database.ts` to match current schema
