# Critical User Paths Walkthrough

**Audit date:** 2026-02-20
**Auditor:** critical-paths agent

---

## Flow 1: Sign Up -> Onboarding Wizard -> Land on Dashboard

### Verdict: PASS

### Trace

1. **Signup page** (`src/app/(auth)/signup/page.tsx`): User selects a plan (Starter/Professional, monthly/annual) and clicks "Get Started". Calls `POST /api/marketing-checkout` with `{ plan, billing_period }`.

2. **Marketing checkout API** (`src/app/api/marketing-checkout/route.ts`): Public endpoint with rate limiting. Looks up plan from `client_plans` table by env-var ID, fetches the org and Stripe connected account, creates a Stripe Checkout Session with `mode: "subscription"`. Metadata includes `plan_id`, `organization_id`, `org_slug`. Redirects user to Stripe. Success URL returns to `/signup?success=true`.

3. **Stripe webhook** (`src/app/api/webhooks/stripe/route.ts`): On `checkout.session.completed`:
   - Validates signature, extracts metadata (`plan_id`, `organization_id`, `org_slug`).
   - Creates client row with slug derived from email, status "active", `stripe_customer_id`, `stripe_subscription_id`.
   - Generates a Supabase invite link with `redirectTo: /auth/callback?next=/setup-account`.
   - Creates `users` row with `role: client_admin`.
   - Sends branded welcome email via Resend with the invite action link.
   - Sets `client_access` permissions based on plan boolean columns.
   - Creates `client_onboarding` record with `status: "not_started"`, `current_step: 1`.

4. **Auth callback** (`src/app/auth/callback/route.ts`): Exchanges code for session, redirects to `/setup-account`. Has open-redirect prevention.

5. **Setup account page** (`src/app/(auth)/setup-account/page.tsx`): User sets business name and password. Updates Supabase auth password, updates client name, then redirects to `/${clientSlug}/portal/onboarding`.

6. **Middleware** (`src/lib/supabase/middleware.ts`): Slug-based portal paths are validated -- the user's slug must match the URL slug. Client users on `/dashboard` are redirected to their portal.

7. **Portal layout** (`src/app/(portal)/[clientSlug]/layout.tsx`): Wraps children with `PortalSidebar`, `OnboardingProvider`, `DashboardThemeProvider`.

8. **Onboarding wizard** (`src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx`): 6-step wizard:
   - Step 1: Template selection (`POST /api/onboarding/start`)
   - Step 2: Business info (`PATCH /api/onboarding/step/2`)
   - Step 3: Business settings (hours, services, FAQs, policies)
   - Step 4: Call handling preferences (`PATCH /api/onboarding/step/4`)
   - Step 5: Test call (`POST /api/onboarding/create-agent` then `POST /api/onboarding/test-call`)
   - Step 6: Go live (`POST /api/onboarding/go-live`)
   Each step correctly saves to both the `client_onboarding` record and `business_settings` row.

9. **Create agent** (`src/app/api/onboarding/create-agent/route.ts`): Fetches template from Retell, creates agent in Retell API, inserts `agents` row, creates `widget_config`, `ai_analysis_config`, `campaign_config`, seeds default services/FAQs/policies/hours/locations from template, runs `regeneratePrompt()`.

10. **Go live** (`src/app/api/onboarding/go-live/route.ts`): Sets `status: "completed"`, `completed_at`, runs `regeneratePrompt()`.

11. **Portal dashboard** (`src/app/(portal)/[clientSlug]/portal/page.tsx`): Shows KPI cards, recent activity, agent grid. If onboarding is not completed, shows a banner to continue setup (does not force-redirect).

### Issues Found

- **None blocking.** The entire signup-to-dashboard path is well-connected. Webhook creates all necessary records, setup-account creates the password and redirects correctly, onboarding wizard steps save incrementally, and the dashboard renders with graceful empty states.

- **Minor: Idempotency edge case.** If the Stripe webhook fires twice for the same `checkout.session.completed`, the code checks for an existing `users` row by email but a race condition could create duplicate clients if two requests process simultaneously before either commits. Practically unlikely but worth noting.

- **Minor: `listUsers` with `perPage: 1000`** (line 187 of Stripe webhook). If the auth user table grows beyond 1000 users, the fallback search for an existing auth user could miss them. Should use a paginated search or filter by email.

---

## Flow 2: Create Agent -> Configure Settings -> Test It

### Verdict: PASS

### Trace

1. **Agent creation (startup admin)** (`src/app/api/agents/route.ts` POST): Takes `name`, `retell_agent_id`, `retell_api_key`, `client_id`, etc. Encrypts the API key, inserts into `agents` table. This is the startup admin's path for manually linking Retell agents.

2. **Agent creation (portal/onboarding)** (`src/app/api/onboarding/create-agent/route.ts`): The onboarding path creates agents automatically from templates by cloning the Retell template agent config. Both voice and chat/SMS agent types are handled.

3. **Agent config GET** (`src/app/api/agents/[id]/config/route.ts`): Fetches agent from DB, resolves Retell API key (agent-level -> org integration -> env var fallback), fetches full config from Retell API. Handles both voice agents (`/get-agent/`) and chat agents (`/get-chat-agent/`). Handles both inline LLM and separate `llm_id` configs. Strips language directives from prompts for clean UI display. Returns comprehensive config object.

4. **Agent config PATCH** (`src/app/api/agents/[id]/config/route.ts`): Handles all config fields -- system prompt, voice, speech settings, call settings, chat settings, post-call analysis, security/fallback, MCPs, webhooks. Correctly injects language directives when needed. Updates either the LLM object (if using `llm_id`) or the agent's inline response engine.

5. **Voice selection** (`src/app/api/agents/[id]/voices/route.ts`): Fetches voice list from Retell SDK. Returns `voice_id`, `voice_name`, `gender`, `provider`, `accent`, `age`.

6. **Test call** (`src/app/api/agents/create-web-call/route.ts`): Public endpoint with rate limiting. Looks up agent by internal ID, resolves Retell API key, creates a web call via Retell API, returns `access_token` and `call_id` for the frontend RetellWebClient SDK.

### Issues Found

- **None blocking.** Agent creation, configuration, and testing all work end-to-end.

- **Minor: create-web-call is a public endpoint** with only IP rate limiting. While it does require a valid `agent_id` from the database, there is no auth check. This is intentional for widget embedding but could allow unauthorized call creation if someone discovers a valid agent UUID. Rate limiting mitigates abuse.

- **Minor: Retell API error details** are logged server-side but not returned to the client in `create-web-call`, which is correct for security but may make debugging harder for users.

---

## Flow 3: Create a Flow -> Edit It -> Delete It

### Verdict: PASS

### Trace

1. **Conversation flows list page** (`src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx`): Wrapped in `<FeatureGate feature="conversation_flows">`. Fetches flows via `GET /api/conversation-flows`. Shows empty state with template selection if no flows exist. Supports creating from 32+ industry/use-case templates or from scratch.

2. **Feature gating** (`src/components/portal/feature-gate.tsx`): Two-layer check:
   - First checks `client_access` table for explicit admin override.
   - Falls back to plan column check via `/api/client/plan-access`.
   - If no record exists, defaults to allowing access (permissive default).

3. **Create flow** (`src/app/api/conversation-flows/route.ts` POST): Auth + client ID resolution. Validates name is required and non-empty. Inserts row with `client_id`, optional `agent_id`, `nodes`, `edges`.

4. **Edit flow** (`src/app/api/conversation-flows/[id]/route.ts` PATCH): Auth + client ID resolution. Whitelists allowed fields (`name`, `agent_id`, `nodes`, `edges`) to prevent manipulation of `is_active`, `version`, etc. Updates with `client_id` check ensuring cross-client isolation.

5. **Delete flow** (`src/app/api/conversation-flows/[id]/route.ts` DELETE): Auth + client ID resolution. Deletes row with `client_id` check. Returns `{ success: true }`.

6. **Deploy flow** (`src/app/api/conversation-flows/[id]/route.ts` POST): Compiles flow nodes into a Retell prompt + tools, merges with existing tools, pushes to Retell API. Increments version. Supports integration nodes (Google Calendar, Calendly, HubSpot, webhooks, transfers).

### Issues Found

- **None blocking.** Full CRUD cycle works correctly.

- **Minor: PATCH returns the flow's `data` which could be `null`** if the update matched zero rows (e.g., mismatched `client_id` + `id`). Currently the `.single()` call would throw an error that gets caught and returns a 500, but it should ideally return a 404. Not a crash, but a slightly misleading error message.

- **Minor: DELETE returns `{ success: true }` even if zero rows were deleted** (e.g., already-deleted flow). No functional impact but slightly imprecise.

---

## Flow 4: View Billing -> Verify Receipt Shows Correct Data

### Verdict: DEGRADED

### Trace

1. **Client billing page** (`src/app/(portal)/[clientSlug]/portal/billing/page.tsx`): Fetches from `GET /api/client/billing`. Displays current plan, subscription status, invoices, add-ons, cost estimator.

2. **Billing API** (`src/app/api/client/billing/route.ts` GET):
   - Gets user's `client_id` and client's `stripe_customer_id`, `stripe_subscription_id`, `plan_id`.
   - Uses service client to bypass RLS for reading plans.
   - Fetches all active plans and add-ons for the org.
   - Fetches current plan details.
   - Fetches subscription from Stripe via `retrieveSubscription()`.
   - Fetches recent invoices via `listInvoices()`.

3. **Stripe subscription retrieval** (`src/lib/stripe.ts:retrieveSubscription`): Calls `subscriptions.retrieve()` with `expand: ["default_payment_method"]`.

4. **Billing portal** (`src/app/api/client/billing/route.ts` POST): Creates a Stripe Billing Portal session with correct connected account support.

5. **Invoice.paid webhook** (`src/app/api/webhooks/stripe/route.ts:handleInvoicePaid`): Skips initial subscription invoices. Finds client by subscription ID, fetches plan details and add-ons, builds line items from Stripe invoice data, sends branded receipt email with full itemization.

### Issues Found

- **BUG: Subscription `plan_name` is always null.** The billing API at line 95 accesses `sub.items?.data?.[0]?.price?.product?.name` but `retrieveSubscription()` only expands `["default_payment_method"]`. Stripe does not auto-expand nested objects -- `product` is returned as just a string ID, not the full object. The fix would be to expand `["default_payment_method", "items.data.price.product"]`. **Impact:** The subscription card on the billing page will show `null` for the plan name. The UI likely falls back to the plan name from the DB (`currentPlan.name`), so this is cosmetic if the plan_id is set, but incorrect API behavior.

- **BUG: `plan_amount` is also null** for the same reason. `price?.unit_amount` requires expanding `items.data.price`. Without the expand, `price` is just a string ID, not an object. **Impact:** Subscription amount display may be missing or show "$0" depending on frontend fallback.

- **Minor: Receipt email correctness.** The receipt email in `handleInvoicePaid` correctly reads line items from `invoice.lines.data` and uses Stripe's own amounts, so the receipt itself is accurate regardless of the above bug. The DB plan details are used only for the "Plan Includes" informational section.

- **Minor: `listInvoices` does not expand `data.lines`** but the webhook handler receives full invoice objects from Stripe, so receipt accuracy is unaffected.

---

## Flow 5: Update Account Settings -> Log Out -> Log Back In

### Verdict: PASS

### Trace

1. **Portal business settings** (`src/app/(portal)/[clientSlug]/portal/settings/business/page.tsx`): Composed of multiple sub-components: `BusinessInfoForm`, `HoursEditor`, `ServicesList`, `FaqsList`, `PoliciesList`, `LocationsList`, `CallHandlingSettings`, `PostCallActions`, `PiiRedactionSettings`. Fetches initial data from `GET /api/business-settings`.

2. **Business settings API** (`src/app/api/business-settings/route.ts`):
   - GET: Creates a default row if none exists. Returns settings for the client.
   - PATCH: Allowlists safe columns explicitly (prevents column injection). Updates the row, then fires `regeneratePrompt()` in the background to sync changes to the AI agent.

3. **Settings PATCH API** (`src/app/api/settings/route.ts`): Handles org-level settings (currently only `openai_api_key`). Encrypts before storing.

4. **Startup settings** (`src/app/(startup)/settings/startup/page.tsx`): Displays org name, workspace ID, API key status, GDPR/HIPAA toggles. Uses direct Supabase client queries.

5. **Logout** (`src/components/layout/portal-sidebar.tsx:handleLogout`): Calls `supabase.auth.signOut()`, then `router.push("/login")`.

6. **Login page** (`src/app/(auth)/login/page.tsx`): Standard email/password form. Calls `supabase.auth.signInWithPassword()`. On success, `router.push("/dashboard")`.

7. **Middleware redirect** (`src/lib/supabase/middleware.ts`): After login, if user navigates to `/dashboard` and has `client_admin` or `client_member` role, middleware redirects them to `/${slug}/portal`. For startup admins, `/dashboard` loads normally.

### Issues Found

- **None blocking.** The full cycle of updating settings, logging out, and logging back in works correctly.

- **Minor: Login always redirects to `/dashboard`** (line 37 of login page), then middleware re-redirects client users to their portal. This causes a double redirect (login -> /dashboard -> /{slug}/portal). Works correctly but adds a round trip. Could be optimized by checking user role after login and redirecting directly to the portal.

- **Minor: The `/api/settings` PATCH route** only supports `openai_api_key`. If a user attempts to update other settings via this endpoint, they get "No fields to update" (400). The startup settings page uses direct Supabase client queries for org name changes, bypassing this API entirely. This is not a bug but a split architecture worth noting.

---

## Summary

| Flow | Verdict | Critical Bugs | Notes |
|------|---------|---------------|-------|
| 1. Signup -> Onboarding -> Dashboard | **PASS** | 0 | Full path works end-to-end. Minor idempotency edge case. |
| 2. Create Agent -> Configure -> Test | **PASS** | 0 | All agent operations work. create-web-call is intentionally public. |
| 3. Create Flow -> Edit -> Delete | **PASS** | 0 | Full CRUD works. Feature gating is correct. |
| 4. View Billing -> Receipt | **DEGRADED** | 1 | Subscription `plan_name` and `plan_amount` are always null due to missing Stripe expand. Receipt emails are correct. |
| 5. Settings -> Logout -> Login | **PASS** | 0 | Full cycle works. Double redirect on login is cosmetic. |

### Critical Fix Required

**Billing API Stripe expand bug** (`src/app/api/client/billing/route.ts` line 88-98 + `src/lib/stripe.ts` line 88-94):

`retrieveSubscription()` needs to expand `["default_payment_method", "items.data.price.product"]` instead of just `["default_payment_method"]`. Without this, the subscription's `plan_name`, `plan_amount`, `plan_interval`, and `plan_currency` will all be null because Stripe returns unexpanded nested objects as string IDs.
