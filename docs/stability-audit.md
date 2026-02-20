# Invaria Labs Platform -- Stability Audit

**Date:** 2026-02-20
**Scope:** Full codebase audit across 5 dimensions -- runtime errors, imports/exports, API matching, schema verification, environment variables
**Mode:** Read-only documentation -- no code was modified

---

## Executive Summary

| Dimension | Findings | Critical | High | Medium | Low |
|-----------|----------|----------|------|--------|-----|
| 1. Runtime Errors & UI | 22 | 3 | 5 | 8 | 6 |
| 2. Imports & Exports | 35 | 0 | 0 | 16 | 19 |
| 3. API Route Matching | 4 | 0 | 1 | 0 | 3 |
| 4. DB Schema vs Code | 19 | 4 | 4 | 4 | 7 |
| 5. Environment Variables | 7 | 0 | 0 | 4 | 3 |
| **Total** | **87** | **7** | **10** | **32** | **38** |

**Key risks:**
- 4 critical schema mismatches (missing RPC function, NOT NULL violations on user creation, broken upsert constraint)
- 3 critical `useSearchParams()` without `<Suspense>` boundary (will crash pages)
- 16 of 28 fields in `business_settings` PATCH allowlist reference non-existent columns (silent data loss)
- `RETELL_TOOLS_API_KEY` missing from `.env.local` (all agent tool integrations broken)
- `saas/connect` page still creates duplicate Stripe accounts on "Update" click

---

## Section 1: Runtime Errors, Failed Requests & Broken UI States

### Critical (3)

**1.1 `useSearchParams()` without `<Suspense>` boundary (3 pages)**

Next.js App Router requires `useSearchParams()` to be wrapped in a `<Suspense>` boundary.

| File | Impact |
|------|--------|
| `src/app/(auth)/signup/page.tsx` | Build error or hydration crash |
| `src/app/(portal)/[clientSlug]/portal/automations/page.tsx` | Build error or hydration crash |
| `src/app/(portal)/[clientSlug]/portal/agents/[id]/conversations/page.tsx` | Build error or hydration crash |

### High (5)

**1.2 Supabase client at component scope with unstable dep arrays**

| File | Issue |
|------|-------|
| `src/app/(startup)/agents/[id]/ai-analysis/page.tsx:19` | `createClient()` in dep array causes infinite re-renders |
| `src/app/(startup)/agents/[id]/widget/page.tsx:58` | Same issue |

**1.3 Missing try/catch around fetch calls**

| File | Function |
|------|----------|
| `src/app/(auth)/forgot-password/page.tsx` | `handleSubmit` |
| `src/app/(startup)/agents/page.tsx` | `handleCreateAgent` |
| `src/app/(startup)/clients/page.tsx` | `handleCreateClient` |
| `src/app/(startup)/settings/integrations/page.tsx` | `handleAddIntegration` / `handleDisconnect` |

**1.4 Dead buttons (no onClick handler)**

| File | Button |
|------|--------|
| `src/app/(startup)/dashboard/page.tsx:371` | "Remove" (custom domain) |
| `src/app/(startup)/settings/whitelabel/page.tsx:454` | "Remove" (domain) |
| `src/app/(startup)/settings/whitelabel/page.tsx:459` | "Launch" (domain) |
| `src/app/(startup)/settings/startup/page.tsx:379` | "Get HIPAA Compliance" |
| `src/app/(startup)/billing/invoices/page.tsx:232` | "Create Invoice" (empty state) |
| `src/app/(startup)/billing/subscriptions/page.tsx:254` | "Create Subscription" (empty state) |

**1.5 Performance: fetching all rows for count**

| File | Issue |
|------|-------|
| `src/app/(startup)/dashboard/page.tsx:107` | Fetches ALL `call_logs` rows with `.select("duration_seconds")` instead of using `{ count: 'exact', head: true }` |

### Medium (8)

| # | File | Issue |
|---|------|-------|
| 1.6 | `src/app/(auth)/login/page.tsx:26` | Variable shadowing: inner `error` shadows state `error` |
| 1.7 | `src/app/(startup)/agents/[id]/agent-config/page.tsx:660` | `CollapsiblePanel` defined inside render -- loses state on re-render |
| 1.8 | `src/app/(startup)/settings/integrations/page.tsx` | No toast feedback on add/disconnect operations |
| 1.9 | `src/app/(startup)/clients/[id]/overview/page.tsx` | `window.confirm` instead of `AlertDialog` for destructive actions |
| 1.10 | `src/app/(startup)/clients/[id]/custom-css/page.tsx:16` | `handleSave` is empty -- "Save CSS" button does nothing |
| 1.11 | `src/app/(startup)/clients/[id]/embed-url/page.tsx:16` | `handleSave` is empty -- "Save Domain" button does nothing |
| 1.12 | `src/app/(startup)/settings/whitelabel/page.tsx:638` | "Send Test Email" button has no onClick |
| 1.13 | Various | Upload areas in startup settings and whitelabel are non-functional placeholders |

### Low (6)

| # | File | Issue |
|---|------|-------|
| 1.14 | Portal dashboard:641 | `window.location.href` instead of `router.push` (full page reload) |
| 1.15 | startup/settings/startup | Dashboard Logo / Login Page Logo uploads are placeholders |
| 1.16 | whitelabel | Favicon / Email Logo uploads not functional (no "Coming Soon" label) |
| 1.17 | settings/usage | Native HTML date inputs instead of styled components |
| 1.18 | custom-css/page.tsx:13 | Unused `params` variable |
| 1.19 | Multiple | `eslint-disable-next-line` suppressions for `any` types (~35 instances) |

---

## Section 2: Imports & Exports

### Broken Imports: **NONE**
- All 190+ source files resolve correctly
- `npx tsc --noEmit` exits 0 (clean)
- No circular dependencies detected

### Dead Modules (8 entire files never imported)

| File | Exports | Why Dead |
|------|---------|----------|
| `src/lib/retell.ts` | 10 Retell SDK wrappers | API routes import `retell-sdk` directly |
| `src/lib/retell-web.ts` | 5 web client wrappers | Hook imports SDK directly via dynamic import |
| `src/components/ui/command.tsx` | 9 command palette components | Installed but never used |
| `src/components/ui/popover.tsx` | 7 popover components | Installed but never used |
| `src/components/marketing/sections/features-showcase.tsx` | `FeaturesShowcase` | Never rendered |
| `src/components/marketing/sections/how-it-works.tsx` | `HowItWorks` | Never rendered |
| `src/components/marketing/sections/testimonials.tsx` | `Testimonials` | Never rendered |
| `src/components/automations/automation-logs-table.tsx` | `AutomationLogsTable` | Never rendered |

### Unused Business Logic Exports (8)

| File | Unused Export |
|------|--------------|
| `src/lib/prompt-generator.ts` | `generatePrompt` (only called internally) |
| `src/lib/stripe.ts` | `getAccount` |
| `src/lib/stripe.ts` | `retrieveCheckoutSession` |
| `src/lib/retell-costs.ts` | `MONTHLY_COSTS` |
| `src/lib/retell-costs.ts` | `AgentCostConfig` |
| `src/hooks/use-agent-config.ts` | `useAgentConfig` |
| `src/hooks/use-supabase.ts` | `useUser` |
| `src/hooks/use-supabase.ts` | `useOrganization` |

### Unused Type Definitions (19)

From `src/types/database.ts`: `UserRole`, `WidgetConfig`, `CampaignConfig`, `ClientAccess`, `StripeConnection`, `ClientAddon`, `OrganizationSettings`, `WhitelabelSettings`, `EmailTemplate`, `WebhookLog`, `CampaignLead`

From `src/types/retell.ts`: `RetellAgent`, `RetellTool`, `RetellCall`, `RetellPhoneNumber`, `RetellWebCallResponse`

From other files: `IndustryData`, `IndustryConfig`, `OAuthProviderConfig`

### Unused Shadcn/ui Sub-exports (40+)
Standard for shadcn/ui installations. Low severity. Full list in `docs/_audit-section-2-imports.md`.

---

## Section 3: Frontend-to-Backend API Matching

**80 backend routes | ~120 frontend fetch() calls | 4 issues found**

### High (1)

**3.1 `saas/connect` page creates duplicate Stripe accounts on "Update"**

- **Frontend:** `src/app/(startup)/saas/connect/page.tsx:163` sends `action: "create_connect_account"`
- **Should send:** `action: "create_account_link"` with existing `stripeAccountId`
- **Impact:** New Stripe account created on every "Update" click
- **Note:** `billing/connect/page.tsx:192` does this correctly -- only `saas/connect` is wrong

### Low (2)

**3.2** Portal billing checkout doesn't send `billing_period` -- defaults all portal checkouts to monthly pricing.

**3.3** `call-handling-settings.tsx` sends `post_call_email` / `post_call_text` but DB columns may be `post_call_email_summary` / `post_call_followup_text` -- silent data loss.

### Info (1)

**3.4** `/api/business-settings/regenerate-prompt` has no frontend caller (called directly from other backend routes).

### Orphaned Routes (10 -- all by design)
Webhooks (Stripe, Retell), cron jobs, Retell tool endpoints, Zapier hooks. Full list in `docs/_audit-section-3-api.md`.

### Missing Routes: **NONE**

---

## Section 4: Database Schema vs Code

**462+ Supabase query call sites audited against 31 migration files**

### Critical (4)

**4.1 `increment_field` RPC does not exist**
- **File:** `src/app/api/onboarding/test-call/route.ts:43`
- **Impact:** RPC fails every test call (has working fallback, but wastes a round-trip and logs errors)

**4.2 `users` table insert missing NOT NULL `name` (Stripe webhook)**
- **File:** `src/app/api/webhooks/stripe/route.ts:304`
- **Impact:** New client provisioning via Stripe checkout fails with NOT NULL violation

**4.3 `users` table insert missing NOT NULL `name` (auth invite)**
- **File:** `src/app/api/auth/route.ts:134`
- **Impact:** Team member invite user creation fails

**4.4 `client_access` upsert uses wrong constraint**
- **File:** `src/app/api/webhooks/stripe/route.ts:343` and `clients/[id]/client-access/page.tsx:182`
- **Specifies:** `onConflict: "client_id,feature"` (2-column)
- **Actual constraint:** `UNIQUE(client_id, agent_id, feature)` (3-column)
- **Impact:** Upserts always INSERT, creating duplicate rows

### High (4)

**4.5 `business_settings` PATCH allowlist: 16 of 28 fields don't exist**
- **File:** `src/app/api/business-settings/route.ts:54-63`
- Names like `contact_phone`, `website_url`, `address` don't match actual columns (`business_phone`, `business_website`, `business_address`)
- **Impact:** Silent data loss on PATCH requests

**4.6 Onboarding step 4 writes non-existent columns to `business_settings`**
- **File:** `src/app/api/onboarding/step/[step]/route.ts:113`
- Sends `post_call_email_summary` and `post_call_followup_text` (not valid columns on `business_settings`)
- **Impact:** Step 4 save returns 500

**4.7 Contact info from onboarding not saved to `business_settings`**
- `contact_name` and `contact_email` only saved to `client_onboarding`, not `business_settings`
- **Impact:** Prompt generator and post-call actions can't access contact info

**4.8 TypeScript `Client` type missing `cancelled` and `past_due` status values**
- **File:** `src/types/database.ts:32`
- Added by bugfix migration but type not updated

### Medium (4)

| # | Issue |
|---|-------|
| 4.9 | `WebhookLog` type has non-nullable `organization_id` (schema is now nullable) |
| 4.10 | `Client` type missing 4 columns (`dashboard_color`, `stripe_customer_id`, `stripe_subscription_id`, `plan_id`) |
| 4.11 | `AgentTemplate` type missing 14 migration-added columns |
| 4.12 | `PhoneNumber` type missing caller ID columns (`caller_id_name`, `caller_id_verified`, `cnam_status`) |

### Low (7)

- `Agent` type missing `phone_number` column
- No TypeScript types for 19 tables created after initial schema
- `ClientPlan` type missing 7 feature-gate columns
- Various columns from recent migrations not reflected in types
- Full details in `docs/_audit-section-4-schema.md`

---

## Section 5: Environment Variables

**40 unique variables audited | 7 findings**

### Findings

**5.1 Nine variables referenced in code but missing from `.env.example`**

| Variable | Service | Risk |
|----------|---------|------|
| `CALENDLY_CLIENT_ID` | Calendly OAuth | MEDIUM |
| `CALENDLY_CLIENT_SECRET` | Calendly OAuth | MEDIUM |
| `CRON_SECRET` | Vercel Cron | MEDIUM |
| `TWILIO_ACCOUNT_SID` | Twilio | LOW |
| `TWILIO_AUTH_TOKEN` | Twilio | LOW |
| `TWILIO_PHONE_NUMBER` | Twilio | LOW |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio | LOW |
| `MARKETING_SITE_URL` | Checkout CORS | LOW |
| `QUICKBOOKS_SANDBOX` | QuickBooks | LOW |

**5.2 `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` defined but never used in code** (dead config)

**5.3 `RETELL_TOOLS_API_KEY` missing from `.env.local`**
- All Retell custom tool endpoints reject requests with 401
- Agent tools (calendar, calendly, hubspot) are broken

**5.4 `CRON_SECRET` undocumented and missing**
- Cron endpoints (`daily-digest`, `checkin-email`) always return 401
- Cannot be tested locally

**5.5 OAuth provider credentials are empty strings in `.env.local`**
- Google, Slack, HubSpot OAuth flows will fail with empty client IDs
- Expected for local dev but worth documenting

**5.6 `NEXT_PUBLIC_APP_URL` has inconsistent fallback behavior**

| Fallback | Used in |
|----------|---------|
| `"https://app.invarialabs.com"` | Stripe/Retell webhooks, cron |
| `"https://portal.invarialabs.com"` | register-agent-tools |
| `""` | checkout |
| No fallback (undefined) | OAuth, billing, client billing |

**5.7 No sensitive secrets exposed via `NEXT_PUBLIC_`** -- security is correct.

### Quick Reference

| Status | Count |
|--------|-------|
| Documented + Set | 22 |
| Documented + Missing | 9 (mostly demo agent IDs) |
| Undocumented + Set | 1 (`MARKETING_SITE_URL`) |
| Undocumented + Missing | 8 (Calendly, Twilio, CRON_SECRET, QUICKBOOKS_SANDBOX) |
| Unused | 1 (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) |

---

## Priority Fix Order

### P0 -- Will cause crashes or data corruption
1. **4.2/4.3** -- Add `name` field to user upserts (Stripe webhook + auth invite)
2. **4.4** -- Fix `client_access` upsert constraint (creates duplicate rows)
3. **1.1** -- Wrap `useSearchParams()` in `<Suspense>` (3 pages)
4. **4.5** -- Align `business_settings` PATCH allowlist with actual column names

### P1 -- Silent failures or data loss
5. **4.6** -- Fix onboarding step 4 column names for `business_settings`
6. **4.7** -- Save contact info to `business_settings` during onboarding
7. **3.1** -- Fix `saas/connect` duplicate Stripe account bug
8. **5.3** -- Set `RETELL_TOOLS_API_KEY` in `.env.local`
9. **1.2** -- Move `createClient()` out of component scope or into hooks
10. **1.5** -- Use Supabase count query instead of fetching all rows

### P2 -- Poor UX or dead code
11. **1.4** -- Wire up or remove dead buttons (6 instances)
12. **4.8-4.12** -- Update TypeScript types to match current schema
13. **5.1** -- Add 9 missing variables to `.env.example`
14. **5.6** -- Standardize `NEXT_PUBLIC_APP_URL` fallback behavior
15. Dead modules cleanup (8 files)
16. Unused exports cleanup (8 business logic + 19 types)

---

## Detailed Section Reports

For full findings with line numbers, code snippets, and verification details, see:
- `docs/_audit-section-1-runtime.md` -- Runtime errors, failed requests, broken UI
- `docs/_audit-section-2-imports.md` -- Imports, exports, dead modules
- `docs/_audit-section-3-api.md` -- Frontend-to-backend API matching (with full route inventory)
- `docs/_audit-section-4-schema.md` -- Database schema verification (with verified tables list)
- `docs/_audit-section-5-env.md` -- Environment variables (with full quick-reference table)
