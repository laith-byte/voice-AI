# Cross-Property Integration Audit -- Second Pass
**Date:** 2026-02-22

---

## BLOCKERS

### B-INT-1: `/api/contact` has NO rate limiting
**File:** `src/app/api/contact/route.ts`
**Severity:** BLOCKER
The contact form endpoint is completely public (no `requireAuth`) and has **no rate limiting** at all. No `publicEndpointLimiter` import, no IP check. An attacker can spam unlimited emails through this endpoint, burning through your Resend quota and potentially getting the `invarialabs.com` domain blacklisted.

Every other public endpoint (`/api/marketing-checkout`, `/api/demo-call`, `/api/auth`, `/api/auth/reset-password`) correctly uses `publicEndpointLimiter`. This one was missed.

### B-INT-2: `/api/cron/usage-alerts` is NOT configured in `vercel.json`
**File:** `vercel.json`
**Severity:** BLOCKER
`vercel.json` only defines two cron jobs:
- `/api/cron/daily-digest` (schedule: `0 * * * *`)
- `/api/cron/checkin-email` (schedule: `0 * * * *`)

The `/api/cron/usage-alerts` route exists at `src/app/api/cron/usage-alerts/route.ts` and works correctly (has CRON_SECRET auth, full logic), but it is **never invoked** because it is not in `vercel.json`. Clients who configure usage alerts will never receive alert emails.

**Note:** This was flagged in the first audit as well. It remains unfixed.

### B-INT-3: OAuth callback redirects to bare `/portal` path, not slug-based URL
**File:** `src/app/api/oauth/callback/route.ts`
**Severity:** BLOCKER
All error and success redirects in the OAuth callback use:
```
`${process.env.NEXT_PUBLIC_APP_URL}/portal/automations?oauth_error=...`
```
or
```
`${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?connected=${provider}`
```

When `redirectPath` is a portal-relative path like `/portal/automations`, this redirects to `/portal/automations?connected=google`. The middleware at `src/lib/supabase/middleware.ts:128-145` will then detect `/portal/...` and redirect the client user to `/<slug>/portal/...`.

**However**, during this redirect, the middleware does:
```ts
url.pathname = `/${slug}${pathname}`;
url.search = request.nextUrl.search;
```
This **does** preserve the query string (`?connected=google` or `?oauth_error=...`) because `url.search` is explicitly set. So the query params survive the double-redirect.

**Revised assessment:** The double-redirect is wasteful (two round trips instead of one) but **functionally correct** because `url.search` is preserved. Downgrading from BLOCKER to WARNING (see W-INT-1).

---

## WARNINGS

### W-INT-1: OAuth callback causes unnecessary double-redirect for client users
**File:** `src/app/api/oauth/callback/route.ts`
**Severity:** WARNING
As analyzed in B-INT-3 above, the OAuth callback redirects to `/portal/automations?connected=google`, which middleware then redirects to `/<slug>/portal/automations?connected=google`. This is two redirects when one would suffice. The `state` object already contains `clientId` -- the callback could look up the client slug and redirect directly to `/<slug>/portal/automations`.

### W-INT-2: `TWILIO_PHONE_NUMBER` vs `TWILIO_FROM_NUMBER` variable split is confusing
**File:** `.env.example`, `src/lib/twilio.ts`, `src/app/api/tools/sms/send/route.ts`, `src/app/api/tools/confirmation/send/route.ts`
**Severity:** WARNING
Two different Twilio env variables exist:
- `TWILIO_PHONE_NUMBER` -- used in `src/lib/twilio.ts:20` by the `sendSms()` helper
- `TWILIO_FROM_NUMBER` -- used in `src/app/api/tools/sms/send/route.ts:30` and `src/app/api/tools/confirmation/send/route.ts:41`

Both are listed in `.env.example` (lines 73-74). In practice, these likely need to be set to the same value. If only one is set, SMS will work from one code path but silently fail from the other. This is not a functional bug if both are configured, but it is a maintenance hazard.

### W-INT-3: Cron schedules are both `0 * * * *` (every hour) -- consider if `usage-alerts` needs different schedule
**File:** `vercel.json`
**Severity:** WARNING
Both configured crons run every hour. Once `usage-alerts` is added (per B-INT-2), consider whether hourly is the right frequency for usage checks -- it could generate hourly alert emails if the 24-hour cooldown window is not enough for certain edge cases (e.g., multiple alert types).

### W-INT-4: Phone number purchase does not roll back on partial failure
**File:** `src/app/api/phone-numbers/purchase/route.ts`
**Severity:** WARNING
If Step 1 (Twilio purchase) succeeds but Step 3 (Retell import) fails, the number is purchased and stored in DB but Retell does not know about it. The response includes `warnings` array to inform the caller, but there is no retry mechanism or admin notification. The number will appear in the UI but inbound calls will not be routed to the AI agent until the Retell import is manually retried.

### W-INT-5: `handleCheckoutCompleted` email invite link uses `NEXT_PUBLIC_APP_URL` with `/auth/callback` path
**File:** `src/app/api/webhooks/stripe/route.ts:180`
**Severity:** WARNING
The invite `redirectTo` is set to:
```
`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/setup-account`
```
This is correct for the Supabase auth callback flow. However, the file `src/app/api/oauth/callback/route.ts` handles OAuth provider callbacks, not Supabase auth callbacks. The Supabase auth callback lives at `src/app/auth/callback/` (no `/api/`). Verify that the `auth/callback` page route actually exists and handles the invite link properly.

---

## COSMETIC

### C-INT-1: `customer.subscription.updated` handled in Stripe webhook but not listed in switch comment
**File:** `src/app/api/webhooks/stripe/route.ts:65`
**Severity:** COSMETIC
The audit instructions list `checkout.session.completed`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` as the events to verify. The code also handles `customer.subscription.updated` (line 65), which is good (handles `past_due` and reactivation). This is not an issue -- just noting it for completeness.

### C-INT-2: Demo call uses `RETELL_FROM_NUMBER` while SMS tools use `TWILIO_FROM_NUMBER`
**File:** `src/app/api/demo-call/route.ts:49`
**Severity:** COSMETIC
The demo call outbound uses `RETELL_FROM_NUMBER` (a Retell-specific number for marketing demos), while operational SMS uses `TWILIO_FROM_NUMBER`. These are intentionally different numbers for different purposes, but the naming is potentially confusing to new developers.

---

## INTEGRATION FLOWS VERIFIED

### 1. Marketing -> Signup -> Stripe -> Provisioning: PASS
- **Pricing CTA** (`src/app/(marketing)/pricing/page.tsx:414-436`): Calls `POST /api/marketing-checkout` with `{ plan, billing_period }`. Enterprise plan links to `/contact` instead.
- **Checkout route** (`src/app/api/marketing-checkout/route.ts`): Rate-limited. Looks up `client_plans` by plan ID from env vars, fetches org and Stripe connected account, creates Stripe checkout session with `success_url: /signup?success=true`, `cancel_url: /signup?canceled=true`. Metadata includes `plan_id`, `organization_id`, `org_slug`.
- **Stripe webhook** (`src/app/api/webhooks/stripe/route.ts:94-219`): `checkout.session.completed` handler:
  1. Looks up plan from metadata
  2. Checks for existing user (idempotent)
  3. Creates client with slug, status "active", stripe IDs
  4. Generates auth invite link via `supabase.auth.admin.generateLink`
  5. Creates user row in `users` table
  6. Sends branded welcome email via Resend
  7. Sets `client_access` permissions based on plan features
  8. Creates `client_onboarding` record
- **Verdict:** Complete end-to-end. All steps verified.

### 2. Login -> Role-based redirect: PASS
- **Login page** (`src/app/(auth)/login/page.tsx:26-43`): After `signInWithPassword`, calls `supabase.auth.getUser()` (B-4 fix verified -- uses `getUser()` not session). Checks `user_metadata.role`:
  - `client_admin` or `client_member` -> `router.push("/portal")`
  - All others -> `router.push("/dashboard")`
- **Middleware** (`src/lib/supabase/middleware.ts:128-164`):
  - Client user at `/portal` -> redirected to `/<slug>/portal` (correct)
  - Client user at `/dashboard` -> redirected to `/<slug>/portal` (correct, line 148-154)
  - Startup user at `/portal` -> redirected to `/dashboard` (correct, line 140-144)
  - Startup user at `/<slug>/portal/...` -> redirected to `/dashboard` (correct, line 168-171)
- **Verdict:** No flash. Correct destinations for both user types.

### 3. Middleware admin route blocking: PASS
- **Admin routes** (`src/lib/supabase/middleware.ts:158`): `["/agents", "/clients", "/settings", "/billing", "/saas", "/automations", "/workflows"]`
- Client user at `/agents` -> middleware detects `isClientUser` + `pathname.startsWith("/agents")` -> redirects to `/<slug>/portal` (correct)
- Startup user at `/agents` -> `isClientUser` is false -> no redirect, passes through (correct)
- **Edge case check:** No slug-based portal routes start with these prefixes, so no false positives. The `/automations` route could theoretically conflict with a `/<slug>/portal/automations` path, but that is caught by `isSlugPortalPath()` first (line 167), not the admin route check.
- **Verdict:** Clean separation. No conflicts.

### 4. OAuth callback error handling: PASS (with warning)
- **Error paths** (`src/app/api/oauth/callback/route.ts`):
  - Provider error -> redirect with `?oauth_error=<error>` to `/portal/automations`
  - Missing params -> redirect with `?oauth_error=missing_params`
  - Invalid state -> redirect with `?oauth_error=invalid_state`
  - Token exchange failed -> redirect with `?oauth_error=token_exchange_failed` to `redirectPath`
  - Save failed -> redirect with `?oauth_error=save_failed` to `redirectPath`
  - Success -> redirect with `?connected=<provider>` to `redirectPath`
- **Query string preservation:** Middleware at line 134-135 does `url.pathname = /${slug}${pathname}; url.search = request.nextUrl.search;` -- query string IS preserved during the `/portal` -> `/<slug>/portal` redirect.
- **`NextURL.search` behavior:** In Next.js, `NextURL.search` includes the leading `?`. Confirmed correct.
- **Verdict:** Functionally correct. Double-redirect is wasteful but not broken (see W-INT-1).

### 5. Admin agent config -> Retell sync -> Client portal visibility: PASS
- **GET** (`src/app/api/agents/[id]/config/route.ts:67-231`): Uses `requireAuth()` -- any authenticated user (admin or client) can read. Fetches from Retell API, maps fields to a normalized config structure. Strips language directives for clean UI display.
- **PATCH** (`src/app/api/agents/[id]/config/route.ts:234-496`): Uses `requireAuth()` -- any authenticated user can write. Updates both Retell LLM and agent-level fields. Language directive injection/stripping handled correctly.
- **Cross-visibility:** Both admin and client hit the same API endpoint. Changes from one side are reflected via the shared Retell backend. No caching layer that could cause stale reads.
- **Verdict:** Fully shared. Changes visible immediately.

### 6. Phone number lifecycle: PASS (with warning)
- **Purchase** (`src/app/api/phone-numbers/purchase/route.ts`): 5-step pipeline:
  1. Twilio purchase -> `twilioNumber.sid`
  2. SIP trunk association (if `TWILIO_SIP_TRUNK_SID` set)
  3. Retell import with SIP credentials
  4. Hiya registration (if credentials + businessName present)
  5. DB insert with all IDs
  - Warnings returned for partial failures (see W-INT-4)
- **Import** (`src/app/api/phone-numbers/import/route.ts`): 3-step (skip Twilio purchase + SIP, go straight to Retell + Hiya + DB). Sets `type: "imported"`, `twilio_sid: null`.
- **Delete** (`src/app/api/phone-numbers/[id]/route.ts`): Releases from Twilio (if `twilio_sid`), deletes from Retell (if `retell_number_id`), deletes from DB.
- **Assign** (`src/app/api/phone-numbers/[id]/assign/route.ts`): Updates `agent_id` in DB, then syncs `inbound_agent_id` + `outbound_agent_id` to Retell.
- All routes use `requireAuth()`.
- **Verdict:** Complete lifecycle. Twilio -> SIP -> Retell -> Hiya -> DB flow is present.

### 7. Stripe webhook handlers: PASS
- **Signature verification** (`src/app/api/webhooks/stripe/route.ts:17-38`): Reads `stripe-signature` header, requires `STRIPE_WEBHOOK_SECRET` env var, uses `constructWebhookEvent()` which delegates to Stripe SDK's `webhooks.constructEvent()`. Raw body read via `request.text()`.
- **Events handled:**
  - `checkout.session.completed` -> full provisioning pipeline (see flow 1)
  - `customer.subscription.deleted` -> sets client `status: "cancelled"`, clears `stripe_subscription_id`
  - `customer.subscription.updated` -> handles `past_due`/`unpaid` status + reactivation
  - `invoice.payment_failed` -> sets client `status: "past_due"`
  - `invoice.paid` -> sends receipt email (skips `subscription_create` to avoid duplicate with welcome email)
- **Webhook logging:** All events logged to `webhook_logs` table.
- **Verdict:** All handlers correct. Signature verification solid.

### 8. Retell webhook handler: PASS
- **Signature verification** (`src/app/api/webhooks/retell/route.ts:18-21`): Uses `Retell.verify(rawBody, apiKey, signature)` from the official `retell-sdk`. Checks `x-retell-signature` header.
- **Events handled:**
  - `call_started` -> creates `call_logs` record with cost snapshot metadata
  - `call_ended` -> updates status to "completed", stores transcript + recording URL
  - `call_analyzed` -> stores summary + `post_call_analysis` data
- **Post-call automation:** On `call_analyzed`, runs PII redaction, post-call actions, automation recipes, Zapier/Make/n8n dispatch, and lead scoring -- all in parallel with error isolation.
- **First-call notification + call counter:** On `call_ended`, increments call counter and sends first-call email if applicable.
- **Webhook forwarding:** Forwards payload to agent-level and org-level webhook URLs.
- **Verdict:** Comprehensive handler. All three events properly handled.

### 9. Cron jobs: FAIL (see B-INT-2)
- **Configured in `vercel.json`:**
  - `/api/cron/daily-digest` -- `0 * * * *` (hourly)
  - `/api/cron/checkin-email` -- `0 * * * *` (hourly)
- **Missing from `vercel.json`:**
  - `/api/cron/usage-alerts` -- route exists, has CRON_SECRET auth, full implementation, but NEVER RUNS
- **CRON_SECRET auth:** All three cron routes verify `Authorization: Bearer ${CRON_SECRET}`. Confirmed:
  - `usage-alerts/route.ts:8-12` -- verified
  - `daily-digest/route.ts:11-15` -- verified
  - `checkin-email/route.ts:9-13` -- verified
- **Verdict:** FAIL due to B-INT-2. Two of three crons work; usage-alerts is dead.

### 10. Environment variables: PASS (with notes)
- **`.env.example` line 74:** `TWILIO_FROM_NUMBER=` -- present (B-7 fix confirmed)
- **`.env.example` line 73:** `TWILIO_PHONE_NUMBER=` -- also present
- **Usage map:**
  - `TWILIO_FROM_NUMBER` -> `src/app/api/tools/sms/send/route.ts:30`, `src/app/api/tools/confirmation/send/route.ts:41`
  - `TWILIO_PHONE_NUMBER` -> `src/lib/twilio.ts:20` (used by `sendSms()` helper)
  - `RETELL_FROM_NUMBER` -> `src/app/api/demo-call/route.ts:49` (marketing demo calls)
- **Verdict:** Both variables documented in `.env.example`. See W-INT-2 for the split concern.

### 11. Security checks: PASS (with B-INT-1 exception)
- **Hardcoded secrets:** No hardcoded API keys or secrets found in source. All sensitive values come from `process.env.*`.
- **Auth on API routes:** All protected routes use `requireAuth()`. Intentionally public routes:
  - Webhooks (`/api/webhooks/stripe`, `/api/webhooks/retell`) -- use signature verification instead
  - Cron jobs (`/api/cron/*`) -- use CRON_SECRET bearer token
  - Marketing endpoints (`/api/marketing-checkout`, `/api/demo-call`, `/api/contact`) -- public by design
  - Auth endpoints (`/api/auth`, `/api/auth/reset-password`) -- public by design
  - Retell tool endpoints (`/api/tools/*`) -- authenticated via `RETELL_TOOLS_API_KEY`
- **Rate limiting on public endpoints:**
  - `/api/marketing-checkout` -- YES (line 13-14)
  - `/api/demo-call` -- YES (line 26-27)
  - `/api/auth` -- YES (line 8-9)
  - `/api/auth/reset-password` -- YES (line 8-9)
  - `/api/contact` -- **NO** (BLOCKER B-INT-1)
- **`dangerouslySetInnerHTML`:** Not used anywhere in the `src/` directory. All HTML email templates use server-side `escapeHtml()` functions.
- **Verdict:** PASS with one exception (B-INT-1).

---

## SUMMARY

| Category | Count |
|----------|-------|
| BLOCKERS | 2     |
| WARNINGS | 5     |
| COSMETIC | 2     |

### Integration Flow Results

| # | Flow | Result |
|---|------|--------|
| 1 | Marketing -> Signup -> Stripe -> Provisioning | PASS |
| 2 | Login -> Role-based redirect | PASS |
| 3 | Middleware admin route blocking | PASS |
| 4 | OAuth callback error handling | PASS (with W-INT-1) |
| 5 | Admin agent config -> Retell sync -> Client portal | PASS |
| 6 | Phone number lifecycle | PASS (with W-INT-4) |
| 7 | Stripe webhook handlers | PASS |
| 8 | Retell webhook handler | PASS |
| 9 | Cron jobs | FAIL (B-INT-2) |
| 10 | Environment variables | PASS |
| 11 | Security checks | PASS (with B-INT-1) |

### Blockers requiring fix before launch:
1. **B-INT-1:** Add `publicEndpointLimiter` to `/api/contact/route.ts`
2. **B-INT-2:** Add `/api/cron/usage-alerts` to `vercel.json` crons configuration
