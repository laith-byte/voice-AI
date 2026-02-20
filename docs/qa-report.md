# Platform QA Report — Invaria Labs Voice AI

**Date:** 2026-02-20
**Auditor:** platform-qa (automated code review)
**Scope:** Full codebase audit of every page, API route, and shared module

---

## Executive Summary

Performed a comprehensive code-level audit of the Invaria Labs platform covering all route groups: `(auth)`, `(startup)`, `(portal)`, `(marketing)`, and all API routes. The audit identified **28 bugs** ranging from non-functional UI buttons to data inconsistencies and a memory leak. The majority are low-to-medium severity UI/UX issues where buttons or features are rendered but have no handler attached.

### Severity Breakdown
- **Critical (P0):** 2 (memory leak, billing connect creates duplicate accounts)
- **High (P1):** 5 (data mismatches, missing nav items, broken links)
- **Medium (P2):** 12 (non-functional buttons, missing toasts, placeholder UIs)
- **Low (P3):** 9 (cosmetic, coming-soon stubs, minor inconsistencies)

---

## Bug List

### P0 — Critical

| # | Area | File | Bug Description |
|---|------|------|-----------------|
| 1 | Auth | `(auth)/reset-password/page.tsx` | **Memory leak:** `onAuthStateChange` subscription is never cleaned up. The component subscribes inside `useEffect` but does not return an unsubscribe function. On repeated navigation to this page, listeners accumulate. |
| 2 | Billing | `(startup)/billing/connect/page.tsx` | **handleUpdate creates a NEW Stripe Connect account** instead of updating the existing one. It calls `action: "create_connect_account"` regardless, potentially creating orphaned Stripe accounts. |

### P1 — High

| # | Area | File | Bug Description |
|---|------|------|-----------------|
| 3 | Auth | `(auth)/setup-account/page.tsx` | **Redirects on failure:** After `updateBusinessName` fails, the code still calls `router.push("/dashboard")`, sending the user forward with stale/missing data. |
| 4 | Client Overview | `(startup)/clients/[id]/overview/page.tsx` | **Language value mismatch:** Create form sends `"English"` / `"Spanish"` but edit form sends `"en"` / `"es"`. The DB will store inconsistent values. |
| 5 | Portal Sidebar | `components/layout/portal-sidebar.tsx` | **Missing nav items:** Widget and AI Analysis pages exist at `/agents/[id]/widget` and `/agents/[id]/ai-analysis` but are not listed in `agentNavItems`. Users cannot navigate to them from the sidebar. |
| 6 | Portal Dashboard | `(portal)/[clientSlug]/portal/page.tsx` | **Active agents trend always 0%:** The code sets `prevActiveAgents = currentActiveAgents`, so the trend calculation always yields 0%. |
| 7 | Dashboard | `(startup)/dashboard/page.tsx` | **"Manage Billing" links to `/billing`:** This route does not exist. The correct route is `/billing/connect`. Quick action is a dead link. |

### P2 — Medium

| # | Area | File | Bug Description |
|---|------|------|-----------------|
| 8 | Dashboard | `(startup)/dashboard/page.tsx` | **"Remove" domain button:** Rendered with no `onClick` handler. Clicking does nothing. |
| 9 | Agent Overview | `(startup)/agents/[id]/overview/page.tsx` | **Sync method radio does not persist:** The radio group updates local state but never writes the selected sync method to the database. |
| 10 | Whitelabel | `(startup)/settings/whitelabel/page.tsx` | **5 non-functional buttons:** Favicon upload, email logo upload, "Send Test Email", "Remove" domain, and "Launch" domain all lack click handlers. |
| 11 | Integrations | `(startup)/settings/integrations/page.tsx` | **Missing success toasts:** Adding or disconnecting integrations completes silently with no user feedback. |
| 12 | Tab Nav | `components/layout/tab-nav.tsx` | **Exact pathname match only:** Parent tabs do not highlight when the user is on a sub-route (e.g., `/agents/[id]/overview` does not highlight the "Overview" tab when on a nested page). |
| 13 | Portal Sidebar | `components/layout/portal-sidebar.tsx` | **Notification badge hardcoded to "0":** The bell icon always shows "0" — it never reads from any data source. |
| 14 | Startup Widget | `(startup)/agents/[id]/widget/page.tsx` | **3 image uploads are non-functional:** Agent Image, Background Image, and Launcher Image render upload UI (dashed borders, Upload icon) but have no onChange/onClick handlers attached. |
| 15 | Startup Agent Config | `(startup)/agents/[id]/agent-config/page.tsx` | **DTMF timeout label mismatch:** Label at line ~1300 says "Timeout (ms)" but the field stores seconds and is multiplied by 1000 on save (line 518). The label should say "(seconds)". |
| 16 | Marketing Checkout | `api/marketing-checkout/route.ts` | **No rate limiting:** The public checkout API has no rate limiter, unlike the auth API which uses `createRateLimiter`. Could allow abuse. |
| 17 | Startup Settings | `(startup)/settings/startup/page.tsx` | **"Get HIPAA Compliance" button:** Has no onClick handler. Clicking does nothing. |
| 18 | Subscriptions | `(startup)/billing/subscriptions/page.tsx` | **Empty-state "Create Subscription" button (line 254):** Has no onClick handler, unlike the header button which shows a toast. |
| 19 | Invoices | `(startup)/billing/invoices/page.tsx` | **Empty-state "Create Invoice" button (line 232):** Has no onClick handler, unlike the header button which shows a toast. |

### P3 — Low

| # | Area | File | Bug Description |
|---|------|------|-----------------|
| 20 | Client Overview | `(startup)/clients/[id]/overview/page.tsx` | **Dashboard theme options inconsistent:** Create dialog has `"default"` / `"dark"` / `"light"`, edit dialog has `"light"` / `"dark"` (no "default"). |
| 21 | Client Overview | `(startup)/clients/[id]/overview/page.tsx` | **"View as Client" button** just navigates to `/login` page rather than impersonating or deep-linking to the client portal. |
| 22 | Client Overview | `(startup)/clients/[id]/overview/page.tsx` | **"Add Member" button** is a stub that shows a "Coming soon" toast. Should either be hidden or labeled as coming soon. |
| 23 | Startup Sidebar | `components/layout/startup-sidebar.tsx` | **Workflows page accessible but not in navigation:** The `/workflows` route exists and is renderable, but there is no link to it in the sidebar. |
| 24 | Phase 2 Pages | `(startup)/clients/[id]/embed-url/page.tsx`, `custom-css/page.tsx` | **Placeholder save buttons:** Both pages show functional-looking "Save" buttons that do nothing. Should either be disabled or show "coming soon". |
| 25 | Startup Settings | `(startup)/settings/startup/page.tsx` | **Dashboard Logo / Login Page Logo:** Marked "Coming Soon" with upload placeholders but no actual upload capability. Correctly labeled. |
| 26 | Coupons | `(startup)/billing/coupons/page.tsx` | **Percent coupon display missing `%` suffix in table:** The `discount` field for percent coupons stores just the number (e.g., `"20"`), and the display adds `%` via `{coupon.type === "percent" ? "%" : ""}`, which works but the column header says "Discount" without indicating units. Minor UI clarity issue. |
| 27 | Usage Page | `(startup)/settings/usage/page.tsx` | **Date range uses local time constructors** (`new Date(\`\${startDate}T00:00:00\`)`) which may produce off-by-one errors depending on timezone vs. UTC storage in Supabase. |
| 28 | Client Overview | `(startup)/clients/[id]/overview/page.tsx` | **Client slug not validated on create.** The slug is generated from the name but never checked for uniqueness or invalid characters before saving. (The Stripe webhook handler does validate slugs.) |

---

## Pages Audited (No Issues Found)

The following pages/features were audited and found to be well-implemented with no significant bugs:

- **Auth:** Login, Signup, Forgot Password
- **Portal Agent Pages:** Analytics, Conversations, Topics, Knowledge Base, Leads, Campaigns, Widget, AI Analysis
- **Portal Agent Settings:** Large unified settings page with config, widget, and AI analysis tabs — well-structured with proper Retell API integration
- **Startup Agent Pages:** AI Analysis, Campaigns (calling rate config)
- **Settings:** Phone & SIP, Webhook Logs, Members (with invite flow), Usage (with per-agent cost breakdown)
- **Billing:** Products, Subscriptions, Transactions, Invoices, Coupons — all properly gated behind Stripe connection check
- **API Routes:** `/api/billing`, `/api/agents/[id]/config`, `/api/webhooks/stripe`, `/api/webhooks/retell` — proper auth, validation, and error handling

---

## API Route Coverage

Reviewed the following API routes:
- `/api/auth` — Multi-action auth with rate limiting
- `/api/auth/reset-password` — Anti-enumeration password reset
- `/api/marketing-checkout` — Public checkout (P2: no rate limiting)
- `/api/clients` — Client CRUD
- `/api/agents` — Agent CRUD with encryption
- `/api/agents/[id]/config` — Full Retell config GET/PATCH with language directive injection
- `/api/billing` — Stripe Connect actions with ownership validation
- `/api/webhooks/stripe` — Webhook handler with auto-provisioning, receipt emails
- `/api/webhooks/retell` — Call data import

---

## Architecture Notes

- **Retell API Integration:** The config API route (`/api/agents/[id]/config`) properly handles the duality between inline LLM configs and separate LLM objects (`llm_id`). Language directives are injected/stripped transparently.
- **Stripe Integration:** Billing pages all properly check for Stripe connection before rendering and validate `stripeAccountId` ownership in the API route.
- **Feature Gating:** Portal pages correctly use `<FeatureGate>` for plan-gated access. Agent settings uses `usePlanAccess` hook with `<UpgradeBanner>`.
- **Auth Middleware:** Role-based routing in middleware correctly separates startup, client, and portal access patterns.

---

## Recommendations

1. **Fix P0 bugs immediately** — The memory leak in reset-password and the billing connect duplication bug should be addressed first.
2. **Add missing sidebar nav items** — Widget and AI Analysis should be added to the portal sidebar agent nav.
3. **Remove or properly label non-functional buttons** — Either hide buttons that have no handler or add "Coming Soon" labels/tooltips.
4. **Add rate limiting to marketing-checkout** — This is a public endpoint that should be protected.
5. **Fix the language value mismatch** in client overview to use consistent locale codes.
6. **Add `startsWith` matching** to tab-nav for better sub-route highlighting.
