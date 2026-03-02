# Full Visual QA Checklist

Run this checklist manually in a browser after starting the app (`npm run dev`).  
Base URL: `http://localhost:3001` (or your `NEXT_PUBLIC_APP_URL`).

For each item, record: **PASS** | **FAIL** (describe error) | **WARN** (works but issue).

---

## MARKETING SITE (unauthenticated)

| # | Page / Feature | URL | Verify |
|---|----------------|-----|--------|
| 1 | Home | `/` | Loads, hero renders, CTA buttons work |
| 2 | Pricing | `/pricing` | Plans display, checkout buttons work |
| 3 | Features | `/features` | Content renders, no broken images |
| 4 | Industries | `/industries` | Grid renders, links work |
| 5 | About | `/about` | Loads correctly |
| 6 | Contact | `/contact` | Form submits successfully |
| 7 | Privacy | `/privacy` | Loads correctly |
| 8 | Terms | `/terms` | Loads correctly |
| 9 | Live demo | Home or pricing CTA | Enter US phone, demo-call triggers or handles rate limit |

---

## AUTH FLOWS

| # | Flow | URL / Action | Verify |
|---|------|--------------|--------|
| 10 | Signup | `/signup` | Form validates, creates account, redirects correctly |
| 11 | Login | `/login` | Form validates, authenticates, redirects to dashboard |
| 12 | Forgot password | `/forgot-password` | Form submits, shows confirmation |
| 13 | Reset password | From email link | Page loads (if testable) |
| 14 | Logout | Sign out control | Session clears, redirects to login |

---

## STARTUP DASHBOARD (authenticated as startup user)

| # | Page / Feature | URL | Verify |
|---|----------------|-----|--------|
| 15 | Dashboard | `/dashboard` | Loads, shows overview data |
| 16 | Agents list | `/agents` | Displays agents, create new agent works |
| 17 | Agent detail — tabs | `/agents/[id]/*` | overview, agent-config, prompt-tree, widget, campaigns, ai-analysis |
| 18 | Agent config | `/agents/[id]/agent-config` | Edit fields, save, changes persist |
| 19 | Agent publish | Publish button on agent | Works or shows appropriate status |
| 20 | Clients list | `/clients` | Displays clients, create new client works |
| 21 | Client detail — tabs | `/clients/[id]/*` | overview, assigned-agents, phone-numbers, embed-url, client-access, solutions, knowledge-base, custom-css |
| 22 | Settings — tabs | `/settings/*` | integrations, members, usage, webhook-logs, whitelabel, phone-sip, startup |
| 23 | Billing — tabs | `/billing/*` | connect, subscriptions, invoices, products, coupons, transactions |
| 24 | SaaS — tabs | `/saas/*` | plans, pricing-tables, templates, connect, advanced |
| 25 | Workflows | `/workflows` | Loads, displays workflows |
| 26 | Integrations | `/integrations` | Loads, shows available integrations |

---

## CLIENT PORTAL (authenticated as client at `/slug/portal`)

Replace `{slug}` with a real client slug from your DB.

| # | Page / Feature | URL | Verify |
|---|----------------|-----|--------|
| 27 | Portal dashboard | `/{slug}/portal` | Loads with correct client branding/data |
| 28 | Onboarding | `/{slug}/portal/onboarding` | Wizard loads, steps progress |
| 29 | Agents list | `/{slug}/portal/agents` (or from dashboard) | Displays assigned agents |
| 30 | Agent detail — tabs | `/{slug}/portal/agents/[id]/*` | widget, conversations, analytics, knowledge-base, call-handling, post-call-actions, campaigns, leads, topics, agent-settings, ai-analysis, prompt-tree |
| 31 | Web call widget | Agent widget tab → Call | Retell web call initiates or test panel works |
| 32 | Conversation flows | `/{slug}/portal/conversation-flows` | Loads, editor works |
| 33 | Automations | `/{slug}/portal/automations` (if exists) | Loads, recipes display |
| 34 | Integrations | `/{slug}/portal/integrations` | Loads, OAuth connect buttons render |
| 35 | Billing | `/{slug}/portal/billing` | Loads, shows plan info |
| 36 | Knowledge base | `/{slug}/portal/knowledge-base` | Loads, content displays |

---

## EMBEDDABLE WIDGET

| # | Test | How | Verify |
|---|------|-----|--------|
| 37 | Widget embed | Create test HTML with embed script, open from allowed origin | Widget loads, call initiates |

---

## ERROR STATES

| # | Test | URL / Action | Verify |
|---|------|--------------|--------|
| 38 | 404 | `/non-existent-route` | 404 page renders |
| 39 | Invalid portal slug | `/invalid-slug-xyz/portal` | Redirect or error |
| 40 | Startup page as client | Log in as client, visit `/dashboard` | Redirect to portal |
| 41 | Portal page as startup | Log in as startup, visit `/{slug}/portal` | Redirect to dashboard |

---

## Summary Table (fill after run)

| # | Result | Notes |
|---|--------|-------|
| 1 | | |
| 2 | | |
| … | | |
| 41 | | |
