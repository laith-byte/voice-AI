# Client Platform Audit (Second Pass)

Scope: every page under `src/app/(portal)/[clientSlug]/portal/`
Auditor: Claude Opus 4.6 (automated)
Date: 2026-02-22

---

## BLOCKERS

### B-1: Knowledge base delete has no confirmation
**File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/knowledge-base/page.tsx:161-176`
Clicking the delete button on a knowledge base source immediately fires the delete request with no `window.confirm()` or `AlertDialog`. A misclick permanently destroys data.

### B-2: Topics table empty-state colSpan mismatch
**File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx:257`
The empty-state `<td>` uses `colSpan={3}` but the table header defines 4 columns (Topic, Calls, Date Added, Actions). This causes the empty-state row to be visually misaligned.

### B-3: Conversation flows delete uses `window.confirm()` with optimistic UI
**File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx:494-513`
Delete uses optimistic removal (`setFlows` before API call) gated only by `window.confirm()`. If the API fails, the flow is restored, but the UX relies on a native browser dialog and may be jarring. Recommend replacing with an AlertDialog to match the pattern used in agent-settings.

---

## WARNINGS

### W-1: Multiple dialogs missing `DialogDescription` (accessibility)
Screen readers announce dialogs using both `DialogTitle` and `DialogDescription`. The following dialogs have a `DialogTitle` but no `DialogDescription`, which triggers an accessibility warning in most screen reader tooling:

| Page | Dialog | Line(s) |
|------|--------|---------|
| campaigns | Create Campaign | ~569 |
| campaigns | Edit Campaign | ~1017 |
| topics | Add Topic | ~147-148 |
| leads | Import Leads | Dialog near lead import flow |
| leads | Lead Tags | Dialog near tag management |
| leads | Edit Lead | Dialog near lead edit form |
| conversation-flows | Flow Editor | ~824-828 |
| billing | Plan Comparison | ~285-287 |
| portal-sidebar | Change Password | ~422-428 |
| portal-sidebar | Dashboard Color Picker | Dialog near color picker (has a `<p>` description but not a formal `DialogDescription` component) |

### W-2: Dashboard page fetch error has no toast
**File:** `src/app/(portal)/[clientSlug]/portal/page.tsx:247-250`
The main `fetchDashboardData` catch block logs to `console.error` but does not show a `toast.error`. Every other page uses toast for fetch failures. The user sees a blank dashboard with no feedback.

### W-3: Dashboard and agent-settings hardcode "active" status for all agents
**Files:**
- `src/app/(portal)/[clientSlug]/portal/page.tsx:629`
- `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx:1269-1272`

Both the dashboard agent grid and the agent-settings hero header display a hardcoded "Active" badge regardless of the agent's actual status. This is misleading if an agent is paused, errored, or in draft state.

### W-4: Multiple pages use `window.confirm()` for destructive actions
The following pages use the native browser `window.confirm()` instead of a proper `AlertDialog` component. Native dialogs cannot be styled, are inconsistent across browsers, and look unprofessional:

| Page | Action | Line |
|------|--------|------|
| dashboard (portal) | Delete agent | ~646 |
| campaigns | Delete campaign | ~472 |
| topics | Delete topic | ~105 |
| leads | Delete lead | ~536 |
| conversation-flows | Delete flow | ~629 |

Agent-settings uses `AlertDialog` correctly; these pages should follow the same pattern.

### W-5: Widget page has no URL validation
**File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx`
URL input fields for agent image, background image, launcher image, terms URL, and privacy URL have no client-side validation. Invalid URLs are silently saved and will result in broken images or links on the deployed widget.

### W-6: AI Analysis page uses inline plan-gating instead of `FeatureGate`
**File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx`
Unlike other feature-gated pages, AI Analysis uses `usePlanAccess()` + `UpgradeBanner` directly instead of wrapping in `<FeatureGate>`. Functionally equivalent but inconsistent with the codebase pattern, making it easier to miss in future audits.

### W-7: Conversation flows page mixes API fetch and direct Supabase client queries
**File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx:268-304`
The `fetchFlows` function fetches flows via the API (`/api/conversation-flows`) but fetches agents via direct Supabase client queries. This mixed pattern bypasses any API-level authorization logic for agents and relies solely on RLS.

---

## COSMETIC

### C-1: Billing page loading state is minimal
**File:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx:552-559`
The billing page uses a simple centered spinner instead of skeleton cards like other pages (dashboard, analytics, campaigns, etc.). Visually inconsistent.

### C-2: Settings/business page has no page-level loading state
**File:** `src/app/(portal)/[clientSlug]/portal/settings/business/page.tsx`
The page is a thin wrapper composing 9 sub-components. There is no page-level loading skeleton; each sub-component handles its own loading independently, which may cause layout shift as they load at different times.

### C-3: Automations page loading state uses centered spinner instead of skeleton
**File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx`
Uses `Suspense` with a `Loader2` spinner fallback rather than skeleton cards, inconsistent with most other pages.

### C-4: Conversation flows template section duplicates card rendering logic
**File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx:693-817`
The template card rendering is duplicated between the "all" filter view (grouped by use case) and the filtered view. Not a bug, but a maintenance concern.

---

## VERIFICATION CHECKLIST

### Middleware does NOT block portal routes
**VERIFIED** - `src/lib/supabase/middleware.ts:158-164`
The `adminRoutes` array is `["/agents", "/clients", "/settings", "/billing", "/saas", "/automations", "/workflows"]`. These are matched via `pathname.startsWith(r)`, which checks top-level paths. Portal routes like `/<slug>/portal/billing` do not match `/billing` because the pathname starts with `/<slug>`, not `/billing`. All portal routes pass through safely.

### Onboarding Go Live step (Step 7) phone status display
**VERIFIED** - `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx:2340-2646`
Voice agents: shows the assigned phone number if one exists, or "Your phone number will be configured by your team" if not. No radio buttons. Chat agents: shows embed code snippet. SMS agents: shows phone number input field. The step correctly adapts to agent type.

### Portal sidebar feature filtering
**VERIFIED** - `src/components/layout/portal-sidebar.tsx`
The sidebar dynamically filters `agentNavItems` based on `allowedFeatures` which is computed from the `/api/client-access` and `/api/plan-access` endpoints. Items whose feature key is not in the allowed set are hidden. The sidebar also has a `SheetTitle` with `sr-only` class for mobile sheet accessibility.

### Feature gate logic (two-layer check)
**VERIFIED** - `src/components/portal/feature-gate.tsx`
Layer 1: checks `client_access` table for explicit admin overrides. Layer 2: falls back to the plan column from `client_plans`. For `agent_settings`, it checks either `raw_prompt_editor` or `speech_settings_full`. Default behavior is to allow access if no record exists.

### All pages have loading states
**VERIFIED** - Every page has either skeleton cards, a `Loader2` spinner, or a `Suspense` boundary.

### All pages have error handling (toast on failure)
**VERIFIED WITH EXCEPTION** - All pages use `toast.error()` on fetch/save failures EXCEPT the dashboard page (see W-2). Billing page also silently swallows alerts and forecast errors, but those are explicitly optional features with comments noting the silent failure is intentional.

### All pages with list data have empty states
**VERIFIED** - Dashboard (agents, recent activity), analytics (charts), conversations, campaigns, knowledge base, topics, leads, automations, conversation flows all have proper empty states.

### FeatureGate wrapping
**VERIFIED** - The following pages are wrapped in `<FeatureGate>`:
- analytics (`feature="analytics"`)
- conversations (`feature="conversations"`)
- campaigns (`feature="campaigns"`)
- knowledge-base (`feature="knowledge_base"`)
- topics (`feature="topics"`)
- leads (`feature="leads"`)
- prompt-tree (`feature="conversation_flows"`)
- conversation-flows (`feature="conversation_flows"`)
- agent-settings (`feature="agent_settings"`, wrapped at page level line 1238)

Pages correctly NOT wrapped: dashboard, widget, billing, settings/business, onboarding, automations (uses inline recipe gating).

### Form validation
**VERIFIED** - All forms with required fields have client-side validation:
- Campaigns: requires `campaignName.trim()`
- Knowledge base: validates name, content/URL/file depending on source type
- Topics: requires `newTopicName.trim()`
- Conversation flows: requires `flowName.trim()`
- Onboarding step 2: requires `businessName.trim()`
- Billing: validates `stripe_monthly_price_id` before checkout
- Agent-settings: validates JSON in dynamic variables and analysis data config before publish; validates agent name before save

---

## SUMMARY

| Severity | Count |
|----------|-------|
| BLOCKER  | 3     |
| WARNING  | 7     |
| COSMETIC | 4     |

**Blockers must be fixed before launch:**
1. Knowledge base delete needs a confirmation dialog
2. Topics table colSpan should be 4, not 3
3. Conversation flows delete should use AlertDialog instead of `window.confirm()` with optimistic UI

**Highest-priority warnings:**
- W-2 (dashboard missing toast on error) and W-3 (hardcoded "active" status) directly affect user trust
- W-1 (missing DialogDescription) affects accessibility compliance
- W-4 (window.confirm everywhere) affects professional appearance

**What looks good:**
- Middleware correctly scopes portal routes - no leaking between startup and client roles
- Onboarding Go Live step correctly shows phone status display (not radio buttons) for voice agents
- Feature gate two-layer check (client_access + plan fallback) works correctly
- All pages have loading states and (mostly) proper error handling
- Sidebar correctly filters nav items based on feature access
- Billing page is comprehensive with plan comparison, usage alerts, cost forecast, and invoice history
- Agent-settings page (2500+ lines audited) uses AlertDialog for destructive actions, proper FeatureGate wrapping, plan-gated sub-features, thorough error handling with toast, and JSON validation before publish
