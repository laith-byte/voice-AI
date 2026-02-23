# Client Portal Audit Report

**Auditor:** client-auditor (Claude)
**Date:** 2026-02-22
**Scope:** `src/app/(portal)/[clientSlug]/portal/` (16 pages) + `src/components/portal/` (9 components)

---

## Executive Summary

The client portal is a well-structured Next.js App Router application with 16 pages and 9 shared components. All pages are client-rendered (`"use client"`), backed by Supabase with RLS, and integrated with Retell AI for voice/chat agent management. The codebase demonstrates consistent patterns for loading states, error handling, destructive action confirmations, and feature gating. No critical bugs or security vulnerabilities were found.

**Verdict: PASS** -- ready for production with minor observations noted below.

---

## Layout & Providers

**File:** `src/app/(portal)/[clientSlug]/layout.tsx` (29 lines)

- Wraps all portal pages in `DashboardThemeProvider` > `OnboardingProvider`
- Renders `PortalSidebar` with `clientSlug` prop
- Main content area: `md:ml-60 min-h-screen pt-14 md:pt-0` (responsive sidebar offset)
- `PortalChatWidget` rendered at layout level (available on all portal pages)
- Top gradient accent bar: `h-[2px] bg-gradient-to-r from-primary/80 via-primary/30 to-transparent`

---

## Page-by-Page Audit

### 1. Dashboard (`portal/page.tsx`) -- 739 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve: supabase client, shadcn/ui, lucide-react, portal components |
| Form validation | N/A | No forms on dashboard |
| Destructive actions | PASS | Agent delete uses AlertDialog with confirmation |
| Responsive layout | PASS | Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for agent cards |
| Loading state | PASS | Full Skeleton loading state |
| Empty state | PASS | "No agents yet" with CTA to create; "No recent activity" message |
| State management | PASS | useState for agents, activity, stats; useCallback for fetchers |

**Components used:** `RecentSyncsWidget`, `UpgradeBanner`, `FeatureGate`, `useDashboardTheme`

---

### 2. Error Page (`portal/error.tsx`) -- 31 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | Button, AlertTriangle, useEffect |
| Error boundary | PASS | Proper Next.js error boundary with `error` + `reset` props |
| UX | PASS | AlertTriangle icon, descriptive message, "Try again" button |
| Console logging | PASS | `console.error("Portal error:", error)` in useEffect |

---

### 3. Onboarding Wizard (`portal/onboarding/page.tsx`) -- ~800 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve including `canvas-confetti`, RetellWebClient |
| Form validation | PASS | Each step validates required fields before save |
| Destructive actions | N/A | No destructive actions in onboarding flow |
| Responsive layout | PASS | `max-w-3xl mx-auto`, `p-4 md:p-6`, `grid-cols-1 sm:grid-cols-3` for type selector |
| Loading state | PASS | Animated Sparkles icon with "Loading your onboarding wizard..." |
| Empty state | N/A | Always has content (wizard steps) |
| State management | PASS | Step-based flow with `handleStepXContinue()` functions calling `saveStep(N, data)` |

**Key features:**
- 7-step wizard: Template > Business info > Services/FAQs > Call handling > Conversation flow > Test call > Go live
- Agent type selector: Voice, Chat, SMS
- Flow deployment from prompt tree nodes in step 5
- Confetti celebration on go-live
- Agent creation overlay with animated spinner

---

### 4. Billing (`portal/billing/page.tsx`) -- 1295 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve: date-fns, recharts, shadcn/ui |
| Form validation | PASS | Alert threshold inputs validated as numbers |
| Destructive actions | N/A | No destructive actions |
| Responsive layout | PASS | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for KPIs; `max-w-6xl mx-auto` |
| Loading state | PASS | Full Skeleton loading with Loader2 spinner |
| Empty state | PASS | "No billing information" fallback |
| State management | PASS | useState for subscription, invoices, usage, forecasts |

**Key features:**
- Subscription details with plan name, status, pricing
- Invoice list with PDF download links and hosted invoice URLs
- Cost forecast: daily average, projected month-end, daily spending chart
- Usage alerts: minutes, cost, calls thresholds with enable toggles
- Plan comparison dialog with full feature matrix

---

### 5. Automations (`portal/automations/page.tsx`) -- 503 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve including portal connection cards |
| Form validation | N/A | No form inputs (toggle-based) |
| Destructive actions | N/A | No delete operations |
| Responsive layout | PASS | `grid-cols-1 lg:grid-cols-3` for integration cards |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | Shows integration cards even when no connections |
| State management | PASS | useState for connections, recipes; optimistic toggle for enable/disable |

**Provider labels:** Google, Slack, HubSpot, QuickBooks, Salesforce, GoHighLevel, Housecall Pro, Jobber

**OAuth handling:** Processes `?connected=` and `?oauth_error=` query params on mount. Wrapped in `<Suspense>` for `useSearchParams()`.

---

### 6. Conversation Flows (`portal/conversation-flows/page.tsx`) -- 1159 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve: lucide icons (including Snowflake for HVAC), shadcn/ui |
| Form validation | PASS | Flow name required; node content validated |
| Destructive actions | PASS | AlertDialog for flow deletion |
| Responsive layout | PASS | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for template cards |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | "No conversation flows" with CTA to create |
| State management | PASS | useState for flows, nodes, templates, editing state |

**INDUSTRY_STYLES:** 9 industries with icons and gradients:
- healthcare (Heart, red-to-pink)
- financial_services (Landmark, blue-to-indigo)
- insurance (Shield, emerald-to-green)
- logistics (Truck, orange-to-amber)
- home_services (Wrench, purple-to-violet)
- retail (ShoppingBag, pink-to-rose)
- travel_hospitality (Plane, sky-to-blue)
- debt_collection (DollarSign, amber-to-yellow)
- hvac (Snowflake, cyan-to-blue)

**Node types:** message, question, condition, transfer, end, check_availability, book_appointment, crm_lookup, webhook

**Calendar providers:** Google Calendar, Calendly

Wrapped in `<FeatureGate feature="conversation_flows">`.

---

### 7. Business Settings (`portal/settings/business/page.tsx`) -- 65 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All sub-components resolve |
| Layout | PASS | Thin wrapper composing sub-components |
| Sub-components | PASS | BusinessInfoForm, HoursEditor, ServicesList, FaqsList, PoliciesList, LocationsList, CallHandlingSettings, PostCallActions, PiiRedactionSettings |

Each sub-component handles its own loading/saving state.

---

### 8. Agent Settings (`portal/agents/[id]/agent-settings/page.tsx`) -- ~1600+ lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve: FeatureGate, usePlanAccess, UpgradeBanner, PrototypeCallDialog, useRetellCall, LLM_MODEL_COSTS, VOICE_PROVIDER_COSTS |
| Form validation | PASS | JSON validation for dynamic vars and analysis data; required fields for tool creation |
| Destructive actions | PASS | Tool/function removal is in-memory (unpublished until saved) |
| Responsive layout | PASS | `p-6 space-y-6`, responsive tab layout |
| Loading state | PASS | Full Skeleton loading with multiple skeleton cards |
| Empty state | N/A | Always shows agent config |
| State management | PASS | Extensive useState for all config sections; useCallback for fetchers; useMemo for cost breakdown |

**Key features:**
- Full agent configuration: LLM model, voice, system prompt, first message, language
- Speech settings: responsiveness, interruption sensitivity, backchanneling, pronunciation
- Call settings: voicemail detection, DTMF, silence timeout, max duration
- Functions/Tools: end_call, transfer_call, custom, agent_swap, send_sms, mcp, extract_dynamic_variable, check_availability_cal, book_appointment_cal, press_digit
- Version management: publish, restore, version history
- MCP server management
- Per-minute cost breakdown calculator
- Knowledge base config (top_k, filter_score)
- Webhook configuration
- Security & fallback settings (PII redaction, secure URLs, data storage)
- Post-call analysis config
- AI analysis config (summary, evaluation, auto-tagging, misunderstood queries)
- Widget config (description)
- Live test call/chat with Retell
- Audio device selection

Wrapped in `<FeatureGate feature="agent_settings">`.

---

### 9. Analytics (`portal/agents/[id]/analytics/page.tsx`) -- 826 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | Recharts (ComposedChart, PieChart, BarChart), date-fns, shadcn/ui |
| Form validation | N/A | Date picker only |
| Destructive actions | N/A | Read-only page |
| Responsive layout | PASS | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for KPIs; `max-w-7xl mx-auto` |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | "No data for this period" message |
| State management | PASS | useState for date range, stats, trend data, breakdown data |

**Features:** KPI cards with trend comparison, trend chart, duration distribution, call activity heatmap, direction breakdown (pie). Adapts labels for chat vs voice.

---

### 10. Conversations (`portal/agents/[id]/conversations/page.tsx`) -- 1031 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve: date-fns, shadcn/ui, lucide-react |
| Form validation | N/A | Search/filter only |
| Destructive actions | N/A | Read-only |
| Responsive layout | PASS | Dual view: card (3-panel) and table; `grid-cols-[300px_1fr_360px]` |
| Loading state | PASS | Skeleton loading for both card and table views |
| Empty state | PASS | "No conversations yet" and "No conversations match" states |
| State management | PASS | useState for conversations, selected, view mode, pagination |

**Features:** Audio playback, CSV/PDF export, transcript search with highlighting, pagination with configurable page size, deep-link via `?callId=`, Sheet slide-out for table view detail.

---

### 11. AI Analysis (`portal/agents/[id]/ai-analysis/page.tsx`) -- 364 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Form validation | PASS | Custom prompts have 5000 char limit |
| Destructive actions | N/A | Config toggles only |
| Responsive layout | PASS | `max-w-4xl mx-auto`, `p-6` |
| Loading state | PASS | Loader2 spinner |
| Empty state | N/A | Always shows config |
| State management | PASS | Auto-creates config if none exists |

Plan-gated features: auto-tagging, misunderstood queries. Wrapped in `<FeatureGate>`.

---

### 12. Campaigns (`portal/agents/[id]/campaigns/page.tsx`) -- 1082 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Form validation | PASS | Required campaign name; CSV parsing validation |
| Destructive actions | PASS | AlertDialog for campaign deletion; prevents deleting active campaigns |
| Responsive layout | PASS | `grid-cols-1 lg:grid-cols-2` for campaign cards |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | "No campaigns" with CTA |
| State management | PASS | useState for campaigns, creating, editing states |

**Features:** Campaign CRUD, status management (draft/active/paused/completed), CSV lead upload with parsing, schedule config (days, hours, timezone, retry, rate).

---

### 13. Knowledge Base (`portal/agents/[id]/knowledge-base/page.tsx`) -- 448 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Form validation | PASS | 10MB file size limit enforced |
| Destructive actions | PASS | AlertDialog for source deletion |
| Responsive layout | PASS | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | "No knowledge base sources" with CTA |
| State management | PASS | useState for sources, uploading states |

Source types: text, URL, file.

---

### 14. Leads (`portal/agents/[id]/leads/page.tsx`) -- 1073 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Form validation | PASS | Lead edit form validates required fields; CSV deduplication |
| Destructive actions | PASS | AlertDialog for lead deletion |
| Responsive layout | PASS | Full-width table with horizontal scroll on mobile |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | "No leads yet" with import CTA |
| State management | PASS | useState for leads, editing, filters, sorting, pagination |

**Features:** Lead scoring/qualification badges, CSV import with drag-and-drop + deduplication, CSV export with dynamic variable columns, rescore, tag filtering, qualification filtering, sorting, pagination.

---

### 15. Prompt Tree (`portal/agents/[id]/prompt-tree/page.tsx`) -- 17 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | PromptTreeEditor, FeatureGate |
| Layout | PASS | Thin wrapper delegating to PromptTreeEditor |

Wrapped in `<FeatureGate feature="conversation_flows">`.

---

### 16. Topics (`portal/agents/[id]/topics/page.tsx`) -- 315 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Form validation | PASS | Topic name required |
| Destructive actions | PASS | AlertDialog for topic deletion |
| Responsive layout | PASS | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Loading state | PASS | Full Skeleton loading |
| Empty state | PASS | "No topics" with CTA |
| State management | PASS | useState for topics, creating/editing state |

Color-coded dots for topics. Wrapped in `<FeatureGate feature="topics">`.

---

### 17. Widget (`portal/agents/[id]/widget/page.tsx`) -- 765 lines

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve including useRetellCall |
| Form validation | PASS | URL validation for all URL fields |
| Destructive actions | N/A | Config save only |
| Responsive layout | PASS | `grid-cols-1 lg:grid-cols-2` for config + preview |
| Loading state | PASS | Skeleton loading |
| Empty state | N/A | Always shows widget config |
| State management | PASS | useState for all widget properties |

**Features:** Appearance config, messages, links, behavior; live voice call testing with Retell; audio device selection; color customization with presets. Adapts for voice vs chat/SMS agents.

---

## Component Audit

### 1. `chat-widget.tsx` (282 lines) -- PortalChatWidget

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Responsive | PASS | `max-w-[calc(100vw-2rem)]`, `maxHeight: min(520px, calc(100vh - 8rem))` |
| State management | PASS | Chat lifecycle: start, message, end; auto-scroll to bottom |
| Error handling | PASS | Error message bubble on send failure; silent retry on start failure |
| Accessibility | PASS | `aria-label` on FAB button |

Renders only if a chat/SMS agent exists. Fixed-position FAB + slide-up panel. Uses `useDashboardTheme` for color theming.

---

### 2. `dashboard-theme-provider.tsx` (133 lines) -- DashboardThemeProvider

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| State management | PASS | Context provider with color, setColor, saveColor |
| Cleanup | PASS | Removes all CSS custom properties on unmount |
| Color derivation | PASS | Derives sidebar gradient, opacity variants from primary hex |

Loads dashboard color from `clients.dashboard_color` via Supabase. Applies to CSS custom properties (--primary, --ring, --sidebar-*, --chart-1, etc.).

---

### 3. `feature-gate.tsx` (170 lines) -- FeatureGate

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Access control | PASS | 3-tier: startup users always allowed > client_access override > plan column check |
| Loading state | PASS | Loader2 spinner while checking |
| Blocked state | PASS | Two variants: UpgradeBanner (plan-blocked) vs ShieldOff (admin-blocked) |
| Default behavior | PASS | Allows access if no record exists (matches sidebar) |

**Feature mappings:** topics, agent_settings, campaigns, analytics, ai_analysis, automations, conversation_flows.

---

### 4. `make-connection-card.tsx` (117 lines) -- MakeConnectionCard

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| API key generation | PASS | `crypto.randomUUID()` for randomness |
| Clipboard | PASS | `navigator.clipboard.writeText` with error handling |
| UX | PASS | Copy confirmation, regenerate option |

---

### 5. `n8n-connection-card.tsx` (117 lines) -- N8nConnectionCard

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Pattern | PASS | Identical pattern to MakeConnectionCard |

---

### 6. `recent-syncs-widget.tsx` (237 lines) -- RecentSyncsWidget

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Auto-refresh | PASS | `AUTO_REFRESH_MS = 60_000` (60s interval) |
| Manual refresh | PASS | RefreshCw button with `onClick={() => fetchRecentSyncs(true)}` |
| Loading state | PASS | 3 Skeleton rows |
| Error state | PASS | "Failed to load sync events" with retry link |
| Empty state | PASS | Returns `null` if no events (hides widget) |
| Provider badges | PASS | HCP, Jobber, SF, GHL, HS with colored backgrounds |

---

### 7. `service-mapping-editor.tsx` (297 lines) -- ServiceMappingEditor

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Dirty row tracking | PASS | `dirtyRows: Set<number>` with visual indicator (default vs ghost variant on Save button) |
| Responsive grid | PASS | `flex flex-col gap-2 sm:grid sm:grid-cols-12` -- stacked on mobile, grid on sm+ |
| Column headers | PASS | `hidden sm:grid` -- headers hidden on mobile |
| Loading state | PASS | 3 Skeleton rows |
| Empty state | PASS | "No service mappings configured" with CTA |
| Row operations | PASS | Add, save per-row, delete (local for new rows, API for persisted) |
| Validation | PASS | "Service name is required" on save attempt |
| Index management | PASS | Correctly adjusts dirty row indices on delete |

---

### 8. `upgrade-banner.tsx` (51 lines) -- UpgradeBanner

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Dynamic link | PASS | `/${clientSlug}/portal/billing` for upgrade CTA |
| Fallback | PASS | `href="#"` if no clientSlug |
| Theming | PASS | Amber color scheme with dark mode support |

---

### 9. `zapier-connection-card.tsx` (117 lines) -- ZapierConnectionCard

| Check | Status | Notes |
|-------|--------|-------|
| Imports | PASS | All resolve |
| Pattern | PASS | Same pattern as Make/n8n cards |
| Status | INFO | Button shows "Coming Soon" (disabled) -- intentional |

---

## Regression Targets Verification

| Target | Status | Evidence |
|--------|--------|----------|
| Onboarding wizard saves per step | PASS | Each step has `handleStepXContinue()` calling `saveStep(N, data)` via `/api/onboarding/save-step` |
| Agent settings page loads | PASS | `fetchAgent()`, `fetchConfig()`, `fetchWidgetConfig()`, `fetchAiConfig()`, `fetchVoices()` all called in `Promise.all` on mount |
| Conversation flows: HVAC icon | PASS | `INDUSTRY_STYLES.hvac = { icon: Snowflake, gradient: "from-cyan-500 to-blue-500" }` |
| Billing: receipts/invoices/plan | PASS | Invoice list with PDF download + hosted URL; subscription details; plan comparison dialog |
| Automations: HCP/Jobber connect | PASS | `PROVIDER_LABELS` includes `housecallpro: "Housecall Pro"` and `jobber: "Jobber"` |
| Dashboard: RecentSyncsWidget | PASS | Imported and rendered; 60s auto-refresh + manual refresh button |
| ServiceMappingEditor: dirty rows | PASS | `dirtyRows: Set<number>` tracks modified rows; visual differentiation on Save button |
| ServiceMappingEditor: responsive | PASS | `flex flex-col gap-2 sm:grid sm:grid-cols-12`; headers `hidden sm:grid` |
| error.tsx at portal level | PASS | 31-line error boundary with AlertTriangle, message, and "Try again" button |
| Notifications button NOT in sidebar | PASS | `portal-sidebar.tsx` has no `Bell` import or notification-related code |
| Provider labels in automations | PASS | Google, Slack, HubSpot, QuickBooks, Salesforce, GoHighLevel, Housecall Pro, Jobber |

---

## Cross-Cutting Patterns

### Authentication & Authorization
- All pages use Supabase client-side auth (`createClient()`)
- Feature gating via `FeatureGate` component (3-tier: startup role > client_access > plan column)
- `usePlanAccess` hook for inline plan checks
- `UpgradeBanner` for plan-blocked features

### Destructive Action Pattern
All destructive actions follow the same pattern:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone...</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Pages with destructive actions: Dashboard (delete agent), Conversation Flows (delete flow), Campaigns (delete campaign), Knowledge Base (delete source), Leads (delete lead), Topics (delete topic).

### Loading State Pattern
All pages use Skeleton components from shadcn/ui during initial data fetch. Consistent pattern:
```tsx
if (loading) return <Skeleton />;
```

### Toast Notifications
All pages use `sonner` for toast notifications. Consistent success/error patterns with `toast.success()` and `toast.error()`.

### Responsive Layout
- All pages use `p-4 md:p-6` for padding
- Grid layouts use responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Mobile sidebar is a Sheet component triggered by Menu button (visible below md breakpoint)
- Main content offset: `md:ml-60 min-h-screen pt-14 md:pt-0`

---

## Observations (Non-Blocking)

1. **Agent settings page size:** At ~1600+ lines, this is the largest page in the portal. It handles LLM config, voice settings, speech settings, call settings, functions/tools, security, webhooks, AI analysis, widget config, and live test call/chat. Consider splitting into sub-tabs with lazy-loaded components for maintainability.

2. **Onboarding page size:** At ~800+ lines, this is the second largest. The 7-step wizard with inline rendering could benefit from extracting step components.

3. **API key generation (Make/n8n/Zapier):** Keys are generated client-side with `crypto.randomUUID()` and displayed in-memory. They are not persisted server-side. If these are meant to be real API keys, they need server-side generation and storage.

4. **Zapier card:** Shows "Coming Soon" with a disabled button -- this is intentional but the card still has a full `generateApiKey` implementation that's unreachable in the default state. The key generation code path is only reachable after a user manually triggers it once (if the disabled state were removed).

5. **Chat widget cleanup:** `endChat` uses best-effort cleanup (silent catch). If the API call fails, the server-side chat session may not be properly closed.

---

## Files Audited

### Portal Pages (16)
| # | File | Lines |
|---|------|-------|
| 1 | `portal/page.tsx` | 739 |
| 2 | `portal/error.tsx` | 31 |
| 3 | `portal/onboarding/page.tsx` | ~800 |
| 4 | `portal/billing/page.tsx` | 1295 |
| 5 | `portal/automations/page.tsx` | 503 |
| 6 | `portal/conversation-flows/page.tsx` | 1159 |
| 7 | `portal/settings/business/page.tsx` | 65 |
| 8 | `portal/agents/[id]/agent-settings/page.tsx` | ~1600+ |
| 9 | `portal/agents/[id]/analytics/page.tsx` | 826 |
| 10 | `portal/agents/[id]/conversations/page.tsx` | 1031 |
| 11 | `portal/agents/[id]/ai-analysis/page.tsx` | 364 |
| 12 | `portal/agents/[id]/campaigns/page.tsx` | 1082 |
| 13 | `portal/agents/[id]/knowledge-base/page.tsx` | 448 |
| 14 | `portal/agents/[id]/leads/page.tsx` | 1073 |
| 15 | `portal/agents/[id]/prompt-tree/page.tsx` | 17 |
| 16 | `portal/agents/[id]/topics/page.tsx` | 315 |
| 17 | `portal/agents/[id]/widget/page.tsx` | 765 |

### Portal Components (9)
| # | File | Lines |
|---|------|-------|
| 1 | `components/portal/chat-widget.tsx` | 282 |
| 2 | `components/portal/dashboard-theme-provider.tsx` | 133 |
| 3 | `components/portal/feature-gate.tsx` | 170 |
| 4 | `components/portal/make-connection-card.tsx` | 117 |
| 5 | `components/portal/n8n-connection-card.tsx` | 117 |
| 6 | `components/portal/recent-syncs-widget.tsx` | 237 |
| 7 | `components/portal/service-mapping-editor.tsx` | 297 |
| 8 | `components/portal/upgrade-banner.tsx` | 51 |
| 9 | `components/portal/zapier-connection-card.tsx` | 117 |

### Supporting Files
| # | File | Lines |
|---|------|-------|
| 1 | `app/(portal)/[clientSlug]/layout.tsx` | 29 |
| 2 | `components/layout/portal-sidebar.tsx` | (verified for regression) |

**Total files audited: 27**
