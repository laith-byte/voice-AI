# Invaria Labs — Production Readiness Audit Report

**Date:** 2026-02-27
**Auditor:** Claude Opus 4.6 (Senior Security Engineer & Code Reviewer)
**Scope:** Full codebase at `/Users/laith/Projects/invaria-labs` (~417 source files, 42 migrations)
**Stack:** Next.js 16.1.6 / React 19 / Supabase / Retell AI / Stripe / Twilio / Resend

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Codebase Mapping](#phase-1-codebase-mapping)
3. [Phase 2: Security Audit (CRITICAL + HIGH)](#phase-2-security-audit)
4. [Phase 3: Logic and Bug Review (MEDIUM)](#phase-3-logic-and-bug-review)
5. [Phase 4: Missing Tests](#phase-4-missing-tests)
6. [Phase 5: Production Readiness (LOW + Checklist)](#phase-5-production-readiness)
7. [What's Working Well](#whats-working-well)
8. [Priority Fix Order](#priority-fix-order)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 12    |
| HIGH     | 16    |
| MEDIUM   | 22    |
| LOW      | 14    |
| **Total**| **64**|

The codebase has several **critical unauthenticated endpoints** that can be abused for phone harassment and cost inflation, **broken RLS policies** that expose data cross-org, **IDOR vulnerabilities** allowing cross-tenant writes, and **race conditions** that cause data corruption. These must be fixed before production launch.

---

## Phase 1: Codebase Mapping

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| UI | React 19, Tailwind CSS 4, Radix UI, Framer Motion, Recharts |
| Database | Supabase (PostgreSQL), Row Level Security |
| Auth | Supabase Auth (email/password, magic link) |
| Voice AI | Retell AI (retell-llm + conversation-flow engines) |
| Payments | Stripe (Connect, Checkout, Billing Portal, Webhooks) |
| Telephony | Twilio (SMS, phone numbers, SIP trunks) |
| Email | Resend (transactional email) |
| Integrations | Google Calendar, HubSpot, Salesforce, Notion, Slack, Calendly, QuickBooks, GoHighLevel, Housecall Pro, Jobber |
| Automation | Zapier, Make, n8n (webhook subscriptions) |
| Deployment | Vercel (serverless, 6 cron jobs) |
| Testing | Vitest |
| Linting | ESLint |

### Architecture

```
Multi-tenant SaaS:
  Organizations (startups using the platform)
    → Clients (businesses the startup serves)
      → Agents (AI voice agents on Retell)
        → Call Logs, Leads, Campaigns, Widgets, Conversation Flows
```

**Roles:** `startup_admin`, `startup_member`, `client_admin`, `client_member`

### External Service Integrations

- **Retell AI** — Agent provisioning, web calls, phone calls, webhook events
- **Stripe** — Checkout, subscriptions, Connect accounts, billing portal
- **Twilio** — SMS sending, phone number management, SIP trunks
- **Resend** — Transactional emails (summaries, notifications, onboarding)
- **Google APIs** — Calendar booking, OAuth token management
- **Supabase** — Database, auth, real-time, storage
- **10+ OAuth providers** — Token exchange, refresh, encrypted storage

### Directory Structure

```
src/
├── app/
│   ├── api/           — 60+ API routes (REST endpoints, webhooks, cron, tools)
│   ├── auth/          — Auth callback handling
│   ├── (admin)/       — Startup admin dashboard pages
│   └── (client)/      — Client portal pages
├── components/        — React components (UI, editors, dashboards)
├── hooks/             — Custom React hooks
├── lib/               — Core business logic (auth, integrations, crypto, etc.)
├── types/             — TypeScript type definitions
└── styles/            — Global styles
supabase/
├── schema.sql         — Base database schema
└── migrations/        — 42 migration files
```

### Cron Jobs (vercel.json)

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Every hour | `/api/cron/daily-digest` | Email digest |
| Every hour | `/api/cron/checkin-email` | Check-in emails |
| Every hour | `/api/cron/usage-alerts` | Usage alerts |
| Every 5 min | `/api/cron/retry-queue` | Webhook retries |
| Every 5 min | `/api/cron/send-emails` | Email queue |
| Every 5 min | `/api/cron/process-callbacks` | Callback processing |

---

## Phase 2: Security Audit

### CRITICAL-01: Unauthenticated Web Call Creation

**File:** `src/app/api/agents/create-web-call/route.ts` (line 7)
**File:** `src/app/api/calls/route.ts` (line 23, POST handler)

**Description:** Both endpoints allow creating Retell web calls for any agent by UUID without any authentication. The only protection is an in-memory IP rate limiter (which is ineffective on serverless — see MEDIUM-01). An attacker who knows or guesses an agent UUID can:
- Initiate unlimited web calls consuming the customer's Retell minutes
- Generate fraudulent call_logs in the database
- Interact with the AI agent and potentially extract business information

The `calls` GET handler properly calls `requireAuth()` but the POST handler does not.

**Fix:** Add `requireAuth()` or require a signed widget token. At minimum, validate that the requesting origin matches the agent's configured widget domain.

---

### CRITICAL-02: Public Phone Dialing Endpoint

**File:** `src/app/api/demo-call/route.ts` (lines 25-108)

**Description:** The demo-call endpoint triggers outbound phone calls to **any phone number** provided in the POST body. The only protection is IP-based rate limiting (20 req/min, in-memory — ineffective on serverless). An attacker can:
- Use this as a phone harassment tool, calling any number repeatedly
- Exhaust the platform's Retell credits and Twilio minutes
- Impersonate the business by having the AI agent call victims

**Fix:** Add CAPTCHA verification (e.g., Cloudflare Turnstile), require email verification before calling, implement persistent rate limiting (Redis/KV), and restrict to a whitelist of demo agent IDs.

---

### CRITICAL-03: `make_subscriptions` RLS Policy Allows Full Access

**File:** `supabase/migrations/20260220400001_create_make_n8n_subscriptions.sql` (lines 22-23)

**Description:** The RLS policy uses `USING (true)` which grants every authenticated user full read/write access to **all rows** in `make_subscriptions`, regardless of organization. Any user can read, modify, or delete webhook subscriptions belonging to other organizations.

```sql
CREATE POLICY "Service role manages Make subs"
  ON make_subscriptions FOR ALL USING (true);
```

Note: This same issue was already fixed for `zapier_subscriptions` in `20260218000000_fix_security_issues.sql` but never applied to Make/n8n.

**Fix:** Replace with org-scoped policy matching the zapier_subscriptions pattern:
```sql
DROP POLICY IF EXISTS "Service role manages Make subs" ON public.make_subscriptions;
CREATE POLICY "startup_manage_make_subs" ON public.make_subscriptions
  FOR ALL USING (
    public.is_startup_user()
    AND client_id IN (
      SELECT id FROM public.clients WHERE organization_id = public.get_user_org_id()
    )
  );
```

---

### CRITICAL-04: `n8n_subscriptions` RLS Policy Allows Full Access

**File:** `supabase/migrations/20260220400001_create_make_n8n_subscriptions.sql` (lines 37-38)

**Description:** Identical issue as CRITICAL-03. `USING (true)` grants every authenticated user full access to all n8n subscription rows across all organizations.

**Fix:** Same as CRITICAL-03 — replace with org-scoped policy.

---

### CRITICAL-05: `agent_call_handling` Table Has No RLS

**File:** `supabase/migrations/20260223_restructure_business_settings.sql` (lines 61-72)

**Description:** The `agent_call_handling` table is created without `ENABLE ROW LEVEL SECURITY`. This means any query through the Supabase client (including anon key) has unrestricted access to all rows. This table contains sensitive agent configuration including escalation phone numbers, after-hours behavior, and max call duration.

**Fix:** Add to migration:
```sql
ALTER TABLE agent_call_handling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent call handling"
  ON agent_call_handling FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.organization_id = c.organization_id
      WHERE u.id = auth.uid()
    )
  );
```

---

### CRITICAL-06: SOQL Injection in Salesforce Executor

**File:** `src/lib/oauth/executors/salesforce.ts` (lines 72-74)

**Description:** A Salesforce SOQL query is constructed by string concatenation with only single-quote escaping. SOQL supports other metacharacters (`%`, `_` in LIKE, escape sequences) that bypass this mitigation.

```ts
const safePhone = phone.replace(/'/g, "\\'");
const soql = `SELECT Id, ... FROM Contact WHERE Phone = '${safePhone}' LIMIT 1`;
```

**Fix:** Use Salesforce's parameterized query API or validate that `phone` matches `/^\+?\d+$/` before interpolating.

---

### CRITICAL-07: `setup-account` IDOR — Any User Can Rename Any Client

**File:** `src/app/api/auth/route.ts` (lines 179-197)

**Description:** The `setup-account` action accepts a `clientId` from the request body and updates that client's `name` field. It verifies the user is authenticated but does NOT verify the user owns or belongs to that client's organization. Any authenticated user can rename any client on the platform.

```ts
if (cId) {
  await supabase.from("clients").update({ name: businessName }).eq("id", cId);
  // No .eq("organization_id", ...) check
}
```

**Fix:** Add ownership verification:
```ts
const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
await supabase.from("clients").update({ name: businessName })
  .eq("id", cId)
  .eq("organization_id", userData.organization_id);
```

---

### CRITICAL-08: `increment_total_calls` SECURITY DEFINER RPC — No Authorization

**File:** `supabase/migrations/20260218000000_fix_security_issues.sql` (lines 70-81)

**Description:** The `increment_total_calls` function is `SECURITY DEFINER` (runs as superuser) and accepts any `p_client_id` parameter without checking that the caller owns the client. Any authenticated user can call `supabase.rpc("increment_total_calls", { p_client_id: "any-uuid" })` to inflate call counters for any client.

The webhook handler calls this with a `clientId` derived from the signed Retell webhook payload (safe), but any Supabase client with a valid anon key can call this RPC directly with an arbitrary ID.

**Fix:** Add authorization inside the function:
```sql
CREATE OR REPLACE FUNCTION public.increment_total_calls(p_client_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.users u ON u.organization_id = c.organization_id
    WHERE c.id = p_client_id AND u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.client_onboarding
  SET total_calls_since_live = COALESCE(total_calls_since_live, 0) + 1
  WHERE client_id = p_client_id;
END; $$;
```

---

### CRITICAL-09: SSRF via Webhook URL Forwarding

**File:** `src/app/api/webhooks/retell/route.ts` (lines 418-428)

**Description:** The Retell webhook handler forwards the full call payload (including phone numbers, transcripts, PII) to URLs stored in `agents.webhook_url` and `solutions.webhook_url` without URL validation. A user who can set these URLs can point them at internal services:
- `http://169.254.169.254/latest/meta-data/` (cloud metadata — credentials)
- `http://localhost:*` (internal services)
- Any internal network address

```ts
for (const url of urls) {
  const fwdRes = await fetch(url, {  // SSRF: url from DB, no validation
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

**Fix:** Validate webhook URLs against an allowlist of schemes (`https://` only), block private IP ranges (RFC 1918, link-local, loopback), and resolve DNS to verify the target IP before fetching.

---

### CRITICAL-10: `get-client-id` Org Check Bypass on Null Org

**File:** `src/lib/api/get-client-id.ts` (lines 37-50)

**Description:** If the authenticated user's `organization_id` is null (e.g., orphaned user, data integrity issue), the ownership check is entirely skipped. The function falls through and returns any `clientId` from the query parameter as valid.

```ts
if (userOrg?.organization_id) {
  // ownership check only runs if org_id is truthy
  ...
}
return { clientId }; // returns ANY clientId if org check didn't run
```

**Fix:** Treat null organization_id as an error:
```ts
if (!userOrg?.organization_id) {
  return { clientId: null, error: NextResponse.json({ error: "Organization not found" }, { status: 403 }) };
}
```

---

### CRITICAL-11: Admin Routes Have No Role Check

**Files:**
- `src/app/api/admin/org-settings/route.ts`
- `src/app/api/admin/plans/route.ts` (lines 4-34)
- `src/app/api/admin/plans/[id]/route.ts`
- `src/app/api/admin/pricing-tables/route.ts`
- `src/app/api/admin/pricing-tables/[id]/route.ts`
- `src/app/api/admin/stripe-connections/route.ts`

**Description:** All admin routes call `requireAuth()` but never verify `user.user_metadata.role`. A `client_member` user can directly call these APIs to create/modify/delete pricing plans, Stripe connections, and org settings. The middleware only blocks client users from the *frontend* `/admin` pages — but the middleware isn't even active (see HIGH-14).

**Fix:** Add role verification after `requireAuth()`:
```ts
const role = user.user_metadata?.role;
if (role !== "startup_admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

### CRITICAL-12: Retell Webhook Not Idempotent — Duplicate Delivery Double-Counts

**File:** `src/app/api/webhooks/retell/route.ts` (lines 120-211)

**Description:** Retell uses at-least-once delivery. The `call_ended` handler calls `supabase.rpc("increment_total_calls")` which adds +1. On duplicate webhook delivery, the counter increments twice. Additionally, duplicate `call_ended` events trigger duplicate callback retry logic and duplicate post-call emails.

**Fix:** Add deduplication check before processing:
```ts
const { data: existingLog } = await supabase
  .from("call_logs").select("status").eq("retell_call_id", call.call_id).single();
if (existingLog?.status === "completed") {
  return NextResponse.json({ received: true }); // Already processed
}
```

---

### HIGH-01: In-Memory Rate Limiter Ineffective on Serverless

**File:** `src/lib/rate-limit.ts` (line 10, line 62)

**Description:** The rate limiter uses a JavaScript `Map` stored in process memory. On Vercel serverless, each function invocation may run in a different instance with its own `Map`. The rate limit is never shared across instances and resets on cold starts.

**Fix:** Replace with Vercel KV, Upstash Redis, or Cloudflare Rate Limiting.

---

### HIGH-02: No Security Headers Configured

**File:** `next.config.ts` (entire file — empty config)

**Description:** The Next.js config has no security headers. Missing:
- `Content-Security-Policy` — prevents XSS, script injection
- `Strict-Transport-Security` — enforces HTTPS
- `X-Frame-Options` / `frame-ancestors` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy` — controls referrer leakage
- `Permissions-Policy` — restricts browser features

**Fix:** Add headers to `next.config.ts`:
```ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
```

---

### HIGH-03: No Error Monitoring (Sentry/Datadog)

**Description:** The codebase uses `console.error` throughout but has no error monitoring service. In production on Vercel, console errors are ephemeral and easily missed. Critical failures (webhook processing, payment handling, OAuth token refresh) can go unnoticed.

**Fix:** Install `@sentry/nextjs`:
```bash
npx @sentry/wizard@latest -i nextjs
```

---

### HIGH-04: No `middleware.ts` at Project Root — Role-Based Routing Dead Code

**File:** `src/lib/supabase/middleware.ts` exists but is never invoked

**Description:** The `updateSession` middleware function handles session refresh and role-based route protection (blocking client users from admin routes, validating slug ownership). But there is no `middleware.ts` at the project root or `src/middleware.ts` to invoke it. All role-based routing logic never executes.

**Fix:** Create `src/middleware.ts`:
```ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

---

### HIGH-05: Tool Endpoints Use Single Shared Secret, No Per-Client Scoping

**File:** `src/app/api/tools/sms/send/route.ts` (lines 4-8)
**File:** `src/app/api/tools/email/send/route.ts` (lines 4-8)

**Description:** All tool endpoints (SMS, email, calendar, leads, escalate, callback) authenticate with a single static `RETELL_TOOLS_API_KEY`. If this key leaks, all tools are compromised simultaneously. The `client_id` is accepted from the request body with no ownership verification — any caller with the key can act as any client.

**Fix:** Generate per-agent tool keys, validate `client_id` ownership against the agent's organization, add rate limiting.

---

### HIGH-06: Arbitrary HTML in Email Tool — Phishing Vector

**File:** `src/app/api/tools/email/send/route.ts` (line 26)

**Description:** The `email_body` from the request is passed directly as `html` to the email sender without sanitization. Any caller holding `RETELL_TOOLS_API_KEY` can send phishing emails with arbitrary HTML from the platform's sending domain (`notifications@invarialabs.com`).

**Fix:** Sanitize HTML with `sanitize-html` or `DOMPurify`, restrict to safe HTML elements.

---

### HIGH-07: PII Logged in SMS Body

**File:** `src/lib/twilio.ts` (line 17)

**Description:** When Twilio is not configured, the full SMS body (caller names, summaries, PII) is logged:
```ts
console.log("[SMS] Twilio not configured:", body);
```

**Fix:** Remove PII from log: `console.warn("[SMS] Twilio not configured — message not sent");`

---

### HIGH-08: `recording_url` Stored XSS via `javascript:` URI

**File:** `src/lib/post-call-actions.ts` (line 161)

**Description:** The `recording_url` from Retell's webhook is included in email HTML. `escapeHtml()` only escapes HTML entities but does NOT validate URL scheme. A `javascript:alert(1)` URI passes through intact, enabling stored XSS in email clients.

```ts
html += `<a href="${escapeHtml(callLog.recording_url)}">Listen to recording</a>`;
```

**Fix:** Validate URL scheme:
```ts
const safeUrl = /^https?:\/\//.test(callLog.recording_url) ? callLog.recording_url : "#";
```

---

### HIGH-09: OAuth State Replay Within 10-Minute Window

**File:** `src/lib/oauth/state.ts` (lines 24-37)

**Description:** OAuth state tokens are encrypted with a 10-minute expiry but not marked as consumed after use. An attacker who intercepts a valid state token can replay the OAuth callback multiple times to overwrite existing OAuth connections.

**Fix:** Store used state tokens in database/cache and reject duplicates.

---

### HIGH-10: OAuth Callback Silently Swallows Auth Errors

**File:** `src/app/api/oauth/callback/route.ts` (lines 73-76)

**Description:** A catch block wrapping the entire user authorization check silently swallows ALL exceptions. If Supabase is unavailable or the auth check throws, the callback proceeds to store OAuth tokens without verifying ownership.

```ts
} catch {
  // If session verification fails, continue with the encrypted state check
}
```

**Fix:** Log the error and fail the callback if auth check throws.

---

### HIGH-11: `plan_addons` Exposes Pricing Data Cross-Org

**File:** `supabase/migrations/20260213200000_pricing_plans_overhaul.sql` (lines 82-84)

**Description:** RLS policy allows any user (including unauthenticated via anon key) to SELECT all active plan addons:
```sql
CREATE POLICY "public_read_plan_addons" ON plan_addons FOR SELECT USING (is_active = true);
```
Competitors can enumerate each other's pricing and product details.

**Fix:** Scope to user's organization.

---

### HIGH-12: Custom PII Regex Enables ReDoS

**File:** `src/lib/pii-redaction.ts` (lines 33-39)

**Description:** User-configured custom regex patterns from the database are compiled at runtime with `new RegExp(cp.pattern, "g")`. No validation for catastrophic backtracking patterns (e.g., `(a+)+$`). A malicious user could cause the webhook handler to hang for minutes per call, blocking all post-call processing.

**Fix:** Use `safe-regex` or `re2` library for validation:
```ts
import { isRegExpSafe } from "safe-regex";
if (!isRegExpSafe(cp.pattern)) { continue; }
```

---

### HIGH-13: Race Between `call_ended` and `call_analyzed` Webhook Events

**File:** `src/app/api/webhooks/retell/route.ts` (lines 120-338)

**Description:** `call_ended` and `call_analyzed` can arrive concurrently or in reverse order. The `call_ended` handler overwrites `metadata` entirely. If `call_analyzed` arrives first and writes `post_call_analysis`, the subsequent `call_ended` overwrites it. If `call_analyzed` arrives before `call_ended`, the `call_logs` row may not exist, causing post-call actions to silently not fire.

**Fix:** Use merge-style update for `metadata`. Add upsert logic in `call_analyzed` handler.

---

### HIGH-14: Agent Config Routes Missing Org Ownership Verification

**File:** `src/app/api/agents/[id]/config/route.ts` (lines 77-85 GET, lines 281-289 PATCH)

**Description:** Both GET and PATCH fetch the agent by `id` without checking that `agent.organization_id` matches the authenticated user's organization. The route relies entirely on Supabase RLS. If RLS has gaps (or for any code path using service client), a user could access another org's agent by guessing the UUID.

**Fix:** Add explicit ownership check: `.eq("organization_id", userData.organization_id)`

---

### HIGH-15: Stripe Client Recreated on Every Call

**File:** `src/lib/stripe.ts` (lines 3-10)

**Description:** `getStripe()` creates a new `Stripe` instance per invocation, re-initializing HTTP connection pools. With 15+ exported functions all calling `getStripe()`, this causes unnecessary overhead. Additionally, line 7 uses `as Stripe.LatestApiVersion` type cast to hide version mismatch.

**Fix:** Cache the Stripe instance:
```ts
let stripeInstance: Stripe | null = null;
function getStripe() {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-01-27.acacia" });
  }
  return stripeInstance;
}
```

---

### HIGH-16: Bulk Leads POST Has No Array Length Limit

**File:** `src/app/api/leads/route.ts` (lines 47-59)

**Description:** The POST handler accepts `body.leads` as an array with no size validation. An attacker could send millions of leads in a single request. The `/api/leads/import` route properly limits to 500 — the main route does not.

**Fix:** `if (body.leads.length > 500) return NextResponse.json({ error: "Too many leads" }, { status: 400 });`

---

## Phase 3: Logic and Bug Review

### MEDIUM-01: In-Memory Rate Limiter Has No Cleanup — Memory Leak

**File:** `src/lib/rate-limit.ts` (line 10)

**Description:** The `Map` storing IP hit timestamps grows unboundedly with no TTL cleanup or size limit. On long-running instances, memory usage grows linearly.

**Fix:** Add periodic cleanup or switch to persistent store (see HIGH-01).

---

### MEDIUM-02: Race Condition in Integration Recipe Counter

**File:** `src/lib/integration-recipes.ts` (lines 183-189, 205-210)

**Description:** `trigger_count` and `error_count` use read-modify-write pattern with stale in-memory values. Concurrent webhook invocations read the same count and both write `count + 1` — lost updates.

```ts
trigger_count: automation.trigger_count + 1, // stale value from earlier read
```

**Fix:** Use atomic SQL increment via Supabase RPC.

---

### MEDIUM-03: Race Condition in Retry Queue Processing

**File:** `src/app/api/cron/retry-queue/route.ts` (lines 12-16)

**Description:** The retry queue cron fires every 5 minutes with no distributed lock. If a previous invocation hasn't finished, both process the same items concurrently, potentially double-firing webhooks.

**Fix:** Implement distributed lock using Supabase advisory locks or an `is_processing` flag with atomic SELECT FOR UPDATE.

---

### MEDIUM-04: No CORS Configuration on Public Endpoints

**Description:** No explicit CORS headers on API routes. Widget endpoints (`create-web-call`) and public endpoints (`demo-call`) should have explicit CORS policies.

**Fix:** Add CORS headers to public-facing endpoints via Next.js middleware.

---

### MEDIUM-05: Webhook URLs Not Validated on Save

**Description:** When users save webhook URLs to `agents.webhook_url` or `solutions.webhook_url`, the URLs are not validated. Validation should happen at both save and forward time.

**Fix:** Validate URL scheme, block private IP ranges at save time.

---

### MEDIUM-06: OAuth Token Refresh Has No Fetch Timeout

**File:** `src/lib/oauth/token-manager.ts` (line 76)

**Description:** The `fetch()` to the OAuth provider's token URL has no `AbortSignal.timeout()`. If the provider is unresponsive, the request hangs until the serverless function timeout (30-60s).

**Fix:** Add timeout: `signal: AbortSignal.timeout(15_000)`

---

### MEDIUM-07: Callback Retry Scheduling DST Bug

**File:** `src/app/api/webhooks/retell/route.ts` (lines 170-187)

**Description:** Timezone math for "schedule at 9 AM in caller's timezone" uses server-local `setHours` on a UTC date. Has off-by-one-hour errors during DST transitions.

**Fix:** Use a timezone library (luxon, date-fns-tz).

---

### MEDIUM-08: First-Call Notification Email Race — Duplicate Emails

**File:** `src/app/api/webhooks/retell/route.ts` (lines 349-385)

**Description:** Read-modify-write pattern on `first_call_notified_at`. Two simultaneous call endings both see null, both send emails, both update. Result: duplicate notification emails.

**Fix:** Use atomic `UPDATE ... WHERE first_call_notified_at IS NULL` and check affected row count before sending.

---

### MEDIUM-09: Test Call Counter TOCTOU Race

**File:** `src/app/api/onboarding/test-call/route.ts` (lines 43-55)

**Description:** Read-then-write pattern for `test_calls_used`. Two simultaneous test calls both read the same count and both write `count + 1`.

**Fix:** Use atomic increment RPC function.

---

### MEDIUM-10: `console.log` Statements Throughout Production Code

**Files:** Multiple files across the codebase (~40+ instances)

**Description:** Numerous `console.log` debug statements in production code paths. Notable:
- `src/lib/twilio.ts:17` — logs SMS body (PII)
- `src/app/api/agents/[id]/config/route.ts` — 8 debug instances
- `src/app/api/agents/[id]/conversation-flow/route.ts` — ~20 debug instances

**Fix:** Replace with structured logger. Remove debug-level `console.log` calls.

---

### MEDIUM-11: Logger Missing Log Level Filtering and Trace IDs

**File:** `src/lib/logger.ts`

**Description:** The structured logger outputs all levels unconditionally. No `LOG_LEVEL` env var. Log entries have no request ID or trace ID, making it impossible to correlate logs across a single request lifecycle.

**Fix:** Add log level filtering and request ID propagation.

---

### MEDIUM-12: `request.json()` Can Throw — Not Caught in ~30+ Routes

**Files:** `src/app/api/agents/route.ts:22`, `src/app/api/clients/route.ts:21`, `src/app/api/campaigns/route.ts:26`, `src/app/api/leads/route.ts:33`, `src/app/api/auth/route.ts:12`, `src/app/api/checkout/route.ts:15`, and many more

**Description:** Many routes call `await request.json()` without try/catch. Malformed JSON sends an uncaught error.

**Fix:** Wrap in try/catch returning 400 for parse errors.

---

### MEDIUM-13: Self-Healing Redeploy Can Cause Infinite Loop

**File:** `src/app/api/agents/[id]/conversation-flow/route.ts` (lines 457-460)

**Description:** Auto-redeploy triggers when compiled states don't match LLM states. If Retell silently rejects some states, the next GET triggers another redeploy, looping.

**Fix:** Add counter or flag to limit auto-redeploy attempts.

---

### MEDIUM-14: Stripe Webhook `listUsers` Pagination Issue

**File:** `src/app/api/webhooks/stripe/route.ts` (line ~189)

**Description:** `supabase.auth.admin.listUsers({ perPage: 1000 })` fetches up to 1000 users and does linear `.find()`. Beyond 1000 users, the target won't be found.

**Fix:** Query users table directly filtering by email.

---

### MEDIUM-15: Multiple DB Mutations Don't Check Error Returns

**Files:**
- `src/app/api/webhooks/retell/route.ts` (lines 126-142, 224-228, 383)
- `src/app/api/onboarding/step/[step]/route.ts` (lines 66, 92)

**Description:** Several `.update()` and `.upsert()` calls don't check the `{ error }` return. Failed writes are silently ignored.

**Fix:** Check `{ error }` return and log failures.

---

### MEDIUM-16: Webhook Secret Passed as URL Query Parameter (Resend)

**File:** `src/app/api/webhooks/resend/inbound/route.ts` (lines 91-94)

**Description:** The webhook secret is passed as `?secret=xyz` in the URL. Query parameters appear in access logs, CDN logs, and browser history.

**Fix:** Require the secret in an HTTP header instead.

---

### MEDIUM-17: No Rollback Strategy for Database Migrations

**Description:** All 42 migrations are forward-only. No down migrations or documented rollback procedures.

**Fix:** Document rollback strategy. Create reverse SQL for critical schema changes.

---

### MEDIUM-18: Dangerous Empty-String Fallbacks for APP_URL

**Files:** `src/lib/compile-flow-to-retell.ts:80`, `src/lib/prompt-generator.ts:582`, `src/lib/oauth/register-agent-tools.ts:5`

**Description:** `process.env.NEXT_PUBLIC_APP_URL || ""` means tool URLs become relative paths like `/api/tools/...` which Retell rejects.

**Fix:** Throw startup error if `NEXT_PUBLIC_APP_URL` is not set in production.

---

### MEDIUM-19: Missing `call_logs` Database Index

**Description:** `call_logs` is queried frequently by `agent_id` and date range (dashboards, analytics) but no explicit index exists for these patterns.

**Fix:** `CREATE INDEX idx_call_logs_agent_date ON call_logs(agent_id, created_at DESC);`

---

### MEDIUM-20: No Request Size Limits on Webhook Endpoints

**File:** `src/app/api/webhooks/retell/route.ts` (line 15)

**Description:** Webhook handlers read `await request.text()` without size limits. A large POST body could consume memory and crash the function.

**Fix:** Check `Content-Length` and reject oversized payloads (>1MB).

---

### MEDIUM-21: `.single()` Used on Queries That May Return 0 Rows

**Files:** `src/app/api/tools/leads/create/route.ts:28-34`, `src/app/api/calls/route.ts:37-42`

**Description:** `.single()` returns an error when 0 rows match. Should use `.maybeSingle()` to get `null` instead.

**Fix:** Replace `.single()` with `.maybeSingle()` where 0 results are valid.

---

### MEDIUM-22: `escapeHtml` Not Applied Consistently in Email Templates

**File:** `src/lib/post-call-actions.ts`

**Description:** While `escapeHtml()` is applied to some values in email HTML, it's not consistently applied to all user-controlled values.

**Fix:** Audit all email template interpolation. Consider switching to Handlebars auto-escaping (already a dependency).

---

## Phase 4: Missing Tests

### Untested API Routes (High Priority)

| Route | Risk | Description |
|-------|------|-------------|
| `webhooks/retell/route.ts` | CRITICAL | Call lifecycle, PII redaction, post-call actions, lead scoring |
| `webhooks/stripe/route.ts` | CRITICAL | Payment processing, subscription management, auto-provisioning |
| `agents/create-web-call/route.ts` | CRITICAL | Unauthenticated web call creation |
| `calls/route.ts` | CRITICAL | Call management (GET/POST) |
| `demo-call/route.ts` | HIGH | Public demo call endpoint |
| `auth/route.ts` | HIGH | Auth flows (login, signup, setup-account) |
| `checkout/route.ts` | HIGH | Stripe checkout session creation |
| `oauth/callback/route.ts` | HIGH | OAuth code exchange |
| `cron/retry-queue/route.ts` | HIGH | Retry queue processing |
| `cron/daily-digest/route.ts` | MEDIUM | Daily digest email |
| `admin/plans/route.ts` | HIGH | Plan management (missing role check) |
| All `tools/*` endpoints | HIGH | SMS, email, calendar, leads, escalate, callback |

### Untested Library Functions (High Priority)

| Function | Risk | File |
|----------|------|------|
| `executePostCallActions()` | HIGH | `src/lib/post-call-actions.ts` |
| `redactTranscript()`, `redactText()` | HIGH | `src/lib/pii-redaction.ts` |
| `executeRecipes()` | MEDIUM | `src/lib/integration-recipes.ts` |
| Token refresh + locking | HIGH | `src/lib/oauth/token-manager.ts` |
| `encrypt()`, `decrypt()` | HIGH | `src/lib/crypto.ts` |
| All Stripe helpers | MEDIUM | `src/lib/stripe.ts` |
| Rate limiter edge cases | MEDIUM | `src/lib/rate-limit.ts` |
| `scoreLeadFromCall()` | MEDIUM | `src/lib/lead-scoring.ts` |
| Event dispatching | LOW | `src/lib/zapier.ts`, `src/lib/make.ts`, `src/lib/n8n.ts` |
| `requireAuth()` | HIGH | `src/lib/api/auth.ts` |
| `getClientId()` | CRITICAL | `src/lib/api/get-client-id.ts` |

### Recommended Test File Structure

```
src/__tests__/
├── api/
│   ├── webhooks/
│   │   ├── retell.test.ts
│   │   └── stripe.test.ts
│   ├── agents/
│   │   ├── create-web-call.test.ts
│   │   └── config.test.ts
│   ├── calls.test.ts
│   ├── demo-call.test.ts
│   ├── auth.test.ts
│   ├── checkout.test.ts
│   └── tools/
│       ├── sms-send.test.ts
│       └── email-send.test.ts
├── lib/
│   ├── post-call-actions.test.ts
│   ├── pii-redaction.test.ts
│   ├── integration-recipes.test.ts
│   ├── crypto.test.ts
│   ├── rate-limit.test.ts
│   ├── stripe.test.ts
│   ├── oauth/
│   │   ├── token-manager.test.ts
│   │   └── state.test.ts
│   └── api/
│       ├── auth.test.ts
│       └── get-client-id.test.ts
└── migrations/
    └── rls-policies.test.ts
```

---

## Phase 5: Production Readiness

### LOW-01: Hardcoded Retell API Base URL in 50+ Files

**Fix:** Extract to `RETELL_API_BASE = process.env.RETELL_API_BASE || "https://api.retellai.com"`.

---

### LOW-02: Hardcoded Email Sender in 5 Files

`notifications@invarialabs.com` appears in multiple files.

**Fix:** Extract to env var `NOTIFICATION_FROM_EMAIL`.

---

### LOW-03: Hardcoded CDN/Embed URLs Not Whitelabel-Friendly

**Files:** `onboarding/page.tsx:2867`, `embed-url/page.tsx:102`, `whitelabel/page.tsx:703`

**Fix:** Use environment variables.

---

### LOW-04: No `.nvmrc` or Engine Field

**Description:** No Node.js version pinned. Different developers may use different versions.

**Fix:** Add to `package.json`: `"engines": { "node": ">=20.0.0" }` and create `.nvmrc`.

---

### LOW-05: Missing Type Safety on Webhook Payloads

**File:** `src/app/api/webhooks/retell/route.ts` (line 26)

**Description:** Retell webhook payload parsed with `JSON.parse` and accessed without runtime type validation.

**Fix:** Add Zod schema validation.

---

### LOW-06: `.env.example` Missing `RESEND_INBOUND_SECRET`

**Fix:** Add `RESEND_INBOUND_SECRET=` to `.env.example`.

---

### LOW-07: Inconsistent Error Response Format Across Routes

**Description:** Error responses vary (`{ error }`, `{ error, details }`, plain text, inconsistent status codes).

**Fix:** Standardize error response format.

---

### LOW-08: No API Versioning

**Description:** API routes have no versioning. Breaking changes affect all consumers simultaneously.

**Fix:** Consider `/api/v1/...` if external consumers exist.

---

### LOW-09: No Health Check Endpoint

**Fix:** Add `/api/health` that checks Supabase connectivity.

---

### LOW-10: Email Templates Are Inline HTML Strings

**Fix:** Use Handlebars templates (already a dependency) or React Email.

---

### LOW-11: `vitest.config.ts` Coverage Thresholds Not Set

**Fix:** Add coverage thresholds (70% branches/functions/lines/statements).

---

### LOW-12: No Dependency Vulnerability Scanning in CI

**Fix:** Add `npm audit --audit-level=high` to CI or enable Dependabot.

---

### LOW-13: Typo in Function Name `mergCompiledToolsIntoLlm`

**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:66`

**Fix:** Rename to `mergeCompiledToolsIntoLlm`.

---

### LOW-14: `next.config.ts` Missing `poweredByHeader: false`

**Fix:** Add `poweredByHeader: false` to hide `X-Powered-By: Next.js`.

---

## Production Readiness Checklist

| Item | Status | Notes |
|------|--------|-------|
| Security headers | **MISSING** | See HIGH-02 |
| Error monitoring (Sentry) | **MISSING** | See HIGH-03 |
| Distributed rate limiting | **MISSING** | See HIGH-01 |
| Middleware active | **MISSING** | See HIGH-04 |
| Database RLS complete | **FAILING** | 3 critical gaps (C3, C4, C5) |
| Admin role checks | **FAILING** | See CRITICAL-11 |
| Webhook idempotency | **MISSING** | See CRITICAL-12 |
| SSRF protection | **MISSING** | See CRITICAL-09 |
| Request tracing / IDs | **MISSING** | See MEDIUM-11 |
| Health check endpoint | **MISSING** | See LOW-09 |
| Log level filtering | **MISSING** | See MEDIUM-11 |
| Dependency scanning | **MISSING** | See LOW-12 |
| Test coverage | **MINIMAL** | See Phase 4 |
| `.env.example` complete | **PARTIAL** | Missing `RESEND_INBOUND_SECRET` |
| PII not logged | **FAILING** | See HIGH-07 |
| CORS configured | **MISSING** | See MEDIUM-04 |
| Node version pinned | **MISSING** | See LOW-04 |
| Build warnings enforced | **MISSING** | |
| OAuth state one-time use | **MISSING** | See HIGH-09 |

---

## What's Working Well

- **Build is clean:** 0 errors, 0 warnings
- **TypeScript strict mode** enabled
- **SQL injection: PASS** — all Supabase queries use parameterized client
- **XSS: MOSTLY PASS** — no `dangerouslySetInnerHTML`, proper `escapeHtml()` on emails (one gap: recording_url)
- **CSRF: PASS** — SameSite=Lax cookies, webhook signature verification on Retell/Stripe/Housecall Pro
- **RLS enabled on most tables** — base schema + migrations cover 30+ tables
- **Service role key properly restricted** to server-side code only
- **All webhook endpoints verify signatures** (Retell, Stripe, Housecall Pro, Resend)
- **All cron routes use Bearer token auth** via `CRON_SECRET`
- **`.env` files properly gitignored** — secrets never committed
- **48/49 env vars documented** in `.env.example`
- **AES-256-GCM encryption** for OAuth tokens and integration API keys at rest
- **Good database index coverage** across migrations
- **No N+1 query patterns** detected
- **No large bundle import issues**
- **Open redirect prevention** in auth callback (`startsWith("/") && !startsWith("//")`)

---

## Priority Fix Order

### Before Launch (Blocking)

1. **CRITICAL-01** — Add auth to web call creation endpoints
2. **CRITICAL-02** — Add CAPTCHA + persistent rate limiting to demo-call
3. **CRITICAL-03, 04** — Fix `make_subscriptions` and `n8n_subscriptions` RLS
4. **CRITICAL-05** — Enable RLS on `agent_call_handling`
5. **CRITICAL-07** — Add ownership check to `setup-account`
6. **CRITICAL-08** — Add authorization to `increment_total_calls` RPC
7. **CRITICAL-09** — Validate webhook URLs (SSRF prevention)
8. **CRITICAL-10** — Fix `get-client-id` null org bypass
9. **CRITICAL-11** — Add role checks to all admin routes
10. **CRITICAL-12** — Add webhook idempotency
11. **HIGH-04** — Create `middleware.ts` to activate role-based routing
12. **HIGH-01** — Replace in-memory rate limiter with persistent store
13. **HIGH-02** — Add security headers
14. **HIGH-03** — Add error monitoring (Sentry)

### First Week Post-Launch

15. **CRITICAL-06** — Fix SOQL injection
16. **HIGH-05 through HIGH-16** — Tool auth, XSS, OAuth replay, agent config auth, Stripe caching, leads limit
17. **MEDIUM-02, 03** — Race conditions (recipe counter, retry queue)
18. **MEDIUM-08** — First-call notification race

### First Month

19. All remaining MEDIUM items
20. Add test coverage for critical paths (Phase 4)
21. LOW items as time permits

---

*Report generated 2026-02-27. 64 findings across 12 CRITICAL, 16 HIGH, 22 MEDIUM, 14 LOW.*
