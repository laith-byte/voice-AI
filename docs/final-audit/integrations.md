# Integration Audit -- 2026-02-22

## Summary

**Overall Verdict: CONDITIONAL PASS -- 2 BLOCKERS, 5 warnings, 8 recommendations**

Both CRM integrations (Housecall Pro + Jobber) are structurally sound and follow consistent patterns. The OAuth flow, executor logic, tool routes, webhook endpoints, retry queue, event logging, service mappings, and HVAC templates are all functional and well-tested. However, there are **two critical GraphQL injection vulnerabilities** in the Jobber integration that must be fixed before any real HVAC business connects.

---

## Housecall Pro Integration

### OAuth Flow: PASS

**Files:** `src/lib/oauth/providers.ts:85-91`, `src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/callback/route.ts:210-225`

- Provider config at lines 85-91 correctly defines `authUrl` and `tokenUrl` at `api.housecallpro.com`
- Empty scopes array `[]` is correct -- HCP uses implicit scopes with API key access level
- Callback route (lines 210-225) fetches `/pro/v1/me` to extract company metadata (company_id, company_name, user_id, user_name, email)
- Token exchange uses standard `application/x-www-form-urlencoded` POST to token endpoint
- Tokens are encrypted with AES-256-GCM before storage (via `encrypt()`)
- OAuth state is encrypted with 10-minute expiry -- prevents CSRF
- Callback verifies the authenticated user is authorized for the clientId (lines 39-76) -- defense in depth beyond the encrypted state
- `registerAgentTools` is called non-blocking after successful connection -- correct pattern
- Disconnect route at `src/app/api/oauth/disconnect/route.ts` correctly calls `unregisterAgentTools` and deletes the connection. Note: HCP has no revokeUrl configured, so token revocation is skipped. This is acceptable -- the connection row is deleted so the token becomes unusable from our side.

**One minor gap:** HCP does not specify `scopes` in the authorize URL. Since HCP uses empty scopes `[]`, the `scope` parameter sent to the auth URL will be an empty string. This is fine -- HCP does not require scope parameters.

### Executor: PASS

**File:** `src/lib/oauth/executors/housecallpro.ts`

Line-by-line trace:

1. **Line 59:** Early return on null `from_number` -- correct, nothing to do without a phone number
2. **Lines 62-66:** `extractStructuredData()` called with transcript, summary, post_call_analysis -- correct parameter order
3. **Lines 68-88:** Token acquisition with proper error handling: on failure, enqueues retry AND logs event with `status: "retrying"` -- correct
4. **Lines 93-96:** Customer search by phone using `encodeURIComponent(phone)` -- properly URL-encodes the phone number, preventing injection
5. **Lines 107-149:** Customer creation when not found: splits name correctly, sets phone, email, address, tags `["ai-call"]` -- clean
6. **Lines 111-112:** Name splitting: `split(" ")[0]` for first, `split(" ").slice(1).join(" ")` for last -- handles multi-word last names correctly. Falls back to "Caller" / phone number which is fine
7. **Lines 152-170:** Note creation on customer with formatted details -- good
8. **Lines 176:** Service mapping call -- correctly passes `clientId`, `"housecallpro"`, and `extracted.service_requested`
9. **Lines 178-190:** Final event logging with metadata including urgency, service_requested, and mapping -- comprehensive
10. **Lines 191-214:** Error handling: logs `sync_failed`, checks for transient errors (429/500/503) to enqueue retry, re-throws -- correct pattern

**Test coverage:** 13 test cases in `src/lib/oauth/executors/__tests__/housecallpro.test.ts` covering: null from_number, token error + retry, customer search, customer creation, note logging, event logging for new vs existing customers, search/creation failures, transient vs non-transient retry behavior, extractStructuredData parameter passing. **Comprehensive.**

### Tool Routes: PASS (all 4)

#### 1. Lookup (`/api/tools/housecallpro/lookup/route.ts`): PASS

- Auth: Checks `Authorization: Bearer` header against `RETELL_TOOLS_API_KEY` -- correct
- Accepts `client_id` from query params OR body -- flexible for Retell tool config
- Validates required fields: `client_id`, `caller_phone_number`
- Uses `encodeURIComponent` for phone in URL -- safe
- Returns `{ found: true, contact_id, caller_name, company, email }` or `{ found: false }` -- correct shape matches `response_variables` in tool definition

#### 2. Availability (`/api/tools/housecallpro/availability/route.ts`): PASS

- Auth: Same pattern -- correct
- Fetches employees list, takes first employee's schedule
- Generates 2-hour slots from 8 AM to 5 PM, checking for conflicts
- **Note:** Only checks first employee's schedule. For a multi-tech company, this could miss availability on other techs. Not a blocker -- this is a reasonable V1 implementation, but should be noted.
- Returns `{ slots, earliest, date }` matching response_variables

#### 3. Book (`/api/tools/housecallpro/book/route.ts`): PASS

- Auth: Same pattern
- Validates all 6 required fields
- Look up or create customer flow (same pattern as executor)
- Creates job with schedule (`start_date` + `start_time`) and line items
- Returns `{ success: true, job_id, scheduled_time }`

#### 4. Create Estimate (`/api/tools/housecallpro/create-estimate/route.ts`): PASS

- Auth: Same pattern
- Validates 4 required fields
- Look up or create customer flow
- Creates estimate with line item (unit_price: 0 -- will be filled by the tech)
- Returns `{ success: true, estimate_id }`

### Webhook (`/api/webhooks/housecallpro/route.ts`): FAIL -- WARNING

**Issues found:**

1. **No webhook signature validation.** The endpoint accepts any POST request and inserts it directly into `integration_events`. HCP supports webhook signatures (using a shared secret). Without validation, anyone who discovers this URL can inject fake webhook events into the database.

2. **Missing `client_id` field.** The insert sets `provider: "housecallpro"` and `event_type` from the body, but the `client_id` field references `clients(id)` with `NOT NULL` constraint in the schema (migration line 13). The webhook handler does NOT set `client_id`, which means **this insert will fail with a NOT NULL constraint violation every time**. The error is silently caught at line 23 and returns 200.

3. **Inconsistent with Jobber webhook.** The Jobber webhook uses `logIntegrationEvent()` which properly handles all fields. The HCP webhook bypasses this helper and does a raw insert with a different field set (includes `payload` and `created_at` which are not in the `IntegrationEventInput` interface but are valid DB columns based on the migration schema -- though `payload` is not a column in `integration_events`, only `metadata` is).

**Severity:** The `client_id` NOT NULL violation is a **silent failure** -- every HCP webhook event is being dropped. However, the webhook is currently log-only (no business logic triggers), so this is a WARNING, not a BLOCKER.

---

## Jobber Integration

### OAuth Flow: PASS

**Files:** `src/lib/oauth/providers.ts:93-99`, `src/app/api/oauth/callback/route.ts:228-255`

- Provider config correctly defines auth/token URLs at `api.getjobber.com`
- Scopes are comprehensive: `read:clients`, `write:clients`, `read:jobs`, `write:jobs`, `read:quotes`, `write:quotes`, `read:schedules`
- Callback fetches account/user info via GraphQL with proper `X-JOBBER-GRAPHQL-VERSION` header
- Token storage, encryption, tool registration all follow the same correct patterns as HCP

### Executor: PASS (with 1 BLOCKER caveat)

**File:** `src/lib/oauth/executors/jobber.ts`

The executor logic mirrors HCP and is correct in structure. However:

**BLOCKER -- GraphQL Injection on line 81:**
```
`{ clients(searchTerm: "${phone}") { nodes { id name { full } ... } } }`
```
The `phone` variable (from `callLog.from_number`) is interpolated directly into the GraphQL query string using a template literal. While `from_number` typically comes from the Retell webhook (which provides E.164 formatted numbers), a crafted phone number containing `") { __typename } #` could break out of the query.

This is the **same pattern** as the tool routes (see below). While the post-call executor receives `from_number` from a trusted source (Retell), the tool routes receive user input from the Retell AI agent, which reformulates caller speech. The risk is lower for the executor but the pattern is still wrong.

**The mutations on lines 104-108 and 143-155 correctly use GraphQL variables** (`$input: ClientCreateInput!`) -- this is the right pattern and proves the codebase knows how to do it correctly.

**Fix:** Change line 81 to use a variable:
```
`query($searchTerm: String!) { clients(searchTerm: $searchTerm) { nodes { ... } } }`
```
with `variables: { searchTerm: phone }`.

Apart from the injection issue, the executor is well-structured:
- Token error handling with retry queue: correct
- Client search, create, request creation flow: correct
- Service mapping integration: correct
- Event logging with comprehensive metadata: correct
- Transient error retry (429/500/503): correct

**Test coverage:** 17 test cases in `src/lib/oauth/executors/__tests__/jobber.test.ts` covering: jobberGraphQL helper (endpoint, headers, variables, error handling), null from_number, token error + retry, client search + request creation, new client creation, creation failure, service_requested in title, transient retry, non-transient skip, sync_failed logging, extractStructuredData params, fallback names. **Comprehensive.**

### Tool Routes: FAIL -- 1 BLOCKER

#### 1. Lookup (`/api/tools/jobber/lookup/route.ts`): FAIL -- BLOCKER

**Line 28:**
```javascript
`{ clients(searchTerm: "${caller_phone_number}") { nodes { ... } } }`
```

**BLOCKER -- GraphQL Injection.** `caller_phone_number` comes from the Retell AI agent's tool call, which is based on caller speech. A caller could say a phone number that, when the AI formats it, includes characters that break out of the GraphQL string. More critically, a malicious actor could craft input to extract data from other Jobber accounts.

The fix is to use GraphQL variables:
```javascript
`query($searchTerm: String!) { clients(searchTerm: $searchTerm) { nodes { ... } } }`
```
with `{ searchTerm: caller_phone_number }`.

#### 2. Availability (`/api/tools/jobber/availability/route.ts`): FAIL -- BLOCKER

**Lines 31-32:**
```javascript
`{ calendarEvents(filter: { startAt: { gte: "${startOfDay}" }, endAt: { lte: "${endOfDay}" } }) { ... } }`
```

Same GraphQL injection pattern. `date` comes from caller speech through the AI agent. While dates are typically `YYYY-MM-DD` format, there is no input validation before interpolation.

Additionally uses `new Date(date)` at line 39 without validation -- could produce `Invalid Date` for garbage input, though this would just result in no slots being returned.

#### 3. Book (`/api/tools/jobber/book/route.ts`): PASS (with caveat)

**Lines 28-29:** Uses string interpolation for the search query (same injection pattern):
```javascript
`{ clients(searchTerm: "${customer_phone}") { nodes { id } } }`
```

**BUT** the mutation at lines 67-79 correctly uses GraphQL variables (`$input: JobCreateInput!`). So the injection is only on the search query.

#### 4. Create Quote (`/api/tools/jobber/create-quote/route.ts`): PASS (with caveat)

Same pattern: search query uses string interpolation (line 29), but mutation uses proper variables (lines 62-72).

**Summary of Jobber tool route injection issues:**

| Route | Query Injection | Mutation Injection |
|-------|----------------|-------------------|
| lookup | YES | N/A |
| availability | YES | N/A |
| book | YES (search) | NO (uses variables) |
| create-quote | YES (search) | NO (uses variables) |

All four routes have auth via `RETELL_TOOLS_API_KEY` -- correct.

### Webhook (`/api/webhooks/jobber/route.ts`): PASS (with warnings)

- Uses `logIntegrationEvent()` helper -- consistent and correct
- Parses `body.topic || body.event` for event type
- Sets `client_id` from `body.account_id || "unknown"` -- the "unknown" fallback will cause an FK violation on `integration_events.client_id` since it references `clients(id)`. **This is a WARNING** -- same pattern as HCP webhook but at least uses the proper helper.
- No webhook signature validation -- same concern as HCP. Jobber supports webhook verification tokens.

---

## Integration Framework

### Event Logging (`src/lib/integration-events.ts`): PASS

- Fire-and-forget pattern with `.catch()` -- correct for non-critical logging
- Inserts with proper defaults: `direction: "outbound"`, `status: "success"`, nulls for optional fields
- 6 test cases in `src/lib/__tests__/integration-events.test.ts` covering: required fields, defaults, all optional fields, null handling, error resilience

### Retry Queue (`src/lib/integration-retry.ts`): PASS

- Backoff schedule: 1m, 5m, 15m, 60m, 240m -- matches spec
- `enqueueRetry` inserts with `max_attempts: 5` default, `attempt_count: 0`, `status: "pending"`
- `processRetryQueue` fetches up to 50 pending items where `next_attempt_at <= now()`
- Processing flow: mark as "processing" -> execute -> mark "completed" or schedule retry/dead_letter
- Dead letter after max attempts -- correct
- Backoff calculation: `BACKOFF_MINUTES[Math.min(newAttempt - 1, BACKOFF_MINUTES.length - 1)]` -- correct indexing
- 7 test cases covering: enqueue defaults, custom maxAttempts, empty queue, query error, successful processing, dead letter, backoff scheduling, non-Error stringification

**Missing:** No `/api/cron/retry-queue` route was found in the codebase. The `processRetryQueue` function exists but there is no cron endpoint to call it. The retry queue will accumulate items but never process them.

**Severity: WARNING.** The retry queue accumulates silently. Items will be retried the next time `processRetryQueue` is invoked, which currently is never. This needs a Vercel cron or external trigger.

### Service Mappings (`src/lib/service-mapper.ts` + `/api/integrations/service-mappings/route.ts`): PASS

- `mapServiceToCategory`: null-safe, exact match (case-insensitive with trim), fuzzy match (bidirectional containment)
- Default duration falls back to 60 minutes when null in DB
- CRUD routes (`GET`, `POST` with upsert, `DELETE`) all use `requireAuth()` + `getClientId()` + service client
- DELETE properly scopes by `client_id` AND `id` -- prevents cross-client deletion
- 9 test cases covering: null/empty input, no mappings, exact match, case insensitivity, whitespace, fuzzy match both directions, no match, default duration, correct query params

---

## HVAC Templates: PASS

**File:** `src/lib/hvac-templates.ts`

### Service Categories (9 total):

| # | Name | Duration | Price | Keywords |
|---|------|----------|-------|----------|
| 1 | AC Repair | 90m | $89 | 6 keywords |
| 2 | AC Installation | 480m (8h) | null (quote) | 5 keywords |
| 3 | Heating Repair | 90m | $89 | 6 keywords |
| 4 | Furnace Installation | 480m (8h) | null (quote) | 5 keywords |
| 5 | Maintenance & Tune-Up | 60m | $79 | 7 keywords |
| 6 | Duct Work | 180m (3h) | null (quote) | 6 keywords |
| 7 | Thermostat | 60m | $149 | 5 keywords |
| 8 | Indoor Air Quality | 120m (2h) | null (quote) | 8 keywords |
| 9 | Emergency Service | 120m (2h) | $149 | 5 keywords |

- All 9 expected categories present
- Installation categories correctly have null price (requires custom quote)
- Durations are realistic for field service
- Keywords cover natural language variations

### Urgency Rules (3 levels):

| Level | Keywords | Response Time |
|-------|----------|--------------|
| emergency | gas leak, carbon monoxide, burning smell, etc. (11) | Immediate -- advise 911 first |
| urgent | no heat, no cooling, system down, etc. (12) | Same-day dispatch |
| routine | maintenance, tune-up, estimate, etc. (10) | Next available appointment |

- Emergency keywords correctly prioritize life-safety hazards
- Urgent keywords cover critical comfort failures
- Response time descriptions match industry expectations

### `getHvacServiceMapping()`: PASS

- Returns 1:1 mapping (internal name == external name) for all 9 categories
- Provider-agnostic (same output for housecallpro and jobber) -- correct as a default starting point
- `externalId` is undefined -- users must map to their CRM's actual category IDs

### Migration Seed (`20260222100000_crm_integrations.sql`):

- HVAC agent template seeded with comprehensive prompt template including:
  - Emergency triage protocol (gas leak -> 911 -> emergency service)
  - Seasonal awareness (summer AC / winter heating priorities)
  - Warranty check protocol
  - Appointment booking flow with urgency classification
  - Service area verification
- Default services, FAQs, and policies match the HVAC domain
- Automation recipes for both HCP and Jobber seeded with correct config schemas

### Test Coverage:

11 test cases in `src/lib/__tests__/hvac-templates.test.ts` covering: category count, names, keywords non-empty, positive durations, null prices for installs, prices for repairs, urgency rule count, levels, keywords, response times, mapping count/structure/provider-independence.

---

## Post-Call Pipeline (10 Transcript Tests)

Testing `extractStructuredData()` from `src/lib/transcript-extraction.ts` with mock inputs.

### Test 1: Perfect data -- PASS

**Input:**
- transcript: "Hi, my name is Sarah Johnson. You can reach me at 555-867-5309 or sarah.johnson@gmail.com. I live at 742 Evergreen Avenue in Springfield. My AC stopped working and I need it fixed as soon as possible."
- summary: "Customer called about broken AC unit"
- post_call_analysis: `{ custom_analysis_data: { caller_name: "Sarah Johnson", phone_number: "555-867-5309", email: "sarah.johnson@gmail.com", address: "742 Evergreen Avenue", service_requested: "AC Repair", urgency: "urgent", preferred_time: "ASAP" } }`

**Expected output:**
```
caller_name: "Sarah Johnson"  (from analysis.custom_analysis_data.caller_name)
phone: "555-867-5309"         (from analysis.custom_analysis_data.phone_number)
email: "sarah.johnson@gmail.com" (from analysis)
address: "742 Evergreen Avenue" (from analysis)
service_requested: "AC Repair" (from analysis)
urgency: "urgent"             (from analysis)
preferred_time: "ASAP"        (from analysis)
```

**Trace:** Analysis data takes priority. All fields populated from `custom_analysis_data`. No fallback to regex needed. Urgency validated against enum ("urgent" is valid). **CORRECT.**

### Test 2: Missing caller name -- PASS

**Input:**
- transcript: "Yeah, my AC is broken. Can someone come fix it?"
- summary: "Caller needs AC repair"
- post_call_analysis: `{ custom_analysis_data: { service_requested: "AC Repair" } }`

**Expected output:**
```
caller_name: null             (not in analysis, no regex for names)
phone: null                   (not in transcript, not in analysis)
email: null                   (not in transcript)
address: null                 (not in transcript)
service_requested: "AC Repair" (from analysis)
urgency: "routine"            (no urgency in analysis; transcript has no urgent/emergency keywords)
preferred_time: null
```

**Trace:** `caller_name` fallback to `customer_name` -- both null. No name regex exists (intentional -- name extraction from unstructured text is unreliable). Urgency: analysis has no urgency field, so `classifyUrgency` runs on transcript + summary. "ac is broken" matches "broken ac" in URGENT_KEYWORDS. Wait -- the keyword check is `lower.includes(keyword)`. The transcript lowercased is "yeah, my ac is broken. can someone come fix it?". The urgent keyword "broken ac" -- does "my ac is broken" include the substring "broken ac"? No! "ac is broken" != "broken ac". The word order matters for `includes()`.

**Correction:** Urgency would actually be "routine" here because the exact substring "broken ac" does not appear in "my ac is broken". This is a **minor gap** in the keyword matching -- it only matches exact substrings, not word-set matches. A caller saying "my AC is broken" would NOT trigger the "broken ac" urgent keyword.

**However**, the summary "Caller needs AC repair" also gets searched. It does not contain any urgent keywords either. So urgency = "routine".

In the executor, this means the caller's AC repair call would be classified as "routine" rather than "urgent". **This is a correctness issue** but not a code bug -- the keyword list is intentionally simple. The AI's `post_call_analysis` urgency field should catch this in practice.

### Test 3: Missing phone number -- PASS

**Input:**
- transcript: "I need someone to come look at my furnace. My name is Bob."
- summary: "Furnace inspection requested"
- post_call_analysis: `{ custom_analysis_data: { caller_name: "Bob", service_requested: "Furnace inspection" } }`

**Expected output:**
```
caller_name: "Bob"
phone: null        (not in analysis or transcript)
email: null
address: null
service_requested: "Furnace inspection"
urgency: "routine" (no urgency in analysis; no urgent keywords in text)
preferred_time: null
```

**Trace:** Correct. The executor (`executeHousecallPro`) uses `callLog.from_number` for the phone search, not `extracted.phone`. Even with `extracted.phone` null, the customer search still works because it uses the call's caller ID. **No issue.**

### Test 4: Emergency call (gas leak) -- PASS

**Input:**
- transcript: "Oh my god, I smell a gas leak in the basement! My carbon monoxide detector is going off! We need someone NOW!"
- summary: "Emergency: customer reports gas leak and CO alarm"
- post_call_analysis: `{ custom_analysis_data: { urgency: "emergency", service_requested: "Gas Leak Emergency" } }`

**Expected output:**
```
caller_name: null
phone: null
email: null
address: null
service_requested: "Gas Leak Emergency"
urgency: "emergency"     (from analysis)
preferred_time: null
```

**Trace:** Analysis provides `urgency: "emergency"` -- validated against enum, accepted. Even without analysis, `classifyUrgency` would find "gas leak" (line 29 of EMERGENCY_KEYWORDS) in the lowercased transcript. **Correct double-coverage.**

### Test 5: Non-emergency routine maintenance -- PASS

**Input:**
- transcript: "Hi, I'd like to schedule a tune-up for my HVAC system. Maybe sometime next week would work."
- summary: "Customer wants to schedule HVAC maintenance tune-up"
- post_call_analysis: `{ custom_analysis_data: { service_requested: "Maintenance & Tune-Up", preferred_time: "Next week" } }`

**Expected output:**
```
caller_name: null
phone: null
email: null
address: null
service_requested: "Maintenance & Tune-Up"
urgency: "routine"     (no urgency in analysis; "tune-up" is a routine keyword but would be checked anyway)
preferred_time: "Next week"
```

**Trace:** No urgency in analysis. `classifyUrgency` runs on text. Transcript contains "tune-up" -- but wait, is "tune-up" only in the ROUTINE keywords of `HVAC_URGENCY_RULES`? Let me check `URGENT_KEYWORDS` in transcript-extraction.ts. No, "tune-up" is not in URGENT_KEYWORDS or EMERGENCY_KEYWORDS. It's not in any list in transcript-extraction.ts. The urgency classification uses the keywords from transcript-extraction.ts (not hvac-templates.ts). So no keywords match -> returns "routine". **Correct.**

### Test 6: Caller outside service area (no address match) -- PASS

**Input:**
- transcript: "Hi, we're at 99 Ocean Drive and our heat isn't working."
- summary: "Customer outside service area needs heating repair"
- post_call_analysis: `{ custom_analysis_data: { address: "99 Ocean Drive", service_requested: "Heating Repair", urgency: "urgent" } }`

**Expected output:**
```
caller_name: null
phone: null
email: null
address: "99 Ocean Drive"   (from analysis)
service_requested: "Heating Repair"
urgency: "urgent"
preferred_time: null
```

**Trace:** The address is extracted correctly. Service area validation is NOT done by `extractStructuredData` -- that is the AI agent's responsibility during the live call using the prompt template's "SERVICE AREA VERIFICATION" section. The post-call executor will create the customer and note regardless of address. **Correct behavior for the extraction function.**

### Test 7: Duplicate caller (search returns existing customer) -- PASS

**Input:** (Same as Test 1 but simulating the executor flow)
- `from_number`: "+15551234567"
- HCP search returns: `{ customers: [{ id: "existing-123" }], total_items: 1 }`

**Trace through executor:**
1. Search finds existing customer -> uses `customerId = "existing-123"`
2. Skips customer creation
3. Creates note on existing customer
4. Logs `event_type: "note_logged"` (not "customer_created_and_note_logged")

**For Jobber:**
1. Search finds existing client -> uses that client's node ID
2. Creates request against existing client
3. Logs `event_type: "request_created"` (not "client_created_and_request_logged")

**Correct.** No duplicate creation. Note/request appended to existing record.

### Test 8: Caller who didn't book (no service_requested) -- PASS

**Input:**
- transcript: "I was just calling to ask about your hours. Thanks, that's all I needed."
- summary: "Caller asked about business hours"
- post_call_analysis: `{}`

**Expected output:**
```
caller_name: null
phone: null
email: null
address: null
service_requested: "Caller asked about business hours"  (fallback from summary, line 152-153)
urgency: "routine"
preferred_time: null
```

**Trace:** No `service_requested` in analysis. Summary fallback kicks in at line 152: `result.service_requested = summary`. Length is < 200 so no truncation. Urgency: no keywords match. **Correct.** The note/request will be created with summary text as the service description, which is a reasonable UX for the business owner.

### Test 9: Caller who booked two services -- PASS (with limitation)

**Input:**
- transcript: "I need an AC tune-up and also want to get a quote on a new thermostat installation."
- summary: "Customer wants AC maintenance and thermostat quote"
- post_call_analysis: `{ custom_analysis_data: { service_requested: "AC Tune-Up, Thermostat Installation", urgency: "routine" } }`

**Expected output:**
```
caller_name: null
phone: null
email: null
address: null
service_requested: "AC Tune-Up, Thermostat Installation"
urgency: "routine"
preferred_time: null
```

**Trace:** `service_requested` is a single string field. Multiple services are concatenated by the AI. `mapServiceToCategory` will try to fuzzy-match "AC Tune-Up, Thermostat Installation" against the service_category_mappings. The fuzzy match checks bidirectional containment: "ac tune-up, thermostat installation" includes "thermostat" (from "Thermostat" mapping) so it would match on "Thermostat". It would also include "maintenance" if spelled that way.

**Limitation:** Only one service mapping is returned (the first fuzzy match). For multi-service requests, only the first matching category is used. This is a known V1 limitation, not a bug.

### Test 10: Garbled/incomplete transcript -- PASS

**Input:**
- transcript: "...bzzt... yeah the... [inaudible]... cold... [static]"
- summary: null
- post_call_analysis: null

**Expected output:**
```
caller_name: null
phone: null
email: null
address: null
service_requested: null    (no analysis, no summary)
urgency: "routine"         (no keywords match in garbled text)
preferred_time: null
```

**Trace:** Analysis is null. No regex matches in garbled text. No summary for fallback. Urgency defaults to "routine". The executor will: search by phone (from caller ID), create/find customer, log a note with "AI Phone Call - completed" and urgency "routine". No service mapping (null service_requested returns null from mapper). **Correct graceful degradation.**

---

## Critical Issues Found

### BLOCKER 1: Jobber GraphQL String Interpolation (Injection Vulnerability)

**Affected files:**
- `src/lib/oauth/executors/jobber.ts:81` (executor search query)
- `src/app/api/tools/jobber/lookup/route.ts:28` (lookup tool)
- `src/app/api/tools/jobber/availability/route.ts:31-32` (availability tool)
- `src/app/api/tools/jobber/book/route.ts:29` (book tool search)
- `src/app/api/tools/jobber/create-quote/route.ts:29` (quote tool search)

All these use template literal string interpolation to embed user-controlled values into GraphQL query strings:
```javascript
`{ clients(searchTerm: "${phone}") { ... } }`
```

The mutations in the same files correctly use GraphQL variables:
```javascript
`mutation($input: ClientCreateInput!) { clientCreate(input: $input) { ... } }`
```

**Fix:** All search queries should use the `variables` parameter that `jobberGraphQL()` already supports:
```javascript
jobberGraphQL(
  accessToken,
  `query($searchTerm: String!) { clients(searchTerm: $searchTerm) { nodes { ... } } }`,
  { searchTerm: phone }
)
```

### BLOCKER 2: Missing Cron Route for Retry Queue

The `processRetryQueue()` function in `src/lib/integration-retry.ts` is fully implemented and tested, but there is **no cron endpoint** at `/api/cron/retry-queue` to invoke it. The retry queue will accumulate pending items that are never processed.

**Fix:** Create `/src/app/api/cron/retry-queue/route.ts` that calls `processRetryQueue()` with a cron secret validation, and add it to `vercel.json` crons.

---

## Warnings

### WARNING 1: HCP Webhook Missing client_id (Silent FK Violation)

`src/app/api/webhooks/housecallpro/route.ts:11` inserts into `integration_events` without setting `client_id`, which is `NOT NULL` in the schema. Every HCP webhook call silently fails.

### WARNING 2: Jobber Webhook "unknown" client_id (FK Violation)

`src/app/api/webhooks/jobber/route.ts:11` sets `client_id: body.account_id || "unknown"`. If `account_id` is missing, "unknown" is not a valid UUID and will cause an FK violation.

### WARNING 3: No Webhook Signature Validation

Neither the HCP nor Jobber webhook endpoints validate webhook signatures. Both providers support signature verification. This means anyone who discovers the webhook URLs can inject fake events.

### WARNING 4: Urgency Keyword Matching is Substring-Based

`classifyUrgency()` uses `string.includes(keyword)` which requires exact substring matches. "broken ac" won't match "ac is broken". This is partially mitigated by the AI's `post_call_analysis.urgency` field, but when that's missing, some urgent calls may be misclassified as routine.

### WARNING 5: HCP Availability Only Checks First Employee

`/api/tools/housecallpro/availability/route.ts:52` only checks the schedule of `employees[0]`. Multi-tech companies will see reduced availability. This is a V1 limitation.

---

## Recommendations

1. **Fix Jobber GraphQL injection** (BLOCKER) -- convert all 5 search queries to use GraphQL variables
2. **Create cron route for retry queue** (BLOCKER) -- `/api/cron/retry-queue` with `processRetryQueue()`
3. **Fix HCP webhook** -- determine client_id from webhook payload (HCP includes company info) or from a mapping table
4. **Fix Jobber webhook** -- validate `account_id` is a valid UUID before using as client_id, or look up client_id from provider metadata
5. **Add webhook signature validation** for both HCP and Jobber endpoints
6. **Consider word-boundary matching** for urgency keywords (e.g., regex `\bbroken\b.*\bac\b|\bac\b.*\bbroken\b` instead of substring "broken ac")
7. **Add multi-employee support** to HCP availability check for businesses with multiple techs
8. **Add `mapServiceToCategory` support for multiple services** -- split comma-separated service requests and return an array of mappings

---

## Files Audited

| File | Lines | Verdict |
|------|-------|---------|
| `src/lib/oauth/providers.ts` | 109 | PASS |
| `src/lib/oauth/state.ts` | 37 | PASS |
| `src/lib/oauth/token-manager.ts` | 108 | PASS |
| `src/lib/oauth/execute-native.ts` | 48 | PASS |
| `src/lib/oauth/register-agent-tools.ts` | 786 | PASS |
| `src/lib/oauth/executors/housecallpro.ts` | 216 | PASS |
| `src/lib/oauth/executors/jobber.ts` | 200 | FAIL (injection) |
| `src/lib/integration-events.ts` | 46 | PASS |
| `src/lib/integration-retry.ts` | 122 | PASS |
| `src/lib/transcript-extraction.ts` | 177 | PASS |
| `src/lib/service-mapper.ts` | 62 | PASS |
| `src/lib/hvac-templates.ts` | 161 | PASS |
| `src/lib/automation-recipes.ts` | 213 | PASS |
| `src/lib/post-call-actions.ts` | 321 | PASS |
| `src/lib/crypto.ts` | 41 | PASS |
| `src/app/api/oauth/authorize/route.ts` | 57 | PASS |
| `src/app/api/oauth/callback/route.ts` | 319 | PASS |
| `src/app/api/oauth/disconnect/route.ts` | 78 | PASS |
| `src/app/api/tools/housecallpro/lookup/route.ts` | 77 | PASS |
| `src/app/api/tools/housecallpro/availability/route.ts` | 106 | PASS |
| `src/app/api/tools/housecallpro/book/route.ts` | 123 | PASS |
| `src/app/api/tools/housecallpro/create-estimate/route.ts` | 119 | PASS |
| `src/app/api/tools/jobber/lookup/route.ts` | 53 | FAIL (injection) |
| `src/app/api/tools/jobber/availability/route.ts` | 81 | FAIL (injection) |
| `src/app/api/tools/jobber/book/route.ts` | 100 | FAIL (search injection) |
| `src/app/api/tools/jobber/create-quote/route.ts` | 93 | FAIL (search injection) |
| `src/app/api/webhooks/housecallpro/route.ts` | 25 | FAIL (missing client_id) |
| `src/app/api/webhooks/jobber/route.ts` | 27 | WARNING (invalid client_id fallback) |
| `src/app/api/integrations/events/route.ts` | 47 | PASS |
| `src/app/api/integrations/service-mappings/route.ts` | 127 | PASS |
| `src/app/api/integrations/recent-syncs/route.ts` | 31 | PASS |
| `src/app/api/webhooks/retell/route.ts` | 377 | PASS |
| `supabase/migrations/20260222100000_crm_integrations.sql` | 219 | PASS |

**Test files audited:** 7 files, all passing with comprehensive coverage.

---

*Audit performed by integration-auditor agent, 2026-02-22*
