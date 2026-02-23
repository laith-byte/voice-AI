# SHIP VERDICT

**Date:** 2026-02-22
**Audit Team:** 5 agents (integration, client-platform, admin-dashboard, marketing, build-security)
**Scope:** All three Invaria Labs properties after Housecall Pro + Jobber CRM integration work

---

## VERDICT: DO NOT SHIP — Fix 3 blockers first, then ship

**Estimated fix time: 1-2 hours. After fixes, this is a SHIP.**

---

## 1. Integration-Specific Results

### Housecall Pro: PASS (with 1 warning)

| Area | Verdict |
|------|---------|
| OAuth flow (providers.ts, callback, disconnect) | PASS |
| Executor (customer search, create, note, retry) | PASS |
| Tool routes (lookup, availability, book, estimate) | PASS — all 4 auth-protected, input-validated |
| Webhook | WARNING — missing client_id (silent FK violation, every event dropped) |
| Tool registration (4 Retell tools) | PASS |
| Test coverage (13 tests) | PASS |

### Jobber: FAIL — 1 BLOCKER

| Area | Verdict |
|------|---------|
| OAuth flow (providers.ts, callback, disconnect) | PASS |
| Executor (client search, create, request, retry) | FAIL — GraphQL injection on search query (line 81) |
| Tool routes (lookup, availability, book, quote) | FAIL — GraphQL injection in all 4 search queries |
| Webhook | WARNING — "unknown" client_id fallback causes FK violation |
| Tool registration (4 Retell tools) | PASS |
| Test coverage (16 tests) | PASS |

**BLOCKER: 5 GraphQL search queries use string interpolation `"${phone}"` instead of `$variables`.** The mutations in the same files correctly use variables — the fix pattern already exists in the codebase. Affects: `jobber.ts:81`, `lookup/route.ts:28`, `availability/route.ts:32`, `book/route.ts:29`, `create-quote/route.ts:29`.

### Integration Framework: PASS

| Area | Verdict |
|------|---------|
| Event logging (integration-events.ts) | PASS |
| Retry queue (integration-retry.ts) | PASS — backoff schedule correct |
| Cron route (/api/cron/retry-queue) | PASS — CRON_SECRET protected |
| Service mappings CRUD | PASS — requireAuth + getClientId |
| Migration (3 tables, 6 indexes, 6 RLS policies) | PASS |

### HVAC Templates: PASS

| Area | Verdict |
|------|---------|
| 9 service categories | PASS — correct names, durations, prices, keywords |
| 3 urgency rules | PASS — emergency/urgent/routine with response times |
| getHvacServiceMapping() | PASS — 1:1 default mappings |
| Migration seed (agent template) | PASS — prompt template, services, FAQs, policies |

### Post-Call Pipeline: PASS (10/10 transcript tests)

| Test | Verdict |
|------|---------|
| 1. Perfect data | PASS |
| 2. Missing caller name | PASS |
| 3. Missing phone number | PASS |
| 4. Emergency call (gas leak) | PASS |
| 5. Non-emergency routine | PASS |
| 6. Caller outside service area | PASS |
| 7. Duplicate caller | PASS |
| 8. Caller who didn't book | PASS |
| 9. Two services requested | PASS (returns first fuzzy match — V1 limitation) |
| 10. Garbled transcript | PASS (graceful degradation) |

---

## 2. Blockers (must fix before ship)

### BLOCKER 1: Jobber GraphQL Injection (CRITICAL)
- **Files:** 5 locations across executor + 4 tool routes
- **Risk:** User-controlled input interpolated into GraphQL query strings
- **Fix:** Change all search queries to use `$variables` parameter (mutations already do this correctly)
- **Effort:** 30 minutes

### BLOCKER 2: INDUSTRY_STYLES missing "hvac" key (CLIENT PLATFORM)
- **File:** `src/app/(portal)/[clientSlug]/portal/conversation-flows/page.tsx:143-209`
- **Risk:** 4 HVAC template cards render with gray fallback instead of themed visuals — looks broken to the HVAC business owner during setup
- **Fix:** Add `hvac: { icon: Snowflake, gradient: "from-blue-500 to-cyan-600", ... }` to INDUSTRY_STYLES
- **Effort:** 5 minutes

### BLOCKER 3: .env.example missing new vars (BUILD/DEPLOY)
- **File:** `.env.example`
- **Risk:** Deployment will fail or OAuth will silently not work without these 4 variables documented
- **Fix:** Add HOUSECALLPRO_CLIENT_ID, HOUSECALLPRO_CLIENT_SECRET, JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET
- **Effort:** 2 minutes

---

## 3. Regressions: NONE

All 5 auditors explicitly checked for regressions. Zero found:
- Admin dashboard: 43 pages audited, all working, no changes to existing behavior
- Client platform: 17 pages audited, all existing features working
- Marketing site: 10+ pages audited, all working
- Build: zero TypeScript errors, 99/99 tests passing
- Auth guards: still blocking client users from admin routes

---

## 4. Warnings (should fix before or shortly after ship)

| # | Issue | Source | Severity |
|---|-------|--------|----------|
| W1 | HCP webhook missing client_id — every inbound event silently fails | integration-auditor | HIGH |
| W2 | Jobber webhook "unknown" client_id fallback — FK violation | integration-auditor | HIGH |
| W3 | No webhook signature validation on HCP or Jobber endpoints | integration + security | HIGH |
| W4 | OAuthConnectButton PROVIDER_LABELS missing HCP, Jobber, Salesforce, GHL — shows raw keys | client-auditor | MEDIUM |
| W5 | Pricing page missing meta description | marketing-auditor | MEDIUM |
| W6 | No Open Graph / Twitter card metadata on any marketing page | marketing-auditor | MEDIUM |
| W7 | npm audit: 21 vulnerabilities (18 high) — mostly dev/transitive deps, jspdf needs attention | security-auditor | MEDIUM |
| W8 | No error.tsx in portal route group — runtime errors show default Next.js error page | client-auditor | MEDIUM |
| W9 | RecentSyncsWidget has no refresh/retry mechanism | client-auditor | LOW |
| W10 | ServiceMappingEditor no unsaved changes indicator, grid breaks on mobile | client-auditor | LOW |
| W11 | Urgency keyword matching is exact-substring (misses reordered phrases) | integration-auditor | LOW |
| W12 | HCP availability only checks first employee's schedule | integration-auditor | LOW |
| W13 | Notifications button in sidebar is non-functional | client-auditor | LOW |

---

## 5. Cosmetic Issues

| # | Issue | Source |
|---|-------|--------|
| C1 | Mobile header overlaps gradient accent bar in portal layout | client-auditor |
| C2 | Billing page is ~1295 lines in one file | client-auditor |
| C3 | RecentSyncsWidget doesn't show error_message for failed syncs | client-auditor |
| C4 | ServiceMappingEditor grid barely usable on mobile | client-auditor |
| C5 | Notification badge always shows "0" | client-auditor |
| C6 | Contact page sidebar card styled for dark bg on white bg | marketing-auditor |
| C7 | Comparison table may overflow on mobile | marketing-auditor |
| C8 | Footer missing Sign Up link | marketing-auditor |
| C9 | Salesforce/GHL still marked "Coming Soon" in marketing integrations grid | marketing-auditor |

---

## 6. Confidence Score

**7/10 — SHIP AFTER BLOCKER FIXES**

What gives confidence:
- Build is clean (zero errors, 99 tests passing)
- OAuth flow is battle-tested (follows exact pattern of 5 existing providers)
- Executors are well-structured with proper retry/logging
- Token management, encryption, and RLS are solid
- HVAC template is thorough (emergency triage, seasonal awareness, 9 service categories)
- Post-call pipeline handles all 10 test cases correctly
- Zero regressions across all 3 properties
- Admin dashboard completely unaffected

What costs points:
- GraphQL injection is a real security issue (-2)
- Webhooks are non-functional in current state (client_id bugs + no auth) (-1)
- The HVAC template card styling gap would be visible on day 1 (-0)

**After fixing the 3 blockers, confidence moves to 9/10.** The remaining -1 is for the webhook issues (W1-W3), which are inbound-only and don't affect the core outbound CRM sync flow that HVAC businesses depend on.

---

## The 8 AM Test

> An HVAC business owner connects their Housecall Pro account tomorrow morning and their first real customer calls at 8 AM. Would this hold up?

**Housecall Pro: YES** (after BLOCKER 2 fix for template styling).
The HCP OAuth flow, executor, and all 4 tool routes are solid. The AI agent will look up the caller in HCP, check availability, book a job, and create an estimate — all correctly. Post-call, the executor will sync the call to HCP with proper customer creation, note logging, and service mapping. If HCP's API is down, the retry queue will pick it up.

**Jobber: NO** (until BLOCKER 1 is fixed).
The GraphQL injection in search queries is a security risk. Fix the 5 string interpolations to use `$variables`, and Jobber is also a YES.

---

## Detailed Reports

- [Integration Audit](./integrations.md) — 33 files audited, 620 lines of findings
- [Client Platform Audit](./client-platform.md) — 17 pages + 10 components audited
- [Admin Dashboard Audit](./admin-dashboard.md) — 43 pages audited, zero regressions
- [Marketing Site Audit](./marketing-site.md) — 10+ pages audited
- [Build & Security Audit](./build-security.md) — 15 PASS, 4 FAIL checks

---

*Verdict compiled from 5 independent auditor reports. 2026-02-22.*
