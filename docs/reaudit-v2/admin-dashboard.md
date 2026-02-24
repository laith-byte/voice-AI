# Admin Dashboard Audit — Reaudit V2

## Summary
The admin dashboard has solid pagination, mostly uses API routes for mutations, and has proper middleware-level route protection. However, there are 5 pages that still write directly to Supabase (bypassing API routes), the sidebar and several pages still say "Automations" instead of "Integrations", the client detail layout still says "Business Settings" instead of "Knowledge Base", several sub-tables lack pagination, and one client request link targets a non-existent route.

## BLOCKERS

### B-1: Client Overview page writes directly to Supabase (bypasses API routes)
**File:** `src/app/(startup)/clients/[id]/overview/page.tsx` lines 195-215
- `handleSave` updates the `clients` table directly via `supabase.from("clients").update(...)` instead of going through an API route.
- `handleRemoveMember` (line 223-238) deletes from `users` table directly via `supabase.from("users").delete()`.
- `handleResetOnboarding` (line 240-258) updates `users` table directly.
- These bypass server-side authorization checks. A user could manipulate client data they shouldn't have access to.

### B-2: Client Assigned Agents page writes directly to Supabase
**File:** `src/app/(startup)/clients/[id]/assigned-agents/page.tsx` lines 149-191
- `handleAssign` (line 155) updates `agents.client_id` directly via Supabase.
- `handleUnassign` (line 177) updates `agents.client_id` to null directly.
- No server-side org scoping on these mutations.

### B-3: Client Solutions page writes directly to Supabase
**File:** `src/app/(startup)/clients/[id]/solutions/page.tsx` lines 140-177
- `handleAddSolution` inserts into `client_solutions` directly.
- `handleRemoveSolution` deletes from `client_solutions` directly.
- No API route, no server-side authorization.

### B-4: Client Access page writes directly to Supabase
**File:** `src/app/(startup)/clients/[id]/client-access/page.tsx` lines 96-194
- `fetchFeatures` (line 119) inserts default records directly into `client_access` when no records exist.
- `handleSave` (line 181) upserts into `client_access` directly.
- Direct writes bypass server-side org scoping.

### B-5: Clients list page + Agents list page have NO organization_id filter on read queries
**File:** `src/app/(startup)/clients/page.tsx` lines 118-126
- `fetchClients` queries `supabase.from("clients").select(...)` with no `.eq("organization_id", ...)` filter.
- Relies entirely on RLS. If RLS is misconfigured, this leaks cross-org data.

**File:** `src/app/(startup)/agents/page.tsx` lines 51-65
- `fetchAgents` queries `supabase.from("agents").select(...)` with no organization_id filter.
- Same RLS dependency risk.

### B-6: Automations page `client_automations` query has NO organization_id filter
**File:** `src/app/(startup)/automations/page.tsx` lines 123-127
- `supabase.from("client_automations").select(...)` fetches all rows with no org scoping.
- Could expose cross-org automation data if RLS is not configured.

### B-7: Phone/SIP settings page `agents` and `clients` queries have NO organization_id filter
**File:** `src/app/(startup)/settings/phone-sip/page.tsx` lines 177-184
- `fetchAgentsAndClients` queries both `agents` and `clients` with `.order("name")` only, no org filter.
- Relies entirely on RLS for isolation.

## WARNINGS

### W-1: Sidebar still says "Automations" instead of "Integrations"
**File:** `src/components/layout/startup-sidebar.tsx` line 45
- Nav item label is `"Automations"` with href `/automations`. Per the rename spec, this should be "Integrations".

### W-2: Automations page title still says "Automations"
**File:** `src/app/(startup)/automations/page.tsx` line 252
- Page heading reads `<h1>Automations</h1>`. Should say "Integrations".

### W-3: Client detail layout tab still says "Business Settings" instead of "Knowledge Base"
**File:** `src/app/(startup)/clients/[id]/layout.tsx` line 46
- Tab label is `"Business Settings"` with href `.../business-settings`. Per the rename spec, this should be "Knowledge Base".

### W-4: Admin business-settings page heading still says "Business Settings"
**File:** `src/app/(startup)/clients/[id]/business-settings/page.tsx` line 20
- `<h2>Business Settings</h2>` — should say "Knowledge Base".

### W-5: Automations page links to non-existent route `/clients/{id}/automations`
**File:** `src/app/(startup)/automations/page.tsx` line 308
- When admin clicks "Set Up" on a non-phone integration request, it navigates to `/clients/${req.client_id}/automations`.
- That route does NOT exist (no `src/app/(startup)/clients/[id]/automations/page.tsx` file). This results in a 404.
- Should link to `/clients/${req.client_id}/solutions` or a similar valid route.

### W-6: Dashboard "View All" link for integration requests points to `/automations`
**File:** `src/app/(startup)/dashboard/page.tsx` line 409
- The "View All" button on the Client Requests card links to `/automations`. If the page is renamed to "Integrations", the URL should match.

### W-7: No pagination on 4 sub-tables
The following tables render all rows without pagination:
- **Phone Numbers** (client detail): `src/app/(startup)/clients/[id]/phone-numbers/page.tsx` — no `TablePagination` component.
- **Assigned Agents** (client detail): `src/app/(startup)/clients/[id]/assigned-agents/page.tsx` — no pagination.
- **Solutions** (client detail): `src/app/(startup)/clients/[id]/solutions/page.tsx` — no pagination.
- **Members** (client overview): `src/app/(startup)/clients/[id]/overview/page.tsx` — members table has no pagination.
- **Phone/SIP Settings**: `src/app/(startup)/settings/phone-sip/page.tsx` — phone numbers table has no pagination.

These are bounded by a single client context, so this is low risk unless a client has many records.

### W-8: Integration request PATCH endpoint doesn't scope by organization_id
**File:** `src/app/api/integration-requests/[id]/route.ts` lines 30-41
- The update query uses `.eq("id", id)` only, no `.eq("organization_id", ...)`.
- An admin from org A could theoretically mark a request from org B as complete if they knew the UUID.
- Should add an org scoping filter.

### W-9: No role check in startup layout — only auth check
**File:** `src/app/(startup)/layout.tsx` lines 10-15
- Only checks if user exists (`if (!user) redirect("/login")`).
- Does NOT check if user has a startup role. Middleware handles this separately (line 158-163 of middleware.ts), which is fine, but the layout could be a second line of defense.

## COSMETIC

### C-1: Email preview in whitelabel page uses hardcoded "John Doe" and "john@example.com"
**File:** `src/app/(startup)/settings/whitelabel/page.tsx` lines 694, 701-702
- The live email preview replaces `{{client_name}}` with "John Doe" and `{{client_email}}` with "john@example.com".
- This is technically acceptable for a preview, but uses test-style names. Consider using "Sample Client" or similar.

### C-2: Member invite placeholder uses "member@example.com"
**File:** `src/app/(startup)/clients/[id]/overview/page.tsx` line 559
- Input placeholder is `"member@example.com"`. This is standard UX for email fields and not a real concern.

### C-3: Client detail layout tab order does not include "Embed URL" or "Custom CSS"
**File:** `src/app/(startup)/clients/[id]/layout.tsx` lines 40-47
- The layout tabs are: Overview, Assigned Agents, Phone Numbers, Solutions, Client Access, Business Settings.
- But there are also routes for `/embed-url` and `/custom-css` that are not in the tab nav. Users can only reach them by direct URL.

### C-4: Custom CSS page doesn't persist data
**File:** `src/app/(startup)/clients/[id]/custom-css/page.tsx`
- The page has no fetch or save logic — `handleSave` just shows a toast "coming soon". The CSS state is lost on refresh.
- This is acknowledged as a Phase 2 feature in the UI.

## Section-by-Section

### 1. Admin Pages Overview
All admin pages live under `src/app/(startup)/`. The route groups are:
- `/dashboard` — Home/KPI dashboard
- `/clients` — Client list + detail pages (overview, assigned-agents, phone-numbers, solutions, client-access, business-settings, embed-url, custom-css)
- `/agents` — Agent list + detail pages (overview, agent-config, prompt-tree, ai-analysis, campaigns, widget)
- `/automations` — Recipe management + integration requests
- `/workflows` — n8n webhook workflows
- `/billing` — Connect, subscriptions, invoices, products, coupons, transactions
- `/saas` — Connect, plans, pricing-tables, templates, advanced
- `/settings` — Startup, whitelabel, members, integrations, phone-sip, webhook-logs, usage

**Good:** All mutations on `/agents`, `/workflows`, `/settings/*`, `/billing/*`, `/saas/*` go through API routes.
**Bad:** 4 client sub-pages (overview, assigned-agents, solutions, client-access) write directly to Supabase — see B-1 through B-4.

### 2. Client List
- Table has search + status filter + pagination (25/page). Well implemented.
- Create client uses API route (`POST /api/clients`).
- **Missing:** No CRM connection status column. No phone number count. No Knowledge Base completion status. Only onboarding status is shown.
- **Missing org filter on queries:** See B-5.

### 3. Integration Requests
- **Storage:** `integration_requests` table with `organization_id`, `client_id`, `request_type`, `recipe_id`, `status`, `requested_by`, `resolved_by`, `resolved_at`.
- **Client creates request:** `POST /api/integration-requests` — properly scoped, sends email to all startup_admin users.
- **Admin sees requests:** Dashboard shows pending requests (top 5). Automations page shows all pending requests.
- **Admin can dismiss:** `PATCH /api/integration-requests/[id]` with `status: "dismissed"`. Admin-only check.
- **Admin acts on requests:** "Set Up" button navigates to the client's phone-numbers page (for phone requests) or to `/clients/{id}/automations` (for integrations).
- **Bug:** The `/clients/{id}/automations` route does NOT exist — see W-5.
- **Missing org scope on PATCH:** See W-8.

### 4. Phone Number Management
- **Settings > Phone/SIP** (`/settings/phone-sip`): Shows ALL numbers across all clients with client name, agent name, caller ID, CNAM status. Purchase + import + delete all go through API routes.
- **Client > Phone Numbers** (`/clients/[id]/phone-numbers`): Shows numbers for a specific client. Purchase, import, assign, unassign, delete all go through API routes.
- **Good:** Both pages use API routes for all mutations.
- **Missing pagination on both tables:** See W-7.
- **Missing org filter on agents/clients selector in phone-sip:** See B-7.

### 5. Pagination
Tables WITH pagination (good):
- Clients list (25/page)
- Agents list (25/page)
- Automations/recipes table (25/page)
- Workflows table (25/page)
- Members settings (10/page)
- Webhook logs (25/page)

Tables WITHOUT pagination (see W-7):
- Client > Phone Numbers
- Client > Assigned Agents
- Client > Solutions
- Client > Overview > Members
- Settings > Phone/SIP (both phone numbers and SIP trunks)

### 6. Admin-Client Consistency
- Agent assignment changes on admin side correctly update `agents.client_id`, which is what portal queries use.
- Client access feature toggles correctly update `client_access` table.
- Integration requests flow from client to admin properly.
- Phone number assignments go through API routes that update both Supabase and Retell.

### 7. Route Protection
- **Middleware** (`src/lib/supabase/middleware.ts` lines 157-163): Blocks client users from admin routes (`/agents`, `/clients`, `/settings`, `/billing`, `/saas`, `/automations`, `/workflows`). Redirects them to their portal.
- **Startup layout** (`src/app/(startup)/layout.tsx`): Only checks for authenticated user, does not check role. Middleware is the primary RBAC gate — see W-9.
- **API routes:** The integration-requests API uses `requireAuth` and checks `role.startsWith("startup_")` for admin-only actions.

### 8. Rename Verification
**"Automations" still present in admin-facing code:**
- `src/components/layout/startup-sidebar.tsx:45` — nav label "Automations" (W-1)
- `src/app/(startup)/automations/page.tsx:252` — page title "Automations" (W-2)
- `src/app/(startup)/dashboard/page.tsx:409` — "View All" links to /automations (W-6)

**"Business Settings" still present in admin-facing code:**
- `src/app/(startup)/clients/[id]/layout.tsx:46` — tab label "Business Settings" (W-3)
- `src/app/(startup)/clients/[id]/business-settings/page.tsx:20` — heading "Business Settings" (W-4)
- Also present in portal onboarding, portal settings, and backend utils (prompt-generator, knowledge-base-generator, types/database.ts)

### 9. Test Data Check
- **Whitelabel email preview** uses "John Doe" and "john@example.com" as template variable replacements (C-1). These are preview-only, not persisted.
- **Member invite placeholder** uses "member@example.com" (C-2). Standard UX pattern.
- No hardcoded IDs, no lorem ipsum, no fake company names found in any admin page.
- Placeholder strings like "e.g. Sales Assistant" or "agent_xxxxxxxxxxxx" are in form inputs, which is standard.
