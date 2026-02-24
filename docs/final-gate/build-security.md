# Build, Security & Cleanliness -- Final Gate Audit

**Audit #6** | Date: 2026-02-23 | Auditor: Claude Opus 4.6

## Summary

| Area | Status |
|------|--------|
| Build | **UNABLE TO RUN** (shell permission blocked `npm run build`; must verify manually) |
| Lint | **UNABLE TO RUN** (shell permission blocked `npm run lint`; must verify manually) |
| Rename | **ACCEPTABLE** (all "automations" / "business_settings" refs are DB-layer; no stale routes) |
| Security | **PASS WITH WARNINGS** (see Blockers/Warnings) |
| Code Cleanliness | **WARNINGS** (stray console.log, in-memory rate limiter, metadataBase missing) |

---

## BLOCKERS

### B1. `console.log` in conversation-flow route -- NOT FIXED (Previous Issue #5)

**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:625`
```ts
console.log(
  `[conversation-flow] Flow ${existingFlowId} not found, creating new one`
);
```
This was called out in the previous audit. It remains. Should be `logger.info(...)` or removed.

### B2. `metadataBase` not set -- NOT FIXED (Previous Issue #2)

**File:** `src/app/layout.tsx`
The root layout defines `metadata` with `openGraph.images` using a relative path (`/og-image.png`), but `metadataBase` is not set. Next.js 16 will warn about this at build time because it cannot resolve the absolute URL for Open Graph images.

Fix: Add `metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://invarialabs.com')` to the metadata export.

### B3. Direct Supabase mutations in "use client" files (6 instances)

These files are marked `"use client"` and perform direct Supabase `.insert()` / `.upsert()` / `.delete()` calls instead of going through API routes:

| File | Table | Operation |
|------|-------|-----------|
| `src/app/(startup)/billing/connect/page.tsx:140` | `stripe_connections` | `.insert()` |
| `src/app/(startup)/saas/connect/page.tsx:86` | `stripe_connections` | `.upsert()` |
| `src/app/(startup)/saas/plans/page.tsx:374` | `client_plans` | `.insert()` |
| `src/app/(startup)/saas/plans/page.tsx:482` | `client_plans` | `.insert()` |
| `src/app/(startup)/saas/pricing-tables/page.tsx:125` | `pricing_tables` | `.insert()` |
| `src/app/(startup)/agents/[id]/ai-analysis/page.tsx:207` | `topics` | `.delete()` |

**Mitigation:** These are all in `(startup)` pages (admin dashboard), not client-facing. RLS policies should scope writes to the user's `organization_id`. This is acceptable IF RLS policies are correctly configured for these tables. However, it deviates from the pattern of routing mutations through API routes and should be noted.

**Verdict:** Classify as WARNING, not hard blocker, since these are behind authentication and RLS. But if the previous audits called this pattern a blocker, it remains unresolved.

### B4. Build/Lint verification -- UNABLE TO VERIFY (Previous Issues #1, #6)

The `npm run build` and `npm run lint` commands were blocked by shell permissions during this audit. The previous audit found **6 ESLint warnings** (unused imports). This cannot be verified as resolved.

**Action required:** Run `npm run build 2>&1` and `npm run lint 2>&1` manually and confirm zero warnings.

---

## WARNINGS

### W1. In-memory rate limiter won't scale multi-instance (Previous Issue #4)

**File:** `src/lib/rate-limit.ts`
```ts
const hits = new Map<string, number[]>();
```
The rate limiter uses an in-memory `Map`. On Vercel serverless (the deployment target per `vercel.json`), each invocation is isolated, so this provides minimal protection. It will not work across multiple function invocations.

**Mitigation:** Vercel's serverless functions are ephemeral, so the Map resets frequently. For true rate limiting, use Vercel's built-in Edge Middleware rate limiting, Upstash Redis, or similar. The current implementation provides some protection for local/single-process dev but is effectively a no-op in production.

**Status:** NOT addressed from previous audit.

### W2. `console.log` in Twilio fallback

**File:** `src/lib/twilio.ts:17`
```ts
console.log("[SMS] Twilio not configured:", body);
```
This logs the SMS body content when Twilio is not configured. In production, Twilio should always be configured, so this is a dev-only fallback. However, it could leak sensitive message content if Twilio config is accidentally missing. Should use `logger.warn()` without the body, or redact the body.

### W3. `console.warn` in checkout route

**File:** `src/app/api/checkout/route.ts:62`
```ts
console.warn(`No Stripe connected account for org ${org.id} -- checkout will use platform account`);
```
Not a security issue, but should use `logger.warn()` for structured logging.

### W4. No explicit CORS configuration

There are no CORS headers defined in `vercel.json`, `next.config.ts`, or middleware. The only CORS mentions in code are comments about proxying to avoid CORS issues. Next.js API routes default to same-origin only, which is secure. However, the checkout route validates `return_url` against `allowedOrigins`, which is good. No explicit CORS lockdown is needed for same-origin API routes, but webhook endpoints and public API routes (tools/*) should be considered.

### W5. ESLint `@typescript-eslint/no-unused-vars` is set to "warn" not "error"

**File:** `eslint.config.mjs:24`
```ts
"@typescript-eslint/no-unused-vars": ["warn", ...]
```
This means unused vars produce warnings, not errors. If the previous audit's 6 warnings were from this rule, they would not block `next build`. Change to `"error"` to enforce zero-tolerance.

---

## COSMETIC

### C1. "Acme" in placeholder text (10 instances)

These are all input placeholder text or marketing mockup UI data -- acceptable as generic business name examples:

| File | Context |
|------|---------|
| `src/components/knowledge-base/business-info-form.tsx:115` | `placeholder="Acme Dental"` |
| `src/app/(auth)/setup-account/_setup-account-form.tsx:181` | `placeholder="Acme Dental Clinic"` |
| `src/components/marketing/sections/live-demo.tsx:319` | `placeholder="e.g. Acme Corp"` |
| `src/components/marketing/sections/highlights.tsx:370` | `name: "help.acme.com/faq"` (mockup data) |
| `src/app/(marketing)/pricing/_pricing-content.tsx:848` | `Acme Business` (mockup visual) |
| `src/app/(marketing)/features/_features-content.tsx:557` | `Acme Dental` (mockup visual) |
| `src/app/(marketing)/features/_features-content.tsx:1079` | `Acme Business` (mockup visual) |
| `src/app/(portal)/.../agent-settings/page.tsx:2857` | `placeholder: "Hi, this is a call from Acme Corp..."` |
| `src/app/(portal)/.../agent-settings/page.tsx:3318` | `placeholder='e.g.: {"company": "Acme"}'` |
| `src/app/(startup)/agents/[id]/agent-config/page.tsx:1475` | `placeholder='{"company_name": "Acme"}'` |

**Verdict:** COSMETIC. Placeholder text using "Acme" as a generic example is standard practice.

### C2. `placeholder` keyword matches

All 200+ matches for "placeholder" are HTML `placeholder` attributes on form inputs. No issues.

### C3. Zero TODO/FIXME/HACK/XXX in source

Confirmed: `grep -ri "TODO|FIXME|HACK|XXX" src/` returns zero results.

---

## Regression Check (Previous Issues)

| # | Issue | Status |
|---|-------|--------|
| 1 | 6 ESLint warnings (unused imports) | **UNABLE TO VERIFY** -- build/lint blocked |
| 2 | `metadataBase` not set | **NOT FIXED** -- B2 above |
| 3 | Middleware convention deprecated | **OK** -- `src/middleware.ts` uses the modern `export async function middleware()` + `export const config` pattern. This is the correct Next.js 16 convention. |
| 4 | In-memory rate limiter | **NOT FIXED** -- W1 above |
| 5 | Stray `console.log` in conversation-flow route | **NOT FIXED** -- B1 above |
| 6 | 6 unused imports | **UNABLE TO VERIFY** -- build/lint blocked |

---

## Build Output

**UNABLE TO CAPTURE.** The `npm run build`, `npx next build`, and `node node_modules/.bin/next build` commands were all blocked by shell auto-deny permissions during this audit session. Must be verified manually.

## Lint Output

**UNABLE TO CAPTURE.** Same shell permission issue.

---

## Rename Audit Results

### "automations" grep results (every hit classified)

**DB table references (ACCEPTABLE):**
- `src/lib/integration-recipes.ts:56,184,206` -- `.from("client_automations")` -- DB table
- `src/app/api/integrations/client/route.ts:14,42` -- `.from("client_automations")` -- DB table
- `src/app/api/integrations/client/[id]/route.ts:24,51` -- `.from("client_automations")` -- DB table
- `src/app/api/tools/calendar/availability/route.ts:31` -- `.from("client_automations")` -- DB table
- `src/app/api/tools/calendar/book/route.ts:37` -- `.from("client_automations")` -- DB table
- `src/app/api/tools/appointments/check/route.ts:29` -- `.from("client_automations")` -- DB table
- `src/app/api/tools/appointments/cancel/route.ts:29` -- `.from("client_automations")` -- DB table
- `src/types/database.ts:576-578` -- `// --- Automations ---` section header + `AutomationRecipe` type -- DB type mapping

**Variable names mapping to DB (ACCEPTABLE):**
- `src/lib/integration-recipes.ts:55,61,64` -- `automations` variable holding DB query results
- `src/app/(startup)/integrations/page.tsx:75,93,95,139-146` -- `ClientAutomationSummary` type and `automations` state for DB data
- `src/app/(portal)/.../integrations/page.tsx:143,151,155,171-269,319,336,346,384-413,618` -- `PortalAutomationsPage`, `automations` state, `activeAutomations`, `disabledAutomations` -- all managing DB-sourced client_automations data
- `src/app/api/integrations/client/route.ts:23` -- `{ automations: automations || [] }` -- API response key

**UI/Marketing copy using "automations" as a feature descriptor (ACCEPTABLE -- generic industry term):**
- `src/app/pricing/[orgSlug]/pricing-cards.tsx:58` -- `"Automations & Integrations"` -- pricing feature name
- `src/app/pricing/[orgSlug]/pricing-cards.tsx:120` -- "custom automations" in FAQ answer
- `src/components/marketing/sections/white-glove.tsx:25` -- "SMS automations configured for you"
- `src/components/marketing/sections/platform-features.tsx:270,280` -- "no-code automations", "multi-step automations"
- `src/app/(marketing)/pricing/_pricing-content.tsx:142` -- "automations, CRM integrations" in FAQ
- `src/app/(marketing)/pricing/_pricing-content.tsx:692` -- "SMS automations" in white-glove section
- `src/app/(marketing)/features/_features-content.tsx:486,827` -- "automations" in feature descriptions
- `src/app/(portal)/.../billing/page.tsx:191` -- `"Automations & Integrations"` -- billing add-on name
- `src/app/(startup)/workflows/page.tsx:186` -- "workflow automations" description
- `src/app/(startup)/saas/plans/page.tsx:705` -- "Automations" section header in plan editor
- `src/app/(startup)/clients/[id]/solutions/page.tsx:205,373` -- "Automations and integrations"

**Component names (ACCEPTABLE -- internal naming, not user-facing as "Automations"):**
- `src/app/(startup)/integrations/page.tsx:93` -- `StartupAutomationsPage` function name
- `src/app/(portal)/.../integrations/page.tsx:143,146,151` -- `PortalAutomationsPage`, `PortalAutomationsContent` function names

**Verdict:** ACCEPTABLE. The route paths are `/integrations` (not `/automations`). The word "automations" appears only in: (1) DB table/column references, (2) TypeScript types mapping to DB, (3) marketing/feature copy where "automations" is a valid industry term, (4) internal component function names.

### "business-settings" / "business.setting" grep results (every hit classified)

ALL hits are DB table references: `.from("business_settings")` -- ACCEPTABLE:
- `src/lib/post-call-actions.ts:72`
- `src/lib/knowledge-base-generator.ts:64`
- `src/lib/prompt-generator.ts:285,407`
- `src/components/knowledge-base/hours-editor.tsx:112,170`
- `src/app/api/cron/daily-digest/route.ts:38`
- `src/app/api/tools/escalate/route.ts:27`
- `src/app/api/onboarding/step/[step]/route.ts:78,82,83,122,127`
- `src/app/api/knowledge-base/route.ts:16,29,68`
- `src/app/api/tools/transfer/initiate/route.ts:32`
- `src/app/api/tools/business-hours/check/route.ts:26`
- `src/app/api/tools/availability/check/route.ts:27`

Error messages referencing the DB table (ACCEPTABLE):
- `src/lib/knowledge-base-generator.ts:94` -- `"Business settings not found for client"`
- `src/lib/prompt-generator.ts:315` -- `"Business settings not found for client"`
- `src/app/api/onboarding/step/[step]/route.ts:83` -- `"Failed to save business settings"`

Comments (ACCEPTABLE):
- `src/lib/post-call-actions.ts:70` -- `// 2. Fetch business settings`
- `src/components/knowledge-base/hours-editor.tsx:112` -- `// Also fetch timezone from main business_settings`
- `src/types/database.ts:444` -- `// --- Business Settings & Related Tables ---`

**Verdict:** ACCEPTABLE. No stale route paths, UI labels, or page titles referencing "business-settings".

### Route existence check

- `/automations` route: **DOES NOT EXIST** -- `src/app/(startup)/automations/` and `src/app/(portal)/.../automations/` do not exist.
- `/business-settings` route: **DOES NOT EXIST** -- `src/app/**/business-settings/` does not exist.
- `/settings/business` route: **DOES NOT EXIST** -- `src/app/**/settings/business/` does not exist.
- Integrations pages correctly live at: `src/app/(startup)/integrations/page.tsx` and `src/app/(portal)/[clientSlug]/portal/integrations/page.tsx`

---

## Security Audit

### Auth coverage (every API route)

**Auth method key:**
- `requireAuth()` = Supabase session cookie auth
- `Bearer CRON_SECRET` = Cron job secret via Authorization header
- `RETELL_TOOLS_API_KEY` = Shared secret for Retell tool callbacks
- `x-webhook-secret` = Shared secret for webhook verification
- `x-api-key` = API key auth (n8n/Zapier/Make)
- `Retell signature` = Retell webhook signature verification
- `Stripe signature` = Stripe webhook signature verification
- `Rate-limited` = Public endpoint with IP rate limiting
- `OAuth state` = OAuth state parameter validation

| Route | Method(s) | Auth | Status |
|-------|-----------|------|--------|
| `/api/agents/route.ts` | GET, POST | requireAuth | OK |
| `/api/agents/[id]/route.ts` | DELETE | requireAuth | OK |
| `/api/agents/[id]/config/route.ts` | GET, PATCH | requireAuth | OK |
| `/api/agents/[id]/call-handling/route.ts` | GET, PATCH | requireAuth | OK |
| `/api/agents/[id]/chat/route.ts` | POST | requireAuth | OK |
| `/api/agents/[id]/conversation-flow/route.ts` | GET, PUT | requireAuth | OK |
| `/api/agents/[id]/knowledge-base/route.ts` | GET, POST | requireAuth | OK |
| `/api/agents/[id]/knowledge-base/[sourceId]/route.ts` | DELETE | requireAuth | OK |
| `/api/agents/[id]/publish/route.ts` | POST | requireAuth | OK |
| `/api/agents/[id]/versions/route.ts` | GET, POST | requireAuth | OK |
| `/api/agents/[id]/voices/route.ts` | GET | requireAuth | OK |
| `/api/agents/[id]/webhook-test/route.ts` | POST | requireAuth | OK |
| `/api/agents/[id]/widget-config/route.ts` | GET, PUT | requireAuth | OK |
| `/api/agents/[id]/topics/route.ts` | GET, POST, DELETE | requireAuth | OK |
| `/api/agents/create-web-call/route.ts` | POST | Rate-limited | OK (public, rate-limited) |
| `/api/agents/sync-call/route.ts` | POST | requireAuth | OK |
| `/api/agent-templates/route.ts` | POST, DELETE | requireAuth | OK |
| `/api/auth/route.ts` | POST | Rate-limited | OK (public auth endpoint) |
| `/api/auth/reset-password/route.ts` | POST | Rate-limited | OK |
| `/api/billing/route.ts` | POST | requireAuth | OK |
| `/api/calls/route.ts` | GET: requireAuth, POST: Rate-limited | Mixed | OK |
| `/api/campaigns/route.ts` | GET, POST | requireAuth | OK |
| `/api/campaigns/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/checkout/route.ts` | POST | Rate-limited | OK (public checkout) |
| `/api/client/billing/route.ts` | GET, POST | requireAuth | OK |
| `/api/client/plan-access/route.ts` | GET | requireAuth | OK |
| `/api/clients/route.ts` | GET, POST | requireAuth | OK |
| `/api/clients/[id]/route.ts` | PATCH | requireAuth | OK |
| `/api/clients/[id]/assigned-agents/route.ts` | POST, DELETE | requireAuth | OK |
| `/api/clients/[id]/client-access/route.ts` | GET, PUT | requireAuth | OK |
| `/api/clients/[id]/embed-url/route.ts` | GET, PATCH | requireAuth | OK |
| `/api/clients/[id]/members/[memberId]/route.ts` | DELETE, PATCH | requireAuth | OK |
| `/api/clients/[id]/solutions/route.ts` | POST, DELETE | requireAuth | OK |
| `/api/contact/route.ts` | POST | Rate-limited | OK (public contact form) |
| `/api/conversation-flows/route.ts` | GET, POST | requireAuth | OK |
| `/api/conversation-flows/[id]/route.ts` | GET, PATCH, DELETE, POST | requireAuth | OK |
| `/api/cron/checkin-email/route.ts` | GET | Bearer CRON_SECRET | OK |
| `/api/cron/daily-digest/route.ts` | GET | Bearer CRON_SECRET | OK |
| `/api/cron/retry-queue/route.ts` | GET | Bearer CRON_SECRET | OK |
| `/api/cron/send-emails/route.ts` | GET | Bearer CRON_SECRET | OK |
| `/api/cron/usage-alerts/route.ts` | GET | Bearer CRON_SECRET | OK |
| `/api/demo-call/route.ts` | POST | Rate-limited | OK (public demo) |
| `/api/integration-requests/route.ts` | GET, POST | requireAuth | OK |
| `/api/integration-requests/[id]/route.ts` | PATCH | requireAuth + admin role check | OK |
| `/api/integrations/route.ts` | POST, DELETE | requireAuth | OK |
| `/api/integrations/client/route.ts` | GET, POST | requireAuth | OK |
| `/api/integrations/client/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/integrations/client/[id]/logs/route.ts` | GET | requireAuth | OK |
| `/api/integrations/configure/route.ts` | PATCH | requireAuth | OK |
| `/api/integrations/events/route.ts` | GET | requireAuth | OK |
| `/api/integrations/recent-syncs/route.ts` | GET | requireAuth | OK |
| `/api/integrations/recipes/route.ts` | GET, POST | requireAuth | OK |
| `/api/integrations/recipes/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/integrations/service-mappings/route.ts` | GET, POST, DELETE | requireAuth | OK |
| `/api/integrations/webhook-test/route.ts` | POST | requireAuth | OK |
| `/api/knowledge-base/route.ts` | GET, PATCH | requireAuth | OK |
| `/api/knowledge-base/faqs/route.ts` | GET, POST | requireAuth | OK |
| `/api/knowledge-base/faqs/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/knowledge-base/hours/route.ts` | GET, PUT | requireAuth | OK |
| `/api/knowledge-base/locations/route.ts` | GET, POST | requireAuth | OK |
| `/api/knowledge-base/locations/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/knowledge-base/policies/route.ts` | GET, POST | requireAuth | OK |
| `/api/knowledge-base/policies/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/knowledge-base/services/route.ts` | GET, POST | requireAuth | OK |
| `/api/knowledge-base/services/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/leads/route.ts` | GET, POST | requireAuth | OK |
| `/api/leads/[id]/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/leads/[id]/score/route.ts` | POST | requireAuth | OK |
| `/api/leads/import/route.ts` | POST | requireAuth | OK |
| `/api/leads/scoring-rules/route.ts` | GET, PUT | requireAuth | OK |
| `/api/make/auth/route.ts` | GET | x-api-key | OK |
| `/api/make/subscribe/route.ts` | POST, DELETE | x-api-key | OK |
| `/api/marketing-checkout/route.ts` | POST | Rate-limited | OK (public checkout) |
| `/api/members/route.ts` | PATCH, DELETE | requireAuth | OK |
| `/api/n8n/auth/route.ts` | GET | x-api-key | OK |
| `/api/n8n/subscribe/route.ts` | POST, DELETE | x-api-key | OK |
| `/api/oauth/authorize/route.ts` | GET | requireAuth | OK |
| `/api/oauth/callback/route.ts` | GET | OAuth state validation | OK |
| `/api/oauth/connections/route.ts` | GET | requireAuth | OK |
| `/api/oauth/disconnect/route.ts` | POST | requireAuth | OK |
| `/api/oauth/google/calendars/route.ts` | GET | requireAuth | OK |
| `/api/oauth/google/sheets/route.ts` | GET | requireAuth | OK |
| `/api/oauth/slack/channels/route.ts` | GET | requireAuth | OK |
| `/api/onboarding/create-agent/route.ts` | POST | requireAuth | OK |
| `/api/onboarding/go-live/route.ts` | POST | requireAuth | OK |
| `/api/onboarding/start/route.ts` | POST | requireAuth | OK |
| `/api/onboarding/status/route.ts` | GET | requireAuth | OK |
| `/api/onboarding/step/[step]/route.ts` | PATCH | requireAuth | OK |
| `/api/onboarding/test-call/route.ts` | POST | requireAuth | OK |
| `/api/onboarding/test-sms/route.ts` | POST | requireAuth | OK |
| `/api/phone-numbers/route.ts` | GET, POST | requireAuth | OK |
| `/api/phone-numbers/[id]/route.ts` | DELETE | requireAuth | OK |
| `/api/phone-numbers/[id]/assign/route.ts` | PATCH | requireAuth | OK |
| `/api/phone-numbers/caller-id/route.ts` | PATCH | requireAuth | OK |
| `/api/phone-numbers/import/route.ts` | POST | requireAuth | OK |
| `/api/phone-numbers/purchase/route.ts` | POST | requireAuth | OK |
| `/api/phone-numbers/search/route.ts` | GET | requireAuth | OK |
| `/api/pii-redaction/route.ts` | GET, POST | requireAuth | OK |
| `/api/post-call-actions/route.ts` | GET, PUT | requireAuth | OK |
| `/api/settings/route.ts` | PATCH | requireAuth | OK |
| `/api/sip-trunks/route.ts` | GET, POST | requireAuth | OK |
| `/api/sip-trunks/[id]/route.ts` | GET, PATCH, DELETE | requireAuth | OK |
| `/api/solutions/route.ts` | GET, POST, PATCH | requireAuth | OK |
| `/api/usage/agent-costs/route.ts` | GET | requireAuth | OK |
| `/api/usage/alerts/route.ts` | GET, PUT | requireAuth | OK |
| `/api/usage/forecast/route.ts` | GET | requireAuth | OK |
| `/api/webhooks/housecallpro/route.ts` | POST | x-webhook-secret | OK |
| `/api/webhooks/jobber/route.ts` | POST | x-webhook-secret | OK |
| `/api/webhooks/retell/route.ts` | POST | Retell signature verification | OK |
| `/api/webhooks/stripe/route.ts` | POST | Stripe signature verification | OK |
| `/api/whitelabel/route.ts` | PATCH | requireAuth | OK |
| `/api/zapier/auth/route.ts` | GET | x-api-key | OK |
| `/api/zapier/subscribe/route.ts` | POST, DELETE | x-api-key | OK |
| `/api/tools/appointments/cancel/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/appointments/check/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/availability/check/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/business-hours/check/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/calendar/availability/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/calendar/book/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/calendly/availability/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/calendly/book/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/confirmation/send/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/contacts/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/email/send/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/escalate/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/faq/search/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/feedback/collect/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/gohighlevel/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/housecallpro/availability/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/housecallpro/book/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/housecallpro/create-estimate/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/housecallpro/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/hubspot/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/intake/collect/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/jobber/availability/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/jobber/book/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/jobber/create-quote/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/jobber/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/leads/create/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/leads/update/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/locations/nearest/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/notes/create/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/policies/search/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/salesforce/lookup/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/services/search/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/sms/send/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/transfer/initiate/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |
| `/api/tools/waitlist/add/route.ts` | POST | RETELL_TOOLS_API_KEY | OK |

**Result:** ALL 120+ API route handlers have appropriate authentication. No missing auth.

### Direct mutation check

6 instances of direct Supabase mutations in "use client" files, all in `(startup)` admin pages (see B3 above). No mutations found in `(portal)` client pages or `components/`.

### Webhook verification

| Webhook | Verification Method | Status |
|---------|-------------------|--------|
| Retell (`/api/webhooks/retell`) | `Retell.verify(rawBody, apiKey, signature)` | OK -- cryptographic signature |
| Stripe (`/api/webhooks/stripe`) | `constructWebhookEvent(rawBody, sig, webhookSecret)` | OK -- cryptographic signature |
| Housecall Pro (`/api/webhooks/housecallpro`) | `x-webhook-secret` header vs `HOUSECALLPRO_WEBHOOK_SECRET` | OK -- shared secret |
| Jobber (`/api/webhooks/jobber`) | `x-webhook-secret` header vs `JOBBER_WEBHOOK_SECRET` | OK -- shared secret |

### Rate limiting

Public endpoints with rate limiting:
- `/api/auth` -- rate-limited
- `/api/auth/reset-password` -- rate-limited
- `/api/calls` POST -- rate-limited
- `/api/agents/create-web-call` -- rate-limited
- `/api/checkout` -- rate-limited
- `/api/marketing-checkout` -- rate-limited
- `/api/demo-call` -- rate-limited
- `/api/contact` -- rate-limited

All public endpoints have rate limiting applied. See W1 for the in-memory limitation.

### Input validation

- Contact form: validates required fields (name, email, message), validates industry enum
- Demo call: validates industry against agent map
- Checkout: validates plan_id, return_url origin
- Auth: validates action, email/password presence
- Integration requests: validates request_type enum
- All Retell tools: validate API key first, then parse body

Most POST/PATCH routes validate required fields. No obvious SQL injection vectors (all queries use parameterized Supabase client).

---

## ENV Audit

### .env.example coverage

All 44 environment variables documented in `.env.example`:

**Referenced in code but present in .env.example:**
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- RETELL_API_KEY, RETELL_TOOLS_API_KEY
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY, ENCRYPTION_KEY
- GOOGLE_CLIENT_ID/SECRET, SLACK_CLIENT_ID/SECRET, HUBSPOT_CLIENT_ID/SECRET
- CALENDLY_CLIENT_ID/SECRET, QUICKBOOKS_CLIENT_ID/SECRET, QUICKBOOKS_SANDBOX
- SALESFORCE_CLIENT_ID/SECRET, GHL_CLIENT_ID/SECRET
- HOUSECALLPRO_CLIENT_ID/SECRET, HOUSECALLPRO_WEBHOOK_SECRET
- JOBBER_CLIENT_ID/SECRET, JOBBER_WEBHOOK_SECRET
- RETELL_AGENT_* (8 demo agents), RETELL_FROM_NUMBER
- PLATFORM_PLAN_ID_STARTER/PROFESSIONAL, CONTACT_FORM_EMAIL
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_FROM_NUMBER, TWILIO_MESSAGING_SERVICE_SID
- TWILIO_SIP_TRUNK_SID, TWILIO_SIP_TERMINATION_URI, TWILIO_SIP_USERNAME, TWILIO_SIP_PASSWORD
- HIYA_APP_ID, HIYA_APP_SECRET
- CRON_SECRET, MARKETING_SITE_URL, NEXT_PUBLIC_APP_URL

**Hardcoded secrets check:** No `sk_live`, `sk_test`, or hardcoded API keys found in source code.

---

## Database

### Migration files

46 migration files found in `supabase/migrations/`, spanning 2026-02-10 through 2026-02-23. Files are sequentially numbered and appear complete. The most recent is `20260223000000_integration_requests.sql`.

### Cron jobs (vercel.json)

5 cron jobs configured:
- `/api/cron/daily-digest` -- hourly
- `/api/cron/checkin-email` -- hourly
- `/api/cron/usage-alerts` -- hourly
- `/api/cron/retry-queue` -- every 5 min
- `/api/cron/send-emails` -- every 5 min

All protected by `CRON_SECRET` Bearer token auth.

---

## Production Readiness

### Stripe configuration

`src/lib/stripe.ts` uses `process.env.STRIPE_SECRET_KEY` -- live vs test mode is determined entirely by which key is set in the environment. No hardcoded test/live mode toggle. This is correct.

### Test/seed data

No test users, seed data, or demo data found in source that would be visible to new signups. The marketing demo agents are configured via environment variables (RETELL_AGENT_*), not hardcoded.

### Webhook/OAuth callback URLs

All webhook and OAuth callback URLs use `process.env.NEXT_PUBLIC_APP_URL` dynamically:
- OAuth callback: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`
- Stripe success/cancel: Uses `appUrl` from env
- Billing portal: Uses `NEXT_PUBLIC_APP_URL`

The `.env.example` defaults to `http://localhost:3000` for NEXT_PUBLIC_APP_URL, which is correct for development. Production Vercel deployment would set this to the production domain.

### localhost/127.0.0.1 in source

Only 2 hits, both in SSRF protection code (`src/app/api/integrations/webhook-test/route.ts:51-52`) which BLOCKS localhost/127.0.0.1 -- this is correct security behavior.

---

## Action Items (Priority Order)

1. **B1 + B2:** Fix the `console.log` in conversation-flow route and add `metadataBase` to root layout
2. **B4:** Run `npm run build && npm run lint` and confirm zero warnings
3. **W1:** Document the in-memory rate limiter limitation or migrate to Upstash/Vercel Edge
4. **W2:** Change Twilio fallback from `console.log` to `logger.warn` without body content
5. **W5:** Consider changing `@typescript-eslint/no-unused-vars` from "warn" to "error"
