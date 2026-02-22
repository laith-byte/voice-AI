# Build, Environment & Security Audit

**Date:** 2026-02-22
**Auditor:** build-security-auditor (automated)
**Project:** Invaria Labs Voice AI Platform
**Stack:** Next.js 16.1.6 (Turbopack) + Supabase + Stripe + Retell AI

---

## Summary

The build is **clean** (zero TypeScript errors, zero compilation errors). Environment variables are well-documented with one gap. Security posture is **strong overall** -- Stripe webhooks verify signatures, Retell webhooks verify signatures, RLS is enforced in Supabase migrations, API keys are encrypted at rest with AES-256-GCM, and authentication is consistently applied across internal API routes. The audit found **2 blockers**, **8 warnings**, and **4 cosmetic issues**.

---

## BLOCKERS

- **[BLOCKER] [XSS] Contact form injects user input into HTML email without escaping** -- `/src/app/api/contact/route.ts:20-28` interpolates `name`, `email`, `company`, `phone`, and `message` directly into HTML without any `escapeHtml()` call. An attacker submitting `<script>...</script>` in the message field could trigger XSS in the recipient's email client. Every other email template in the codebase correctly uses `escapeHtml()` -- this route is the sole exception.

- **[BLOCKER] [ENV] `TWILIO_FROM_NUMBER` used in code but missing from `.env.example`** -- `src/app/api/tools/confirmation/send/route.ts:41` and `src/app/api/tools/sms/send/route.ts:30` reference `process.env.TWILIO_FROM_NUMBER!` (with non-null assertion), but `.env.example` only documents `TWILIO_PHONE_NUMBER`. Either the code uses the wrong variable name, or `.env.example` is incomplete. If the variable is unset at runtime, the non-null assertion will send `undefined` as the from number to Twilio, causing silent failures or API errors.

---

## WARNINGS

- **[WARNING] [Rate Limiting] `/api/contact` has no rate limiting** -- The contact form endpoint at `src/app/api/contact/route.ts` has no call to `publicEndpointLimiter`. This is a public endpoint that sends emails via Resend -- an attacker could abuse it to burn through your Resend quota or use it as an email-bombing relay.

- **[WARNING] [Rate Limiting] `/api/checkout` has no rate limiting** -- The checkout endpoint at `src/app/api/checkout/route.ts` is a public endpoint that creates Stripe Checkout sessions. Without rate limiting, an attacker could create thousands of pending checkout sessions, potentially triggering Stripe rate limits or generating nuisance Stripe objects.

- **[WARNING] [Auth] Make/n8n/Zapier auth endpoints only verify client_id exists, not the random key portion** -- In `src/app/api/make/auth/route.ts`, `src/app/api/n8n/auth/route.ts`, and `src/app/api/zapier/auth/route.ts`, the API key format is `client_id:random_key`, but authentication only verifies that the `client_id` exists in the database -- the `random_key` portion is never validated. Anyone who guesses or enumerates a valid UUID `client_id` can authenticate. The Zapier subscribe endpoint (`zapier/subscribe/route.ts`) does properly hash and store the full key -- but the auth test endpoints do not.

- **[WARNING] [Build] Next.js 16 middleware deprecation warning** -- The build output shows: `The "middleware" file convention is deprecated. Please use "proxy" instead.` While this is not a current failure, the `src/middleware.ts` file uses the legacy convention and will eventually break on a future Next.js update.

- **[WARNING] [Cron] `/api/cron/usage-alerts` is not configured in `vercel.json`** -- The `vercel.json` file configures cron schedules for `daily-digest` and `checkin-email`, but the `usage-alerts` endpoint is missing. This route has auth via `CRON_SECRET` so it is protected, but it will never be called automatically in production unless manually added.

- **[WARNING] [TypeScript] 48 `eslint-disable` comments and ~40 explicit `any` casts across 27 files** -- While the build passes cleanly (no `@ts-ignore` or `@ts-expect-error` found), the codebase has significant use of `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and `as any` casts, particularly in `src/app/api/webhooks/stripe/route.ts` (10 occurrences), `src/components/agents/prompt-tree-editor.tsx` (6 occurrences), and the billing pages. These bypass type checking and could mask runtime errors.

- **[WARNING] [Security] In-memory rate limiter will not work in multi-instance deployments** -- `src/lib/rate-limit.ts` uses an in-memory `Map` for rate limiting. On Vercel (serverless), each function instance has its own memory, so rate limits are not shared across instances. A determined attacker could bypass rate limits by distributing requests across multiple cold starts. Consider Redis-based rate limiting for production (e.g., `@upstash/ratelimit`).

- **[WARNING] [ENV] `.env.example` contains `NEXT_PUBLIC_APP_URL=http://localhost:3000`** -- The `.env.example` file has a hardcoded `http://localhost:3000` default for `NEXT_PUBLIC_APP_URL`. While this is a template file, if someone copies it to `.env.local` without updating, OAuth callback URLs, email links, and CORS origins will all point to localhost in production.

---

## COSMETIC

- **[COSMETIC] [Logging] 13 `console.log` statements in production code** -- `src/app/api/webhooks/stripe/route.ts` contains 12 `console.log` calls (e.g., "Client already exists for email:", "Created client:", "Auto-provisioning complete for:"), and `src/lib/twilio.ts` has 1. None appear to leak sensitive data (no API keys, passwords, or tokens are logged), but they add noise to production logs. The `console.error` and `console.warn` calls are appropriate and should remain.

- **[COSMETIC] [Logging] `console.log` in conversation-flow route** -- `src/app/api/agents/[id]/conversation-flow/route.ts:625` has a `console.log` that should be removed or downgraded to debug level before launch.

- **[COSMETIC] [Seed Data] Vertical templates contain sample data (e.g., "Dental Office", "$150 teeth cleaning prices")** -- Migration `20260211120000_seed_vertical_templates.sql` seeds agent templates with realistic-looking sample data. This is intentional (templates for the onboarding wizard), but verify that none of this data appears in customer-facing contexts as if it were real content.

- **[COSMETIC] [Config] `next.config.ts` is empty** -- The Next.js configuration file contains no options. This is fine but worth noting -- no custom headers (CSP, HSTS, X-Frame-Options) are being set at the framework level. Verify that Vercel's default headers or a CDN layer handles security headers.

---

## Checks Performed

### Build
- [x] `npm run build` -- **PASS** (compiled successfully in 6.6s, 137 static pages generated)
- [x] Zero TypeScript compilation errors
- [x] Zero `@ts-ignore` directives found
- [x] Zero `@ts-expect-error` directives found
- [x] One build warning: middleware deprecation (documented above)

### Environment Variables
- [x] `.env.example` reviewed -- 46 variables documented across 18 services
- [x] All `process.env.*` references in `src/` cross-referenced with `.env.example`
- [x] **Gap found:** `TWILIO_FROM_NUMBER` used in code but not in `.env.example`
- [x] Scanned for `localhost` / `127.0.0.1` in `src/` -- only found in webhook-test URL validation (appropriate)
- [x] `.env.example` default `http://localhost:3000` noted as warning
- [x] No test/sandbox env var values hardcoded (QuickBooks sandbox is env-controlled via `QUICKBOOKS_SANDBOX`)

### Code Hygiene
- [x] Zero `TODO`, `FIXME`, `HACK`, `XXX` comments in `src/`
- [x] `console.log` audit -- 13 calls, none leak sensitive data
- [x] 48 `eslint-disable` comments across 27 files (documented)
- [x] ~40 `as any` / `: any` casts (documented)
- [x] No large commented-out code blocks found
- [x] No `dangerouslySetInnerHTML` usage found

### Security -- Authentication
- [x] All internal API routes (`/api/agents/*`, `/api/billing/*`, `/api/business-settings/*`, etc.) use `requireAuth()`
- [x] Public endpoints (`/api/auth`, `/api/demo-call`, `/api/checkout`, `/api/marketing-checkout`, `/api/contact`) are intentionally unauthenticated
- [x] `/api/agents/create-web-call` is unauthenticated but rate-limited (public widget endpoint)
- [x] Cron endpoints (`/api/cron/*`) verify `CRON_SECRET` via Bearer token
- [x] Webhook endpoints (`/api/webhooks/stripe`, `/api/webhooks/retell`) verify cryptographic signatures
- [x] Zapier/Make/n8n auth endpoints use API key validation (weakness documented)
- [x] Tool endpoints (`/api/tools/*`) verify `RETELL_TOOLS_API_KEY` shared secret
- [x] Middleware enforces auth redirect for non-public, non-API routes
- [x] Client portal routes validate slug ownership (user can only access their own slug)

### Security -- Injection & XSS
- [x] No raw SQL queries -- all DB access via Supabase client (parameterized)
- [x] One `rpc()` call found (`increment_total_calls`) -- uses parameterized input
- [x] Zero `dangerouslySetInnerHTML` usage
- [x] Email templates consistently use `escapeHtml()` **except** `/api/contact` route (BLOCKER)
- [x] No user input directly interpolated into SQL

### Security -- Encryption & Secrets
- [x] API keys encrypted at rest using AES-256-GCM (`src/lib/crypto.ts`)
- [x] Encryption key validation: requires 64-char hex (32 bytes)
- [x] No hardcoded secrets found (searched for `sk_live`, `sk_test`, `AKIA`, `ghp_`, API key patterns)
- [x] Stripe webhook signature verification confirmed (`constructWebhookEvent`)
- [x] Retell webhook signature verification confirmed (`Retell.verify`)
- [x] OAuth tokens stored in database (encrypted via crypto module)

### Security -- CORS & Headers
- [x] `next.config.ts` is empty -- no custom CORS configuration
- [x] `/api/checkout` validates `return_url` against allowed origins list
- [x] No wildcard CORS (`Access-Control-Allow-Origin: *`) found in codebase
- [x] Security headers not explicitly configured (relies on hosting platform defaults)

### Security -- Auth Tokens & Sessions
- [x] Supabase handles session management (JWT-based, server-side validated via `getUser()`)
- [x] Password reset prevents email enumeration (always returns success)
- [x] Invite links expire in 24 hours (documented in email templates)
- [x] Rate limiting on auth endpoints (`/api/auth`, `/api/auth/reset-password`)

### Data Safety
- [x] Seed data is template content for onboarding wizard (intentional, not test users)
- [x] No dummy users, test accounts, or hardcoded credentials in migrations
- [x] RLS policies found in migrations: `20260210031500`, `20260210032700`, `20260210060000`, `20260212120000`, `20260218000000`
- [x] Security fix migration (`20260218000000`) addresses 8 Supabase Security Advisor issues
- [x] All tables with user data have `organization_id` scoping in RLS policies
- [x] Client users scoped to their `client_id` via `get_user_client_id()` helper function
- [x] Helper functions (`get_user_org_id`, `is_startup_user`, `get_user_client_id`) use `SECURITY DEFINER` with fixed `search_path`
