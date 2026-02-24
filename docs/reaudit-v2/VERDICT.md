# VERDICT — Reaudit V2

## 1. SHIP or DO NOT SHIP

**DO NOT SHIP** — 12 blockers across admin bypass, missing org-scoping, incomplete renames, and stale routes. The core product works end-to-end (6/6 journeys pass), but the rename is only half-done, 9 pages bypass API routes with direct Supabase mutations, and several read queries lack org-scoping.

---

## 2. Every Blocker

### B-1: Integrations page URL still `/automations` (not `/integrations`)
- **File:** `src/app/(portal)/[clientSlug]/portal/automations/page.tsx`
- **Issue:** The route folder is `automations/`, not `integrations/`. URL bar shows `/automations`.
- **Impact:** Brand inconsistency. All existing links/bookmarks break when eventually renamed.

### B-2: Admin client overview — direct Supabase mutations bypass API routes
- **File:** `src/app/(startup)/clients/[id]/overview/page.tsx:195-258`
- **Issue:** `handleSave`, `handleRemoveMember`, `handleResetOnboarding` all write directly to Supabase.
- **Impact:** No server-side authorization or audit trail. Client data manipulation if RLS gaps exist.

### B-3: Admin assigned agents — direct Supabase mutations
- **File:** `src/app/(startup)/clients/[id]/assigned-agents/page.tsx:149-191`
- **Issue:** `handleAssign`/`handleUnassign` update `agents` directly.

### B-4: Admin solutions page — direct Supabase mutations
- **File:** `src/app/(startup)/clients/[id]/solutions/page.tsx:140-177`
- **Issue:** `handleAddSolution`/`handleRemoveSolution` write directly.

### B-5: Admin client access — direct Supabase mutations
- **File:** `src/app/(startup)/clients/[id]/client-access/page.tsx:96-194`
- **Issue:** `fetchFeatures` inserts defaults, `handleSave` upserts directly.

### B-6: Client topics page — direct Supabase mutations
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/topics/page.tsx:99,123`
- **Issue:** Insert and delete on `topics` table from client-side code.

### B-7: Client campaigns page — direct Supabase mutations
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/campaigns/page.tsx:443`
- **Issue:** Direct insert into `campaigns` from client code.

### B-8: Client leads import — direct Supabase mutations
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/leads/page.tsx:457`
- **Issue:** Batch upsert of 100 leads directly from client code. No rate limiting.

### B-9: Client widget config — direct Supabase mutations (XSS risk)
- **File:** `src/app/(portal)/[clientSlug]/portal/agents/[id]/widget/page.tsx:148,213`
- **Issue:** Upsert into `widget_config` including `custom_css` field. Potential stored XSS.

### B-10: Missing org-scoping on admin read queries
- **Files:** `src/app/(startup)/clients/page.tsx:118`, `src/app/(startup)/agents/page.tsx:51`, `src/app/(startup)/automations/page.tsx:123`, `src/app/(startup)/settings/phone-sip/page.tsx:177`
- **Issue:** Read queries lack `organization_id` filter. Relies entirely on RLS.
- **Impact:** Cross-org data leak if RLS is misconfigured.

### B-11: `/api/automations/*` and `/api/business-settings/*` API routes not renamed
- **Files:** 10+ API route files under `src/app/api/automations/` and `src/app/api/business-settings/`
- **Issue:** All API endpoints still use old names. Frontend references these URLs.
- **Impact:** Coordinated rename needed — ~30 files affected.

### B-12: Admin "Set Up" navigates to non-existent `/clients/{id}/automations` route
- **File:** `src/app/(startup)/automations/page.tsx:308`
- **Issue:** When admin clicks "Set Up" on an integration request, it navigates to a route that doesn't exist → 404.
- **Impact:** Admin cannot navigate to client's integration page from the request queue.

---

## 3. Rename Completeness

### "Automations" → "Integrations": **INCOMPLETE**

**UI labels updated:** Portal sidebar says "Integrations", portal page title says "Integrations"
**NOT updated (~25 items):**
- Route folders: `src/app/(startup)/automations/`, `src/app/(portal)/.../automations/`
- API routes: `src/app/api/automations/client/`, `recipes/`, `webhook-test/` (6 files)
- Component folder: `src/components/automations/` (8 files)
- Library: `src/lib/automation-recipes.ts`
- Admin sidebar label: "Automations" (`startup-sidebar.tsx:45`)
- Admin page title: "Automations" (`automations/page.tsx:252`)
- Dashboard link: `/automations` (`dashboard/page.tsx:409`)
- Middleware route list: `"/automations"` (`middleware.ts:158`)
- OAuth callbacks: redirect to `/portal/automations` (4 references)
- Feature gate key: `automations` (`feature-gate.tsx:19,29`)
- Marketing FAQ: "automations" (`_pricing-content.tsx:142`)
- Billing plan comparison: "Automation Recipes" (`billing/page.tsx:199`)

**DB tables (`automation_recipes`, `client_automations`, `automation_logs`):** Keep as-is — too many migration dependencies.

### "Business Settings" → "Knowledge Base": **INCOMPLETE**

**UI labels updated:** Portal sidebar says "Knowledge Base", Knowledge Base page title correct
**NOT updated (~20 items):**
- Component folder: `src/components/business-settings/` (11 files)
- API routes: `src/app/api/business-settings/` (9 route files)
- Admin client tab: "Business Settings" (`clients/[id]/layout.tsx:46`)
- Admin client page heading: "Business Settings" (`business-settings/page.tsx:20`)
- Old portal page still exists: `portal/settings/business/page.tsx` with "Business Settings" title
- Knowledge Base page fetches from `/api/business-settings` (needs URL update after rename)
- All imports referencing `@/components/business-settings/...` (10+ files)
- Code comments referencing "business settings" in generators and utils

**DB table (`business_settings`):** Keep as-is.

---

## 4. All 6 Journeys

| # | Journey | Verdict |
|---|---------|---------|
| 1 | HVAC + Housecall Pro | **PASS** |
| 2 | HVAC + Jobber | **PASS** |
| 3 | No-CRM + Google Calendar | **PASS** |
| 4 | Webhook User | **PASS** |
| 5 | Integration Request (Salesforce) | **PASS** |
| 6 | Returning User | **PASS** |

All 6 journeys trace end-to-end through working code paths. The core product flow is solid.

---

## 5. Integration Verdicts

| Card | Set Up Works? | Flow Type | Notes |
|------|---------------|-----------|-------|
| Salesforce | Yes | Admin request | IntegrationRequestModal → admin connects OAuth |
| GoHighLevel | Yes | Admin request | Same flow |
| Google Sheets | Yes | Admin request | Same flow |
| Google Calendar | Yes | Admin request | Same flow. Calendar tools work standalone without CRM |
| Slack | Yes | Admin request | Same flow |
| HubSpot | Yes | Admin request | Same flow |
| Webhook | Yes | **Self-serve** | RecipeSetupModal with URL config + test button |
| Notion | Yes | Admin request | Same flow |
| SMS Reminders | Yes | **Self-serve** | RecipeSetupModal |
| QuickBooks | Yes | Admin request | Same flow |
| Housecall Pro | Yes | Admin request | OAuth routes exist but client flow uses request modal. Admin connects OAuth on behalf of client |
| Jobber | Yes | Admin request | Same as HCP |

**Note:** Cards are loaded from `automation_recipes` DB table — if recipes aren't seeded, cards won't appear (W-6).

---

## 6. Phone Numbers

| Flow | Verdict | Notes |
|------|---------|-------|
| Buy Phone Number | **PASS** (admin-only) | Client submits request → admin purchases via Twilio API → SIP trunk + Retell import + Hiya registration |
| Add Pre-existing Number | **PASS** (admin-only) | Client submits request → admin handles import/porting |

**Important:** Neither flow is self-serve from the client portal. Both are request-based (client requests → admin fulfills). The actual Twilio purchase/import API is real and production-ready, but only accessible from admin routes.

---

## 7. Knowledge Base

| Check | Verdict |
|-------|---------|
| Pre-fill from onboarding | **PASS** — `create-agent` route seeds services, FAQs, policies, hours from templates |
| Display on KB page | **PASS** — BusinessInfoForm + HoursEditor + ServicesList + FaqsList + PoliciesList + LocationsList |
| Edit and save | **PASS** — All sub-components save via API routes (`/api/business-settings/*`) |
| Validate | **PASS** — API routes validate required fields |
| Persist on reload | **PASS** — Data in DB, fetched fresh on page load |
| Propagate to agent | **PASS** — Every save triggers `regenerateKnowledgeBase()` → Retell KB update |
| Old page removed | **FAIL** — Old `settings/business/page.tsx` still exists with "Business Settings" title (B-6 in client audit) |

---

## 8. Regressions from These Changes

1. **Old "Business Settings" page orphaned** — Still routable at `settings/business` with stale title and extra components (CallHandling, PostCallActions, PII) not present in Knowledge Base page. Incomplete migration.
2. **Admin "Set Up" link broken** — Admin automations page links to `/clients/{id}/automations` which doesn't exist → 404 (B-12).
3. **No client-facing completion notification** — When admin completes an integration request, the "Pending" badge disappears but client gets no "Completed" confirmation.

---

## 9. Warnings

| # | Issue | File | Severity |
|---|-------|------|----------|
| W-1 | Integration request PATCH not org-scoped | `api/integration-requests/[id]/route.ts:30` | Medium |
| W-2 | 5 sub-tables lack pagination | Various admin client pages | Low |
| W-3 | `metadataBase` not set — OG images fall back to localhost | Root layout | Medium |
| W-4 | Middleware convention deprecated in Next.js 16.1 | `middleware.ts` | Low |
| W-5 | In-memory rate limiter won't scale multi-instance | `lib/rate-limit.ts` | Medium |
| W-6 | `console.error` leaks error objects to browser console | 5+ client pages | Low |
| W-7 | No OG overrides on marketing sub-pages | About, Contact, Features, Industries | Low |
| W-8 | Contact form industry list outdated (HVAC-era) | `contact/_contact-content.tsx:7` | Medium |
| W-9 | Contact form no server-side email validation | `api/contact/route.ts:20` | Low |
| W-10 | Pricing FAQ says "automations" | `_pricing-content.tsx:142` | Medium |
| W-11 | Features page CRM section says "Coming Soon" but pricing says available | `_features-content.tsx:485` | Low |
| W-12 | Billing plan comparison says "Automation Recipes" | `billing/page.tsx:199` | Medium |
| W-13 | Stray console.log in conversation-flow route | `api/agents/[id]/conversation-flow/route.ts:625` | Low |
| W-14 | 6 unused imports (ESLint warnings) | `agent-settings/page.tsx`, `automations/page.tsx` | Low |

---

## 10. Cosmetic Issues

| # | Issue | File |
|---|-------|------|
| C-1 | "Duplicate agent" button is a toast stub | `portal/page.tsx:657` |
| C-2 | "Manual Trigger" auto-tagging is a stub | `ai-analysis/page.tsx:289` |
| C-3 | Dashboard loading skeleton uses `bg-white` not theme-aware | `portal/page.tsx:391` |
| C-4 | Active Agents KPI shows total count, compares vs recently-active | `portal/page.tsx:170` |
| C-5 | Whitelabel email preview uses "John Doe" | `whitelabel/page.tsx:694` |
| C-6 | Footer missing "Sign Up" link | `footer.tsx:20` |
| C-7 | Privacy policy uses `sales@` for data requests | `privacy/page.tsx:90` |
| C-8 | Custom CSS page has no persistence (acknowledged Phase 2) | `custom-css/page.tsx` |
| C-9 | Onboarding step comment says "Business Settings" | `onboarding/page.tsx:1196` |

---

## 11. Confidence Score: 4/10

**Why 4:** The core product flow works — all 6 journeys pass, every integration card has a working Set Up path, phone numbers are real (Twilio), and Knowledge Base propagates to agents correctly. But the rename is only ~40% complete (UI labels done, routes/files/API not done), 9 pages bypass API routes with direct Supabase mutations, and the admin request queue has a broken navigation link. This is not shippable at the quality bar of "HVAC owner at 8 AM, first real call at 8:15."

**What's needed to ship:**
1. Fix B-12 (admin broken nav link) — 5 min
2. Fix all direct Supabase mutations (B-2 through B-9) — create API routes, ~2-4 hours
3. Add org-scoping to read queries (B-10) — ~1 hour
4. Complete the rename (B-1, B-11) — coordinated rename of ~45 files + ~100 import updates, ~4-6 hours
5. Delete old `settings/business/page.tsx` or redirect to Knowledge Base — 15 min

**What can ship NOW (if rename deferred):**
If the rename is accepted as "Phase 2 — URLs stay as-is, labels already updated" then fix B-2 through B-10 and B-12 (direct mutations + org-scoping + broken nav). That's ~3-5 hours of work. Core functionality is solid.
