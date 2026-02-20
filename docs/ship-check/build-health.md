# Build & Runtime Health Check

**Date:** 2026-02-20
**Next.js version:** 16.1.6 (Turbopack)
**Node stack:** React 19.2.3, TypeScript 5.x
**Auditor:** build-health agent

---

## 1. Build Results (`npm run build`)

### Result: FAILED (exit code 1)

The production build **does not compile**. TypeScript type-checking catches a blocking error after Turbopack finishes bundling.

### Build Error (1)

| # | Severity | File | Description |
|---|----------|------|-------------|
| B1 | **BLOCKER** | `src/app/(startup)/clients/[id]/phone-numbers/page.tsx:74` | **TypeScript error -- type mismatch.** The mapped object is missing `caller_id_name`, `caller_id_verified`, and `cnam_status` properties required by `PhoneNumberWithAgent` (which extends `PhoneNumber`). The `.map()` on line 74 constructs an object with only 9 fields but the `PhoneNumber` type requires 12. Build halts here. |

### Build Warnings (1)

| # | Severity | File | Description |
|---|----------|------|-------------|
| B2 | **BLOCKER** | `src/app/api/calls/route.ts:47` | **Module not found: `@/lib/retell` does not exist.** The file `src/lib/retell.ts` (or `.tsx`/`index.ts`) is completely absent from the codebase. Only `src/lib/retell-costs.ts` and `src/types/retell.ts` exist. This dynamic `import("@/lib/retell")` will fail at runtime for any `POST /api/calls` request with `action: "create_web_call"`. Turbopack emits this as a warning but it is a runtime crash for the web-call creation flow. |
| B3 | **WARNING** | `src/middleware.ts` | **Deprecated `middleware` file convention.** Next.js 16.x warns: _"The middleware file convention is deprecated. Please use proxy instead."_ The middleware still works in 16.1.6 but will be removed in a future version. Not blocking today but a ticking clock. |

---

## 2. Lint Results (`npm run lint`)

### Result: FAILED (exit code 1) -- 25 errors, 46 warnings

### Lint Errors (25)

#### Category A: `react-hooks/set-state-in-effect` (18 errors)

Calling `setState` synchronously inside a `useEffect` body. These cause cascading re-renders and degrade performance but do not crash. Each is a common pattern for data-fetching in client components (call async function that eventually calls setState).

| # | Severity | File | Line | Detail |
|---|----------|------|------|--------|
| L1 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx` | 112 | `loadConfig()` inside effect |
| L2 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/analytics/page.tsx` | 125 | `fetchCallLogs()` inside effect |
| L3 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx` | 80 | `fetchTopics()` inside effect |
| L4 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/leads/page.tsx` | 51 | `fetchLeads()` inside effect |
| L5 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/knowledge-base/page.tsx` | 54 | `fetchSources()` inside effect |
| L6 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/campaigns/page.tsx` | 67 | `loadCampaigns()` inside effect |
| L7 | WARNING | `src/app/(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx` | 101 | `loadConfig()` inside effect |
| L8 | WARNING | `src/app/(portal)/[clientSlug]/portal/settings/business/page.tsx` | 128 | `loadAll()` inside effect |
| L9 | WARNING | `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx` | 66 | `fetchFlows()` inside effect |
| L10 | WARNING | `src/app/(portal)/[clientSlug]/portal/billing/page.tsx` | 97 | `loadBilling()` inside effect |
| L11 | WARNING | `src/app/(startup)/settings/phone-sip/page.tsx` | 42 | `fetchData()` inside effect |
| L12 | WARNING | `src/app/(startup)/settings/webhook-logs/page.tsx` | 51 | `fetchLogs()` inside effect |
| L13 | WARNING | `src/app/(startup)/settings/members/page.tsx` | 57 | `fetchMembers()` inside effect |
| L14 | WARNING | `src/app/(startup)/billing/transactions/page.tsx` | 88 | `fetchTransactions()` inside effect |
| L15 | WARNING | `src/app/(startup)/billing/products/page.tsx` | 54 | `fetchProducts()` inside effect |
| L16 | WARNING | `src/app/(startup)/billing/coupons/page.tsx` | 57 | `fetchCoupons()` inside effect |
| L17 | WARNING | `src/components/layout/portal-sidebar.tsx` | 198, 203 | `fetchUser()` + `setMobileOpen(false)` inside effects |
| L18 | WARNING | `src/components/layout/startup-sidebar.tsx` | 71 | `setMobileOpen(false)` inside effect |

**Assessment:** These are all async data-fetch patterns (`useCallback` + `useEffect`). While flagged as errors by the strict React 19 lint rule, they work correctly at runtime. They cause extra renders but no crashes. Classified as **WARNING** not BLOCKER.

#### Category B: `react-hooks/immutability` (1 error)

| # | Severity | File | Line | Detail |
|---|----------|------|------|--------|
| L19 | WARNING | `src/app/(marketing)/pricing/page.tsx` | 427 | `window.location.href = data.url` flagged as modifying an external value inside a component. This is an intentional navigation redirect. Not a real bug. |

**Assessment:** False positive for navigation pattern. **INFO** level.

#### Category C: `react-hooks/set-state-in-effect` in components (6 more)

| # | Severity | File | Line | Detail |
|---|----------|------|------|--------|
| L20 | WARNING | `src/app/(startup)/saas/advanced/page.tsx` | 63 | `loadSettings()` inside effect |
| L21 | WARNING | `src/app/(startup)/saas/pricing-tables/page.tsx` | 67 | `fetchData()` inside effect |
| L22 | WARNING | `src/app/(startup)/saas/templates/page.tsx` | 61 | `loadTemplates()` inside effect |
| L23 | WARNING | `src/app/(startup)/clients/[id]/solutions/page.tsx` | 83 | `loadData()` inside effect |
| L24 | WARNING | `src/app/(startup)/clients/[id]/business-settings/page.tsx` | 148 | `loadAll()` inside effect |
| L25 | WARNING | `src/components/automations/recipe-setup-modal.tsx` | 120 | `setFormValues()` inside effect |

### Lint Warnings (46) -- Unused Variables

All 46 warnings are `@typescript-eslint/no-unused-vars` or `@typescript-eslint/no-explicit-any`. These are code cleanliness issues only.

**Notable unused imports across portal pages:**
- `FileDown` in campaigns page
- `X` in conversations page
- `FileText` in knowledge-base page
- `Textarea` in leads page
- `_config` in hubspot OAuth executor
- `delayMinutes` in post-call-actions lib
- `MONTHLY_COSTS` in retell-costs lib

**Assessment:** All **INFO** level. No runtime impact.

---

## 3. Runtime Analysis (Page-by-Page Review)

### BLOCKER Issues

| # | Severity | File | Description |
|---|----------|------|-------------|
| R1 | **BLOCKER** | `src/app/api/calls/route.ts:47` | **Missing `@/lib/retell` module.** Any POST to `/api/calls` with `action: "create_web_call"` will throw a runtime error. The dynamic import `await import("@/lib/retell")` resolves to a file that does not exist. The `catch` block on line 54 will return a 500 error ("Failed to create web call") to callers, so it won't crash the server, but the feature is completely non-functional. The alternative endpoint `POST /api/agents/create-web-call` uses direct `fetch()` to the Retell API and works fine -- but any code path hitting `/api/calls` for web call creation is broken. |
| R2 | **BLOCKER** | `src/app/(startup)/clients/[id]/phone-numbers/page.tsx:74` | **Build failure blocks production deployment.** This TypeScript error prevents `next build` from completing. No production bundle can be generated until this is fixed. The fix is trivial (add the 3 missing fields to the map), but until it's done, the app cannot be deployed. |

### WARNING Issues

| # | Severity | Area | Description |
|---|----------|------|-------------|
| R3 | **WARNING** | Error boundaries | **Only the `(marketing)` route group has an `error.tsx`.** The `(startup)`, `(portal)`, and `(auth)` route groups have no error boundaries. Any unhandled exception in these sections will bubble up to the Next.js default error page (white screen with generic error), providing a poor user experience. |
| R4 | **WARNING** | Middleware deprecation | The `src/middleware.ts` file uses the deprecated `middleware` convention. Next.js 16.x still supports it but warns it will be removed. This should be migrated to the `proxy` convention before upgrading Next.js further. |
| R5 | **WARNING** | Cascading renders (18 pages) | All client-side data-fetching pages use the `useEffect(() => { fetchData() }, [fetchData])` pattern which triggers cascading renders per React 19's stricter rules. Performance is degraded (double-renders on mount) but functionality is preserved. |
| R6 | **WARNING** | Portal dashboard null safety | `src/app/(portal)/[clientSlug]/portal/page.tsx:522` -- `call.retell_call_id || call.id` could produce an empty string if `retell_call_id` is `""` (empty string is falsy). Unlikely but worth noting. |

### INFO Issues

| # | Severity | Area | Description |
|---|----------|------|-------------|
| R7 | INFO | Unused code | 46 unused variable warnings across the codebase. Dead code that should be cleaned up. |
| R8 | INFO | `@typescript-eslint/no-explicit-any` | 1 explicit `any` in `src/lib/api/get-client-id.ts:5`. Minor type safety gap. |
| R9 | INFO | Marketing pricing lint | `window.location.href` assignment flagged by `react-hooks/immutability`. Not a real bug -- standard navigation pattern. |
| R10 | INFO | Next.js config | `next.config.ts` is empty (no custom config). No image domains, no redirects, no headers. Fine for now but may need security headers before production. |

---

## 4. Summary

### Counts

| Level | Count |
|-------|-------|
| **BLOCKER** | 2 |
| **WARNING** | 5 |
| **INFO** | 4 |

### Blockers Detail

1. **Build does not complete.** TypeScript error in `phone-numbers/page.tsx:74` -- the `PhoneNumberWithAgent` mapping is missing 3 required fields (`caller_id_name`, `caller_id_verified`, `cnam_status`). Production deployment is impossible until this is fixed.

2. **Missing `@/lib/retell` module.** The file `src/lib/retell.ts` does not exist. The `/api/calls` POST endpoint dynamically imports it for web call creation. This endpoint will always return 500 for web call requests. Note: the alternative endpoint `/api/agents/create-web-call` works correctly using direct fetch.

### What's Working Well

- All `useSearchParams` usages are properly wrapped in `Suspense` boundaries.
- No `dangerouslySetInnerHTML` usage anywhere in the codebase.
- API routes have proper error handling with try/catch blocks.
- Rate limiting is implemented on public endpoints.
- Authentication checks (`requireAuth`) are consistent across protected API routes.
- The marketing error boundary provides a clean recovery UX.
- Retell API key resolution has a proper fallback chain (agent-level -> org integration -> env var).

---

## 5. Verdict

# FAIL

**The production build does not complete.** There are 2 blockers that must be resolved before shipping:

1. Fix the TypeScript error in `phone-numbers/page.tsx` by adding the 3 missing fields to the map.
2. Either create `src/lib/retell.ts` with the expected `createWebCall` export, or remove/refactor the dead import in `src/app/api/calls/route.ts`.

After fixing these, also strongly recommended:
- Add `error.tsx` boundaries to the `(startup)`, `(portal)`, and `(auth)` route groups.
- Migrate `middleware.ts` to the `proxy` convention before it breaks in a future Next.js release.
