# Client Platform -- Final Gate Audit

## Summary

The client-facing platform is largely functional with clean navigation, proper API route usage for most pages, and correct rename handling (Automations -> Integrations, Business Settings -> Knowledge Base). However, two portal pages still perform direct Supabase mutations from client-side code (agent-settings and ai-analysis), and the login form exposes raw Supabase error messages. These are the primary blockers.

---

## BLOCKERS

### B-1: Direct Supabase mutations in agent-settings page (REGRESSION)

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx`

**Lines:** 765, 785, 864, 883, 998, 1202

**Description:** This "use client" page performs direct Supabase `.insert()`, `.upsert()`, and `.update()` calls on `widget_config`, `ai_analysis_config`, and `agents` tables from the browser. This bypasses API route authorization and org-scoping.

Specific mutations:
- Line 765: `supabase.from("widget_config").insert({ agent_id: agentId })` -- creates widget config row directly
- Line 785: `supabase.from("ai_analysis_config").insert({ agent_id: agentId })` -- creates AI config row directly
- Line 864: `supabase.from("widget_config").upsert(...)` -- saves widget description directly
- Line 883: `supabase.from("ai_analysis_config").update(...)` -- saves AI analysis config directly
- Line 998: `supabase.from("agents").update({ name: agentName })` -- updates agent name directly
- Line 1202: `supabase.from("agents").update({ name: agentName })` -- updates agent name on blur directly

**Repro:** Open any agent's Settings page, change the name or widget description, and save. The mutation goes directly to Supabase from the browser, not through an API route.

---

### B-2: Direct Supabase mutations in ai-analysis page

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx`

**Lines:** 76, 125

**Description:** This "use client" page performs direct Supabase `.insert()` and `.update()` calls on `ai_analysis_config` from the browser.

- Line 76: `supabase.from("ai_analysis_config").insert({ agent_id: agentId })` -- auto-creates config row
- Line 125: `supabase.from("ai_analysis_config").update(...)` -- saves config directly

**Repro:** Open any agent's AI Analysis page and save changes.

---

### B-3: Login form exposes raw Supabase error messages

**File:** `/Users/laith/Projects/invaria-labs/src/app/(auth)/login/_login-form.tsx`

**Line:** 32

**Description:** `setError(authError.message)` passes the raw Supabase auth error message directly to the UI. Supabase returns messages like `"Invalid login credentials"` (which is acceptable) but can also return technical messages like `"Email not confirmed"` or rate-limit messages that expose internal implementation details. The API route at `/api/auth/route.ts` already handles this correctly with `"Invalid email or password"` -- but the login form bypasses the API route entirely (line 26: `supabase.auth.signInWithPassword` is called directly from the client).

**Repro:** Enter an incorrect password on the login page. The raw Supabase error message is displayed.

---

## WARNINGS

### W-1: Login form uses direct Supabase auth instead of API route

**File:** `/Users/laith/Projects/invaria-labs/src/app/(auth)/login/_login-form.tsx`

**Lines:** 25-35

**Description:** The login form calls `supabase.auth.signInWithPassword()` directly from the client instead of going through `/api/auth` (which has rate limiting via `publicEndpointLimiter`). This means the login page is not rate-limited, allowing brute-force attempts.

---

### W-2: Dashboard reads data directly from Supabase client (read-only)

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/page.tsx`

**Lines:** 129-204

**Description:** The dashboard page fetches agents, call logs, and user data directly from Supabase client-side. The comment at line 162 says "RLS handles client scoping" -- this is acceptable IF RLS policies are correctly configured. However, this pattern differs from the API-route pattern used everywhere else. No mutations are performed, so this is a warning, not a blocker. The scoping relies entirely on Supabase RLS being correct.

---

### W-3: Onboarding page reads directly from Supabase for agent/phone lookups

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx`

**Lines:** 234-267

**Description:** The onboarding page performs direct Supabase reads for `agents`, `phone_numbers`, and `integration_requests` tables. These are read-only and use `.eq("client_id", ...)` filtering, which is acceptable with RLS, but inconsistent with the API-route pattern.

---

### W-4: Function name still says "PortalAutomationsPage" in integrations page

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/integrations/page.tsx`

**Line:** 143

**Description:** The exported function is still named `PortalAutomationsPage` and the inner function `PortalAutomationsContent`. The variable names also use `automations` internally (e.g., `activeAutomations`, `disabledAutomations`). These are internal code names not visible to the user, but they create confusion for developers and could lead to regressions in future work.

---

### W-5: Billing comparison matrix header says "Automations & Integrations"

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/billing/page.tsx`

**Line:** 191

**Description:** The plan comparison dialog shows a category header `"Automations & Integrations"`. This is user-visible text in the billing page's "Compare Plans" modal. While "Automations" in context of "Automations & Integrations" is a feature category name (not a navigation label), it is inconsistent with the rename to "Integrations" elsewhere.

---

### W-6: Signup page has no email/password field validation

**File:** `/Users/laith/Projects/invaria-labs/src/app/(auth)/signup/_signup-form.tsx`

**Description:** The signup page is a Stripe checkout flow (plan selection -> Stripe redirect) with no email or password fields at all. Account creation happens via invite link after payment. This is a valid flow, but there is no client-side validation of anything before checkout.

---

### W-7: Phone number purchase route has no phone format validation

**File:** `/Users/laith/Projects/invaria-labs/src/app/api/phone-numbers/purchase/route.ts`

**Lines:** 18-19

**Description:** The only validation is `if (!phoneNumber)`. There is no format validation (e.g., E.164 format check). Malformed numbers will fail at Twilio, but the error message ("Failed to purchase number from Twilio") is opaque.

---

### W-8: console.error calls in portal pages may leak stack traces in browser devtools

**Files:**
- `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/page.tsx:261`
- `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/billing/page.tsx:431`
- `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx:290`
- `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx:728,1187`
- `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/error.tsx:15`

**Description:** These console.error calls log error objects to browser devtools. While not visible to users, they could leak stack traces or error details if a user opens devtools.

---

## COSMETIC

### C-1: Integrations page interface type still named "Automation"

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/integrations/page.tsx`

**Line:** 54

**Description:** The TypeScript interface is named `Automation` and uses property `automation_recipes`. Internal naming only, not user-visible.

---

### C-2: Integrations page HTML comments say "Active Automations" / "Disabled Automations"

**File:** `/Users/laith/Projects/invaria-labs/src/app/(portal)/[clientSlug]/portal/integrations/page.tsx`

**Lines:** 384, 406

**Description:** HTML comments `{/* Active Automations */}` and `{/* Disabled Automations */}` are developer-only and not rendered, but inconsistent with rename.

---

### C-3: `ActiveAutomationCard` component filename uses "automation"

**File:** `/Users/laith/Projects/invaria-labs/src/components/integrations/active-automation-card.tsx`

**Description:** The file and component are named "automation" rather than "integration." Not user-visible.

---

## Regression Check

### 1. Direct Supabase mutations removed from topics, campaigns, leads, widget pages

- **Topics page:** VERIFIED -- uses `fetch(/api/agents/${agentId}/topics)` for all CRUD
- **Campaigns page:** VERIFIED -- imports `createClient` but no `.insert/.update/.delete` found
- **Leads page:** VERIFIED -- imports `createClient` but no `.insert/.update/.delete` found
- **Widget page:** VERIFIED -- no `.insert/.update/.delete` found
- **Agent Settings page:** REGRESSION -- 6 direct Supabase mutations remain (see B-1)
- **AI Analysis page:** REGRESSION -- 2 direct Supabase mutations remain (see B-2)

### 2. Org-scoping on read queries

- **API routes:** VERIFIED -- `/api/knowledge-base/route.ts` uses `getClientId()` which derives client from authenticated user. `/api/agents/route.ts` filters by `organization_id`. `/api/client/billing/route.ts` scopes by `client_id`.
- **Dashboard page:** Uses RLS (comment at line 162). No explicit `organization_id` filter in client-side query. Acceptable if RLS is configured correctly. PARTIALLY VERIFIED.
- **Onboarding page:** Uses `.eq("client_id", statusData.client_id)` for scoped reads. VERIFIED.

### 3. "Automations" renamed to "Integrations" in UI

- **Sidebar navigation:** VERIFIED -- Link text says "Integrations" at line 319 of portal-sidebar.tsx
- **Integrations page title:** VERIFIED -- `<h1>` says "Integrations" at line 376
- **Billing page comparison matrix:** WARNING -- Category name "Automations & Integrations" at line 191 (user-visible, see W-5)
- **Internal code names:** WARNING -- Function name `PortalAutomationsPage`, variable names still use "automation" (see W-4)

### 4. "Business Settings" renamed to "Knowledge Base"

- **Sidebar navigation:** VERIFIED -- Link text says "Knowledge Base" at line 307 of portal-sidebar.tsx
- **Knowledge Base page title:** VERIFIED -- `<h1>` says "Knowledge Base" at line 48
- **All fetch URLs:** VERIFIED -- All knowledge-base components use `/api/knowledge-base` base URL
- **No remaining "business-settings" references in portal or components:** VERIFIED

### 5. Orphaned routes (/automations, settings/business) deleted

- VERIFIED -- `find` returned no files matching `*/automations*` or `*/settings/business*` under the portal directory
- VERIFIED -- No navigation links pointing to `/automations` or `/settings/business` found

### 6. Admin "Set Up" link was broken (404)

- VERIFIED -- Integrations page "Set Up" click correctly routes to either `RecipeSetupModal` (for self-serve recipes) or `IntegrationRequestModal` (for OAuth-requiring recipes). Both modals are rendered at the bottom of the component (lines 632-666). The logic at lines 451-461 correctly distinguishes between the two flows.

---

## Section-by-Section Results

### 1. SIGNUP/AUTH: PASS (with warnings)

- **Signup:** Is a Stripe checkout redirect flow. Plan cards display correctly. Error handling for failed checkout is present. No email/password fields (account creation happens post-payment via invite link).
- **Login:** Form has email and password fields with `required` attributes. Password toggle (show/hide) works. Links to "Forgot Password" and "Sign Up" are present. ERROR: Raw Supabase auth error messages exposed (B-3). WARNING: Bypasses API route rate limiting (W-1).
- **Auth API route:** Rate limiting, email enumeration prevention, proper error messages. Well-implemented.

### 2. ONBOARDING: PASS

- **Steps 1-7 traced:** Agent type selector -> Industry/use-case selection -> Business info -> Knowledge Base -> Call handling/chat settings -> Conversation flow -> Test call -> Go live.
- **Back button:** Present on Step 1 (industry selection, "Change Industry" button at line 968; agent type change at line 814), Step 2 (line 1170), and other steps use `WizardProgress` component which allows step navigation.
- **Skip optional steps:** Business name is the only required field in Step 2 (line 1179: `disabled={!businessName.trim()}`). Other fields (phone, website, address) are optional.
- **HVAC pre-fills:** The `create-agent` API route seeds services, FAQs, policies, and hours from the selected template's `default_services`, `default_faqs`, `default_policies`, and `default_hours` fields (lines 318-380 of create-agent/route.ts). This correctly populates the Knowledge Base. The Knowledge Base page reads from `/api/knowledge-base` which returns data from `business_settings` table.
- **State persistence:** All step data is saved to `client_onboarding` table via API routes. On reload, `fetchInitialData` restores all state from the onboarding status endpoint.

### 3. DASHBOARD: PASS

- **Zero-data state:** Empty states are handled: "No recent activity" message with icon (line 602-607), "No agents found" with search hint (line 689-693).
- **Loading state:** Full skeleton UI rendered during loading (lines 386-434).
- **KPI calculations:** Correctly compares last 30 days vs previous 30 days for calls, minutes, and active agents. Trend percentages calculated properly. Division by zero handled (line 278: `if (previous === 0) return 0`).

### 4. AGENTS: FAIL (due to B-1, B-2)

- **Create:** Agent creation goes through onboarding wizard via `/api/onboarding/create-agent`. Well-implemented.
- **Agent list:** Dashboard shows agents with search filtering, platform badge, timestamps. Delete goes through API route (`/api/agents/${id}` DELETE).
- **Agent settings:** FAIL -- Direct Supabase mutations for name update, widget config, and AI analysis config (see B-1, B-2).
- **Save/reload persistence:** Agent config is fetched from Retell API and saved back via both direct Supabase (blocker) and API route (`quickPublish`).

### 5. FLOWS: PASS

- **Create:** Uses `/api/conversation-flows` POST via API route.
- **Edit:** Node editor with multiple node types (message, question, condition, transfer, end, check_availability, book_appointment, crm_lookup, webhook). PATCH via API route.
- **Delete:** UNVERIFIED (did not find delete handler in detail, but API route exists at `/api/conversation-flows/[id]`).
- **Empty state:** Handled with template-based flow generation.
- **No direct Supabase mutations:** VERIFIED.

### 6. INTEGRATIONS: PASS

- **Rename verified:** Page title says "Integrations". Sidebar says "Integrations".
- **Recipe cards:** Grouped by section (CRM, Notes & Alerts, General Follow-Up, Invoice & Pricing). Each card shows name, description, icon.
- **Set Up click:** Correctly routes to `RecipeSetupModal` (self-serve) or `IntegrationRequestModal` (OAuth requiring admin setup) based on `requiresAdminSetup()` check.
- **Status visibility:** Active integrations shown in "Active" section with toggle on/off. Pending requests tracked in `pendingRequests` Set. "Requested" state shown on cards.
- **OAuth flow:** Handles `?connected=` and `?oauth_error=` query params on return. Connection status displayed.
- **All mutations via API routes:** VERIFIED (fetch calls to `/api/integrations/client`, `/api/integration-requests`, etc.).

### 7. PHONE NUMBERS: PASS (with warning)

- **Purchase flow:** Goes through API route at `/api/phone-numbers/purchase/route.ts`. Multi-step: Twilio purchase -> SIP trunk association -> Retell import -> Hiya registration -> DB save. Rollback on Retell failure.
- **Add existing (from portal):** Client portal uses integration request flow (`/api/integration-requests`), not direct purchase. Admin handles actual provisioning.
- **Validation:** WARNING -- Only checks `if (!phoneNumber)`. No E.164 format validation (W-7).

### 8. KNOWLEDGE BASE: PASS

- **Pre-filled from onboarding:** VERIFIED. Onboarding Step 2 saves business info to `business_settings` via the step API. The create-agent route seeds services, FAQs, policies, hours from template defaults.
- **All fields editable:** `BusinessInfoForm` provides editable fields for business name, phone, website, address.
- **Save triggers regeneration:** VERIFIED. `/api/knowledge-base` PATCH route calls `regenerateKnowledgeBase(clientId!)` at line 79.
- **Fetch URLs use /api/knowledge-base:** VERIFIED. `business-info-form.tsx` uses `/api/knowledge-base`, `hours-editor.tsx` uses `/api/knowledge-base/hours`, etc. No remaining `/api/business-settings` references.

### 9. BILLING: PASS

- **Current subscription:** Displays plan name, amount, period, status via Stripe subscription data.
- **Invoices:** Lists up to 12 recent invoices with amount, status, date, and PDF download link.
- **Plan comparison:** Full feature comparison matrix in modal dialog.
- **Usage alerts:** Configurable threshold alerts for minutes and spend.
- **All data via API route:** Uses `/api/client/billing` for all data fetching.

### 10. SESSION PERSISTENCE: PASS

- **Middleware:** `/src/middleware.ts` calls `updateSession()` which uses `@supabase/ssr` `createServerClient` to manage cookie-based sessions. The `setAll` callback properly propagates cookies between request and response.
- **Route protection:** Unauthenticated users redirected to `/login`. Role-based access control prevents client users from accessing admin routes and vice versa. Slug validation ensures clients can only access their own portal.
- **Auth callback:** `/src/app/auth/callback/route.ts` exists for handling OAuth callback flows.

### 11. RESPONSIVE/MOBILE: PASS

- **Portal layout:** Desktop sidebar hidden on mobile (`hidden md:flex`). Mobile header bar with hamburger menu visible on mobile only (`md:hidden`). Sheet drawer for mobile navigation.
- **Main content:** `md:ml-60` offset only on desktop. Mobile gets full width with `pt-14` for fixed header.
- **Page layouts:** Knowledge base page uses `p-4 md:p-6`. Integrations page uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Billing page uses responsive grid patterns.
- **Dashboard:** KPI cards use `grid-cols-1 md:grid-cols-3`. Agent grid uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- **Onboarding:** Wizard uses `max-w-3xl mx-auto` with responsive grid layouts for industry and use-case selection.
- **No fixed widths that overflow detected.** Tables use Card-based layouts instead of HTML tables in most portal pages.

### 12. CONSOLE ERRORS: PASS (with warning)

- **Error boundary:** Present at `/src/app/(portal)/[clientSlug]/portal/error.tsx`. Shows user-friendly "Something went wrong" message with retry button.
- **console.error calls:** Found in 5 portal files (see W-8). These log error objects to browser devtools. No sensitive data (API keys, tokens) is logged, but error objects may contain stack traces.
- **Unhandled promise rejections:** All async operations in portal pages are wrapped in try/catch blocks. Error states are communicated via `toast.error()` with user-friendly messages.
