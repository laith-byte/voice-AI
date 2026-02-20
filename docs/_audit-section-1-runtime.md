# Audit Section 1 -- Runtime Errors, Failed Requests, and Broken UI States

Generated: 2026-02-20

---

## Summary

Audited every page and component under `src/app/(auth)/`, `src/app/(startup)/`, `src/app/(portal)/`, `src/app/(marketing)/`, and `src/components/`. Findings are organized into three categories: **Console Errors**, **Failed Network Requests**, and **Broken UI States**.

**Critical:** 3 findings
**High:** 5 findings
**Medium:** 8 findings
**Low:** 6 findings

---

## 1. Console Errors That Would Fire at Runtime

### CRITICAL -- `useSearchParams()` without `<Suspense>` boundary (3 pages)

Next.js App Router requires `useSearchParams()` to be wrapped in a `<Suspense>` boundary. Without it, the entire page will fail during static generation and may throw at runtime.

| File | Line |
|------|------|
| `src/app/(auth)/signup/page.tsx` | ~8 (import) / usage in component body |
| `src/app/(portal)/[clientSlug]/portal/automations/page.tsx` | 4 (import), 107 (usage) |
| `src/app/(portal)/[clientSlug]/portal/agents/[id]/conversations/page.tsx` | 4 (import), usage in component body |

**Expected impact:** Build-time error or runtime hydration failure on these pages. The `billing/connect/page.tsx` correctly wraps in `<Suspense>` and can be used as a reference pattern.

---

### HIGH -- Supabase client created at component scope (unstable reference in dependency arrays)

Three pages call `const supabase = createClient()` at the top of the component body (outside any hook), then include `supabase` in `useCallback` or `useEffect` dependency arrays. Because `createClient()` returns a new object reference on each render, the dependency array changes every render.

| File | `createClient()` Line | Dep Array Line | Used In |
|------|----------------------|----------------|---------|
| `src/app/(startup)/agents/[id]/ai-analysis/page.tsx` | 19 | 163 | `saveConfig` useCallback |
| `src/app/(startup)/agents/[id]/widget/page.tsx` | 58 | 253 | `saveConfig` useCallback |

**Expected impact:** The `saveConfig` callback reference changes every render. If any `useEffect` depends on `saveConfig`, it will fire on every render, potentially causing infinite re-render loops or excessive API calls. The campaigns page (`agents/[id]/campaigns/page.tsx`) has `supabase` at component scope (line 15) but does NOT include it in dependency arrays, so it is not affected.

---

### MEDIUM -- Variable shadowing in login page

| File | Line | Issue |
|------|------|-------|
| `src/app/(auth)/login/page.tsx` | ~26 | The destructured `error` from `supabase.auth.signInWithPassword()` shadows the outer `error` state variable. While not a crash, it prevents the outer `error` state from being set if the response contains an error in some code paths. |

---

### MEDIUM -- `CollapsiblePanel` component defined inside render function

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/agents/[id]/agent-config/page.tsx` | ~660 | `CollapsiblePanel` is defined as a function component inside the parent component's body. React recreates it on every render, which causes all internal state to be lost on re-render. Any expandable panels will collapse unexpectedly when parent state changes. |

---

## 2. Failed Network Requests / Missing Error Handling

### HIGH -- Missing `try/catch` around fetch calls

These pages call `fetch()` without wrapping in `try/catch`. If the network is down or the server returns a non-JSON response, the promise will reject with an unhandled error, potentially crashing the component.

| File | Function | Line |
|------|----------|------|
| `src/app/(auth)/forgot-password/page.tsx` | `handleSubmit` | ~21-25 |
| `src/app/(startup)/agents/page.tsx` | `handleCreateAgent` | ~76 |
| `src/app/(startup)/clients/page.tsx` | `handleCreateClient` | ~113 |
| `src/app/(startup)/settings/integrations/page.tsx` | `handleAddIntegration` / `handleDisconnect` | (multiple) |

**Expected impact:** Unhandled promise rejection in the browser console. The page will not crash thanks to React error boundaries (if present), but the user gets no feedback about the failure. Contrast with `settings/startup/page.tsx` which correctly wraps its fetch calls in try/catch.

---

### MEDIUM -- Missing user feedback on some operations

| File | Operation | Issue |
|------|-----------|-------|
| `src/app/(startup)/settings/integrations/page.tsx` | `handleAddIntegration`, `handleDisconnect` | No `toast.success()` or `toast.error()` -- user receives no feedback on success or failure |

---

## 3. Broken UI States

### HIGH -- Buttons with no `onClick` handler (dead buttons)

These buttons render in the UI but do nothing when clicked:

| File | Line(s) | Button Text | Notes |
|------|---------|-------------|-------|
| `src/app/(startup)/dashboard/page.tsx` | ~371-373 | "Remove" (custom domain) | Button is visible when `customDomain` exists but has no handler |
| `src/app/(startup)/settings/whitelabel/page.tsx` | ~454-458 | "Remove" (domain) | No `onClick` handler |
| `src/app/(startup)/settings/whitelabel/page.tsx` | ~459-462 | "Launch" (domain) | No `onClick` handler |
| `src/app/(startup)/settings/startup/page.tsx` | ~379 | "Get HIPAA Compliance" | No `onClick` handler |
| `src/app/(startup)/billing/invoices/page.tsx` | ~232-236 | "Create Invoice" (empty state) | No `onClick` -- the header button has one (toast.info), but the empty state button does not |
| `src/app/(startup)/billing/subscriptions/page.tsx` | ~254-258 | "Create Subscription" (empty state) | No `onClick` -- the header button has one (toast.info), but the empty state button does not |

**Expected impact:** Users click the button and nothing happens. No error is thrown, but the UI appears broken.

---

### HIGH -- Performance issue: fetching all rows for count

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/dashboard/page.tsx` | ~107-109 | Fetches ALL `call_logs` rows with `.select("duration_seconds")` to count them client-side instead of using Supabase's `{ count: 'exact', head: true }`. For organizations with thousands of calls, this transfers large payloads over the network and causes slow page loads. |

---

### MEDIUM -- `window.confirm` used for destructive actions

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/clients/[id]/overview/page.tsx` | (multiple) | Uses native `window.confirm()` for destructive actions (delete client, etc.) instead of the `AlertDialog` pattern used elsewhere in the app. While functional, it breaks the visual consistency and cannot be styled. |

---

### MEDIUM -- Custom CSS page save does nothing

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/clients/[id]/custom-css/page.tsx` | 16-18 | `handleSave` is an empty function. The "Save CSS" button appears enabled when CSS is entered but does nothing. The page has a "Phase 2" notice, but the button should be disabled or show a toast. |

---

### MEDIUM -- Embed URL page save does nothing

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/clients/[id]/embed-url/page.tsx` | 16-18 | Same issue as custom-css: `handleSave` is empty. The "Save Domain" button appears enabled but does nothing. |

---

### LOW -- Inline `window.location.href` navigation instead of `router.push`

| File | Line | Context |
|------|------|---------|
| `src/app/(portal)/[clientSlug]/portal/page.tsx` | ~641 | Uses `window.location.href = ...` for internal navigation. This causes a full page reload instead of client-side navigation. Not a bug, but degrades UX. |

---

### LOW -- Upload areas are non-functional placeholders

Several pages show upload areas (drag-and-drop styled divs) that are not wired up:

| File | Section |
|------|---------|
| `src/app/(startup)/settings/startup/page.tsx` | Dashboard Logo upload, Login Page Logo upload |
| `src/app/(startup)/settings/whitelabel/page.tsx` | Favicon upload, Email Logo upload |

These are marked "Coming Soon" in the startup settings page but have no such label on the whitelabel page's email logo upload.

---

### LOW -- `Send Test Email` button does nothing

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/settings/whitelabel/page.tsx` | ~638-641 | "Send Test Email" button has no `onClick` handler |

---

### LOW -- Date inputs use native HTML `<input type="date">`

| File | Section |
|------|---------|
| `src/app/(startup)/settings/usage/page.tsx` | Date range picker |

Uses unstyled native HTML date inputs instead of the app's `<Input>` or a date picker component. Functional but visually inconsistent.

---

### LOW -- Unused `params` variable

| File | Line | Issue |
|------|------|-------|
| `src/app/(startup)/clients/[id]/custom-css/page.tsx` | 13 | `const params = useParams();` -- `params` is declared but never used |
| `src/app/(startup)/clients/[id]/embed-url/page.tsx` | 13 | Same -- `params` is used only in the template literal for the embed code preview, which is fine, but the variable itself is accessed via `params.id` in the template literal which works correctly |

---

## 4. Additional Observations (Non-Critical)

### Pattern: Supabase client at component scope (without dep array issue)

Many pages create `const supabase = createClient()` inside `useCallback` or `useEffect`, which is the correct pattern. However, the following pages create it at component scope but do NOT include it in dependency arrays, so they work correctly but create an unnecessary object on each render:

- `src/app/(startup)/agents/[id]/campaigns/page.tsx` (line 15)

### Pattern: eslint-disable comments

Several files use `// eslint-disable-next-line` to suppress TypeScript/React warnings. These are not runtime issues but indicate areas that could benefit from stronger typing:

- `src/app/(startup)/clients/page.tsx` -- line 91
- `src/app/(startup)/billing/products/page.tsx` -- line 84
- `src/app/(startup)/billing/transactions/page.tsx` -- line 65
- `src/app/(startup)/billing/coupons/page.tsx` -- line 91
- `src/app/(startup)/billing/invoices/page.tsx` -- line 66
- `src/app/(startup)/billing/subscriptions/page.tsx` -- line 66

---

## Files Audited

### `(auth)` route group
- `login/page.tsx`
- `signup/page.tsx`
- `setup-account/page.tsx`
- `forgot-password/page.tsx`
- `reset-password/page.tsx`

### `(startup)` route group
- `layout.tsx`
- `dashboard/page.tsx`
- `agents/page.tsx`
- `agents/[id]/layout.tsx`
- `agents/[id]/overview/page.tsx`
- `agents/[id]/agent-config/page.tsx`
- `agents/[id]/ai-analysis/page.tsx`
- `agents/[id]/campaigns/page.tsx`
- `agents/[id]/widget/page.tsx`
- `clients/page.tsx`
- `clients/[id]/layout.tsx`
- `clients/[id]/overview/page.tsx`
- `clients/[id]/solutions/page.tsx`
- `clients/[id]/client-access/page.tsx`
- `clients/[id]/custom-css/page.tsx`
- `clients/[id]/embed-url/page.tsx`
- `clients/[id]/business-settings/page.tsx`
- `clients/[id]/phone-numbers/page.tsx`
- `clients/[id]/assigned-agents/page.tsx`
- `workflows/page.tsx`
- `automations/page.tsx`
- `settings/layout.tsx`
- `settings/startup/page.tsx`
- `settings/whitelabel/page.tsx`
- `settings/members/page.tsx`
- `settings/integrations/page.tsx`
- `settings/phone-sip/page.tsx`
- `settings/webhook-logs/page.tsx`
- `settings/usage/page.tsx`
- `billing/layout.tsx`
- `billing/connect/page.tsx`
- `billing/products/page.tsx`
- `billing/transactions/page.tsx`
- `billing/coupons/page.tsx`
- `billing/invoices/page.tsx`
- `billing/subscriptions/page.tsx`
- `saas/layout.tsx`
- `saas/connect/page.tsx`
- `saas/plans/page.tsx`
- `saas/advanced/page.tsx`
- `saas/templates/page.tsx`
- `saas/pricing-tables/page.tsx`

### `(portal)` route group
- `[clientSlug]/layout.tsx`
- `[clientSlug]/portal/page.tsx`
- `[clientSlug]/portal/billing/page.tsx`
- `[clientSlug]/portal/onboarding/page.tsx`
- `[clientSlug]/portal/conversation-flows/page.tsx`
- `[clientSlug]/portal/automations/page.tsx`
- `[clientSlug]/portal/settings/business/page.tsx`
- `[clientSlug]/portal/agents/[id]/analytics/page.tsx`
- `[clientSlug]/portal/agents/[id]/conversations/page.tsx`
- `[clientSlug]/portal/agents/[id]/topics/page.tsx`
- `[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx`
- `[clientSlug]/portal/agents/[id]/knowledge-base/page.tsx`
- `[clientSlug]/portal/agents/[id]/leads/page.tsx`
- `[clientSlug]/portal/agents/[id]/campaigns/page.tsx`
- `[clientSlug]/portal/agents/[id]/widget/page.tsx`
- `[clientSlug]/portal/agents/[id]/agent-settings/page.tsx`

### `(marketing)` route group
- `page.tsx`

### Root
- `layout.tsx`
- `not-found.tsx`

### Components
- `components/layout/startup-sidebar.tsx`
- `components/layout/portal-sidebar.tsx`

### Types
- `types/database.ts`
- `types/index.ts`
- `types/retell.ts`

### Hooks
- `hooks/use-supabase.ts`
- `hooks/use-plan-access.ts`
