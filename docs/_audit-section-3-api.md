# Audit Section 3: Frontend-to-Backend API Matching

**Date:** 2026-02-20
**Auditor:** api-auditor (automated)
**Scope:** All `fetch()` calls in `src/app/`, `src/components/`, and `src/hooks/` cross-referenced against all route handlers in `src/app/api/`

---

## Summary

| Category | Count |
|---|---|
| Backend API routes | 80 |
| Frontend fetch() call sites | ~120 |
| Confirmed matches (no issues) | ~105 |
| Mismatches / Issues found | 4 |
| Missing backend routes | 0 |
| Orphaned backend routes (no frontend caller) | 10 (by design) |

**Overall status:** The API surface is well-aligned. Four issues were found, one of which is a functional bug (wrong Stripe action in `saas/connect`). The rest are low-severity.

---

## 1. Backend API Route Inventory

### Agents
| Route | Methods | Notes |
|---|---|---|
| `/api/agents` | GET, POST | List/create agents |
| `/api/agents/[id]` | DELETE | Delete agent |
| `/api/agents/[id]/chat` | POST | Chat session actions (create/message/end) |
| `/api/agents/[id]/config` | GET, PATCH | Get/update Retell agent config |
| `/api/agents/[id]/knowledge-base` | GET, POST | List/add knowledge base sources |
| `/api/agents/[id]/knowledge-base/[sourceId]` | DELETE | Delete KB source |
| `/api/agents/[id]/publish` | POST | Publish agent version |
| `/api/agents/[id]/versions` | GET, POST | List/restore versions |
| `/api/agents/[id]/voices` | GET | List available voices |
| `/api/agents/create-web-call` | POST | Create Retell web call (public, rate-limited) |
| `/api/agents/sync-call` | POST | Sync call data from Retell |

### Auth
| Route | Methods | Notes |
|---|---|---|
| `/api/auth` | POST | Invite member |
| `/api/auth/reset-password` | POST | Password reset |

### Automations
| Route | Methods | Notes |
|---|---|---|
| `/api/automations/client` | GET, POST | List/enable client automations |
| `/api/automations/client/[id]` | PATCH, DELETE | Update/delete client automation |
| `/api/automations/client/[id]/logs` | GET | Fetch automation execution logs |
| `/api/automations/recipes` | GET, POST | List/create recipes |
| `/api/automations/recipes/[id]` | PATCH, DELETE | Update/delete recipe |
| `/api/automations/webhook-test` | POST | Test webhook URL |

### Billing
| Route | Methods | Notes |
|---|---|---|
| `/api/billing` | POST | Stripe billing actions (action-based dispatch) |
| `/api/checkout` | POST | Public plan checkout |
| `/api/client/billing` | GET, POST | Client billing info / portal session |
| `/api/client/plan-access` | GET | Client plan feature flags |
| `/api/marketing-checkout` | POST | Marketing site checkout |

### Business Settings
| Route | Methods | Notes |
|---|---|---|
| `/api/business-settings` | GET, PATCH | Get/update main settings |
| `/api/business-settings/faqs` | GET, POST | List/create FAQs |
| `/api/business-settings/faqs/[id]` | PATCH, DELETE | Update/delete FAQ |
| `/api/business-settings/hours` | GET, PUT | Get/set business hours |
| `/api/business-settings/locations` | GET, POST | List/create locations |
| `/api/business-settings/locations/[id]` | PATCH, DELETE | Update/delete location |
| `/api/business-settings/policies` | GET, POST | List/create policies |
| `/api/business-settings/policies/[id]` | PATCH, DELETE | Update/delete policy |
| `/api/business-settings/regenerate-prompt` | POST | Regenerate AI prompt |
| `/api/business-settings/services` | GET, POST | List/create services |
| `/api/business-settings/services/[id]` | PATCH, DELETE | Update/delete service |

### Calls
| Route | Methods | Notes |
|---|---|---|
| `/api/calls` | GET, POST | List calls / create web call (legacy) |

### Campaigns
| Route | Methods | Notes |
|---|---|---|
| `/api/campaigns` | GET, POST | List/create campaigns |
| `/api/campaigns/[id]` | PATCH, DELETE | Update/delete campaign |

### Clients
| Route | Methods | Notes |
|---|---|---|
| `/api/clients` | GET, POST | List/create clients |

### Contact
| Route | Methods | Notes |
|---|---|---|
| `/api/contact` | POST | Contact form submission |

### Conversation Flows
| Route | Methods | Notes |
|---|---|---|
| `/api/conversation-flows` | GET, POST | List/create flows |
| `/api/conversation-flows/[id]` | GET, PATCH, DELETE, POST | CRUD + deploy flow |

### Cron
| Route | Methods | Notes |
|---|---|---|
| `/api/cron/checkin-email` | GET | Cron-triggered check-in emails |
| `/api/cron/daily-digest` | GET | Cron-triggered daily digest |

### Demo
| Route | Methods | Notes |
|---|---|---|
| `/api/demo-call` | POST | Public demo call |

### Integrations
| Route | Methods | Notes |
|---|---|---|
| `/api/integrations` | POST, DELETE | Add/remove integration keys |

### Leads
| Route | Methods | Notes |
|---|---|---|
| `/api/leads` | GET, POST | List/import leads |
| `/api/leads/[id]` | PATCH, DELETE | Update/delete lead |

### OAuth
| Route | Methods | Notes |
|---|---|---|
| `/api/oauth/authorize` | GET | Start OAuth flow |
| `/api/oauth/callback` | GET | OAuth callback |
| `/api/oauth/connections` | GET | List OAuth connections |
| `/api/oauth/disconnect` | POST | Disconnect OAuth provider |
| `/api/oauth/google/calendars` | GET | List Google calendars |
| `/api/oauth/google/sheets` | GET | List Google sheets |
| `/api/oauth/slack/channels` | GET | List Slack channels |

### Onboarding
| Route | Methods | Notes |
|---|---|---|
| `/api/onboarding/create-agent` | POST | Create agent during onboarding |
| `/api/onboarding/go-live` | POST | Finalize onboarding |
| `/api/onboarding/start` | POST | Start onboarding flow |
| `/api/onboarding/status` | GET | Get onboarding progress |
| `/api/onboarding/step/[step]` | PATCH | Save step data |
| `/api/onboarding/test-call` | POST | Trigger test call |
| `/api/onboarding/test-sms` | POST | Trigger test SMS |

### Phone/SIP
| Route | Methods | Notes |
|---|---|---|
| `/api/phone-numbers` | GET, POST | List/add phone numbers |
| `/api/phone-numbers/caller-id` | PATCH | Update caller ID |
| `/api/pii-redaction` | GET, POST | Get/save PII redaction config |
| `/api/post-call-actions` | GET, PUT | Get/upsert post-call actions |
| `/api/sip-trunks` | GET, POST | List/add SIP trunks |
| `/api/sip-trunks/[id]` | GET, PATCH, DELETE | CRUD SIP trunk |

### Settings
| Route | Methods | Notes |
|---|---|---|
| `/api/settings` | PATCH | Update org settings (API keys) |

### Solutions
| Route | Methods | Notes |
|---|---|---|
| `/api/solutions` | GET, POST | List/create solutions |

### Tools (Retell agent tool endpoints)
| Route | Methods | Notes |
|---|---|---|
| `/api/tools/calendar/availability` | POST | Check Google Calendar availability |
| `/api/tools/calendar/book` | POST | Book Google Calendar appointment |
| `/api/tools/calendly/availability` | POST | Check Calendly availability |
| `/api/tools/calendly/book` | POST | Book Calendly appointment |
| `/api/tools/hubspot/lookup` | POST | HubSpot contact lookup |

### Usage
| Route | Methods | Notes |
|---|---|---|
| `/api/usage/agent-costs` | GET | Agent cost breakdown |

### Webhooks
| Route | Methods | Notes |
|---|---|---|
| `/api/webhooks/retell` | POST | Retell webhook handler |
| `/api/webhooks/stripe` | POST | Stripe webhook handler |

### Zapier
| Route | Methods | Notes |
|---|---|---|
| `/api/zapier/auth` | GET | Zapier auth check |
| `/api/zapier/subscribe` | POST, DELETE | Zapier subscription management |

---

## 2. Mismatches Found

### ISSUE 3-1: `saas/connect` page uses wrong Stripe action for "Update"

**Severity: HIGH (functional bug)**

- **Frontend:** `src/app/(startup)/saas/connect/page.tsx:163-170`
  ```ts
  const res = await fetch("/api/billing", {
    method: "POST",
    body: JSON.stringify({
      action: "create_connect_account",  // <-- WRONG
      email: user.email,
    }),
  });
  ```
- **Backend:** `src/app/api/billing/route.ts:40-61`
  - `create_connect_account` creates a **new** Stripe Connect account and returns `{ accountId, url }`
  - `create_account_link` creates an account link for an **existing** account and returns `{ url }`
- **The problem:** The "Update" button in `saas/connect` calls `create_connect_account` instead of `create_account_link`. This creates a **new** Stripe account each time the user clicks "Update" instead of letting them update the existing one.
- **Correct behavior:** Compare with `src/app/(startup)/billing/connect/page.tsx:192-195` which correctly sends `action: "create_account_link"` with `stripeAccountId`.
- **Also note:** The `saas/connect` `handleUpdate` extracts only `{ url }` from the response (line 174), but `create_connect_account` returns `{ accountId, url }` -- the `accountId` is silently ignored, leaving the local state inconsistent.

---

### ISSUE 3-2: `checkout` frontend sends `return_url` but backend uses it conditionally

**Severity: LOW (cosmetic, works correctly)**

- **Frontend:** `src/app/(portal)/[clientSlug]/portal/billing/page.tsx:382`
  ```ts
  body: JSON.stringify({ plan_id: plan.id, return_url: window.location.href })
  ```
- **Frontend:** `src/app/pricing/[orgSlug]/pricing-cards.tsx:322`
  ```ts
  body: JSON.stringify({ plan_id: plan.id, billing_period: isAnnual ? "yearly" : "monthly" })
  ```
- **Backend:** `src/app/api/checkout/route.ts:11`
  ```ts
  const { plan_id, billing_period, return_url } = body;
  ```
- **The problem:** The portal billing page sends `return_url` but does NOT send `billing_period`, so `billing_period` will be `undefined` and `isYearly` will be `false`. This defaults to monthly pricing, which may not be the user's intent if they were previously on an annual plan.
- **Impact:** Minor -- users checking out from the portal billing page always get monthly pricing. The pricing-cards page sends `billing_period` correctly.

---

### ISSUE 3-3: `call-handling-settings.tsx` sends fields the backend does not persist

**Severity: LOW (silent data loss)**

- **Frontend:** `src/components/business-settings/call-handling-settings.tsx:97-105`
  ```ts
  const payload = {
    after_hours_behavior,
    unanswerable_behavior,
    escalation_phone,
    max_call_duration_minutes,
    post_call_email,       // <-- field name
    post_call_log,         // <-- field name
    post_call_text,        // <-- field name
  };
  ```
- **Backend:** `src/app/api/business-settings/route.ts:44-81` (PATCH handler)
  The PATCH handler does a generic update on the `business_settings` table using the body fields.
- **The concern:** The column names in the `business_settings` table may differ from the frontend field names. The frontend sends `post_call_email`, `post_call_log`, and `post_call_text`, but the onboarding step handler (which also writes to `business_settings`) uses `post_call_email_summary`, `post_call_log`, and `post_call_followup_text`. If the database columns use the onboarding names, then `post_call_email` and `post_call_text` would be silently ignored by Supabase (no error, just not persisted).
- **Needs verification:** Check that `business_settings` table column names match the field names sent by this component. If they use `post_call_email_summary` and `post_call_followup_text`, the data from this component is silently lost.

---

### ISSUE 3-4: `regenerate-prompt` route has no frontend caller

**Severity: INFO (potentially dead code)**

- **Backend:** `src/app/api/business-settings/regenerate-prompt/route.ts` (POST)
- **Frontend:** No frontend code calls `/api/business-settings/regenerate-prompt` anywhere.
- **Note:** The `regeneratePrompt()` function IS called directly from many other backend route handlers (policies, FAQs, services, locations, hours, business-settings PATCH, onboarding). The dedicated API route appears to be an unused entry point that was perhaps intended for manual triggering from a UI button that was never added. Not a bug, but dead code.

---

## 3. Orphaned Backend Routes (No Frontend Caller)

These backend routes have no corresponding `fetch()` call from frontend code. However, most are **by design** (called by external services, cron jobs, or other backend routes).

| Route | Reason for no frontend caller |
|---|---|
| `/api/cron/checkin-email` (GET) | Called by Vercel Cron / external scheduler |
| `/api/cron/daily-digest` (GET) | Called by Vercel Cron / external scheduler |
| `/api/webhooks/retell` (POST) | Called by Retell webhook |
| `/api/webhooks/stripe` (POST) | Called by Stripe webhook |
| `/api/tools/calendar/availability` (POST) | Called by Retell agent tool during calls |
| `/api/tools/calendar/book` (POST) | Called by Retell agent tool during calls |
| `/api/tools/calendly/availability` (POST) | Called by Retell agent tool during calls |
| `/api/tools/calendly/book` (POST) | Called by Retell agent tool during calls |
| `/api/tools/hubspot/lookup` (POST) | Called by Retell agent tool during calls |
| `/api/zapier/auth` (GET) | Called by Zapier authentication flow |
| `/api/zapier/subscribe` (POST, DELETE) | Called by Zapier subscription hooks |
| `/api/calls` (GET, POST) | Legacy route; `create-web-call` has a dedicated route now. GET is used directly via Supabase client-side. |
| `/api/solutions` (GET, POST) | No frontend callers found; may be unused or called from an admin tool |
| `/api/business-settings/regenerate-prompt` (POST) | No frontend caller; function called directly from other backend routes |

---

## 4. Missing Backend Routes

**None found.** Every frontend `fetch()` call points to an existing backend route.

---

## 5. Cross-Reference: All Frontend API Calls

### Verified Matches (no issues)

#### Portal Pages (`src/app/(portal)/[clientSlug]/portal/`)

| Frontend File | API Call | Method | Backend Route | Status |
|---|---|---|---|---|
| `page.tsx:137` | `/api/onboarding/status` | GET | `onboarding/status` | OK |
| `page.tsx:647` | `/api/agents/${id}` | DELETE | `agents/[id]` | OK |
| `billing/page.tsx:338` | `/api/client/billing` | GET | `client/billing` | OK |
| `billing/page.tsx:357` | `/api/client/billing` | POST | `client/billing` | OK |
| `billing/page.tsx:379` | `/api/checkout` | POST | `checkout` | OK (see Issue 3-2) |
| `agents/[id]/agent-settings` | `/api/agents/${id}/config` | GET, PATCH | `agents/[id]/config` | OK |
| `agents/[id]/agent-settings` | `/api/agents/${id}/voices` | GET | `agents/[id]/voices` | OK |
| `agents/[id]/agent-settings` | `/api/agents/${id}/chat` | POST | `agents/[id]/chat` | OK |
| `agents/[id]/agent-settings` | `/api/agents/${id}/versions` | GET, POST | `agents/[id]/versions` | OK |
| `agents/[id]/agent-settings` | `/api/agents/${id}/publish` | POST | `agents/[id]/publish` | OK |
| `agents/[id]/leads` | `/api/leads/${id}` | DELETE, PATCH | `leads/[id]` | OK |
| `agents/[id]/knowledge-base` | `/api/agents/${id}/knowledge-base` | GET, POST | `agents/[id]/knowledge-base` | OK |
| `agents/[id]/knowledge-base` | `/api/agents/${id}/knowledge-base/${sourceId}` | DELETE | `agents/[id]/knowledge-base/[sourceId]` | OK |
| `agents/[id]/campaigns` | `/api/leads` | POST | `leads` | OK |
| `agents/[id]/campaigns` | `/api/campaigns/${id}` | DELETE, PATCH | `campaigns/[id]` | OK |
| `conversation-flows` | `/api/conversation-flows` | GET, POST | `conversation-flows` | OK |
| `conversation-flows` | `/api/conversation-flows/${id}` | PATCH, POST, DELETE | `conversation-flows/[id]` | OK |
| `automations` | `/api/automations/recipes` | GET | `automations/recipes` | OK |
| `automations` | `/api/automations/client` | GET, POST | `automations/client` | OK |
| `automations` | `/api/automations/client/${id}` | PATCH | `automations/client/[id]` | OK |
| `automations` | `/api/oauth/connections` | GET | `oauth/connections` | OK |
| `onboarding` | `/api/onboarding/status` | GET | `onboarding/status` | OK |
| `onboarding` | `/api/onboarding/step/${n}` | PATCH | `onboarding/step/[step]` | OK |
| `onboarding` | `/api/onboarding/start` | POST | `onboarding/start` | OK |
| `onboarding` | `/api/onboarding/create-agent` | POST | `onboarding/create-agent` | OK |
| `onboarding` | `/api/onboarding/test-call` | POST | `onboarding/test-call` | OK |
| `onboarding` | `/api/onboarding/test-sms` | POST | `onboarding/test-sms` | OK |
| `onboarding` | `/api/onboarding/go-live` | POST | `onboarding/go-live` | OK |
| `onboarding` | `/api/conversation-flows` | GET, POST | `conversation-flows` | OK |
| `onboarding` | `/api/conversation-flows/${id}` | PATCH, POST | `conversation-flows/[id]` | OK |
| `settings/business` | `/api/business-settings` | GET | `business-settings` | OK |

#### Startup Pages (`src/app/(startup)/`)

| Frontend File | API Call | Method | Backend Route | Status |
|---|---|---|---|---|
| `agents/page.tsx` | `/api/agents` | POST | `agents` | OK |
| `agents/[id]/agent-config` | `/api/agents/${id}/config` | GET, PATCH | `agents/[id]/config` | OK |
| `agents/[id]/agent-config` | `/api/agents/${id}/versions` | GET, POST | `agents/[id]/versions` | OK |
| `agents/[id]/agent-config` | `/api/agents/${id}/publish` | POST | `agents/[id]/publish` | OK |
| `agents/[id]/layout.tsx` | `/api/agents/${id}/config` | PATCH | `agents/[id]/config` | OK |
| `clients/page.tsx` | `/api/clients` | POST | `clients` | OK |
| `settings/integrations` | `/api/integrations` | POST, DELETE | `integrations` | OK |
| `settings/startup` | `/api/settings` | PATCH | `settings` | OK |
| `settings/phone-sip` | `/api/phone-numbers` | GET, POST | `phone-numbers` | OK |
| `settings/phone-sip` | `/api/phone-numbers/caller-id` | PATCH | `phone-numbers/caller-id` | OK |
| `settings/phone-sip` | `/api/sip-trunks` | GET, POST | `sip-trunks` | OK |
| `settings/phone-sip` | `/api/sip-trunks/${id}` | PATCH, DELETE | `sip-trunks/[id]` | OK |
| `settings/usage` | `/api/usage/agent-costs` | GET | `usage/agent-costs` | OK |
| `settings/members` | `/api/auth` | POST | `auth` | OK |
| `automations` | `/api/automations/recipes` | GET, POST, PATCH, DELETE | `automations/recipes`, `automations/recipes/[id]` | OK |
| `billing/products` | `/api/billing` | POST | `billing` | OK |
| `billing/invoices` | `/api/billing` | POST | `billing` | OK |
| `billing/subscriptions` | `/api/billing` | POST | `billing` | OK |
| `billing/coupons` | `/api/billing` | POST | `billing` | OK |
| `billing/transactions` | `/api/billing` | POST | `billing` | OK |
| `billing/connect` | `/api/billing` | POST | `billing` | OK |
| `saas/connect` | `/api/billing` | POST | `billing` | Issue 3-1 |

#### Marketing / Auth Pages

| Frontend File | API Call | Method | Backend Route | Status |
|---|---|---|---|---|
| `(marketing)/contact` | `/api/contact` | POST | `contact` | OK |
| `(marketing)/pricing` | `/api/marketing-checkout` | POST | `marketing-checkout` | OK |
| `(auth)/signup` | `/api/marketing-checkout` | POST | `marketing-checkout` | OK |
| `(auth)/forgot-password` | `/api/auth/reset-password` | POST | `auth/reset-password` | OK |
| `pricing/[orgSlug]/pricing-cards` | `/api/checkout` | POST | `checkout` | OK |

#### Components

| Frontend File | API Call | Method | Backend Route | Status |
|---|---|---|---|---|
| `portal/feature-gate.tsx` | `/api/client/plan-access` | GET | `client/plan-access` | OK |
| `portal/chat-widget.tsx` | `/api/agents/${id}/chat` | POST | `agents/[id]/chat` | OK |
| `layout/portal-sidebar.tsx` | `/api/client/plan-access` | GET | `client/plan-access` | OK |
| `business-settings/hours-editor` | `/api/business-settings/hours` | GET, PUT | `business-settings/hours` | OK |
| `business-settings/hours-editor` | `/api/business-settings` | GET, PATCH | `business-settings` | OK |
| `business-settings/call-handling-settings` | `/api/business-settings` | GET, PATCH | `business-settings` | Issue 3-3 |
| `business-settings/services-list` | `/api/business-settings/services` | GET | `business-settings/services` | OK |
| `business-settings/services-list` | `/api/business-settings/services/${id}` | DELETE | `business-settings/services/[id]` | OK |
| `business-settings/post-call-actions` | `/api/post-call-actions` | GET, PUT | `post-call-actions` | OK |
| `business-settings/policies-list` | `/api/business-settings/policies` | GET | `business-settings/policies` | OK |
| `business-settings/policies-list` | `/api/business-settings/policies/${id}` | DELETE | `business-settings/policies/[id]` | OK |
| `business-settings/faqs-list` | `/api/business-settings/faqs` | GET | `business-settings/faqs` | OK |
| `business-settings/faqs-list` | `/api/business-settings/faqs/${id}` | DELETE | `business-settings/faqs/[id]` | OK |
| `business-settings/pii-redaction-settings` | `/api/pii-redaction` | GET, POST | `pii-redaction` | OK |
| `business-settings/business-info-form` | `/api/business-settings` | GET, PATCH | `business-settings` | OK |
| `business-settings/faq-editor-modal` | `/api/business-settings/faqs` | POST | `business-settings/faqs` | OK |
| `business-settings/faq-editor-modal` | `/api/business-settings/faqs/${id}` | PATCH | `business-settings/faqs/[id]` | OK |
| `business-settings/policy-editor-modal` | `/api/business-settings/policies` | POST | `business-settings/policies` | OK |
| `business-settings/policy-editor-modal` | `/api/business-settings/policies/${id}` | PATCH | `business-settings/policies/[id]` | OK |
| `business-settings/service-editor-modal` | `/api/business-settings/services` | POST | `business-settings/services` | OK |
| `business-settings/service-editor-modal` | `/api/business-settings/services/${id}` | PATCH | `business-settings/services/[id]` | OK |
| `business-settings/locations-list` | `/api/business-settings/locations` | GET, POST | `business-settings/locations` | OK |
| `business-settings/locations-list` | `/api/business-settings/locations/${id}` | PATCH, DELETE | `business-settings/locations/[id]` | OK |
| `agents/prototype-call-dialog` | `/api/agents/${id}/chat` | POST | `agents/[id]/chat` | OK |
| `marketing/sections/live-demo` | `/api/demo-call` | POST | `demo-call` | OK |
| `automations/webhook-config` | `/api/automations/webhook-test` | POST | `automations/webhook-test` | OK |
| `automations/resource-pickers/google-sheet-picker` | `/api/oauth/google/sheets` | GET | `oauth/google/sheets` | OK |
| `automations/resource-pickers/google-calendar-picker` | `/api/oauth/google/calendars` | GET | `oauth/google/calendars` | OK |
| `automations/resource-pickers/slack-channel-picker` | `/api/oauth/slack/channels` | GET | `oauth/slack/channels` | OK |
| `automations/oauth-connect-button` | `/api/oauth/disconnect` | POST | `oauth/disconnect` | OK |
| `automations/automation-logs-table` | `/api/automations/client/${id}/logs` | GET | `automations/client/[id]/logs` | OK |
| `onboarding/test-chat-inline` | `/api/agents/${id}/chat` | POST | `agents/[id]/chat` | OK |

#### Hooks

| Frontend File | API Call | Method | Backend Route | Status |
|---|---|---|---|---|
| `use-agent-config.ts` | `/api/agents/${id}/config` | GET, PATCH | `agents/[id]/config` | OK |
| `use-retell-call.ts` | `/api/agents/sync-call` | POST | `agents/sync-call` | OK |
| `use-retell-call.ts` | `/api/agents/create-web-call` | POST | `agents/create-web-call` | OK |
| `use-plan-access.ts` | `/api/client/plan-access` | GET | `client/plan-access` | OK |

---

## 6. Error Handling Coverage

Most frontend `fetch()` calls check `res.ok` and display toast errors. Notable patterns:

- **Good:** Most pages use try/catch with toast error messages
- **Good:** Backend routes consistently return `{ error: "message" }` on failure with appropriate HTTP status codes
- **Note:** Some catch blocks silently ignore errors (e.g., `use-plan-access.ts`, `use-agent-config.ts` on fetch failure) -- this is intentional for graceful degradation

---

## 7. Recommendations

1. **Fix Issue 3-1 (HIGH):** In `src/app/(startup)/saas/connect/page.tsx:163-170`, change the `handleUpdate` action from `"create_connect_account"` to `"create_account_link"` and include the `stripeAccountId` in the request body, matching the pattern in `src/app/(startup)/billing/connect/page.tsx:192-195`.

2. **Fix Issue 3-2 (LOW):** In `src/app/(portal)/[clientSlug]/portal/billing/page.tsx:382`, add `billing_period` to the checkout request body so users can choose monthly vs yearly.

3. **Verify Issue 3-3 (LOW):** Check the `business_settings` database table to confirm whether columns are named `post_call_email` / `post_call_text` or `post_call_email_summary` / `post_call_followup_text`. Fix whichever side is wrong.

4. **Clean up Issue 3-4 (INFO):** Consider removing `/api/business-settings/regenerate-prompt/route.ts` if it has no consumers, or add a UI button to trigger manual prompt regeneration.
