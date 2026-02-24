# Admin Dashboard Audit -- Fulfillment + Management

Auditor: Teammate 2
Date: 2026-02-23
Scope: `src/app/(startup)/` admin dashboard pages

---

## Previous Fix Verification

### Fix #9: Agent-settings page mutations through API routes
VERIFIED. `agents/[id]/agent-config/page.tsx` uses `fetch('/api/agents/${id}/config')` for all saves. No direct Supabase mutations on that page.

### Fix #10: AI-analysis page mutations through API routes
VERIFIED. `agents/[id]/ai-analysis/page.tsx` uses `fetch('/api/agents/${id}/ai-analysis-config')`, `fetch('/api/agents/${id}/ai-analysis')`, and `fetch('/api/agents/${id}/topics')` for all mutations.

### Fix #11: Admin billing/saas mutations through API routes
- **billing/connect/page.tsx**: VERIFIED. Uses `fetch('/api/admin/stripe-connections')` for upsert, mark_connected, and disconnect_keep_account. Lines 75, 109, 138.
- **saas/connect/page.tsx**: VERIFIED. Uses `fetch('/api/admin/stripe-connections')` for upsert, mark_connected, and disconnect. Lines 79, 108, 169.
- **saas/pricing-tables/page.tsx**: VERIFIED. Uses `fetch('/api/admin/pricing-tables')` for create (line 124), `fetch('/api/admin/pricing-tables/${id}')` for delete (line 163) and toggle (line 185).
- **saas/plans/page.tsx**: VERIFIED. Uses `fetch('/api/admin/plans')` for create (line 372), `fetch('/api/admin/plans/${id}')` for edit (line 408), delete (line 435), and toggle (line 457).

---

## Audit Findings

### 1. Client List

**File**: `src/app/(startup)/clients/page.tsx`

**Expected columns**: plan, status, integrations connected, phone number assigned, Knowledge Base completion %, last active
**Actual columns**: Client Name, Status, Onboarding, Agents, Created

| Expected Column | Present | Notes |
|---|---|---|
| Plan | NO | Not shown. No query for client_plans subscription. |
| Status | YES | Active/Inactive/Suspended via StatusBadge |
| Integrations connected | NO | Not shown |
| Phone number assigned | NO | Not shown |
| KB completion % | NO | Not shown |
| Last active | NO | Shows "Created" date instead |
| Onboarding progress | YES | Via OnboardingBadge (not in requirements, but useful) |
| Agent count | YES | Via join to agents table |

**Org-scoping**: GOOD. Line 136: `.eq("organization_id", orgId)` on clients query.

**Org-scoping issue**: Line 139-141: `client_onboarding` query has NO org_id filter. It fetches ALL client_onboarding rows globally. While RLS may protect this, the query should include `.eq("organization_id", orgId)` for defense-in-depth.

**Pagination**: GOOD. Uses `TablePagination` component, 25 per page, resets on filter change.

**Empty state**: GOOD. Distinct messaging for filtered-empty vs truly-empty.

**Sorting**: MISSING. No column header sorting capability.

**Create client**: GOOD. Uses `fetch('/api/clients')` API route (line 187).

### 2. Request Queue -- CRITICAL SECTION

**Table**: `integration_requests` -- EXISTS. Stores both integration and phone_number request types.

**API routes**:
- `GET /api/integration-requests` (line 8): Lists requests. Admins see org-scoped (`startup_` role prefix check). Clients see only their own. Supports `?status=` filter.
- `POST /api/integration-requests` (line 52): Clients create requests. Sends email notification to startup admins.
- `PATCH /api/integration-requests/[id]` (line 5): Admin updates status to "completed" or "dismissed".

**Admin UI surfaces**:

1. **Dashboard home** (`dashboard/page.tsx`, lines 397-460): Shows top 5 pending requests in a highlighted amber card. Each shows client name, request type (phone or integration name), timestamp via `timeAgo()`, and a "Set Up" link that navigates to `clients/${client_id}/phone-numbers` or `clients/${client_id}/overview`.

2. **Integrations page** (`integrations/page.tsx`, lines 282-358): Shows all pending requests in card grid. Each has "Set Up" button (navigates to client phone-numbers or solutions page) and dismiss button (X) that calls `PATCH /api/integration-requests/${id}` with `status: "dismissed"`.

**GAPS in Request Queue**:

- **No dedicated request queue page**: Requests appear as a section on dashboard and integrations page, but there is no dedicated `/requests` route for a full-featured queue view.
- **No "mark complete" action**: Only "Set Up" (navigate away) and dismiss (X). No in-place "Complete" button that marks the request as `completed`. Admin must navigate to the client page, fulfill manually, then come back -- but the request stays as `pending` unless dismissed.
- **No notes field**: Admin cannot add notes to a request.
- **No reject action**: Only "dismissed" status. No explicit "rejected" with reason.
- **Dashboard shows max 5**: Line 153 limits to 5. If there are 20 pending requests, admin sees only 5 on dashboard. The "View All" link goes to `/integrations` which does show all, but that page is primarily the recipe management page, not a request queue.
- **No filter/sort on requests**: The integrations page shows all pending requests but has no filter by type, date range, or client.
- **Client-side status update**: PARTIAL. The `integration_requests` table has a `status` field. When admin marks as completed/dismissed, the client can query their own requests via `GET /api/integration-requests` and see the updated status. However, there is no real-time notification back to the client -- they'd need to refresh.

**Request types stored**: `integration` (with `recipe_id`) and `phone_number`.

**Client-side request creation**: VERIFIED. `src/components/integrations/integration-request-modal.tsx` calls `POST /api/integration-requests`.

### 3. Phone Number Management

**Admin-wide phone page**: `src/app/(startup)/settings/phone-sip/page.tsx`
- Inventory view of ALL phone numbers across org (with agent name, client name)
- Purchase number flow: search by area code or toll-free, select, assign to client+agent
- Import number flow: enter E.164 number, assign to client+agent
- Caller ID editing (inline)
- Delete numbers
- SIP trunk management (add/edit/delete)
- All mutations go through API routes (`/api/phone-numbers/*`, `/api/sip-trunks/*`)

**Per-client phone page**: `src/app/(startup)/clients/[id]/phone-numbers/page.tsx`
- Lists numbers for specific client
- Purchase (pre-fills clientId)
- Import (pre-fills clientId)
- Assign/unassign to agent
- Delete
- All mutations via API routes

**Unassigned numbers visible**: YES. Numbers without agent show "Unassigned" (line 411).

**ISSUE**: Per-client phone query (line 98-101) filters by `client_id` but does NOT also filter by `organization_id`. If client IDs are UUIDs this is likely fine, but org-scoping should be added for defense-in-depth.

### 4. Integration Management

**Admin integrations page**: `src/app/(startup)/integrations/page.tsx`
- Recipe CRUD via API routes (`/api/integrations/recipes`, `/api/integrations/recipes/${id}`)
- Toggle active/inactive
- Shows client count per recipe and last triggered timestamp
- Pending client requests section

**Per-client integration configuration**: `src/app/(startup)/clients/[id]/solutions/page.tsx`
- Assign/remove solutions (integrations) to specific client
- Via API routes (`/api/clients/${id}/solutions`)

**OAuth connection management**: `src/app/(startup)/settings/integrations/page.tsx` -- handles provider API keys (Retell, etc.)

**GAPS**:
- No per-client integration event logs page in admin UI (the API route exists at `/api/integrations/client/[id]/logs` but no admin page consumes it)
- No OAuth connection status per client visible in admin UI
- Client automation stats query on integrations page (line 138) uses direct Supabase `.from("client_automations").select(...)` -- this is a READ, not a mutation, from a "use client" component. The read is org-scoped via the `orgClientIds` filter.

### 5. Client Oversight

**Client detail pages** (under `/clients/[id]/`):
- **Overview**: Client info form, members table, agent onboarding progress, portal preview
- **Assigned Agents**: List, assign, unassign agents
- **Phone Numbers**: Buy, import, assign, delete numbers
- **Solutions**: Assign/remove integrations
- **Client Access**: Feature permission toggles (9 features)
- **Knowledge Base**: Full KB management (business info, hours, services, FAQs, policies, locations, call handling, post-call actions)
- **Embed URL**: Configure widget embed domain (not in tab nav but route exists)
- **Custom CSS**: Phase 2 placeholder (not in tab nav but route exists)

**Tab navigation** (client layout line 40-47): Overview, Assigned Agents, Phone Numbers, Solutions, Client Access, Knowledge Base.

**GAPS**:
- No admin view of a client's billing/subscription status
- No admin view of a client's call logs or conversation transcripts
- No admin view of a client's agent performance metrics
- Embed URL and Custom CSS pages exist but are NOT in the tab navigation

### 6. Tables -- Sort, Filter, Paginate

| Page | Sort | Filter | Paginate | Empty State | Notes |
|---|---|---|---|---|---|
| Clients list | NO | Status filter, search | YES (25/page) | YES | No column sorting |
| Client members | NO | NO | NO | YES | Small table, acceptable |
| Assigned agents | NO | NO | NO | YES | Small table, acceptable |
| Phone numbers (client) | NO | Search | NO | YES | Missing pagination |
| Solutions | NO | NO | NO | YES | Missing pagination |
| Integrations/recipes | NO | NO | YES (25/page) | YES | No column sorting |
| Pricing tables | NO | NO | NO | YES | Missing pagination |
| Plans | NO | NO | NO | YES | Card layout, no pagination |

**ISSUE**: Phone numbers (per-client), solutions, and pricing tables have no pagination. With 50+ rows these tables would be unwieldy.

### 7. Admin Action -> Client Effect

**Traced flows**:

1. Admin assigns agent to client -> writes to `agents` table `client_id` field via `/api/clients/${id}/assigned-agents` -> client portal queries agents by `client_id` -> client sees new agent. VERIFIED.

2. Admin purchases phone number for client -> `/api/phone-numbers/purchase` creates row in `phone_numbers` table with `client_id` -> client portal queries by `client_id` -> visible to client. VERIFIED.

3. Admin toggles feature permission -> `/api/clients/${id}/client-access` PUT updates `client_feature_access` table -> portal checks feature access -> controls what client sees. VERIFIED.

4. Admin dismisses integration request -> `PATCH /api/integration-requests/${id}` sets `status: dismissed` -> client's next fetch of their requests sees updated status. VERIFIED but no push notification to client.

5. Admin updates client status to "suspended" -> `PATCH /api/clients/${id}` updates status -> middleware does NOT check client status for portal access. GAP: suspended clients can still log in and use portal.

### 8. Client Blocked from Admin

**File**: `src/lib/supabase/middleware.ts`, lines 158-163.

```typescript
const adminRoutes = ["/agents", "/clients", "/settings", "/billing", "/saas", "/integrations", "/workflows"];
if (isClientUser && adminRoutes.some((r) => pathname.startsWith(r))) {
  // Redirect to portal
}
```

VERIFIED. Client users (role `client_admin` or `client_member`) are redirected away from all admin routes. The `/dashboard` route is also protected (lines 148-155).

**GOOD**: Slug validation ensures client users can only access their own portal slug (lines 174-181).

**GAP**: The `/workflows` route is in the admin blocklist but the sidebar label is "Integrations" pointing to `/integrations`. Both are covered.

### 9. Rename Complete -- "Automations" and "Business Settings" in Admin Pages

**Hits found**:

| File | Line | Text | Context | UI-Facing? |
|---|---|---|---|---|
| `saas/plans/page.tsx` | 723 | `Automations` | Section header in plan feature toggles form | YES -- visible to admin when editing plan |
| `integrations/page.tsx` | 92 | `StartupAutomationsPage` | Function name (code-only) | NO |
| `integrations/page.tsx` | 488 | `No automation recipes yet` | Empty state text | YES -- visible to admin |
| `integrations/page.tsx` | 523 | `Delete Automation Confirmation` | Comment (code-only) | NO |
| `integrations/page.tsx` | 527 | `Delete Automation` | AlertDialog title | YES -- visible to admin |
| `integrations/page.tsx` | 529 | `this automation recipe` | AlertDialog description | YES -- visible to admin |
| `clients/[id]/solutions/page.tsx` | 205 | `Automations and integrations enabled` | Subtitle text | YES -- visible to admin |

**"Business Settings"**: ZERO hits in admin pages. CLEAN.

### 10. No Test Data

No placeholder/dummy/test content found in admin pages beyond standard form placeholder text (e.g., `placeholder="e.g. Starter"`, `placeholder="price_..."`). These are appropriate UX hints, not test data.

### 11. Console Statements

**console.error count in admin pages**: 55+ instances across all `(startup)` pages.

These are exclusively `console.error()` calls in catch blocks or error handlers. No `console.log()` for debugging was found. While console.error is acceptable for production error tracking, the quantity is notable.

**console.log**: ZERO in admin pages (good).

**Notable**: `dashboard/page.tsx` line 200 has `console.error("Failed to load dashboard data:", err)` which will fire on any dashboard load failure.

### 12. Previous Punch List (Audit #6)

No explicit audit-6 document found in `/docs/`. Verifying known admin-related items from the lessons:

- **Mutations through API routes**: All billing/saas pages now use API routes (fix #11). VERIFIED.
- **Direct Supabase mutations in "use client"**: Found in 4 files:
  1. `saas/advanced/page.tsx` line 67: `.upsert()` on `organization_settings` -- DIRECT MUTATION.
  2. `agents/[id]/layout.tsx` line 75: `.update({ name })` on `agents` -- DIRECT MUTATION.
  3. `agents/[id]/campaigns/page.tsx` lines 79, 117: `.insert()` and `.update()` on `campaign_config` -- DIRECT MUTATION.
  4. `agents/[id]/widget/page.tsx` lines 203, 241: `.insert()` and `.update()` on `widget_config` -- DIRECT MUTATION.

---

## Additional Findings

### A. Org-Scoping Gaps in Client-Side Queries

| File | Line | Table | Has org_id filter? |
|---|---|---|---|
| `clients/page.tsx` | 139 | `client_onboarding` | NO -- fetches all rows globally |
| `clients/[id]/overview/page.tsx` | 144 | `clients` | Filtered by `id` only, no org check |
| `clients/[id]/overview/page.tsx` | 157 | `users` | Filtered by `client_id` only |
| `clients/[id]/overview/page.tsx` | 170 | `client_onboarding` | Filtered by `client_id` only |
| `clients/[id]/phone-numbers/page.tsx` | 98 | `phone_numbers` | Filtered by `client_id` only |
| `clients/[id]/phone-numbers/page.tsx` | 131 | `agents` | Filtered by `client_id` only |
| `clients/[id]/assigned-agents/page.tsx` | 92 | `agents` | Filtered by `client_id` only |
| `clients/[id]/solutions/page.tsx` | 66 | `client_solutions` | Filtered by `client_id` only |

Note: These are all admin pages accessed by authenticated startup users. RLS should protect at the database level, but adding `organization_id` filters provides defense-in-depth.

### B. Navigation Link Verification

All sidebar links resolve to real routes:
- `/dashboard` -> `dashboard/page.tsx` EXISTS
- `/clients` -> `clients/page.tsx` EXISTS
- `/agents` -> `agents/page.tsx` EXISTS
- `/integrations` -> `integrations/page.tsx` EXISTS
- `/billing/connect` -> `billing/connect/page.tsx` EXISTS
- `/saas/connect` -> `saas/connect/page.tsx` EXISTS
- `/settings/startup` -> `settings/startup/page.tsx` EXISTS

Quick action links on dashboard:
- `/settings/usage` -> `settings/usage/page.tsx` EXISTS
- `/billing` -> This link on line 543 points to `/billing` which does NOT have an index page. The billing layout redirects to `/billing/connect`. ACCEPTABLE but imprecise.

### C. Client Detail Layout Missing Tabs

The client detail layout (`clients/[id]/layout.tsx`) defines 6 tabs but there are 8 page routes:
- Tab: Overview, Assigned Agents, Phone Numbers, Solutions, Client Access, Knowledge Base
- Hidden: `embed-url/page.tsx`, `custom-css/page.tsx`

These pages exist and are accessible via direct URL but have no tab navigation to reach them.

---

## Summary

- **BLOCKERS**: 4
- **WARNINGS**: 10
- **COSMETIC**: 3

### Blockers

**B-1**: No dedicated admin request queue page with full CRUD. Requests are shown as a limited section on dashboard (max 5) and integrations page. No "mark as complete" button -- only navigate-away and dismiss. No notes, no reject. This is the core fulfillment workflow and it is incomplete.

**B-2**: Direct Supabase mutations in "use client" components. Repeated violation of the rule "ALL mutations must go through API routes." Found in 4 files:
- `saas/advanced/page.tsx:67` -- `.upsert()` on `organization_settings`
- `agents/[id]/layout.tsx:75` -- `.update()` on `agents`
- `agents/[id]/campaigns/page.tsx:79,117` -- `.insert()` and `.update()` on `campaign_config`
- `agents/[id]/widget/page.tsx:203,241` -- `.insert()` and `.update()` on `widget_config`

**B-3**: "Automations" text still appears in UI-facing admin pages. Rule states zero "Automations" references in UI-facing text. Found 5 instances:
- `saas/plans/page.tsx:723` -- "Automations" section header
- `integrations/page.tsx:488` -- "No automation recipes yet"
- `integrations/page.tsx:527` -- "Delete Automation" dialog title
- `integrations/page.tsx:529` -- "this automation recipe" dialog description
- `clients/[id]/solutions/page.tsx:205` -- "Automations and integrations enabled"

**B-4**: Client list page missing required columns. Spec requires: plan, integrations connected, phone number assigned, KB completion %, last active. Only status and created date are shown. 5 of 6 required data columns are absent.

### Warnings

**W-1**: `client_onboarding` query in `clients/page.tsx:139` has no `organization_id` filter. Fetches all onboarding rows globally. Should add `.eq("organization_id", orgId)`.

**W-2**: Per-client detail pages query by `client_id` without `organization_id` defense-in-depth filter (overview, phone-numbers, assigned-agents, solutions). 8 queries affected.

**W-3**: No pagination on per-client phone numbers, solutions, or pricing tables pages. Would break with 50+ rows.

**W-4**: No column sorting on any admin table (clients, phone numbers, agents, recipes).

**W-5**: No admin view of client billing/subscription status. Admin cannot see which plan a client is on or their payment status.

**W-6**: No per-client integration event logs page in admin UI. API exists (`/api/integrations/client/[id]/logs`) but no page consumes it.

**W-7**: Suspended client status does not block portal access. Middleware checks role but not client status. A suspended client can still log in and use the portal.

**W-8**: Client detail layout has 8 page routes but only 6 tabs. `embed-url` and `custom-css` pages are orphaned with no navigation.

**W-9**: Dashboard "Manage Billing" quick action links to `/billing` which has no index page. Works due to layout redirect but is imprecise.

**W-10**: 55+ `console.error` calls across admin pages. While not `console.log`, this is a high volume that could be replaced with a structured logger.

### Cosmetic

**C-1**: `StartupAutomationsPage` function name in `integrations/page.tsx:92` still references "Automations" in code (not UI-facing).

**C-2**: `clients/page.tsx:228` subtitle says "Manage your startup clients" -- the word "startup" here refers to the org type but could confuse users.

**C-3**: `custom-css/page.tsx` is a Phase 2 placeholder with no save functionality (line 15-17: `toast.info("Custom CSS saving coming soon.")`). Should either be hidden or clearly disabled.
