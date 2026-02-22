# Second-Pass Pre-Launch Audit — Final Verdict

**Date:** 2026-02-22
**Auditor Team:** 5 specialized agents (blocker-verifier, marketing-auditor-v2, admin-auditor-v2, client-auditor-v2, integration-auditor-v2)
**Model:** Claude Opus 4.6

---

## VERDICT: CONDITIONAL SHIP

**Confidence: 7.5 / 10**

All 7 original blockers from the first audit have been verified fixed (6 clean passes + 1 caught-and-patched during audit). Two new blockers were discovered that require fixes before production launch. The remaining issues are UX polish (missing confirmation dialogs, metadata gaps, placeholder content) — important but not launch-blocking for a beta/soft launch.

---

## 1. Original Blocker Fix Verification

| # | Blocker | Status | Notes |
|---|---------|--------|-------|
| B-1 | XSS in contact form | **VERIFIED FIXED** | `escapeHtml()` applied to all 5 fields + subject line. Correct entity order. |
| B-2 | Middleware doesn't block client users from admin routes | **VERIFIED FIXED** | 7 admin prefixes guarded. Client-only. No false positives. |
| B-3 | Dead footer links (Privacy/Terms) | **VERIFIED FIXED** | Pages created with real legal content. Footer uses `<Link>`. Middleware `publicRoutes` updated (hot-fix applied during audit). |
| B-4 | Login redirect flash for client users | **VERIFIED FIXED** | Role-aware redirect via `getUser()`. Client → `/portal`, startup → `/dashboard`. |
| B-5 | OAuth error redirects lose query params | **VERIFIED FIXED** | `url.search = request.nextUrl.search` preserves params through `/portal` → `/<slug>/portal` rewrite. |
| B-6 | chatSilenceTimeout multiplier | **FALSE POSITIVE** | UI says "minutes", `* 60000` correctly converts min→ms. No fix needed. |
| B-7 | TWILIO_FROM_NUMBER env var mismatch | **VERIFIED FIXED** | Both `TWILIO_PHONE_NUMBER` and `TWILIO_FROM_NUMBER` documented in `.env.example`. |
| B-8 | No pagination on admin tables | **VERIFIED FIXED** | `TablePagination` component + 5 pages updated. Page resets on filter changes. Edge cases handled. |

**Result: 7/7 fixes verified. 0 regressions introduced.**

---

## 2. New Blockers Found in This Pass

### NEW-B1: `/api/contact` has no rate limiting
**Severity:** BLOCKER
**File:** `src/app/api/contact/route.ts`
**Found by:** integration-auditor-v2

The contact form endpoint is public and has no `publicEndpointLimiter`. Every other public endpoint (`/api/marketing-checkout`, `/api/demo-call`, `/api/auth`, `/api/auth/reset-password`) has rate limiting. An attacker can spam unlimited emails through this endpoint, burning Resend quota and potentially blacklisting the domain.

**Fix:** Import and apply `publicEndpointLimiter` at the top of the POST handler, matching the pattern in `/api/demo-call/route.ts`.

### NEW-B2: `/api/cron/usage-alerts` not configured in `vercel.json`
**Severity:** BLOCKER
**File:** `vercel.json`
**Found by:** integration-auditor-v2

The usage-alerts cron route exists with full implementation and CRON_SECRET auth, but is not listed in `vercel.json` crons. It will never execute. Clients who configure usage alerts will never receive alert emails.

**Fix:** Add `{ "path": "/api/cron/usage-alerts", "schedule": "0 * * * *" }` to the `crons` array in `vercel.json`.

---

## 3. Warnings (25 total across all properties)

### Client Portal (7 warnings)
| # | Issue | Severity |
|---|-------|----------|
| W-CP-1 | 10+ dialogs missing `DialogDescription` (accessibility) | Medium |
| W-CP-2 | Dashboard fetch error has no toast (only `console.error`) | Medium |
| W-CP-3 | Dashboard + agent-settings hardcode "Active" status badge | Medium |
| W-CP-4 | 5 pages use `window.confirm()` instead of `AlertDialog` for deletes | Medium |
| W-CP-5 | Widget page has no URL validation on image/link fields | Low |
| W-CP-6 | AI Analysis page uses inline plan-gating instead of `FeatureGate` | Low |
| W-CP-7 | Conversation flows page mixes API fetch + direct Supabase queries | Low |

### Admin Dashboard (11 warnings)
| # | Issue | Severity |
|---|-------|----------|
| W-AD-1 | Agents page empty-state checks `paginatedAgents.length` not `filteredAgents.length` | Low |
| W-AD-2 | Clients page same empty-state issue | Low |
| W-AD-3 | AI Analysis `removeTopic` — no confirmation dialog | Medium |
| W-AD-4 | Assigned agents `handleUnassign` — no confirmation dialog | Medium |
| W-AD-5 | Solutions `handleRemoveSolution` — no confirmation dialog | Medium |
| W-AD-6 | Integrations `handleDisconnect` — no confirmation dialog | Medium |
| W-AD-7 | SaaS connect `handleDisconnect` (Stripe) — no AlertDialog | Medium |
| W-AD-8 | SaaS templates `handleDeleteTemplate` — no confirmation dialog | Medium |
| W-AD-9 | SaaS plans `handleDeletePlan` — no confirmation dialog | Medium |
| W-AD-10 | SaaS pricing tables `handleDeleteTable` — no confirmation dialog | Medium |
| W-AD-11 | Automations `handleDeleteRecipe` — no confirmation dialog | Medium |

### Marketing Site (2 warnings, from 12 reported — excluding metadata/placeholder issues below)
| # | Issue | Severity |
|---|-------|----------|
| W-MK-1 | About page has visible "placeholder team members" disclaimer with fake names | Medium |
| W-MK-2 | Footer social links (LinkedIn, X) are `<span>` elements, not clickable | Low |

### Integration (5 warnings)
| # | Issue | Severity |
|---|-------|----------|
| W-INT-1 | OAuth callback causes unnecessary double-redirect for client users | Low |
| W-INT-2 | `TWILIO_PHONE_NUMBER` vs `TWILIO_FROM_NUMBER` naming split is confusing | Low |
| W-INT-3 | All cron schedules are hourly — consider if usage-alerts needs different frequency | Low |
| W-INT-4 | Phone number purchase does not roll back on partial Retell failure | Medium |
| W-INT-5 | Stripe webhook invite link `redirectTo` path should be verified | Low |

---

## 4. Marketing Metadata & Placeholder Issues

These were flagged as "blockers" by the marketing auditor but are more accurately **pre-launch cleanup items** — they don't break functionality or security, but affect SEO and professional appearance:

| # | Issue | Impact |
|---|-------|--------|
| M-1 | Homepage, Features, Pricing, Contact pages missing metadata exports ("use client" pages) | SEO — pages fall back to root layout title "Invaria Labs" |
| M-2 | All 5 auth pages missing metadata exports ("use client" pages) | Browser tab shows generic title |
| M-3 | Root layout metadata too generic ("Invaria Labs" / "Voice AI Platform") | SEO fallback quality |
| M-4 | Contact page placeholder phone "(888) 555-0199" visible with "Placeholder number" text | Professional appearance |
| M-5 | Contact page "Calendly integration coming soon" visible | Professional appearance |
| M-6 | Contact form `message` field not required in HTML but required by API (validation mismatch) | UX — user gets 400 with no explanation |
| M-7 | `escapeHtml` missing single-quote escaping | Minor XSS hardening (not exploitable in current HTML context) |

**Recommended fix for M-1/M-2/M-3:** Add `generateMetadata` in layout files or refactor "use client" pages to extract metadata into server components.

---

## 5. Cosmetic Issues (13 total)

### Client Portal (4)
- Billing page uses spinner instead of skeleton cards
- Settings/business page has no page-level loading skeleton
- Automations page uses spinner instead of skeleton
- Conversation flows template section duplicates card rendering logic

### Marketing (7)
- Terms page uses `<a>` instead of `<Link>` for internal `/privacy` link
- Privacy/Terms pages use `sales@` email, contact page uses `hello@` (inconsistent)
- Pricing page has hardcoded "February 2026" in calendar visual
- Features page has hardcoded "February 2026" in calendar visual
- 404 page uses shadcn theme variables that may not match marketing palette
- Features page comment numbering error (says "FEATURE 12" should be "FEATURE 14")

### Integration (2)
- `customer.subscription.updated` handled but not listed in switch comment
- Demo call uses `RETELL_FROM_NUMBER` while SMS uses `TWILIO_FROM_NUMBER` (intentional but confusing naming)

---

## 6. What Looks Good

- **All 7 original blocker fixes verified working** — no regressions
- **Middleware is correct** — client/startup role separation works, slug validation works, no route leaking
- **Feature gate two-layer check** (client_access + plan fallback) works correctly
- **All admin pages have loading states, error handling, and empty states**
- **All client portal pages have loading states and (mostly) proper error handling**
- **Pagination works correctly** on all 5 admin tables with proper filter resets
- **Privacy/Terms pages** have real legal content (not placeholder), correct metadata, working footer links
- **Login role-aware redirect** eliminates the flash for client users
- **Stripe webhook handlers** are comprehensive with proper signature verification
- **Retell webhook handler** is comprehensive with post-call automation pipeline
- **Phone number lifecycle** (Twilio → SIP → Retell → Hiya → DB) is complete
- **No hardcoded secrets** found anywhere in source
- **No `dangerouslySetInnerHTML`** usage found
- **All internal links verified** — no dead `href="#"` remaining
- **Billing pages** properly guard for Stripe connection state

---

## 7. Action Items (Priority Order)

### Must fix before launch
1. **NEW-B1:** Add `publicEndpointLimiter` to `/api/contact` route
2. **NEW-B2:** Add `/api/cron/usage-alerts` to `vercel.json` crons

### Should fix before launch (professional appearance)
3. **M-4 + M-5:** Remove placeholder content from contact page (fake phone, "coming soon" text)
4. **M-1:** Add metadata to homepage (most important page for SEO)
5. **M-6:** Add `required` attribute to contact form `message` textarea
6. **W-MK-1:** Remove or replace fake team members on about page

### Should fix in fast-follow
7. **W-CP-1:** Add `DialogDescription` to 10+ dialogs for accessibility
8. **W-CP-2:** Add toast on dashboard fetch error
9. **W-CP-4 + W-AD-3–11:** Replace `window.confirm()` with `AlertDialog` on all destructive actions (16 instances across admin + client portal)
10. **W-CP-3:** Replace hardcoded "Active" badge with actual agent status

---

## 8. Audit Coverage

| Property | Pages/Components Audited | API Routes Verified |
|----------|--------------------------|---------------------|
| Marketing Site | 33 | 4 |
| Admin Dashboard | 28 pages | — |
| Client Portal | 20+ pages | — |
| Integration Flows | — | 11 flows end-to-end |
| Blocker Verification | 7 fixes | — |

**Total: 80+ pages/components, 15+ API routes, 11 integration flows**

---

## 9. Comparison to First Audit

| Metric | First Audit | Second Audit |
|--------|-------------|--------------|
| Blockers | 8 (1 false positive) | 2 new |
| Original blockers remaining | 7 | 0 |
| Verdict | DO NOT SHIP | CONDITIONAL SHIP |
| Confidence | 6/10 | 7.5/10 |

The two remaining new blockers (rate limiting + cron config) are straightforward 5-minute fixes. Once applied, the platform is launch-ready with the understanding that the warning-level items (especially confirmation dialogs and metadata) should be addressed in the first post-launch sprint.
