# FINAL LAUNCH VERDICT

## DO NOT SHIP

**Confidence Score: 6/10**

There are critical blockers that will cause user-visible failures, a security vulnerability, and access-control gaps. The platform is architecturally sound and close to production-ready, but the issues below must be resolved first.

---

## BLOCKERS

> Must fix before launch. Will cause errors, security issues, or broken user flows.

### Security

| # | Issue | Source | File(s) |
|---|-------|--------|---------|
| B-1 | **XSS in contact form** — User input (`name`, `email`, `company`, `phone`, `message`) is interpolated directly into HTML email without `escapeHtml()`. Every other email template in the codebase escapes HTML; this is the sole exception. A malicious user can inject arbitrary HTML/JS into notification emails. | marketing, security | `src/app/api/contact/route.ts:20-28` |
| B-2 | **Middleware does not block client users from admin routes** — Middleware checks `pathname.startsWith("/dashboard")` but admin pages are at `/agents`, `/clients`, `/settings`, `/billing`, `/saas`, `/automations`, `/workflows`. A client user navigating to these paths sees the admin UI shell (RLS protects data, but the empty admin interface is exposed). | admin | `src/lib/supabase/middleware.ts` |

### Broken User Flows

| # | Issue | Source | File(s) |
|---|-------|--------|---------|
| B-3 | **Footer "Privacy Policy" and "Terms of Service" are dead links** — Both point to `href="#"`. Placeholder legal links on a production site are a credibility and compliance issue. | marketing | `src/components/marketing/layout/footer.tsx:87-88` |
| B-4 | **Login redirect causes flash for client users** — `router.push("/dashboard")` fires for ALL users after login. Client users briefly load `/dashboard`, then middleware redirects to `/<slug>/portal`. Visible flash and unnecessary round-trip. | marketing, integration | `src/app/(auth)/login/page.tsx:37` |
| B-5 | **OAuth error redirects lose query params** — OAuth callback error paths hardcode `/portal/automations` (old non-slug path). Middleware rewrites to `/<slug>/portal/automations` but drops `?oauth_error=...` query params. Error toast never displays. | integration | `src/app/api/oauth/callback/route.ts:17-23` |
| B-6 | **`chatSilenceTimeout` 60x multiplier bug** — The end-chat-after-silence setting multiplies by `60000` (minutes→ms), but if the UI field is labeled/entered in seconds, a "60" input becomes 60 minutes instead of 60 seconds. Verify units and fix multiplier. | client | `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx:~989` |

### Environment / Config

| # | Issue | Source | File(s) |
|---|-------|--------|---------|
| B-7 | **`TWILIO_FROM_NUMBER` env var mismatch** — Code references `process.env.TWILIO_FROM_NUMBER!` (with non-null assertion), but `.env.example` documents `TWILIO_PHONE_NUMBER`. If unset, `undefined` is sent as the Twilio "from" number, causing silent failures. | security | `src/app/api/tools/confirmation/send/route.ts:41`, `src/app/api/tools/sms/send/route.ts:30` |

### Data Integrity

| # | Issue | Source | File(s) |
|---|-------|--------|---------|
| B-8 | **No pagination on any admin table** — All list pages fetch all records. Organizations with many clients, agents, transactions, invoices, or webhook logs will experience performance degradation or browser crashes. | admin | All `(startup)` list pages |

**Total Blockers: 8**

---

## WARNINGS

> Should fix before or shortly after launch. Degrade UX, produce misleading data, or are potential bugs.

### Access Control & Auth

| # | Issue | Source |
|---|-------|--------|
| W-1 | `requireAuth()` checks authentication but not role. Client users calling admin API routes (e.g. `/api/billing`) pass auth; only RLS + org scoping prevents data leakage. | admin |
| W-2 | Make/n8n/Zapier auth endpoints verify `client_id` exists but never validate the random key portion. Anyone who guesses a UUID can authenticate. | security |
| W-3 | Client status (`cancelled`, `past_due`) not checked at middleware level. Cancelled clients can still access the full portal. | integration |
| W-4 | OAuth state fallthrough: if Supabase session expires but OAuth state token (10-min) is still valid, connection is stored without verifying user owns the client. | integration |
| W-5 | `create-web-call` endpoint is unauthenticated. Any user who knows an agent UUID can create web calls (by design for widget, but exploitable for cost generation). | integration |

### UX / Data Quality

| # | Issue | Source |
|---|-------|--------|
| W-6 | Dashboard "Active Agents" KPI shows total agent count, not actually-active agents. Misleading. | client |
| W-7 | Hardcoded "0" notification badge on dashboard and sidebar. Non-functional notification system. | client |
| W-8 | About page shows fake team members ("Alex Rivera", "Jordan Patel", "Sam Nakamura") with visible "placeholder" disclaimer. | marketing |
| W-9 | Contact page shows placeholder phone `(888) 555-0199` with visible "Placeholder number" text. | marketing |
| W-10 | Contact page "Book a Demo" section shows "Calendly integration coming soon" placeholder visible to users. | marketing |
| W-11 | Footer social media badges ("Li", "X") are unlinked `<span>` elements, not actual social links. | marketing |
| W-12 | Sign-up page hardcodes plan prices ($499/$399 Starter, $899/$719 Professional). If DB prices change, page shows stale data. | integration |
| W-13 | Onboarding checklist "Business hours set" and "Services & FAQs configured" always show as `done: true` even when skipped. | client |
| W-14 | No unsaved changes warning on agent config page or conversation flow editor. | admin, client |
| W-15 | Conversation flow delete uses `window.confirm` without undo. All destructive deletes across the app use `window.confirm` instead of custom `AlertDialog`. | client |

### Rate Limiting & Abuse

| # | Issue | Source |
|---|-------|--------|
| W-16 | `/api/contact` has no rate limiting. Public endpoint that sends emails via Resend — exploitable for email bombing. | security |
| W-17 | `/api/checkout` has no rate limiting. Could generate thousands of pending Stripe Checkout sessions. | security |
| W-18 | In-memory rate limiter (`Map`) won't work across Vercel serverless instances. Distributed requests bypass limits. | security |

### SEO & Metadata

| # | Issue | Source |
|---|-------|--------|
| W-19 | Root layout has minimal metadata (`"Invaria Labs"` / `"Voice AI Platform"`). No OpenGraph, no Twitter cards, no favicons beyond default, no sitemap. | marketing |
| W-20 | Homepage, Features, and Pricing pages export no page-level metadata. Features and Pricing are `"use client"` components and cannot export metadata. | marketing |

### Build & Config

| # | Issue | Source |
|---|-------|--------|
| W-21 | Next.js 16 middleware deprecation warning: `"middleware" file convention is deprecated, use "proxy" instead`. Will break on future Next.js update. | security |
| W-22 | `/api/cron/usage-alerts` not configured in `vercel.json`. Route exists with auth but will never be called. Clients with usage alerts configured will not receive them. | security, integration |
| W-23 | `next.config.ts` is empty — no custom security headers (CSP, HSTS, X-Frame-Options) set at framework level. Relies entirely on hosting platform defaults. | security |

### Admin-Specific

| # | Issue | Source |
|---|-------|--------|
| W-24 | Billing coupons `amount_off` sent as float (dollars) but Stripe expects cents (integer). $10 discount would be created as $0.10. | admin |
| W-25 | Billing transactions sort icon is decorative — clicking does nothing. | admin |
| W-26 | Email template editor allows arbitrary unsanitized HTML via `dangerouslySetInnerHTML`. Stored and sent in actual emails. | admin |
| W-27 | Widget custom CSS stored without sanitization. XSS-adjacent risk. | admin |
| W-28 | Agent name can be set to empty string via inline edit (no validation). | admin |
| W-29 | Two separate Stripe Connect pages (`/billing/connect` and `/saas/connect`) manage the same resource. | admin |
| W-30 | Workflows cannot be edited or deleted after creation. "Assigned To" column shows wrong field. | admin |
| W-31 | Pricing table delete has no confirmation dialog. | admin |
| W-32 | SIP trunk password visible in UI during creation/editing (should use `type="password"`). | admin |
| W-33 | AI API key displayed in full after being set (should mask, show last 4 chars). | admin |
| W-34 | Stripe webhook `listUsers` with `perPage: 1000` is a linear scan that will degrade at scale. | integration |
| W-35 | `setup-account` page falls back to `router.push("/dashboard")` — same flash issue as login for client users. | marketing |
| W-36 | Checkout return URL uses different origin sources (`request.nextUrl.origin` vs `NEXT_PUBLIC_APP_URL`) across marketing-checkout and checkout routes. | integration |

### Client Platform

| # | Issue | Source |
|---|-------|--------|
| W-37 | Widget page not wrapped in `FeatureGate` — inconsistent with all other agent sub-pages. | client |
| W-38 | Leads CSV import does not validate file size. Large files could freeze browser. Knowledge-base correctly limits to 10MB. | client |
| W-39 | Agent Settings page only partially audited (first ~1000 of ~5000 lines). Additional issues may exist. | client |
| W-40 | Campaigns/billing dialogs missing `DialogDescription` for WAI-ARIA accessibility. | client |
| W-41 | Onboarding email field has no server-side format validation. Malformed emails saved to DB. | client |
| W-42 | Receipt email says "reply to this email" but Resend likely doesn't forward replies. | integration |

**Total Warnings: 42**

---

## COSMETIC

> Minor polish. Low priority, non-blocking.

| # | Issue | Source |
|---|-------|--------|
| C-1 | 13 `console.log` statements in production code (none leak sensitive data). | security |
| C-2 | 48 `eslint-disable` comments and ~40 `any` casts across 27 files. | security |
| C-3 | Duplicate `escapeHtml` implementations with slightly different behavior. | integration |
| C-4 | Retell API URL style inconsistency (mix of inline URLs and helper function). | integration |
| C-5 | Seed data vertical templates contain realistic-looking sample content ("$150 teeth cleaning"). | security |
| C-6 | Inconsistent date formatting between portal pages (no shared `formatDate` utility). | client |
| C-7 | Knowledge base 10MB limit not communicated to user until upload fails. | client |
| C-8 | Onboarding SMS test shows "(Simulated)" label that may confuse users. | client |
| C-9 | `INDUSTRY_NAMES` constant defined inside IIFE — fragile reference pattern. | client |
| C-10 | Billing cost estimator hardcodes first 6 LLM models with no "show more". | client |
| C-11 | Features page comment numbering mismatch (says "Feature 12" for 14th section). | marketing |
| C-12 | Navbar "Book a Demo" uses `hidden lg:inline-flex` on anchor — potential hydration flash. | marketing |
| C-13 | Agent config page is 1612 lines. Could benefit from component extraction. | admin |
| C-14 | Phase 2 placeholders (Custom CSS, Embed URL) have non-functional save buttons. | admin |
| C-15 | Billing create subscription/invoice buttons show "coming soon" toast. | admin |
| C-16 | Portal dashboard has no explicit error boundary (unlike marketing layout). | integration |
| C-17 | Both cron jobs run hourly; daily digest internally checks the hour — most runs are no-ops. | integration |
| C-18 | `.env.example` default `http://localhost:3001` could cause issues if copied without updating. | security |
| C-19 | Dashboard onboarding banner dismiss is client-side only (reappears on refresh). | client |
| C-20 | "Contact Sales" `mailto:sales@invarialabs.com` with Calendar icon — verify email is monitored. | client |
| C-21 | Pricing cards use `<button>` for paid plans but `<Link>` for Enterprise — minor semantic mismatch. | marketing |
| C-22 | About page gradient-circle avatars with fake names weaken page credibility. | marketing |

**Total Cosmetic: 22**

---

## FALSE POSITIVES EXCLUDED

The marketing auditor reported the following 3 API routes as missing. All 3 have been **manually verified to exist**:

| Claimed Missing | Actual File | Status |
|-----------------|-------------|--------|
| `POST /api/marketing-checkout` | `src/app/api/marketing-checkout/route.ts` | EXISTS |
| `POST /api/demo-call` | `src/app/api/demo-call/route.ts` | EXISTS |
| `POST /api/auth/reset-password` | `src/app/api/auth/reset-password/route.ts` | EXISTS |

These were removed from the blocker count. The integration auditor independently verified all 3 routes exist (see integration report, section 14).

---

## SUMMARY TABLE

| Severity | Count |
|----------|-------|
| BLOCKERS | 8 |
| WARNINGS | 42 |
| COSMETIC | 22 |
| **TOTAL** | **72** |

---

## RECOMMENDED PRIORITY

### Before Launch (Blockers)
1. **B-1**: Escape HTML in contact form email — one-line fix, critical security
2. **B-2**: Add admin route paths to middleware client-user block list
3. **B-3**: Create real Privacy Policy / Terms of Service pages, or remove footer links
4. **B-4 + B-5**: Fix login/setup-account redirect to be role-aware; fix OAuth error redirect to use slug path and preserve query params
5. **B-6**: Verify `chatSilenceTimeout` units and fix multiplier
6. **B-7**: Align `TWILIO_FROM_NUMBER` / `TWILIO_PHONE_NUMBER` naming
7. **B-8**: Add basic pagination to admin tables (at minimum: transactions, invoices, webhook logs)

### Before Launch (High-Priority Warnings)
8. **W-8/W-9/W-10/W-11**: Remove all placeholder content from marketing site (fake team, fake phone, "coming soon" calendar, unlinked social badges)
9. **W-16/W-17**: Add rate limiting to `/api/contact` and `/api/checkout`
10. **W-22**: Add `/api/cron/usage-alerts` to `vercel.json`
11. **W-24**: Fix coupon `amount_off` to send cents, not dollars

### After Launch
12. Address remaining warnings by severity
13. Complete agent-settings page audit (W-39)
14. Migrate rate limiter from in-memory to Redis (W-18)
15. Add SEO metadata to all marketing pages (W-19/W-20)
16. Replace all `window.confirm` with `AlertDialog` (W-15)

---

## AUDIT COVERAGE

| Property | Pages Audited | API Routes Verified | Depth |
|----------|--------------|-------------------|-------|
| Client Portal | 16 pages + 10 shared components | All `fetch()` calls traced | Full (except agent-settings beyond line 1000) |
| Admin Dashboard | 28 pages across 6 route sections | Direct Supabase + API calls | Full |
| Marketing Site | 16 pages + 10 shared components + 3 API routes | 3 checked | Full |
| Integrations | 16 integration seams + 79 API routes | All 79 frontend→API traced | Full |
| Build/Security | Build output, env vars, auth, injection, encryption, CORS, RLS | All security surfaces | Full |

**Audit Date:** 2026-02-22
**Auditor:** Claude Opus 4.6 (5-agent automated team)
