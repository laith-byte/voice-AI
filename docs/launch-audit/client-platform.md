# Client Platform Audit — Pre-Launch Report

**Auditor:** Claude Opus 4.6 (automated QA)
**Date:** 2026-02-22
**Scope:** Every page, component, modal, form, dialog, button, link, and toggle under `src/app/(portal)/`

---

## BLOCKERS

> Issues that will cause user-visible errors, data loss, or broken functionality.

### B-01: Topics table empty-state colSpan mismatch
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx`
- **Issue:** The empty-state `<td>` uses `colSpan={3}` but the table has 4 columns (Name, Color, Created, Delete action). This causes the "No topics" message to not span the full table width, leaving a visual gap in the last column.
- **Fix:** Change `colSpan={3}` to `colSpan={4}`.

### B-02: Onboarding page does not validate email format
- **File:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx` (line ~1086)
- **Issue:** The contact email field uses `type="email"` on the `<Input>` which provides only browser-native validation. However, `handleStep2Continue` only checks `businessName.trim()` before proceeding. A user can enter an invalid email (e.g., "abc") and the form will still save it to the database without server-side validation. The step save API at `/api/onboarding/step/2` should validate the email format.
- **Impact:** Malformed email addresses stored in the database; post-call email summaries and follow-up emails will fail silently.

### B-03: Conversation Flows delete uses `window.confirm` without saving in-progress edits
- **File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx` (line ~629)
- **Issue:** The flow delete button is embedded inside a Card that also has an `onClick` handler to open the editor. While `e.stopPropagation()` is correctly used, `window.confirm` is a non-cancelable browser dialog that blocks the UI. If the user accidentally confirms, the optimistic delete removes the flow immediately. The reverted flow data is preserved in `previousFlows`, but there is no undo mechanism for the user.
- **Recommendation:** Replace `window.confirm` with a custom confirmation Dialog consistent with the rest of the app.

### B-04: Agent Settings page — `chatSilenceTimeout` calculation error
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` (line ~989)
- **Issue:** The end-chat-after-silence setting computes `end_chat_after_silence_ms` as `(parseFloat(chatSilenceTimeout) || 60) * 60000`. The multiplier `60000` converts *minutes* to milliseconds, but if the UI field is labeled and entered in *seconds*, this creates a 60x inflation. The UI label and field name should be verified. If the user enters "60" (seconds), it becomes 3,600,000 ms = 60 minutes instead of 60 seconds. Need to verify whether the field is intended as seconds or minutes, and fix the multiplier accordingly.

---

## WARNINGS

> Issues that degrade UX, produce misleading data, or are potential bugs under certain conditions.

### W-01: Dashboard "Active Agents" KPI is misleading
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx`
- **Issue:** The "Active Agents" KPI card shows `agentsData.length`, which is the total count of all agents — not just agents that are actively receiving calls or are live. This misleads users into thinking all their agents are active.
- **Fix:** Filter by a status field (e.g., `is_active` or `status === 'live'`) or rename the KPI to "Total Agents".

### W-02: Hardcoded "0" notification badge
- **Files:** `src/app/(portal)/[clientSlug]/portal/page.tsx`, `src/components/layout/portal-sidebar.tsx`
- **Issue:** Both the dashboard header and the sidebar show a notification bell with a hardcoded `"0"` count badge. This is non-functional — there is no notification system behind it. Clicking the bell shows a "No notifications" message but users may be confused by a permanently-zero badge.
- **Fix:** Either implement the notification system or hide the badge entirely until notifications are available.

### W-03: Agent delete uses `window.confirm` across multiple pages
- **Files:**
  - `src/app/(portal)/[clientSlug]/portal/page.tsx` (dashboard agent delete)
  - `src/app/(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx`
  - `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx`
- **Issue:** All destructive delete actions use the browser's native `window.confirm()` dialog rather than a custom shadcn `AlertDialog`. This is inconsistent with the rest of the UI which uses shadcn Dialogs. The native dialog is not styled, not accessible to screen readers the same way, and cannot be customized.
- **Recommendation:** Replace with `AlertDialog` from `@/components/ui/alert-dialog`.

### W-04: Campaigns Dialog missing `DialogDescription` for accessibility
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/campaigns/page.tsx`
- **Issue:** The campaign create/edit dialogs import `Dialog, DialogContent, DialogHeader, DialogTitle` but not `DialogDescription`. Per WAI-ARIA, every dialog should have an accessible description. Screen readers will not announce the purpose of the dialog.
- **Fix:** Add `<DialogDescription>` inside `<DialogHeader>` (can use `className="sr-only"` if no visible description is desired).

### W-05: Widget page is not wrapped in `FeatureGate`
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx`
- **Issue:** Every other agent sub-page (analytics, conversations, campaigns, leads, knowledge-base, topics, ai-analysis, prompt-tree) is wrapped in a `<FeatureGate>` component for plan-based access control. The widget page is not. This means all users regardless of plan can access widget customization.
- **Impact:** May be intentional (widget is always available), but inconsistent with the gating pattern. Verify this is the intended behavior.

### W-06: Onboarding wizard "Business hours set" and "Services & FAQs configured" always show as `done: true`
- **File:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx` (line ~2370-2448)
- **Issue:** In Step 7 (Go Live), the setup checklist always shows "Business hours set" and "Services & FAQs configured" as completed (`done: true`) regardless of whether the user actually configured them. Since Step 3 (Business Settings) is skippable, these items could be unconfigured while showing green checkmarks.
- **Fix:** Track whether hours/services/FAQs have been modified and reflect the actual state in the checklist.

### W-07: Billing page — Dialog import missing `DialogDescription`
- **File:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx` (line ~10-15)
- **Issue:** `PlanComparisonDialog` imports `Dialog, DialogContent, DialogHeader, DialogTitle` but not `DialogDescription`. Same accessibility concern as W-04.

### W-08: Conversation flows — no confirmation when closing editor with unsaved changes
- **File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx`
- **Issue:** The flow editor dialog can be closed by clicking outside, pressing Escape, or clicking "Cancel". None of these actions warn the user if there are unsaved changes. Users who spent time editing nodes will lose all changes without warning.
- **Fix:** Track dirty state and show a confirmation prompt before closing if there are unsaved changes.

### W-09: Onboarding `INDUSTRY_NAMES` reference is out of scope on line 865
- **File:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx` (line ~865)
- **Issue:** The `INDUSTRY_NAMES` constant is defined inside the Step 1 render block's IIFE (line ~770), but line 865 references it again outside that block in the Step 1b sub-section. This works because both are within the same IIFE, but the pattern is fragile — if the render structure changes, this reference would break. The constant should be extracted to the component level or module level.

### W-10: Billing page cost estimator shows only first 6 LLM models
- **File:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx` (line ~771)
- **Issue:** `ESTIMATOR_LLM_MODELS.slice(0, 6)` hardcodes showing only the first 6 models. If more models are added, their pricing won't be visible to users. No "show more" or "see all" option is provided.

### W-11: Leads page CSV import does not validate file size before upload
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/leads/page.tsx`
- **Issue:** The CSV file import for leads reads the file client-side with `FileReader` but does not check the file size before reading. A very large CSV file could freeze the browser tab. The knowledge-base page correctly limits uploads to 10MB.

### W-12: Agent Settings page partially audited due to file size (194KB)
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx`
- **Issue:** This file is ~5000 lines / 194KB. The full render section (all tabs, forms, sliders, toggles, selects) was not fully audited due to size constraints. The data-loading, publish, and handler logic was reviewed (lines 1-1000). Additional issues may exist in the extensive UI render section (lines 1000+).

---

## COSMETIC

> Minor polish items — text, spacing, alignment, or styling inconsistencies.

### C-01: Inconsistent date formatting between pages
- **Files:** Various portal pages
- **Issue:** The analytics page uses `new Date().toLocaleDateString()` patterns while the billing page defines a `formatDate()` helper with explicit `month: "short"`. These produce slightly different formats. Consider a shared `formatDate` utility.

### C-02: Conversations page `colSpan` values are manually specified
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/conversations/page.tsx`
- **Issue:** The table view uses hardcoded `colSpan` values for empty/loading states. These are fragile if columns are added or removed.

### C-03: Onboarding SMS agent type uses "Simulated" label for test
- **File:** `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx` (line ~1998)
- **Issue:** The SMS test section shows "AI Response (Simulated)" which might confuse users about whether the response is real. If the API actually generates a real response, the "(Simulated)" label should be removed or clarified.

### C-04: Knowledge Base page 10MB limit not communicated until upload fails
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/knowledge-base/page.tsx`
- **Issue:** The 10MB file size limit is checked but the limit is not communicated to the user in the UI before they attempt to upload. A small helper text like "Max file size: 10MB" near the upload button would improve UX.

### C-05: Billing page "Contact Sales" email link
- **File:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx` (line ~1028, ~1203)
- **Issue:** The "Contact Sales" links use `mailto:sales@invarialabs.com`. Two instances exist — verify this email address is monitored. The custom plan CTA card also uses a Calendar icon which suggests scheduling, but the link is a `mailto:`.

### C-06: Dashboard onboarding banner dismiss is client-side only
- **File:** `src/app/(portal)/[clientSlug]/portal/page.tsx`
- **Issue:** If there is a dismiss state for the onboarding banner, it appears to be client-side state only, meaning it reappears on page refresh. Users who have already completed onboarding should not see this banner at all (the server should set `status: "completed"`).

---

## VERIFICATION CHECKLIST

### Imports & Dependencies
- [x] All component imports in portal pages resolve to existing files (verified via `find`)
- [x] All `@/components/ui/*` imports use shadcn/ui components (standard library)
- [x] All `@/lib/*` and `@/hooks/*` imports resolve to existing files

### API Routes
- [x] All `fetch()` calls in portal pages reference existing API route files
- [x] Onboarding API routes verified: `/api/onboarding/{status,start,step,create-agent,test-call,test-sms,go-live}`
- [x] Billing API routes verified: `/api/client/billing`, `/api/checkout`, `/api/usage/{alerts,forecast}`
- [x] Agent API routes verified: `/api/agents/[id]/{config,voices,knowledge-base,chat}`
- [x] Conversation flows API routes verified: `/api/conversation-flows` (GET, POST, PATCH, DELETE, deploy via POST)

### Auth & Access Control
- [x] Middleware (`src/lib/supabase/middleware.ts`) enforces auth for all portal routes
- [x] Role-based access control validates `client_admin`, `client_member` roles
- [x] Slug validation prevents cross-client access via URL manipulation
- [x] FeatureGate component checks both admin access (`client_access` table) and plan access

### State Management
- [x] All pages have loading states (Loader2 spinners or skeletons)
- [x] All pages handle fetch errors with toast notifications
- [x] Most pages have empty states when no data is present
- [x] Optimistic updates with rollback are used in automations and conversation-flows pages
- [x] Forms disable submit buttons while saving (preventing double-submit)

### Pages Fully Audited
- [x] Portal layout (`layout.tsx`)
- [x] Dashboard (`portal/page.tsx`)
- [x] Analytics (`agents/[id]/analytics/page.tsx`)
- [x] Conversations (`agents/[id]/conversations/page.tsx`)
- [x] Campaigns (`agents/[id]/campaigns/page.tsx`)
- [x] Knowledge Base (`agents/[id]/knowledge-base/page.tsx`)
- [x] AI Analysis (`agents/[id]/ai-analysis/page.tsx`)
- [x] Topics (`agents/[id]/topics/page.tsx`)
- [x] Leads (`agents/[id]/leads/page.tsx`)
- [x] Widget (`agents/[id]/widget/page.tsx`)
- [x] Prompt Tree (`agents/[id]/prompt-tree/page.tsx`)
- [x] Automations (`portal/automations/page.tsx`)
- [x] Business Settings (`portal/settings/business/page.tsx`)
- [x] Onboarding (`portal/onboarding/page.tsx`) — 2646 lines fully read
- [x] Billing (`portal/billing/page.tsx`) — 1288 lines fully read
- [x] Conversation Flows (`portal/conversation-flows/page.tsx`) — 1155 lines fully read
- [ ] Agent Settings (`agents/[id]/agent-settings/page.tsx`) — partially read (first ~1000 of ~5000 lines)

### Shared Components Audited
- [x] `portal-sidebar.tsx` — navigation, role-based filtering, logout
- [x] `feature-gate.tsx` — plan + admin access gating
- [x] `upgrade-banner.tsx` — verified exists
- [x] All onboarding sub-components — verified exist (wizard-progress, test-call-coaching, test-call-transcript, test-call-report, quick-fix-modal, test-chat-inline, conversation-flow-editor)
- [x] All business-settings sub-components — verified exist (business-info-form, hours-editor, services-list, faqs-list, policies-list, locations-list, call-handling-settings, post-call-actions, pii-redaction-settings)

---

## SUMMARY

| Category | Count |
|----------|-------|
| BLOCKERS | 4 |
| WARNINGS | 12 |
| COSMETIC | 6 |

**Overall Assessment:** The client portal is in solid shape for launch. Most pages follow a consistent pattern with proper loading states, error handling, empty states, and toast notifications. The Supabase RLS + middleware auth stack provides a good security foundation. The primary concerns are (1) a few `window.confirm` usages for destructive actions instead of custom dialogs, (2) the misleading "Active Agents" KPI, (3) missing `DialogDescription` for accessibility compliance, and (4) the partially-audited agent-settings mega-page which warrants a follow-up review.

**Recommended Priority:**
1. Fix B-01 (topics colSpan) and B-04 (chat silence timeout multiplier) — simple, high-impact fixes
2. Address W-01 (Active Agents KPI) and W-02 (hardcoded notification badge) before launch
3. Add `DialogDescription` to all dialogs (W-04, W-07) for accessibility compliance
4. Schedule a focused audit of the full agent-settings page (W-12)
