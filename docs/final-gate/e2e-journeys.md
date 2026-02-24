# End-to-End Journeys -- Final Gate Audit

## Summary
**6/6 PASS**

All six user journeys trace through from entry to completion with no dead ends, missing handlers, or broken links. Every step has a corresponding file and handler.

---

## Journey 1: Day 1 Signup (HVAC + Housecall Pro)

### Steps

1. **Marketing site CTA -> signup page**
   - Navbar "Sign Up" link at `src/components/marketing/layout/navbar.tsx:112` links to `/signup`
   - `/signup` renders `src/app/(auth)/signup/page.tsx:8` -> `_signup-form.tsx:39`
   - PASS

2. **Signup page -> Stripe checkout**
   - Plan selection + handleCheckout() at `src/app/(auth)/signup/_signup-form.tsx:55-78`
   - POSTs to `/api/marketing-checkout` at `src/app/api/marketing-checkout/route.ts:11`
   - Creates Stripe Checkout session with plan_id + organization_id metadata (line 78-98)
   - Redirects to Stripe Checkout (line 100)
   - PASS

3. **Stripe checkout completion -> auto-provisioning**
   - Stripe webhook at `src/app/api/webhooks/stripe/route.ts:18`
   - `checkout.session.completed` event handled at line 59-60 -> `handleCheckoutCompleted` at line 96
   - Creates client record (line 152-164), auth user with invite link (line 174-184), users row (line 199), client_access permissions (line 211), client_onboarding record (line 214-218)
   - Sends branded welcome email via Resend with setup link (line 356-437)
   - PASS

4. **Email invite -> setup-account page**
   - Invite link redirects through `/auth/callback` at `src/app/auth/callback/route.ts:4` with `?next=/setup-account`
   - Exchanges code for session (line 13), redirects to `/setup-account`
   - Setup form at `src/app/(auth)/setup-account/_setup-account-form.tsx:11`
   - Sets password (line 92), updates business name (line 104), redirects to `/{slug}/portal/onboarding` (line 121)
   - PASS

5. **Onboarding wizard - template selection (HVAC)**
   - Portal onboarding page at `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx`
   - Step 1: industry/template selection (line 337-358)
   - Templates loaded from `agent_templates` table filtered by `wizard_enabled=true` (line 273-277)
   - HVAC mapped at line 790. POSTs to `/api/onboarding/start` (line 342) and saves step via `/api/onboarding/step/1` (line 352)
   - `src/app/api/onboarding/start/route.ts:5` -- uses requireAuth, creates client_onboarding record with vertical_template_id
   - PASS

6. **Onboarding wizard - business info + agent creation**
   - Step 2: business info saved via `/api/onboarding/step/2` at `src/app/api/onboarding/step/[step]/route.ts:56-85`
   - Agent created via `/api/onboarding/create-agent` at `src/app/api/onboarding/create-agent/route.ts:8`
   - Seeds default services, FAQs, policies, hours from template (lines 318-396)
   - Calls `regenerateKnowledgeBase(clientId)` to push KB to Retell (line 400)
   - PASS

7. **Knowledge Base pre-filled with HVAC data**
   - Template's `default_services`, `default_faqs`, `default_policies` seeded into `business_services`, `business_faqs`, `business_policies` tables (create-agent lines 318-357)
   - Default hours seeded (lines 360-380), location from address (lines 383-394)
   - KB text compiled and pushed to Retell via `regenerateKnowledgeBase` at `src/lib/knowledge-base-generator.ts:177`
   - PASS

8. **Buy phone number (Twilio purchase flow)**
   - Onboarding step 7 handles phone number option
   - Phone search via `/api/phone-numbers/search` (route exists at `src/app/api/phone-numbers/search/route.ts`)
   - Phone purchase via `/api/phone-numbers/purchase` at `src/app/api/phone-numbers/purchase/route.ts:6`
   - Buys from Twilio (line 35), associates with SIP trunk (line 51), imports to Retell (line 90), registers with Hiya (line 132), saves to DB (line 156)
   - PASS

9. **Connect Housecall Pro (OAuth flow)**
   - OAuth connect button at `src/components/integrations/oauth-connect-button.tsx:47` -> `/api/oauth/authorize?provider=housecallpro`
   - Authorize route at `src/app/api/oauth/authorize/route.ts:7` -- uses requireAuth, builds HCP auth URL
   - HCP provider config at `src/lib/oauth/providers.ts:85-91`
   - Callback at `src/app/api/oauth/callback/route.ts:8` -- exchanges code, fetches HCP company info (lines 210-225), upserts oauth_connections (line 259), registers Retell tools (line 284)
   - PASS

10. **Create first agent with HVAC template -> agent is live**
    - Agent created in step 6 above (onboarding/create-agent)
    - Go-live via `/api/onboarding/go-live` at `src/app/api/onboarding/go-live/route.ts:6`
    - Marks onboarding completed, calls regenerateKnowledgeBase (line 53)
    - Redirects to portal dashboard (onboarding page line 631)
    - PASS

### Verdict: PASS

---

## Journey 2: Day 1 First Call

### Steps

1. **Inbound call -> Retell webhook**
   - Retell webhook at `src/app/api/webhooks/retell/route.ts:13`
   - Verifies signature (line 20), parses event (line 25)
   - PASS

2. **call_started event -> call log created**
   - `call_started` handler at line 61-117
   - Looks up internal agent by retell agent_id (line 36-47)
   - Logs webhook event (line 50-58)
   - Inserts call_log row with organization_id, client_id, agent_id, direction, from/to numbers (line 101-116)
   - PASS

3. **Agent answers with correct business name from Knowledge Base**
   - KB was pushed to Retell during onboarding via `regenerateKnowledgeBase` (knowledge-base-generator.ts:177)
   - Business name, services, hours, FAQs, policies compiled into KB text via `compileBusinessKnowledgeText` (knowledge-base-generator.ts)
   - KB linked to agent's `knowledge_base_ids` in Retell (line 302-309)
   - Agent uses this KB to answer with correct business name
   - PASS

4. **HVAC intake (service request)**
   - Intake tool at `src/app/api/tools/intake/collect/route.ts:4`
   - Authenticated via RETELL_TOOLS_API_KEY (line 7-8)
   - Creates/updates lead with intake form data (lines 40-101)
   - PASS

5. **Books appointment -> Housecall Pro**
   - HCP book tool at `src/app/api/tools/housecallpro/book/route.ts:6`
   - Authenticated via RETELL_TOOLS_API_KEY (line 7-8)
   - Gets valid OAuth token via `getValidToken` (line 25)
   - Looks up/creates customer in HCP (lines 28-74), creates job (lines 77-97)
   - PASS

6. **Data syncs to Housecall Pro via integration recipe execution**
   - Post-call: `executeRecipes` called at retell webhook line 236
   - Integration recipes executor at `src/lib/integration-recipes.ts:48`
   - Fetches enabled client_automations, executes native recipes via `executeNativeRecipe` (line 2)
   - PASS

7. **Sync shows in dashboard/logs**
   - call_ended event updates call_log (retell webhook lines 120-143)
   - call_analyzed event adds summary + analysis (lines 146-162)
   - Webhook logs stored (line 50-58)
   - Integration event logs via `src/app/api/integrations/events/route.ts`
   - PASS

8. **Client sees the lead**
   - Portal dashboard at `src/app/(portal)/[clientSlug]/portal/page.tsx` reads call_logs (line 187)
   - Leads stored via intake tool and visible via leads API
   - PASS

### Verdict: PASS

---

## Journey 3: Day 2 Jobber User

### Steps

1. **Signup -> onboarding**
   - Same flow as Journey 1 steps 1-7
   - PASS

2. **Connect Jobber (OAuth flow)**
   - OAuth authorize: `/api/oauth/authorize?provider=jobber`
   - Jobber provider config at `src/lib/oauth/providers.ts:93-100`
   - `authUrl: "https://api.getjobber.com/api/oauth/authorize"`, `tokenUrl: "https://api.getjobber.com/api/oauth/token"`
   - Callback at `src/app/api/oauth/callback/route.ts:228-255` -- fetches Jobber account info via GraphQL, stores connection
   - Registers Retell tools at callback line 284-287
   - PASS

3. **Same call flow**
   - Retell webhook handles call_started/call_ended/call_analyzed identically
   - PASS

4. **Jobber GraphQL sync (book appointment)**
   - Jobber book tool at `src/app/api/tools/jobber/book/route.ts:5`
   - Uses `jobberGraphQL` helper from `src/lib/oauth/executors/jobber.ts`
   - Gets valid token via `getValidToken(client_id, "jobber")` (line 24)
   - Creates client via GraphQL mutation (lines 43-53), creates job via GraphQL mutation (lines 68-80)
   - PASS

5. **Correct in dashboard**
   - Same dashboard display as Journey 2 step 7-8
   - PASS

### Verdict: PASS

---

## Journey 4: Day 2 No CRM User

### Steps

1. **Signup -> onboarding**
   - Same flow as Journey 1 steps 1-7
   - PASS

2. **Connect Google Calendar only**
   - OAuth authorize: `/api/oauth/authorize?provider=google`
   - Google provider config at `src/lib/oauth/providers.ts:11-22`
   - Scopes include `calendar.readonly`, `calendar.events` (lines 16-17)
   - Callback handles Google token exchange, fetches userinfo (callback lines 131-140)
   - Registers calendar tools via `registerAgentTools` (callback line 284)
   - PASS

3. **Call -> appointment booked on calendar**
   - Google Calendar book tool at `src/app/api/tools/calendar/book/route.ts:6`
   - Gets valid Google token (line 32)
   - Uses googleapis to create calendar event (lines 59-68)
   - Supports calendarId selection via client_automations config (lines 36-45)
   - PASS

4. **Verify calendar tool integration**
   - Calendar availability check at `src/app/api/tools/calendar/availability/route.ts`
   - Calendar booking confirmed with event_id and event_time (book route lines 82-86)
   - PASS

### Verdict: PASS

---

## Journey 5: Day 3 Check Billing

### Steps

1. **Client logs in**
   - Login page at `src/app/(auth)/login/page.tsx:8` -> `_login-form.tsx:12`
   - `signInWithPassword` at line 26
   - Client users redirected to `/portal` (line 40) -> middleware redirects to `/{slug}/portal` (middleware.ts:128-137)
   - PASS

2. **Billing page**
   - Portal billing page at `src/app/(portal)/[clientSlug]/portal/billing/page.tsx:409`
   - Fetches from `/api/client/billing` (line 426)
   - API route at `src/app/api/client/billing/route.ts:6` -- uses requireAuth (line 7)
   - Returns subscription, invoices, current_plan, plans, client_addons (line 6+)
   - PASS

3. **Sees charges matching usage**
   - Billing page shows subscription details (lines 604-658)
   - Plan usage summary with minutes, agents, phone numbers, concurrent calls (lines 696-834)
   - Cost forecast section fetched from `/api/usage/forecast` (line 454)
   - PASS

4. **Receipt viewable/downloadable**
   - Invoices section at lines 1218-1276
   - Each invoice shows amount, date, status badge
   - Download PDF link via `inv.invoice_pdf` (line 1249)
   - View invoice link via `inv.hosted_invoice_url` (line 1259)
   - Receipt emails sent automatically via Stripe webhook `invoice.paid` handler (stripe/route.ts:440-549)
   - PASS

5. **Stripe integration verified**
   - Checkout: `/api/marketing-checkout/route.ts` (public) + `/api/checkout/route.ts` (portal upgrade)
   - Webhook: `src/app/api/webhooks/stripe/route.ts` handles checkout.session.completed, subscription.deleted, subscription.updated, invoice.payment_failed, invoice.paid
   - Billing portal session: `src/app/api/client/billing/route.ts` POST handler creates Stripe billing portal session (line 137+)
   - PASS

### Verdict: PASS

---

## Journey 6: Day 5 Returning User

### Steps

1. **Log in**
   - Same as Journey 5 step 1
   - Middleware validates slug, redirects to correct portal
   - PASS

2. **Edit Knowledge Base (new address, new hours)**
   - KB page at `src/app/(portal)/[clientSlug]/portal/knowledge-base/page.tsx:23`
   - Business info form fetches/saves via `/api/knowledge-base` (line 29)
   - Hours editor uses `/api/knowledge-base/hours` (PUT at `src/app/api/knowledge-base/hours/route.ts:27`)
   - Locations editor uses `/api/knowledge-base/locations` + `/api/knowledge-base/locations/[id]`
   - All mutations go through API routes -- zero direct Supabase mutations in portal pages
   - PASS

3. **regenerateKnowledgeBase() called on save**
   - `/api/knowledge-base/route.ts:79` -- PATCH handler calls `regenerateKnowledgeBase(clientId!)` after update
   - `/api/knowledge-base/hours/route.ts:60` -- PUT handler calls `regenerateKnowledgeBase(clientId!)`
   - `/api/knowledge-base/services/route.ts:55` -- POST handler calls `regenerateKnowledgeBase(clientId!)`
   - `/api/knowledge-base/services/[id]/route.ts:39,67` -- PATCH and DELETE handlers call it
   - `/api/knowledge-base/faqs/route.ts:53`, `/api/knowledge-base/faqs/[id]/route.ts:40,68` -- all call it
   - `/api/knowledge-base/policies/route.ts:53`, `/api/knowledge-base/policies/[id]/route.ts:40,68` -- all call it
   - `/api/knowledge-base/locations/route.ts:54`, `/api/knowledge-base/locations/[id]/route.ts:39,67` -- all call it
   - EVERY KB mutation route calls regenerateKnowledgeBase
   - PASS

4. **Updated KB propagates to agent**
   - `regenerateKnowledgeBase` at `src/lib/knowledge-base-generator.ts:177`
   - Fetches all agents for client (line 181-184)
   - Compiles business text from all KB tables (line 192)
   - Deletes old Retell KB (line 219-228), creates new one (line 238-248), links to agent (line 302-309)
   - Updates agent's `knowledge_base_ids` via Retell PATCH API (line 302-309)
   - PASS

5. **Disconnect CRM**
   - Disconnect via `/api/oauth/disconnect` at `src/app/api/oauth/disconnect/route.ts:9`
   - Uses requireAuth (line 10), validates clientId (line 13)
   - Attempts token revocation with provider (lines 41-55)
   - Calls `unregisterAgentTools(clientId, provider)` to remove Retell tools (lines 58-64)
   - Deletes oauth_connections row (lines 67-71)
   - PASS

6. **Reconnect CRM**
   - Same OAuth authorize flow as initial connect
   - `/api/oauth/authorize` builds auth URL (authorize/route.ts:7)
   - `/api/oauth/callback` exchanges code, upserts oauth_connections (callback/route.ts:259 -- onConflict: "client_id,provider")
   - `registerAgentTools(clientId, provider)` re-registers Retell tools (callback line 284-287)
   - PASS

7. **Verify sync resumes -- nothing lost**
   - `oauth_connections` upsert preserves client_id association
   - New access/refresh tokens stored (callback lines 265-267)
   - Agent tools re-registered so next call can use CRM tools
   - call_logs, leads, business data all keyed by client_id -- none deleted during disconnect
   - PASS

### Verdict: PASS

---

## Cross-Journey Verification

### Direct Mutations in Client Pages

**CLEAN** (portal pages)

- Zero direct Supabase insert/update/delete/upsert calls found in `src/app/(portal)/` pages
- All portal mutations go through `/api/*` routes
- One direct mutation in `src/app/(auth)/setup-account/_setup-account-form.tsx:104-107` (updates client name via Supabase client) -- this is acceptable as it runs during initial account setup before the portal, and is protected by Supabase Auth RLS
- Startup admin pages (`src/app/(startup)/`) have some direct mutations (billing/connect, saas/connect, saas/plans, ai-analysis) -- these are internal admin pages, not client-facing

### Rename Completeness

**CLEAN**

- Zero references to `/automations` found anywhere in `src/`
- Zero references to `/business-settings` as a URL path found anywhere in `src/`
- Integration pages correctly use `/integrations` path: `src/app/(portal)/[clientSlug]/portal/integrations/page.tsx`
- Knowledge Base pages correctly use `/knowledge-base` path: `src/app/(portal)/[clientSlug]/portal/knowledge-base/page.tsx`
- API endpoints correctly at `/api/integrations/*` and `/api/knowledge-base/*`

### Auth Coverage

**CLEAN**

All authenticated API routes use `requireAuth()`:
- 90 API route files contain `requireAuth` (234 total occurrences across all HTTP methods)
- Routes intentionally without requireAuth are properly secured:
  - Webhook endpoints (`/api/webhooks/retell`, `/api/webhooks/stripe`, `/api/webhooks/housecallpro`, `/api/webhooks/jobber`) -- use signature verification
  - Tool endpoints (`/api/tools/*`) -- use `RETELL_TOOLS_API_KEY` bearer auth
  - Public endpoints (`/api/marketing-checkout`, `/api/checkout`, `/api/contact`, `/api/demo-call`, `/api/agents/create-web-call`) -- use rate limiting
  - Cron endpoints (`/api/cron/*`) -- use Vercel cron auth
  - Third-party auth endpoints (`/api/make/auth`, `/api/n8n/auth`, `/api/zapier/auth`) -- use platform-specific auth
- Middleware at `src/middleware.ts` + `src/lib/supabase/middleware.ts` enforces session validation on all non-public routes and redirects unauthenticated users to `/login`
