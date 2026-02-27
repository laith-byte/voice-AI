# Phase 2A: Security Audit - Secrets, Authentication & Authorization

**Auditor**: Claude Opus 4.6 (automated)
**Date**: 2026-02-27
**Scope**: `/Users/laith/Projects/invaria-labs/src/` (main codebase, excluding `.claude/worktrees/`)

---

## CRITICAL FINDINGS

### C1. Live Production Secrets in `.env.local`

**Severity**: CRITICAL
**File**: `/Users/laith/Projects/invaria-labs/.env.local`

The `.env.local` file contains live production credentials:

```
SUPABASE_SERVICE_ROLE_KEY=<REDACTED>
RETELL_API_KEY=<REDACTED>
STRIPE_SECRET_KEY=sk_live_<REDACTED>
STRIPE_WEBHOOK_SECRET=whsec_<REDACTED>
RESEND_API_KEY=<REDACTED>
ENCRYPTION_KEY=<REDACTED>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<REDACTED>
```

**Risk**: If this file was ever committed to git, all secrets are compromised. The `sk_live_` prefix indicates a **live Stripe secret key** with access to real payment operations.

**Status**: `.gitignore` has `.env*` with `!.env.example` exception -- secrets are NOT committed. However:

**Fix**:
1. Rotate ALL keys listed above immediately if they were ever committed
2. Verify git history: `git log --all --full-history -- .env.local` to confirm no prior commits
3. Use a secrets manager (e.g., Vercel env vars) rather than local `.env.local` for production values

---

### C2. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local` but NOT in `.env.example`

**Severity**: LOW (publishable keys are designed to be public)
**File**: `.env.local:6`

The `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is present in `.env.local` but not listed in `.env.example`. This is acceptable since Stripe publishable keys are designed for client-side use, but it should be documented.

**Fix**: Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=` to `.env.example` for documentation completeness.

---

### C3. `RESEND_INBOUND_SECRET` Missing from `.env.example`

**Severity**: MEDIUM
**File**: `src/app/api/webhooks/resend/inbound/route.ts:93`

```typescript
if (!secret || secret !== process.env.RESEND_INBOUND_SECRET) {
```

This env var is used in production but not documented in `.env.example`. If not set, the webhook will reject all requests (safe fail-closed), but the missing documentation means new deployments won't know to configure it.

**Fix**: Add `RESEND_INBOUND_SECRET=` to `.env.example`.

---

## HIGH FINDINGS

### H1. No Admin Role Verification on `/api/admin/*` Routes

**Severity**: HIGH
**Files**:
- `src/app/api/admin/org-settings/route.ts`
- `src/app/api/admin/plans/route.ts`
- `src/app/api/admin/plans/[id]/route.ts`
- `src/app/api/admin/pricing-tables/route.ts`
- `src/app/api/admin/pricing-tables/[id]/route.ts`
- `src/app/api/admin/stripe-connections/route.ts`

All admin routes use `requireAuth()` which only verifies the user is logged in. They do NOT check `user.user_metadata.role` to verify the user is a `startup_admin` or equivalent. **Any authenticated user (including `client_member`) can create/modify/delete plans, pricing tables, and Stripe connections.**

The middleware does block client users from `/admin` page routes on the frontend, but the API routes themselves are unprotected. An attacker with a `client_member` session cookie can directly call these APIs.

Example from `admin/plans/route.ts:4-6`:
```typescript
export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;
  // No role check! Any authenticated user can create plans
```

**Fix**: Add role verification to all admin routes:
```typescript
const { user, supabase, response } = await requireAuth();
if (response) return response;
const role = user.user_metadata?.role;
if (role !== "startup_admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

### H2. Webhook Secret Passed as URL Query Parameter (Resend Inbound)

**Severity**: HIGH
**File**: `src/app/api/webhooks/resend/inbound/route.ts:91-94`

```typescript
const url = new URL(request.url);
const secret = url.searchParams.get("secret");
if (!secret || secret !== process.env.RESEND_INBOUND_SECRET) {
```

The webhook secret is passed as a URL query parameter (`?secret=xyz`). Query parameters are logged in web server access logs, CDN logs, and browser history. Secrets should be passed in HTTP headers instead.

**Fix**: Require the secret in a header (e.g., `x-webhook-secret`) instead of a query parameter, or use Resend's built-in webhook signature verification.

---

### H3. `calls` POST Route - Unauthenticated Web Call Creation

**Severity**: HIGH
**File**: `src/app/api/calls/route.ts:23-71`

The `POST` handler has rate limiting but NO authentication. It uses `createClient()` (user-scoped, based on cookie) to look up the agent, but this is a public endpoint that anyone can call to create web calls:

```typescript
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);
  // No auth check
  const body = await request.json();
  const { action } = body;
  if (action === "create_web_call") {
    // Creates a Retell web call using server-side API key
```

Combined with the `agents/create-web-call` route (which also has no auth), this allows unauthenticated users to trigger Retell API calls that may incur costs.

**Fix**: These appear to be intentionally public (for embedded widget calls). If so, add additional protections:
- Verify the agent is configured for public widget access (check `widget_config` exists)
- Consider per-agent rate limiting instead of just IP-based
- Add origin/referrer validation

---

### H4. `requireAuth()` Does Not Return Early -- Callers Must Check `response`

**Severity**: MEDIUM-HIGH
**File**: `src/lib/api/auth.ts:4-11`

```typescript
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, supabase, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, supabase, response: null };
}
```

This pattern requires every caller to check `if (response) return response;`. If any route forgets this check, it proceeds as unauthenticated. While all current routes appear to check correctly, this is a fragile pattern.

**Fix**: Consider throwing an error or returning a `NextResponse` directly from a middleware-style helper to eliminate the possibility of forgetting the check.

---

## MEDIUM FINDINGS

### M1. In-Memory Rate Limiter Does Not Survive Restarts / Scale

**Severity**: MEDIUM
**File**: `src/lib/rate-limit.ts:9-44`

```typescript
function createRateLimiter({ windowMs, maxRequests }: ...) {
  const hits = new Map<string, number[]>();
  // ...
}
```

The rate limiter stores state in a `Map` in process memory. This means:
- Restarting the server resets all rate limits
- If running multiple server instances (e.g., Vercel serverless), each instance has its own counter
- An attacker can bypass rate limits by triggering new cold starts

**Fix**: For production, use a shared store (Redis, Vercel KV, Upstash) for rate limiting. The current in-memory approach is better than nothing but provides minimal protection.

---

### M2. No Rate Limiting on Authenticated API Routes

**Severity**: MEDIUM
**Files**: All `requireAuth()` routes (agents, clients, campaigns, knowledge-base, etc.)

Only 7 public endpoints have rate limiting:
- `/api/auth/route.ts`
- `/api/auth/reset-password/route.ts`
- `/api/demo-call/route.ts`
- `/api/checkout/route.ts`
- `/api/marketing-checkout/route.ts`
- `/api/agents/create-web-call/route.ts`
- `/api/contact/route.ts`
- `/api/calls/route.ts`

All authenticated routes have no rate limiting. A compromised user account could spam expensive Retell API calls.

**Fix**: Add rate limiting to authenticated routes, especially those that trigger external API calls (Retell, Twilio, Stripe).

---

### M3. OAuth State Not Cryptographically Bound to Session

**Severity**: MEDIUM
**File**: `src/app/api/oauth/callback/route.ts:40-41`

```typescript
const userSupabase = await createClient();
const { data: { user } } = await userSupabase.auth.getUser();
```

The OAuth callback verifies the user is logged in but the state parameter is only validated for existence, not cryptographically tied to the specific user session. This could allow CSRF-style attacks where an attacker triggers an OAuth flow to link their third-party account to a victim's account.

**Fix**: Include the user ID in the OAuth state parameter and verify it matches on callback.

---

### M4. Sensitive Data in Console Logs

**Severity**: MEDIUM
**Files** (selected examples):
- `src/app/api/oauth/callback/route.ts:99` -- logs OAuth token exchange errors (may include tokens in error messages)
- `src/lib/oauth/token-manager.ts:84` -- `console.error('Token refresh failed for ${provider}:', errText)` -- may log token-related error details
- `src/app/api/agents/[id]/config/route.ts:406` -- `console.log("[config PATCH] Updating LLM", body.llm_id, ...)` -- logs config update details

**Fix**: Use structured logging (`logger.ts`) consistently and ensure error messages from external APIs are sanitized before logging.

---

### M5. No CORS Configuration

**Severity**: MEDIUM
**Files**: `next.config.ts`, middleware

There is no CORS configuration anywhere in the codebase:
- `next.config.ts` is empty
- No `Access-Control-Allow-Origin` headers set
- No CORS middleware

Next.js defaults to same-origin for API routes, which is secure by default. However, the checkout route validates `return_url` against allowed origins, and tools routes are called by Retell's servers (cross-origin). If any route needs cross-origin access, it should be explicitly configured.

The absence of CORS is not a vulnerability per se (default deny), but the tools routes called by Retell may need explicit CORS headers.

**Fix**: Verify that Retell tool endpoints work correctly without CORS headers (they may use server-to-server calls). If client-side cross-origin requests are needed, add explicit CORS headers only to those routes.

---

## LOW FINDINGS

### L1. `.env.local` Contains Both Development and Production Values

**Severity**: LOW
**File**: `.env.local`

```
NEXT_PUBLIC_APP_URL=http://localhost:3001  # Development
STRIPE_SECRET_KEY=sk_live_...              # Production
```

Mixing development URLs with live production keys creates risk of accidentally using production resources during development.

**Fix**: Use `.env.development` for dev-only values and `.env.production` for production, or use Vercel's environment separation.

---

### L2. Environment Variables Missing from `.env.example`

**Severity**: LOW

The following env vars are used in code but not in `.env.example`:
- `RESEND_INBOUND_SECRET` (used in webhooks/resend/inbound)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (used in .env.local but not documented)
- `NODE_ENV` (standard, but referenced in prompt-tree-editor.tsx)

**Fix**: Add all used env vars to `.env.example` for documentation.

---

## COMPLETE API ROUTE AUTH AUDIT

### Authenticated Routes (using `requireAuth()`) -- PASS

All of the following routes correctly call `requireAuth()` and check the response:

| Route | Methods | Auth |
|-------|---------|------|
| `/api/agents/route.ts` | GET, POST | requireAuth |
| `/api/agents/[id]/route.ts` | GET, DELETE | requireAuth |
| `/api/agents/[id]/config/route.ts` | GET, PATCH | requireAuth |
| `/api/agents/[id]/chat/route.ts` | POST | requireAuth |
| `/api/agents/[id]/publish/route.ts` | POST | requireAuth |
| `/api/agents/[id]/voices/route.ts` | GET | requireAuth |
| `/api/agents/[id]/versions/route.ts` | GET, POST | requireAuth |
| `/api/agents/[id]/knowledge-base/route.ts` | GET, POST | requireAuth |
| `/api/agents/[id]/knowledge-base/[sourceId]/route.ts` | DELETE | requireAuth |
| `/api/agents/[id]/topics/route.ts` | GET, POST, DELETE | requireAuth |
| `/api/agents/[id]/conversation-flow/route.ts` | GET, PATCH | requireAuth |
| `/api/agents/[id]/ai-analysis/route.ts` | GET, POST, PUT | requireAuth |
| `/api/agents/[id]/ai-analysis-config/route.ts` | GET, PUT | requireAuth |
| `/api/agents/[id]/call-handling/route.ts` | GET, PUT | requireAuth |
| `/api/agents/[id]/campaign-config/route.ts` | GET, PUT | requireAuth |
| `/api/agents/[id]/webhook-test/route.ts` | POST | requireAuth |
| `/api/agents/[id]/widget-config/route.ts` | GET, PUT | requireAuth |
| `/api/agents/sync-call/route.ts` | POST | requireAuth |
| `/api/agent-templates/route.ts` | GET, POST | requireAuth |
| `/api/billing/route.ts` | POST | requireAuth |
| `/api/calls/route.ts` | GET | requireAuth |
| `/api/campaigns/route.ts` | GET, POST | requireAuth |
| `/api/campaigns/[id]/route.ts` | PATCH, DELETE | requireAuth |
| `/api/clients/route.ts` | GET, POST | requireAuth |
| `/api/clients/[id]/route.ts` | PATCH | requireAuth |
| `/api/clients/[id]/assigned-agents/route.ts` | GET, POST | requireAuth |
| `/api/clients/[id]/client-access/route.ts` | POST, DELETE | requireAuth |
| `/api/clients/[id]/embed-url/route.ts` | GET, PUT | requireAuth |
| `/api/clients/[id]/members/[memberId]/route.ts` | PATCH, DELETE | requireAuth |
| `/api/clients/[id]/solutions/route.ts` | GET, POST | requireAuth |
| `/api/client/billing/route.ts` | GET, POST | requireAuth |
| `/api/client/plan-access/route.ts` | GET | requireAuth |
| `/api/conversation-flows/route.ts` | GET, POST | requireAuth |
| `/api/conversation-flows/[id]/route.ts` | GET, PATCH, PUT, DELETE | requireAuth |
| `/api/integration-requests/route.ts` | GET, POST | requireAuth |
| `/api/integration-requests/[id]/route.ts` | PATCH | requireAuth |
| `/api/integrations/route.ts` | GET, POST | requireAuth |
| `/api/integrations/client/route.ts` | GET, POST | requireAuth |
| `/api/integrations/client/[id]/route.ts` | GET, PATCH | requireAuth |
| `/api/integrations/client/[id]/logs/route.ts` | GET | requireAuth |
| `/api/integrations/configure/route.ts` | POST | requireAuth |
| `/api/integrations/events/route.ts` | GET | requireAuth |
| `/api/integrations/recent-syncs/route.ts` | GET | requireAuth |
| `/api/integrations/recipes/route.ts` | GET, POST | requireAuth |
| `/api/integrations/recipes/[id]/route.ts` | PATCH, DELETE | requireAuth |
| `/api/integrations/service-mappings/route.ts` | GET, POST, DELETE | requireAuth |
| `/api/integrations/webhook-test/route.ts` | POST | requireAuth |
| `/api/knowledge-base/route.ts` | GET, PUT | requireAuth |
| `/api/knowledge-base/faqs/route.ts` | GET, POST | requireAuth |
| `/api/knowledge-base/faqs/[id]/route.ts` | PUT, DELETE | requireAuth |
| `/api/knowledge-base/hours/route.ts` | GET, PUT | requireAuth |
| `/api/knowledge-base/locations/route.ts` | GET, POST | requireAuth |
| `/api/knowledge-base/locations/[id]/route.ts` | PUT, DELETE | requireAuth |
| `/api/knowledge-base/policies/route.ts` | GET, POST | requireAuth |
| `/api/knowledge-base/policies/[id]/route.ts` | PUT, DELETE | requireAuth |
| `/api/knowledge-base/services/route.ts` | GET, POST | requireAuth |
| `/api/knowledge-base/services/[id]/route.ts` | PUT, DELETE | requireAuth |
| `/api/leads/route.ts` | GET, POST | requireAuth |
| `/api/leads/[id]/route.ts` | GET, PATCH | requireAuth |
| `/api/leads/[id]/score/route.ts` | POST | requireAuth |
| `/api/leads/import/route.ts` | POST | requireAuth |
| `/api/leads/scoring-rules/route.ts` | GET, PUT | requireAuth |
| `/api/members/route.ts` | GET, POST | requireAuth |
| `/api/oauth/authorize/route.ts` | GET | requireAuth |
| `/api/oauth/connections/route.ts` | GET | requireAuth |
| `/api/oauth/disconnect/route.ts` | POST | requireAuth |
| `/api/oauth/google/calendars/route.ts` | GET | requireAuth |
| `/api/oauth/google/sheets/route.ts` | GET | requireAuth |
| `/api/oauth/slack/channels/route.ts` | GET | requireAuth |
| `/api/phone-numbers/route.ts` | GET, POST | requireAuth |
| `/api/phone-numbers/[id]/route.ts` | DELETE | requireAuth |
| `/api/phone-numbers/[id]/assign/route.ts` | POST | requireAuth |
| `/api/phone-numbers/caller-id/route.ts` | POST | requireAuth |
| `/api/phone-numbers/import/route.ts` | POST | requireAuth |
| `/api/phone-numbers/purchase/route.ts` | POST | requireAuth |
| `/api/phone-numbers/search/route.ts` | GET | requireAuth |
| `/api/pii-redaction/route.ts` | GET, PUT | requireAuth |
| `/api/post-call-actions/route.ts` | GET, POST | requireAuth |
| `/api/settings/route.ts` | PUT | requireAuth |
| `/api/sip-trunks/route.ts` | GET, POST | requireAuth |
| `/api/sip-trunks/[id]/route.ts` | PATCH, DELETE, GET | requireAuth |
| `/api/solutions/route.ts` | GET, POST, DELETE | requireAuth |
| `/api/usage/agent-costs/route.ts` | GET | requireAuth |
| `/api/usage/alerts/route.ts` | GET, POST | requireAuth |
| `/api/usage/forecast/route.ts` | GET | requireAuth |
| `/api/whitelabel/route.ts` | GET | requireAuth |

### Admin Routes (requireAuth, NO role check) -- FAIL (see H1)

| Route | Methods | Auth | Role Check |
|-------|---------|------|------------|
| `/api/admin/org-settings/route.ts` | PUT | requireAuth | NONE |
| `/api/admin/plans/route.ts` | POST | requireAuth | NONE |
| `/api/admin/plans/[id]/route.ts` | PATCH, DELETE | requireAuth | NONE |
| `/api/admin/pricing-tables/route.ts` | POST | requireAuth | NONE |
| `/api/admin/pricing-tables/[id]/route.ts` | PATCH, DELETE | requireAuth | NONE |
| `/api/admin/stripe-connections/route.ts` | POST | requireAuth | NONE |

### Intentionally Public Routes (rate-limited, no auth) -- OK

| Route | Methods | Auth | Rate Limited |
|-------|---------|------|--------------|
| `/api/auth/route.ts` | POST | None (login/signup) | YES |
| `/api/auth/reset-password/route.ts` | POST | None | YES |
| `/api/contact/route.ts` | POST | None | YES |
| `/api/demo-call/route.ts` | POST | None | YES |
| `/api/checkout/route.ts` | POST | None | YES |
| `/api/marketing-checkout/route.ts` | POST | None | YES |
| `/api/agents/create-web-call/route.ts` | POST | None | YES |
| `/api/calls/route.ts` | POST | None (web call) | YES |

### Webhook Routes (signature/secret verified) -- PASS

| Route | Methods | Auth Mechanism |
|-------|---------|----------------|
| `/api/webhooks/stripe/route.ts` | POST | Stripe signature verification |
| `/api/webhooks/retell/route.ts` | POST | Retell signature verification via SDK |
| `/api/webhooks/housecallpro/route.ts` | POST | `x-webhook-secret` header |
| `/api/webhooks/jobber/route.ts` | POST | `x-webhook-secret` header |
| `/api/webhooks/resend/inbound/route.ts` | POST | Query param secret (see H2) |

### Cron Routes (Bearer token auth) -- PASS

| Route | Methods | Auth Mechanism |
|-------|---------|----------------|
| `/api/cron/checkin-email/route.ts` | GET | `Bearer $CRON_SECRET` |
| `/api/cron/daily-digest/route.ts` | GET | `Bearer $CRON_SECRET` |
| `/api/cron/process-callbacks/route.ts` | GET | `Bearer $CRON_SECRET` |
| `/api/cron/retry-queue/route.ts` | GET | `Bearer $CRON_SECRET` |
| `/api/cron/send-emails/route.ts` | GET | `Bearer $CRON_SECRET` |
| `/api/cron/usage-alerts/route.ts` | GET | `Bearer $CRON_SECRET` |

### Tool Routes (Retell API key auth) -- PASS

All tool routes authenticate via `RETELL_TOOLS_API_KEY`:

| Route | Methods | Auth Mechanism |
|-------|---------|----------------|
| `/api/tools/calendar/availability/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/calendar/book/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/calendly/availability/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/calendly/book/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/callback/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/confirmation/send/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/contacts/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/email/send/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/escalate/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/faq/search/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/feedback/collect/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/gohighlevel/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/housecallpro/availability/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/housecallpro/book/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/housecallpro/create-estimate/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/housecallpro/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/hubspot/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/intake/collect/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/jobber/availability/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/jobber/book/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/jobber/create-quote/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/jobber/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/leads/create/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/leads/update/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/locations/nearest/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/notes/create/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/policies/search/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/salesforce/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/services/search/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/sms/send/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/transfer/initiate/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/waitlist/add/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/appointments/check/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/appointments/cancel/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/availability/check/route.ts` | POST | RETELL_TOOLS_API_KEY |
| `/api/tools/business-hours/check/route.ts` | POST | RETELL_TOOLS_API_KEY |

### External Integration Auth Routes (x-api-key with hash validation) -- PASS

| Route | Methods | Auth Mechanism |
|-------|---------|----------------|
| `/api/zapier/auth/route.ts` | GET | x-api-key, hash-verified |
| `/api/zapier/subscribe/route.ts` | POST, DELETE | x-api-key, hash-verified |
| `/api/n8n/auth/route.ts` | GET | x-api-key, hash-verified |
| `/api/n8n/subscribe/route.ts` | POST, DELETE | x-api-key, hash-verified |
| `/api/make/auth/route.ts` | GET | x-api-key, hash-verified |
| `/api/make/subscribe/route.ts` | POST, DELETE | x-api-key, hash-verified |

### OAuth Callback (session-based auth) -- PASS

| Route | Methods | Auth Mechanism |
|-------|---------|----------------|
| `/api/oauth/callback/route.ts` | GET | Session (supabase.auth.getUser) |

---

## ENVIRONMENT VARIABLE AUDIT

### `NEXT_PUBLIC_` Variables (Exposed to Browser)

| Variable | Used In | Risk |
|----------|---------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | supabase client/server/middleware | OK -- Supabase URL is designed to be public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase client/server/middleware | OK -- anon key is designed for client-side, RLS protects data |
| `NEXT_PUBLIC_APP_URL` | Multiple routes for redirects | OK -- just the app URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | .env.local only (not in code) | OK -- publishable keys are designed for client-side |

**Verdict**: No sensitive values are exposed via `NEXT_PUBLIC_` prefix.

### Server-Only Variables (Complete List)

| Variable | Category |
|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Database (bypass RLS) |
| `RETELL_API_KEY` | AI Voice |
| `RETELL_TOOLS_API_KEY` | Tool auth |
| `STRIPE_SECRET_KEY` | Payments |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `RESEND_API_KEY` | Email |
| `RESEND_INBOUND_SECRET` | Webhook auth |
| `ENCRYPTION_KEY` | Crypto |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth |
| `SLACK_CLIENT_ID/SECRET` | OAuth |
| `HUBSPOT_CLIENT_ID/SECRET` | OAuth |
| `CALENDLY_CLIENT_ID/SECRET` | OAuth |
| `QUICKBOOKS_CLIENT_ID/SECRET` | OAuth |
| `SALESFORCE_CLIENT_ID/SECRET` | OAuth |
| `GHL_CLIENT_ID/SECRET` | OAuth |
| `HOUSECALLPRO_CLIENT_ID/SECRET` | OAuth |
| `HOUSECALLPRO_WEBHOOK_SECRET` | Webhook auth |
| `JOBBER_CLIENT_ID/SECRET` | OAuth |
| `JOBBER_WEBHOOK_SECRET` | Webhook auth |
| `TWILIO_ACCOUNT_SID` | SMS/Voice |
| `TWILIO_AUTH_TOKEN` | SMS/Voice |
| `TWILIO_PHONE_NUMBER` | SMS |
| `TWILIO_FROM_NUMBER` | SMS |
| `TWILIO_MESSAGING_SERVICE_SID` | SMS |
| `TWILIO_SIP_TRUNK_SID` | SIP |
| `TWILIO_SIP_TERMINATION_URI` | SIP |
| `TWILIO_SIP_USERNAME` | SIP |
| `TWILIO_SIP_PASSWORD` | SIP |
| `HIYA_APP_ID` | Caller ID |
| `HIYA_APP_SECRET` | Caller ID |
| `CRON_SECRET` | Cron auth |
| `MARKETING_SITE_URL` | CORS validation |
| `PLATFORM_PLAN_ID_STARTER` | Config |
| `PLATFORM_PLAN_ID_PROFESSIONAL` | Config |
| `CONTACT_FORM_EMAIL` | Config |
| `RETELL_AGENT_*` (8 vars) | Demo agent IDs |
| `RETELL_FROM_NUMBER` | Demo calls |
| `QUICKBOOKS_SANDBOX` | Config flag |

---

## AUTHORIZATION (MULTI-TENANT ISOLATION) AUDIT

### Organization Scoping

Most authenticated routes follow this pattern:
1. `requireAuth()` gets the user
2. Look up `users.organization_id` for the user
3. Filter all queries by `organization_id`

This provides organization-level isolation. However:

**Finding**: Supabase RLS (Row Level Security) is the ultimate enforcement layer. The application-level filtering is defense-in-depth. Without verifying RLS policies (covered in Phase 2B), the current application-level checks provide reasonable isolation.

### Client Scoping

Routes in `/api/clients/[id]/*` verify the client belongs to the user's organization before operating. Example from `clients/[id]/route.ts`:
```typescript
// Data is fetched via the user's Supabase client which is RLS-scoped
```

### Cross-Tenant Risk Areas

1. **Tool routes** accept `client_id` as a body parameter and use a service client (bypasses RLS). They are protected by `RETELL_TOOLS_API_KEY` but there's no verification that the `client_id` belongs to the expected organization.
2. **Webhook routes** use service clients and resolve `client_id` from provider-specific metadata (e.g., Stripe metadata, Retell agent_id lookup). This is correct behavior.

---

## SUMMARY

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 1 | Live production secrets in .env.local (mitigated by .gitignore) |
| HIGH | 4 | Admin routes missing role checks, webhook secret in URL, unauthenticated web call creation, fragile auth pattern |
| MEDIUM | 5 | In-memory rate limiter, no rate limiting on auth routes, OAuth state binding, sensitive logs, no CORS config |
| LOW | 2 | Mixed dev/prod env values, undocumented env vars |

### Priority Fixes

1. **Immediate**: Add role verification to all `/api/admin/*` routes (H1)
2. **Immediate**: Move Resend inbound webhook secret from query param to header (H2)
3. **Short-term**: Add rate limiting to authenticated routes that call external APIs (M2)
4. **Short-term**: Add agent-level validation to public web call endpoints (H3)
5. **Medium-term**: Move to distributed rate limiting (Redis/Upstash) (M1)
6. **Medium-term**: Add cryptographic binding of OAuth state to user session (M3)
