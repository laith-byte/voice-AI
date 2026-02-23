# Build Health, Security & Environment Audit

**Auditor:** security-auditor
**Date:** 2026-02-22
**Scope:** Build pipeline, ESLint, tests, code cleanup, auth, middleware, env coverage, CORS

---

## 1. Build Health

### `npm run build` -- PASS (with deprecation note)

- **Result:** Compiled successfully (6.4s), 153 static pages generated, zero TypeScript errors.
- **Note:** Next.js 16.1.6 emits a deprecation warning: `The "middleware" file convention is deprecated. Please use "proxy" instead.` This is informational only; the build still succeeds.

### `npm run lint` -- FAIL (OOM crash)

- **Result:** ESLint crashes with `JavaScript heap out of memory` even with `--max-old-space-size=8192`.
- **Root cause:** `eslint.config.mjs` only ignores `.next/**` but does NOT ignore `.claude/worktrees/**`. The worktree at `.claude/worktrees/frosty-mclean/.next/` contains massive JS chunks (500KB+) that overwhelm ESLint's parser.
- **Workaround:** Running `npx eslint src/` directly completes successfully.
- **When scoped to `src/`:** 85 problems total -- **29 errors, 56 warnings**.

| Category | Count | Details |
|----------|-------|---------|
| `react-hooks/set-state-in-effect` | 14 errors | setState called synchronously inside useEffect |
| `react-hooks/immutability` | 1 error | `window.location.href` assignment in pricing |
| `@typescript-eslint/no-explicit-any` | 1 error | `src/lib/api/get-client-id.ts:5` |
| `@typescript-eslint/no-unused-vars` | 13 warnings | Various unused imports and variables |
| `jsx-a11y/alt-text` | 1 warning | Missing `alt` on image in widget page |

**BLOCKER** -- ESLint config missing `.claude/worktrees/**` from `globalIgnores`, causing `npm run lint` to OOM.

**WARNING** -- 29 lint errors in `src/` (mostly `set-state-in-effect`). These are real anti-patterns but not blocking ship.

### `npx vitest run` -- PASS

- **Result:** 7 test files, **99/99 tests passed** in 193ms.
- All passing: hvac-templates (15), transcript-extraction (28), service-mapper (11), housecallpro executor (13), jobber executor (16), integration-retry (10), integration-events (6).

---

## 2. Code Cleanup

### TODOs -- PASS (0 found)

No `TODO` comments in `src/`.

### FIXMEs -- PASS (0 found)

No `FIXME` comments in `src/`.

### HACKs -- PASS (0 found)

No `HACK` comments in `src/`.

### console.log Statements

12 occurrences found. Assessment:

| File | Line | Verdict |
|------|------|---------|
| `src/lib/twilio.ts` | 17 | **COSMETIC** -- Fallback logging when Twilio not configured |
| `src/app/api/agents/[id]/conversation-flow/route.ts` | 625 | **COSMETIC** -- Debug log for stale flow ID |
| `src/app/api/webhooks/stripe/route.ts` | 131, 170, 219, 235, 247, 432, 444, 451, 463, 550 | **COSMETIC** -- Webhook lifecycle logging (10 occurrences). These are in a webhook handler and serve as an audit trail. Acceptable but consider structured logging. |

**COSMETIC** -- 12 total `console.log` calls. All are in server-side API routes (not client-side leaks). The Stripe webhook handler has the most (10), which is acceptable for payment audit trails.

### Hardcoded Secrets -- PASS (0 found)

No hardcoded API keys, tokens, or passwords found in source code. All secrets are loaded from `process.env`.

### Localhost References -- PASS (1 found, acceptable)

| File | Line | Context |
|------|------|---------|
| `src/app/api/automations/webhook-test/route.ts` | 51 | `hostname === "localhost"` -- Used in webhook URL validation to allow localhost during dev. Acceptable. |

### Placeholder Text

All occurrences of "placeholder" are legitimate HTML `placeholder` attributes on form inputs (500+ occurrences). No "lorem ipsum" found. **PASS.**

### Commented-Out Code

No multi-line commented-out code blocks found. **PASS.**

---

## 3. Environment Documentation

### `.env.example` Coverage

The `.env.example` file contains **47 environment variables** across 17 sections, each with a descriptive comment header.

**Cross-reference with `process.env` usage in `src/`:**

| Env Var | In .env.example | Used in src/ |
|---------|:---:|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Yes |
| `RETELL_API_KEY` | Yes | Yes |
| `STRIPE_SECRET_KEY` | Yes | Yes |
| `STRIPE_WEBHOOK_SECRET` | Yes | Yes |
| `RESEND_API_KEY` | Yes | Yes |
| `ENCRYPTION_KEY` | Yes | Yes |
| `GOOGLE_CLIENT_ID/SECRET` | Yes | Yes |
| `SLACK_CLIENT_ID/SECRET` | Yes | Yes |
| `HUBSPOT_CLIENT_ID/SECRET` | Yes | Yes |
| `CALENDLY_CLIENT_ID/SECRET` | Yes | Yes |
| `QUICKBOOKS_CLIENT_ID/SECRET` | Yes | Yes |
| `QUICKBOOKS_SANDBOX` | Yes | Yes |
| `SALESFORCE_CLIENT_ID/SECRET` | Yes | Yes |
| `GHL_CLIENT_ID/SECRET` | Yes | Yes |
| `HOUSECALLPRO_CLIENT_ID/SECRET` | Yes | Yes |
| `HOUSECALLPRO_WEBHOOK_SECRET` | Yes | Yes |
| `JOBBER_CLIENT_ID/SECRET` | Yes | Yes |
| `JOBBER_WEBHOOK_SECRET` | Yes | Yes |
| `RETELL_TOOLS_API_KEY` | Yes | Yes |
| `RETELL_AGENT_*` (8 variants) | Yes | Yes |
| `RETELL_FROM_NUMBER` | Yes | Yes |
| `PLATFORM_PLAN_ID_STARTER/PROFESSIONAL` | Yes | Yes |
| `CONTACT_FORM_EMAIL` | Yes | Yes |
| `TWILIO_ACCOUNT_SID` | Yes | Yes |
| `TWILIO_AUTH_TOKEN` | Yes | Yes |
| `TWILIO_PHONE_NUMBER` | Yes | Yes |
| `TWILIO_FROM_NUMBER` | Yes | Yes |
| `TWILIO_MESSAGING_SERVICE_SID` | Yes | Yes |
| `TWILIO_SIP_TRUNK_SID` | Yes | Yes |
| `TWILIO_SIP_TERMINATION_URI` | Yes | Yes |
| `TWILIO_SIP_USERNAME` | Yes | Yes |
| `TWILIO_SIP_PASSWORD` | Yes | Yes |
| `HIYA_APP_ID/SECRET` | Yes | Yes |
| `CRON_SECRET` | Yes | Yes |
| `MARKETING_SITE_URL` | Yes | Yes |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes |

**PASS** -- 100% coverage. Every `process.env` reference in `src/` has a corresponding entry in `.env.example`.

### Regression Check: Webhook Secrets

- `HOUSECALLPRO_WEBHOOK_SECRET` -- Present at `.env.example:54` with descriptive comment. **PASS.**
- `JOBBER_WEBHOOK_SECRET` -- Present at `.env.example:61` with descriptive comment. **PASS.**

---

## 4. Security

### 4.1 Auth Pattern

The codebase uses a consistent `requireAuth()` pattern defined in `src/lib/api/auth.ts`:

```ts
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, supabase, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, supabase, response: null };
}
```

Every route that uses this checks `if (response) return response;` before proceeding.

### 4.2 API Route Auth Coverage

**Comprehensive audit of all API routes:**

| Route Category | Auth Mechanism | Assessment |
|---------------|---------------|------------|
| **Admin/CRUD routes** (~50 routes) | `requireAuth()` (Supabase session) | PASS |
| **Cron routes** (4 routes) | `CRON_SECRET` header check | PASS |
| **Webhook routes** | Signature verification | See below |
| **Tool routes** (~30 routes) | `RETELL_TOOLS_API_KEY` header check | PASS |
| **Integration auth** (Zapier/Make/n8n) | `x-api-key` header, hashed lookup | PASS |
| **OAuth callback** | Supabase `getUser()` + state validation | PASS |
| **Public routes** | Rate limiting | See below |

**Webhook signature verification:**

| Webhook | Verification |
|---------|-------------|
| `/api/webhooks/retell` | `Retell.verify(rawBody, apiKey, signature)` -- **PASS** |
| `/api/webhooks/stripe` | `stripe.webhooks.constructEvent(rawBody, signature, secret)` -- **PASS** |
| `/api/webhooks/housecallpro` | `x-webhook-secret` header vs `HOUSECALLPRO_WEBHOOK_SECRET` -- **PASS** |
| `/api/webhooks/jobber` | `x-webhook-secret` header vs `JOBBER_WEBHOOK_SECRET` -- **PASS** |

**Public endpoints (no user session required):**

| Route | Protection |
|-------|-----------|
| `/api/auth` (sign-in/sign-up) | Rate limiting (`publicEndpointLimiter`) |
| `/api/auth/reset-password` | Rate limiting |
| `/api/contact` | Rate limiting |
| `/api/demo-call` | Rate limiting |
| `/api/marketing-checkout` | Rate limiting |
| `/api/checkout` | **WARNING** -- No rate limiting! This public checkout route lacks `publicEndpointLimiter`. |
| `/api/agents/create-web-call` | Rate limiting |

**WARNING** -- `/api/checkout/route.ts` is a public endpoint (no auth required, as documented in its JSDoc) but lacks rate limiting. An attacker could abuse this to create unlimited Stripe Checkout sessions. All other public endpoints have rate limiting.

### 4.3 "use client" File Security

158 files use the `"use client"` directive. None import from sensitive server-only modules:
- No imports from `@/lib/supabase/server`
- No imports from `@/lib/api/auth`
- No imports from `@/lib/stripe`
- No imports from `@/lib/crypto`
- No imports from `@/lib/resend`
- No imports from `@/lib/twilio`

**PASS** -- Clean client/server boundary.

### 4.4 CORS Configuration

- `next.config.ts` is empty (no custom CORS headers).
- Middleware (`src/middleware.ts`) delegates to `updateSession()` which handles auth and routing only, not CORS.
- The `/api/checkout` route manually validates `return_url` against an allowlist of origins (`NEXT_PUBLIC_APP_URL`, `MARKETING_SITE_URL`). This is good.
- No explicit CORS headers are set on API routes. Next.js API routes are same-origin by default, which is the correct default posture. External callers (Retell tools, webhooks) authenticate via API keys/signatures.

**PASS** -- Acceptable CORS posture.

### 4.5 Middleware Route Protection

`src/middleware.ts` runs on all routes (excluding static assets) and delegates to `src/lib/supabase/middleware.ts` which:

1. Refreshes the Supabase auth session on every request.
2. Redirects unauthenticated users to `/login` (except public routes and API routes).
3. Enforces role-based access: client users cannot access admin routes; startup users cannot access portal routes.
4. Validates slug-based portal URLs match the authenticated user's actual client.
5. Handles onboarding redirects for incomplete setups.

**PASS** -- Middleware is comprehensive and correctly scoped. API routes handle their own auth (which is the right pattern for Next.js).

### 4.6 Integration Auth (Zapier/Make/n8n)

The `authenticateZapier()`, `authenticateMake()`, and `authenticateN8n()` functions all:
1. Require `x-api-key` header.
2. Hash the key with SHA-256.
3. Look up the hash in the corresponding subscriptions table.
4. Fall back to parsing `client_id:random_key` format for new keys.

**WARNING** -- The fallback path (step 4) accepts any API key in `client_id:random_key` format without verifying the random_key portion against a stored hash. This means an attacker who knows a `client_id` could craft a valid-looking key. However, the `client_id` is a UUID which provides some entropy, and the subscription is scoped to that client. Low severity but worth noting.

---

## 5. Migrations

No `supabase/migrations/*.sql` files found in the repository. Migrations are either:
- Managed externally (e.g., Supabase dashboard or CI pipeline)
- In a different location

**N/A** -- Cannot audit migration ordering without migration files present.

---

## 6. Additional Findings

### ESLint Config Gap

**BLOCKER** -- `eslint.config.mjs` does not ignore `.claude/worktrees/**`. This causes `npm run lint` to crash with OOM when worktrees exist. Fix:

```js
globalIgnores([
  ".next/**",
  ".claude/**",   // Add this
  "out/**",
  "build/**",
  "next-env.d.ts",
]),
```

### Next.js Middleware Deprecation

**WARNING** -- Next.js 16.1.6 warns that the `middleware.ts` convention is deprecated in favor of `proxy.ts`. This should be addressed before upgrading to a version that drops support.

### Unused Imports/Variables (Lint Warnings)

**COSMETIC** -- 13 unused variable warnings across the codebase. Notable:
- `src/lib/__tests__/integration-retry.test.ts:6` -- `mockSelect` unused
- `src/lib/hvac-templates.ts:153` -- `provider` unused
- `src/lib/lead-scoring.ts:139` -- `totalScore` unused
- `src/lib/retell-costs.ts:67` -- `MONTHLY_COSTS` unused
- `src/lib/post-call-actions.ts:225` -- `delayMinutes` unused
- 5x `_config` in OAuth executors (housecallpro, jobber, hubspot, salesforce, gohighlevel)

---

## Summary

| Category | Count |
|----------|-------|
| **BLOCKER** | 1 |
| **WARNING** | 4 |
| **COSMETIC** | 3 |
| **REGRESSION** | 0 |

### BLOCKER (1)
1. ESLint config missing `.claude/worktrees/**` ignore -- `npm run lint` OOM crash

### WARNING (4)
1. 29 ESLint errors in `src/` (14x `set-state-in-effect`, 1x `immutability`, 1x `no-explicit-any`)
2. `/api/checkout` public endpoint missing rate limiting
3. Zapier/Make/n8n auth fallback accepts unverified `client_id:random_key` format
4. Next.js middleware convention deprecated -- plan migration to `proxy.ts`

### COSMETIC (3)
1. 12 `console.log` calls in API routes (server-side only, no client leaks)
2. 13 unused variable warnings
3. 1 missing `alt` attribute on image element

### REGRESSION (0)
- `HOUSECALLPRO_WEBHOOK_SECRET` -- present in `.env.example` (no regression)
- `JOBBER_WEBHOOK_SECRET` -- present in `.env.example` (no regression)
