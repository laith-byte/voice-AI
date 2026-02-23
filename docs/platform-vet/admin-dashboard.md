# Admin Dashboard Audit

Audit of all 38 pages under `src/app/(startup)/` -- the startup admin dashboard.

Date: 2026-02-22

---

## BLOCKER

### B-1: Dashboard onboarding query fetches ALL records (no org filter)

**File:** `src/app/(startup)/dashboard/page.tsx`

The onboarding checklist query fetches from `client_onboarding` without filtering by `organization_id`. If RLS is not configured on this table, every startup admin sees every other startup's onboarding data.

```ts
const { data: onboardingRows } = await supabase
  .from("client_onboarding")
  .select("...");
// Missing: .eq("organization_id", orgId)
```

**Impact:** Data leak across organizations if RLS is absent or misconfigured.

---

### B-2: Workflows page writes directly to Supabase from the client

**File:** `src/app/(startup)/workflows/page.tsx`

Toggle-active and other mutations go straight through the Supabase client SDK instead of an API route. This bypasses any server-side validation, logging, or rate limiting.

```ts
const { error } = await supabase
  .from("workflows")
  .update({ is_active: !workflow.is_active })
  .eq("id", workflow.id);
```

**Impact:** If RLS policies are misconfigured, any authenticated user could toggle or read workflows belonging to other orgs.

---

### B-3: SaaS templates writes directly to Supabase from the client

**File:** `src/app/(startup)/saas/templates/page.tsx`

Create and delete operations use the Supabase client SDK directly (`supabase.from("agent_templates").insert(...)`, `.delete()`). Same risk as B-2.

---

### B-4: Whitelabel settings writes directly to Supabase from the client

**File:** `src/app/(startup)/settings/whitelabel/page.tsx`

Both branding upsert and email template insert/update go through the Supabase client SDK directly, bypassing API routes.

---

### B-5: Startup settings writes directly to Supabase from the client

**File:** `src/app/(startup)/settings/startup/page.tsx`

Organization name update goes directly through the Supabase client, not an API route. The API key save correctly uses `/api/settings`, but the org name save does not.

---

## WARNING

### W-1: (startup) layout has no server-side auth guard

**File:** `src/app/(startup)/layout.tsx`

The layout is a thin client component that renders `StartupSidebar` + children. There is no server-side auth check at the layout level. Auth depends entirely on middleware, which only blocks `client_admin` / `client_member` roles -- there is no positive assertion that the user IS a `startup_admin` or `startup_member`.

```tsx
export default function StartupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <StartupSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

**Risk:** Any non-client role (or a role that hasn't been explicitly handled) could potentially access admin pages.

---

### W-2: Custom CSS page save is non-functional (Phase 2 stub)

**File:** `src/app/(startup)/clients/[id]/custom-css/page.tsx`

The "Save Custom CSS" button shows `toast.info("Custom CSS editing available in Phase 2")` and does not persist any data. Users may enter CSS and believe it is saved.

---

### W-3: Embed URL page save is non-functional (Phase 2 stub)

**File:** `src/app/(startup)/clients/[id]/embed-url/page.tsx`

Same issue as W-2. Save shows a toast but does not persist.

---

### W-4: Agent config -- tool removal has no confirmation dialog

**File:** `src/app/(startup)/agents/[id]/agent-config/page.tsx`

Removing a tool from an agent's configuration happens immediately on click with no AlertDialog confirmation, unlike other destructive actions across the dashboard.

---

### W-5: No delete or edit functionality for billing products

**File:** `src/app/(startup)/billing/products/page.tsx`

Products can be created but there is no edit or delete action available in the UI once created.

---

### W-6: No delete functionality for billing coupons

**File:** `src/app/(startup)/billing/coupons/page.tsx`

Coupons can be created but there is no way to delete them from the UI.

---

### W-7: Billing invoice creation is stubbed

**File:** `src/app/(startup)/billing/invoices/page.tsx`

The "Create Invoice" action shows a stub/toast and does not actually create an invoice.

---

### W-8: Billing subscription creation is stubbed

**File:** `src/app/(startup)/billing/subscriptions/page.tsx`

The "Create Subscription" action is similarly stubbed.

---

### W-9: Settings startup -- "Remove" API key has no confirmation dialog

**File:** `src/app/(startup)/settings/startup/page.tsx`

Clicking "Remove" on the API key immediately calls `handleRemoveApiKey()` without a confirmation dialog.

---

### W-10: Settings integrations -- "Configure" button is stubbed

**File:** `src/app/(startup)/settings/integrations/page.tsx`

The "Configure" button for connected integrations shows `toast.info("Integration configuration coming soon.")` and does nothing.

---

### W-11: Settings members -- no ability to remove or change role of existing members

**File:** `src/app/(startup)/settings/members/page.tsx`

Members are displayed read-only. There is no way to change a member's role or remove them from the organization.

---

### W-12: Settings members -- no pagination

**File:** `src/app/(startup)/settings/members/page.tsx`

The members table has no pagination. For organizations with many team members, this could become slow.

---

### W-13: Domain removal is stubbed

**Files:** `src/app/(startup)/dashboard/page.tsx`, `src/app/(startup)/settings/whitelabel/page.tsx`

Domain removal shows `toast.info("Domain removal coming soon.")` and does not function.

---

### W-14: HIPAA compliance setup is stubbed

**File:** `src/app/(startup)/settings/startup/page.tsx`

"Get HIPAA Compliance" button shows `toast.info("HIPAA compliance setup coming soon.")`.

---

### W-15: SaaS templates -- provider selectors on main page affect create dialog state

**File:** `src/app/(startup)/saas/templates/page.tsx`

The text/voice provider Select components on the main page are bound to `newTemplate` state, which also controls the create dialog. Changing providers on the main page silently pre-fills the dialog.

---

## REGRESSION

No regressions detected. All pages load, fetch data, and render correctly based on code inspection.

---

## COSMETIC

### C-1: Tables missing pagination

The following tables render all rows without pagination. As data grows, these will degrade in performance and usability.

| Page | Table |
|------|-------|
| `automations/page.tsx` | Recipes table |
| `workflows/page.tsx` | Workflows table |
| `clients/[id]/phone-numbers/page.tsx` | Phone numbers table |
| `clients/[id]/solutions/page.tsx` | Solutions table |
| `billing/coupons/page.tsx` | Coupons table |
| `billing/products/page.tsx` | Products table |
| `billing/subscriptions/page.tsx` | Subscriptions table |
| `saas/pricing-tables/page.tsx` | Pricing tables |
| `settings/members/page.tsx` | Members table |
| `settings/phone-sip/page.tsx` | Phone numbers table, SIP trunks grid |

**Note:** `billing/invoices`, `billing/transactions`, `settings/webhook-logs`, `agents/page.tsx`, and `clients/page.tsx` correctly use `TablePagination`.

---

### C-2: Inconsistent loading spinner placement

Some pages show loading spinners centered in full viewport height (`py-24`, `min-h-[400px]`), others use smaller containers (`py-16`, `py-12`). Not a functional issue but creates visual inconsistency during navigation.

---

### C-3: "Coming Soon" stubs scattered across the dashboard

Multiple features are stubbed with "Coming Soon" labels or `toast.info` stubs:

| Feature | Location |
|---------|----------|
| Dashboard logo upload | `settings/startup/page.tsx` |
| Login page logo upload | `settings/startup/page.tsx` |
| Favicon upload | `settings/whitelabel/page.tsx` |
| Email logo upload | `settings/whitelabel/page.tsx` |
| Send test email | `settings/whitelabel/page.tsx` |
| Custom CSS editing | `clients/[id]/custom-css/page.tsx` |
| Embed URL editing | `clients/[id]/embed-url/page.tsx` |
| Domain removal | `dashboard/page.tsx`, `settings/whitelabel/page.tsx` |
| HIPAA compliance | `settings/startup/page.tsx` |
| Integration configuration | `settings/integrations/page.tsx` |
| Add client member | `clients/[id]/overview/page.tsx` |
| Create invoice | `billing/invoices/page.tsx` |
| Create subscription | `billing/subscriptions/page.tsx` |

---

### C-4: Duplicate Stripe Connect pages

**Files:** `src/app/(startup)/billing/connect/page.tsx` and `src/app/(startup)/saas/connect/page.tsx`

These two pages are near-identical implementations for connecting a Stripe account. This is likely intentional (billing vs SaaS contexts) but the code duplication could be extracted into a shared component.

---

## Pages Audited (38 total)

### Dashboard
- `dashboard/page.tsx` -- KPI cards, setup checklist, quick actions

### Agents (7 pages)
- `agents/page.tsx` -- Agent list with pagination, search, create
- `agents/[id]/overview/page.tsx` -- Read-only agent details
- `agents/[id]/agent-config/page.tsx` -- Agent configuration editor (~1600 lines)
- `agents/[id]/ai-analysis/page.tsx` -- AI analysis topic configuration
- `agents/[id]/campaigns/page.tsx` -- Campaign rate config with auto-save
- `agents/[id]/prompt-tree/page.tsx` -- Wrapper for PromptTreeEditor component
- `agents/[id]/widget/page.tsx` -- Widget appearance configuration

### Clients (7 pages)
- `clients/page.tsx` -- Client list with pagination, search, status filter
- `clients/[id]/overview/page.tsx` -- Client info, onboarding, members
- `clients/[id]/assigned-agents/page.tsx` -- Agent assignment management
- `clients/[id]/business-settings/page.tsx` -- Multi-component business settings
- `clients/[id]/client-access/page.tsx` -- Feature permission toggles
- `clients/[id]/custom-css/page.tsx` -- Phase 2 stub
- `clients/[id]/embed-url/page.tsx` -- Phase 2 stub
- `clients/[id]/phone-numbers/page.tsx` -- Phone number purchase/import/delete
- `clients/[id]/solutions/page.tsx` -- Solution assignment

### Automations & Workflows (2 pages)
- `automations/page.tsx` -- Recipe CRUD
- `workflows/page.tsx` -- Workflow list and toggle

### Billing (6 pages)
- `billing/connect/page.tsx` -- Stripe Connect OAuth
- `billing/coupons/page.tsx` -- Coupon list and create
- `billing/invoices/page.tsx` -- Invoice list with pagination
- `billing/products/page.tsx` -- Product list and create
- `billing/subscriptions/page.tsx` -- Subscription list
- `billing/transactions/page.tsx` -- Transaction list with pagination

### SaaS (5 pages)
- `saas/connect/page.tsx` -- Stripe Connect OAuth (duplicate of billing/connect)
- `saas/plans/page.tsx` -- Plan CRUD with tabbed form
- `saas/advanced/page.tsx` -- Redirect URL setting
- `saas/pricing-tables/page.tsx` -- Pricing table CRUD
- `saas/templates/page.tsx` -- Agent template CRUD

### Settings (7 pages)
- `settings/integrations/page.tsx` -- Integration management (6 providers)
- `settings/members/page.tsx` -- Team member list and invite
- `settings/phone-sip/page.tsx` -- Phone numbers and SIP trunk management
- `settings/startup/page.tsx` -- Org settings, API key, compliance
- `settings/usage/page.tsx` -- Usage analytics with charts and forecast
- `settings/webhook-logs/page.tsx` -- Webhook log viewer with pagination
- `settings/whitelabel/page.tsx` -- Branding, domain, email template editor

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 5     |
| WARNING  | 15    |
| COSMETIC | 4     |
| REGRESSION | 0   |

The most critical findings are the direct Supabase client writes (B-2 through B-5) and the unscoped onboarding query (B-1). These should be addressed first by routing mutations through API routes and adding the missing `organization_id` filter. The middleware auth gap (W-1) should also be reviewed to add a positive role assertion for startup routes.
