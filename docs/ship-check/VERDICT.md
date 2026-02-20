# SHIP-READINESS VERDICT

**Date:** 2026-02-20
**Platform:** Invaria Labs Voice AI (Next.js 16.1.6 + Supabase + Retell AI + Stripe)
**Auditors:** 5-agent team (build-health, critical-paths, data-integrity, retell-parity, security-review)

---

## VERDICT: DO NOT SHIP

**The production build does not compile.** Until the 2 build blockers are resolved, no deployment is possible. Beyond that, 4 additional blockers and 2 critical security issues must be fixed before launch.

---

## BLOCKERS (must fix before launch)

### B1. Build fails -- TypeScript error in phone-numbers page
- **File:** `src/app/(startup)/clients/[id]/phone-numbers/page.tsx:74`
- **Issue:** The `.map()` constructs a `PhoneNumberWithAgent` object missing 3 required fields: `caller_id_name`, `caller_id_verified`, `cnam_status`.
- **Impact:** `npm run build` exits with error. **No production bundle can be generated.**
- **Fix:** Add the 3 missing fields to the mapped object (trivial).

### B2. Missing `@/lib/retell` module breaks web call creation
- **File:** `src/app/api/calls/route.ts:47`
- **Issue:** `src/lib/retell.ts` was deleted during the cleanup phase but `/api/calls` still dynamically imports it. The `POST /api/calls` endpoint with `action: "create_web_call"` will always return 500.
- **Impact:** Web call creation via `/api/calls` is completely broken. The alternative endpoint `/api/agents/create-web-call` works correctly.
- **Fix:** Either recreate `src/lib/retell.ts` with the `createWebCall` export, or refactor `/api/calls` to use the same direct fetch approach as `/api/agents/create-web-call`, or delete the dead code path.

### B3. `business_faqs/services/policies/locations` tables missing `updated_at` column
- **File:** All `business-settings/*/[id]/route.ts` PATCH handlers
- **Issue:** Every PATCH route sets `updated_at: new Date().toISOString()` but these 4 tables were never given an `updated_at` column in any migration. Only `business_settings` (the parent table) has it.
- **Impact:** **ALL edit operations on services, FAQs, policies, and locations will return 500 errors.** These are core business configuration features used during onboarding and daily management.
- **Fix:** New migration adding `updated_at TIMESTAMPTZ DEFAULT NOW()` to all 4 tables, OR remove `updated_at` from the PATCH payloads.

### B4. `agents.retell_llm_id` column does not exist -- version restore broken
- **File:** `src/app/api/agents/[id]/versions/route.ts:87`
- **Issue:** The version restore POST handler selects `retell_llm_id` from the `agents` table, but this column doesn't exist. The query returns null, so the LLM config from the saved version is **silently never restored**.
- **Impact:** Agent version rollback is silently broken for agents using separate LLM objects. Users think they've restored a version but the LLM config stays unchanged.
- **Fix:** Either add `retell_llm_id TEXT` column to `agents` table, or rewrite the version restore logic to fetch the LLM ID from the Retell API response instead of the local DB.

### B5. `/api/demo-call` is public with no auth and no rate limit
- **File:** `src/app/api/demo-call/route.ts`
- **Issue:** This endpoint triggers **real outbound phone calls** via Retell API with zero authentication and zero rate limiting.
- **Impact:** An attacker can spam arbitrary phone numbers with calls, exhaust Retell API quota, and incur significant telephony charges. **Financial loss and abuse potential.**
- **Fix:** Add `publicEndpointLimiter` at minimum. Consider requiring a CAPTCHA token or session.

### B6. `/api/auth/reset-password` has no rate limit
- **File:** `src/app/api/auth/reset-password/route.ts`
- **Issue:** Uses service role key to generate password recovery emails with no rate limiting.
- **Impact:** Email bombing attack vector. Can exhaust Resend email quota and create noise masking real attacks.
- **Fix:** Add `publicEndpointLimiter`.

### B7. Billing page shows null plan details (Stripe expand bug)
- **File:** `src/lib/stripe.ts` (`retrieveSubscription`) + `src/app/api/client/billing/route.ts`
- **Issue:** `retrieveSubscription()` only expands `["default_payment_method"]` but the billing route reads `sub.items?.data?.[0]?.price?.product?.name`. Without expanding `items.data.price.product`, Stripe returns string IDs instead of objects.
- **Impact:** `plan_name`, `plan_amount`, `plan_interval`, and `plan_currency` are ALL null on the billing page. The page may fall back to DB plan data, but the subscription card will show incorrect/missing information.
- **Fix:** Change expand to `["default_payment_method", "items.data.price.product"]`.

---

## WARNINGS (fix soon, won't break most users)

### W1. Several agent sub-routes lack org ownership verification
- **Files:** `agents/[id]/config`, `agents/[id]/publish`, `agents/[id]/voices`, `agents/[id]/versions`, `agents/[id]/chat`
- **Issue:** These routes authenticate the user but don't verify the agent belongs to the user's organization. They rely solely on Supabase RLS.
- **Risk:** If RLS is misconfigured, cross-org agent access is possible by guessing UUIDs.
- **Recommendation:** Add `.eq("organization_id", user.organization_id)` to agent queries as defense-in-depth.

### W2. Multiple list endpoints lack explicit org filter
- **Files:** `GET /api/agents`, `GET /api/calls`, `GET /api/clients`, `GET /api/phone-numbers`, `GET /api/solutions`
- **Issue:** Query without `organization_id` filter, relying entirely on RLS.
- **Risk:** Same as W1.

### W3. `/api/checkout` has no rate limit
- **File:** `src/app/api/checkout/route.ts`
- **Issue:** Public endpoint creating Stripe checkout sessions without rate limiting.
- **Risk:** Can hit Stripe API rate limits or create garbage checkout sessions.

### W4. `/api/contact` has no rate limit and lacks HTML escaping in email
- **File:** `src/app/api/contact/route.ts`
- **Issue:** No rate limit (spam vector) and user input interpolated into HTML email without `escapeHtml()`.
- **Risk:** Inbox spam and HTML injection in admin notification emails.

### W5. `agents.retell_api_key_encrypted` is NOT NULL but POST /api/agents can insert null
- **File:** `src/app/api/agents/route.ts:32`
- **Issue:** If POST body doesn't include an API key, the handler inserts `null` into a NOT NULL column.
- **Risk:** Manual agent creation via API crashes with 500. Onboarding flow is unaffected (always provides key).

### W6. No error boundaries in (startup), (portal), (auth) route groups
- **Issue:** Only `(marketing)` has an `error.tsx`. Unhandled exceptions in other route groups show a generic white error screen.
- **Risk:** Poor user experience on unexpected errors.

### W7. Zapier auth endpoint doesn't verify the API key secret
- **File:** `src/app/api/zapier/auth/route.ts`
- **Issue:** Only checks that the `client_id` portion of the key exists in DB. The random secret portion is ignored.
- **Risk:** Any string formatted as `valid_client_id:anything` passes Zapier auth.

### W8. In-memory rate limiter is ineffective across serverless cold starts
- **File:** `src/lib/rate-limit.ts`
- **Issue:** Uses `Map` in process memory. Each Vercel cold start gets a fresh map.
- **Risk:** Rate limiting only works during warm periods. Should migrate to Redis (e.g., Upstash) for production scale.

### W9. Webhook forwarding URLs lack SSRF validation
- **File:** `src/app/api/webhooks/retell/route.ts:287-318`
- **Issue:** Forwards payloads to stored URLs without validating they aren't internal/metadata endpoints.
- **Risk:** A compromised admin could set a webhook URL to `http://169.254.169.254/...`.

### W10. No timeouts on Retell API calls
- **Issue:** Most routes calling Retell API don't set `AbortSignal.timeout()`. If Retell is slow/down, requests hang until platform timeout.
- **Risk:** Cascading slowdowns, poor UX.

---

## ACCEPTABLE DEBT (known issues that can wait)

### D1. Middleware deprecation warning
- Next.js 16.x warns that `middleware.ts` convention is deprecated. Still works. Needs migration to `proxy` convention before next Next.js upgrade.

### D2. 18 lint errors for `setState` in `useEffect`
- React 19's stricter `react-hooks/set-state-in-effect` rule. These are async data-fetch patterns that work correctly but cause extra renders. No crashes.

### D3. 46 unused variable warnings
- Dead imports and unused vars across the codebase. Code cleanliness issue only.

### D4. Parity doc is stale
- `docs/agent-settings-parity.md` lists 3 bugs as open that are now fixed, and claims 11 missing features when only 2 actually exist in the Retell SDK. Documentation update, not a code issue.

### D5. Double redirect on client login
- Login always redirects to `/dashboard`, then middleware re-redirects client users to their portal. Works but adds a round trip.

### D6. `create-web-call` is public by design
- Allows unauthenticated call creation for embeddable widgets. Rate limited. Intentional trust boundary that should be documented.

### D7. No file size/type validation on knowledge base uploads
- Uploads forwarded directly to Retell API. Next.js and Retell have their own limits. Defense-in-depth improvement.

### D8. No double-submit prevention on creation endpoints
- Could create duplicate records on rapid double-clicks. Common in web apps, not a security vulnerability.

### D9. 2 Retell SDK fields we don't expose
- `analysis_successful_prompt` and `analysis_summary_prompt` exist in the SDK but aren't in our UI. Low-priority feature gap.

---

## SECTION VERDICTS

| Section | Agent | Verdict | Blockers | Warnings |
|---------|-------|---------|----------|----------|
| Build & Runtime | build-health | **FAIL** | 2 (build error, missing module) | 4 |
| Critical Paths | critical-paths | **4 PASS, 1 DEGRADED** | 1 (billing Stripe expand) | 3 minor |
| Data Integrity | data-integrity | **FAIL** | 3 (missing columns, missing updated_at, NOT NULL) | 2 |
| Retell Parity | retell-parity | **PASS** | 0 | 1 minor (startup chat_settings) |
| Security Review | security-review | **CONDITIONAL PASS** | 2 critical (demo-call, reset-password) | 9 |

---

## MINIMUM VIABLE SHIP CHECKLIST

To flip this verdict to **SHIP**, fix these 7 blockers:

- [ ] **B1.** Add 3 missing fields to phone-numbers page map (5 min fix)
- [ ] **B2.** Fix or remove dead `@/lib/retell` import in `/api/calls` (10 min fix)
- [ ] **B3.** Add `updated_at` column to 4 business sub-entity tables (new migration)
- [ ] **B4.** Fix agent version restore logic for `retell_llm_id` (15 min fix)
- [ ] **B5.** Add rate limiting to `/api/demo-call` (5 min fix)
- [ ] **B6.** Add rate limiting to `/api/auth/reset-password` (5 min fix)
- [ ] **B7.** Expand Stripe subscription retrieve to include `items.data.price.product` (5 min fix)

**Estimated total fix time: ~1 hour.**

After fixing blockers, strongly recommended before first real users:
- [ ] W1/W2: Add org ownership checks to agent sub-routes and list endpoints
- [ ] W3/W4: Rate limit `/api/checkout` and `/api/contact`, add HTML escaping to contact email
- [ ] W7: Fix Zapier auth to verify the secret portion of the key

---

## MANUAL DEPLOYMENT STEPS STILL PENDING

These were identified before the audit and remain unresolved:

1. **Stripe Dashboard:** Add `invoice.paid` event to the webhook endpoint
2. **Vercel Dashboard:** Set `RETELL_TOOLS_API_KEY` environment variable

---

*Generated by the ship-readiness audit team on 2026-02-20. Reports: [build-health.md](build-health.md) | [critical-paths.md](critical-paths.md) | [data-integrity.md](data-integrity.md) | [retell-parity.md](retell-parity.md) | [security-review.md](security-review.md)*
