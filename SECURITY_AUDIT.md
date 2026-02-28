# Security and Reliability Audit

Targeted audit of the highest-risk areas. Findings are organized by severity with file paths, line numbers, and recommended fixes.

---

## Summary

| Severity | Count |
|----------|--------|
| CRITICAL | 2 |
| HIGH     | 5 |
| MEDIUM   | 12 |
| LOW      | 8 |

---

## CRITICAL

### C1. `call_started` webhook is not idempotent — duplicate events can create duplicate or failing rows

**Status:** FIXED (2025-02-27)

**File:** `src/app/api/webhooks/retell/route.ts`  
**Lines:** 76–134 (case `call_started`)

**Finding:** If Retell sends `call_started` twice for the same call, the handler inserts into `call_logs` again. There is no check for an existing row with the same `retell_call_id`. Depending on DB constraints, this can create duplicate rows or trigger a unique constraint error (only logged, not returned).

**Fix:** Make `call_started` idempotent. Before inserting, check for an existing `call_logs` row with `retell_call_id === call.call_id`. If it exists, skip the insert (or update) and break.

```ts
// Before insert (around line 117), add:
const { data: existing } = await supabase
  .from("call_logs")
  .select("id")
  .eq("retell_call_id", call.call_id)
  .maybeSingle();
if (existing) break;
```

---

### C2. Automation recipe webhook URLs are not validated — SSRF via stored URLs

**Status:** FIXED (2025-02-27)

**File:** `src/lib/integration-recipes.ts`  
**Lines:** 88–96, 114–118

**Finding:** When executing automations, the code does `fetch(webhookUrl)` where `webhookUrl` comes from `config.webhook_url` or `recipe.n8n_webhook_url` (both from DB). There is no call to `isSafeWebhookUrl()`. A compromised or misconfigured client could store a URL like `http://169.254.169.254/latest/meta-data/` or `http://localhost/admin`, and when a call completes the server would request that URL.

**Fix:** Before every `fetch(webhookUrl)` in this file, validate the URL:

```ts
import { isSafeWebhookUrl } from "@/lib/url-validation";

// Before fetch at line 94 and 115:
if (!isSafeWebhookUrl(webhookUrl)) {
  await logFailure(supabase, automation, "Webhook URL blocked (SSRF)", 0);
  continue;
}
```

---

## HIGH

### H1. Zapier/Make/n8n subscribe accept arbitrary hook URLs without SSRF check

**Status:** FIXED (2025-02-27)

**Files:**
- `src/app/api/zapier/subscribe/route.ts` (lines 50–55, `hookUrl`)
- `src/app/api/make/subscribe/route.ts` (lines 50–55, `hookUrl`)
- `src/app/api/n8n/subscribe/route.ts` (lines 50–55, `hookUrl`)

**Finding:** Each subscribe endpoint accepts `hookUrl` from the request body and inserts it into the DB. When events are dispatched (e.g. `zapier.ts`, `make.ts`, `n8n.ts`), the app POSTs to these URLs. There is no validation that `hookUrl` is safe before insert. A client with a valid API key could register `http://169.254.169.254/` or an internal URL and receive server-side requests to that URL when events fire.

**Fix:** Before inserting the subscription, validate the URL and reject if unsafe:

```ts
import { isSafeWebhookUrl } from "@/lib/url-validation";

if (!hookUrl || typeof hookUrl !== "string") {
  return NextResponse.json({ error: "hookUrl is required" }, { status: 400 });
}
if (!isSafeWebhookUrl(hookUrl)) {
  return NextResponse.json({ error: "URL targets a private or internal address" }, { status: 400 });
}
```

Apply the same pattern in all three subscribe routes.

---

### H2. Webhook handler logs first event before signature verification (ordering is correct; one write has no error handling)

**Status:** FIXED (2025-02-27)

**File:** `src/app/api/webhooks/retell/route.ts`  
**Lines:** 26–32 (signature), 66–74 (first DB write)

**Finding:** Signature verification happens at lines 27–32, before any processing. The first DB write is at 66–74 (`webhook_logs.insert`). The insert has no error handling: if it fails, the code continues and the webhook still returns 200. So ordering is correct (signature before processing), but the first insert is not checked.

**Fix:** Check the result of the first `webhook_logs` insert. Optionally log and continue, or return 500 if logging is required for audit:

```ts
const { error: logError } = await supabase.from("webhook_logs").insert({ ... });
if (logError) {
  logger.error("Failed to insert webhook_log", { error: logError.message });
  // Optionally: return NextResponse.json({ error: "Logging failed" }, { status: 500 });
}
```

---

### H3. Lead lookup uses unsanitized phone number in `.or()` filter

**Status:** FIXED (2025-02-27)

**File:** `src/app/api/webhooks/retell/route.ts`  
**Line:** 369

**Finding:** `callerPhone` comes from `callLogRow.from_number` or `callLogRow.to_number` (originally from the webhook payload). It is used in `.or(\`phone.eq.${callerPhone}\`)`. If the value contained quote or backslash characters, it could break the query or, in the worst case, contribute to injection. Supabase client may parameterize, but the safe approach is to allow only expected characters for a phone number.

**Fix:** Normalize/sanitize before use. For example, allow only digits and leading `+`:

```ts
const sanitizedPhone = (callerPhone || "").replace(/[^\d+]/g, "");
if (!sanitizedPhone) continue;
// use sanitizedPhone in the .or() filter
```

---

### H4. Tool routes inconsistent use of `verifyToolAuth` — some only check API key

**Status:** FIXED (2025-02-27). All tool routes now use `verifyToolAuth(request)`; no route uses only `RETELL_TOOLS_API_KEY`. Files changed: `faq/search`, `availability/check`, `locations/nearest`, `business-hours/check`, `calendar/availability`, `policies/search`, `services/search`, `notes/create`, `intake/collect`, `leads/create`, `leads/update`, `callback`, `escalate`, `transfer/initiate`, `confirmation/send`, `appointments/check`, `appointments/cancel`, `calendar/book`, `calendly/availability`, `calendly/book`, `housecallpro/book`, `housecallpro/lookup`, `housecallpro/availability`, `housecallpro/create-estimate`, `salesforce/lookup`, `jobber/availability`, `jobber/book`, `jobber/create-quote`, `jobber/lookup`, `gohighlevel/lookup`, `hubspot/lookup`, `feedback/collect`, `contacts/lookup`, `waitlist/add`. `email/send` and `sms/send` already used `verifyToolAuth` (unchanged).

**Files:** Many under `src/app/api/tools/*`  
**Examples:** `src/app/api/tools/faq/search/route.ts` (inline API key check, no `verifyToolAuth`); `src/app/api/tools/sms/send/route.ts` (uses `verifyToolAuth`)

**Finding:** Some tool routes only check `RETELL_TOOLS_API_KEY` and take `client_id` from the request without verifying that the client exists. `verifyToolAuth` both validates the API key and ensures `client_id` exists. Inconsistent use means: (1) if the tools API key is leaked, callers could pass arbitrary `client_id` and some tools would still return data for that client; (2) behavior differs across tools.

**Fix:** Use `verifyToolAuth(request)` in every tool route that accepts `client_id`. Remove duplicate API key checks and rely on the shared helper so that client existence is always validated and behavior is consistent.

---

### H5. Health check exposes Supabase and is unauthenticated

**Status:** FIXED (2025-02-27). Health route now returns only `{ status: "ok" }` with no Supabase call or backend details; on exception returns generic "Health check failed" at 503.

**File:** `src/app/api/health/route.ts`  
**Lines:** 1–29

**Finding:** `GET /api/health` is public and uses `SUPABASE_SERVICE_ROLE_KEY` to run a simple query. It does not expose data but confirms that the app uses Supabase and that the DB is reachable. There is no rate limiting or auth.

**Fix:** (1) Consider protecting the route (e.g. `CRON_SECRET` or internal-only in production). (2) Or keep it public for load balancers but avoid revealing backend details (e.g. return only `{ status: "ok" }` without “Database check failed”). (3) Add rate limiting if it remains public.

---

## MEDIUM

### M1. Webhook handler: several DB writes have no error handling

**Status:** FIXED (2025-02-27). Every `webhook_logs` and `pending_callbacks` write now captures `{ error }`, logs with `logger.error` (table name + message), and continues; no 500 or stop.

**File:** `src/app/api/webhooks/retell/route.ts`

**Locations:**
- Lines 66–74: `webhook_logs.insert` — no check.
- Lines 184–191, 219–226, 231–237, 234–238: `pending_callbacks` updates — no check.

**Finding:** Errors are only logged with `console.error` for `call_logs` (e.g. 132, 172, 268). For `webhook_logs` and `pending_callbacks`, failed writes are not checked, so the handler can return 200 even when persistence failed.

**Fix:** For each write, capture `{ error }` and either log and continue or, for critical writes, return 500 so Retell can retry. At minimum, log all DB errors consistently (e.g. via `logger.error`).

---

### M2. `url-validation.ts` does not block IPv6 link-local or unique local

**Status:** FIXED (2025-02-27). Hostname is normalized to lowercase; added checks for `fe80:` and `[fe80:` (link-local), and for `fd`/`fc` with colon or `[fd`/`[fc` (unique-local), so internal IPv6 ranges are rejected.

**File:** `src/lib/url-validation.ts`
**Lines:** 14–28

**Finding:** The function blocks `::1`, `[::1]`, and the listed IPv4 ranges. It does not block IPv6 link-local (`fe80::/10`) or unique local (`fd00::/7`), which could be used to probe or attack internal networks over IPv6.

**Fix:** Reject hostnames that are IPv6 addresses in link-local or unique-local ranges (e.g. parse the hostname as IP and check range, or add string checks for `fe80:` and `fd` prefix after normalizing).

---

### M3. Rate limiting is in-memory when Redis is not configured

**Status:** FIXED (2025-02-27). When the in-memory fallback is used, a one-time `logger.warn` is emitted ("Rate limiting using in-memory fallback — limits are per-instance only") via a module-level flag.

**File:** `src/lib/rate-limit.ts`  
**Lines:** 9–51 (in-memory), 74–83 (fallback)

**Finding:** `publicEndpointLimiter` uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set; otherwise it falls back to an in-memory `Map`. In multi-instance or serverless environments without Redis, each instance has its own counter, so global rate limits are not enforced. The demo-call endpoint also uses a separate in-memory `createRateLimiter` for per-phone limits.

**Fix:** Document this in code and in runbooks: “Without Redis, rate limits are per-instance only.” Prefer deploying with Redis in production. Consider logging when the in-memory fallback is used so operators know limits are not global.

---

### M4. Post-call actions: `sendEmailSummary` sends to multiple recipients sequentially without per-recipient try/catch

**Status:** FIXED (2025-02-27). Each `sendEmail` in the recipients loop is wrapped in try/catch; on failure we log with `logger.error` (recipient + error message) and continue to the next recipient.

**File:** `src/lib/post-call-actions.ts`
**Lines:** 171–178

**Finding:** `for (const recipient of recipients) { await sendEmail({ to: recipient.trim(), ... }); }`. If one `sendEmail` throws, the loop stops and remaining recipients do not receive the summary. The outer `executePostCallActions` has a per-action try/catch (lines 87–105), so SMS and other action types still run.

**Fix:** Wrap each `sendEmail` in try/catch so one failure does not skip the rest:

```ts
for (const recipient of recipients) {
  try {
    await sendEmail({ to: recipient.trim(), ... });
  } catch (e) {
    console.error(`Email summary failed for ${recipient}:`, e);
  }
}
```

---

### M5. OAuth callback error redirects use hardcoded `/portal/...` path

**Status:** FIXED (2025-02-27). Error redirects use `redirectPath` from parsed OAuth state via `getRedirectPathFromState(stateParam)`; fallback to `/portal/integrations` when state is missing or invalid; `oauth_error` is preserved (and encoded) on the redirect URL.

**File:** `src/app/api/oauth/callback/route.ts`  
**Lines:** 17, 23, 32 (and similar)

**Finding:** Some error redirects use `${NEXT_PUBLIC_APP_URL}/portal/integrations?oauth_error=...` instead of the `redirectPath` from state. The middleware rewrites `/portal/...` to `/<slug>/portal/...` for client users, but the error query param may not be preserved or the UX may be inconsistent.

**Fix:** Use the `redirectPath` from the parsed state for all error redirects (and ensure state always includes a sensible default for redirectPath) so the user lands on the correct slug and sees the error.

---

### M6. Integration recipes: webhook execution has no timeout

**Status:** FIXED (2025-02-27). All webhook/email `fetch` calls use `signal: AbortSignal.timeout(15_000)`; on abort, catch logs "Webhook request timed out after 15s" to automation_logs.

**File:** `src/lib/integration-recipes.ts`
**Lines:** 94–96, 115–118

**Finding:** `fetch(webhookUrl, { method: "POST", ... })` has no `signal: AbortSignal.timeout(...)`. A slow or hanging target can keep the webhook request open until the platform timeout (e.g. Vercel 60s), delaying the response to Retell and increasing risk of retries and duplicate processing.

**Fix:** Add a timeout (e.g. 10–15 seconds):

```ts
fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(buildWebhookPayload(...)),
  signal: AbortSignal.timeout(15_000),
});
```

---

### M7. Retell webhook forward to agent/solution URLs has no timeout

**Status:** FIXED (2025-02-27). Forward fetch calls use `signal: AbortSignal.timeout(15_000)`; abort errors are caught and recorded as "timeout" in forwarding_result so one slow webhook does not delay the response.

**File:** `src/app/api/webhooks/retell/route.ts`
**Lines:** 356–362

**Finding:** The loop that forwards the payload to `agent.webhook_url` and solution webhooks uses `fetch(url, { method: "POST", ... })` with no timeout. A slow URL can delay the webhook response.

**Fix:** Add `signal: AbortSignal.timeout(15000)` (or similar) to the fetch options and catch abort errors so one slow webhook does not hold the response.

---

### M8. Crypto key is used raw from env (no KDF)

**Status:** FIXED (2025-02-27). JSDoc added above `getKey()`: ENCRYPTION_KEY must be 32 cryptographically random bytes as 64 hex chars (e.g. `openssl rand -hex 32`); human-readable password must not be used without a KDF.

**File:** `src/lib/crypto.ts`  
**Lines:** 8–14

**Finding:** `ENCRYPTION_KEY` is expected to be a 64-character hex string (32 bytes) used directly as the AES-256-GCM key. This is acceptable if the key is generated as 32 cryptographically random bytes and stored as hex. If the key were ever derived from a password, a key derivation function (e.g. scrypt or argon2) would be required.

**Fix:** Document that `ENCRYPTION_KEY` must be 32 cryptographically random bytes encoded as 64 hex characters (e.g. `openssl rand -hex 32`). Do not use a human-readable password as the value without a KDF.

---

### M9. Demo-call: per-phone rate limiter is in-memory

**Status:** FIXED (2025-02-27). Comment added above per-phone limiter: in-memory and per-instance only; use Redis in production for global enforcement.

**File:** `src/app/api/demo-call/route.ts`  
**Lines:** 7, 50

**Finding:** `phoneRateLimiter` is created with `createRateLimiter({ windowMs: 86_400_000, maxRequests: 2 })`, which uses the in-memory implementation. Across multiple instances or serverless invocations, the 2-calls-per-phone-per-day limit is not enforced globally; an attacker could exceed it by spreading requests across instances.

**Fix:** Use a persistent rate limiter for the per-phone check when Redis is available (e.g. a dedicated limiter with prefix `demo-phone` and the same window/limit), and document that without Redis the limit is best-effort per instance.

---

### M10. Cron jobs: no explicit timeout

**Status:** FIXED (2025-02-27). daily-digest: comment on platform timeout; cap of 100 clients per run with `logger.warn` when cap is hit. process-callbacks: comment that the 10-callback limit is intentional for timeout.

**Files:** e.g. `src/app/api/cron/daily-digest/route.ts`, `src/app/api/cron/process-callbacks/route.ts`

**Finding:** Cron handlers run to completion. They are protected by `CRON_SECRET` but have no explicit request or loop timeout. A very large number of digest actions or callbacks could cause long runs and hit the platform’s maximum execution time.

**Fix:** Add a reasonable timeout (e.g. 50s) at the start of the handler (e.g. `AbortSignal.timeout(50_000)` and pass it to any long-running work where applicable), or cap the number of items processed per run (e.g. process-callbacks already limits to 10; daily-digest could cap the number of clients or batches).

---

### M11. Webhook handler error response stores `String(error)` in `webhook_logs`

**Status:** FIXED (2025-02-27). Error stored in raw_payload is sanitized: message only (`err instanceof Error ? err.message : "Unknown error"`), truncated to 500 chars; no stack traces.

**File:** `src/app/api/webhooks/retell/route.ts`  
**Lines:** 381–386

**Finding:** On catch, the handler inserts into `webhook_logs` with `raw_payload: { error: String(error) }`. If the error object ever contained sensitive data (e.g. from a library), it could be stored. Currently this is a generic error string, but it’s worth ensuring no stack traces or internal details are logged in production.

**Fix:** Sanitize before storing: e.g. store only a short message or error code in production, and never persist stack traces or request bodies in `raw_payload`.

---

### M12. `create-web-call` uses `createClient()` (user-scoped) for agent lookup

**Status:** FIXED (2025-02-27). Route now uses `createServiceClient()` so agent and widget_config are fetched with service role; origin and rate limiting unchanged.

**File:** `src/app/api/agents/create-web-call/route.ts`
**Line:** 13

**Finding:** The route uses `createClient()` (cookie-based, user-scoped) to fetch the agent and widget config. This endpoint is public (no auth) and only receives `agent_id`. So there is no user session; the Supabase client may be unauthenticated. If RLS restricts `agents` and `widget_config` to the current user, the select could return no rows even for a valid `agent_id`.

**Fix:** Use `createServiceClient()` for this route so agent and widget config are fetched with service role and not blocked by RLS. The route already validates origin via `widget_config.allowed_origins` and rate limits; it does not rely on the authenticated user.

---

## LOW

### L1. Middleware: role from `user.user_metadata.role` can be spoofed if auth is misconfigured

**File:** `src/lib/supabase/middleware.ts`  
**Line:** 96

**Finding:** `userRole` is read from `user.user_metadata?.role`. If Supabase is ever configured to allow clients to set `user_metadata` or if roles are not set server-side only, a user could try to elevate to startup role. This is a generic precaution.

**Fix:** Prefer reading role from a server-side source (e.g. `users.role` in DB) when available, and ensure role is only set by trusted backend or auth hooks, not by the client.

---

### L2. `.env` is in `.gitignore`; `.env.example` is not ignored

**File:** `.gitignore`  
**Lines:** 35–37

**Finding:** `.env*` is ignored with `!.env.example`, so `.env.example` is committed. That is correct. No `.env` or `.env.local` should be committed. Confirmed.

**Fix:** None. Document that secrets must never be added to `.env.example` (only variable names and dummy values).

---

### L3. No hardcoded secrets found

**Search:** Codebase scanned for patterns like hardcoded API keys, Bearer tokens, and literal secrets.

**Finding:** No hardcoded secrets were found. Credentials are read from `process.env`.

**Fix:** None. Keep using env for all secrets.

---

### L4. `NEXT_PUBLIC_*` usage is appropriate

**Finding:** Only intended public vars are used: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, and optional Sentry/Stripe public keys. No server-only secrets are exposed via `NEXT_PUBLIC_`.

**Fix:** None. Continue to avoid prefixing server secrets with `NEXT_PUBLIC_`.

---

### L5. Portal slug validation in middleware is correct

**File:** `src/lib/supabase/middleware.ts`  
**Lines:** 166–184

**Finding:** For `/<slug>/portal/...`, client users are validated so that `pathname.split("/")[1]` equals the slug from the DB for their `client_id`. Startup users are redirected to `/dashboard`. So a client cannot access another client’s portal by guessing a slug.

**Fix:** None.

---

### L6. Post-call actions and integration recipes do not block each other

**File:** `src/app/api/webhooks/retell/route.ts`  
**Lines:** 336–355

**Finding:** Post-call actions, recipes, Zapier, Make, and n8n are run in parallel with `.catch()` on each. A failure in one (e.g. Resend) does not prevent the others (e.g. Twilio, Zapier) from running.

**Fix:** None.

---

### L7. Integration recipes: one failure does not block others

**File:** `src/lib/integration-recipes.ts`  
**Lines:** 63–136

**Finding:** Automations are executed in a `for` loop with a try/catch per automation. A failure in one recipe calls `logFailure` and the loop continues.

**Fix:** None.

---

### L8. Crypto: AES-256-GCM and unique IV per encryption

**File:** `src/lib/crypto.ts`  
**Lines:** 3–5, 17–18

**Finding:** Algorithm is `aes-256-gcm`; IV is `randomBytes(IV_LENGTH)` (12 bytes) per encryption. IV is not reused.

**Fix:** None.

---

## Appendix A: Public (unauthenticated) API endpoints

| Endpoint | Rate limited | Protection / notes |
|----------|--------------|--------------------|
| `POST /api/webhooks/retell` | No | Signature verification (x-retell-signature + Retell.verify) |
| `POST /api/webhooks/stripe` | No | Stripe webhook signature |
| `POST /api/webhooks/resend/inbound` | No | Resend signature / config |
| `POST /api/webhooks/jobber` | No | Provider-specific |
| `POST /api/webhooks/housecallpro` | No | Provider-specific |
| `GET /api/health` | No | Returns only `{ status: "ok" }`; no Supabase or backend details (H5 fixed) |
| `POST /api/agents/create-web-call` | Yes (publicEndpointLimiter) | Origin check via widget_config.allowed_origins |
| `POST /api/calls` (action create_web_call) | Yes | Same as above |
| `POST /api/demo-call` | Yes (IP + per-phone in-memory) | US/Canada phone validation |
| `POST /api/contact` | Yes | — |
| `POST /api/checkout` | Yes | — |
| `POST /api/marketing-checkout` | Yes | — |
| `POST /api/auth/route` (login) | Yes | — |
| `POST /api/auth/reset-password` | Yes | — |
| `GET /api/oauth/callback` | No | OAuth code + state; state contains redirectPath; auth checked after callback |
| `POST /api/zapier/subscribe` | No | x-api-key (hash match or client_id:key); hook URL validated with isSafeWebhookUrl (H1 fixed) |
| `POST /api/make/subscribe` | No | Same as Zapier; hook URL validated (H1 fixed) |
| `POST /api/n8n/subscribe` | No | Same; hook URL validated (H1 fixed) |
| Tool routes under `/api/tools/*` | No | verifyToolAuth (API key + client existence) (H4 fixed) |

All other `/api/*` routes either use `requireAuth()` or (cron) Bearer `CRON_SECRET`.

---

## Appendix B: Rate limiting

- **Implementation:** `src/lib/rate-limit.ts`: in-memory `createRateLimiter` (Map); `publicEndpointLimiter` uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, otherwise in-memory.
- **Limitation:** Without Redis, limits are per-instance only (not global). Demo-call per-phone limiter is always in-memory.
- **Public endpoints using rate limiting:** contact, checkout, marketing-checkout, auth (login), auth/reset-password, demo-call (IP + phone), create-web-call, POST /api/calls (create_web_call).

---

## Appendix C: SSRF — outbound requests to user- or DB-supplied URLs

| Location | URL source | Validated? |
|----------|------------|------------|
| `src/app/api/webhooks/retell/route.ts` (forward to agent/solution webhooks) | DB (`agents.webhook_url`, `solutions.webhook_url`) | Yes — `isSafeWebhookUrl` |
| `src/app/api/integrations/webhook-test/route.ts` | Body `webhook_url` | Yes — inline blocklist (same as isSafeWebhookUrl) |
| `src/lib/integration-recipes.ts` (webhook + email execution) | DB (`config.webhook_url`, `recipe.n8n_webhook_url`) | **Yes** — isSafeWebhookUrl before fetch (C2 fixed) |
| `src/lib/zapier.ts` (dispatch) | DB `zapier_subscriptions.hook_url` | Subscribe validates at insert (H1); dispatch uses stored URL |
| `src/lib/make.ts` | DB `make_subscriptions` hook_url | Same — subscribe validates (H1 fixed) |
| `src/lib/n8n.ts` | DB `n8n_subscriptions` hook_url | Same (H1 fixed) |
| Zapier/Make/n8n subscribe routes | Body `hookUrl` | **Yes** — isSafeWebhookUrl before storing (H1 fixed) |

---

*Audit completed. Address CRITICAL and HIGH items first, then MEDIUM, then LOW as capacity allows.*
