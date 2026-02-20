# Audit Section 5 -- Environment Variables

**Auditor:** env-auditor
**Date:** 2026-02-20
**Scope:** All `process.env.*` references in `/Users/laith/projects/invaria-labs`

---

## Summary

- **Total unique env vars referenced in code:** 38
- **Documented in `.env.example`:** 31
- **Present in `.env.local`:** 22
- **Missing from `.env.local` (referenced in code):** 16
- **Missing from `.env.example` (referenced in code):** 7
- **Security findings:** 1 (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in env files but unreferenced)

---

## 1. Supabase

### NEXT_PUBLIC_SUPABASE_URL
| Field | Value |
|---|---|
| **Type** | Client-exposed (`NEXT_PUBLIC_`) |
| **Service** | Supabase |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- used with `!` non-null assertion; crash if missing |
| **Failure mode** | Runtime crash (undefined passed to Supabase client constructor) |
| **Risk** | HIGH -- app will not function at all |
| **Files** | `src/lib/supabase/server.ts:8,33`, `src/lib/supabase/client.ts:7`, `src/lib/supabase/middleware.ts:51`, `scripts/seed.ts:5` |

### NEXT_PUBLIC_SUPABASE_ANON_KEY
| Field | Value |
|---|---|
| **Type** | Client-exposed (`NEXT_PUBLIC_`) |
| **Service** | Supabase |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Runtime crash |
| **Risk** | HIGH -- app will not function at all |
| **Files** | `src/lib/supabase/server.ts:9`, `src/lib/supabase/client.ts:8`, `src/lib/supabase/middleware.ts:52` |

### SUPABASE_SERVICE_ROLE_KEY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Supabase |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Runtime crash on any admin/service operation |
| **Risk** | HIGH -- all server-side DB admin operations fail |
| **Files** | `src/lib/supabase/server.ts:34`, `scripts/seed.ts:6` |

---

## 2. Retell AI

### RETELL_API_KEY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes (fallback key; per-client encrypted keys take precedence when available) |
| **Failure mode** | Throws `"No Retell API key available"` if no per-client key exists |
| **Risk** | HIGH -- core agent functionality breaks |
| **Files** | `src/lib/retell.ts:4`, `src/lib/prompt-generator.ts:415`, `src/lib/oauth/register-agent-tools.ts:211`, `src/app/api/usage/agent-costs/route.ts:47`, `src/app/api/agents/[id]/route.ts:44`, `src/app/api/agents/[id]/knowledge-base/[sourceId]/route.ts:48`, `src/app/api/agents/[id]/knowledge-base/route.ts:74`, `src/app/api/agents/sync-call/route.ts:35`, `src/app/api/agents/[id]/chat/route.ts:38`, `src/app/api/agents/[id]/voices/route.ts:31`, `src/app/api/agents/[id]/publish/route.ts:28`, `src/app/api/agents/[id]/config/route.ts:88,256`, `src/app/api/agents/[id]/versions/route.ts:28,97`, `src/app/api/agents/create-web-call/route.ts:33`, `src/app/api/onboarding/create-agent/route.ts:80`, `src/app/api/onboarding/test-call/route.ts:33`, `src/app/api/onboarding/test-sms/route.ts:38`, `src/app/api/demo-call/route.ts:36`, `src/app/api/webhooks/retell/route.ts:16,67`, `src/app/api/conversation-flows/[id]/route.ts:184`, `src/app/api/phone-numbers/caller-id/route.ts:53` |

### RETELL_TOOLS_API_KEY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (custom tool auth) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes for tool endpoint auth; silent failure if missing (auth headers not added) |
| **Failure mode** | Tool endpoints return 401 when called by Retell agents; tool registration silently skips auth headers |
| **Risk** | MEDIUM -- agent tools (calendar, calendly, hubspot) will fail authentication |
| **Files** | `src/lib/oauth/register-agent-tools.ts:247`, `src/app/api/tools/calendly/availability/route.ts:7`, `src/app/api/tools/calendly/book/route.ts:7`, `src/app/api/tools/hubspot/lookup/route.ts:8`, `src/app/api/tools/calendar/availability/route.ts:9`, `src/app/api/tools/calendar/book/route.ts:8` |

### RETELL_AGENT_HEALTHCARE
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent -- demo call for this vertical won't work |
| **Risk** | LOW -- marketing demo only |
| **Files** | `src/app/api/demo-call/route.ts:5` |

### RETELL_AGENT_LEGAL
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent -- demo call for this vertical won't work |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:6` |

### RETELL_AGENT_HOME_SERVICES
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:7` |

### RETELL_AGENT_REAL_ESTATE
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:8` |

### RETELL_AGENT_INSURANCE
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:9` |

### RETELL_AGENT_FINANCIAL
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:10` |

### RETELL_AGENT_AUTOMOTIVE
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:11` |

### RETELL_AGENT_HOSPITALITY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- has `|| ""` fallback |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/app/api/demo-call/route.ts:12` |

### RETELL_FROM_NUMBER
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Retell AI (demo outbound call) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes for demo calls |
| **Failure mode** | Error response -- demo call creation fails |
| **Risk** | LOW -- marketing demo only |
| **Files** | `src/app/api/demo-call/route.ts:44` |

---

## 3. Stripe

### STRIPE_SECRET_KEY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Stripe |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- throws `"STRIPE_SECRET_KEY is not set"` |
| **Failure mode** | Runtime crash on any Stripe operation |
| **Risk** | HIGH -- all billing/checkout/webhook operations fail |
| **Files** | `src/lib/stripe.ts:4`, `scripts/add-invoice-paid-webhook.ts:19` |

### NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
| Field | Value |
|---|---|
| **Type** | Client-exposed (`NEXT_PUBLIC_`) |
| **Service** | Stripe |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | **UNUSED -- no code references this variable** |
| **Failure mode** | N/A |
| **Risk** | LOW (dead config) |
| **Files** | **None** -- only in `.env.example` and `.env.local` |
| **Note** | This variable is defined but never consumed by any source file. It may be intended for a future Stripe.js client-side integration or was left over from a removed feature. |

### STRIPE_WEBHOOK_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Stripe |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- returns 500 if missing |
| **Failure mode** | Stripe webhook endpoint returns 500 |
| **Risk** | HIGH -- subscription lifecycle events will not be processed |
| **Files** | `src/app/api/webhooks/stripe/route.ts:23` |

---

## 4. Resend (Email)

### RESEND_API_KEY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Resend |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- throws `"RESEND_API_KEY is not set"` |
| **Failure mode** | Runtime crash on any email send (contact form, cron emails, webhook notifications) |
| **Risk** | HIGH -- all email functionality breaks |
| **Files** | `src/lib/resend.ts:4` |

---

## 5. Encryption

### ENCRYPTION_KEY
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | AES-256-GCM encryption (for OAuth token storage) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes -- throws `"ENCRYPTION_KEY must be a 64-character hex string"` |
| **Failure mode** | Runtime crash on any encrypt/decrypt operation (OAuth token storage, API key encryption) |
| **Risk** | HIGH -- all OAuth flows and encrypted key retrieval break |
| **Files** | `src/lib/crypto.ts:9` |

---

## 6. OAuth Providers

### GOOGLE_CLIENT_ID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Google OAuth (Calendar + Sheets) |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes (empty string) |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | OAuth authorize/callback will fail with undefined client ID |
| **Risk** | MEDIUM -- Google integration won't work, but only affects clients using Google Calendar/Sheets |
| **Files** | `src/lib/oauth/providers.ts:22` |

### GOOGLE_CLIENT_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Google OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes (empty string) |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Token exchange will fail |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:23` |

### SLACK_CLIENT_ID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Slack OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes (empty string) |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Slack OAuth flow fails |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:30` |

### SLACK_CLIENT_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Slack OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes (empty string) |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Token exchange fails |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:31` |

### HUBSPOT_CLIENT_ID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | HubSpot OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes (empty string) |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | HubSpot OAuth flow fails |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:42` |

### HUBSPOT_CLIENT_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | HubSpot OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes (empty string) |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Token exchange fails |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:43` |

### CALENDLY_CLIENT_ID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Calendly OAuth |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Calendly OAuth flow fails |
| **Risk** | MEDIUM -- undocumented and missing |
| **Files** | `src/lib/oauth/providers.ts:50` |

### CALENDLY_CLIENT_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Calendly OAuth |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Token exchange fails |
| **Risk** | MEDIUM -- undocumented and missing |
| **Files** | `src/lib/oauth/providers.ts:51` |

### QUICKBOOKS_CLIENT_ID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | QuickBooks OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | QuickBooks OAuth flow fails |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:58` |

### QUICKBOOKS_CLIENT_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | QuickBooks OAuth |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes -- used with `!` non-null assertion |
| **Failure mode** | Token exchange fails |
| **Risk** | MEDIUM |
| **Files** | `src/lib/oauth/providers.ts:59` |

### QUICKBOOKS_SANDBOX
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | QuickBooks |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- defaults to production API base when not `"true"` |
| **Failure mode** | Silent -- uses production URL by default |
| **Risk** | LOW |
| **Files** | `src/lib/oauth/executors/quickbooks.ts:18` |

---

## 7. Twilio

### TWILIO_ACCOUNT_SID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Twilio |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- returns `null` client if missing (graceful) |
| **Failure mode** | Silent -- SMS sending logs a message and returns |
| **Risk** | LOW -- graceful degradation |
| **Files** | `src/lib/twilio.ts:7` |

### TWILIO_AUTH_TOKEN
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Twilio |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- same graceful check as SID |
| **Failure mode** | Silent |
| **Risk** | LOW |
| **Files** | `src/lib/twilio.ts:8` |

### TWILIO_PHONE_NUMBER
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Twilio |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- returns early if missing |
| **Failure mode** | Silent -- SMS not sent |
| **Risk** | LOW |
| **Files** | `src/lib/twilio.ts:20` |

### TWILIO_MESSAGING_SERVICE_SID
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Twilio (scheduled SMS reminders) |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- returns early if missing |
| **Failure mode** | Silent -- scheduled reminders not sent |
| **Risk** | LOW |
| **Files** | `src/lib/oauth/executors/twilio-sms.ts:121` |

---

## 8. App / Platform

### NEXT_PUBLIC_APP_URL
| Field | Value |
|---|---|
| **Type** | Client-exposed (`NEXT_PUBLIC_`) |
| **Service** | App configuration |
| **In `.env.example`** | Yes (default `http://localhost:3000`) |
| **In `.env.local`** | Yes |
| **Required** | Mostly required -- some usages have fallbacks, many do not |
| **Failure mode** | Mixed -- some redirect URLs will use fallback domain, others will be `undefined/...` producing broken URLs |
| **Risk** | HIGH -- OAuth callbacks, Stripe redirects, and billing portal links will be broken URLs if missing |
| **Files** | `src/lib/oauth/register-agent-tools.ts:5`, `src/app/api/cron/checkin-email/route.ts:59`, `src/app/api/oauth/callback/route.ts:17,23,32,53,67,79,101,201,214,219`, `src/app/api/oauth/authorize/route.ts:30`, `src/app/api/checkout/route.ts:61`, `src/app/api/billing/route.ts:45,46,57,58`, `src/app/api/client/billing/route.ts:170`, `src/app/api/webhooks/stripe/route.ts:180,353,544,742`, `src/app/api/webhooks/retell/route.ts:261` |
| **Note** | Inconsistent fallback behavior: some files use `\|\| "https://app.invarialabs.com"`, some use `\|\| "https://portal.invarialabs.com"`, some use `\|\| ""`, and many have no fallback at all. |

### MARKETING_SITE_URL
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Checkout CORS / redirect validation |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | Yes |
| **Required** | Optional -- only adds to allowed origins if set |
| **Failure mode** | Silent -- cross-origin checkout return URLs from marketing site rejected |
| **Risk** | LOW |
| **Files** | `src/app/api/checkout/route.ts:63,64` |

### CRON_SECRET
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Vercel Cron job authentication |
| **In `.env.example`** | **NO -- MISSING** |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Yes for cron jobs -- returns 401 if missing or mismatched |
| **Failure mode** | Cron endpoints always return 401 Unauthorized |
| **Risk** | MEDIUM -- daily digest emails and check-in emails will never be sent |
| **Files** | `src/app/api/cron/checkin-email/route.ts:10`, `src/app/api/cron/daily-digest/route.ts:12` |
| **Note** | Vercel automatically injects `CRON_SECRET` for cron routes, but it must be configured in the project's environment settings. It is undocumented in `.env.example`. |

### CONTACT_FORM_EMAIL
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Contact form recipient |
| **In `.env.example`** | Yes |
| **In `.env.local`** | **NO -- MISSING** |
| **Required** | Optional -- defaults to `"hello@invarialabs.com"` |
| **Failure mode** | Silent -- sends to default address |
| **Risk** | LOW |
| **Files** | `src/app/api/contact/route.ts:15` |

### PLATFORM_PLAN_ID_STARTER
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Marketing checkout |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes for marketing checkout -- returns 400 "Unknown plan" if missing |
| **Failure mode** | Marketing checkout for starter plan returns 400 |
| **Risk** | MEDIUM |
| **Files** | `src/app/api/marketing-checkout/route.ts:7` |

### PLATFORM_PLAN_ID_PROFESSIONAL
| Field | Value |
|---|---|
| **Type** | Server-only |
| **Service** | Marketing checkout |
| **In `.env.example`** | Yes |
| **In `.env.local`** | Yes |
| **Required** | Yes for marketing checkout -- returns 400 "Unknown plan" if missing |
| **Failure mode** | Marketing checkout for professional plan returns 400 |
| **Risk** | MEDIUM |
| **Files** | `src/app/api/marketing-checkout/route.ts:8` |

---

## Findings by Category

### FINDING-ENV-01: Variables referenced in code but missing from `.env.example`

These variables are used in code but not documented for developers:

| Variable | Service | Risk |
|---|---|---|
| `CALENDLY_CLIENT_ID` | Calendly OAuth | MEDIUM |
| `CALENDLY_CLIENT_SECRET` | Calendly OAuth | MEDIUM |
| `QUICKBOOKS_SANDBOX` | QuickBooks | LOW |
| `TWILIO_ACCOUNT_SID` | Twilio | LOW |
| `TWILIO_AUTH_TOKEN` | Twilio | LOW |
| `TWILIO_PHONE_NUMBER` | Twilio | LOW |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio | LOW |
| `CRON_SECRET` | Vercel Cron | MEDIUM |
| `MARKETING_SITE_URL` | Checkout CORS | LOW |

**Impact:** Developers setting up the project from `.env.example` will not know these variables exist. The Calendly OAuth and CRON_SECRET omissions are the most impactful since they cause hard failures (undefined credentials and 401 responses respectively).

---

### FINDING-ENV-02: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is defined but never used

This variable exists in both `.env.example` and `.env.local` but is not referenced anywhere in the codebase. It is either:
- Left over from a removed Stripe.js client-side integration
- Intended for a future feature that was never implemented

**Risk:** LOW -- dead configuration, no runtime impact. However, a live Stripe publishable key is sitting unused in the env files.

---

### FINDING-ENV-03: `RETELL_TOOLS_API_KEY` missing from `.env.local`

This variable is documented in `.env.example` but not set in `.env.local`. It serves as the shared secret for authenticating Retell custom tool HTTP calls. Without it:
- Tool endpoints (`/api/tools/calendar/*`, `/api/tools/calendly/*`, `/api/tools/hubspot/*`) reject all requests with implicit 401
- `addAuthHeaders()` silently returns tools without auth headers, meaning Retell agents call endpoints that then reject them

**Risk:** MEDIUM -- all Retell-to-app tool integrations are broken in local development.

---

### FINDING-ENV-04: `CRON_SECRET` undocumented and missing

The two Vercel cron endpoints (`/api/cron/daily-digest` and `/api/cron/checkin-email`) both require `CRON_SECRET` for Bearer token auth. This is not in `.env.example` and not in `.env.local`.

- In Vercel deployments, this is automatically provided if configured in project settings
- In local development, the cron endpoints will always return 401

**Risk:** MEDIUM -- cron-driven features (daily digest, check-in emails) cannot be tested locally.

---

### FINDING-ENV-05: OAuth provider credentials are empty strings in `.env.local`

Google, Slack, and HubSpot OAuth client IDs and secrets are present in `.env.local` but set to empty strings. Since they are accessed with `!` (non-null assertion), TypeScript won't warn, but `""` will be sent as the client ID/secret, causing:
- OAuth authorize URLs with `client_id=` (empty)
- Token exchange requests with empty credentials

These integrations are non-functional in the current local environment. This is expected for local dev but worth noting.

**Risk:** LOW for local dev; HIGH if this pattern exists in production.

---

### FINDING-ENV-06: `NEXT_PUBLIC_APP_URL` has inconsistent fallback behavior

The variable is used in ~20 files across the codebase, but fallback handling is inconsistent:

| Fallback Pattern | Files |
|---|---|
| `\|\| "https://app.invarialabs.com"` | `webhooks/stripe/route.ts`, `webhooks/retell/route.ts`, `cron/checkin-email/route.ts` |
| `\|\| "https://portal.invarialabs.com"` | `oauth/register-agent-tools.ts` |
| `\|\| ""` | `checkout/route.ts` |
| No fallback (undefined if missing) | `oauth/callback/route.ts`, `oauth/authorize/route.ts`, `billing/route.ts`, `client/billing/route.ts` |

This means if `NEXT_PUBLIC_APP_URL` is unset in production, some features would use the wrong domain, and several would produce broken redirect URLs like `undefined/portal/automations`.

**Risk:** MEDIUM -- production outage risk if this env var is ever removed.

---

### FINDING-ENV-07: Security -- No sensitive secrets exposed via `NEXT_PUBLIC_`

All `NEXT_PUBLIC_` variables in the codebase:
- `NEXT_PUBLIC_SUPABASE_URL` -- safe (public project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- safe (designed to be public, RLS-protected)
- `NEXT_PUBLIC_APP_URL` -- safe (public URL)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` -- safe (designed to be public), though unused

No server secrets (service role keys, API keys, webhook secrets) are exposed via `NEXT_PUBLIC_` prefix. This is correct.

---

## Quick Reference: All Variables

| # | Variable | Service | Type | .env.example | .env.local | Required | Crash? |
|---|---|---|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Client | Yes | Set | Yes | Yes |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Client | Yes | Set | Yes | Yes |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server | Yes | Set | Yes | Yes |
| 4 | `RETELL_API_KEY` | Retell | Server | Yes | Set | Yes | Yes (throw) |
| 5 | `RETELL_TOOLS_API_KEY` | Retell | Server | Yes | **MISSING** | Yes | No (silent) |
| 6 | `RETELL_AGENT_HEALTHCARE` | Retell | Server | Yes | **MISSING** | No | No |
| 7 | `RETELL_AGENT_LEGAL` | Retell | Server | Yes | **MISSING** | No | No |
| 8 | `RETELL_AGENT_HOME_SERVICES` | Retell | Server | Yes | **MISSING** | No | No |
| 9 | `RETELL_AGENT_REAL_ESTATE` | Retell | Server | Yes | **MISSING** | No | No |
| 10 | `RETELL_AGENT_INSURANCE` | Retell | Server | Yes | **MISSING** | No | No |
| 11 | `RETELL_AGENT_FINANCIAL` | Retell | Server | Yes | **MISSING** | No | No |
| 12 | `RETELL_AGENT_AUTOMOTIVE` | Retell | Server | Yes | **MISSING** | No | No |
| 13 | `RETELL_AGENT_HOSPITALITY` | Retell | Server | Yes | **MISSING** | No | No |
| 14 | `RETELL_FROM_NUMBER` | Retell | Server | Yes | **MISSING** | Yes (demo) | No (error resp) |
| 15 | `STRIPE_SECRET_KEY` | Stripe | Server | Yes | Set | Yes | Yes (throw) |
| 16 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Client | Yes | Set | **UNUSED** | N/A |
| 17 | `STRIPE_WEBHOOK_SECRET` | Stripe | Server | Yes | Set | Yes | No (500 resp) |
| 18 | `RESEND_API_KEY` | Resend | Server | Yes | Set | Yes | Yes (throw) |
| 19 | `ENCRYPTION_KEY` | Crypto | Server | Yes | Set | Yes | Yes (throw) |
| 20 | `GOOGLE_CLIENT_ID` | Google OAuth | Server | Yes | Set (empty) | Yes | Broken OAuth |
| 21 | `GOOGLE_CLIENT_SECRET` | Google OAuth | Server | Yes | Set (empty) | Yes | Broken OAuth |
| 22 | `SLACK_CLIENT_ID` | Slack OAuth | Server | Yes | Set (empty) | Yes | Broken OAuth |
| 23 | `SLACK_CLIENT_SECRET` | Slack OAuth | Server | Yes | Set (empty) | Yes | Broken OAuth |
| 24 | `HUBSPOT_CLIENT_ID` | HubSpot OAuth | Server | Yes | Set (empty) | Yes | Broken OAuth |
| 25 | `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth | Server | Yes | Set (empty) | Yes | Broken OAuth |
| 26 | `CALENDLY_CLIENT_ID` | Calendly OAuth | Server | **MISSING** | **MISSING** | Yes | Broken OAuth |
| 27 | `CALENDLY_CLIENT_SECRET` | Calendly OAuth | Server | **MISSING** | **MISSING** | Yes | Broken OAuth |
| 28 | `QUICKBOOKS_CLIENT_ID` | QuickBooks OAuth | Server | Yes | **MISSING** | Yes | Broken OAuth |
| 29 | `QUICKBOOKS_CLIENT_SECRET` | QuickBooks OAuth | Server | Yes | **MISSING** | Yes | Broken OAuth |
| 30 | `QUICKBOOKS_SANDBOX` | QuickBooks | Server | **MISSING** | **MISSING** | No | No |
| 31 | `TWILIO_ACCOUNT_SID` | Twilio | Server | **MISSING** | **MISSING** | No | No (graceful) |
| 32 | `TWILIO_AUTH_TOKEN` | Twilio | Server | **MISSING** | **MISSING** | No | No (graceful) |
| 33 | `TWILIO_PHONE_NUMBER` | Twilio | Server | **MISSING** | **MISSING** | No | No (graceful) |
| 34 | `TWILIO_MESSAGING_SERVICE_SID` | Twilio | Server | **MISSING** | **MISSING** | No | No (graceful) |
| 35 | `NEXT_PUBLIC_APP_URL` | App | Client | Yes | Set | Yes | Broken URLs |
| 36 | `MARKETING_SITE_URL` | App | Server | **MISSING** | Set | No | No |
| 37 | `CRON_SECRET` | Vercel Cron | Server | **MISSING** | **MISSING** | Yes (cron) | No (401 resp) |
| 38 | `CONTACT_FORM_EMAIL` | Contact Form | Server | Yes | **MISSING** | No | No |
| 39 | `PLATFORM_PLAN_ID_STARTER` | Checkout | Server | Yes | Set | Yes | No (400 resp) |
| 40 | `PLATFORM_PLAN_ID_PROFESSIONAL` | Checkout | Server | Yes | Set | Yes | No (400 resp) |

---

## Recommendations (for team review)

1. **Add Calendly OAuth vars to `.env.example`** -- `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET` are used in code with `!` assertions but completely undocumented.
2. **Add `CRON_SECRET` to `.env.example`** -- Required for cron job auth, undocumented.
3. **Add Twilio vars to `.env.example`** -- Four variables used in code but not documented. Even though they degrade gracefully, developers should know they exist.
4. **Add `MARKETING_SITE_URL` and `QUICKBOOKS_SANDBOX` to `.env.example`** -- Referenced in code but undocumented.
5. **Set `RETELL_TOOLS_API_KEY` in `.env.local`** -- Without it, Retell custom tool authentication is broken.
6. **Remove or use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** -- Dead configuration.
7. **Standardize `NEXT_PUBLIC_APP_URL` fallback behavior** -- Currently inconsistent across files; some have no fallback at all.
