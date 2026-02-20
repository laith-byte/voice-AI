# Security & Edge Cases Review

**Reviewer:** security-review agent
**Date:** 2026-02-20
**Codebase:** Invaria Labs (Next.js + Supabase + Retell AI + Stripe)

---

## VERDICT: CONDITIONAL PASS

The codebase has solid fundamentals -- auth is enforced on nearly every route, secrets are server-side only, webhook signatures are verified, encryption is done correctly, and tenant isolation is largely present. However, there are several **HIGH** and **MEDIUM** findings that should be addressed before production launch, and two **CRITICAL** findings that need immediate attention.

---

## 1. Secrets & Exposure

### 1.1 Hardcoded Secrets in Source Code
**Severity:** PASS
- No hardcoded API keys, tokens, or passwords found in any `.ts` / `.tsx` source files.
- All secrets are accessed via `process.env.*` on the server side.
- Encrypted values use `retell_api_key_encrypted`, `api_key_encrypted`, `password_encrypted` columns.

### 1.2 NEXT_PUBLIC_ Exposure
**Severity:** PASS
- Only three `NEXT_PUBLIC_` env vars are used: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.
- The Supabase anon key is designed to be public (it's the equivalent of a browser API key, gated by RLS).
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is defined in `.env.local` but not referenced anywhere in source code -- this is fine (publishable keys are meant to be client-side).
- No server-side secrets (SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, RETELL_API_KEY, etc.) are exposed via `NEXT_PUBLIC_` prefix.

### 1.3 .gitignore Coverage
**Severity:** PASS
- `.gitignore` contains `.env*` with `!.env.example` -- all env files are excluded from git.
- `*.pem` files are excluded.
- `.vercel` directory is excluded.

### 1.4 API Response Leakage
**Severity:** PASS
- No API route returns raw secret keys (Stripe secret key, Retell API key, etc.) in responses.
- The `integrations` POST route correctly returns only `id, organization_id, provider, name, is_connected, connected_at` -- excluding `api_key_encrypted`.
- Agent routes select specific columns and never include `retell_api_key_encrypted` in responses.

### 1.5 Encryption Implementation
**Severity:** PASS
- Uses AES-256-GCM with random IV and auth tag -- this is correct and modern.
- Key derived from 64-char hex env var (32 bytes).
- Encrypted values prefixed with `enc:` for backward compatibility detection.

---

## 2. Authentication & Authorization

### 2.1 Auth Enforcement on API Routes

| Route | Auth | Rate Limit | Notes |
|---|---|---|---|
| `POST /api/auth` (sign-in, sign-up, sign-out, reset-password, invite-member) | Partial | YES | sign-in/sign-up/reset are public (correct). invite-member checks auth. |
| `POST /api/auth/reset-password` | NONE | NONE | **HIGH** - No rate limit. See finding below. |
| `GET /api/agents`, `POST /api/agents` | YES | NO | |
| `DELETE /api/agents/[id]` | YES | NO | Org check present. |
| `GET/PATCH /api/agents/[id]/config` | YES | NO | |
| `GET/POST /api/agents/[id]/knowledge-base` | YES | NO | Org check present. |
| `DELETE /api/agents/[id]/knowledge-base/[sourceId]` | YES | NO | Org check present. |
| `POST /api/agents/[id]/publish` | YES | NO | **MEDIUM** - No org ownership check. See finding. |
| `GET /api/agents/[id]/voices` | YES | NO | **MEDIUM** - No org ownership check. |
| `GET/POST /api/agents/[id]/versions` | YES | NO | **MEDIUM** - No org ownership check. |
| `POST /api/agents/[id]/chat` | YES | NO | |
| `POST /api/agents/sync-call` | YES | NO | |
| `POST /api/agents/create-web-call` | NONE | YES | Public endpoint for embeddable widget. Rate limited. |
| `GET /api/calls` | YES | NO | |
| `POST /api/calls` (create_web_call) | NONE | YES | Public endpoint. Rate limited. |
| `GET/POST /api/leads` | YES | NO | |
| `PATCH/DELETE /api/leads/[id]` | YES | NO | Org check present. |
| `GET/POST /api/clients` | YES | NO | |
| `PATCH /api/settings` | YES | NO | |
| `POST /api/billing` | YES | NO | Stripe account ownership verified. |
| `POST /api/checkout` | NONE | NO | **HIGH** - Public, no rate limit. See finding. |
| `POST /api/marketing-checkout` | NONE | YES | Public, rate limited. Good. |
| `POST /api/contact` | NONE | NO | **MEDIUM** - Public, no rate limit. |
| `POST /api/demo-call` | NONE | NO | **CRITICAL** - Public, no rate limit, triggers real phone calls. |
| `GET/PATCH /api/business-settings` | YES | NO | Uses getClientId for tenant isolation. |
| `GET/POST /api/business-settings/faqs/[id]` etc. | YES | NO | |
| `POST /api/tools/calendar/*` | API Key | NO | Retell tools API key auth. |
| `POST /api/tools/hubspot/*` | API Key | NO | Retell tools API key auth. |
| `POST /api/tools/calendly/*` | API Key | NO | Retell tools API key auth. |
| `GET /api/oauth/authorize` | YES | NO | |
| `GET /api/oauth/callback` | YES* | NO | Session + encrypted state validation. |
| `GET/POST/DELETE /api/oauth/connections` etc. | YES | NO | |
| `POST /api/webhooks/retell` | Signature | NO | Retell signature verification. |
| `POST /api/webhooks/stripe` | Signature | NO | Stripe signature verification. |
| `GET /api/zapier/auth` | API Key | NO | |
| `POST/DELETE /api/zapier/subscribe` | API Key | NO | |
| `GET /api/cron/daily-digest` | CRON_SECRET | NO | |
| `GET /api/cron/checkin-email` | CRON_SECRET | NO | |
| `GET/POST /api/phone-numbers` | YES | NO | |
| `GET/POST /api/campaigns` | YES | NO | Org check present. |
| `PATCH/DELETE /api/campaigns/[id]` | YES | NO | Org check present. |
| `GET/POST /api/pii-redaction` | YES | NO | Uses getClientId. |
| `POST /api/automations/webhook-test` | YES | NO | SSRF protection present. |
| `GET/POST /api/sip-trunks` | YES | NO | |
| `POST /api/integrations` | YES | NO | |
| `POST /api/onboarding/*` | YES | NO | Uses getClientId. |

### FINDING: CRITICAL -- `/api/demo-call` is unauthenticated with no rate limit
**File:** `src/app/api/demo-call/route.ts`
**Severity:** CRITICAL
**Description:** This public endpoint triggers real outbound phone calls via Retell API with no authentication and no rate limiting. An attacker could:
1. Spam arbitrary phone numbers with calls (phone harassment)
2. Exhaust the Retell API call quota rapidly
3. Incur significant telephony charges
**Impact:** Financial loss, abuse potential, reputation damage.

### FINDING: CRITICAL -- `/api/auth/reset-password` has no rate limit
**File:** `src/app/api/auth/reset-password/route.ts`
**Severity:** CRITICAL
**Description:** This endpoint uses `createServiceClient()` (service role key) to generate password recovery links with no rate limiting. While it doesn't reveal whether an email exists (good), an attacker can trigger unlimited password reset emails to any email address, which:
1. Could be used for email bombing
2. Exhausts Resend email quota
3. Creates noise that masks real attacks

### FINDING: HIGH -- `/api/checkout` has no rate limit
**File:** `src/app/api/checkout/route.ts`
**Severity:** HIGH
**Description:** Public endpoint that creates Stripe checkout sessions without rate limiting. An attacker could generate unlimited Stripe sessions, potentially hitting Stripe API rate limits or creating garbage data.

### FINDING: HIGH -- `/api/contact` has no rate limit
**File:** `src/app/api/contact/route.ts`
**Severity:** HIGH
**Description:** Public contact form endpoint with no rate limiting. Can be used to spam the contact email inbox.

### 2.2 Tenant Isolation (Org A vs Org B)

**Severity:** MOSTLY PASS with exceptions

**Strong isolation patterns found:**
- `getClientId()` in `src/lib/api/get-client-id.ts` correctly validates that startup admins can only access clients in their own organization (line 30-42).
- Agents route (`DELETE /api/agents/[id]`) verifies `organization_id` match (line 34).
- Leads routes filter by `organization_id` on all operations.
- Campaigns routes filter by `organization_id` on all operations.
- Knowledge base routes verify user belongs to same organization as the agent.
- Business settings routes use `getClientId()` which enforces tenant isolation.

**Weak isolation found:**

### FINDING: HIGH -- Several agent sub-routes lack org ownership verification
**Files:**
- `src/app/api/agents/[id]/config/route.ts` (GET and PATCH)
- `src/app/api/agents/[id]/publish/route.ts`
- `src/app/api/agents/[id]/voices/route.ts`
- `src/app/api/agents/[id]/versions/route.ts` (GET and POST)
- `src/app/api/agents/[id]/chat/route.ts`

**Description:** These routes use `requireAuth()` and fetch the agent by `id`, but do not verify that the agent's `organization_id` matches the authenticated user's organization. The Supabase query uses `.eq("id", id).single()` without an org filter. If RLS policies are not in place on the `agents` table, User A from Org A could access/modify Agent B from Org B by guessing the agent UUID.

**Mitigation:** RLS on the `agents` table would catch this, but RLS should not be the sole defense for API routes -- defense in depth requires application-level checks.

### FINDING: HIGH -- `GET /api/agents` returns all agents visible to the user without org filter
**File:** `src/app/api/agents/route.ts:9-14`
**Description:** The GET handler queries `agents` table with no `organization_id` filter. It relies entirely on Supabase RLS to restrict results. If RLS is misconfigured, this would return agents from all organizations.

### FINDING: MEDIUM -- `GET /api/calls` lacks explicit org filter
**File:** `src/app/api/calls/route.ts:14`
**Description:** Queries `call_logs` without an `organization_id` filter. Relies on RLS.

### FINDING: MEDIUM -- `GET /api/clients` lacks explicit org filter
**File:** `src/app/api/clients/route.ts:8-13`
**Description:** Queries `clients` without an `organization_id` filter. Relies on RLS.

### FINDING: MEDIUM -- `GET /api/phone-numbers` lacks explicit org filter
**File:** `src/app/api/phone-numbers/route.ts:8-13`
**Description:** Queries `phone_numbers` without an `organization_id` filter. Relies on RLS.

### FINDING: MEDIUM -- `GET /api/solutions` lacks explicit org filter
**File:** `src/app/api/solutions/route.ts:8-13`
**Description:** Queries `solutions` without an `organization_id` filter. Relies on RLS.

### 2.3 Role-Based Access (client_admin vs startup_admin)

**Severity:** PASS with note

- Middleware correctly separates startup users (dashboard routes) from client users (portal routes).
- Client users are redirected away from `/dashboard` and startup routes.
- Startup users are redirected away from portal routes.
- Invite-member action correctly checks `role === "startup_admin"` before allowing invites.
- **Note:** API routes do not generally enforce role checks (e.g., a `client_member` can hit the same routes as a `startup_admin`). This is acceptable IF RLS policies on Supabase tables enforce row-level access by org/client. Without verifying RLS policies (which live in the database, not the codebase), this is an assumption.

### 2.4 Middleware
**File:** `src/middleware.ts` + `src/lib/supabase/middleware.ts`
**Severity:** PASS
- Middleware runs on all non-static routes.
- Correctly uses `supabase.auth.getUser()` (server-side validation, not just `getSession()`).
- Open redirect protection on auth callback (line 9 of `src/app/auth/callback/route.ts`).
- Slug validation prevents client users from accessing other client portals (line 168).

---

## 3. Input Validation

### 3.1 SQL Injection
**Severity:** PASS
- All database queries use Supabase client methods (`.from().select().eq()` etc.) which use parameterized queries.
- Only one `.rpc()` call found (`increment_total_calls`) which uses a named parameter.
- No raw SQL or string interpolation in queries found.

### 3.2 XSS
**Severity:** PASS with one note
- No `dangerouslySetInnerHTML` usage found in any component.
- React's default JSX escaping prevents XSS in rendered content.
- Email HTML templates use `escapeHtml()` helper functions consistently for user-provided data.
- **Note:** The contact form route (`src/app/api/contact/route.ts:21-29`) injects user input (`name`, `email`, `company`, `phone`, `message`) directly into HTML email without escaping. This is an email-based XSS vector -- if the admin email client renders HTML, a malicious `name` field like `<script>alert(1)</script>` would be injected. While modern email clients strip scripts, this is still a best-practice violation.

### FINDING: MEDIUM -- Contact form email lacks HTML escaping
**File:** `src/app/api/contact/route.ts:21-29`
**Description:** User-supplied `name`, `email`, `company`, `phone`, and `message` are interpolated directly into an HTML email template without `escapeHtml()`. This could allow HTML injection in the notification email.

### 3.3 SSRF
**Severity:** PASS
- The webhook test endpoint (`/api/automations/webhook-test`) has explicit SSRF protection blocking localhost, private IPs, metadata endpoints, and `.internal` domains.
- The webhook forwarding in the Retell webhook handler (`/api/webhooks/retell`) forwards to URLs stored in the database (`agents.webhook_url` and `solutions.webhook_url`). These are set by authenticated users. While not user-input from the request itself, stored webhook URLs do not appear to be validated for SSRF.

### FINDING: MEDIUM -- Webhook forwarding URLs lack SSRF validation
**File:** `src/app/api/webhooks/retell/route.ts:287-318`
**Description:** The Retell webhook handler forwards payloads to URLs stored in `agents.webhook_url` and `solutions.webhook_url`. These are set by authenticated startup admins, but no SSRF validation is applied when saving or when forwarding. A malicious or compromised admin account could set a webhook URL pointing to internal services (`http://169.254.169.254/...`).

### 3.4 File Upload
**Severity:** PASS with note
- File uploads for knowledge base (`/api/agents/[id]/knowledge-base` POST) accept multipart form data.
- Files are passed directly to Retell's API (`create-knowledge-base`) rather than stored locally -- Retell handles storage and validation.
- **Note:** No file size limit is enforced at the application level. Next.js has a default body size limit (4MB for Edge, configurable for Node), but no explicit file type or size validation is performed before sending to Retell.

### FINDING: LOW -- No explicit file size/type validation on knowledge base uploads
**File:** `src/app/api/agents/[id]/knowledge-base/route.ts:90-106`
**Description:** File uploads are forwarded to Retell without explicit size or type checks. While Next.js and Retell have their own limits, defense-in-depth suggests validating at the application layer.

### 3.5 General Input Validation
**Severity:** MOSTLY PASS
- Several routes use field allowlists: `leads/[id]` (ALLOWED_FIELDS), `campaigns/[id]` (ALLOWED_FIELDS), `business-settings` (ALLOWED_FIELDS).
- Status values are validated where relevant (campaigns).
- OAuth state is encrypted and time-limited (10 minute expiry).
- The `sign-up` action does not validate password strength (relies on Supabase default).

---

## 4. Edge Cases & Error Handling

### 4.1 Null/Empty Data Handling
**Severity:** PASS
- API routes consistently return empty arrays `[]` or `{ enabled: false }` for missing data rather than crashing.
- Business settings auto-creates a default row if none exists (GET handler).
- Call logs, leads, and campaigns all handle empty results gracefully.

### 4.2 Supabase Error Handling
**Severity:** PASS
- Every Supabase query checks for errors and returns a 500 with a generic message.
- Errors are logged server-side (`console.error`) but not leaked to the client.
- The pattern `if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }` is used consistently.

### 4.3 Retell API Failure Handling
**Severity:** PASS with note
- Agent config routes return appropriate HTTP status codes when Retell fails.
- Knowledge base upload handles Retell failures gracefully -- saves locally with `status: "pending"` and returns a `warning` field.
- Webhook forwarding failures are logged but don't block the response.
- **Note:** No explicit timeout is set on Retell API fetch calls in most routes. If Retell is slow/down, the request could hang until the Next.js/Vercel timeout kills it (typically 10s for serverless). The webhook test endpoint correctly uses `AbortSignal.timeout(10000)`, but other Retell calls do not.

### FINDING: MEDIUM -- No timeouts on Retell API calls
**Files:** All routes that call `retellFetch()` or direct `fetch("https://api.retellai.com/...")` without `signal: AbortSignal.timeout()`.
**Description:** If Retell API becomes unresponsive, requests will hang until the platform timeout kills them. This could cause cascading slowdowns and poor UX. The webhook test route already implements this pattern -- it should be applied everywhere.

### 4.4 Concurrent Operations / Race Conditions
**Severity:** ACCEPTABLE
- Campaign status changes use `eq("id", id).eq("organization_id", ...)` which prevents concurrent cross-org modifications.
- Webhook processing (Retell and Stripe) uses upsert with `onConflict` for idempotency.
- Stripe checkout uses `handleCheckoutCompleted` with an existing-user check before provisioning -- prevents double provisioning.
- **Note:** There's no explicit double-submit protection on form endpoints (e.g., creating agents, leads, campaigns). This could result in duplicates if a user clicks "Create" twice quickly. This is a common pattern in web apps and is not a security vulnerability, but could cause user confusion.

### FINDING: LOW -- No double-submit prevention on creation endpoints
**Description:** Routes like `POST /api/agents`, `POST /api/leads`, `POST /api/campaigns` do not implement idempotency keys or debouncing. Rapid double-clicks could create duplicate records.

---

## 5. Rate Limiting

### 5.1 Rate Limiting Inventory

**Endpoints WITH rate limiting:**
| Endpoint | Limiter | Config |
|---|---|---|
| `POST /api/auth` (all actions) | `publicEndpointLimiter` | 20 req / 60s per IP |
| `POST /api/calls` (create_web_call) | `publicEndpointLimiter` | 20 req / 60s per IP |
| `POST /api/agents/create-web-call` | `publicEndpointLimiter` | 20 req / 60s per IP |
| `POST /api/marketing-checkout` | `publicEndpointLimiter` | 20 req / 60s per IP |

**Public endpoints WITHOUT rate limiting (should have it):**

### FINDING: CRITICAL -- `/api/demo-call` -- no rate limit, triggers real phone calls
Already documented above in section 2.1.

### FINDING: HIGH -- `/api/auth/reset-password` -- no rate limit on password reset
Already documented above in section 2.1.

### FINDING: HIGH -- `/api/checkout` -- no rate limit on Stripe session creation

### FINDING: HIGH -- `/api/contact` -- no rate limit on public contact form

### 5.2 Rate Limiter Implementation
**Severity:** PASS with caveat
- In-memory rate limiter using `Map<string, number[]>` with sliding window.
- **Caveat:** In-memory rate limiting does NOT persist across serverless function invocations. On Vercel, each cold start gets a fresh `Map`. This means the rate limiter is only effective during warm instances. For real protection in production, a Redis-based limiter (e.g., Upstash) would be needed. However, the current implementation still provides some protection against burst attacks during warm periods.

### FINDING: MEDIUM -- In-memory rate limiter is ineffective across serverless invocations
**File:** `src/lib/rate-limit.ts`
**Description:** The rate limiter stores hit counts in a `Map` in process memory. In a serverless environment (Vercel), each function invocation may get a fresh process, making the rate limiter ineffective against distributed attacks. This is acceptable for launch but should be replaced with Redis-backed rate limiting (e.g., `@upstash/ratelimit`) for production scale.

---

## 6. Additional Findings

### FINDING: MEDIUM -- Zapier auth endpoint does not actually verify the API key hash
**File:** `src/app/api/zapier/auth/route.ts:14-30`
**Description:** The Zapier auth test endpoint (`GET /api/zapier/auth`) extracts a `clientId` from the API key format (`client_id:random_key`) and only verifies that the client exists in the database. It does NOT verify that the `random_key` portion is valid/matches any stored hash. This means any string formatted as `valid_client_id:anything` would pass authentication.

### FINDING: MEDIUM -- `create-web-call` endpoint allows unauthenticated agent access
**File:** `src/app/api/agents/create-web-call/route.ts`
**Description:** This public rate-limited endpoint allows anyone to create a web call for any agent if they know the agent's UUID. While UUIDs are hard to guess, this endpoint reveals Retell `access_token` and `call_id` to unauthenticated users. This is by design for embeddable widgets, but should be documented as an intentional trust boundary.

### FINDING: LOW -- Email templates could benefit from CSP-like restrictions
**Description:** Several email templates include user-controlled content (business names, etc.) in HTML. While `escapeHtml()` is used in most places, a defense-in-depth approach would ensure all interpolated values are escaped. The Stripe webhook's `sendWelcomeEmail` function uses `escapeHtml(businessName)` correctly.

---

## Summary Table

| # | Severity | Finding | File(s) |
|---|---|---|---|
| 1 | **CRITICAL** | `/api/demo-call` is public, no auth, no rate limit, triggers real phone calls | `src/app/api/demo-call/route.ts` |
| 2 | **CRITICAL** | `/api/auth/reset-password` has no rate limit, can be used for email bombing | `src/app/api/auth/reset-password/route.ts` |
| 3 | **HIGH** | Several agent sub-routes lack org ownership verification (config, publish, voices, versions, chat) | `src/app/api/agents/[id]/config/`, `publish/`, `voices/`, `versions/`, `chat/` |
| 4 | **HIGH** | Multiple list endpoints lack explicit org filter, rely solely on RLS (agents, calls, clients, phone-numbers, solutions) | `src/app/api/agents/route.ts`, `calls/`, `clients/`, `phone-numbers/`, `solutions/` |
| 5 | **HIGH** | `/api/checkout` has no rate limit | `src/app/api/checkout/route.ts` |
| 6 | **HIGH** | `/api/contact` has no rate limit | `src/app/api/contact/route.ts` |
| 7 | **MEDIUM** | Zapier auth endpoint does not verify the API key secret portion | `src/app/api/zapier/auth/route.ts` |
| 8 | **MEDIUM** | Contact form email lacks HTML escaping | `src/app/api/contact/route.ts` |
| 9 | **MEDIUM** | Webhook forwarding URLs lack SSRF validation | `src/app/api/webhooks/retell/route.ts` |
| 10 | **MEDIUM** | No timeouts on Retell API calls | Multiple agent API routes |
| 11 | **MEDIUM** | In-memory rate limiter is ineffective across serverless invocations | `src/lib/rate-limit.ts` |
| 12 | **LOW** | No explicit file size/type validation on KB uploads | `src/app/api/agents/[id]/knowledge-base/route.ts` |
| 13 | **LOW** | No double-submit prevention on creation endpoints | Multiple POST routes |

---

## What's Done Well

- **Auth callback** has open redirect protection (checks for relative paths, blocks `//`).
- **Password reset** prevents email enumeration (always returns success).
- **Webhook signature verification** is correctly implemented for both Retell and Stripe.
- **Encryption** uses AES-256-GCM with proper IV and auth tag handling.
- **OAuth state** is encrypted and time-limited (10 min expiry) preventing CSRF.
- **OAuth callback** verifies the authenticated user is authorized for the clientId in the state.
- **Field allowlists** prevent arbitrary column updates on sensitive routes (leads, campaigns, business settings).
- **SSRF protection** on the webhook test endpoint is thorough and well-implemented.
- **No dangerouslySetInnerHTML** usage in any React component.
- **Error messages** are generic to clients, detailed in server logs.
- **Cron endpoints** require CRON_SECRET bearer token.
- **Invite flow** correctly validates requester is startup_admin of the same org.
- **HTML escaping** is consistently applied in email templates (with one exception noted).
