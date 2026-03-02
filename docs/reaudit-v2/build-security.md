# Build, Security & Rename Audit -- Reaudit V2

## Summary

- **Build**: PASSES (0 errors, 6 ESLint warnings)
- **Automations -> Integrations rename**: INCOMPLETE (massive -- 100+ references remain across files, routes, DB tables, components)
- **Business Settings -> Knowledge Base rename**: INCOMPLETE (70+ references remain across files, routes, DB tables, components)
- **Blockers**: 2
- **Warnings**: 6
- **Cosmetic**: 3
- **Security findings**: 1 warning (in-memory rate limiter won't work multi-instance)

---

## Build Results

### npm run build
```
Next.js 16.1.6 (Turbopack)
Compiled successfully in 6.2s
159 routes generated (0 errors)
```

**Warnings only:**
- `metadataBase` property not set for OG/Twitter images (falls back to localhost:3001)
- `middleware` file convention deprecated -- should migrate to `proxy`

### ESLint
```
6 problems (0 errors, 6 warnings)
- agent-settings/page.tsx: 5 unused imports (Shield, Plug, History, BookOpen, piiCategories)
- automations/page.tsx: 1 unused import (Phone)
```

---

## RENAME AUDIT

### "Automations" References Found

**File/folder paths still using "automations" or "automation":**

| File | Context | Action Needed |
|------|---------|---------------|
| `src/app/(startup)/automations/page.tsx` | Full page -- route `/automations`, title "Automations" | RENAME route + file to `integrations` |
| `src/app/(portal)/[clientSlug]/portal/automations/page.tsx` | Portal automations page | RENAME route + file to `integrations` |
| `src/app/api/automations/client/route.ts` | API route `/api/automations/client` | RENAME to `/api/integrations/client` |
| `src/app/api/automations/client/[id]/route.ts` | API route `/api/automations/client/[id]` | RENAME to `/api/integrations/client/[id]` |
| `src/app/api/automations/client/[id]/logs/route.ts` | API route `/api/automations/client/[id]/logs` | RENAME |
| `src/app/api/automations/recipes/route.ts` | API route `/api/automations/recipes` | RENAME to `/api/integrations/recipes` |
| `src/app/api/automations/recipes/[id]/route.ts` | API route `/api/automations/recipes/[id]` | RENAME |
| `src/app/api/automations/webhook-test/route.ts` | API route `/api/automations/webhook-test` | RENAME |
| `src/components/automations/active-automation-card.tsx` | Component folder | RENAME folder to `integrations` |
| `src/components/automations/recipe-editor.tsx` | Component | RENAME |
| `src/components/automations/recipe-setup-modal.tsx` | Component | RENAME |
| `src/components/automations/webhook-config.tsx` | Component | RENAME |
| `src/components/automations/resource-pickers/*.tsx` | 3 picker components | RENAME folder |
| `src/components/automations/integration-request-modal.tsx` | Component (ironic -- already says "integration" but in automations folder) | RENAME folder |
| `src/components/automations/recipe-card.tsx` | Component | RENAME |
| `src/components/automations/oauth-connect-button.tsx` | Component | RENAME |
| `src/lib/automation-recipes.ts` | Core execution logic; references DB tables `automation_recipes`, `client_automations`, `automation_logs` | DB tables stay; rename file to `integration-recipes.ts` |
| `src/lib/supabase/middleware.ts:158` | `"/automations"` in adminRoutes array | Change to `"/integrations"` |
| `src/components/layout/startup-sidebar.tsx:45` | `label: "Automations"` | Change label to "Integrations" |
| `src/components/layout/portal-sidebar.tsx:310-316` | `href=/.../portal/automations` | Change to `/portal/integrations` |
| `src/components/portal/feature-gate.tsx:19,29` | Feature key `automations` | Rename key |
| `src/app/api/oauth/authorize/route.ts:13` | Redirect to `/portal/automations` | Change to `/portal/integrations` |
| `src/app/api/oauth/callback/route.ts:17,23,32,309` | Redirects to `/portal/automations` | Change all |
| `src/app/(startup)/dashboard/page.tsx:409` | Link to `/automations` | Change to `/integrations` |
| `src/types/database.ts:216,576-615` | Type names `AutomationRecipe`, `ClientAutomation`, `AutomationLog` | Keep (match DB tables) |
| `src/lib/plan-access.ts:30` | Comment `// Automation gates` | Cosmetic rename |
| Marketing content (pricing, features, white-glove) | Uses "automations" as a generic feature term | KEEP -- these are marketing terms, not navigation |

**Database tables (NOT action needed -- too destructive):**
- `automation_recipes` -- referenced in 10+ migrations
- `client_automations` -- referenced in 10+ migrations
- `automation_logs` -- referenced in migrations
- These should stay as-is; the rename is UI/navigation only

**Supabase migrations:** 100+ references to `automation_*` tables -- all valid DB references, no action needed.

### "Business Settings" References Found

| File | Context | Action Needed |
|------|---------|---------------|
| `src/components/business-settings/*.tsx` | 11 component files in `business-settings/` folder | RENAME folder to `knowledge-base` |
| `src/app/api/business-settings/route.ts` | API route `/api/business-settings` | RENAME to `/api/knowledge-base` |
| `src/app/api/business-settings/faqs/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/faqs/[id]/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/hours/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/locations/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/locations/[id]/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/policies/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/policies/[id]/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/services/route.ts` | API sub-route | RENAME parent folder |
| `src/app/api/business-settings/services/[id]/route.ts` | API sub-route | RENAME parent folder |
| `src/app/(startup)/clients/[id]/business-settings/page.tsx` | Admin client page -- title "Business Settings" | RENAME route + title to "Knowledge Base" |
| `src/app/(startup)/clients/[id]/layout.tsx:46` | Tab label "Business Settings" | Change to "Knowledge Base" |
| `src/app/(portal)/[clientSlug]/portal/settings/business/page.tsx:38` | Title "Business Settings" | Change to "Knowledge Base" |
| `src/app/(portal)/[clientSlug]/portal/knowledge-base/page.tsx:29` | Fetches from `/api/business-settings` | Update fetch URL |
| All `business-settings` component imports (10+ files) | `from "@/components/business-settings/..."` | Update after folder rename |
| `src/lib/prompt-generator.ts:285,315,365,405-407` | References `business_settings` DB table + comments | DB table stays; update comments |
| `src/lib/knowledge-base-generator.ts:64,94,175` | References `business_settings` DB table + comments | DB table stays; update comments |
| `src/lib/post-call-actions.ts:70-72` | References `business_settings` DB table | Keep (DB query) |
| `src/app/api/onboarding/step/[step]/route.ts:78,82,83,89,122,127` | References `business_settings` DB table | Keep (DB query) |
| `src/app/api/cron/daily-digest/route.ts:36-38` | References `business_settings` DB table | Keep (DB query) |
| `src/app/api/tools/escalate/route.ts:27` | References `business_settings` DB table | Keep (DB query) |
| `src/app/api/tools/transfer/initiate/route.ts:30-32` | References `business_settings` DB table | Keep (DB query) |
| `src/app/api/tools/business-hours/check/route.ts:26` | References `business_settings` DB table | Keep (DB query) |
| `src/app/api/tools/availability/check/route.ts:27` | References `business_settings` DB table | Keep (DB query) |
| `src/types/database.ts:444-446` | `BusinessSettings` interface | Keep (maps to DB table) |

**Database table:** `business_settings` -- referenced in 8+ migrations. NOT safe to rename.

### Rename Verdict
- **Automations -> Integrations: INCOMPLETE** (~25 files/routes need renaming, plus all internal references)
- **Business Settings -> Knowledge Base: INCOMPLETE** (~20 files/routes need renaming, plus all internal references)
- Combined: **~45 file/folder renames + ~100 import/reference updates needed**

---

## BLOCKERS

### B-1: Automations Route Still Exists at /automations and /portal/automations
The build output shows live routes:
- `/automations` (startup admin)
- `/[clientSlug]/portal/automations` (client portal)

These should be `/integrations` and `/portal/integrations` respectively. Any bookmarks/links to the old URLs will break when renamed. Recommend adding redirect rules in middleware or Next.js config.

### B-2: /api/automations/* and /api/business-settings/* API Routes Not Renamed
All API routes still use old names. Every frontend caller (components, pages) references these URLs. This is a coordinated rename affecting ~30 files.

---

## WARNINGS

### W-1: metadataBase Not Set
Build warning: OG/Twitter images fall back to `http://localhost:3001`. Set `metadataBase` in root layout to the production URL.

### W-2: Middleware Convention Deprecated
Next.js 16.1 warns that `middleware.ts` should be migrated to the new `proxy` convention.

### W-3: In-Memory Rate Limiter Won't Scale
`src/lib/rate-limit.ts` uses an in-memory `Map` for rate limiting. This works for a single Vercel instance but resets on cold starts and doesn't share state across serverless invocations. For production, consider Vercel KV or Upstash Redis.

### W-4: console.log in Production Code
Found 3 instances:
- `src/lib/logger.ts:28` -- Inside logger itself (acceptable)
- `src/lib/twilio.ts:17` -- Logs SMS body when Twilio not configured (acceptable for dev)
- `src/app/api/agents/[id]/conversation-flow/route.ts:625` -- Stray console.log in API route (should remove)

### W-5: 6 Unused Imports (ESLint Warnings)
- `src/app/(startup)/automations/page.tsx`: unused `Phone`
- `src/app/(portal)/[clientSlug]/portal/agents/[id]/agent-settings/page.tsx`: unused `Shield`, `Plug`, `History`, `BookOpen`, `piiCategories`

### W-6: localhost Reference in Webhook Test
`src/app/api/automations/webhook-test/route.ts:51` -- checks `hostname === "localhost"` which is valid (used to allow localhost URLs during testing).

---

## COSMETIC

### C-1: Placeholder Content
Extensive use of `placeholder` attributes in forms -- all are proper HTML `placeholder` attributes on inputs (e.g., "e.g. AC Repair", "Select category"). No fake/lorem content found.

### C-2: No TODO/FIXME/HACK Comments
Zero instances found in the codebase. Clean.

### C-3: Comment References to "Business Settings" in Code
Several comments say "Business Settings" where the feature is now "Knowledge Base". Low priority but should be updated for clarity.

---

## Section-by-Section

### 1. Build
- **npm run build**: PASS (0 errors, 159 routes)
- **ESLint**: PASS (0 errors, 6 warnings -- all unused variables)
- No TypeScript errors

### 2. Rename Audit
See detailed tables above. Both renames are INCOMPLETE with significant work remaining:
- ~25 files need renaming for "automations -> integrations"
- ~20 files need renaming for "business-settings -> knowledge-base"
- Database table names (`automation_recipes`, `client_automations`, `automation_logs`, `business_settings`) should NOT be renamed -- too many migration dependencies
- UI labels, route paths, API endpoints, component folders, and import paths all need updating

### 3. Code Cleanup
- **TODO/FIXME/HACK**: 0 found
- **console.log**: 3 found (1 stray in conversation-flow route, 2 acceptable)
- **localhost**: 1 found (legitimate test check)
- **Placeholder content**: All legitimate HTML placeholders, no fake data
- **Commented-out code**: None found in systematic search

### 4. Environment Variables
`.env.example` is comprehensive with 109 lines covering:
- Supabase (URL, anon key, service role key)
- Retell AI (API key)
- Stripe (secret key, webhook secret)
- Resend (API key)
- Encryption key
- OAuth providers (Google, Slack, HubSpot, Calendly, QuickBooks, Salesforce, GoHighLevel, Housecall Pro, Jobber)
- Webhook secrets (Housecall Pro, Jobber)
- Retell tools API key
- Demo agent IDs (8 industries)
- Twilio (account SID, auth token, phone numbers, SIP trunk config)
- Hiya (branded caller ID)
- Cron secret
- Marketing site URL
- App URL

**Missing from .env.example**: None identified. All env vars referenced in code have corresponding entries.

**Hardcoded secrets in source**: NONE found. All secrets use `process.env.*`.

### 5. Security

#### Auth Coverage
Every API route uses one of:
- `requireAuth()` -- session-based auth via Supabase (most routes)
- `RETELL_TOOLS_API_KEY` Bearer token auth (all `/api/tools/*` routes)
- `CRON_SECRET` header auth (all `/api/cron/*` routes)
- Webhook signature verification (Retell, Stripe, Housecall Pro, Jobber)
- API key auth (Zapier, Make, n8n)

**Public endpoints (intentionally unauthenticated, all rate-limited):**
- `/api/demo-call` -- marketing demo calls
- `/api/contact` -- contact form
- `/api/checkout` -- Stripe checkout session creation
- `/api/marketing-checkout` -- marketing Stripe checkout
- `/api/calls` POST -- web call creation (rate-limited)
- `/api/agents/create-web-call` -- web call creation (rate-limited)

No missing auth found.

#### Input Validation
- Public endpoints validate required fields
- Contact form validates industry against allowlist
- Checkout validates `plan_id`, `return_url` against allowed origins
- Phone number purchase validates `phoneNumber` required

#### Webhook Signature Verification
- **Retell**: Uses `Retell.verify(rawBody, apiKey, signature)` via SDK
- **Stripe**: Uses `constructWebhookEvent(rawBody, sig, webhookSecret)` with raw body
- **Housecall Pro**: Verifies `x-webhook-secret` header against `HOUSECALLPRO_WEBHOOK_SECRET`
- **Jobber**: Verifies `x-webhook-secret` header against `JOBBER_WEBHOOK_SECRET`

All webhooks properly verified.

#### Rate Limiting
- In-memory sliding window limiter (`publicEndpointLimiter`: 20 req/min)
- Applied to all public endpoints: demo-call, contact, checkout, marketing-checkout, calls POST, create-web-call
- **Limitation**: In-memory -- won't persist across serverless cold starts or share across instances

#### CORS
- No explicit CORS configuration found (relies on Next.js defaults -- same-origin)
- Checkout validates `return_url` against `MARKETING_SITE_URL` allowlist (prevents open redirect)
- Webhook test proxies server-side to avoid CORS issues

#### SQL Injection
- All database queries use Supabase client `.from().select().eq()` pattern (parameterized)
- No raw SQL queries found in application code
- No string interpolation in queries

#### XSS Protection
- `escapeHtml()` function used in email templates (contact form, Stripe webhook, Retell webhook)
- React components use JSX (auto-escaped)

### 6. Phone Numbers
- **Provider**: Twilio (real API, not mocked)
- **Purchase flow**: `POST /api/phone-numbers/purchase`
  1. Buys number via `client.incomingPhoneNumbers.create()`
  2. Associates with SIP trunk via `client.trunking.v1.trunks().phoneNumbers.create()`
  3. Imports to Retell via `POST https://api.retellai.com/import-phone-number`
  4. Registers with Hiya for branded caller ID
  5. Stores in `phone_numbers` table
- **Rollback logic**: If Retell import fails, releases the Twilio number
- **Auth**: Protected by `requireAuth()`

### 7. Migrations
46 migration files found in `supabase/migrations/`:
- Date range: 2026-02-10 through 2026-02-23
- Latest: `20260223_restructure_business_settings.sql` and `20260223000000_integration_requests.sql`

**Destructive operations found:**
- `DELETE FROM post_call_actions WHERE action_type = 'webhook'` (in restructure migration -- intentional removal of deprecated action type)
- `DELETE FROM automation_recipes` (in update_seed_recipes migration -- intentional cleanup before re-seeding)

Both are intentional and acceptable. No `DROP TABLE` or `DROP COLUMN` found.

**Note**: The restructure migration `20260223_restructure_business_settings.sql` adds `agent_call_handling` table and migrates data from `business_settings`, but does NOT drop the original `business_settings` table (correct -- the table is still actively used).
