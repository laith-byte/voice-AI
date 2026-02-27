# Phase 3: Logic Bugs, Edge Cases, Race Conditions & Error Handling

## 1. Race Conditions

### 1.1 CRITICAL: Retell webhook `call_ended` is not idempotent
**File:** `src/app/api/webhooks/retell/route.ts:120-211`
**Problem:** Retell may deliver the same `call_ended` webhook more than once (e.g., network retry, at-least-once delivery). The handler performs multiple non-idempotent operations:
- Updates `call_logs` status to `completed` (harmless if repeated)
- Updates `pending_callbacks` status (`answered` -> `completed`) - could re-trigger callback retry logic if timing is unlucky
- Increments `total_calls` via `supabase.rpc("increment_total_calls")` at line 346 - **will double-count** on duplicate delivery

**Fix:**
- Add a deduplication check: before processing `call_ended`, query `call_logs` to check if `status` is already `completed`. If so, return early.
- Alternatively, use a `processed_events` table keyed by `(call_id, event)` and check before processing.

```typescript
// Before switch(event) block or inside case "call_ended":
const { data: existingLog } = await supabase
  .from("call_logs")
  .select("status")
  .eq("retell_call_id", call.call_id)
  .single();
if (existingLog?.status === "completed") {
  return NextResponse.json({ received: true }); // Already processed
}
```

### 1.2 HIGH: Race between `call_ended` and `call_analyzed` events
**File:** `src/app/api/webhooks/retell/route.ts:120-338`
**Problem:** `call_ended` and `call_analyzed` can arrive concurrently or in reverse order. The code at line 133 overwrites `metadata` entirely with `call_ended` data. If `call_analyzed` arrives first and writes `post_call_analysis` + `summary`, then `call_ended` arrives and updates the same row, the `metadata` field from `call_ended` will overwrite any metadata set by `call_analyzed`.

Additionally, the post-call actions at line 239 only trigger on `call_analyzed`. If `call_analyzed` arrives before `call_ended`, the `call_logs` row may not exist yet (if `call_started` was missed or delayed), causing the select at line 292 to return null and all post-call actions to silently not fire.

**Fix:**
- Use Supabase merge-style update for `metadata` instead of full replacement. E.g., use a Postgres function or read-modify-write.
- Add a check in `call_analyzed` handler: if `call_logs` row doesn't exist, insert a minimal one first.

### 1.3 MEDIUM: Test call counter (TOCTOU race)
**File:** `src/app/api/onboarding/test-call/route.ts:43-55`
**Problem:** The test call counter is incremented via a read-then-write pattern:
```typescript
const { data: onboarding } = await supabase
  .from("client_onboarding")
  .select("test_calls_used")
  .eq("client_id", clientId)
  .single();

await supabase
  .from("client_onboarding")
  .update({ test_calls_used: (onboarding?.test_calls_used ?? 0) + 1 })
  .eq("client_id", clientId);
```
If two test calls are initiated simultaneously, both read the same count and both write `count + 1`, losing one increment.

**Fix:** Use an RPC/SQL function similar to `increment_total_calls` to atomically increment the counter.

### 1.4 MEDIUM: Concurrent agent deletion can orphan resources
**File:** `src/app/api/agents/[id]/route.ts:97-178`
**Problem:** The DELETE handler first deletes from Retell, then iterates through dependent tables, then deletes the agent row. If two DELETE requests arrive concurrently, the first passes the org ownership check, deletes from Retell, and starts cleaning up tables. The second also passes the ownership check (agent row still exists), tries to delete from Retell (gets 404, which is handled), and both proceed to clean up tables simultaneously.

**Fix:** Use a `select...for update` pattern or check-then-delete atomically. At minimum, make the final agent delete return the row and check if anything was actually deleted.

### 1.5 LOW: Fire-and-forget promise in conversation-flow GET
**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:548-560`
**Problem:**
```typescript
Promise.resolve(
  adminDb
    .from("conversation_flows")
    .update({ agent_id: id })
    .eq("id", activeFlow.id)
).then(() => ...).catch(() => {});
```
This DB update runs detached from the request lifecycle. If the serverless function terminates before it completes, the update is silently lost. The `.catch(() => {})` also swallows any errors.

**Fix:** Either `await` the update (it's a fast DB write) or at minimum log the error in the catch handler.

---

## 2. Missing Input Validation / Edge Cases

### 2.1 HIGH: Auth route `setup-account` allows any authenticated user to update any client
**File:** `src/app/api/auth/route.ts:179-197`
**Problem:** The `setup-account` action accepts a `clientId` from the request body and updates the client's `name` field. It only checks that the user is authenticated, but does NOT verify the user belongs to (or owns) that client. Any authenticated user can update any client's business name.

```typescript
case "setup-account": {
  // ...
  if (cId) {
    const { error: clientError } = await supabase
      .from("clients")
      .update({ name: businessName })
      .eq("id", cId);  // No org/user ownership check!
  }
```

**Fix:** Add an ownership check. Either join through `users` table to verify the user's `client_id` matches, or use the RLS policies (the current `createClient()` call may or may not have RLS that covers this, but the code should not rely on that alone).

### 2.2 HIGH: Bulk leads POST has no array length limit
**File:** `src/app/api/leads/route.ts:47-59`
**Problem:** The bulk import path `POST /api/leads` accepts `body.leads` as an array with no size validation. An attacker could send millions of leads in a single request, overwhelming the database.

```typescript
if (Array.isArray(body.leads)) {
  const { data, error } = await supabase.from("leads").upsert(
    body.leads.map(...),  // No length check!
    { onConflict: "phone,agent_id" }
  ).select();
}
```

Note: The `/api/leads/import` route properly limits to 500 leads per request. The `/api/leads` route does not.

**Fix:** Add `if (body.leads.length > 500) return 400;` before the upsert.

### 2.3 HIGH: `agents POST` has no validation on body fields
**File:** `src/app/api/agents/route.ts:18-42`
**Problem:** The POST handler accepts `body.name`, `body.retell_agent_id`, `body.retell_api_key`, etc. directly from the request without validating:
- `body.name` could be empty, null, or an extremely long string
- `body.retell_agent_id` is not validated as a string
- `body.retell_api_key` is encrypted and stored without validation
- `body.client_id` is not verified to belong to the user's organization

**Fix:** Add validation: require non-empty name, validate string types, verify `client_id` belongs to user's org.

### 2.4 MEDIUM: `clients POST` accepts slug directly from user
**File:** `src/app/api/clients/route.ts:17-37`
**Problem:** The `slug` field is taken directly from the request body with no validation or uniqueness check. Duplicate slugs could cause routing conflicts. The slug is used in portal URLs like `/{clientSlug}/portal`.

**Fix:** Validate slug format (alphanumeric, hyphens), check uniqueness within the organization, and enforce a max length.

### 2.5 MEDIUM: Phone number purchase has no org-level deduplication
**File:** `src/app/api/phone-numbers/purchase/route.ts:6-179`
**Problem:** If two users in the same org simultaneously purchase the same phone number, both Twilio purchase requests could succeed (unlikely but possible with parallel requests to different numbers being processed). The DB insert at line 156 could fail with a unique constraint violation, but the Twilio number is already purchased and won't be rolled back.

### 2.6 MEDIUM: `request.json()` can throw on malformed body
**File:** Multiple API routes
**Problem:** Many routes call `await request.json()` without try/catch. If the client sends malformed JSON, an uncaught error propagates to the top-level catch (if one exists) or crashes the handler. Some routes handle this correctly (e.g., `go-live/route.ts:13` uses `.catch(() => ({}))`), but most do not.

**Affected files (sampling):**
- `src/app/api/agents/route.ts:22`
- `src/app/api/clients/route.ts:21`
- `src/app/api/campaigns/route.ts:26`
- `src/app/api/leads/route.ts:33`
- `src/app/api/auth/route.ts:12`
- `src/app/api/checkout/route.ts:15`

**Fix:** Wrap `request.json()` in try/catch or use `.catch()`, returning 400 for parse errors.

### 2.7 LOW: Campaign `calling_rate` has no upper bound validation
**File:** `src/app/api/campaigns/route.ts:39-58`
**Problem:** `calling_rate` and `retry_attempts` are accepted directly from the body. A user could set `calling_rate: 10000` or `retry_attempts: 999`, causing excessive outbound calls.

**Fix:** Add min/max bounds validation.

### 2.8 LOW: Webhook test endpoint is an open SSRF vector
**File:** `src/app/api/agents/[id]/webhook-test/route.ts:20-31`
**Problem:** The `url` parameter from the request body is passed directly to `fetch()`. While it requires auth, an authenticated user could use this to probe internal network resources (e.g., `http://169.254.169.254/latest/meta-data/` on AWS, or internal microservices).

**Fix:** Validate that the URL is a public hostname (not private IP ranges, not localhost). The `isPublicUrl()` check used elsewhere could be reused here.

---

## 3. Error Handling Issues

### 3.1 HIGH: Stripe webhook handler has no try/catch around event handlers
**File:** `src/app/api/webhooks/stripe/route.ts:58-92`
**Problem:** The `switch` block calling `handleCheckoutCompleted`, `handleSubscriptionDeleted`, etc. is not wrapped in try/catch. If any handler throws (e.g., the `supabase.auth.admin.listUsers` call at line 189 which fetches ALL users with `perPage: 1000`), the webhook log is never updated from "processing" to "success" or "failed".

```typescript
switch (event.type) {
  case "checkout.session.completed":
    await handleCheckoutCompleted(event.data.object, supabase); // Can throw!
    break;
  // ...
}
// This line only runs if no handler throws:
if (logRow?.id) {
  await supabase.from("webhook_logs").update({ import_result: "success" }).eq("id", logRow.id);
}
```

**Fix:** Wrap the switch block in try/catch. On error, update the webhook log to "failed" and still return 200 (to prevent Stripe from retrying indefinitely).

### 3.2 HIGH: `handleCheckoutCompleted` fetches ALL users (unbounded query)
**File:** `src/app/api/webhooks/stripe/route.ts:189`
**Problem:**
```typescript
const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
const existingAuthUser = users?.find((u) => u.email === customerEmail);
```
This loads up to 1000 auth users into memory and does a linear search. As the user count grows, this becomes slow and memory-intensive. Also, if there are >1000 users, the target user may not be found.

**Fix:** Use a more targeted query if Supabase supports filtering by email in `listUsers`, or query the `auth.users` table directly via the service client.

### 3.3 MEDIUM: Retell webhook silently ignores agent lookup failure
**File:** `src/app/api/webhooks/retell/route.ts:35-47`
**Problem:** If `call.agent_id` is present but the agent isn't found in the database (e.g., agent was deleted), `organizationId`, `internalAgentId`, and `clientId` all remain `null`. The webhook log is inserted with null `organization_id` and `agent_id`. The `call_started` event correctly checks `if (!internalAgentId)` and breaks, but `call_ended` at line 126 proceeds to update `call_logs` with `eq("retell_call_id", call.call_id)` which may match nothing (no error raised, update simply affects 0 rows).

More critically, the post-call actions at line 239 check `if (clientId && event === "call_analyzed")` - so they won't fire, which is correct. But the `increment_total_calls` at line 346 also checks `clientId`, so this is actually safe. The issue is just that the webhook log shows "success" even though no useful processing occurred.

### 3.4 MEDIUM: Callback retry scheduling uses local timezone math incorrectly
**File:** `src/app/api/webhooks/retell/route.ts:170-187`
**Problem:** The retry scheduling code tries to schedule for "9 AM in the caller's timezone" but the math is incorrect:
```typescript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowHour = parseInt(
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric", hour12: false, timeZone: cb.timezone,
  }).format(tomorrow)
);
const hoursToAdd = (9 - tomorrowHour + 24) % 24;
tomorrow.setHours(tomorrow.getHours() + hoursToAdd);
```
This gets the current hour in the target timezone and calculates how many hours to add. But `tomorrow` was created from `new Date()` (server time) and `setDate` was called on it. The `setHours` at the end modifies the server-local hour. The net effect: if the server is UTC and the caller is in `America/New_York` (UTC-5), `tomorrowHour` would be 19 when it's midnight UTC (7 PM ET). Then `hoursToAdd = (9 - 19 + 24) % 24 = 14`. Adding 14 hours to midnight UTC gives 2 PM UTC = 9 AM ET. This actually works for the first case, but edge cases around DST transitions and the fact that `tomorrowHour` is already formatted for the target timezone but applied to a UTC date could cause off-by-one-hour errors during DST changes.

**Fix:** Use a proper timezone library (e.g., `Intl.DateTimeFormat` with `timeZoneName` to get the offset, or use `luxon`/`date-fns-tz`) for reliable timezone-aware scheduling.

### 3.5 MEDIUM: Rate limiter uses in-memory Map - lost on deploy/restart
**File:** `src/lib/rate-limit.ts:10-44`
**Problem:** The rate limiter stores hit counts in an in-memory `Map`. In a serverless environment (Vercel), each function invocation may use a fresh instance, meaning the rate limiter resets frequently and provides no meaningful protection. Even in a long-running Node.js process, a new deployment clears the map.

**Fix:** For production rate limiting, use Redis, Vercel KV, or Upstash rate limiting. The current implementation provides some protection in long-running environments but is ineffective in serverless.

### 3.6 LOW: Silent catch blocks
**File:** `src/components/marketing/sections/live-demo.tsx:96`
**Problem:** `catch {}` with no error handling:
```typescript
try {
  const errData = await res.json();
  message = errData.error || message;
} catch {}
```
This is in a UI component and is acceptable for parsing a potentially non-JSON error response. Low severity.

**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:631`
```typescript
} catch {
  // Proceed with Retell data only
}
```
Silently swallows errors when fetching tool data from Supabase. Should at minimum log a warning.

---

## 4. Database Query Issues

### 4.1 HIGH: Missing Supabase error checks after mutations
**File:** Multiple locations
**Problem:** Several database operations don't check the `error` return from Supabase:

- `src/app/api/webhooks/retell/route.ts:126-142` - `call_logs.update()` result not checked
- `src/app/api/webhooks/retell/route.ts:224-228` - `call_logs.update()` result not checked
- `src/app/api/webhooks/retell/route.ts:383` - `client_onboarding.update()` result not checked
- `src/app/api/onboarding/step/[step]/route.ts:66` - `clients.update()` result not checked
- `src/app/api/onboarding/step/[step]/route.ts:92` - `clients.update()` result not checked

**Fix:** Check `{ error }` return and log failures.

### 4.2 MEDIUM: `.single()` on queries that may return 0 or multiple rows
**File:** Multiple locations
**Problem:** Several queries use `.single()` but could reasonably return 0 rows (no match) or multiple rows (non-unique filter). When 0 rows are returned, `.single()` returns an error which may be misleading.

Examples:
- `src/app/api/tools/leads/create/route.ts:28-34` - Looking up agent by `client_id` with `.limit(1).single()`. If the client has no agent, this returns an error instead of `null`. Should use `.maybeSingle()`.
- `src/app/api/calls/route.ts:37-42` - Looking up agent by `retell_agent_id` with `.limit(1).single()`. Should use `.maybeSingle()`.
- `src/app/api/agents/[id]/knowledge-base/[sourceId]/route.ts` - Not checked but worth auditing.

**Fix:** Use `.maybeSingle()` when a row may not exist and you want `null` instead of an error.

### 4.3 MEDIUM: Unbounded queries without pagination
**File:** Multiple locations
**Problem:** Several GET endpoints return all rows without pagination:
- `src/app/api/agents/route.ts:10-15` - Returns ALL agents for the org (no limit)
- `src/app/api/clients/route.ts:9-14` - Returns ALL clients for the org (no limit)
- `src/app/api/leads/route.ts:20` - Limit 2000, which is still very large
- `src/app/api/campaigns/route.ts:14` - Limit 500

**Fix:** Add pagination parameters (page, page_size) and enforce reasonable maximums.

---

## 5. Conversation Flow Logic Issues

### 5.1 MEDIUM: Self-healing redeploy can cause infinite loop
**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:457-460`
**Problem:** The auto-redeploy triggers when `compiledCount > llmStateCount` or when `compiledHasStateTools && !llmHasStateTools`. If the Retell PATCH call succeeds but the verification GET still shows fewer states (e.g., Retell rejected some states silently), the next GET request will trigger another redeploy, and so on.

**Fix:** Add a counter or flag to limit auto-redeploy attempts, e.g., a query parameter `?no_auto_deploy=true` added internally, or a short TTL cache key.

### 5.2 LOW: `convertFlowToLLM` silently drops edges to non-conversation nodes
**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:253-254`
**Problem:**
```typescript
.filter((edge) => validStateNames.has(edge.destination_state_name)),
```
Edges pointing to non-conversation nodes are silently removed. If a user creates an edge to a node that was later changed to a non-conversation type, they won't be notified that the edge was lost.

---

## 6. Memory Leaks / Cleanup Issues

### 6.1 MEDIUM: Retell WebSocket client event listeners not cleaned up on re-call
**File:** `src/hooks/use-retell-call.ts:67-108`
**Problem:** The `startCall` function creates a new `RetellWebClient` on each call and registers event listeners (`call_started`, `call_ended`, `agent_start_talking`, `agent_stop_talking`, `update`, `error`). If `startCall` is called again (e.g., user starts a second call), a new client is created and the old one's event listeners are not explicitly removed (though the old client ref is overwritten, so GC should handle it if the SDK properly cleans up on `stopCall`).

The `useEffect` cleanup at line 158 only calls `stopCall()` on the client, but doesn't remove event listeners from the old client. If the SDK doesn't auto-clean on `stopCall`, this could leak listeners.

**Fix:** Before creating a new client in `startCall`, call `stopCall()` on the existing one if present.

### 6.2 LOW: `setTimeout` in `use-retell-call.ts` after call ends - no cleanup
**File:** `src/hooks/use-retell-call.ts:83-86`
**Problem:**
```typescript
setTimeout(() => {
  syncCall(syncCallId, syncAgentId);
}, 3000);
```
This `setTimeout` is created inside the `call_ended` event handler and is never cleaned up. If the component unmounts within 3 seconds of the call ending, the `syncCall` fetch will still fire, potentially causing a React state update on an unmounted component. This is a minor issue since `syncCall` just does a fetch and doesn't set state directly.

### 6.3 LOW: `setInterval` in components properly cleaned up
**Files:** `src/components/portal/recent-syncs-widget.tsx:87-88`, `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx:438-446`, `src/app/(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx:102-117`
**Status:** All `setInterval` usages have proper cleanup in `useEffect` return functions. No issues found.

---

## 7. Dead Code / Unused Code

### 7.1 LOW: Unused import in conversation-flow route
**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:8`
```typescript
import { type ConversationFlowTool } from "@/lib/prompt-tree-types";
```
This type is used at line 290, so it's actually used. No issue.

### 7.2 LOW: Typo in function name
**File:** `src/app/api/agents/[id]/conversation-flow/route.ts:66`
```typescript
function mergCompiledToolsIntoLlm(
```
Should be `mergeCompiledToolsIntoLlm` (missing 'e'). This is a cosmetic issue but could cause confusion during debugging.

### 7.3 LOW: Commented-out code patterns
No significant commented-out code blocks were found in API routes.

---

## 8. Email/Notification Edge Cases

### 8.1 MEDIUM: First-call notification email race with onboarding update
**File:** `src/app/api/webhooks/retell/route.ts:349-385`
**Problem:** The first-call notification check:
1. Reads `client_onboarding` to check `first_call_notified_at` is null
2. Sends email
3. Updates `first_call_notified_at`

If two calls end simultaneously for the same client, both could pass the null check, send duplicate emails, and both try to update. The email is sent twice.

**Fix:** Use an atomic `UPDATE ... WHERE first_call_notified_at IS NULL` and check the update count before sending email.

### 8.2 LOW: Email HTML injection in callback tool
**File:** `src/app/api/tools/callback/route.ts:87-109`
**Problem:** User-supplied values (`caller_name`, `caller_phone`, `question`) are properly escaped via the `esc()` helper function. No issue.

---

## 9. Tool Routes Missing Rate Limiting

### 9.1 MEDIUM: Tool routes use static API key auth but no rate limiting
**Files:** All `src/app/api/tools/*/route.ts` files
**Problem:** Tool endpoints (calendar, sms, email, leads, etc.) are authenticated via `RETELL_TOOLS_API_KEY` bearer token. Since this is a shared secret used by all Retell agents across all clients, a compromised key or a bug in Retell could lead to unlimited calls to these endpoints. There is no per-client or per-call rate limiting.

**Particularly concerning for:**
- `src/app/api/tools/sms/send/route.ts` - Could send unlimited SMS via Twilio
- `src/app/api/tools/email/send/route.ts` - Could send unlimited emails via Resend
- `src/app/api/tools/calendar/book/route.ts` - Could create unlimited calendar events

**Fix:** Add per-client rate limiting on tool endpoints (e.g., max 10 SMS/call, max 5 calendar bookings/call).

---

## 10. Stripe Checkout & Billing Edge Cases

### 10.1 MEDIUM: Checkout session allows arbitrary `plan_id` from any org
**File:** `src/app/api/checkout/route.ts:10-124`
**Problem:** The checkout endpoint is public (rate-limited but no auth). It accepts a `plan_id` and looks it up. If a malicious user knows a `plan_id` from org A, they could create a checkout session for it. The plan lookup at line 26 checks `is_active` but not that the plan's organization matches any particular context.

This is by design (it's a public checkout page), but could be an issue if plans have different pricing per org.

### 10.2 LOW: Return URL validation could be bypassed with path manipulation
**File:** `src/app/api/checkout/route.ts:72-81`
**Problem:** The return URL validation compares origins, which is correct. The check at line 75 properly uses `new URL(o).origin === parsed.origin`. This is actually fine.

---

## Summary by Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 1 | Webhook `call_ended` not idempotent (double-counting calls) |
| HIGH | 6 | `setup-account` IDOR, unbounded bulk leads, missing error checks, webhook handler crash, agent POST no validation, Stripe handler no try/catch |
| MEDIUM | 12 | Race conditions, timezone math, rate limiter ineffective, self-healing loop, SSRF in webhook test, missing .maybeSingle() |
| LOW | 7 | Typo in function name, cosmetic issues, minor cleanup gaps |
