# Cross-Property Integration Audit

## Summary

Audited all integration seams across the three properties (Marketing, Admin/Startup, Client Portal) plus external service integrations (Stripe, Retell, Twilio, OAuth providers). The codebase is architecturally sound with a clean monorepo-style Next.js app-router approach using route groups `(marketing)`, `(startup)`, and `(portal)`. All external API calls use production URLs. Stripe keys are loaded from env vars, not hardcoded. The auth flow is well-protected with open-redirect prevention. Several integration-level issues were found, most notably around OAuth callback redirect paths and a missing `/login` page file routing issue.

---

## BLOCKERS

- [BLOCKER] [OAuth Callback Redirect] -- The OAuth callback handler at `src/app/api/oauth/callback/route.ts:17-23` redirects errors to hard-coded path `/portal/automations` (e.g. `${NEXT_PUBLIC_APP_URL}/portal/automations?oauth_error=...`). This is the OLD non-slug portal path. The portal now uses `/<slug>/portal/automations`. While the middleware at `src/lib/supabase/middleware.ts:128-143` does redirect `/portal/...` to `/<slug>/portal/...` for client users, this adds an unnecessary redirect hop, and the error query params (`oauth_error=...`) are lost during the redirect because `middleware.ts` rewrites the pathname but not the search params. On error paths, the user lands at the correct page but **the error toast/message will never display**. The success redirect on line 244 correctly uses `redirectPath` from state, but the three early-exit error redirects on lines 17, 23, and 32 bypass the state and hardcode `/portal/automations`.

- [BLOCKER] [Login Page Post-Login Redirect] -- The login page at `src/app/(auth)/login/page.tsx:37` always does `router.push("/dashboard")` after successful sign-in, regardless of user role. Client users (role `client_admin` / `client_member`) should be redirected to `/<slug>/portal`, not `/dashboard`. While the middleware will eventually catch this and redirect them, it causes a visible flash: login -> briefly loads `/dashboard` -> middleware redirect -> `/<slug>/portal`. This is a broken UX for client users logging in. The middleware handles the redirect but the client-side navigation causes an unnecessary round trip.

---

## WARNINGS

- [WARNING] [Stripe Webhook -> Client Provisioning] -- In `src/app/api/webhooks/stripe/route.ts:187`, the `listUsers` call uses `perPage: 1000` to search for existing auth users when invite link generation fails. This is a linear scan that will degrade as the user base grows. If the platform scales to thousands of users, this fallback path will time out. Should use `getUserByEmail` or an indexed lookup instead.

- [WARNING] [Checkout Return URL Mismatch] -- The `marketing-checkout` route at `src/app/api/marketing-checkout/route.ts:82-83` uses `request.nextUrl.origin` for success/cancel URLs (pointing to `/signup?success=true`), while the `checkout` route at `src/app/api/checkout/route.ts:92-97` uses `process.env.NEXT_PUBLIC_APP_URL` and points to `/pricing/${org.slug}?success=true`. The two checkout flows will behave differently in environments where the request origin differs from the configured app URL (e.g. behind a CDN or proxy). Both should use a consistent origin source.

- [WARNING] [Sign-Up Page Prices Hardcoded] -- The sign-up page at `src/app/(auth)/signup/page.tsx:9-28` hardcodes plan names, prices ($499/$399 Starter, $899/$719 Professional) and feature lists. If the database plan prices change, the sign-up page will show stale prices. The marketing pricing page at `src/app/(marketing)/pricing/page.tsx` also appears to use hardcoded values. These should either fetch from the DB or a shared config.

- [WARNING] [OAuth State Fallthrough on Auth Failure] -- In `src/app/api/oauth/callback/route.ts:73-76`, if session verification fails, the code silently continues with a comment saying "The encrypted state with 10-min expiry is the primary protection." This means if a user's Supabase session has expired but they still have a valid OAuth state token (within 10 minutes), the connection will be stored for the `clientId` in the state without verifying the current user owns that client. The encrypted state IS signed, but this weakens the defense-in-depth.

- [WARNING] [Cron Jobs Missing Usage-Alerts Entry] -- The `vercel.json` configures cron jobs for `/api/cron/daily-digest` and `/api/cron/checkin-email` but NOT for `/api/cron/usage-alerts`. The usage-alerts cron route exists at `src/app/api/cron/usage-alerts/route.ts` and has proper auth, but it will never be triggered automatically. Clients with usage alert settings configured will never receive alerts.

- [WARNING] [Client Status Not Checked on Portal Login] -- The middleware at `src/lib/supabase/middleware.ts` checks user role and client slug for portal access, but does NOT check the client's `status` field (e.g. `cancelled`, `past_due`). A client whose subscription was cancelled (status set to `cancelled` by the Stripe webhook) can still log in and access the full portal. There is no enforcement of billing status at the access control level.

- [WARNING] [Agent GET Endpoint Missing Org Scoping] -- The agents list endpoint at `src/app/api/agents/route.ts:9-14` queries all agents without filtering by `organization_id`. It relies entirely on Supabase RLS policies to scope data. If RLS is misconfigured or has gaps, this could leak agents across organizations. The clients endpoint at `src/app/api/clients/route.ts` has the same pattern. While RLS should handle this, explicit org scoping would be safer defense-in-depth.

- [WARNING] [create-web-call Auth Level] -- The `create-web-call` endpoint at `src/app/api/agents/create-web-call/route.ts` uses the public-endpoint rate limiter instead of `requireAuth`. It creates a Retell web call for any agent_id passed to it. While the agent must exist in the database, any unauthenticated user who knows an agent UUID can create web calls. This is by design for the widget, but could be abused to generate costs.

- [WARNING] [Receipt Email "reply to this email" Promise] -- In `src/app/api/webhooks/stripe/route.ts:734`, the receipt email says "reply to this email" but is sent from `billing@invarialabs.com` via Resend. Unless Resend is configured to forward replies, customers who reply will get a bounce or no response.

---

## COSMETIC

- [COSMETIC] [Duplicate escapeHtml Functions] -- The `escapeHtml` function is defined twice in `src/app/api/webhooks/stripe/route.ts` (lines 765-772) and `src/app/api/auth/route.ts` (lines 163-165). The implementations are slightly different (the Stripe one also escapes single quotes). Should be extracted to a shared utility.

- [COSMETIC] [Retell API URL Style Inconsistency] -- Retell API calls use a mix of URL patterns: some use path-based helper `retellFetch()` (e.g. in `src/app/api/agents/[id]/config/route.ts`), some use inline full URLs (`https://api.retellai.com/...`), and one even mixes v2 and non-v2 endpoints in the same file. While functionally correct, this makes maintenance harder.

- [COSMETIC] [Missing Error Handling for Prompt Regeneration] -- Both `src/app/api/onboarding/create-agent/route.ts:400` and `src/app/api/onboarding/go-live/route.ts:53` call `regeneratePrompt()` and catch errors silently. If prompt regeneration fails, the agent goes live with a potentially incomplete prompt. The user is not notified.

- [COSMETIC] [Cron Schedule Identical] -- Both cron jobs in `vercel.json` use `"0 * * * *"` (top of every hour). The daily digest route internally checks the hour to send at the right time, which is correct, but running every hour when most checks result in no-ops is slightly wasteful. Not a problem, just noise.

- [COSMETIC] [Client Portal Dashboard Page Fetches Without Error Boundary] -- The portal dashboard at `src/app/(portal)/[clientSlug]/portal/page.tsx:138` fetches onboarding status and other data but the page does not have an explicit error boundary component (unlike the marketing layout which has `error.tsx`).

---

## Integration Points Audited

### 1. Marketing CTA -> Signup Flow
- **Path**: Marketing home (`/`) -> "View Pricing" CTA -> `/pricing` page -> "Get Started" -> `/signup` page -> `POST /api/marketing-checkout` -> Stripe Checkout -> Stripe webhook (`checkout.session.completed`) -> auto-provision client + send welcome email -> `/setup-account` page
- **Verdict**: Flow is complete and functional. The `marketing-checkout` route correctly maps plan slugs to `PLATFORM_PLAN_ID_STARTER` / `PLATFORM_PLAN_ID_PROFESSIONAL` env vars. Stripe webhook handler creates client, user, permissions, and onboarding record. Welcome email sends invite link pointing to `/auth/callback?next=/setup-account`. The setup-account page loads user data, updates password, and redirects to portal.
- **Issue Found**: Sign-up page hardcodes prices (see WARNING above).

### 2. Auth Callback -> Role-Based Routing
- **Path**: Supabase auth callback at `/auth/callback` exchanges code for session, then redirects to `next` param (default `/dashboard`). Middleware then routes based on role.
- **Verdict**: Open redirect prevention is properly implemented (line 9: checks `startsWith("/")` and `!startsWith("//")`). Middleware correctly routes client users to `/<slug>/portal` and startup users to `/dashboard`.

### 3. Admin Creates Client -> Client Portal Access
- **Path**: `POST /api/clients` -> creates client row -> admin manually creates user with `invite-member` action
- **Verdict**: The admin `POST /api/clients` creates the client row but does NOT auto-create a user or send an invite. The `invite-member` action in `POST /api/auth` creates startup team members, not client users. Client user creation currently only happens via the Stripe webhook auto-provisioning. Manual client creation from the admin dashboard would create a client with no associated user, meaning no one can log into that client's portal. This is likely by design (admin-created clients are placeholders until Stripe checkout), but worth noting.

### 4. Admin Disables Client -> Client Portal Access
- **Path**: Stripe `customer.subscription.deleted` webhook -> sets client `status` to `cancelled`
- **Verdict**: The webhook correctly updates client status to `cancelled` and clears `stripe_subscription_id`. However, the middleware does NOT check client status before allowing portal access (see WARNING above). A cancelled client can still log in and use the portal.

### 5. Admin Agent Changes -> Client Portal Views
- **Path**: Both admin (`/agents/[id]/agent-config`) and client portal (`/portal/agents/[id]/agent-settings`) call `GET /api/agents/[id]/config` and `PATCH /api/agents/[id]/config`
- **Verdict**: Both properties use the same API routes. Changes made by the admin are immediately visible to the client and vice versa. The Retell API is the source of truth for agent configuration, and both sides read/write to it.

### 6. Stripe Key Configuration
- **Path**: `src/lib/stripe.ts` loads `STRIPE_SECRET_KEY` from env vars
- **Verdict**: No hardcoded test keys found anywhere in the codebase. `STRIPE_SECRET_KEY` is read at runtime. `STRIPE_WEBHOOK_SECRET` is validated in the webhook handler. The Stripe API version is pinned to `2025-01-27.acacia`.

### 7. Stripe Billing State Propagation
- **Path**: Webhook handles `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`, `invoice.paid`
- **Verdict**: Comprehensive coverage. Subscription status changes correctly propagate to client `status` field. `past_due` is handled. Reactivation on payment recovery is handled. Receipt emails are sent on `invoice.paid`. The initial checkout invoice is correctly skipped for receipt emails (`billing_reason === "subscription_create"`).

### 8. Retell Agent Creation Flow
- **Path**: Onboarding `POST /api/onboarding/create-agent` -> Retell API `POST /v2/agents` -> stores `retell_agent_id` in DB
- **Verdict**: Complete and correct. Template agent config is fetched from Retell, cloned to create a new agent. The `retell_agent_id` is stored in the `agents` table. Subsequent operations (config, publish, delete) use this ID to communicate with Retell.

### 9. Phone Number Purchase -> Retell Import
- **Path**: `POST /api/phone-numbers/purchase` -> Twilio purchase -> SIP trunk association -> Retell import -> Hiya registration -> DB insert
- **Verdict**: Multi-step flow is well-implemented with warnings array to track partial failures. Retell import uses `https://api.retellai.com/import-phone-number` (production URL). SIP termination URI, username, and password are loaded from env vars. If Retell import fails, the number is still purchased (Twilio) but the failure is reported as a warning.

### 10. Retell Webhook Handler
- **Path**: `POST /api/webhooks/retell` -> signature verification -> agent lookup -> call log insert/update -> post-call actions
- **Verdict**: Properly verifies webhook signature using `Retell.verify()`. Maps `retell_agent_id` back to internal agent to find `organization_id` and `client_id`. Handles `call_started`, `call_ended`, and `call_analyzed` events. Post-call actions, automation recipes, Zapier/Make/n8n dispatch, and lead scoring all execute in parallel on `call_analyzed`.

### 11. All Retell API URLs
- **Verdict**: Every Retell API call in the codebase uses `https://api.retellai.com` (production). No staging, sandbox, or localhost URLs found for Retell. Mix of v1 (`/get-agent/`, `/update-agent/`) and v2 (`/v2/agents`, `/v2/create-web-call`) endpoints -- both are valid Retell API patterns.

### 12. Webhook/Callback URL Configuration
- **Verdict**: All webhook callback URLs use `process.env.NEXT_PUBLIC_APP_URL` (configurable). OAuth callback URL: `${NEXT_PUBLIC_APP_URL}/api/oauth/callback`. Stripe webhook URL is configured in the Stripe dashboard (not in code). The only localhost/127.0.0.1 references are in the SSRF protection blocklist in `src/app/api/automations/webhook-test/route.ts`, which is correct behavior.

### 13. OAuth Authorize -> Callback -> Token Storage
- **Path**: `GET /api/oauth/authorize` -> redirect to provider -> provider callback to `GET /api/oauth/callback` -> exchange code for tokens -> encrypt and store in `oauth_connections` -> register Retell tools
- **Verdict**: Flow is complete. OAuth state is encrypted with expiry. Provider authorization checks verify client ownership. Tokens are encrypted before storage. Refresh tokens are stored where available. Multiple providers supported (Google, Slack, HubSpot, Salesforce, GoHighLevel, Calendly, QuickBooks, Notion).

### 14. Frontend Fetch -> API Route Existence
Every `fetch()` call in the frontend was traced to a corresponding API route file:
- `/api/agents` -> `src/app/api/agents/route.ts` (GET, POST)
- `/api/agents/[id]/config` -> `src/app/api/agents/[id]/config/route.ts` (GET, PATCH)
- `/api/agents/[id]/chat` -> `src/app/api/agents/[id]/chat/route.ts`
- `/api/agents/[id]/conversation-flow` -> `src/app/api/agents/[id]/conversation-flow/route.ts`
- `/api/agents/[id]/knowledge-base` -> `src/app/api/agents/[id]/knowledge-base/route.ts`
- `/api/agents/[id]/versions` -> `src/app/api/agents/[id]/versions/route.ts`
- `/api/agents/[id]/publish` -> `src/app/api/agents/[id]/publish/route.ts`
- `/api/agents/[id]/voices` -> `src/app/api/agents/[id]/voices/route.ts`
- `/api/agents/create-web-call` -> `src/app/api/agents/create-web-call/route.ts`
- `/api/clients` -> `src/app/api/clients/route.ts`
- `/api/auth` -> `src/app/api/auth/route.ts`
- `/api/auth/reset-password` -> `src/app/api/auth/reset-password/route.ts`
- `/api/billing` -> `src/app/api/billing/route.ts`
- `/api/checkout` -> `src/app/api/checkout/route.ts`
- `/api/marketing-checkout` -> `src/app/api/marketing-checkout/route.ts`
- `/api/client/billing` -> `src/app/api/client/billing/route.ts`
- `/api/client/plan-access` -> `src/app/api/client/plan-access/route.ts`
- `/api/contact` -> `src/app/api/contact/route.ts`
- `/api/demo-call` -> `src/app/api/demo-call/route.ts`
- `/api/settings` -> `src/app/api/settings/route.ts`
- `/api/leads` -> `src/app/api/leads/route.ts`
- `/api/leads/[id]` -> `src/app/api/leads/[id]/route.ts`
- `/api/leads/[id]/score` -> `src/app/api/leads/[id]/score/route.ts`
- `/api/business-settings` -> `src/app/api/business-settings/route.ts`
- `/api/business-settings/hours` -> `src/app/api/business-settings/hours/route.ts`
- `/api/business-settings/faqs` -> `src/app/api/business-settings/faqs/route.ts`
- `/api/business-settings/faqs/[id]` -> `src/app/api/business-settings/faqs/[id]/route.ts`
- `/api/business-settings/policies` -> `src/app/api/business-settings/policies/route.ts`
- `/api/business-settings/policies/[id]` -> `src/app/api/business-settings/policies/[id]/route.ts`
- `/api/business-settings/services` -> `src/app/api/business-settings/services/route.ts`
- `/api/business-settings/services/[id]` -> `src/app/api/business-settings/services/[id]/route.ts`
- `/api/business-settings/locations` -> `src/app/api/business-settings/locations/route.ts`
- `/api/business-settings/locations/[id]` -> `src/app/api/business-settings/locations/[id]/route.ts`
- `/api/phone-numbers` -> `src/app/api/phone-numbers/route.ts`
- `/api/phone-numbers/search` -> `src/app/api/phone-numbers/search/route.ts`
- `/api/phone-numbers/purchase` -> `src/app/api/phone-numbers/purchase/route.ts`
- `/api/phone-numbers/import` -> `src/app/api/phone-numbers/import/route.ts`
- `/api/phone-numbers/caller-id` -> `src/app/api/phone-numbers/caller-id/route.ts`
- `/api/phone-numbers/[id]` -> `src/app/api/phone-numbers/[id]/route.ts`
- `/api/phone-numbers/[id]/assign` -> `src/app/api/phone-numbers/[id]/assign/route.ts`
- `/api/sip-trunks` -> `src/app/api/sip-trunks/route.ts`
- `/api/sip-trunks/[id]` -> `src/app/api/sip-trunks/[id]/route.ts`
- `/api/integrations` -> `src/app/api/integrations/route.ts`
- `/api/conversation-flows` -> `src/app/api/conversation-flows/route.ts`
- `/api/conversation-flows/[id]` -> `src/app/api/conversation-flows/[id]/route.ts`
- `/api/automations/recipes` -> `src/app/api/automations/recipes/route.ts`
- `/api/automations/recipes/[id]` -> `src/app/api/automations/recipes/[id]/route.ts`
- `/api/automations/client` -> `src/app/api/automations/client/route.ts`
- `/api/automations/client/[id]` -> `src/app/api/automations/client/[id]/route.ts`
- `/api/automations/webhook-test` -> `src/app/api/automations/webhook-test/route.ts`
- `/api/oauth/connections` -> `src/app/api/oauth/connections/route.ts`
- `/api/oauth/disconnect` -> `src/app/api/oauth/disconnect/route.ts`
- `/api/oauth/authorize` -> `src/app/api/oauth/authorize/route.ts`
- `/api/oauth/google/calendars` -> `src/app/api/oauth/google/calendars/route.ts`
- `/api/oauth/google/sheets` -> `src/app/api/oauth/google/sheets/route.ts`
- `/api/oauth/slack/channels` -> `src/app/api/oauth/slack/channels/route.ts`
- `/api/onboarding/start` -> `src/app/api/onboarding/start/route.ts`
- `/api/onboarding/status` -> `src/app/api/onboarding/status/route.ts`
- `/api/onboarding/create-agent` -> `src/app/api/onboarding/create-agent/route.ts`
- `/api/onboarding/go-live` -> `src/app/api/onboarding/go-live/route.ts`
- `/api/onboarding/test-call` -> `src/app/api/onboarding/test-call/route.ts`
- `/api/onboarding/test-sms` -> `src/app/api/onboarding/test-sms/route.ts`
- `/api/onboarding/step/[step]` -> `src/app/api/onboarding/step/[step]/route.ts`
- `/api/campaigns` -> `src/app/api/campaigns/route.ts`
- `/api/campaigns/[id]` -> `src/app/api/campaigns/[id]/route.ts`
- `/api/usage/agent-costs` -> `src/app/api/usage/agent-costs/route.ts`
- `/api/usage/forecast` -> `src/app/api/usage/forecast/route.ts`
- `/api/usage/alerts` -> `src/app/api/usage/alerts/route.ts`
- `/api/pii-redaction` -> `src/app/api/pii-redaction/route.ts`
- `/api/post-call-actions` -> `src/app/api/post-call-actions/route.ts`
- `/api/solutions` -> `src/app/api/solutions/route.ts`

**No orphaned API routes found.** All API routes are either called from the frontend or are webhook/cron endpoints.

### 15. Supabase Client Types
- **Server Client** (`createClient`): Uses anon key with cookie-based auth. Subject to RLS. Used by `requireAuth()`.
- **Service Client** (`createServiceClient`): Uses service role key. Bypasses RLS. Used by webhooks, cron jobs, and operations that need cross-tenant access.
- **Browser Client** (`createClient` from `client.ts`): Uses anon key with browser session. Subject to RLS.
- **Verdict**: Correct separation. Service client is only used where needed (webhooks, admin operations, cross-tenant queries).

### 16. Middleware Auth Enforcement
- **Verdict**: Middleware runs on all non-static routes. Public routes are explicitly listed. API routes are excluded from middleware redirects (they handle their own auth via `requireAuth`). Client users are validated against their slug. Role-based access prevents startup users from accessing portal and vice versa.
