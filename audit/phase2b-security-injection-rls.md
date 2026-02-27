# Phase 2B: Security Audit -- Injection, XSS, CSRF, RLS

**Auditor:** Claude Opus 4.6 (automated)
**Date:** 2026-02-27
**Scope:** SQL injection, XSS, CSRF, Supabase RLS policies, dependency vulnerabilities

---

## 1. SQL Injection / Query Injection

### 1.1 Supabase Client Queries

**Verdict: PASS**

All database access across ~150+ API routes uses the Supabase JS client (`supabase.from("table_name").select(...)`, `.insert(...)`, `.update(...)`, `.upsert(...)`, `.delete()`). The Supabase client library uses parameterized queries under the hood via PostgREST -- user input passed to `.eq()`, `.ilike()`, `.filter()` etc. is never interpolated into raw SQL.

**Evidence reviewed:**
- 343 files match `.from(` -- all use string-literal table names (e.g., `supabase.from("leads")`)
- Only 1 use of dynamic table names found: `src/app/api/agents/[id]/route.ts:156-158` -- iterates over a hardcoded `const tables = [...]` array. **Not user-controlled.**
- No `.select()` calls use dynamic/user-supplied column names
- No raw SQL strings found anywhere in application code
- No template literals or string concatenation in query construction

### 1.2 RPC Calls

**Verdict: PASS**

Only 1 RPC call exists in the codebase:
- **File:** `src/app/api/webhooks/retell/route.ts:346`
- **Code:** `await supabase.rpc("increment_total_calls", { p_client_id: clientId })`
- `clientId` is derived from a database lookup (not user input), and the RPC function uses a parameterized `WHERE client_id = p_client_id` clause.

### 1.3 Raw SQL in Migrations

**Verdict: PASS with notes**

All 40+ migration files use standard DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE INDEX`). The `SECURITY DEFINER` functions all use parameterized queries or reference `auth.uid()`:
- `get_user_org_id()` -- `SELECT organization_id FROM public.users WHERE id = auth.uid()`
- `is_startup_user()` -- `SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() ...)`
- `get_user_client_id()` -- `SELECT client_id FROM public.users WHERE id = auth.uid()`
- `increment_total_calls(p_client_id)` -- `UPDATE ... WHERE client_id = p_client_id`

All 4 functions have `SET search_path = ''` (fixed in migration `20260218000000_fix_security_issues.sql`).

---

## 2. XSS Vulnerabilities

### 2.1 `dangerouslySetInnerHTML`

**Verdict: PASS**

Zero uses of `dangerouslySetInnerHTML` found in any `src/` file. React's default JSX escaping handles all rendered content.

### 2.2 HTML Email Injection

**Verdict: PASS (fixed)**

The contact form route (`src/app/api/contact/route.ts`) was previously flagged in earlier audits for missing HTML escaping. It now correctly uses `escapeHtml()` on all user-supplied fields:
- **File:** `src/app/api/contact/route.ts:5-12` -- defines `escapeHtml()`
- **Lines 49-59:** All interpolated values (`name`, `email`, `company`, `phone`, `industry`, `message`) are wrapped in `escapeHtml()`
- **File:** `src/app/api/auth/route.ts:204-206` -- separate `escapeHtml()` used for invite/reset emails
- All other email-sending routes (`cron/checkin-email`, `cron/daily-digest`, `cron/usage-alerts`, `post-call-actions`) also use `escapeHtml()` (7 files total)

### 2.3 Widget Custom CSS -- Stored XSS via CSS Injection

**Severity: LOW (mitigated)**
**File:** `src/app/api/agents/[id]/widget-config/route.ts:9-41`

The `sanitizeCustomCss()` function strips known dangerous patterns:
- `expression()` (IE CSS expression)
- `javascript:` URLs in `url()`
- `-moz-binding:` (XBL injection)
- `behavior:` (IE HTC injection)
- `@import` with external URLs
- `data:` URLs
- `</style>` and `<script>` tags

**Residual risk:** The regex-based sanitizer is a best-effort blocklist. A purpose-built CSS parser (like DOMPurify or css-tree) would be more robust. However, the attack surface is admin-only (requires authenticated startup_admin or client_admin), and the CSS is rendered in a controlled widget context.

**Recommendation:** Consider using a CSS parser library for production-grade sanitization. Current implementation is acceptable for admin-only input.

### 2.4 URL Parameter Reflection

**Verdict: PASS**

No URL query parameters are directly rendered as HTML content. Next.js pages use `useSearchParams()` for state management (e.g., success/cancel flags from Stripe), but these values are used for conditional rendering, not HTML interpolation.

### 2.5 Content Security Policy (CSP)

**Severity: MEDIUM**
**File:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  /* config options here */
};
```

**No CSP headers are configured.** The `next.config.ts` is effectively empty -- no `headers()` function, no security headers at all.

**Missing headers:**
- `Content-Security-Policy` -- No protection against inline script injection
- `X-Content-Type-Options` -- No MIME sniffing protection
- `X-Frame-Options` / `frame-ancestors` -- No clickjacking protection
- `Referrer-Policy` -- No referrer control
- `Permissions-Policy` -- No feature policy

**Fix:** Add a `headers()` function to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.retellai.com wss://*.retellai.com;",
          },
        ],
      },
    ];
  },
};
```

---

## 3. CSRF Vulnerabilities

### 3.1 Anti-CSRF Tokens

**Verdict: ACCEPTABLE (relies on framework defaults)**

No explicit CSRF tokens or anti-CSRF middleware is implemented. The application relies on:
1. **SameSite cookies:** Supabase Auth cookies use `SameSite=Lax` by default (Next.js/Supabase SSR library)
2. **Bearer token auth:** API routes for tools (`/api/tools/*`) use `Authorization: Bearer` headers, which are inherently CSRF-resistant
3. **Webhook signature verification:** All webhook endpoints verify signatures (Retell, Stripe, Resend, Housecall Pro, Jobber)
4. **OAuth state parameter:** OAuth callback uses encrypted, time-limited state parameter

**Assessment:** For a Next.js SPA with cookie-based Supabase auth, `SameSite=Lax` provides adequate CSRF protection for all state-mutating operations. The default Next.js behavior does not include `SameSite=None`, so cross-origin POST requests will not carry cookies.

### 3.2 Cookie Configuration

**File:** `src/lib/supabase/middleware.ts`

Cookie options are managed by the `@supabase/ssr` library, which sets `SameSite=Lax`, `Secure` (in production), and `HttpOnly` by default. No custom cookie configuration overrides these defaults.

---

## 4. Supabase RLS (Row Level Security) Audit

### 4.1 RLS Coverage Summary

| Table | RLS Enabled | Startup Policy | Client Policy | Notes |
|-------|------------|----------------|---------------|-------|
| `organizations` | YES | Read/Update own org | Read own org | |
| `users` | YES | Read org users | Read/update own row | |
| `clients` | YES | Full access (org-scoped) | -- | |
| `agents` | YES | Full access (org-scoped) | Read own client agents | |
| `call_logs` | YES | Full access (org-scoped) | Read own client calls | |
| `client_access` | YES | Full access (org-scoped) | -- | |
| `phone_numbers` | YES | Full access (org-scoped) | -- | |
| `webhook_logs` | YES | Full access (org-scoped) | -- | |
| `widget_config` | YES | Full access (agent-scoped) | Full access (agent-scoped) | |
| `ai_analysis_config` | YES | Full access (agent-scoped) | Full access (agent-scoped) | |
| `topics` | YES | Full access (agent-scoped) | Full access (agent-scoped) | |
| `solutions` | YES | Full access (org-scoped) | Read (org-scoped) | |
| `client_plans` | YES | Full access (org-scoped) | -- | |
| `pricing_tables` | YES | Full access (org-scoped) | -- | |
| `agent_templates` | YES | Full access (org-scoped) | -- | |
| `organization_settings` | YES | Full access (org-scoped) | -- | |
| `whitelabel_settings` | YES | Full access (org-scoped) | -- | |
| `email_templates` | YES | Full access (org-scoped) | -- | |
| `integrations` | YES | Full access (org-scoped) | -- | |
| `stripe_connections` | YES | Full access (org-scoped) | -- | |
| `leads` | YES | Full access (org-scoped) | Full access (agent-scoped) | |
| `campaigns` | YES | Full access (org-scoped) | Full access (agent-scoped) | |
| `campaign_leads` | YES | -- | Full access (campaign-scoped) | |
| `campaign_config` | YES | Full access (org-scoped) | Read own agent config | |
| `client_solutions` | YES | Full access (org-scoped) | Read own | |
| `business_settings` | YES | Full access (client-scoped) | Full access (own) | |
| `business_hours` | YES | Full access (client-scoped) | Full access (own) | |
| `business_services` | YES | Full access (client-scoped) | Full access (own) | |
| `business_faqs` | YES | Full access (client-scoped) | Full access (own) | |
| `business_policies` | YES | Full access (client-scoped) | Full access (own) | |
| `business_locations` | YES | Full access (client-scoped) | Full access (own) | |
| `post_call_actions` | YES | Full access (client-scoped) | Full access (own) | |
| `automation_recipes` | YES | Full access (org-scoped) | Read (org-scoped) | |
| `client_automations` | YES | Full access (client-scoped) | Full access (own) | |
| `automation_logs` | YES | Full access (client-scoped) | Full access (own) | |
| `oauth_connections` | YES | Full access (client-scoped) | Full access (own) | |
| `sip_trunks` | YES | Full access (org-scoped) | Full access (org-scoped) | |
| `pii_redaction_configs` | YES | Full access (client/org) | Full access (own) | |
| `conversation_flows` | YES | Full access (client/org) | Full access (own) | |
| `usage_alert_settings` | YES | Full access (client-scoped) | Full access (own) | |
| `waitlist_entries` | YES | Full access (client-scoped) | Full access (own) | |
| `call_feedback` | YES | Full access (client-scoped) | Full access (own) | |
| `lead_scoring_rules` | YES | Full access (client-scoped) | Full access (own) | |
| `integration_events` | YES | Full access (client-scoped) | Full access (own) | |
| `integration_retry_queue` | YES | Full access (client-scoped) | Full access (own) | |
| `service_category_mappings` | YES | Full access (client-scoped) | Full access (own) | |
| `integration_requests` | YES | Full access (org-scoped) | Insert + Read (own) | |
| `pending_callbacks` | YES | None (service role only) | None (service role only) | Intentional |

### 4.2 Overly Permissive RLS Policies

**Severity: MEDIUM**

**Issue:** `make_subscriptions` and `n8n_subscriptions` tables have `USING (true)` policies.

**File:** `supabase/migrations/20260220400001_create_make_n8n_subscriptions.sql:22-23,41-42`

```sql
CREATE POLICY "Service role manages Make subs"
  ON make_subscriptions FOR ALL USING (true);

CREATE POLICY "Service role manages n8n subs"
  ON n8n_subscriptions FOR ALL USING (true);
```

These policies allow ANY authenticated user to read/write/delete ALL rows in these tables, regardless of organization. The `zapier_subscriptions` table had the same issue but was fixed in `20260218000000_fix_security_issues.sql`. The fix was never applied to `make_subscriptions` and `n8n_subscriptions`.

**Fix:** Apply the same pattern used for `zapier_subscriptions`:

```sql
-- make_subscriptions
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

-- n8n_subscriptions (same pattern)
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
```

### 4.3 Service Role Key Usage

**Verdict: PASS**

- `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side code (`src/lib/supabase/server.ts:30-36`), never exposed to the client
- Client-side code (`src/lib/supabase/client.ts`) uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` only
- `createServiceClient()` is only called from:
  - API route handlers (server-side only)
  - Webhook handlers (server-side only)
  - Cron job handlers (server-side only)
  - Seed scripts (CLI only)
- `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `NEXT_PUBLIC_` -- not bundled into client code

### 4.4 Client Plan Accessibility

**Severity: LOW**

The `client_plans` RLS policy restricts access to `startup_%` roles only. However, the public checkout endpoints (`/api/checkout`, `/api/marketing-checkout`) use `createServiceClient()` to read plan data, which bypasses RLS. This is correct behavior -- public checkout needs to read plan prices without authentication.

The pricing page at `/pricing/[orgSlug]/page.tsx` also needs to read plans. It uses server-side data fetching with the service client, which is appropriate.

---

## 5. Dependency Vulnerabilities

### npm audit results:

| Package | Severity | Advisory | Fix Available |
|---------|----------|----------|---------------|
| `hono` 4.12.0-4.12.1 | **HIGH** | Authentication Bypass by IP Spoofing in AWS Lambda ALB conninfo ([GHSA-xh87-mx6m-69f3](https://github.com/advisories/GHSA-xh87-mx6m-69f3)) | Yes (`npm audit fix`) |
| `minimatch` <=3.1.3 | **HIGH** | ReDoS via combinatorial backtracking ([GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj), [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74)) | Yes (`npm audit fix`) |

**Assessment:**
- `hono` -- Only relevant if deployed on AWS Lambda with ALB. If the app runs on Vercel/Netlify/other, this is **not exploitable** in the current deployment context.
- `minimatch` -- ReDoS in dev/build tooling (`@ts-morph`, `@typescript-eslint`, `glob`). **Not exploitable at runtime** -- these are dev dependencies / build tools only.

**Recommendation:** Run `npm audit fix` to resolve both. Neither is actively exploitable in the application's runtime context.

---

## 6. Summary of Findings

### Critical (0)
None.

### High (1)
| ID | Issue | File | Status |
|----|-------|------|--------|
| H-1 | `make_subscriptions` and `n8n_subscriptions` RLS policies use `USING (true)` -- any authenticated user can access all rows | `supabase/migrations/20260220400001_create_make_n8n_subscriptions.sql:22-23,41-42` | **OPEN -- needs migration** |

### Medium (1)
| ID | Issue | File | Status |
|----|-------|------|--------|
| M-1 | No security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.) configured in `next.config.ts` | `next.config.ts` | **OPEN** |

### Low (2)
| ID | Issue | File | Status |
|----|-------|------|--------|
| L-1 | Widget custom CSS sanitizer uses regex blocklist instead of proper CSS parser | `src/app/api/agents/[id]/widget-config/route.ts:9-41` | Acceptable (admin-only input) |
| L-2 | 2 high-severity npm audit findings (hono, minimatch) -- neither exploitable at runtime | `package-lock.json` | Run `npm audit fix` |

### Passed Categories
| Category | Verdict |
|----------|---------|
| SQL Injection | **PASS** -- All queries parameterized via Supabase client |
| `dangerouslySetInnerHTML` | **PASS** -- Zero usage in `src/` |
| HTML Email Injection | **PASS** -- All user input escaped via `escapeHtml()` |
| CSRF Protection | **PASS** -- SameSite=Lax cookies + Bearer tokens |
| Service Role Key Exposure | **PASS** -- Server-side only, never in client bundle |
| RLS Coverage | **PASS** -- All 48 tables have RLS enabled |
| Webhook Authentication | **PASS** -- All 5 webhook endpoints verify signatures/secrets |
| Cron Authentication | **PASS** -- All 6 cron endpoints verify `CRON_SECRET` bearer token |
| Tool Endpoint Authentication | **PASS** -- All `/api/tools/*` endpoints verify `RETELL_TOOLS_API_KEY` |
| Public Endpoint Rate Limiting | **PASS** -- contact, demo-call, checkout, auth endpoints rate-limited |

---

## 7. Prioritized Action Items

1. **[HIGH] Fix make/n8n subscription RLS** -- Create a migration to replace `USING (true)` with org-scoped policies (see Section 4.2 for exact SQL)
2. **[MEDIUM] Add security headers** -- Configure CSP and other headers in `next.config.ts` (see Section 2.5 for example)
3. **[LOW] Run `npm audit fix`** -- Resolves both high-severity dependency advisories
