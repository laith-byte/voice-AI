# VERDICT — Final Gate Audit (#6)

## 1. SHIP or DO NOT SHIP

**DO NOT SHIP** — 12 items prevent 10/10. The core product is solid (6/6 journeys pass, auth is 100%, rename is complete, security fundamentals are strong). But direct Supabase mutations persist in 3 more pages we missed, 3 marketing content regressions from audit #5 were never fixed, and build/lint have 8 warnings that need to reach zero.

---

## 2. CONFIDENCE SCORE: 7/10

**What's working (the 7):**
- 6/6 E2E journeys PASS — every real-world user flow traces end-to-end
- 120+ API route handlers all have proper authentication
- Rename COMPLETE — zero stale `/automations` or `/business-settings` routes
- 4 webhook endpoints cryptographically verified
- All public endpoints rate-limited
- Zero hardcoded secrets, zero TODO/FIXME/HACK
- Responsive layouts on all portal pages
- Knowledge Base pre-fills, persists, and propagates to agents
- All 12 integration cards have working Set Up flows
- Phone numbers real (Twilio purchase + SIP + Retell + Hiya)
- .env.example covers all 44 environment variables

**What prevents 10/10 (the 3):**
- 8 more direct Supabase mutations found in pages we didn't fix (agent-settings, ai-analysis, billing, saas)
- 3 marketing content regressions from audit #5 never addressed
- Build has 2 warnings, lint has 6 warnings — must be zero

---

## 3. Every Blocker

### B-1: Agent-settings page — 6 direct Supabase mutations (REGRESSION)
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx`
- **Lines:** 765, 785, 864, 883, 998, 1202
- **Operations:** insert widget_config, insert ai_analysis_config, upsert widget_config, update ai_analysis_config, update agents name (2x)
- **Fix:** Route through existing `/api/agents/[id]/config` or create `/api/agents/[id]/widget-config` PUT and `/api/agents/[id]/ai-analysis` PATCH. Use fetch() on client side.
- **Effort:** ~2h

### B-2: AI-analysis page — 2 direct Supabase mutations
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/ai-analysis/page.tsx`
- **Lines:** 76, 125
- **Operations:** insert ai_analysis_config, update ai_analysis_config
- **Fix:** Create `/api/agents/[id]/ai-analysis-config` with POST/PATCH handlers. Already have requireAuth pattern.
- **Effort:** ~45min

### B-3: Admin pages — 6 direct Supabase mutations
- **Files:**
  - `src/app/(startup)/billing/connect/page.tsx:140` — insert stripe_connections
  - `src/app/(startup)/saas/connect/page.tsx:86` — upsert stripe_connections
  - `src/app/(startup)/saas/pricing-tables/page.tsx:125` — insert pricing_tables
  - `src/app/(startup)/saas/plans/page.tsx:374,482` — insert client_plans (2x)
  - `src/app/(startup)/agents/[id]/ai-analysis/page.tsx:207` — delete topics
- **Fix:** Create API routes: `/api/admin/stripe-connections`, `/api/admin/pricing-tables`, `/api/admin/client-plans`. For ai-analysis topics delete, extend `/api/agents/[id]/topics` DELETE handler.
- **Effort:** ~2h

### B-4: Login form bypasses API route
- **File:** `src/app/(auth)/login/_login-form.tsx:26-32`
- **Issue:** Calls `supabase.auth.signInWithPassword()` directly. Bypasses rate limiting in `/api/auth`. Exposes raw Supabase error messages.
- **Fix:** Replace with `fetch('/api/auth', { method: 'POST', body: { email, password } })`. The API route already exists with rate limiting and sanitized errors.
- **Effort:** ~20min

### B-5: Pricing FAQ still says "automations" (REGRESSION from audit #5)
- **File:** `src/app/(marketing)/pricing/_pricing-content.tsx:142`
- **Text:** `"analytics, AI evaluation, automations, CRM integrations"`
- **Fix:** Change "automations" to "integrations"
- **Effort:** ~2min

### B-6: Contact form industry dropdown is HVAC-era (REGRESSION from audit #5)
- **Files:** `src/app/(marketing)/contact/_contact-content.tsx:7-15`, `src/app/api/contact/route.ts:29`
- **Current:** HVAC, Plumbing, Electrical, Landscaping, Roofing, General, Other
- **Fix:** Update to: Healthcare, Legal, Home Services, Real Estate, Insurance, Financial Services, Automotive, Hospitality, Other. Update both the client dropdown and the server-side allowlist.
- **Effort:** ~10min

### B-7: No server-side email validation on contact form
- **File:** `src/app/api/contact/route.ts`
- **Issue:** Only checks `!email` (presence). `"notanemail"` passes server validation.
- **Fix:** Add regex check: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` or use a validation library.
- **Effort:** ~5min

### B-8: Features page "Coming Soon" contradicts pricing "available" (REGRESSION from audit #5)
- **Files:** `src/app/(marketing)/features/_features-content.tsx:485-506`, `src/components/marketing/sections/platform-features.tsx:207-224`
- **Issue:** Salesforce and GoHighLevel marked "Coming Soon" on features page, but pricing says CRM integrations are available on all plans. The API routes exist and work.
- **Fix:** Remove `comingSoon: true` from Salesforce and GoHighLevel entries. They work via the integration request flow.
- **Effort:** ~5min

### B-9: Stray console.log in conversation-flow route (NOT FIXED from previous audit)
- **File:** `src/app/api/agents/[id]/conversation-flow/route.ts:625`
- **Fix:** Replace `console.log(...)` with `logger.info(...)` or remove.
- **Effort:** ~2min

### B-10: metadataBase not set (NOT FIXED — build warning)
- **File:** `src/app/layout.tsx`
- **Issue:** OG images fall back to `http://localhost:3001`. Next.js emits build warning.
- **Fix:** Add `metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://invarialabs.com')` to the metadata export.
- **Effort:** ~2min

### B-11: 6 ESLint warnings — unused imports (NOT FIXED from previous audit)
- **Files:**
  - `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx` — unused: Shield, Plug, History, BookOpen, piiCategories
  - `src/app/(startup)/integrations/page.tsx` — unused: Phone
- **Fix:** Remove the 6 unused imports.
- **Effort:** ~3min

### B-12: Build warning — middleware convention deprecated
- **Issue:** Next.js 16.1 warns `middleware.ts` should migrate to `proxy` convention.
- **Fix:** This is a framework-level migration. Either suppress the warning or migrate `middleware.ts` to the new proxy convention per Next.js 16.1 docs.
- **Effort:** ~1-2h for full migration, or ~5min to add suppression if Next.js supports it

---

## 4. All 6 Journeys

| # | Journey | Verdict |
|---|---------|---------|
| 1 | Day 1 — Signup (HVAC + Housecall Pro) | **PASS** |
| 2 | Day 1 — First Call (intake + HCP booking) | **PASS** |
| 3 | Day 2 — Jobber User (GraphQL sync) | **PASS** |
| 4 | Day 2 — No CRM User (Google Calendar) | **PASS** |
| 5 | Day 3 — Check Billing (Stripe receipts) | **PASS** |
| 6 | Day 5 — Returning User (edit KB + disconnect/reconnect CRM) | **PASS** |

All 6 journeys trace end-to-end through working code paths. Zero dead ends. Every step has a file:line reference in `docs/final-gate/e2e-journeys.md`.

---

## 5. Every Integration Card — Set Up Works

| Card | Set Up Works? | Flow Type |
|------|---------------|-----------|
| Housecall Pro | YES | Admin request → OAuth |
| Jobber | YES | Admin request → OAuth |
| Salesforce | YES | Admin request |
| GoHighLevel | YES | Admin request |
| Google Calendar | YES | Admin request |
| Google Sheets | YES | Admin request |
| Slack | YES | Admin request |
| HubSpot | YES | Admin request |
| Notion | YES | Admin request |
| QuickBooks | YES | Admin request |
| Webhook | YES | Self-serve (RecipeSetupModal) |
| SMS Reminders | YES | Self-serve (RecipeSetupModal) |

All 12 cards work. 10 use IntegrationRequestModal (admin fulfills), 2 use RecipeSetupModal (self-serve).

---

## 6. Phone Numbers

| Flow | Verdict |
|------|---------|
| Buy Phone Number | **PASS** — Twilio purchase → SIP trunk → Retell import → Hiya registration → DB save. Rollback on failure. |
| Add Pre-existing Number | **PASS** — Client submits request → admin handles import/porting |

Both flows work. Phone number purchase is real (Twilio API, not mocked).

---

## 7. Knowledge Base

| Check | Verdict |
|-------|---------|
| Pre-fill from onboarding | **PASS** — HVAC template seeds services, FAQs, policies, hours |
| Edit every field | **PASS** — BusinessInfoForm + all sub-editors |
| Required field validation | **PASS** — API routes validate required fields |
| Save → reload persistence | **PASS** — All data in DB, fetched fresh |
| Agent uses updated data | **PASS** — Every KB mutation calls regenerateKnowledgeBase() → pushes to Retell |
| Fetch URLs correct | **PASS** — All components use /api/knowledge-base (not /api/business-settings) |

---

## 8. Rename Completeness

### Automations → Integrations: **COMPLETE**
- Route: `/integrations` (not `/automations`) ✓
- API: `/api/integrations/*` ✓
- Components: `src/components/integrations/` ✓
- Sidebar: "Integrations" ✓
- Page title: "Integrations" ✓
- Old routes deleted ✓
- Remaining "automations" in code = DB table names + marketing feature descriptions (acceptable)

### Business Settings → Knowledge Base: **COMPLETE**
- Route: `/knowledge-base` (not `/business-settings`) ✓
- API: `/api/knowledge-base/*` ✓
- Components: `src/components/knowledge-base/` ✓
- Admin tab: "Knowledge Base" ✓
- Page title: "Knowledge Base" ✓
- Old routes deleted ✓
- Remaining "business_settings" in code = DB table name only (acceptable)

---

## 9. Regressions from Previous Audits

| Issue | First Found | Status |
|-------|------------|--------|
| Pricing FAQ "automations" | Audit #5 | **STILL BROKEN** (B-5) |
| Contact form HVAC-era industries | Audit #5 | **STILL BROKEN** (B-6) |
| Features "Coming Soon" inconsistency | Audit #5 | **STILL BROKEN** (B-8) |
| metadataBase not set | Audit #5 | **STILL BROKEN** (B-10) |
| console.log in conversation-flow | Audit #5 | **STILL BROKEN** (B-9) |
| 6 unused imports (ESLint warnings) | Audit #5 | **STILL BROKEN** (B-11) |
| Direct Supabase mutations | Audit #1 | **PARTIALLY FIXED** — 9 pages fixed, but 3 more found (B-1, B-2, B-3) |
| Missing org-scoping | Audit #2 | **FIXED** — all main list pages now have org_id filters |
| Orphaned routes | Audit #2 | **FIXED** — old /automations and /business-settings deleted |
| Broken admin "Set Up" link | Audit #2 | **FIXED** — navigates to correct routes |
| In-memory rate limiter | Audit #5 | **NOT FIXED** (Warning — acceptable for launch, tech debt) |

---

## 10. Warnings and Cosmetic Issues

### Warnings
| # | Issue | File |
|---|-------|------|
| W-1 | Login form not rate-limited (bypasses /api/auth) | login/_login-form.tsx:26 |
| W-2 | In-memory rate limiter no-op on serverless | lib/rate-limit.ts |
| W-3 | client_onboarding query not org-scoped (RLS covers it) | clients/page.tsx:139 |
| W-4 | No admin UI for integration event log drill-down | (API exists, no frontend) |
| W-5 | Client list missing plan/CRM/phone/KB columns | clients/page.tsx |
| W-6 | No column sorting on admin tables | clients, agents pages |
| W-7 | No pagination on phone number tables | phone-sip/page.tsx |
| W-8 | console.log in Twilio fallback logs SMS body | lib/twilio.ts:17 |
| W-9 | Sub-pages use generic OG image fallback only | All marketing sub-pages |
| W-10 | Billing comparison says "Automations & Integrations" | billing/page.tsx:191 |
| W-11 | Phone number purchase has no E.164 format validation | phone-numbers/purchase/route.ts |
| W-12 | "Acme Business" in branded caller ID mockups | pricing, features content |
| W-13 | Privacy policy uses sales@ for data requests | privacy/page.tsx:90 |

### Cosmetic
| # | Issue | File |
|---|-------|------|
| C-1 | Function names still say "Automations" (internal) | integrations/page.tsx:93,143 |
| C-2 | HTML comments say "Active Automations" | integrations/page.tsx:384,406 |
| C-3 | Component file named active-automation-card.tsx | components/integrations/ |
| C-4 | Delete dialog says "Delete Automation" | integrations/page.tsx:527 |
| C-5 | Empty state says "No automation recipes yet" | integrations/page.tsx:489 |
| C-6 | Comparison table not mobile-optimized (grid-cols-4) | marketing comparison.tsx |
| C-7 | Pricing feature table not mobile-optimized | _pricing-content.tsx:951 |

---

## 11. EXACTLY WHAT TO FIX FOR 10/10

Numbered in priority order. Do these in sequence. Total estimated effort: ~7-8 hours.

### Quick wins first (~30 min total):

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | Change "automations" to "integrations" in pricing FAQ | `src/app/(marketing)/pricing/_pricing-content.tsx:142` | 2 min |
| 2 | Remove `comingSoon: true` from Salesforce and GoHighLevel | `src/app/(marketing)/features/_features-content.tsx:485-506`, `src/components/marketing/sections/platform-features.tsx:207-224` | 5 min |
| 3 | Update contact form industries to: Healthcare, Legal, Home Services, Real Estate, Insurance, Financial Services, Automotive, Hospitality, Other | `src/app/(marketing)/contact/_contact-content.tsx:7-15` AND `src/app/api/contact/route.ts:29` (update both) | 10 min |
| 4 | Add email format validation to contact API | `src/app/api/contact/route.ts` — add `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))` check | 5 min |
| 5 | Replace `console.log` with `logger.info` in conversation-flow route | `src/app/api/agents/[id]/conversation-flow/route.ts:625` | 2 min |
| 6 | Add `metadataBase: new URL('https://invarialabs.com')` to root layout metadata | `src/app/layout.tsx` | 2 min |
| 7 | Remove 6 unused imports | `agent-settings/page.tsx` (Shield, Plug, History, BookOpen, piiCategories), `integrations/page.tsx` (Phone) | 3 min |

### Login form fix (~20 min):

| # | Fix | File | Effort |
|---|-----|------|--------|
| 8 | Replace `supabase.auth.signInWithPassword()` with `fetch('/api/auth', ...)` | `src/app/(auth)/login/_login-form.tsx:25-35` — the API route at `/api/auth/route.ts` already handles login with rate limiting and sanitized errors. Replace the direct Supabase call with a fetch to this route. | 20 min |

### Direct Supabase mutation fixes (~5h):

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 9 | Move agent-settings mutations to API routes | `agent-settings/page.tsx` lines 765, 785, 864, 883, 998, 1202. Create handlers in existing `/api/agents/[id]/widget-config` PUT and new `/api/agents/[id]/ai-analysis-config` POST/PATCH. Agent name update can go through existing `/api/agents/[id]` PATCH. | 2h |
| 10 | Move ai-analysis page mutations to API route | `ai-analysis/page.tsx` lines 76, 125. Create `/api/agents/[id]/ai-analysis-config` route if not done in #9. | 45 min |
| 11 | Move admin billing/saas mutations to API routes | `billing/connect/page.tsx:140`, `saas/connect/page.tsx:86`, `saas/pricing-tables/page.tsx:125`, `saas/plans/page.tsx:374,482`. Create `/api/admin/stripe-connections` POST, `/api/admin/pricing-tables` POST, `/api/admin/client-plans` POST. | 2h |

### Middleware migration (~1-2h):

| # | Fix | File | Effort |
|---|-----|------|--------|
| 12 | Migrate middleware.ts to Next.js 16.1 "proxy" convention | `src/middleware.ts` + `src/lib/supabase/middleware.ts` — follow Next.js migration guide. OR: if the warning can be suppressed via next.config.ts, do that as a stopgap. | 1-2h |

### After all fixes:

| # | Verify | Command |
|---|--------|---------|
| 13 | Build with zero warnings | `npm run build 2>&1 \| grep -c "⚠"` must return 0 |
| 14 | Lint with zero warnings | `npm run lint` must show 0 problems |
| 15 | Grep for direct mutations | `grep -r "supabase\.from.*\.\(insert\|update\|upsert\|delete\)" src/app --include="*.tsx" -l` — zero hits in "use client" files |

**When all 15 items pass: 10/10. Ship it.**
