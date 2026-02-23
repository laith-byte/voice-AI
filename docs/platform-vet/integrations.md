# Integration Audit Report

**Auditor:** integration-auditor
**Date:** 2026-02-22
**Scope:** Webhooks, OAuth flows, CRM tool routes, post-call pipeline, retry queue

---

## 1. Webhook Endpoints

### 1.1 Stripe (`src/app/api/webhooks/stripe/route.ts`)

- **Auth:** Verifies `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` using `constructWebhookEvent()` (lines 18-38). Rejects with 400 if signature missing or invalid. Returns 500 if secret not configured.
- **Findings:** PASS. Signature verification is correct; raw body is preserved for HMAC check. Unhandled events are acknowledged gracefully (line 78-81). HTML output in emails uses `escapeHtml()` throughout (line 766-773).
- **No issues found.**

### 1.2 Retell (`src/app/api/webhooks/retell/route.ts`)

- **Auth:** Verifies `x-retell-signature` header using `Retell.verify(rawBody, apiKey, signature)` (line 20). Rejects with 401 if invalid.
- **Findings:** PASS. Uses SDK-provided signature verification. Raw body is preserved for verification. Client lookup is via `retell_agent_id` DB query (lines 36-47), not hardcoded.
- **No issues found.**

### 1.3 Housecall Pro (`src/app/api/webhooks/housecallpro/route.ts`)

- **Auth:** Checks `x-webhook-secret` header OR `?secret=` query param against `HOUSECALLPRO_WEBHOOK_SECRET` (lines 7-11). Rejects with 401 if mismatch.
- **Client lookup:** Uses `provider_metadata->>company_id` on `oauth_connections` (lines 25-31). No hardcoded client_id.
- **No "unknown" fallback:** If `companyId` is missing, returns 200 without logging (line 21-22). If no connection found, warns and returns 200 (line 34). Neither case assigns an "unknown" client_id.
- **Findings:** PASS.
- **No issues found.**

### 1.4 Jobber (`src/app/api/webhooks/jobber/route.ts`)

- **Auth:** Checks `x-webhook-secret` header OR `?secret=` query param against `JOBBER_WEBHOOK_SECRET` (lines 7-11). Rejects with 401 if mismatch.
- **Client lookup:** Uses `provider_metadata->>account_id` on `oauth_connections` (lines 25-31). No hardcoded client_id.
- **No "unknown" fallback:** If `accountId` is missing, returns 200 without logging (line 19-21). If no connection found, warns and returns 200 (line 34). Neither case assigns an "unknown" client_id.
- **Findings:** PASS.
- **No issues found.**

---

## 2. CRM Tool Routes

### 2.1 Housecall Pro Tool Routes

All 4 routes check `RETELL_TOOLS_API_KEY` via Bearer token:

| Route | File | Auth Check (line) | Status |
|-------|------|-------------------|--------|
| lookup | `src/app/api/tools/housecallpro/lookup/route.ts` | Lines 18-21 | PASS |
| book | `src/app/api/tools/housecallpro/book/route.ts` | Lines 7-10 | PASS |
| create-estimate | `src/app/api/tools/housecallpro/create-estimate/route.ts` | Lines 7-10 | PASS |
| availability | `src/app/api/tools/housecallpro/availability/route.ts` | Lines 5-8 | PASS |

All routes use OAuth token via `getValidToken(client_id, "housecallpro")`. REST API calls use `encodeURIComponent` for user input in URLs. No SQL or command injection vectors.

### 2.2 Jobber Tool Routes

All 4 routes check `RETELL_TOOLS_API_KEY` via Bearer token:

| Route | File | Auth Check (line) | Status |
|-------|------|-------------------|--------|
| lookup | `src/app/api/tools/jobber/lookup/route.ts` | Lines 6-9 | PASS |
| availability | `src/app/api/tools/jobber/availability/route.ts` | Lines 6-9 | PASS |
| book | `src/app/api/tools/jobber/book/route.ts` | Lines 6-9 | PASS |
| create-quote | `src/app/api/tools/jobber/create-quote/route.ts` | Lines 6-9 | PASS |

---

## 3. GraphQL Injection Audit (Jobber)

This was a previous blocker. Every Jobber GraphQL query across the entire codebase was verified.

### All queries use parameterized $variables -- ZERO string interpolation found:

| File | Query | Variables Used |
|------|-------|---------------|
| `tools/jobber/lookup/route.ts:28` | `query($searchTerm: String!) { clients(searchTerm: $searchTerm) ... }` | `{ searchTerm: caller_phone_number }` |
| `tools/jobber/availability/route.ts:32` | `query($startAt: DateTime!, $endAt: DateTime!) { calendarEvents(...) ... }` | `{ startAt, endAt }` |
| `tools/jobber/book/route.ts:29` | `query($searchTerm: String!) { clients(...) ... }` | `{ searchTerm: customer_phone }` |
| `tools/jobber/book/route.ts:45` | `mutation($input: ClientCreateInput!) { clientCreate(...) ... }` | `{ input: { firstName, lastName, phones } }` |
| `tools/jobber/book/route.ts:70` | `mutation($input: JobCreateInput!) { jobCreate(...) ... }` | `{ input: { clientId, title, startAt, endAt, instructions } }` |
| `tools/jobber/create-quote/route.ts:29` | `query($searchTerm: String!) { clients(...) ... }` | `{ searchTerm: customer_phone }` |
| `tools/jobber/create-quote/route.ts:45` | `mutation($input: ClientCreateInput!) { clientCreate(...) ... }` | `{ input: { firstName, lastName, phones } }` |
| `tools/jobber/create-quote/route.ts:65` | `mutation($input: QuoteCreateInput!) { quoteCreate(...) ... }` | `{ input: { clientId, title, message } }` |
| `lib/oauth/executors/jobber.ts:81` | `query($searchTerm: String!) { clients(...) ... }` | `{ searchTerm: phone }` |
| `lib/oauth/executors/jobber.ts:107` | `mutation($input: ClientCreateInput!) { clientCreate(...) ... }` | `{ input: createInput }` |
| `lib/oauth/executors/jobber.ts:146` | `mutation($input: RequestCreateInput!) { requestCreate(...) ... }` | `{ input: { clientId, title, details } }` |

### One exception (non-issue):

- **`src/app/api/oauth/callback/route.ts:239`** -- The Jobber account info query during OAuth callback uses an inline query with no user input: `{ account { id name } user { id name { full } email { raw } } }`. This query has zero dynamic values -- it is a static introspection query fetching the authenticated user's own account. **No injection risk.**

**Verdict: No GraphQL injection. Previous blocker is fully resolved.**

---

## 4. OAuth Flows

### 4.1 Authorize (`src/app/api/oauth/authorize/route.ts`)

- Uses `requireAuth()` to ensure user is logged in (line 8).
- Validates provider against `SUPPORTED_PROVIDERS` whitelist (line 15).
- Uses encrypted+timestamped state via `createOAuthState()` (line 29).
- No issues found.

### 4.2 Callback (`src/app/api/oauth/callback/route.ts`)

- Parses and validates encrypted state with 10-minute expiry (lines 28-34, `state.ts:32`).
- Verifies authenticated user is authorized for the `clientId` in state (lines 39-76): client users must match `client_id`, org admins must own the client via `organization_id`.
- Tokens are encrypted before storage via `encrypt()` (lines 265-266).
- Provider-specific metadata is fetched and stored for each supported provider (HCP, Jobber, Google, HubSpot, Salesforce, GoHighLevel, Calendly, Slack, QuickBooks).
- No issues found.

### 4.3 Connections (`src/app/api/oauth/connections/route.ts`)

- Uses `requireAuth()` (line 6). Uses user-scoped Supabase client with RLS (line 16).
- Does NOT expose `access_token` or `refresh_token` in response (line 18 -- selects only non-sensitive columns).
- No issues found.

### 4.4 Disconnect (`src/app/api/oauth/disconnect/route.ts`)

- Uses `requireAuth()` (line 10). Validates user ownership via `getClientId()`.
- Attempts token revocation (best-effort, line 41-55).
- Unregisters Retell tools (line 58-64).
- Deletes connection from DB (line 67-71).
- No issues found.

### 4.5 Google Sheets/Calendars, Slack Channels

- All three routes (`google/sheets`, `google/calendars`, `slack/channels`) use `requireAuth()` + `getClientId()` + `getValidToken()`.
- No issues found.

### 4.6 OAuth State Security (`src/lib/oauth/state.ts`)

- State is encrypted via `encrypt()` (AES), not just base64-encoded.
- State includes timestamp; `parseOAuthState()` enforces 10-minute max age.
- No CSRF vulnerability.

---

## 5. Transcript Extraction (`src/lib/transcript-extraction.ts`)

### Word-boundary regression check:

- `buildKeywordRegex()` (lines 75-82) correctly uses `\b` word boundaries for single-word keywords and literal matching for multi-word phrases.
- Single-word examples: `"fire"` becomes `/\bfire\b/i`, `"today"` becomes `/\btoday\b/i`, `"asap"` becomes `/\basap\b/i`.
- Multi-word examples: `"gas leak"` becomes `/gas leak/i` (no word boundaries needed for phrases).
- Patterns are pre-compiled at module level (lines 84-85).
- `classifyUrgency()` uses these patterns correctly (lines 179-191).

**Verdict: Word-boundary regression is NOT present. Fix is in place and correct.**

---

## 6. Post-Call Pipeline

### 6.1 Executors (`src/lib/oauth/executors/housecallpro.ts`, `jobber.ts`)

Both executors follow the required pattern:

| Requirement | HCP (`housecallpro.ts`) | Jobber (`jobber.ts`) | Status |
|-------------|-------------------------|----------------------|--------|
| Calls `logIntegrationEvent` on success | Lines 141-148, 178-190 | Lines 118-125, 160-172 | PASS |
| Calls `logIntegrationEvent` on failure | Lines 79-87 (token), 195-202 (API) | Lines 64-72 (token), 180-187 (API) | PASS |
| Calls `enqueueRetry` on token failure | Lines 73-78 | Lines 58-63 | PASS |
| Calls `enqueueRetry` on transient API errors (429/500/503) | Lines 204-211 | Lines 189-196 | PASS |
| Uses `extractStructuredData` for transcript parsing | Lines 62-66 | Lines 48-52 | PASS |
| Uses `mapServiceToCategory` for service mapping | Line 176 | Line 129 | PASS |

### 6.2 Post-Call Actions (`src/lib/post-call-actions.ts`)

- Supports 4 action types: `email_summary`, `sms_notification`, `caller_followup_email`, `webhook`.
- All email content uses `escapeHtml()` (lines 136, 147, 151, 293-299).
- Trigger filtering is correct (line 68-69).
- Note: `delay_minutes` config for caller followup is ignored on serverless (line 237-238) -- documented inline.

### 6.3 Integration Events (`src/lib/integration-events.ts`)

- Fire-and-forget pattern with error catching (lines 22-24).
- No issues found.

---

## 7. Retry Queue (`src/lib/integration-retry.ts`)

### Backoff schedule verification:

- Defined as `BACKOFF_MINUTES = [1, 5, 15, 60, 240]` (line 4).
- Index calculation: `BACKOFF_MINUTES[Math.min(newAttempt - 1, BACKOFF_MINUTES.length - 1)]` (line 102).
  - Attempt 1 -> index 0 -> 1 min
  - Attempt 2 -> index 1 -> 5 min
  - Attempt 3 -> index 2 -> 15 min
  - Attempt 4 -> index 3 -> 60 min
  - Attempt 5+ -> index 4 -> 240 min (capped)
- **Correct exponential backoff.**

### Queue processing:

- Fetches up to 50 pending items where `next_attempt_at` has passed (lines 48-51).
- Marks items as `processing` before execution (lines 61-63).
- On success: marks `completed` (lines 77-82).
- On max attempts exceeded: moves to `dead_letter` (lines 91-99).
- On transient failure: schedules next attempt with backoff (lines 101-114).

**No issues found.**

---

## 8. Minor Observations

### COSMETIC-1: Webhook secret via query parameter

Both HCP and Jobber webhooks accept the secret via `?secret=` query parameter (lines 7-8 in both files). While not a security issue per se (HTTPS encrypts the URL in transit), secrets in URLs can appear in access logs. Header-only would be slightly more secure.

### COSMETIC-2: Generic error swallowing in HCP/Jobber webhooks

Both CRM webhooks return 200 even on errors (catch block, line 52 in both). This is intentional (prevents provider from retrying non-recoverable errors), but the error is only logged to console. Consider logging to `webhook_logs` table for observability.

### COSMETIC-3: `delay_minutes` on caller follow-up email

The `delay_minutes` config in `post-call-actions.ts` (line 225) is silently ignored on serverless. A warning log or validation at config time would improve UX.

---

## Integration Verdicts

### Housecall Pro: PASS

- Webhook auth: verified via shared secret
- Client lookup: dynamic via `provider_metadata->>company_id`
- No "unknown" fallback
- Tool routes: all 4 check `RETELL_TOOLS_API_KEY`
- Executor: logs events + enqueues retries on failure
- REST API calls use `encodeURIComponent` for user input

### Jobber: PASS

- Webhook auth: verified via shared secret
- Client lookup: dynamic via `provider_metadata->>account_id`
- No "unknown" fallback
- Tool routes: all 4 check `RETELL_TOOLS_API_KEY`
- GraphQL: ALL queries use parameterized `$variables` -- zero string interpolation
- Executor: logs events + enqueues retries on failure

### Stripe: PASS

- Webhook auth: cryptographic signature verification via `constructWebhookEvent()`
- Handles all relevant subscription lifecycle events
- HTML emails use `escapeHtml()`

### Retell: PASS

- Webhook auth: cryptographic signature verification via `Retell.verify()`
- Client lookup: dynamic via `retell_agent_id` DB query
- Post-call pipeline: triggers PII redaction, automation recipes, Zapier/Make/n8n dispatch, lead scoring

---

## Summary

| Category | Count | Details |
|----------|-------|---------|
| **BLOCKER** | 0 | None |
| **WARNING** | 0 | None |
| **REGRESSION** | 0 | All previously reported regressions verified as fixed |
| **COSMETIC** | 3 | Webhook secret in URL params, error swallowing, delay_minutes no-op |

**Overall: All 4 integrations PASS. No blockers, no warnings, no regressions. Ship-ready.**
