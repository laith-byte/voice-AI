# Build, Security & Ship-Readiness Audit

**Date:** 2026-02-22
**Auditor:** Build/Security/Ship-Readiness Agent
**Scope:** Full codebase build verification, security sweep, dependency audit, and production readiness check

---

## 1. Build Verification

### 1.1 `npm run build` — PASS
- **Result:** Compiled successfully (Next.js 16.1.6 Turbopack)
- **Errors:** 0
- **Warnings:** 1 (non-blocking: "middleware" file convention deprecation notice recommending migration to "proxy")
- **Static pages generated:** 153/153
- **All routes compiled without error**

### 1.2 `npm test` — PASS
- **Result:** 7 test files, 99 tests, all passing
- **Test files:**
  - `hvac-templates.test.ts` (15 tests)
  - `transcript-extraction.test.ts` (28 tests)
  - `service-mapper.test.ts` (11 tests)
  - `housecallpro.test.ts` (13 tests)
  - `jobber.test.ts` (16 tests)
  - `integration-events.test.ts` (6 tests)
  - `integration-retry.test.ts` (10 tests)
- **Duration:** 2.86s

### 1.3 TypeScript Strict Mode — PASS
- `tsconfig.json` has `"strict": true` enabled
- Build completed with zero type errors

---

## 2. Code Quality Sweep

### 2.1 TODO / FIXME / HACK Comments — PASS
- **Result:** Zero occurrences found in `src/`

### 2.2 `console.log` in Production Code — PASS (with notes)
- **Result:** 12 occurrences found, all in appropriate contexts:
  - `src/lib/twilio.ts:17` — Graceful degradation log when Twilio is not configured (acceptable)
  - `src/app/api/webhooks/stripe/route.ts` — 10 occurrences for provisioning/billing flow logging (standard webhook debugging, all log operational info not secrets)
  - `src/app/api/agents/[id]/conversation-flow/route.ts:625` — Single log statement
- **No `console.log` in any new HCP/Jobber integration files** (they use `console.error` for error paths only, which is correct)
- **No sensitive data (tokens, keys, passwords) logged anywhere** — verified with targeted grep

### 2.3 Hardcoded API Keys or Secrets — PASS
- **Result:** Zero matches for `sk_live`, `sk_test`, `pk_live`, `pk_test`, `AKIA`, `AIza`, `ghp_`, `npm_`, `xox[bop]-` patterns
- All secrets accessed via `process.env.*`

### 2.4 Placeholder URLs (`localhost`, `example.com`, `127.0.0.1`) — PASS
- **`example.com`** — All occurrences are in UI placeholder text (`placeholder="you@example.com"`, `placeholder="https://api.example.com/endpoint"`) or test files. Acceptable.
- **`localhost` / `127.0.0.1`** — Found only in:
  - `src/app/api/automations/webhook-test/route.ts:51-52` — SSRF protection blocklist (correct usage)
  - `.env.example:94` — `NEXT_PUBLIC_APP_URL=http://localhost:3000` (expected default)
  - Test files (expected)

### 2.5 `as any` Type Assertions in New Files — PASS
- **Result:** Zero `as any` in any new integration files checked:
  - `src/lib/oauth/` — 0
  - `src/app/api/tools/housecallpro/` — 0
  - `src/app/api/tools/jobber/` — 0
  - `src/app/api/integrations/` — 0
  - `src/app/api/webhooks/housecallpro/` — 0
  - `src/app/api/webhooks/jobber/` — 0
  - `src/app/api/cron/retry-queue/` — 0

### 2.6 Large Commented-Out Code Blocks — PASS
- **Result:** No multi-line commented-out code blocks found in new files

---

## 3. Environment Variables

### 3.1 HCP/Jobber Env Vars via `process.env` — PASS
- `HOUSECALLPRO_CLIENT_ID` — referenced in `src/lib/oauth/providers.ts:89`
- `HOUSECALLPRO_CLIENT_SECRET` — referenced in `src/lib/oauth/providers.ts:90`
- `JOBBER_CLIENT_ID` — referenced in `src/lib/oauth/providers.ts:97`
- `JOBBER_CLIENT_SECRET` — referenced in `src/lib/oauth/providers.ts:98`
- All accessed via `process.env.*`, no hardcoded values

### 3.2 `.env.example` Documentation — FAIL
- **Issue:** `.env.example` does **not** include the following new environment variables:
  - `HOUSECALLPRO_CLIENT_ID`
  - `HOUSECALLPRO_CLIENT_SECRET`
  - `JOBBER_CLIENT_ID`
  - `JOBBER_CLIENT_SECRET`
- **Impact:** Developers cloning the repo will not know these variables are needed
- **Fix:** Add these four variables to `.env.example` under a new "OAuth -- Housecall Pro" and "OAuth -- Jobber" section

### 3.3 Webhook Secrets — FAIL (advisory)
- **Issue:** No `HOUSECALLPRO_WEBHOOK_SECRET` or `JOBBER_WEBHOOK_SECRET` environment variables exist anywhere in the codebase
- **Impact:** Webhook endpoints cannot validate incoming requests (see Security section 4.4)
- **Fix:** Add webhook secret env vars and implement signature verification when HCP/Jobber provide webhook signing

### 3.4 No Hardcoded Secrets — PASS
- All credentials accessed exclusively through `process.env`

---

## 4. Security Audit on New Routes

### 4.1 Retell Tool Routes (`/api/tools/housecallpro/*`, `/api/tools/jobber/*`) — PASS
All 8 tool routes verify `RETELL_TOOLS_API_KEY` via Bearer token in the Authorization header:

| Route | Auth Check | Input Validation |
|-------|-----------|-----------------|
| `/api/tools/housecallpro/lookup` | PASS | PASS — requires `client_id`, `caller_phone_number` |
| `/api/tools/housecallpro/availability` | PASS | PASS — requires `client_id`, `date` |
| `/api/tools/housecallpro/book` | PASS | PASS — requires 6 fields |
| `/api/tools/housecallpro/create-estimate` | PASS | PASS — requires 4 fields |
| `/api/tools/jobber/lookup` | PASS | PASS — requires `client_id`, `caller_phone_number` |
| `/api/tools/jobber/availability` | PASS | PASS — requires `client_id`, `date` |
| `/api/tools/jobber/book` | PASS | PASS — requires 6 fields |
| `/api/tools/jobber/create-quote` | PASS | PASS — requires 4 fields |

### 4.2 Integration Routes (`/api/integrations/*`) — PASS
All 4 integration routes call `requireAuth()` and check the return:

| Route | Auth Check |
|-------|-----------|
| `/api/integrations` (POST, DELETE) | PASS — `requireAuth()` |
| `/api/integrations/events` (GET) | PASS — `requireAuth()` + `getClientId()` |
| `/api/integrations/service-mappings` (GET, POST, DELETE) | PASS — `requireAuth()` + `getClientId()` |
| `/api/integrations/recent-syncs` (GET) | PASS — `requireAuth()` + `getClientId()` |

### 4.3 Cron Route (`/api/cron/retry-queue`) — PASS
- Verifies `CRON_SECRET` via Bearer token in Authorization header
- Returns 401 if secret is missing or mismatched

### 4.4 Webhook Routes (`/api/webhooks/*`) — FAIL

| Route | Signature Verification | Notes |
|-------|----------------------|-------|
| `/api/webhooks/retell` | PASS | Uses `Retell.verify()` with `x-retell-signature` |
| `/api/webhooks/stripe` | PASS | Uses `constructWebhookEvent()` with `stripe-signature` |
| `/api/webhooks/housecallpro` | **FAIL** | No signature verification at all — any party can POST |
| `/api/webhooks/jobber` | **FAIL** | No signature verification at all — any party can POST |

**Additional HCP webhook bug:** The HCP webhook route inserts into `integration_events` without providing `client_id`, but the column has a `NOT NULL` constraint. This means **every HCP webhook event will fail to insert** and the error is silently swallowed (the catch block still returns 200).

### 4.5 GraphQL Injection — FAIL

**Critical finding in Jobber routes.** User-supplied input is interpolated directly into GraphQL query strings without sanitization or use of GraphQL variables:

| File | Line | Vulnerable Code |
|------|------|----------------|
| `src/app/api/tools/jobber/lookup/route.ts` | 28 | `clients(searchTerm: "${caller_phone_number}")` |
| `src/app/api/tools/jobber/availability/route.ts` | 32 | `filter: { startAt: { gte: "${startOfDay}" }, endAt: { lte: "${endOfDay}" } }` |
| `src/app/api/tools/jobber/book/route.ts` | 29 | `clients(searchTerm: "${customer_phone}")` |
| `src/app/api/tools/jobber/create-quote/route.ts` | 29 | `clients(searchTerm: "${customer_phone}")` |
| `src/lib/oauth/executors/jobber.ts` | 81 | `clients(searchTerm: "${phone}")` |

**Risk:** An attacker who can influence the `caller_phone_number` or `date` values (which come from the request body) could craft a payload that breaks out of the string context and executes arbitrary GraphQL. While the impact is limited by Jobber's API permissions (read/write to the client's own account), this is a code quality and security concern.

**Fix:** Use GraphQL variables (the `$searchTerm` pattern) instead of string interpolation. Note that the mutation queries in the same files already correctly use variables — the same pattern should be applied to queries.

### 4.6 SQL Injection — PASS
- All database queries use the Supabase client's parameterized query builder (`.eq()`, `.insert()`, `.select()`, etc.)
- No raw SQL or string interpolation in queries
- Single `supabase.rpc()` call uses named parameter (`p_client_id`)

### 4.7 SSRF Protection — PASS
- `src/app/api/automations/webhook-test/route.ts` blocks private/internal addresses including localhost, 127.0.0.1, 0.0.0.0, ::1, .local, .internal, RFC 1918 ranges, and cloud metadata endpoints

---

## 5. Dependency Check

### 5.1 Dev Dependencies Placement — PASS
- `vitest` — in `devDependencies` (v4.0.18)
- `@vitejs/plugin-react` — in `devDependencies` (v5.1.4)

### 5.2 `npm audit` — FAIL (21 vulnerabilities)

| Severity | Count | Key Packages |
|----------|-------|-------------|
| Low | 2 | — |
| Moderate | 1 | ajv (ReDoS with `$data` option) |
| High | 18 | jspdf (PDF injection, DoS), minimatch (ReDoS), qs (arrayLimit bypass) |

**Notable high-severity issues:**
- **jspdf <= 4.1.0** — PDF injection allowing arbitrary JS execution (GHSA-p5xg-68wr-hm3m), PDF object injection (GHSA-9vjf-qc39-jprp), DoS via malicious GIF (GHSA-67pg-wm7f-q7fj)
- **minimatch < 10.2.1** — ReDoS via repeated wildcards (GHSA-3ppc-4f35-3m26) — affects eslint chain (dev-only)
- **qs 6.7.0-6.14.1** — arrayLimit bypass enabling DoS (GHSA-w7fw-mjwx-w883)

**Fix:** Run `npm audit fix` for non-breaking fixes. The minimatch chain requires `npm audit fix --force` (eslint breaking change). The jspdf vulnerabilities need a version upgrade when a patched version is released.

---

## 6. Database Migration Review

**File:** `supabase/migrations/20260222100000_crm_integrations.sql`

### 6.1 Schema Correctness — PASS
- Three tables created: `integration_events`, `integration_retry_queue`, `service_category_mappings`
- All use `UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- All use `TIMESTAMPTZ DEFAULT now()` for timestamps

### 6.2 Foreign Keys — PASS
| Table | FK Column | References | ON DELETE |
|-------|----------|-----------|-----------|
| `integration_events` | `client_id` | `clients(id)` | CASCADE |
| `integration_events` | `call_log_id` | `call_logs(id)` | SET NULL |
| `integration_retry_queue` | `client_id` | `clients(id)` | CASCADE |
| `service_category_mappings` | `client_id` | `clients(id)` | CASCADE |
| `service_category_mappings` | `internal_service_id` | `business_services(id)` | CASCADE |

### 6.3 Indexes — PASS
- `idx_integration_events_client` — `(client_id, created_at DESC)` — supports event listing
- `idx_integration_events_provider` — `(provider, created_at DESC)` — supports provider filtering
- `idx_integration_events_call_log` — partial index on `call_log_id WHERE NOT NULL` — efficient join
- `idx_retry_queue_pending` — partial index `(next_attempt_at) WHERE status = 'pending'` — efficient cron polling
- `idx_retry_queue_client` — `(client_id, status)` — supports client retry view
- `idx_service_mappings_client` — `(client_id, provider)` — supports mapping lookup
- **Unique constraint:** `service_category_mappings(client_id, provider, internal_service_id)` — prevents duplicate mappings

### 6.4 RLS Policies — PASS
- RLS enabled on all three tables
- Startup admin policies: access events/retries/mappings for clients in their organization
- Client policies: access own events/retries/mappings only
- Uses `FOR ALL` which covers SELECT, INSERT, UPDATE, DELETE
- Correct use of `auth.uid()` and role checks (`startup_%`, `client_%`)

### 6.5 Reversibility — PASS (with caveat)
- Uses `CREATE TABLE IF NOT EXISTS` — safe for re-runs
- Uses `INSERT ... ON CONFLICT DO NOTHING` for seed data — idempotent
- **Caveat:** No explicit `DROP TABLE` rollback section provided, but this is standard for forward-only Supabase migrations

### 6.6 Data Loss Risk — PASS
- Migration only creates new tables and inserts new seed data
- No `ALTER TABLE` or `DROP` on existing tables
- No data modification of existing rows

---

## 7. Production Readiness

### 7.1 Stripe Mode — PASS
- No hardcoded test/live keys; all via `process.env.STRIPE_SECRET_KEY`

### 7.2 Supabase URLs — PASS
- All via `process.env.NEXT_PUBLIC_SUPABASE_URL`

### 7.3 QuickBooks Sandbox Toggle — PASS
- Controlled via `process.env.QUICKBOOKS_SANDBOX === "true"` — will default to production API

---

## Summary

| Category | Status | Critical Issues |
|----------|--------|----------------|
| Build (`npm run build`) | **PASS** | None |
| Tests (`npm test`) | **PASS** | None (99/99) |
| TypeScript Strict | **PASS** | None |
| TODO/FIXME/HACK | **PASS** | None |
| console.log | **PASS** | None sensitive |
| Hardcoded Secrets | **PASS** | None |
| Placeholder URLs | **PASS** | UI placeholders only |
| `as any` in New Files | **PASS** | None |
| Env Vars via process.env | **PASS** | Correct usage |
| `.env.example` Updated | **FAIL** | Missing 4 HCP/Jobber vars |
| Tool Route Auth (RETELL_TOOLS_API_KEY) | **PASS** | All 8 routes protected |
| Integration Route Auth (requireAuth) | **PASS** | All 4 routes protected |
| Cron Route Auth (CRON_SECRET) | **PASS** | Protected |
| Webhook Signature Verification | **FAIL** | HCP and Jobber webhooks have no auth |
| HCP Webhook client_id Bug | **FAIL** | Missing NOT NULL client_id causes silent insert failure |
| GraphQL Injection (Jobber) | **FAIL** | 5 locations with string interpolation in queries |
| SQL Injection | **PASS** | Parameterized queries throughout |
| SSRF Protection | **PASS** | Proper blocklist |
| Dev Dependencies | **PASS** | vitest/vite in devDeps |
| npm audit | **FAIL** | 21 vulnerabilities (18 high) — mostly in dev/transitive deps |
| Migration Schema | **PASS** | Correct FK, indexes, RLS |
| Migration Reversibility | **PASS** | Forward-only, idempotent seeds |

### Critical Issues (must fix before ship)

1. **GraphQL injection in Jobber queries** — 5 locations where user input is interpolated into GraphQL strings. Use `$variables` instead.
2. **HCP webhook missing `client_id`** — Inserts will silently fail due to NOT NULL constraint. Need to extract client_id from webhook payload or lookup.

### High Priority (should fix before ship)

3. **Webhook auth for HCP/Jobber** — Both webhook endpoints accept unauthenticated POST requests. Implement webhook secret validation or at minimum IP allowlisting.
4. **`.env.example` missing new vars** — Add `HOUSECALLPRO_CLIENT_ID`, `HOUSECALLPRO_CLIENT_SECRET`, `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`.

### Medium Priority (can follow up post-ship)

5. **npm audit vulnerabilities** — Run `npm audit fix` for non-breaking fixes. The jspdf high-severity vulnerabilities warrant attention if PDFs accept user input. The minimatch/eslint chain is dev-only.
