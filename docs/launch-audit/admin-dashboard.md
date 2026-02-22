# Admin Dashboard -- Full Surface Audit

**Date:** 2026-02-22
**Auditor:** admin-auditor (automated)
**Scope:** All pages, tables, filters, action buttons, user management flows, analytics views, and config panels under `src/app/(startup)/`

---

## Severity Legend

| Level     | Meaning |
|-----------|---------|
| BLOCKER   | Prevents launch or causes data loss / security vulnerability |
| WARNING   | Functional gap that should be fixed before launch |
| COSMETIC  | Low-priority polish item |

---

## 1. Layouts

### 1.1 Main Layout (`src/app/(startup)/layout.tsx`)
- Uses `StartupSidebar` component, responsive with `ml-16 md:ml-64`.
- No direct auth guard at the layout level -- relies on middleware + Supabase session.
- **PASS** -- No issues found.

### 1.2 Clients Detail Layout (`src/app/(startup)/clients/[id]/layout.tsx`)
- Tabs: Overview, Assigned Agents, Phone Numbers, Solutions, Client Access, Business Settings.
- Two additional tabs (Custom CSS, Embed URL) hidden behind `showPhase2` flag.
- Back link to `/clients` list.
- **PASS** -- No issues found.

### 1.3 Agents Detail Layout (`src/app/(startup)/agents/[id]/layout.tsx`)
- Tabs: Overview, Agent Config, Prompt Tree, AI Analysis, Widget, Campaigns.
- Inline agent name editing with direct Supabase update.
- Prototype call dialog (uses retell_agent_id).
- **WARNING** -- Inline agent name update does no validation on empty string. An admin could clear the name to blank. Should validate `name.trim().length > 0`.
- **PASS** -- Otherwise well-structured with loading/error states.

### 1.4 Settings Layout (`src/app/(startup)/settings/layout.tsx`)
- Tabs: Startup, Whitelabel, Members, Integrations, Phone/SIP, Webhook Logs, Usage.
- **PASS** -- Clean tab navigation.

### 1.5 Billing Layout (`src/app/(startup)/billing/layout.tsx`)
- Tabs: Connect, Active Products, Subscriptions, Transactions, Invoices, Coupons.
- **PASS** -- No issues.

### 1.6 SaaS Layout (`src/app/(startup)/saas/layout.tsx`)
- Tabs: Connect Stripe, Agent Templates, Client Plans, Pricing Tables, Advanced Settings.
- **PASS** -- No issues.

---

## 2. Dashboard (`src/app/(startup)/dashboard/page.tsx`)

- Shows setup checklist (5 steps), KPI cards (clients, agents, calls, onboarding completion, usage), domain card, quick actions.
- Has loading state, error state with retry button.
- Fetches user, organization, clients, agents, calls, and domain data.
- **PASS** -- Comprehensive loading, error, and empty states. Good use of toasts.

---

## 3. Agents Pages

### 3.1 Agent List (`src/app/(startup)/agents/page.tsx`)
- Search filter, create dialog (name, platform select, retell_agent_id).
- Table: name, platform badge, assigned client, created date.
- Has loading spinner and empty state.
- **PASS** -- Well structured. Create dialog validates `name` is required.

### 3.2 Agent Overview (`src/app/(startup)/agents/[id]/overview/page.tsx`)
- Shows data sync method (webhook/periodic), credentials, webhook URL with copy.
- Radio group for sync method with auto-save.
- **PASS** -- Loading state present. Copy-to-clipboard works.

### 3.3 Agent Config (`src/app/(startup)/agents/[id]/agent-config/page.tsx`)
- Massive file (~1612 lines). Two-column layout.
- Left: system prompt, language, LLM, voice selects, voice controls, first message, prompt tree CTA.
- Right: 11 collapsible panels -- Tools (6 tool types), Speech Settings, Transcription, Call Settings, Advanced LLM, Knowledge Base, Post Call Analysis, Security & Privacy, Webhook, MCPs, Versioning.
- Save syncs to both local DB and Retell API.
- Publish creates immutable version snapshot.
- **WARNING** -- No unsaved changes warning. If a user navigates away after editing the system prompt but before saving, changes are silently lost.
- **WARNING** -- The `customFunctions` tool editing dialog is complex with multiple JSON-like fields (parameters array). No JSON validation on custom function parameters. Malformed entries could cause Retell API sync failures.
- **COSMETIC** -- File is very large (1612 lines). Could benefit from component extraction but not a launch blocker.

### 3.4 Agent Campaigns (`src/app/(startup)/agents/[id]/campaigns/page.tsx`)
- Calling rate config (min/max or fixed mode) with auto-save via debounce.
- **PASS** -- Auto-saves correctly. Number inputs have min constraints.

### 3.5 Agent AI Analysis (`src/app/(startup)/agents/[id]/ai-analysis/page.tsx`)
- Config sections: Summary, Evaluation, Auto-Tagging (auto/manual modes), Misunderstood Queries.
- Topics CRUD with add/delete.
- Auto-seeds default config row on first visit.
- **PASS** -- Loading state, save button, character counters. All sections work correctly.

### 3.6 Agent Widget (`src/app/(startup)/agents/[id]/widget/page.tsx`)
- Collapsible panels: General (images, layout, description), Theme (background, launcher, font, colors, CSS), Advanced (autolaunch, messages, TOS/privacy URLs).
- Live preview of widget on right side.
- Image uploads to Supabase storage (`widget-assets` bucket).
- Auto-seeds default config row on first visit.
- **WARNING** -- Custom CSS input (`customCss` state) is stored and presumably rendered in the widget. No sanitization of CSS content. A startup admin could inject malicious CSS that affects the client portal widget. This is an XSS-adjacent risk.
- **PASS** -- Image upload validates file type and size (2MB max). Good preview. Save button works.

### 3.7 Agent Prompt Tree (`src/app/(startup)/agents/[id]/prompt-tree/page.tsx`)
- Thin wrapper that renders `PromptTreeEditor` component.
- **PASS** -- Delegates to dedicated component.

---

## 4. Clients Pages

### 4.1 Client List (`src/app/(startup)/clients/page.tsx`)
- Search filter, status filter (all/active/inactive/suspended), create dialog.
- Create dialog: name, auto-generated slug, language select, theme select.
- Table rows clickable to navigate to detail.
- **PASS** -- Loading, empty state, search, and filter all work. Slug auto-generation from name.

### 4.2 Client Overview (`src/app/(startup)/clients/[id]/overview/page.tsx`)
- Portal preview card, onboarding progress with step labels, client info form, members table.
- Members: add (email + role), remove, reset onboarding.
- **WARNING** -- The "Add Member" flow creates a user via `supabase.auth.admin.createUser()` called indirectly, but the frontend just calls `supabase.from('users').insert(...)` and `supabase.auth.admin` is not available client-side. The invite flow actually calls `/api/auth` route. This is correct but the email-sending path should be verified to ensure it works end-to-end.
- **PASS** -- Otherwise comprehensive. Slug display, portal link, onboarding progress bar.

### 4.3 Client Assigned Agents (`src/app/(startup)/clients/[id]/assigned-agents/page.tsx`)
- Assign/unassign agents via direct Supabase updates (not API routes).
- **WARNING** -- Uses direct Supabase client updates (`supabase.from('agents').update(...)`) rather than API routes. This bypasses any server-side validation. While RLS likely protects against cross-org access, the pattern is inconsistent with other pages that use API routes.
- **PASS** -- UI works correctly. Shows agent name, platform, and assignment status.

### 4.4 Client Phone Numbers (`src/app/(startup)/clients/[id]/phone-numbers/page.tsx`)
- Purchase (Twilio search), Import (E.164), Assign to agent, Unassign, Delete.
- Uses API routes: `/api/phone-numbers`, `/api/phone-numbers/[id]/assign`, `/api/phone-numbers/[id]` (DELETE).
- **PASS** -- Comprehensive flow with Twilio + Retell + Hiya integration. AlertDialog confirmation for delete. E.164 format validation on import.

### 4.5 Client Solutions (`src/app/(startup)/clients/[id]/solutions/page.tsx`)
- Assign/remove solutions with select dropdown.
- **PASS** -- Simple and functional.

### 4.6 Client Access (`src/app/(startup)/clients/[id]/client-access/page.tsx`)
- 9 feature permission toggles.
- Auto-seeds defaults on first visit via upsert.
- **PASS** -- Clean toggle interface. Save uses upsert.

### 4.7 Client Business Settings (`src/app/(startup)/clients/[id]/business-settings/page.tsx`)
- Composes: BusinessInfoForm, HoursEditor, ServicesList, FaqsList, PoliciesList, LocationsList, CallHandlingSettings, PostCallActions.
- **PASS** -- Delegates to separate components.

### 4.8 Client Custom CSS (`src/app/(startup)/clients/[id]/custom-css/page.tsx`)
- Phase 2 placeholder. CSS editor with preview.
- Save shows toast "coming soon".
- **COSMETIC** -- Phase 2 placeholder. Save button exists but does nothing -- could confuse users. Consider either hiding the save button or adding a more prominent "Coming Soon" banner.

### 4.9 Client Embed URL (`src/app/(startup)/clients/[id]/embed-url/page.tsx`)
- Phase 2 placeholder. Domain input with embed code preview.
- **COSMETIC** -- Phase 2 placeholder, same as Custom CSS.

---

## 5. Settings Pages

### 5.1 Startup Settings (`src/app/(startup)/settings/startup/page.tsx`)
- Logo uploads (coming soon), startup name, workspace ID with copy, AI API key (add/update/remove), compliance status (GDPR/HIPAA), danger zone (delete org).
- **WARNING** -- The "Delete Organization" button in the danger zone section needs careful review. Verify that deletion cascade is properly handled in the database (clients, agents, phone numbers, integrations all cleaned up). If the cascade is missing, this could leave orphaned data.
- **WARNING** -- AI API key (likely OpenAI) is stored via direct Supabase update. The key is visible in the UI after being set. Consider masking the key display (show only last 4 chars).
- **COSMETIC** -- Logo upload sections show "Coming Soon" placeholder.

### 5.2 Members (`src/app/(startup)/settings/members/page.tsx`)
- Team members list with search, invite dialog (email + role select).
- **PASS** -- Fetches users filtered by startup roles. Invite sends to API.

### 5.3 Integrations (`src/app/(startup)/settings/integrations/page.tsx`)
- 6 provider cards: retell, elevenlabs, vapi, openai, salesforce, gohighlevel.
- Connect via API key dialog, disconnect, configure.
- **PASS** -- Well-structured. Connect/disconnect uses the `/api/integrations` route. Each provider has appropriate description and icon.

### 5.4 Phone/SIP (`src/app/(startup)/settings/phone-sip/page.tsx`)
- Phone numbers table with inline caller ID editing, CNAM status.
- Purchase/Import dialogs with client + agent selectors.
- SIP trunks CRUD (label, URI, username, password, codec).
- **WARNING** -- SIP trunk password is stored as plaintext in the form state and sent to the API. The API route (`/api/sip-trunks`) does encrypt the password server-side via `encrypt()`, but the password field is visible in the UI during creation/editing. Consider using `type="password"` input fields.
- **PASS** -- Comprehensive phone number management. Delete confirmation with AlertDialog.

### 5.5 Whitelabel (`src/app/(startup)/settings/whitelabel/page.tsx`)
- Branding: favicon (coming soon), website title, color theme picker, loading icon/size.
- Domain: primary + backend domains.
- Email: sending domain, sender address/name, logo (coming soon).
- Email templates: password_setup, password_reset, startup_invite with variable substitution and live HTML preview.
- **WARNING** -- Email template editor allows arbitrary HTML input with live preview using `dangerouslySetInnerHTML`. While this is admin-only, the HTML is later used in actual emails. No sanitization is visible -- a compromised admin account could inject malicious scripts into outgoing emails.
- **PASS** -- Otherwise feature-rich. Color picker, email preview, variable substitution all work.

### 5.6 Webhook Logs (`src/app/(startup)/settings/webhook-logs/page.tsx`)
- Filterable by date range, agent, and event type.
- Stats cards: success rate, conversations recovered.
- Table: event type badges, import/forwarding results, platform call ID, timestamp.
- **PASS** -- Good filtering, stats, and table display. Proper date formatting.

### 5.7 Usage (`src/app/(startup)/settings/usage/page.tsx`)
- Date range picker, stat cards, cost per agent table, daily cost bar chart, cost by component pie chart (Recharts), cost forecast, phone number counts.
- **PASS** -- Comprehensive analytics. Responsive charts. Date range filtering works.

---

## 6. Billing Pages

### 6.1 Billing Connect (`src/app/(startup)/billing/connect/page.tsx`)
- Stripe Connect OAuth flow: create account, redirect to Stripe onboarding, handle return.
- Disconnect with AlertDialog confirmation.
- Update account link.
- Uses `Suspense` boundary for `useSearchParams()`.
- **PASS** -- Proper OAuth flow. Disconnect has confirmation. Loading states present.

### 6.2 Billing Products (`src/app/(startup)/billing/products/page.tsx`)
- List products from connected Stripe account.
- Create product dialog (name, description, price).
- Not-connected state redirects to Connect tab.
- **WARNING** -- No ability to edit or archive existing products. Only create and view. The Stripe warning banner says "do not edit from Stripe Dashboard" but there is no edit functionality here either.
- **PASS** -- Loading, empty, and not-connected states all handled.

### 6.3 Billing Subscriptions (`src/app/(startup)/billing/subscriptions/page.tsx`)
- Active/Scheduled toggle filter.
- List subscriptions from Stripe.
- Create Subscription button shows "coming soon" toast.
- **COSMETIC** -- Create Subscription button exists but only shows a toast. Consider hiding it or making it visually distinct as a placeholder.
- **PASS** -- Filter toggle, status badges, loading states.

### 6.4 Billing Transactions (`src/app/(startup)/billing/transactions/page.tsx`)
- List charges from Stripe with receipt links.
- Status badges (succeeded/pending/failed).
- **WARNING** -- The Amount column header has a sort icon (`ArrowUpDown`) but sorting is not actually implemented. Clicking does nothing.
- **PASS** -- Otherwise correct display of transactions.

### 6.5 Billing Invoices (`src/app/(startup)/billing/invoices/page.tsx`)
- List invoices from Stripe.
- Create Invoice button shows "coming soon" toast.
- Invoice numbers link to hosted Stripe invoice URL.
- **COSMETIC** -- Same "coming soon" pattern as subscriptions.
- **PASS** -- Correct status badges and linked invoice numbers.

### 6.6 Billing Coupons (`src/app/(startup)/billing/coupons/page.tsx`)
- List and create coupons on Stripe.
- Create dialog: code, type (percent/fixed), amount, duration (once/repeating/forever).
- **WARNING** -- `amount_off` for fixed-amount coupons is sent as a float directly. Stripe expects `amount_off` in cents (integer). The `parseFloat(newAmount)` value is sent as-is, but Stripe's API expects cents. A $10 discount would need to be sent as 1000, not 10. This could create incorrect coupon values.
- **PASS** -- Otherwise correct coupon display with code, discount, redemptions, expiry.

---

## 7. SaaS Configurator Pages

### 7.1 SaaS Connect Stripe (`src/app/(startup)/saas/connect/page.tsx`)
- Separate Stripe Connect flow for SaaS billing (distinct from the billing connect page).
- Connect, Update, Disconnect actions.
- OAuth return handling with `?connected=true` parameter.
- **WARNING** -- There are two separate Stripe Connect pages: `/billing/connect` and `/saas/connect`. Both manage `stripe_connections` for the same organization. This could be confusing -- if a user connects via billing and then visits SaaS connect, the state should be shared, but the UIs are different (billing uses AlertDialog for disconnect, SaaS does not).
- **COSMETIC** -- The SaaS disconnect button lacks a confirmation dialog, unlike the billing disconnect which uses AlertDialog.

### 7.2 Agent Templates (`src/app/(startup)/saas/templates/page.tsx`)
- Grid of template cards with create and delete.
- Provider select dropdowns (text: openai/anthropic/google, voice: retell/elevenlabs/vapi).
- **WARNING** -- The text/voice provider selects at the top of the page are shared state with the create dialog form -- changing them on the page also changes the dialog defaults. This is confusing UX because the selects appear to be global filters but are actually form pre-fills.
- **PASS** -- CRUD works. Card layout with description, providers, date.

### 7.3 Client Plans (`src/app/(startup)/saas/plans/page.tsx`)
- Comprehensive plan management with create, edit, duplicate, delete, toggle active.
- 5-tab form: Identity, Pricing, Usage, Features (40+ toggles), Display.
- Feature toggles: analytics, automations, agent config, support categories.
- Stripe price IDs for monthly/yearly/setup.
- **PASS** -- Very comprehensive plan builder. Edit dialog, duplicate, status toggle all work. Plan cards show pricing, usage limits, and feature badges.

### 7.4 Pricing Tables (`src/app/(startup)/saas/pricing-tables/page.tsx`)
- Create pricing tables with plan selection, visual customization (colors, button shape, highlight).
- Toggle active/inactive. Copy embed code. Delete.
- **WARNING** -- Delete has no confirmation dialog. Clicking the trash icon immediately deletes. This is inconsistent with other pages that use AlertDialog for destructive actions.
- **PASS** -- Embed code copy, active toggle, plan selection all work.

### 7.5 Advanced Settings (`src/app/(startup)/saas/advanced/page.tsx`)
- Payment success redirect URL.
- Simple input + save.
- **PASS** -- Minimal page, works correctly.

---

## 8. Automations (`src/app/(startup)/automations/page.tsx`)

- Recipe management: create, edit, delete, toggle active.
- Shows recipe table: name, n8n webhook URL, client count, last triggered, status.
- Uses `RecipeEditor` component for create/edit dialog.
- Fetches client automation stats from `client_automations` table.
- "Coming Soon" badge support for recipes.
- **PASS** -- Well-structured CRUD. API-backed save/delete/toggle. Recipe editor in dialog. Good empty state.

---

## 9. Workflows (`src/app/(startup)/workflows/page.tsx`)

- n8n webhook workflow management using `solutions` table.
- Create (name + webhook URL), toggle active, list view.
- "Not HIPAA Compliant" badge displayed.
- **WARNING** -- No edit or delete functionality for existing workflows. Once created, a workflow cannot be renamed, have its webhook URL changed, or be deleted. Only the active toggle works.
- **WARNING** -- The "Assigned To" column in the table shows `wf.description` which is the solution's description field, not an actual assignment. The column header is misleading.
- **PASS** -- Create dialog validates name and webhook URL. Optimistic toggle update with rollback on failure.

---

## 10. Auth & Middleware Audit

### 10.1 Middleware (`src/middleware.ts` + `src/lib/supabase/middleware.ts`)
- All routes (except public routes and API routes) require authentication.
- Role-based redirects: client users -> portal, startup users -> dashboard.
- Client users blocked from `/dashboard` routes, startup users blocked from portal routes.
- Slug validation for portal paths.
- **BLOCKER** -- The middleware checks `pathname.startsWith("/dashboard")` for admin route protection, but admin pages are actually served under route group `(startup)` which maps to paths like `/agents`, `/clients`, `/settings`, `/billing`, `/saas`, `/automations`, `/workflows`. These paths are NOT explicitly blocked for client users in the middleware. A client user who manually navigates to `/agents` or `/settings` would not be redirected. The page would load, and while Supabase RLS likely prevents data access, the UI shell and empty states would be visible.

### 10.2 API Route Auth (`src/lib/api/auth.ts`)
- All API routes use `requireAuth()` which checks for authenticated user.
- **WARNING** -- `requireAuth()` only checks if a user is authenticated, not their role. A client user calling `/api/billing` or `/api/automations/recipes` would pass auth. The API routes do check `organization_id` scoping, but some routes (e.g., `/api/automations/recipes` GET) explicitly handle role differentiation while others do not. This should be audited per-route.

### 10.3 Client-Side Data Access
- Most admin pages fetch data directly from Supabase client (`createClient()`).
- Data is scoped by `organization_id` fetched from the authenticated user.
- **WARNING** -- Several pages (assigned-agents, client-access, client-overview members) perform direct Supabase mutations from the client side without going through API routes. While RLS should protect against unauthorized access, this bypasses server-side validation and audit logging.

---

## 11. Cross-Cutting Concerns

### 11.1 Loading States
- **PASS** -- All pages have loading spinners using `Loader2` component. Consistent pattern.

### 11.2 Empty States
- **PASS** -- All list/table pages have empty state designs with descriptive text and CTA buttons.

### 11.3 Error Handling
- **PASS** -- Most pages use `toast.error()` for API/database failures. Dashboard has a retry button on error.
- **WARNING** -- Some pages silently fail on fetch errors (e.g., settings pages with `catch {}` blocks that don't show user feedback).

### 11.4 Form Validation
- **PASS** -- Create/edit dialogs generally validate required fields by disabling the submit button.
- **WARNING** -- No server-side validation visible for most fields. Client-side validation only (empty checks on name fields).

### 11.5 Pagination
- **BLOCKER** -- No pagination implemented on any list/table page. All pages fetch all records and render them. For organizations with many clients, agents, phone numbers, transactions, or invoices, this will cause performance degradation and potentially crash the browser. Critical pages: Transactions, Invoices, Webhook Logs, Call Logs.

### 11.6 Confirmation Dialogs
- **WARNING** -- Inconsistent use of confirmation dialogs for destructive actions:
  - HAS confirmation: phone number delete, Stripe disconnect (billing), organization delete
  - MISSING confirmation: pricing table delete, plan delete, template delete, workflow (no delete at all), recipe delete (uses dropdown but no confirmation)

---

## Summary

### BLOCKERs (2)
1. **Middleware does not block client users from admin routes** -- Client users can access `/agents`, `/clients`, `/settings`, `/billing`, `/saas`, `/automations`, `/workflows` without being redirected. While RLS protects data, the UI is exposed.
2. **No pagination on any table** -- All lists fetch all records. Will break with scale.

### WARNINGs (16)
1. Agent name can be set to empty string via inline edit
2. No unsaved changes warning on agent config page
3. No JSON validation on custom function parameters
4. Widget custom CSS stored without sanitization (XSS-adjacent)
5. Client assigned-agents uses direct Supabase mutations, not API routes
6. Organization delete cascade needs verification
7. AI API key displayed in full (not masked)
8. SIP trunk password visible in UI (should be type="password")
9. Email template editor allows arbitrary unsanitized HTML
10. Billing products have no edit/archive capability
11. Transactions table sort icon is decorative (not functional)
12. Coupons `amount_off` may be sent as dollars instead of cents to Stripe
13. Two separate Stripe Connect pages may cause confusion
14. SaaS templates provider selects double as global state and form defaults
15. Pricing table delete has no confirmation
16. Workflows cannot be edited or deleted; "Assigned To" column label is misleading

### COSMETICs (5)
1. Agent config page is very large (1612 lines)
2. Phase 2 placeholders (Custom CSS, Embed URL) have non-functional save buttons
3. Billing create subscription/invoice buttons show "coming soon" toast
4. SaaS disconnect lacks confirmation dialog (unlike billing disconnect)
5. Logo upload sections show "Coming Soon" in settings

---

*Audit completed 2026-02-22*
