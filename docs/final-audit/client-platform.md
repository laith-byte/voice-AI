# Client-Facing Platform Audit

**Auditor:** client-platform-auditor
**Date:** 2026-02-22
**Scope:** Every page, component, and interaction under `src/app/(portal)/`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Portal Layout & Navigation](#portal-layout--navigation)
3. [Dashboard (Portal Home)](#dashboard-portal-home)
4. [Automations Page](#automations-page)
5. [Billing Page](#billing-page)
6. [Conversation Flows Page](#conversation-flows-page)
7. [Onboarding Page](#onboarding-page)
8. [Business Settings Page](#business-settings-page)
9. [Agent Sub-Pages](#agent-sub-pages)
10. [New Components Audit](#new-components-audit)
11. [Conversation Flow Templates (HVAC Entry)](#conversation-flow-templates-hvac-entry)
12. [Responsive & Accessibility Audit](#responsive--accessibility-audit)
13. [Cross-Cutting Concerns](#cross-cutting-concerns)
14. [Findings Summary](#findings-summary)

---

## Executive Summary

The client-facing portal is a feature-rich Next.js App Router application with 16+ pages, a full sidebar navigation system, feature gating, plan-based access control, and a customizable theme. The NEW additions (RecentSyncsWidget, ServiceMappingEditor, HCP/Jobber provider entries, HVAC templates) integrate cleanly into the existing architecture.

**Total Findings: 14**
- BLOCKER: 1
- WARNING: 8
- COSMETIC: 5

---

## Portal Layout & Navigation

**File:** `src/app/(portal)/[clientSlug]/layout.tsx`

### Structure
- Wraps children in `DashboardThemeProvider` > `OnboardingProvider`
- Renders `PortalSidebar` (fixed left, 60px wide) and `PortalChatWidget`
- `main` has `md:ml-60` to offset for sidebar, `pt-14 md:pt-0` for mobile header

### Findings

**[COSMETIC-01] Mobile header overlaps gradient accent bar**
- `main` has `pt-14 md:pt-0` for mobile, but the 2px gradient bar at the top of `main` renders under the fixed mobile header (14 = 56px header height). The gradient is purely decorative so this is minor.
- File: `src/app/(portal)/[clientSlug]/layout.tsx:21`

### Portal Sidebar (`src/components/layout/portal-sidebar.tsx`)

- Desktop: fixed `hidden md:flex w-60` sidebar
- Mobile: `Sheet` drawer triggered by hamburger menu button with `aria-label="Open menu"`
- Navigation items: Agents, Flows (conditionally gated), Automations, Business Settings, Billing
- Agent sub-view: Back to Agents, then filtered nav items based on `allowedFeatures`
- User profile dropdown: Change Password, Take a Tour, Dashboard Color, Log Out
- Feature gating: reads `client_access` table first, falls back to plan columns via `/api/client/plan-access`

**[WARNING-01] Notifications button is non-functional**
- The "Notifications" button in the sidebar footer renders with a hardcoded `0` badge but has no `onClick` handler. It is a `<button>` with no action.
- File: `src/components/layout/portal-sidebar.tsx:336-343`

---

## Dashboard (Portal Home)

**File:** `src/app/(portal)/[clientSlug]/portal/page.tsx`

### Page Structure
- "use client" page, uses `useParams` for `clientSlug`
- Fetches: client name via Supabase, onboarding status via API, agents + call logs via Supabase
- Sections: Onboarding banner, 10+ calls analytics banner, KPI cards (3x), Recent Activity, **RecentSyncsWidget (NEW)**, Agent Grid

### Data Fetching
- `fetchData` wrapped in `useCallback` with try/catch, sets `loading` state
- Parallel `Promise.all` for call logs, recent calls, previous agent counts
- Error handling: `catch` block shows `toast.error("Failed to load dashboard data")` and sets `loading(false)`

### States
- **Loading:** Full skeleton UI with shimmer animations for KPI cards, activity list, agent grid
- **Empty agents:** "No agents found" message with Bot icon
- **Empty calls:** "No recent activity" message with PhoneCall icon
- **Error:** Toast notification, loading stops

### RecentSyncsWidget Integration
- Imported at line 44: `import { RecentSyncsWidget } from "@/components/portal/recent-syncs-widget";`
- Rendered at line 614: `<RecentSyncsWidget />` between Recent Activity and Agent Grid
- Import resolves correctly to `src/components/portal/recent-syncs-widget.tsx`

### Findings

**[WARNING-02] Delete agent lacks authorization check on frontend**
- The delete agent flow calls `fetch(\`/api/agents/${id}\`, { method: "DELETE" })` directly. While the API likely enforces auth, the frontend doesn't verify the user has permission to delete before showing the option. The "Delete" option appears in the dropdown for all agents.
- File: `src/app/(portal)/[clientSlug]/portal/page.tsx:662,714-729`

---

## Automations Page

**File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx`

### Page Structure
- Wrapped in `Suspense` with skeleton fallback (correct pattern for `useSearchParams`)
- Inner `PortalAutomationsContent` component handles data fetching
- Fetches recipes, automations, and OAuth connections in parallel
- Handles `?connected=` and `?oauth_error=` query params from OAuth redirect

### Provider Entries (NEW)
- `PROVIDER_LABELS` (line 72-81): Includes `housecallpro: "Housecall Pro"` and `jobber: "Jobber"` -- correctly added
- `RECIPE_PLAN_GATES` (line 84-101): Includes `housecallpro: "crm_integration"` and `jobber: "crm_integration"` -- correctly gated

### OAuth Flow
- On `?connected=<provider>`, shows success toast using `PROVIDER_LABELS[connected]`, then refreshes connections and cleans URL
- On `?oauth_error=<msg>`, shows error toast and cleans URL

### States
- **Loading:** Full skeleton (page-level `Suspense` + internal `loading` state)
- **Empty recipes + automations:** Empty state with Sparkles icon and message
- **Active/Disabled automations:** Separate sections with counts
- **Gated recipes:** Shown with Lock overlay and reduced opacity
- **Recipe limit reached:** `UpgradeBanner` component rendered

### Findings

**[WARNING-03] OAuthConnectButton PROVIDER_LABELS missing new CRM providers**
- `src/components/automations/oauth-connect-button.tsx:19-24` only lists `google`, `slack`, `hubspot`, `quickbooks`. Missing: `housecallpro`, `jobber`, `salesforce`, `gohighlevel`.
- When these providers are used in recipe setup modals, the connect button will display the raw provider key (e.g., "housecallpro") instead of the human-readable label ("Housecall Pro").
- The fallback `PROVIDER_LABELS[provider] || provider` prevents a crash but produces an ugly label.
- File: `src/components/automations/oauth-connect-button.tsx:19-24`

---

## Billing Page

**File:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx`

### Page Structure
- Large, comprehensive page (~1295 lines)
- Fetches billing data, usage alerts, and cost forecast in parallel
- Sections: Current subscription, current plan details, plan usage summary, active add-ons, available plans (upgrade), cost forecast, usage alerts, enterprise CTA, invoices

### States
- **Loading:** Full skeleton UI
- **No billing data:** "No billing information available yet" fallback
- **No forecast:** "No usage data available yet" message
- **Alerts loading:** Spinner in the alerts card
- **Error:** Toast notification for billing fetch failure

### Plan Comparison Dialog
- Full feature comparison matrix with 5 categories and 30+ rows
- Scrollable body with sticky plan names header
- Responsive grid based on plan count

### Findings

**[COSMETIC-02] Billing page is very long (~1295 lines)**
- The page renders the entire billing UI in one file. This is not a functional issue but increases cognitive load for maintenance. No immediate action needed.
- File: `src/app/(portal)/[clientSlug]/portal/billing/page.tsx`

---

## Conversation Flows Page

**File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx`

### Page Structure
- Wrapped in `FeatureGate feature="conversation_flows"` -- correctly gated
- Full CRUD for conversation flows (create, edit, delete, deploy)
- Template gallery: 8+ industries x 4 use cases = 32+ templates (now 36+ with HVAC)
- Flow editor in a Dialog with drag-and-drop node reordering
- Node types: message, question, condition, transfer, end, check_availability, book_appointment, crm_lookup, webhook

### States
- **Loading:** Centered spinner
- **No flows:** Empty state with "No flows yet" message and CTA
- **Template filter:** Tabs to filter by use case
- **Editor open:** Full Dialog with node list, save, deploy, cancel
- **Delete confirmation:** AlertDialog

### Findings

**[BLOCKER-01] INDUSTRY_STYLES map missing "hvac" key**
- The `INDUSTRY_STYLES` record at line 143-209 contains entries for: `healthcare`, `financial_services`, `insurance`, `logistics`, `home_services`, `retail`, `travel_hospitality`, `debt_collection`.
- The HVAC industry was added to `INDUSTRIES` in `conversation-flow-templates.ts` at line 106, but `INDUSTRY_STYLES` in the flows page was NOT updated.
- When rendering HVAC templates, `INDUSTRY_STYLES[t.industryKey]` returns `undefined`, causing the template cards to render with:
  - A gray fallback icon (`GitBranch`) instead of a themed icon
  - No gradient background (falls back to `"from-gray-500 to-gray-600"`)
  - No industry-specific badge colors (empty classNames)
- The page will NOT crash (the code uses `style?.icon ?? GitBranch`, `style?.gradient ?? "from-gray-500 to-gray-600"`, etc.), but the HVAC templates will look visually broken compared to all other industries.
- File: `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx:143-209`
- **Impact:** 4 HVAC template cards (one per use case) will have incorrect styling

---

## Onboarding Page

**File:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx`

### Page Structure
- Multi-step wizard (7 steps)
- Imports from many components: WizardProgress, TestCallCoaching, TestCallTranscript, TestCallReport, QuickFixModal, TestChatInline, HoursEditor, ServicesList, FaqsList, PoliciesList, INDUSTRIES, generateTemplateNodes, ConversationFlowEditor
- Uses both Supabase client and API routes
- Test call integration with Retell SDK and canvas-confetti

### Findings

**[WARNING-04] Onboarding page imports RetellWebClient at page level**
- `import { RetellWebClient } from "retell-client-js-sdk"` is imported at the page level (line 46). If the Retell SDK is large, this increases the page bundle size even for users who never use the test call feature. A dynamic import would be more efficient.
- File: `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx:46`

---

## Business Settings Page

**File:** `src/app/(portal)/[clientSlug]/portal/settings/business/page.tsx`

### Page Structure
- Composes 9 sub-components: BusinessInfoForm, HoursEditor, ServicesList, FaqsList, PoliciesList, LocationsList, CallHandlingSettings, PostCallActions, PiiRedactionSettings
- Fetches shared settings once and passes to BusinessInfoForm and CallHandlingSettings as `initialSettings`
- Sub-components handle their own loading states independently

### States
- Each sub-component manages its own loading, error, and empty states
- No page-level loading state (sub-components render independently)
- Shared settings fetch failure is silently caught (sub-components have fallback fetch)

### Findings

No issues found. The composition pattern is clean and the independent loading approach prevents a single failure from blocking the entire page.

---

## Agent Sub-Pages

All agent sub-pages live under `src/app/(portal)/[clientSlug]/portal/agents/[id]/`.

### Pages Audited

| Page | Feature Gate | Import Pattern | Notes |
|------|-------------|----------------|-------|
| `analytics/page.tsx` | `FeatureGate feature="analytics"` | Standard imports | Uses recharts |
| `conversations/page.tsx` | `FeatureGate feature="conversations"` | Suspense wrapper for useSearchParams | Correct pattern |
| `topics/page.tsx` | `FeatureGate feature="topics"` | Standard imports | CRUD with Dialog |
| `knowledge-base/page.tsx` | `FeatureGate feature="knowledge_base"` | Standard imports | File upload |
| `leads/page.tsx` | `FeatureGate feature="leads"` | Standard imports | Full CRUD |
| `campaigns/page.tsx` | `FeatureGate feature="campaigns"` | Standard imports | Progress tracking |
| `agent-settings/page.tsx` | `FeatureGate feature="agent_settings"` | Standard imports | Large config page |
| `ai-analysis/page.tsx` | Uses `usePlanAccess` | Standard imports | Plan-gated inline |
| `prompt-tree/page.tsx` | `FeatureGate feature="conversation_flows"` | Uses PromptTreeEditor | Thin wrapper |
| `widget/page.tsx` | None (always accessible) | Standard imports | Embed configuration |

### Findings

**[WARNING-05] AI Analysis page uses `usePlanAccess` instead of `FeatureGate`**
- The `ai-analysis/page.tsx` file imports `usePlanAccess` and `UpgradeBanner` to handle plan gating inline, rather than using the `FeatureGate` wrapper component that all other gated pages use. This creates an inconsistency in the gating pattern. If the plan-access API fails, the page may show content that should be locked.
- File: `src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx:19-20`

---

## New Components Audit

### RecentSyncsWidget (`src/components/portal/recent-syncs-widget.tsx`)

**Import chain:** Dashboard page.tsx -> recent-syncs-widget.tsx -> Card, Badge, Skeleton, lucide-react icons

**API call:** `GET /api/integrations/recent-syncs` -- verified this route exists at `src/app/api/integrations/recent-syncs/route.ts`

**States:**
- **Loading:** Card with skeleton rows (3 shimmer items)
- **Empty:** Returns `null` (widget is completely hidden when no events) -- this is correct behavior, avoids showing an empty card
- **Data:** Renders event list with status icons, direction arrows, event type, provider badge, timestamp

**Provider badges:** `PROVIDER_BADGES` map includes `housecallpro`, `jobber`, `salesforce`, `gohighlevel`, `hubspot` -- all correct

**Error handling:** Silent catch (widget is non-critical) -- appropriate since the dashboard has other content

**Findings:**

**[WARNING-06] RecentSyncsWidget has no refresh/retry mechanism**
- The widget fetches data once on mount and never refreshes. If the initial fetch fails silently, the widget stays hidden with no way for the user to retry. Consider adding an auto-refresh interval or a manual refresh button (though the silent failure is acceptable for a non-critical widget).
- File: `src/components/portal/recent-syncs-widget.tsx:61-77`

**[COSMETIC-03] RecentSyncsWidget error events show red icon but no error message**
- When `event.status` is not "success" or "retrying", the widget shows a red XCircle icon. The `error_message` field is available in the `SyncEvent` interface but is never displayed to the user. Users see a failed sync but have no way to know why it failed without checking logs.
- File: `src/components/portal/recent-syncs-widget.tsx:132-133`

---

### ServiceMappingEditor (`src/components/portal/service-mapping-editor.tsx`)

**Props:** `provider: string`, `providerLabel: string`

**API calls:**
- `GET /api/integrations/service-mappings?provider=<provider>` -- verified at `src/app/api/integrations/service-mappings/route.ts`
- `POST /api/integrations/service-mappings` -- upsert with conflict handling
- `DELETE /api/integrations/service-mappings?id=<id>` -- with client_id scoping

**States:**
- **Loading:** Card with skeleton rows
- **Empty:** "No service mappings configured. Click 'Add' to create one."
- **Data:** Editable grid with columns: Your Service, CRM Category, Duration, Price, Actions

**CRUD operations:**
- Add: Creates a local row with `isNew: true`
- Save: POST to API with upsert, updates local state with server response
- Delete: For new rows, removes locally. For existing rows, DELETE to API then removes locally

**Validation:**
- `saveRow` checks `internal_service_name` is not empty before saving
- Price field converts between cents and dollars correctly (`/ 100` for display, `* 100` for save)

**Findings:**

**[WARNING-07] ServiceMappingEditor save button has no visual distinction for unsaved changes**
- Each row has a Save button, but there is no visual indicator (e.g., row background change, asterisk, "unsaved" badge) to show which rows have unsaved modifications. A user could edit multiple rows and forget to save some.
- File: `src/components/portal/service-mapping-editor.tsx:231-239`

**[COSMETIC-04] ServiceMappingEditor grid layout breaks on small screens**
- The grid uses `grid-cols-12` with fixed column spans (3+3+2+2+2). On mobile, these become very narrow and the inputs are barely usable. There are no responsive breakpoints on the grid.
- File: `src/components/portal/service-mapping-editor.tsx:173,182`

---

## Conversation Flow Templates (HVAC Entry)

**File:** `src/lib/conversation-flow-templates.ts`

### HVAC Industry Config (line 106-117)
```typescript
hvac: {
  label: "HVAC",
  specialist: "HVAC technician",
  servicePlural: "heating, cooling, and air quality services",
  customer: "homeowner",
  appointmentTerm: "service appointment",
  leadOptions: ["AC Repair", "AC Installation", "Heating Repair", "Furnace Installation", "Maintenance & Tune-Up", "Duct Work", "Thermostat Installation", "Indoor Air Quality", "Emergency Service"],
  supportOptions: ["Repair status", "Warranty questions", "Reschedule service", "Equipment questions"],
  receptionistOptions: ["Schedule a service call", "Get an estimate", "Emergency HVAC repair", "Speak with a technician"],
  dispatchItem: "HVAC technician",
  dispatchTimeframe: "45 minutes",
}
```

### Validation
- All required fields present: `label`, `specialist`, `servicePlural`, `customer`, `appointmentTerm`, `leadOptions`, `supportOptions`, `receptionistOptions`, `dispatchItem`, `dispatchTimeframe` -- **PASS**
- Field types match `IndustryConfig` interface -- **PASS**
- `leadOptions` has 9 entries (other industries have 4) -- intentional, more granular HVAC services
- `generateTemplateNodes` function uses these fields generically -- **PASS**, works for any industry key

### Findings

See **BLOCKER-01** above -- the conversation-flows page `INDUSTRY_STYLES` map is missing the `hvac` entry.

---

## Responsive & Accessibility Audit

### Responsive Patterns

| Component | Mobile | Tablet | Desktop | Notes |
|-----------|--------|--------|---------|-------|
| Portal Layout | `pt-14` for mobile header | - | `md:ml-60` sidebar offset | Correct |
| Sidebar | Sheet drawer | - | Fixed sidebar | Correct |
| Dashboard KPI cards | `grid-cols-1` | - | `md:grid-cols-3` | Correct |
| Agent grid | `grid-cols-1` | `md:grid-cols-2` | `lg:grid-cols-3` | Correct |
| Automations page | `p-4` | - | `md:p-6` | Correct |
| Recipe gallery | `grid-cols-1` | `sm:grid-cols-2` | `lg:grid-cols-3` | Correct |
| Billing plans | Dynamic based on plan count | Responsive | Responsive | Correct |
| Flow templates | `grid-cols-2` | `sm:grid-cols-3` | `lg:grid-cols-4` | Correct |
| ServiceMappingEditor | `grid-cols-12` (fixed) | Same | Same | **Issue** (COSMETIC-04) |

### Accessibility

| Check | Status | Notes |
|-------|--------|-------|
| Mobile menu button aria-label | PASS | `aria-label="Open menu"` on hamburger |
| Sheet title for screen readers | PASS | `<SheetTitle className="sr-only">Navigation menu</SheetTitle>` |
| Buttons have labels | PASS | All buttons have text content or aria-labels |
| Forms have labels | PASS | Most forms use `<Label htmlFor>` pattern |
| Color contrast | WARNING | Theme customization can produce low-contrast combinations |
| Keyboard navigation | PASS | Template cards have `tabIndex={0}` and `onKeyDown` handlers |

### Findings

**[WARNING-08] Dashboard color picker allows any hex value without contrast validation**
- Users can set any color via the color picker or manual hex input. If they choose a very light color (e.g., `#FFFFFF`), the sidebar text and navigation become invisible.
- File: `src/components/portal/dashboard-theme-provider.tsx:94-107`

---

## Cross-Cutting Concerns

### Error Boundaries
- **No error boundaries detected** in the portal route group. If a component throws during render, the entire page crashes to the Next.js default error page. The `(marketing)` group has an `error.tsx` but `(portal)` does not.

**[WARNING-09] No error.tsx in the portal route group**
- If any portal page throws a runtime error, there is no error boundary to catch it. Users will see the default Next.js error page with no way to navigate back.
- File: Missing `src/app/(portal)/error.tsx` or `src/app/(portal)/[clientSlug]/portal/error.tsx`

### Loading States
- All pages implement their own loading states (skeletons or spinners) -- **PASS**
- The `FeatureGate` component shows a centered spinner while checking access -- **PASS**

### Unhandled Promise Rejections
- All `fetch` calls are wrapped in try/catch blocks -- **PASS**
- Supabase queries check for errors -- **PASS**
- `toast.error` is used consistently for user-facing error messages -- **PASS**

### API Route Alignment
- Dashboard -> Supabase RLS (agents, call_logs, users, clients) -- **PASS**
- Dashboard -> `/api/onboarding/status` -- exists -- **PASS**
- Dashboard -> `RecentSyncsWidget` -> `/api/integrations/recent-syncs` -- exists -- **PASS**
- Automations -> `/api/automations/recipes`, `/api/automations/client`, `/api/oauth/connections` -- all exist -- **PASS**
- Billing -> `/api/client/billing`, `/api/usage/alerts`, `/api/usage/forecast`, `/api/checkout` -- all exist -- **PASS**
- Conversation Flows -> `/api/conversation-flows`, `/api/conversation-flows/[id]` -- both exist -- **PASS**
- Business Settings -> `/api/business-settings`, and sub-routes -- all exist -- **PASS**
- Service Mappings -> `/api/integrations/service-mappings` -- exists -- **PASS**

### Import Resolution
- All imports across all portal pages resolve to existing files -- **PASS**
- No circular dependencies detected -- **PASS**
- UI components from `@/components/ui/*` are standard shadcn/ui -- **PASS**

---

## Findings Summary

### BLOCKER (1)

| ID | Finding | File | Impact |
|----|---------|------|--------|
| BLOCKER-01 | `INDUSTRY_STYLES` map missing "hvac" key in conversation-flows page | `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx:143-209` | 4 HVAC template cards render with incorrect fallback styling (gray icon, no themed gradient) |

### WARNING (8)

| ID | Finding | File | Impact |
|----|---------|------|--------|
| WARNING-01 | Notifications button is non-functional | `src/components/layout/portal-sidebar.tsx:336-343` | Dead button in sidebar footer |
| WARNING-02 | Delete agent lacks frontend authorization check | `src/app/(portal)/[clientSlug]/portal/page.tsx:662` | All users see "Delete" option (API likely enforces auth) |
| WARNING-03 | OAuthConnectButton PROVIDER_LABELS missing new CRM providers | `src/components/automations/oauth-connect-button.tsx:19-24` | Connect button shows raw provider key for HCP, Jobber, Salesforce, GHL |
| WARNING-04 | Onboarding page imports RetellWebClient at page level | `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx:46` | Larger bundle for users who don't use test call |
| WARNING-05 | AI Analysis page uses inline plan gating instead of FeatureGate | `src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx:19-20` | Inconsistent gating pattern |
| WARNING-06 | RecentSyncsWidget has no refresh/retry mechanism | `src/components/portal/recent-syncs-widget.tsx:61-77` | Silent failure with no recovery |
| WARNING-07 | ServiceMappingEditor has no unsaved changes indicator | `src/components/portal/service-mapping-editor.tsx:231-239` | Users may lose edits |
| WARNING-08 | Dashboard color picker allows low-contrast colors | `src/components/portal/dashboard-theme-provider.tsx:94-107` | Sidebar text can become invisible |
| WARNING-09 | No error.tsx in portal route group | Missing `src/app/(portal)/error.tsx` | Runtime errors show default Next.js error page |

### COSMETIC (5)

| ID | Finding | File | Impact |
|----|---------|------|--------|
| COSMETIC-01 | Mobile header overlaps gradient accent bar | `src/app/(portal)/[clientSlug]/layout.tsx:21` | Minor visual overlap |
| COSMETIC-02 | Billing page is ~1295 lines in one file | `src/app/(portal)/[clientSlug]/portal/billing/page.tsx` | Maintenance complexity |
| COSMETIC-03 | RecentSyncsWidget doesn't show error_message for failed syncs | `src/components/portal/recent-syncs-widget.tsx:132-133` | Users can't diagnose sync failures |
| COSMETIC-04 | ServiceMappingEditor grid breaks on mobile | `src/components/portal/service-mapping-editor.tsx:173,182` | Inputs barely usable on small screens |
| COSMETIC-05 | Notification badge always shows "0" | `src/components/layout/portal-sidebar.tsx:340` | Misleading if notifications exist but aren't fetched |

---

## Pages Verified (Complete List)

| # | Page File | Status |
|---|-----------|--------|
| 1 | `(portal)/[clientSlug]/layout.tsx` | Audited |
| 2 | `(portal)/[clientSlug]/portal/page.tsx` | Audited |
| 3 | `(portal)/[clientSlug]/portal/automations/page.tsx` | Audited |
| 4 | `(portal)/[clientSlug]/portal/billing/page.tsx` | Audited |
| 5 | `(portal)/[clientSlug]/portal/conversation-flows/page.tsx` | Audited |
| 6 | `(portal)/[clientSlug]/portal/onboarding/page.tsx` | Audited |
| 7 | `(portal)/[clientSlug]/portal/settings/business/page.tsx` | Audited |
| 8 | `(portal)/[clientSlug]/portal/agents/[id]/analytics/page.tsx` | Audited |
| 9 | `(portal)/[clientSlug]/portal/agents/[id]/conversations/page.tsx` | Audited |
| 10 | `(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx` | Audited |
| 11 | `(portal)/[clientSlug]/portal/agents/[id]/knowledge-base/page.tsx` | Audited |
| 12 | `(portal)/[clientSlug]/portal/agents/[id]/leads/page.tsx` | Audited |
| 13 | `(portal)/[clientSlug]/portal/agents/[id]/campaigns/page.tsx` | Audited |
| 14 | `(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` | Audited |
| 15 | `(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx` | Audited |
| 16 | `(portal)/[clientSlug]/portal/agents/[id]/prompt-tree/page.tsx` | Audited |
| 17 | `(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx` | Audited |

## Components Verified

| # | Component File | Status |
|---|---------------|--------|
| 1 | `components/portal/recent-syncs-widget.tsx` | Full audit |
| 2 | `components/portal/service-mapping-editor.tsx` | Full audit |
| 3 | `components/portal/feature-gate.tsx` | Full audit |
| 4 | `components/portal/upgrade-banner.tsx` | Full audit |
| 5 | `components/portal/dashboard-theme-provider.tsx` | Full audit |
| 6 | `components/portal/chat-widget.tsx` | Header audit |
| 7 | `components/layout/portal-sidebar.tsx` | Full audit |
| 8 | `components/automations/oauth-connect-button.tsx` | Full audit |
| 9 | `components/automations/recipe-card.tsx` | Full audit |
| 10 | `components/automations/recipe-setup-modal.tsx` | Header audit |

## API Routes Verified

| # | Route | Called From | Exists |
|---|-------|------------|--------|
| 1 | `/api/integrations/recent-syncs` | RecentSyncsWidget | Yes |
| 2 | `/api/integrations/service-mappings` | ServiceMappingEditor | Yes |
| 3 | `/api/automations/recipes` | Automations page | Yes |
| 4 | `/api/automations/client` | Automations page | Yes |
| 5 | `/api/oauth/connections` | Automations page | Yes |
| 6 | `/api/oauth/authorize` | OAuthConnectButton | Yes |
| 7 | `/api/oauth/disconnect` | OAuthConnectButton | Yes |
| 8 | `/api/client/billing` | Billing page | Yes |
| 9 | `/api/client/plan-access` | FeatureGate, sidebar | Yes |
| 10 | `/api/usage/alerts` | Billing page | Yes |
| 11 | `/api/usage/forecast` | Billing page | Yes |
| 12 | `/api/checkout` | Billing page | Yes |
| 13 | `/api/conversation-flows` | Flows page | Yes |
| 14 | `/api/onboarding/status` | Dashboard | Yes |
| 15 | `/api/business-settings` | Business Settings | Yes |
| 16 | `/api/agents/[id]` (DELETE) | Dashboard | Yes |

## Templates Verified

| # | File | Entry | All Fields Present |
|---|------|-------|-------------------|
| 1 | `lib/conversation-flow-templates.ts` | `hvac` IndustryConfig | Yes (all 11 fields) |
