# Client Platform Audit — Reaudit V2

## Summary
The client portal is well-structured with proper API route usage for most mutations, feature gating via FeatureGate/plan access, and good empty states. However, there are critical direct Supabase mutations from client-side code (topics, campaigns, leads, widget_config), a stale URL path for the Integrations page (`/automations` instead of `/integrations`), stale "Business Settings" label in a visible page, and the admin sidebar still says "Automations" instead of "Integrations."

## BLOCKERS

### B-1: Integrations page URL path is still /automations
- **File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx`
- **Issue:** The Integrations page lives at `/[clientSlug]/portal/automations` — not `/integrations`. The sidebar nav link points to `/automations` (portal-sidebar.tsx:310). The rename from "Automations" to "Integrations" updated the display label but NOT the URL route.
- **Impact:** URL inconsistency. If any external links/docs reference `/integrations`, they 404. SEO/UX mismatch between what users see ("Integrations") and the URL bar (`/automations`).

### B-2: Direct Supabase INSERT from client page — Topics
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx:99`
- **Issue:** `supabase.from("topics").insert(...)` called directly from client-side code. Also `supabase.from("topics").delete()` at line 123. No API route used. Relies solely on RLS.
- **Impact:** Bypasses server-side validation. If RLS policy has gaps, any authenticated client user could insert/delete topics for any agent. No server-side audit trail.

### B-3: Direct Supabase INSERT from client page — Campaigns
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/campaigns/page.tsx:443`
- **Issue:** `supabase.from("campaigns").insert(...)` called directly from client-side code with organization_id derived from the user's own record. No API route.
- **Impact:** Same as B-2. Bypasses server-side validation. Client-side code manually fetches organization_id and passes it — if RLS doesn't enforce scoping, cross-org data leak is possible.

### B-4: Direct Supabase UPSERT from client page — Leads Import
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/leads/page.tsx:457`
- **Issue:** `supabase.from("leads").upsert(...)` in batch of 100, inserting directly from client-side. The organization_id is manually fetched from the user record and passed.
- **Impact:** Large-scale data writes from client-side with no server-side rate limiting or validation. Potential for data injection if RLS policies are misconfigured.

### B-5: Direct Supabase UPSERT from client page — Widget Config
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx:213`
- **Issue:** `supabase.from("widget_config").upsert(...)` and `insert` (line 148) called directly from client code.
- **Impact:** Widget config writes bypass server-side validation. A malicious client could inject arbitrary widget config values (including custom CSS — potential for stored XSS via `custom_css` field).

### B-6: Stale "Business Settings" page still accessible and visible
- **File:** `src/app/(portal)/[clientSlug]/portal/settings/business/page.tsx:38`
- **Issue:** The page at `settings/business` still shows `<h1>Business Settings</h1>` and includes CallHandlingSettings, PostCallActions, PiiRedactionSettings — components not present in the new Knowledge Base page. This page is NOT linked from the sidebar but is still routable. It's a different page from Knowledge Base with different content.
- **Impact:** If a user navigates to this URL directly, they see the stale "Business Settings" title. The page also has MORE components than Knowledge Base (call handling, post-call actions, PII redaction) suggesting an incomplete migration.

## WARNINGS

### W-1: Sidebar nav label mismatch — Admin sidebar still says "Automations"
- **File:** `src/components/layout/startup-sidebar.tsx:45`
- **Issue:** Admin startup sidebar nav item reads `"Automations"` with `href: "/automations"`. Should say "Integrations" to match the client portal rename.
- **Impact:** Admin users see "Automations" while client users see "Integrations" — brand/terminology inconsistency.

### W-2: Onboarding Step 3 comment says "Business Settings"
- **File:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx:1196`
- **Issue:** Code comment reads `{/* STEP 3: Business Settings */}`. The step heading says "Configure your business details" which is fine, but the internal comment is stale.
- **Impact:** Developer confusion only — not user-facing. Low priority.

### W-3: Dashboard page has console.error that could leak info
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx:261`
- **Issue:** `console.error("Dashboard fetch error:", err)` — also in billing (line 431), onboarding (line 290), agent-settings (line 728, 1187). These leak error objects to browser console.
- **Impact:** Potential information disclosure in production. Error objects may contain stack traces, query details, or Supabase error messages visible in browser dev tools.

### W-4: Agent delete on dashboard uses direct Supabase RLS but goes through API
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx:715`
- **Issue:** Agent delete correctly uses `fetch(/api/agents/${id}, { method: "DELETE" })`. However, all agents are fetched without explicit client_id filter (line 163-166) — it relies on RLS for scoping.
- **Impact:** If RLS policies for the `agents` table are misconfigured, a client user could see/interact with agents from other clients. The fetch at line 163 has NO `.eq("client_id", ...)` filter.

### W-5: Billing page "Automation Recipes" label in plan comparison
- **File:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx:199`
- **Issue:** Plan comparison matrix row labeled `"Automation Recipes"` with key `max_recipes`. Should say "Integration Recipes" or just "Integrations" to match the rename.
- **Impact:** Stale terminology visible to users in the plan comparison dialog.

### W-6: No Notion, Google Sheets, Google Calendar, QuickBooks, SMS Reminders cards guaranteed
- **File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx`
- **Issue:** Integration cards are dynamically loaded from `automation_recipes` table via API. The page does not hardcode any cards — if a recipe is not in the DB or `is_active=false`, it won't appear. There is no guarantee all 12 expected integrations (Salesforce, GoHighLevel, Google Sheets, Google Calendar, Slack, HubSpot, Webhook, Notion, SMS Reminders, QuickBooks, Housecall Pro, Jobber) are visible.
- **Impact:** If admin hasn't seeded all recipes, client sees incomplete integration list. No fallback or "contact us" for missing integrations.

### W-7: Housecall Pro and Jobber OAuth flow routes exist but "Set Up" routes to admin request
- **File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx:458`
- **Issue:** The `requiresAdminSetup()` function (line 138) checks if any field in config_schema has `type === "oauth_connect"`. If Housecall Pro/Jobber recipes have OAuth fields, they route to the `IntegrationRequestModal` (admin request), not self-serve OAuth. Full OAuth routes exist at `/api/oauth/` and webhook handlers at `/api/webhooks/housecallpro/` and `/api/webhooks/jobber/`, but the client "Set Up" flow may not expose them.
- **Impact:** Depends on recipe config_schema. If HCP/Jobber recipes have `oauth_connect` fields, clicking "Set Up" sends an admin request instead of initiating OAuth — potentially correct by design but worth verifying.

### W-8: Phone number management is request-only, not self-serve
- **File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx:536-613`
- **Issue:** "Get a New Number" and "Connect Existing Number" both POST to `/api/integration-requests` with `request_type: "phone_number"`. There is no self-serve buy/import flow on the client portal. The admin has separate phone number management at `/api/phone-numbers/search`, `/purchase`, `/import`.
- **Impact:** Client cannot buy or import phone numbers themselves — they submit a request and wait for admin. This may be intentional but differs from "Buy Phone Number" and "Add Pre-existing Number" flows mentioned in the brief.

### W-9: Knowledge Base page fetches from /api/business-settings but wraps differently than old page
- **File:** `src/app/(portal)/[clientSlug]/portal/knowledge-base/page.tsx:29`
- **Issue:** Knowledge Base page fetches from `/api/business-settings` and stores as `sharedSettings`, passing to `BusinessInfoForm`. The old Business Settings page at `settings/business/page.tsx` does the same but also includes `CallHandlingSettings`, `PostCallActions`, and `PiiRedactionSettings`. These components are NOT in the Knowledge Base page — they're only accessible via agent-specific pages (`post-call-actions`, `call-handling`).
- **Impact:** Users who relied on Business Settings for call handling / post-call actions / PII redaction may not find these features at the global level anymore.

### W-10: Conversation flows page uses direct Supabase reads
- **File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx`
- **Issue:** Uses `createClient()` from `@/lib/supabase/client` for reads. The save/create/delete operations use API routes (`/api/conversation-flows`, `/api/conversation-flows/[id]`, `/api/agents/[id]/conversation-flow`). But all reads rely on RLS.
- **Impact:** Acceptable pattern if RLS is properly configured, but inconsistent with the API-route-for-everything pattern used elsewhere.

## COSMETIC

### C-1: "Duplicate" agent button shows toast placeholder
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx:657`
- **Issue:** `onClick={() => toast.info("Agent duplication coming soon.")}` — button is visible in the dropdown menu but non-functional.
- **Impact:** User sees a "coming soon" toast. Mildly confusing.

### C-2: "Manual Trigger" button for auto-tagging is a toast stub
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx:289`
- **Issue:** Button shows toast: "Manual trigger coming soon. Auto-tagging runs automatically after new conversations."
- **Impact:** Minor UX issue. Button exists but does nothing meaningful.

### C-3: console.warn in agent-settings
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx:487`
- **Issue:** `console.warn("Could not load agent config from provider, using defaults")` in production code.
- **Impact:** Minor log pollution in browser console.

### C-4: Loading skeleton uses hardcoded bg-white
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx:391,402,419`
- **Issue:** Loading skeleton containers use `bg-white` instead of theme-aware class like `bg-card` or `bg-background`. Won't match dark mode if ever enabled.
- **Impact:** Visual inconsistency in dark mode only.

### C-5: Dashboard KPI "Active Agents" metric is misleading
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx:170,283`
- **Issue:** "Active Agents" is set to `agentsData.length` (total agents) but the trend comparison is against agents that had calls in the previous 30 days. The label "Active Agents" vs the displayed total count is confusing.
- **Impact:** Misleading metric — shows total agents, compares against previously-active agents.

## Section-by-Section

### 1. Onboarding
- **Location:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx`
- 7-step wizard with proper step save/restore via `/api/onboarding/step/[step]` and `/api/onboarding/status`
- Pre-fills business details in step 2 and saves to business_settings via API in step 2
- Step 3 uses `HoursEditor`, `ServicesList`, `FaqsList`, `PoliciesList` components (sub-components save independently)
- Step 5: Conversation flow editor auto-generates from template
- Step 6: Test call/chat with Retell SDK
- Step 7: Go Live with phone number request or deploy flow
- Completed onboarding redirects to portal dashboard
- Code comment "STEP 3: Business Settings" is stale (W-2)
- `console.error` on load failure (W-3)
- Overall: Works end-to-end based on code review

### 2. Dashboard
- **Location:** `src/app/(portal)/[clientSlug]/portal/page.tsx`
- KPI cards (Total Calls, Total Minutes, Active Agents) with 30-day trend
- Recent Activity with date grouping (Today/This Week/Earlier)
- Agent grid with search, dropdown menu, delete confirmation
- Empty states for both no agents and no activity
- Onboarding banner for in-progress/not-started users
- Analytics prompt banner for 10+ calls
- All queries rely on RLS (no explicit client_id filter — W-4)
- `console.error` on fetch failure (W-3)
- Loading skeleton uses `bg-white` not theme-aware (C-4)

### 3. Agents
- **Agent Settings:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` — Massive page (~3500+ lines) with Accordion UI for all config sections. Saves via `/api/agents/[id]` PATCH. Version history, publishing, test call panel. Well-structured.
- **Knowledge Base (per-agent):** `src/app/(portal)/[clientSlug]/portal/agents/[id]/knowledge-base/page.tsx` — Uses API routes correctly (`/api/agents/${agentId}/knowledge-base`)
- **Post-Call Actions:** Simple wrapper around shared component with FeatureGate
- **Call Handling:** Simple wrapper around shared component with FeatureGate
- **Widget Config:** Direct Supabase upsert (B-5) — should use API route
- **Analytics:** Uses direct Supabase reads with RLS
- **Conversations:** Uses direct Supabase reads with RLS, good pagination
- **Topics:** Direct Supabase insert/delete (B-2)
- **Campaigns:** Direct Supabase insert (B-3)
- **Leads:** Direct Supabase upsert for import (B-4), but individual CRUD uses API routes
- **AI Analysis:** Auto-tagging manual trigger is a stub (C-2)
- Delete agent flow: Properly uses API route

### 4. Conversation Flows
- **Location:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx`
- Full CRUD: Create, edit, delete, deploy to agent
- Template-based creation (8 industries x 4 use cases)
- Node types: message, question, condition, transfer, end, check_availability, book_appointment, crm_lookup, webhook
- Saves via API routes (`/api/conversation-flows`, `/api/conversation-flows/[id]`)
- Deploy via `/api/agents/[id]/conversation-flow`
- Good empty state, loading states, error handling
- FeatureGate applied via sidebar (conversation_flows feature flag)
- Reads use direct Supabase (W-10)

### 5. Integrations (formerly Automations) -- CRITICAL
- **Location:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx`
- **Page title:** "Integrations" (correct at line 376)
- **Sidebar label:** "Integrations" (correct at portal-sidebar.tsx:319)
- **URL path:** `/automations` NOT `/integrations` (B-1)
- **Admin sidebar:** Still says "Automations" (W-1)
- **Billing comparison:** Says "Automation Recipes" (W-5)
- Recipe cards loaded dynamically from DB — no hardcoded guarantee of all 12 (W-6)
- "Set Up" flow: Recipes with `oauth_connect` fields route to `IntegrationRequestModal` (admin request). Others open `RecipeSetupModal` for self-serve config.
- Housecall Pro / Jobber: Depends on DB config_schema. OAuth routes exist but may route to admin request (W-7)
- Phone number section at bottom: request-only (W-8)
- All mutations go through API routes (correct)
- OAuth connection handling with query param cleanup
- Plan gating with `isRecipeGated()` function and `UpgradeBanner`

### 6. Phone Numbers
- **Client-facing:** Only via Integrations page bottom section
- "Get a New Number" and "Connect Existing Number" both submit integration requests
- No self-serve buy/import flow on client portal (W-8)
- Admin has full phone management via `/api/phone-numbers/search`, `/purchase`, `/import`, `/[id]/assign`
- Duplicate request prevention via `pendingPhoneRequest` state

### 7. Knowledge Base (formerly Business Settings) -- CRITICAL
- **Location:** `src/app/(portal)/[clientSlug]/portal/knowledge-base/page.tsx`
- Title: "Knowledge Base" (correct)
- Collapsible "Business Profile" section with auto-synced badge
- Sub-components: BusinessInfoForm, HoursEditor, ServicesList, FaqsList, PoliciesList, LocationsList
- Fetches from `/api/business-settings` (correct)
- Sub-components save independently through their own API calls
- Info callout about agent-specific KB sources
- **Old page still exists** at `settings/business/page.tsx` with "Business Settings" title (B-6)
- Old page has CallHandlingSettings, PostCallActions, PiiRedactionSettings — not in KB page (W-9)
- No remaining "Business Settings" references in sidebar navigation

### 8. Billing
- **Location:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx`
- Fetches from `/api/client/billing`, `/api/usage/alerts`, `/api/usage/forecast`
- Stripe billing portal via POST to `/api/client/billing`
- Plan upgrade via `/api/checkout`
- Usage alerts with threshold config
- Spend forecast with trend indicator
- Plan comparison dialog with full feature matrix
- Invoice list with PDF download links
- "Automation Recipes" label in comparison (W-5)
- All mutations through API routes (correct)

### 9. Every Interactive Element
- All "Set Up" buttons on recipe cards properly route to setup modal or request modal
- Agent delete confirmation dialog with proper API call
- Campaign CRUD with create/edit/delete dialogs
- Conversation flow editor with save/deploy/delete
- "Duplicate" agent is a toast stub (C-1)
- "Manual Trigger" auto-tagging is a toast stub (C-2)
- All other buttons, dropdowns, toggles, forms have proper handlers
- No `href="#"` or empty `href=""` found
- No dead-end modals found

### 10. Responsive Check
- Portal layout: `md:ml-60` for sidebar offset, `pt-14 md:pt-0` for mobile header
- Mobile: Sheet drawer sidebar with hamburger menu (portal-sidebar.tsx:386-411)
- Dashboard: `grid-cols-1 md:grid-cols-3` for KPIs, `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for agents
- Integrations: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for recipe cards
- Knowledge Base: `max-w-6xl mx-auto`, `p-4 md:p-6`
- Agent settings: Uses Accordion UI (inherently responsive)
- Billing: Plan comparison dialog uses `w-[95vw]` with scroll
- No fixed-width containers found that would break on mobile
- Overall responsive implementation is solid
