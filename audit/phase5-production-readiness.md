# Phase 5: Production Readiness Audit

**Auditor:** Claude (SRE/DevOps)
**Date:** 2026-02-27
**Scope:** Logging, error monitoring, migrations, hardcoded values, build, env vars, performance

---

## 1. Logging Audit

### 1.1 Structured Logger Exists (GOOD)

A structured JSON logger is defined at `src/lib/logger.ts`:
```typescript
function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = { level, message, timestamp: new Date().toISOString(), ...(context ? { context } : {}) };
  const output = JSON.stringify(entry);
  // Routes to console.error/warn/log by level
}
```
It is imported in ~28 API routes (auth, clients, leads, webhooks, etc.).

### 1.2 Inconsistent Logger Usage (MEDIUM)

**Issue:** The majority of routes (~150+ files) use raw `console.error()` / `console.log()` / `console.warn()` instead of the structured `logger`. This creates inconsistent log formats and makes log aggregation difficult.

**Files using raw console but NOT the structured logger (sample):**

| File | Line | Code |
|------|------|------|
| `src/lib/prompt-generator.ts` | 515 | `console.error("Retell Chat API error:", err)` |
| `src/lib/knowledge-base-generator.ts` | 209 | `console.error("No Retell API key...")` |
| `src/app/api/onboarding/create-agent/route.ts` | 669 | `console.error("Create agent error:", err)` |
| `src/app/api/webhooks/retell/route.ts` | 443 | `console.error("Retell webhook error:", error)` |
| `src/app/api/agents/[id]/conversation-flow/route.ts` | 721 | `console.error("Conversation flow fetch error:", err)` |
| `src/app/api/checkout/route.ts` | 121 | `console.error("Stripe checkout error:", err)` |

**Fix:** Replace all raw `console.error/log/warn` in `src/app/api/` and `src/lib/` with the structured `logger.error/info/warn`.

### 1.3 Debug console.log Statements That Should Be Removed (MEDIUM)

These are verbose debug logs that leak internal state in production:

| File | Line | Code | Why Remove |
|------|------|------|------------|
| `src/lib/prompt-generator.ts` | 572 | `console.log("[regeneratePrompt] Preserving", existingStates.length, ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 371 | `console.log("[config PATCH] body.llm_id present:", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 394 | `console.log("[config PATCH] Preserving", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 406 | `console.log("[config PATCH] Updating LLM", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 436 | `console.log("[config PATCH] llm_id in body:", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 441 | `console.log("[config PATCH] Detected conversation-flow engine", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 470 | `console.log("[config PATCH] Standalone LLM fallback", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 492 | `console.log("[config PATCH] Preserving", ...)` | Debug tracing |
| `src/app/api/agents/[id]/config/route.ts` | 667 | `console.log("[config PATCH] Updating agent via", ...)` | Debug tracing |
| `src/app/api/agents/[id]/conversation-flow/route.ts` | 376 | `console.log("[conversation-flow GET] engine type:", ...)` | Debug tracing |
| `src/app/api/agents/[id]/conversation-flow/route.ts` | 398 | `console.log("[conversation-flow GET] LLM", ...)` | Debug tracing |
| `src/app/api/agents/[id]/conversation-flow/route.ts` | 462-585 | Multiple `console.log(...)` | Self-healing debug logs (~15 instances) |
| `src/app/api/agents/[id]/conversation-flow/route.ts` | 774-815 | Multiple `console.log(...)` | PUT debug tracing |
| `src/app/api/conversation-flows/[id]/route.ts` | 235, 308, 329 | Multiple `console.log(...)` | Debug deploy verification |
| `src/app/api/onboarding/create-agent/route.ts` | 122, 223, 397, 464 | Multiple `console.log("[create-agent] ...")` | Debug tracing |
| `src/lib/twilio.ts` | 17 | `console.log("[SMS] Twilio not configured:", body)` | Logs SMS body to console when Twilio not configured |
| `src/components/agents/prompt-tree-editor.tsx` | 625, 1215 | `console.log(...)` (guarded by `NODE_ENV === "development"`) | OK - dev-only |

**Fix:** Remove or convert to `logger.info()` with structured context. The two guarded by `NODE_ENV === "development"` are acceptable.

### 1.4 Potential Sensitive Data in Logs (MEDIUM)

| File | Line | Issue |
|------|------|-------|
| `src/lib/oauth/token-manager.ts` | 84 | `console.error("Token refresh failed:", errText)` - `errText` is the raw response body from the OAuth provider. It may contain error details that leak token information or internal provider state. |
| `src/app/api/oauth/callback/route.ts` | 99 | `console.error("OAuth token exchange failed:", err)` - Same issue; raw response body. |
| `src/lib/twilio.ts` | 17 | `console.log("[SMS] Twilio not configured:", body)` - Logs the SMS body (could contain customer phone numbers / message content). |

**Fix:** Sanitize or truncate error response bodies before logging. For the Twilio case, log only the recipient phone or a message-type indicator, not the full body.

---

## 2. Error Monitoring

### 2.1 No APM / Error Monitoring Service (CRITICAL)

**Issue:** No Sentry, Datadog, New Relic, Bugsnag, or equivalent is configured. Searched for all common SDKs and found zero matches.

**Impact:** In production, errors silently disappear into console output. There is no alerting, no error grouping, no stack trace aggregation, and no way to detect regressions.

**Fix:** Add Sentry (or equivalent). For Next.js, install `@sentry/nextjs` which instruments both client and server automatically.

### 2.2 No Global Error Boundary (MEDIUM)

**Issue:** The app has `error.tsx` files only in two layout groups:
- `src/app/(marketing)/error.tsx`
- `src/app/(portal)/[clientSlug]/portal/error.tsx`

There is **no `src/app/global-error.tsx`** and **no error boundary** for the `(startup)` layout group or the root layout.

**Impact:** Unhandled errors in the `(startup)` section or root layout crash to a Next.js default error page with no recovery UI.

**Fix:** Add `src/app/global-error.tsx` (catches root layout errors) and `src/app/(startup)/error.tsx`.

### 2.3 No Unhandled Rejection Handler (LOW)

**Issue:** No `process.on("unhandledRejection")` or `process.on("uncaughtException")` handlers found.

**Note:** Next.js handles these internally in its server runtime, so this is less critical. Once Sentry is added, it handles this automatically.

---

## 3. Database Migrations

### 3.1 Migration Overview (GOOD)

There are **40 migration files** in `supabase/migrations/` spanning `20260210` through `20260225`. They are sequential and well-named.

### 3.2 No Rollback / Down Migrations (MEDIUM)

**Issue:** All migrations are forward-only (UP). There are no corresponding down migrations or rollback scripts. Supabase CLI does not natively support down migrations, but the lack of any documented rollback procedure is a production risk.

**Fix:** Document a rollback strategy for each migration. At minimum, create a `supabase/rollbacks/` directory with reverse SQL for critical schema changes.

### 3.3 Destructive Operations (LOW - Acceptable)

Only constraint drops were found (no table or column drops):

| File | Operation |
|------|-----------|
| `20260220100000_fix_client_status_constraint.sql:6` | `ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check` (replacing with updated check) |
| `20260223_restructure_business_settings.sql:11,40` | `DROP CONSTRAINT IF EXISTS ...` (restructuring unique constraints) |
| `20260215100000_sms_kb_multilang.sql:2` | `ALTER TABLE client_onboarding DROP CONSTRAINT IF EXISTS ...` (expanding enum) |

These are safe — they drop constraints (not data) and use `IF EXISTS` guards.

### 3.4 Index Coverage (GOOD)

Migrations create ~20+ indexes covering common query patterns (client_id, agent_id, provider, status, timestamps). Notable indexes:
- `idx_leads_agent`, `idx_leads_score`, `idx_leads_qualification`
- `idx_pending_callbacks_ready` (partial index on status)
- `idx_integration_events_client`, `idx_integration_events_provider`
- `idx_retry_queue_pending` (partial index)
- `idx_automation_logs_client`, `idx_client_automations_client`

### 3.5 Missing Index: call_logs (MEDIUM)

**Issue:** `call_logs` is queried frequently (by agent_id, by client via RLS, by date range in dashboards/analytics). No explicit index creation was found in migrations for `call_logs` columns beyond what Supabase creates for primary keys and foreign keys.

**Fix:** Add indexes on `call_logs(agent_id, created_at DESC)` and `call_logs(organization_id, created_at DESC)` if not already present from foreign key constraints.

---

## 4. Hardcoded Values

### 4.1 Hardcoded Retell API Base URL (LOW)

**Issue:** `https://api.retellai.com` is hardcoded in ~50+ locations across the codebase. While Retell's API URL is unlikely to change, this makes it impossible to point at a staging/mock API for testing.

**Files (sample):**
- `src/lib/prompt-generator.ts:496,545,563,634,660,672`
- `src/lib/knowledge-base-generator.ts:226,244,285,307`
- `src/app/api/agents/[id]/config/route.ts:56`
- `src/app/api/agents/[id]/route.ts:7`
- `src/app/api/onboarding/create-agent/route.ts:232,270,466,514`

**Fix:** Extract to a constant `RETELL_API_BASE = process.env.RETELL_API_BASE || "https://api.retellai.com"` and use it everywhere. Some files already have a `retell()` helper that centralizes this — extend that pattern.

### 4.2 Hardcoded Email Sender Domain (LOW)

**Issue:** `notifications@invarialabs.com` is hardcoded as the "from" address in multiple files:
- `src/lib/post-call-actions.ts:176`
- `src/app/api/cron/checkin-email/route.ts:74`
- `src/app/api/cron/daily-digest/route.ts:154`
- `src/app/api/cron/usage-alerts/route.ts:148`
- `src/app/api/webhooks/retell/route.ts:377`

**Fix:** Extract to an env var `NOTIFICATION_FROM_EMAIL` or derive from whitelabel settings.

### 4.3 Hardcoded Fallback Email (LOW)

| File | Line | Code |
|------|------|------|
| `src/app/api/contact/route.ts` | 45 | `process.env.CONTACT_FORM_EMAIL \|\| "sales@invarialabs.com"` |

This fallback is reasonable as a last resort, but is documented in `.env.example`.

### 4.4 Hardcoded CDN / Embed URLs (MEDIUM)

| File | Line | Code |
|------|------|------|
| `src/app/(portal)/[clientSlug]/portal/onboarding/page.tsx` | 2867 | `https://cdn.invaria.ai/chat-widget.js` |
| `src/app/(startup)/clients/[id]/embed-url/page.tsx` | 102 | `https://embed.invarialabs.com/widget.js` |
| `src/app/(startup)/settings/whitelabel/page.tsx` | 703 | `https://app.invaria.io/login` fallback |

**Fix:** These should be environment variables to support whitelabel deployments on custom domains.

### 4.5 Hardcoded Retell Cost Values (LOW)

`src/lib/retell-costs.ts` contains hardcoded pricing for all LLM models, voice providers, and add-ons. The file is well-documented (comments cite source) but prices are frozen at 2025 values.

**Fix:** Consider loading pricing from a database table or config endpoint that can be updated without a code deploy.

### 4.6 Hardcoded Metadata URL (LOW)

| File | Line | Code |
|------|------|------|
| `src/app/layout.tsx` | 27 | `metadataBase: new URL("https://invarialabs.com")` |

**Fix:** Use `process.env.NEXT_PUBLIC_APP_URL` for whitelabel support.

### 4.7 No Localhost References in Production Paths (GOOD)

The codebase correctly filters out localhost URLs before sending to Retell via `isPublicUrl()` checks in `src/lib/compile-flow-to-retell.ts:88-89`. The `.env.example` has `NEXT_PUBLIC_APP_URL=http://localhost:3001` which is only a development default.

---

## 5. Build Audit

### 5.1 Build Result: CLEAN (GOOD)

```
next build (Turbopack)
Compiled successfully in 6.4s
168 static pages generated
0 errors, 0 warnings
```

### 5.2 TypeScript Strictness (GOOD)

`tsconfig.json` has `"strict": true` enabled. All strict checks are active (strictNullChecks, noImplicitAny, etc.).

### 5.3 ESLint Configuration (GOOD)

`eslint.config.mjs` extends `next/core-web-vitals` and `next/typescript`. Custom rules:
- `react-hooks/set-state-in-effect: "off"` — Documented justification (fetching in useEffect then calling setState)
- `react-hooks/immutability: "off"` — Documented justification (window.location.href assignment)
- `@typescript-eslint/no-unused-vars: "warn"` with `_` prefix ignore — Standard convention

No rules are disabled that shouldn't be.

### 5.4 Next.js Config (LOW)

`next.config.ts` is completely empty (no custom configuration). This is fine for development, but production may benefit from:
- `images.remotePatterns` for external image optimization
- `headers()` for security headers (though middleware may handle this)
- `poweredByHeader: false` to remove `X-Powered-By: Next.js`

---

## 6. Environment Variables Documentation

### 6.1 .env.example Exists (GOOD)

`.env.example` documents **48 environment variables** across all integrations.

### 6.2 Missing from .env.example (MEDIUM)

These `process.env.*` references exist in code but are NOT in `.env.example`:

| Variable | Used In | Purpose |
|----------|---------|---------|
| `RESEND_INBOUND_SECRET` | `src/app/api/webhooks/resend/inbound/route.ts:93` | Webhook validation for inbound email |
| `TWILIO_SIP_TRUNK_SID` | `src/app/api/phone-numbers/purchase/route.ts:48` | Present in .env.example but as comment only (line 92) -- OK |
| `NODE_ENV` | `src/components/agents/prompt-tree-editor.tsx:624` | Built-in, OK |

**Fix:** Add `RESEND_INBOUND_SECRET=` to `.env.example`.

### 6.3 Dangerous Fallback Defaults (MEDIUM)

| File | Line | Code | Risk |
|------|------|------|------|
| `src/lib/compile-flow-to-retell.ts` | 80 | `const APP_URL = process.env.NEXT_PUBLIC_APP_URL \|\| ""` | Empty string fallback means tool URLs become relative paths like `/api/tools/...` — Retell will reject these |
| `src/lib/prompt-generator.ts` | 582 | `const APP_URL = process.env.NEXT_PUBLIC_APP_URL \|\| ""` | Same issue |
| `src/lib/oauth/register-agent-tools.ts` | 5 | `const APP_URL = process.env.NEXT_PUBLIC_APP_URL \|\| ""` | Same issue |
| `src/app/api/demo-call/route.ts` | 7-14 | All `RETELL_AGENT_*` env vars default to `""` | Empty agent IDs will cause Retell API errors at runtime |

**Fix:** For `NEXT_PUBLIC_APP_URL`, throw a startup error if not set in production (guard with `NODE_ENV === "production"`). For demo agent IDs, return early with a clear error message if the env var is empty.

### 6.4 Non-Null Assertions on Required Env Vars (LOW)

Multiple files use TypeScript non-null assertions (`!`) on env vars:
- `src/lib/supabase/server.ts:8` — `process.env.NEXT_PUBLIC_SUPABASE_URL!`
- `src/lib/oauth/providers.ts:22` — `process.env.GOOGLE_CLIENT_ID!`
- `src/app/api/tools/sms/send/route.ts:24` — `process.env.TWILIO_ACCOUNT_SID!`

If any of these are missing at runtime, the app will throw a cryptic `undefined` error rather than a helpful message.

**Fix:** For critical env vars (Supabase, Stripe), validate at startup and fail fast with a clear error message.

---

## 7. Performance Concerns

### 7.1 No N+1 Query Patterns Detected (GOOD)

API routes use Supabase client's `.select()` with joins rather than looping queries. The cron routes (`checkin-email`, `daily-digest`, `usage-alerts`) do loop over results but perform single DB updates per iteration — this is acceptable for cron jobs with limited result sets.

### 7.2 Missing Caching Headers on API Responses (MEDIUM)

**Issue:** No API route sets `Cache-Control` headers. For read-heavy endpoints that rarely change, this means every request hits the server.

**Candidates for caching:**
- `GET /api/agents/[id]/voices` — Voice list changes very rarely. Add `Cache-Control: public, max-age=3600`.
- `GET /api/solutions` — Solution catalog is semi-static. Add `Cache-Control: public, max-age=300`.
- `GET /api/agent-templates` — Templates change rarely. Add `Cache-Control: public, max-age=300`.
- `GET /api/knowledge-base/*` — Knowledge base data per client. Add `Cache-Control: private, max-age=60`.

**Fix:** Add appropriate `Cache-Control` headers to read-only, semi-static endpoints.

### 7.3 No Large Bundle Import Issues (GOOD)

No full-library imports of lodash, moment.js, or other notoriously large packages were found. The app uses `retell-client-js-sdk` (client-side) which is imported only in the onboarding page and is likely tree-shaken.

### 7.4 Retell API Calls Not Batched (LOW)

Several routes make sequential Retell API calls (GET then PATCH then verify GET). This is by design for correctness (MEMORY.md documents this pattern), but adds latency. No fix needed — this is the correct pattern per Retell API behavior.

### 7.5 Cron Job Sequential Processing (LOW)

Cron routes like `checkin-email` and `usage-alerts` process candidates sequentially in a `for` loop. For small candidate sets this is fine, but could become slow at scale.

**Fix (future):** When candidate count exceeds ~50, batch with `Promise.allSettled()` with concurrency limits.

---

## Summary

### Critical Issues (1)

| # | Issue | Impact |
|---|-------|--------|
| 1 | No error monitoring (Sentry/Datadog) | Errors invisible in production |

### Medium Issues (8)

| # | Issue | Impact |
|---|-------|--------|
| 2 | Inconsistent logger usage (~150+ files use raw console) | Poor log aggregation |
| 3 | ~40+ debug console.log statements in API routes | Noise in production logs |
| 4 | Potential sensitive data in OAuth error logs | Token info may leak to logs |
| 5 | No global-error.tsx or (startup) error boundary | Unhandled errors show default page |
| 6 | No rollback strategy for migrations | Risky deploys |
| 7 | Missing `RESEND_INBOUND_SECRET` in .env.example | Undocumented required var |
| 8 | Dangerous empty-string fallbacks for APP_URL | Silent failures with relative URLs |
| 9 | No caching headers on any API route | Unnecessary server load |

### Low Issues (7)

| # | Issue | Impact |
|---|-------|--------|
| 10 | Hardcoded Retell API base URL in 50+ files | Cannot swap to mock/staging API |
| 11 | Hardcoded email sender domain | Not whitelabel-friendly |
| 12 | Hardcoded CDN/embed URLs | Not whitelabel-friendly |
| 13 | Hardcoded pricing in retell-costs.ts | Requires deploy to update prices |
| 14 | Non-null assertions on env vars | Cryptic errors if vars missing |
| 15 | Missing call_logs index | Potential slow dashboard queries |
| 16 | Empty next.config.ts (no security headers, no poweredByHeader: false) | Minor security hardening gap |

### What's Good

- Build is clean: 0 errors, 0 warnings
- TypeScript strict mode enabled
- ESLint properly configured with documented rule overrides
- Structured logger exists (just underutilized)
- `.env.example` documents 48/49 required variables
- Localhost URLs are correctly filtered before Retell API calls
- No N+1 query patterns
- No large bundle imports
- Migration files are sequential, well-named, with good index coverage
- Destructive migration operations are safe (constraint-only, with IF EXISTS guards)
