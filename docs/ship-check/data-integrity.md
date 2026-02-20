# Data Integrity Verification

**Auditor:** data-integrity agent
**Date:** 2026-02-20
**Scope:** All API routes in `src/app/api/` and all Supabase migrations in `supabase/migrations/`

---

## PART 1: API Route Verification

### 1. Authentication Enforcement

| Route | Method(s) | Auth Mechanism | Status |
|-------|-----------|----------------|--------|
| `/api/agents` | GET, POST | `requireAuth` | OK |
| `/api/agents/[id]` | DELETE | `requireAuth` + org check | OK |
| `/api/agents/[id]/config` | GET, PATCH | `requireAuth` | OK |
| `/api/agents/[id]/publish` | POST | `requireAuth` | OK |
| `/api/agents/[id]/knowledge-base` | GET, POST | `requireAuth` + org check | OK |
| `/api/agents/[id]/knowledge-base/[sourceId]` | DELETE | `requireAuth` + org check | OK |
| `/api/agents/[id]/voices` | GET | `requireAuth` | OK |
| `/api/agents/[id]/versions` | GET, POST | `requireAuth` | OK |
| `/api/agents/[id]/chat` | POST | `requireAuth` | OK |
| `/api/agents/create-web-call` | POST | Rate-limited, NO auth | **By design** (public widget) |
| `/api/agents/sync-call` | POST | `requireAuth` | OK |
| `/api/settings` | PATCH | `requireAuth` | OK |
| `/api/solutions` | GET, POST | `requireAuth` | OK |
| `/api/calls` | GET | `requireAuth` | OK |
| `/api/calls` | POST | Rate-limited, NO auth | **By design** (public widget) |
| `/api/business-settings` | GET, PATCH | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/services` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/services/[id]` | PATCH, DELETE | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/faqs` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/faqs/[id]` | PATCH, DELETE | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/policies` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/policies/[id]` | PATCH, DELETE | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/locations` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/locations/[id]` | PATCH, DELETE | `requireAuth` + `getClientId` | OK |
| `/api/business-settings/hours` | GET, PUT | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/status` | GET | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/start` | POST | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/step/[step]` | PATCH | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/create-agent` | POST | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/test-call` | POST | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/test-sms` | POST | `requireAuth` + `getClientId` | OK |
| `/api/onboarding/go-live` | POST | `requireAuth` + `getClientId` | OK |
| `/api/post-call-actions` | GET, PUT | `requireAuth` + `getClientId` | OK |
| `/api/automations/recipes` | GET, POST | `requireAuth` (POST: admin check) | OK |
| `/api/automations/recipes/[id]` | PATCH, DELETE | `requireAuth` + admin check | OK |
| `/api/automations/client` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/automations/client/[id]` | PATCH, DELETE | `requireAuth` + `getClientId` | OK |
| `/api/automations/client/[id]/logs` | GET | `requireAuth` | OK |
| `/api/automations/webhook-test` | POST | `requireAuth` | OK |
| `/api/leads` | GET, POST | `requireAuth` + org check | OK |
| `/api/leads/[id]` | PATCH, DELETE | `requireAuth` + org check | OK |
| `/api/campaigns` | GET, POST | `requireAuth` + org check | OK |
| `/api/campaigns/[id]` | PATCH, DELETE | `requireAuth` + org check | OK |
| `/api/phone-numbers` | GET, POST | `requireAuth` | OK |
| `/api/phone-numbers/caller-id` | PATCH | `requireAuth` | OK |
| `/api/sip-trunks` | GET, POST | `requireAuth` | OK |
| `/api/sip-trunks/[id]` | GET, PATCH, DELETE | `requireAuth` | OK |
| `/api/pii-redaction` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/conversation-flows` | GET, POST | `requireAuth` + `getClientId` | OK |
| `/api/conversation-flows/[id]` | GET, PATCH, DELETE, POST | `requireAuth` + `getClientId` | OK |
| `/api/clients` | GET, POST | `requireAuth` | OK |
| `/api/client/billing` | GET, POST | `requireAuth` | OK |
| `/api/client/plan-access` | GET | `requireAuth` + `getClientId` | OK |
| `/api/oauth/connections` | GET | `requireAuth` + `getClientId` | OK |
| `/api/integrations` | POST, DELETE | `requireAuth` | OK |
| `/api/billing` | POST | `requireAuth` | OK |
| `/api/usage/agent-costs` | GET | `requireAuth` | OK |
| `/api/checkout` | POST | NO auth, service client | **By design** (public checkout) |
| `/api/marketing-checkout` | POST | Rate-limited, NO auth | **By design** (public checkout) |
| `/api/auth` | POST | Various (sign-in uses password) | OK |
| `/api/auth/reset-password` | POST | NO auth, service client | **By design** |
| `/api/demo-call` | POST | NO auth | **By design** (marketing) |
| `/api/contact` | POST | NO auth | **By design** (contact form) |
| `/api/webhooks/stripe` | POST | Stripe signature verification | OK |
| `/api/webhooks/retell` | POST | Retell signature verification | OK |
| `/api/cron/daily-digest` | GET | CRON_SECRET bearer token | OK |

### 2. Response Shape & Error Handling

All routes examined return:
- `NextResponse.json({ error: "..." }, { status: 4xx/5xx })` on error
- Data payload on success
- Consistent use of HTTP status codes (400, 401, 403, 404, 500, 502)

**No issues found.** Error handling is uniform across routes.

### 3. API Route Findings

#### **BLOCKER-1: `agents/[id]/versions` POST references non-existent column `retell_llm_id`**
- **File:** `src/app/api/agents/[id]/versions/route.ts:87`
- **Issue:** The POST handler selects `retell_llm_id` from the `agents` table, but this column does not exist in any migration or in `schema.sql`. The `agents` table has no `retell_llm_id` column.
- **Impact:** The Supabase query will silently ignore the non-existent column (PostgREST returns null for unknown columns in select). The downstream code at line 144 checks `agent.retell_llm_id` which will always be falsy, so the LLM config from the version will never be applied when restoring a version. **Version restore will silently skip LLM config restoration.**
- **Severity:** BLOCKER -- version restore is silently broken for agents using separate LLM objects.

#### **WARNING-1: `leads` route upsert uses `onConflict: "phone,agent_id"` but actual constraint is `UNIQUE(agent_id, phone)`**
- **File:** `src/app/api/leads/route.ts:47`
- **Issue:** The onConflict string is `"phone,agent_id"` but the schema defines `UNIQUE(agent_id, phone)`. PostgREST onConflict is column-name-based and order doesn't matter, so this actually works. However, the column names must match exactly -- `phone` and `agent_id` are both correct column names.
- **Severity:** INFO -- works correctly despite reversed order.

#### **WARNING-2: `phone_numbers` POST inserts columns not in base schema**
- **File:** `src/app/api/phone-numbers/route.ts:32-34`
- **Issue:** The POST handler inserts `caller_id_name`, `caller_id_verified`, and `cnam_status`. These were added by migration `20260216000000_eight_features.sql` via ALTER TABLE. As long as that migration has been applied, this is fine.
- **Severity:** INFO -- depends on migration being applied.

#### **WARNING-3: Stripe webhook inserts `plan_id`, `stripe_customer_id`, `stripe_subscription_id` into `clients` table**
- **File:** `src/app/api/webhooks/stripe/route.ts:150-160`
- **Issue:** These columns were added by migration `20260211130000_add_billing_columns_to_clients.sql`. As long as that migration ran, this is fine.
- **Severity:** INFO -- depends on migration being applied.

#### **WARNING-4: `retell` webhook error log inserts without `organization_id`**
- **File:** `src/app/api/webhooks/retell/route.ts:336-343`
- **Issue:** In the catch block, the error log is inserted without `organization_id`. This is now safe because migration `20260220100001_fix_webhook_logs_nullable_org.sql` made `organization_id` nullable. But the outer event log at line 47 can also have `organizationId = null` (when no agent matches) -- this is also safe post-migration.
- **Severity:** INFO -- properly fixed by today's migration.

#### **INFO-1: `business_faqs`, `business_services`, `business_policies`, `business_locations` tables have `updated_at` column referenced in PATCH routes but no `updated_at` in the CREATE TABLE migration**
- **File:** Multiple `business-settings/*/[id]/route.ts` files
- **Issue:** The PATCH handlers set `updated_at: new Date().toISOString()` but the original `20260211100000_create_business_settings.sql` only has `created_at` on these tables, not `updated_at`. PostgREST will simply store the value if the column exists or silently fail if not. If a later migration added it, it works. If not, the update silently ignores the field.
- **Severity:** WARNING -- `updated_at` column not explicitly added to `business_faqs`, `business_services`, `business_policies`, `business_locations`. The update operations include `updated_at` which will cause a Supabase error if the column doesn't exist. This needs verification against the running database. The `business_settings` table itself DOES have `updated_at`.

---

## PART 2: Schema Verification

### Tables Inventory (from schema.sql + migrations)

| Table | Source |
|-------|--------|
| organizations | schema.sql |
| clients | schema.sql |
| users | schema.sql |
| agents | schema.sql |
| widget_config | schema.sql |
| ai_analysis_config | schema.sql |
| topics | schema.sql |
| campaign_config | schema.sql |
| client_access | schema.sql |
| phone_numbers | schema.sql |
| call_logs | schema.sql |
| solutions | schema.sql |
| client_solutions | schema.sql |
| stripe_connections | schema.sql |
| client_plans | schema.sql |
| pricing_tables | schema.sql |
| agent_templates | schema.sql |
| organization_settings | schema.sql |
| whitelabel_settings | schema.sql |
| email_templates | schema.sql |
| integrations | schema.sql |
| webhook_logs | schema.sql |
| leads | schema.sql |
| campaigns | schema.sql |
| campaign_leads | schema.sql |
| business_settings | migration 20260211100000 |
| business_hours | migration 20260211100000 |
| business_services | migration 20260211100000 |
| business_faqs | migration 20260211100000 |
| business_policies | migration 20260211100000 |
| business_locations | migration 20260211100000 |
| client_onboarding | migration 20260211110000 |
| post_call_actions | migration 20260211140000 |
| automation_recipes | migration 20260211150000 |
| client_automations | migration 20260211150000 |
| automation_logs | migration 20260211150000 |
| oauth_connections | migration 20260211200000 |
| knowledge_base_sources | migration 20260215100000 |
| sip_trunks | migration 20260216000000 |
| pii_redaction_configs | migration 20260216000000 |
| zapier_subscriptions | migration 20260216000000 |
| conversation_flows | migration 20260216000000 |
| plan_addons | migration 20260213200000 |
| client_addons | migration 20260213200000 |

### Column-Level Verification

#### 1. Every table queried by API routes exists: **PASS**
All 44 tables are accounted for across schema.sql and migrations.

#### 2. Column References

##### **BLOCKER-2: `agents.retell_llm_id` does not exist**
- **Referenced in:** `src/app/api/agents/[id]/versions/route.ts:87` (`.select("retell_agent_id, retell_llm_id, ..."`)
- **Actual schema:** The `agents` table has: `id, organization_id, client_id, name, description, platform, retell_agent_id, retell_api_key_encrypted, knowledge_base_id, knowledge_base_name, webhook_url, phone_number, created_at, updated_at`
- **Impact:** Same as BLOCKER-1 above. Version restore LLM config is broken.

##### **WARNING-5: `business_faqs`, `business_services`, `business_policies`, `business_locations` missing `updated_at` column**
- **Defined in:** migration `20260211100000_create_business_settings.sql`
- **Issue:** These four tables only have `created_at` -- no `updated_at` column is defined in ANY migration.
- **Referenced in:** Every PATCH route for these entities sets `updated_at: new Date().toISOString()`.
- **Impact:** If PostgREST does not have this column, the `.update()` call will fail with an error like "column business_faqs.updated_at does not exist". This would cause 500 errors on ALL edit operations for services, FAQs, policies, and locations.
- **Severity:** BLOCKER -- runtime 500 errors on edit operations for business settings sub-entities.

##### **WARNING-6: `business_locations.is_active` referenced in insert but may not exist as queried**
- **File:** `src/app/api/onboarding/create-agent/route.ts:392`
- **Issue:** The seed logic inserts `is_active: true` for business_locations. The migration defines `is_active BOOLEAN DEFAULT true` so this is actually fine.
- **Severity:** INFO -- column exists.

##### **WARNING-7: `business_services.is_active`, `business_faqs.is_active`, `business_policies.is_active` in seed inserts**
- Same as above -- these columns DO exist in the migration. **OK.**

#### 3. NOT NULL Constraint Verification

##### **BLOCKER-3: `agents` INSERT may fail -- `retell_api_key_encrypted` is NOT NULL but may receive null**
- **File:** `src/app/api/agents/route.ts:32`
- **Issue:** The POST handler computes: `retell_api_key_encrypted: (body.retell_api_key || body.retell_api_key_encrypted) ? encrypt(...) : null`
- The schema says: `retell_api_key_encrypted TEXT NOT NULL`
- If neither `retell_api_key` nor `retell_api_key_encrypted` is provided in the request body, this inserts `null` into a NOT NULL column.
- **Impact:** Runtime error on agent creation when no API key is provided. However, the onboarding create-agent flow always provides an encrypted key. The manual creation endpoint (POST /api/agents) could fail if the client doesn't send an API key.
- **Severity:** BLOCKER -- will crash if POST /api/agents is called without an API key in the body.

##### All other NOT NULL columns verified:
- `call_logs.retell_call_id` -- always provided from Retell webhook/sync
- `leads.agent_id`, `leads.phone` -- always provided (validated or required by context)
- `campaigns.agent_id`, `campaigns.name` -- provided in body
- `solutions.organization_id`, `solutions.name` -- provided from user lookup
- `integrations.api_key_encrypted`, `integrations.name`, `integrations.provider` -- validated at top of route
- `automation_recipes.organization_id`, `automation_recipes.name` -- provided from user lookup
- `business_settings.client_id` -- provided from getClientId
- `client_onboarding.client_id` -- provided from getClientId

**All other NOT NULL constraints: PASS**

#### 4. onConflict Clause Verification

| Route | Table | onConflict | Actual Constraint | Status |
|-------|-------|------------|-------------------|--------|
| business-settings/hours PUT | business_hours | `"client_id,day_of_week"` | `UNIQUE(client_id, day_of_week)` | PASS |
| onboarding/step/2 | business_settings | `"client_id"` | `UNIQUE (client_id)` | PASS |
| post-call-actions PUT | post_call_actions | `"client_id,action_type"` | `UNIQUE(client_id, action_type)` | PASS |
| automations/client POST | client_automations | `"client_id,recipe_id"` | `UNIQUE(client_id, recipe_id)` | PASS |
| pii-redaction POST | pii_redaction_configs | `"client_id"` | `UNIQUE(client_id)` | PASS |
| leads POST (bulk) | leads | `"phone,agent_id"` | `UNIQUE(agent_id, phone)` | PASS |
| sync-call POST | call_logs | `"retell_call_id"` | `UNIQUE (retell_call_id)` via index | PASS |
| webhooks/stripe (users upsert) | users | `"id"` | PRIMARY KEY(id) | PASS |
| webhooks/stripe (client_access) | client_access | `"client_id,feature"` | Partial index `idx_client_access_client_feature WHERE agent_id IS NULL` | **See below** |

##### **WARNING-8: `client_access` upsert with `onConflict: "client_id,feature"` uses partial unique index**
- **File:** `src/app/api/webhooks/stripe/route.ts:345-346`
- **Issue:** The upsert passes `agent_id: null` and uses `onConflict: "client_id,feature"`. The migration `20260220200000_fix_client_access_constraint.sql` created a partial unique index `ON client_access (client_id, feature) WHERE agent_id IS NULL`. PostgREST/Supabase upserts with partial unique indexes can be tricky -- the `onConflict` clause maps to `ON CONFLICT (columns)` in SQL, which requires an actual unique constraint, not just a partial index. However, Supabase JS client v2+ handles this correctly with partial indexes if the WHERE condition is met.
- **Severity:** WARNING -- may work in practice but is fragile. If Supabase changes how it handles partial indexes in upserts, this could break.

#### 5. RPC Function Verification

| RPC Call | Function Name | Exists? | Source |
|----------|---------------|---------|--------|
| `supabase.rpc("increment_total_calls", { p_client_id })` | `increment_total_calls` | YES | Migration `20260213100000` (created), `20260218000000` (recreated with fixed search_path) |

**RPC Calls: PASS**

---

## PART 3: Today's Migration Analysis (2026-02-20)

Four new migrations were applied today:

### Migration 1: `20260220000000_fix_onboarding_missing_columns.sql`
- Adds `sms_phone_number`, `chat_widget_deployed`, `sms_phone_configured`, `phone_number` to `client_onboarding`
- **Analysis:** These columns ARE referenced by the go-live route (`/api/onboarding/go-live/route.ts:29-37`) and step 6 route. Previously, writing to these columns would have caused silent failures or errors. **Correct fix.**
- **New mismatches introduced:** NONE

### Migration 2: `20260220100000_fix_client_status_constraint.sql`
- Expands `clients.status` CHECK constraint to include `'cancelled'` and `'past_due'`
- **Analysis:** The Stripe webhook handlers (`handleSubscriptionDeleted`, `handlePaymentFailed`, `handleSubscriptionUpdated`) set these statuses. Previously, these updates would have failed silently. **Correct fix.**
- **New mismatches introduced:** NONE

### Migration 3: `20260220100001_fix_webhook_logs_nullable_org.sql`
- Makes `webhook_logs.organization_id` nullable
- **Analysis:** Stripe webhook events often don't have organization_id in metadata. The Retell webhook error handler also inserts without organization_id. **Correct fix.**
- **New mismatches introduced:** NONE

### Migration 4: `20260220200000_fix_client_access_constraint.sql`
- Deduplicates existing rows and creates partial unique index on `client_access (client_id, feature) WHERE agent_id IS NULL`
- **Analysis:** The Stripe webhook `setClientPermissions` function upserts with `onConflict: "client_id,feature"` where `agent_id: null`. Previously, the only constraint was `UNIQUE(client_id, agent_id, feature)` which requires a non-null agent_id for uniqueness (NULL != NULL in SQL). This partial index enables the upsert to work. **Correct fix.**
- **New mismatches introduced:** NONE -- but the partial index approach has fragility concerns (WARNING-8).

---

## Summary of Findings

### BLOCKERS (3)

| ID | Issue | File | Impact |
|----|-------|------|--------|
| BLOCKER-1/2 | `agents.retell_llm_id` column does not exist | `agents/[id]/versions/route.ts:87` | Version restore silently skips LLM config. Agent version rollback is broken for agents using separate LLM objects. |
| BLOCKER-3 | `agents.retell_api_key_encrypted` is NOT NULL but POST /api/agents can insert null | `agents/route.ts:32` | Manual agent creation via API crashes (500 error) if no API key is provided in request body. |
| BLOCKER-4 | `business_faqs`, `business_services`, `business_policies`, `business_locations` tables lack `updated_at` column | All `business-settings/*/[id]/route.ts` PATCH handlers | ALL edit operations on services, FAQs, policies, and locations will return 500 errors. |

### WARNINGS (3)

| ID | Issue | Severity |
|----|-------|----------|
| WARNING-4 | Retell webhook error log inserts without organization_id | Fixed by today's migration |
| WARNING-5 | `updated_at` missing on business sub-entity tables | Promoted to BLOCKER-4 |
| WARNING-8 | `client_access` upsert relies on partial unique index | Fragile but functional |

### INFO (4)

| ID | Issue |
|----|-------|
| INFO-1 | Leads onConflict column order reversed but functionally equivalent |
| INFO-2 | phone_numbers, clients columns depend on migrations being applied |
| INFO-3 | Today's 4 migrations correctly fix previously-broken behavior |
| INFO-4 | No new mismatches introduced by today's stabilization work |

---

## Verdict

## FAIL

**Reason:** 3 blockers identified. BLOCKER-4 (missing `updated_at` on business sub-entity tables) will cause 500 errors on every edit operation for services, FAQs, policies, and locations -- which are core onboarding and business configuration features. BLOCKER-1/2 means agent version restore is silently broken. BLOCKER-3 means manual agent creation can crash.

**Required before ship:**
1. Add `updated_at TIMESTAMPTZ DEFAULT NOW()` column to `business_faqs`, `business_services`, `business_policies`, `business_locations` (new migration)
2. Either add `retell_llm_id` column to `agents` table, or remove the reference from the versions route and use the LLM ID from the Retell API response instead
3. Make `retell_api_key_encrypted` nullable in the agents table, OR add validation in POST /api/agents to require an API key
