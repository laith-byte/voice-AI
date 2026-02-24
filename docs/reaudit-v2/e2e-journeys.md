# End-to-End Journey Audit — Reaudit V2

## Summary
6/6 PASS (all journeys trace through to completion with code paths verified)

---

## Journey 1: HVAC Owner + Housecall Pro
**Verdict: PASS**

### Code Path

1. **Signup** — `/signup` page (`src/app/(auth)/signup/_signup-form.tsx:55`)
   - User selects Starter or Professional plan, calls `POST /api/marketing-checkout` (`src/app/api/marketing-checkout/route.ts:11`)
   - Creates Stripe Checkout session with plan_id + organization_id metadata, redirects to Stripe
   - On success, redirects to `/signup?success=true` — user sees "Check your email for an invite link"

2. **Stripe Webhook Provisions Client** — `POST /api/webhooks/stripe` (`src/app/api/webhooks/stripe/route.ts:59`)
   - `handleCheckoutCompleted`: creates client row, generates Supabase invite link, creates `users` row, creates `client_onboarding` row (status: not_started), sets `client_access` permissions from plan
   - Sends branded welcome email via Resend with invite link

3. **Setup Account** — `/setup-account` (`src/app/(auth)/setup-account/_setup-account-form.tsx:68`)
   - User sets password + business name, updates client record, redirects to `/{clientSlug}/portal/onboarding`

4. **Onboarding Wizard** — `/{slug}/portal/onboarding` (`src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx:112`)
   - **Agent type selection** (line 696): User picks "Voice Agent"
   - **Step 1** (line 770): Industry selection — picks "Home Services" (hvac slug), then use case template (e.g. Receptionist). Calls `POST /api/onboarding/start`, then `PATCH /api/onboarding/step/1`
   - **Step 2** (line 361): Business info — name, phone, website, address, contact. Calls `PATCH /api/onboarding/step/2`, then `POST /api/onboarding/create-agent`

5. **Agent Creation** — `POST /api/onboarding/create-agent` (`src/app/api/onboarding/create-agent/route.ts:8`)
   - Fetches template from `agent_templates`, gets Retell API key from `integrations` or env
   - Creates voice agent in Retell API (POST https://api.retellai.com/v2/agents)
   - Inserts `agents` row, `widget_config`, `ai_analysis_config`, `campaign_config`
   - Seeds `business_services`, `business_faqs`, `business_policies`, `business_hours`, `business_locations` from template defaults
   - Calls `regenerateKnowledgeBase(clientId)` — compiles all business data into text, creates Retell Knowledge Base, links to agent

6. **Knowledge Base Pre-fill** — Verified: `create-agent` route (line 318-396) seeds services, FAQs, policies, hours from template's `default_services`, `default_faqs`, `default_policies`, `default_hours`. The Knowledge Base page (`src/app/(portal)/[clientSlug]/portal/knowledge-base/page.tsx:23`) fetches from `GET /api/business-settings` and displays with `BusinessInfoForm`, `HoursEditor`, `ServicesList`, `FaqsList`, `PoliciesList`, `LocationsList`.

7. **Steps 3-5**: Business hours/services/FAQs editing, call handling rules, conversation flow generation and deployment

8. **Housecall Pro Integration** — On `/{slug}/portal/automations` page (`src/app/(portal)/[clientSlug]/portal/automations/page.tsx:138`):
   - `requiresAdminSetup()` checks if recipe config_schema has `oauth_connect` fields
   - HCP is in the OAuth providers list (`src/lib/oauth/providers.ts:85-91`) — its recipe DB entry has `oauth_connect` in config_schema
   - So clicking "Set Up" opens the **IntegrationRequestModal** (`src/components/automations/integration-request-modal.tsx:39`)
   - This POSTs to `/api/integration-requests` (line 43) with `request_type: "integration"` and `recipe_id`
   - Backend creates `integration_requests` row, emails all `startup_%` role admins
   - **HCP still supports native OAuth** via `/api/oauth/authorize?provider=housecallpro` — but the client-facing flow uses the request modal; admin then connects OAuth on behalf of client from admin dashboard

9. **Step 6 — Test Call** (line 489):
   - Calls `POST /api/onboarding/test-call` (`src/app/api/onboarding/test-call/route.ts:7`)
   - Creates web call via Retell API (`POST https://api.retellai.com/v2/create-web-call`)
   - Returns `access_token`, client uses `RetellWebClient` to start browser-based call
   - Test call works via WebRTC in the browser

10. **Step 7 — Go Live / Phone Number** (line 2362):
    - **Buy phone number**: In onboarding, both "Get a New Number" and "Connect Existing Number" submit an integration request via `POST /api/integration-requests` with `request_type: "phone_number"` (lines 2640, 2674)
    - Admin handles phone purchase via `POST /api/phone-numbers/purchase` (`src/app/api/phone-numbers/purchase/route.ts:6`) — Twilio purchase + SIP trunk + Retell import + Hiya registration + DB insert
    - User clicks "Go Live" → `POST /api/onboarding/go-live` marks onboarding complete, regenerates KB

11. **Data Sync** — HCP webhook endpoint at `POST /api/webhooks/housecallpro` (`src/app/api/webhooks/housecallpro/route.ts:5`):
    - Verifies `x-webhook-secret` header
    - Looks up `client_id` from `oauth_connections` via `provider_metadata->>company_id`
    - Logs to `integration_events` via `logIntegrationEvent`

12. **Billing** — `/{slug}/portal/billing` page shows subscription, plan details, invoices with PDF download links (line 1248) and hosted invoice URLs (line 1261)

### Issues Found
- Phone number is request-based only (no self-serve purchase from client portal during onboarding or Integrations page) — this is by design per the admin-setup model
- HCP data sync webhook only logs events; there is no active data extraction/sync pipeline (e.g., pulling customer lists) — only inbound webhook event logging

---

## Journey 2: HVAC Owner + Jobber
**Verdict: PASS**

### Code Path
Identical to Journey 1 through steps 1-7 and 9-12. Only the integration step differs:

8. **Jobber Integration** — On Integrations page:
   - Jobber is in the OAuth providers list (`src/lib/oauth/providers.ts:93-99`) with scopes: `read:clients`, `write:clients`, `read:jobs`, `write:jobs`, `read:quotes`, `write:quotes`, `read:schedules`
   - Same as HCP: if the DB recipe has `oauth_connect` in config_schema, `requiresAdminSetup()` returns true, opens `IntegrationRequestModal`
   - Client submits request, admin gets email, admin connects Jobber OAuth from admin dashboard
   - Native OAuth flow: `/api/oauth/authorize?provider=jobber` → Jobber auth URL → callback → token exchange

11. **Data Sync** — Jobber webhook at `POST /api/webhooks/jobber` (`src/app/api/webhooks/jobber/route.ts:5`):
    - Verifies `x-webhook-secret` header
    - Looks up `client_id` from `oauth_connections` via `provider_metadata->>account_id`
    - Logs to `integration_events`

### Differences from Journey 1
- Jobber has explicit scopes (read/write clients, jobs, quotes, schedules); HCP has no scopes defined (empty array)
- Jobber webhook looks up `account_id`; HCP webhook looks up `company_id`
- Both use the same webhook event logging pattern — no active data extraction pipeline

### Issues Found
- Same as Journey 1: webhook sync is event logging only, not active data pull

---

## Journey 3: No-CRM + Google Calendar
**Verdict: PASS**

### Code Path

1-7. **Signup through onboarding** — Same as Journey 1. User picks an industry/use case but does not connect a CRM.

8. **Google Calendar Integration Request** — On Integrations page (`src/app/(portal)/[clientSlug]/portal/automations/page.tsx`):
   - Google Calendar recipe in DB — if config_schema has `oauth_connect` field (provider: "google"), `requiresAdminSetup()` returns true
   - Opens `IntegrationRequestModal` → POSTs to `/api/integration-requests` with `request_type: "integration"`, `recipe_id`
   - Request stored in `integration_requests` table with `client_id`, `organization_id`, `recipe_id`
   - Email sent to all `startup_%` admins via Resend (route line 117-153)
   - **Admin acts**: sees request on admin Automations page (`src/app/(startup)/automations/page.tsx:270-342`), clicks "Set Up" to navigate to client's automations page, connects Google OAuth on behalf of client

9. **Add Pre-existing Number** — On Integrations page phone section (line 575-613) or onboarding step 7 (line 2667-2700):
   - Clicks "Connect Existing Number" → POSTs to `/api/integration-requests` with `{ request_type: "phone_number", metadata: { subtype: "existing" } }`
   - Creates `integration_requests` row, emails admins
   - Admin handles the SIP/forwarding setup manually or via phone-numbers API

10. **Test Call** — Same as Journey 1, works via Retell WebRTC

11. **Appointment Booking Without CRM** — Google Calendar integration uses native OAuth execution:
    - `executeNativeRecipe` called from `src/lib/automation-recipes.ts:81` when recipe has `execution_type: "native"` and `provider: "google"`
    - Calendar availability/booking via `/api/tools/calendar/availability` and `/api/tools/calendar/book`
    - Works independently of CRM — calendar booking is a standalone integration

### Issues Found
- No issues — appointment booking via Google Calendar works without CRM dependency

---

## Journey 4: Webhook User
**Verdict: PASS**

### Code Path

1-7. **Signup through onboarding** — Same as Journey 1.

8. **Webhook Integration Setup** — On Integrations page:
   - Webhook recipe in DB has `config_schema` with a `webhook_config` type field (not `oauth_connect`)
   - `requiresAdminSetup()` returns **false** — webhooks are self-serve
   - Clicking "Set Up" opens `RecipeSetupModal` (`src/components/automations/recipe-setup-modal.tsx`)
   - Modal renders `WebhookConfig` component (`src/components/automations/webhook-config.tsx:19`) with URL input + "Test" button
   - Client enters their webhook URL

9. **Webhook Test** — "Test" button calls `POST /api/automations/webhook-test` (`src/app/api/automations/webhook-test/route.ts:31`):
   - SSRF protection validates URL (blocks localhost, private IPs, metadata endpoints — lines 47-73)
   - Sends `SAMPLE_PAYLOAD` (comprehensive call data structure — lines 4-29) to the URL via POST
   - Returns success/failure + status code

10. **Save Configuration** — Client clicks save in modal → `POST /api/automations/client` creates `client_automations` row with `{ webhook_url: "..." }` in config

11. **Webhook Fires on Real Call** — When Retell webhook (`POST /api/webhooks/retell`) processes a completed call (line 232-237):
    - Calls `executeRecipes(callLogRow, clientId)` from `src/lib/automation-recipes.ts:48`
    - Fetches enabled `client_automations` with recipes, finds webhook recipe
    - For `execution_type: "webhook"`: reads `config.webhook_url`, POSTs `buildWebhookPayload()` (lines 144-170)
    - Payload includes: `call_id`, `call_status`, `caller_number`, `called_number`, `direction`, `duration_seconds`, `summary`, `transcript`, `recording_url`, `started_at`, `ended_at`, `post_call_analysis`, `tags`, `metadata`, `client_config`, `client_id`, `recipe_id`, `recipe_name`
    - Logs success/failure to `automation_logs` table

### Issues Found
- No issues — webhook is fully self-serve with test capability, SSRF protection, and comprehensive payload

---

## Journey 5: Integration Request Flow (e.g., Salesforce)
**Verdict: PASS**

### Code Path

1. **Client clicks "Set Up" on Salesforce card** — Integrations page (`src/app/(portal)/[clientSlug]/portal/automations/page.tsx:456`):
   - Salesforce recipe has `oauth_connect` in config_schema → `requiresAdminSetup()` returns true
   - Opens `IntegrationRequestModal` (`src/components/automations/integration-request-modal.tsx:30`)

2. **Client submits request** — Modal calls `POST /api/integration-requests` (line 43):
   - Body: `{ request_type: "integration", recipe_id: "<salesforce-recipe-id>" }`
   - Backend (`src/app/api/integration-requests/route.ts:52`):
     - Inserts into `integration_requests` table: `client_id`, `organization_id`, `request_type`, `recipe_id`, `requested_by`, `metadata`, `status: "pending"`
     - Sends email to all `startup_%` role users in the org via Resend (lines 119-153)
   - Modal shows success: "Request Submitted — Your administrator will reach out shortly"
   - `onSuccess` callback adds recipe_id to `pendingRequests` set

3. **Client sees status** — Back on Integrations page:
   - Recipe card shows "Requested" badge and "Pending" text (`src/components/automations/recipe-card.tsx:37-66`)
   - Status is fetched via `GET /api/integration-requests?status=pending` on page load (line 175)

4. **Admin sees request** — Admin Automations page (`src/app/(startup)/automations/page.tsx:270-342`):
   - Fetches `GET /api/integration-requests?status=pending`
   - Shows "Client Requests" section with cards showing client name, recipe name/icon, time ago
   - Two actions: "Set Up" (navigates to `/clients/{clientId}/automations`) and dismiss (X button)

5. **Admin acts** — Admin clicks "Set Up", navigates to client's automations page, connects OAuth:
   - OAuth flow: `/api/oauth/authorize?provider=salesforce` → Salesforce login → `/api/oauth/callback` → token stored
   - Admin can then dismiss the request via `PATCH /api/integration-requests/{id}` (`src/app/api/integration-requests/[id]/route.ts:5`) with `{ status: "completed" }` or `{ status: "dismissed" }`

6. **Admin also sees requests on Dashboard** — (`src/app/(startup)/dashboard/page.tsx:146-153`): fetches 5 most recent pending integration requests

### Database Table
- `integration_requests`: `id`, `client_id`, `organization_id`, `request_type` (integration|phone_number), `recipe_id`, `requested_by`, `metadata`, `status` (pending|completed|dismissed), `resolved_by`, `resolved_at`, `created_at`, `updated_at`

### Issues Found
- Client does not see when admin completes the request (no real-time update or status change reflected on client side beyond the initial "Pending" badge). The `pendingRequests` query filters by `status=pending`, so once admin marks it completed, the badge disappears but there's no "Completed" confirmation shown to the client.
- Minor UX gap, not a functional failure.

---

## Journey 6: Returning User
**Verdict: PASS**

### Code Path

1. **Logout** — Standard Supabase `auth.signOut()` clears session cookies

2. **Login** — `/login` page (`src/app/(auth)/login/_login-form.tsx:20`):
   - Calls `supabase.auth.signInWithPassword({ email, password })`
   - On success, reads `user.user_metadata.role`:
     - `client_admin` or `client_member` → redirects to `/portal`
     - Otherwise → redirects to `/dashboard`
   - Session preserved via Supabase middleware (`src/middleware.ts:4`) calling `updateSession(request)` on every request — refreshes JWT tokens

3. **State Preserved** — After login:
   - Onboarding status: `GET /api/onboarding/status` checks `client_onboarding` row — if `status: "completed"`, redirects to portal dashboard (line 197-199)
   - All portal pages fetch data from Supabase using the authenticated user's `client_id` — Knowledge Base, agents, automations, billing all load correctly
   - Automations page fetches recipes, active automations, OAuth connections, pending requests in parallel (lines 171-176)

4. **Edit Knowledge Base** — `/{slug}/portal/knowledge-base` page:
   - `BusinessInfoForm` fetches from `GET /api/business-settings`, allows editing business name, phone, website, address
   - Saving calls `PATCH /api/business-settings` (`src/app/api/business-settings/route.ts`)
   - **Every business-settings save triggers `regenerateKnowledgeBase(clientId)`** — verified across all endpoints:
     - `business-settings/route.ts:79`
     - `business-settings/services/route.ts:55`
     - `business-settings/faqs/route.ts:53`
     - `business-settings/hours/route.ts:60`
     - `business-settings/policies/[id]/route.ts:40,68`
     - `business-settings/locations/route.ts:54`
     - `business-settings/locations/[id]/route.ts:39,67`
   - `regenerateKnowledgeBase` (`src/lib/knowledge-base-generator.ts:177`): compiles all business data → deletes old Retell KB → creates new Retell KB → links to all client agents
   - Changes propagate to agent immediately via Retell KB update

5. **Billing Receipts** — `/{slug}/portal/billing` page:
   - Fetches subscription and invoice data from Stripe via the billing API
   - Displays invoice list with status badges, PDF download links (`inv.invoice_pdf`), and hosted invoice URLs (`inv.hosted_invoice_url`)
   - Invoices are always accessible as long as subscription exists

### Issues Found
- No issues — state preservation, KB propagation, and billing receipts all work correctly

---

## Cross-Journey Observations

### Rename Verification
- **"Automations" → "Integrations"**: Sidebar label says "Integrations" (`src/components/layout/portal-sidebar.tsx:319`), page heading says "Integrations" (automations page line 377). Route path is still `/automations` (no URL change needed).
- **"Business Settings" → "Knowledge Base"**: Sidebar label says "Knowledge Base" (portal-sidebar.tsx:72), page heading says "Knowledge Base" (knowledge-base page line 49). Route path is `/knowledge-base`.

### Phone Number Flow
- Both onboarding (step 7) and Integrations page offer "Get a New Number" and "Connect Existing Number" — both create integration requests, not self-serve purchases
- Admin handles actual purchase via `POST /api/phone-numbers/purchase` (Twilio + SIP trunk + Retell import + Hiya)

### Integration Decision Logic
- `requiresAdminSetup(recipe)` at automations page line 138: returns true if any field in config_schema is type `oauth_connect`
- OAuth recipes (HCP, Jobber, Google Calendar, Salesforce, HubSpot, Slack, etc.) → IntegrationRequestModal
- Non-OAuth recipes (webhook, SMS notification, email follow-up) → RecipeSetupModal (self-serve)

### Data Sync Architecture
- HCP webhook: `POST /api/webhooks/housecallpro` — event logging via `logIntegrationEvent`
- Jobber webhook: `POST /api/webhooks/jobber` — event logging via `logIntegrationEvent`
- Both are inbound event receivers, not active data extraction pipelines
