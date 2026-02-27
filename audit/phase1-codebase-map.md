# Phase 1: Codebase Map — Architecture, Tech Stack, Data Flow

## 1. Project Overview

**Product**: Invaria Labs -- a white-label SaaS platform for AI-powered phone/chat/SMS agents, built on Retell AI.

**Business model**: B2B2C. A "startup" (the platform operator / agency) creates and manages AI agents on behalf of their "clients" (end businesses). Clients access a branded portal; end callers interact with the AI agents.

**Framework**: Next.js 16 (App Router, React 19, TypeScript)
**Deployment**: Vercel (evidenced by `vercel.json` crons, `CRON_SECRET`)
**Database**: Supabase (PostgreSQL + Auth + RLS)
**CSS**: Tailwind CSS 4, Radix UI, shadcn/ui components

---

## 2. Directory Structure

```
/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth pages: login, signup, forgot-password, reset-password, setup-account
│   │   ├── (marketing)/          # Public marketing: home, about, pricing, features, contact, industries, privacy, terms
│   │   ├── (portal)/             # Client-facing portal: /<slug>/portal/...
│   │   ├── (startup)/            # Admin dashboard: agents, clients, billing, settings, saas, workflows, integrations
│   │   ├── api/                  # ~165 API route files (see Section 5)
│   │   ├── auth/callback/        # Supabase auth callback
│   │   └── pricing/[orgSlug]/    # Public pricing page per org
│   ├── components/               # React components
│   │   ├── agents/               # Prompt tree editor, test panel, tool dialog
│   │   ├── auth/                 # Change password
│   │   ├── billing/              # Stripe Connect card
│   │   ├── integrations/         # OAuth buttons, recipe cards, resource pickers
│   │   ├── knowledge-base/       # FAQs, services, policies, hours, locations, post-call actions
│   │   ├── layout/               # Portal sidebar, startup sidebar, tab nav
│   │   ├── marketing/            # Navbar, footer, hero, CTA, FAQ, live demo, etc.
│   │   ├── onboarding/           # Wizard steps, test call, coaching, chat inline
│   │   ├── portal/               # Feature gate, upgrade banner, service mapping, Zapier/Make/n8n cards
│   │   └── ui/                   # shadcn/ui primitives (~30 components)
│   ├── hooks/                    # use-onboarding, use-plan-access, use-retell-call
│   ├── lib/                      # Shared server/client utilities (see Section 8)
│   └── types/                    # TypeScript types: database.ts, retell.ts
├── supabase/
│   └── migrations/               # 50+ SQL migrations (Feb 10 -- Feb 25, 2026)
│   └── schema.sql                # Base schema (partial -- migrations extend it)
├── scripts/                      # Seed scripts (seed.ts, seed-flow-templates.ts, add-invoice-paid-webhook.ts)
├── docs/                         # Audit reports, QA reports
├── tasks/                        # Task tracking (todo.md, lessons.md)
├── public/                       # Static assets (og-image.png, SVGs)
└── [config files]                # next.config.ts, tsconfig.json, vercel.json, eslint.config.mjs, vitest.config.ts, CLAUDE.md
```

---

## 3. Tech Stack & Dependencies

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | App framework |
| react / react-dom | 19.2.3 | UI library |
| typescript | ^5 | Type safety |

### External Service SDKs
| Package | Version | Purpose |
|---------|---------|---------|
| retell-sdk | ^4.66.0 | Server-side Retell AI API |
| retell-client-js-sdk | ^2.0.7 | Client-side Retell web calls |
| stripe | ^20.3.1 | Server-side Stripe payments |
| @stripe/stripe-js | ^8.7.0 | Client-side Stripe |
| @supabase/supabase-js | ^2.95.3 | Supabase client |
| @supabase/ssr | ^0.8.0 | Supabase SSR helpers |
| resend | ^6.9.1 | Transactional email |
| twilio | ^5.5.0 | SMS sending |
| googleapis | ^171.4.0 | Google Calendar + Sheets |
| @hubspot/api-client | ^13.4.0 | HubSpot CRM |
| @notionhq/client | ^5.9.0 | Notion integration |
| @slack/web-api | ^7.14.0 | Slack messaging |

### UI & Visualization
| Package | Version | Purpose |
|---------|---------|---------|
| @xyflow/react | ^12.10.1 | Flow/graph editor (prompt tree, conversation flows) |
| radix-ui | ^1.4.3 | Accessible UI primitives |
| recharts | ^3.7.0 | Analytics charts |
| framer-motion | ^12.34.1 | Animations |
| lucide-react | ^0.563.0 | Icons |
| cmdk | ^1.1.1 | Command palette |
| sonner | ^2.0.7 | Toast notifications |
| canvas-confetti | ^1.9.4 | Celebration effects |
| jspdf | ^4.1.0 | PDF generation |

### Utility
| Package | Version | Purpose |
|---------|---------|---------|
| handlebars | ^4.7.8 | Template rendering |
| date-fns | ^4.1.0 | Date formatting |
| clsx / tailwind-merge | latest | Class name utilities |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.0.18 | Test runner |
| eslint / eslint-config-next | ^9 / 16.1.6 | Linting |
| shadcn | ^3.8.4 | UI component generator |
| pg | ^8.18.0 | PostgreSQL client (scripts) |
| tailwindcss / @tailwindcss/postcss | ^4 | Styling |

---

## 4. User Roles & Route Groups

### Two-Tier Multi-Tenancy

```
Organization (startup)
├── Startup Admin/Member  → Admin dashboard (/dashboard, /agents, /clients, /billing, /settings, /saas, /workflows, /integrations)
└── Client (business)
    ├── Client Admin/Member  → Portal (/<slug>/portal/...)
    └── End Callers            → Phone/chat/SMS agents (no dashboard access)
```

### Auth Route Group `(auth)`
| Route | Purpose |
|-------|---------|
| /login | Email/password login |
| /signup | New account signup |
| /forgot-password | Password reset request |
| /reset-password | Password reset completion |
| /setup-account | New client account setup (from invite link) |

### Marketing Route Group `(marketing)`
| Route | Purpose |
|-------|---------|
| / | Landing page |
| /about | About page |
| /pricing | Pricing page |
| /features | Features page |
| /contact | Contact form |
| /industries | Industry listing |
| /industries/[slug] | Industry detail page |
| /privacy | Privacy policy |
| /terms | Terms of service |

### Admin Route Group `(startup)` -- Startup Admins Only
| Route | Purpose |
|-------|---------|
| /dashboard | Main admin dashboard |
| /agents | Agent management list |
| /agents/[id]/* | Agent detail tabs: overview, prompt-tree, ai-analysis, agent-config, campaigns, widget |
| /clients | Client management list |
| /clients/[id]/* | Client detail tabs: overview, assigned-agents, knowledge-base, phone-numbers, solutions, client-access, custom-css, embed-url |
| /billing/* | Stripe Connect, invoices, subscriptions, transactions, coupons, products |
| /saas/* | SaaS management: plans, templates, pricing-tables, connect, advanced |
| /settings/* | Org settings: startup info, members, integrations, whitelabel, phone/SIP, usage, webhook-logs |
| /integrations | Integration management |
| /workflows | Workflow/solution management |

### Portal Route Group `(portal)` -- Client Users Only
| Route | Purpose |
|-------|---------|
| /[slug]/portal | Client dashboard |
| /[slug]/portal/onboarding | Onboarding wizard |
| /[slug]/portal/agents/[id]/* | Agent management tabs (subset of admin): analytics, conversations, leads, prompt-tree, knowledge-base, call-handling, campaigns, agent-settings, ai-analysis, post-call-actions, topics, widget |
| /[slug]/portal/billing | Client billing (view subscription, manage via Stripe portal) |
| /[slug]/portal/conversation-flows | Conversation flow builder |
| /[slug]/portal/integrations | OAuth integrations (Google, Slack, HubSpot, etc.) |
| /[slug]/portal/knowledge-base | Business info management |

---

## 5. Complete API Route Map

### Auth (`/api/auth/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/auth | GET | Get current user session |
| /api/auth/reset-password | POST | Initiate password reset |

### Agents (`/api/agents/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/agents | GET, POST | List agents / Create agent |
| /api/agents/[id] | PATCH, DELETE | Update / Delete agent |
| /api/agents/[id]/config | GET, PATCH | Get/update Retell agent config (proxies to Retell API) |
| /api/agents/[id]/conversation-flow | GET, PUT | Get/save conversation flow (Retell retell-llm states) |
| /api/agents/[id]/knowledge-base | GET, POST | Manage knowledge base sources |
| /api/agents/[id]/knowledge-base/[sourceId] | DELETE | Delete KB source |
| /api/agents/[id]/publish | POST | Deploy agent config to Retell |
| /api/agents/[id]/topics | GET, POST, DELETE | Topic management |
| /api/agents/[id]/voices | GET | List available voices from Retell |
| /api/agents/[id]/versions | GET | Version history |
| /api/agents/[id]/ai-analysis | GET | Run AI analysis on calls |
| /api/agents/[id]/ai-analysis-config | GET, PUT | AI analysis configuration |
| /api/agents/[id]/call-handling | GET, PUT | Call handling settings |
| /api/agents/[id]/campaign-config | GET, PUT | Campaign rate/schedule config |
| /api/agents/[id]/chat | POST | Chat widget messages |
| /api/agents/[id]/webhook-test | POST | Test agent webhook |
| /api/agents/[id]/widget-config | GET, PUT | Widget appearance config |
| /api/agents/create-web-call | POST | Create Retell web call (rate limited) |
| /api/agents/sync-call | POST | Sync call data from Retell |

### Clients (`/api/clients/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/clients | GET, POST | List / Create clients |
| /api/clients/[id] | GET, PATCH, DELETE | Client CRUD |
| /api/clients/[id]/assigned-agents | GET, POST, DELETE | Manage agent assignments |
| /api/clients/[id]/client-access | GET, PUT | Feature permission toggles |
| /api/clients/[id]/embed-url | GET | Widget embed URL |
| /api/clients/[id]/members/[memberId] | DELETE | Remove team member |
| /api/clients/[id]/solutions | GET, PUT | Solution assignments |

### Knowledge Base (`/api/knowledge-base/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/knowledge-base | GET | Get all KB data for a client |
| /api/knowledge-base/faqs | GET, POST | FAQ list / create |
| /api/knowledge-base/faqs/[id] | PUT, DELETE | FAQ update / delete |
| /api/knowledge-base/hours | GET, PUT | Business hours |
| /api/knowledge-base/locations | GET, POST | Location list / create |
| /api/knowledge-base/locations/[id] | PUT, DELETE | Location update / delete |
| /api/knowledge-base/policies | GET, POST | Policy list / create |
| /api/knowledge-base/policies/[id] | PUT, DELETE | Policy update / delete |
| /api/knowledge-base/services | GET, POST | Service list / create |
| /api/knowledge-base/services/[id] | PUT, DELETE | Service update / delete |

### Onboarding (`/api/onboarding/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/onboarding/start | POST | Start onboarding (select template) |
| /api/onboarding/step/[step] | GET, PUT | Step data read/write |
| /api/onboarding/status | GET | Current onboarding status |
| /api/onboarding/create-agent | POST | Create agent from onboarding config |
| /api/onboarding/test-call | POST | Initiate test call via Retell |
| /api/onboarding/test-sms | POST | Send test SMS via Twilio |
| /api/onboarding/go-live | POST | Finalize go-live |
| /api/onboarding/reset | POST | Reset onboarding |

### Billing (`/api/billing/`, `/api/checkout/`, etc.)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/billing | GET, POST | Client billing info / portal session |
| /api/checkout | POST | Create Stripe checkout session (public, rate limited) |
| /api/marketing-checkout | POST | Marketing site checkout (public, rate limited) |
| /api/client/billing | GET, POST | Client-side billing management |
| /api/client/plan-access | GET | Feature gate check for client |

### Admin (`/api/admin/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/admin/plans | GET, POST | Manage client plans |
| /api/admin/plans/[id] | GET, PATCH, DELETE | Individual plan CRUD |
| /api/admin/pricing-tables | GET, POST | Manage pricing tables |
| /api/admin/pricing-tables/[id] | GET, PATCH, DELETE | Individual pricing table CRUD |
| /api/admin/org-settings | GET, PUT | Organization settings |
| /api/admin/stripe-connections | GET, POST, DELETE | Stripe Connect account management |

### Integrations (`/api/integrations/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/integrations | GET, POST, PATCH, DELETE | Platform integrations (Retell, ElevenLabs, etc.) |
| /api/integrations/client | GET | Client integration connections |
| /api/integrations/client/[id] | GET, PATCH | Individual client integration |
| /api/integrations/client/[id]/logs | GET | Integration logs |
| /api/integrations/recipes | GET | Automation recipe catalog |
| /api/integrations/recipes/[id] | GET, PATCH | Individual recipe |
| /api/integrations/configure | POST | Configure client automation |
| /api/integrations/events | GET | Integration event log |
| /api/integrations/recent-syncs | GET | Recent sync activity |
| /api/integrations/service-mappings | GET, PUT | Service-to-integration mapping |
| /api/integrations/webhook-test | POST | Test integration webhook |
| /api/integration-requests | GET, POST | Integration request tracking |
| /api/integration-requests/[id] | PATCH | Update request status |

### OAuth (`/api/oauth/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/oauth/authorize | GET | Initiate OAuth flow (redirect to provider) |
| /api/oauth/callback | GET | OAuth callback (exchange code, store tokens) |
| /api/oauth/connections | GET | List active OAuth connections |
| /api/oauth/disconnect | POST | Revoke OAuth connection |
| /api/oauth/google/calendars | GET | List Google calendars |
| /api/oauth/google/sheets | GET | List Google spreadsheets |
| /api/oauth/slack/channels | GET | List Slack channels |

### Third-Party Platform Auth (`/api/zapier/`, `/api/make/`, `/api/n8n/`)
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/zapier/auth | POST | Zapier API key auth |
| /api/zapier/subscribe | POST, DELETE | Zapier webhook subscription |
| /api/make/auth | POST | Make API key auth |
| /api/make/subscribe | POST, DELETE | Make webhook subscription |
| /api/n8n/auth | POST | n8n API key auth |
| /api/n8n/subscribe | POST, DELETE | n8n webhook subscription |

### Retell Tool Endpoints (`/api/tools/`) -- Called by Retell During Calls
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/tools/calendar/availability | POST | Check Google Calendar availability |
| /api/tools/calendar/book | POST | Book Google Calendar appointment |
| /api/tools/calendly/availability | POST | Check Calendly availability |
| /api/tools/calendly/book | POST | Book Calendly appointment |
| /api/tools/appointments/check | POST | Check appointment status |
| /api/tools/appointments/cancel | POST | Cancel appointment |
| /api/tools/availability/check | POST | Check business availability |
| /api/tools/business-hours/check | POST | Check business hours |
| /api/tools/callback/route | POST | Request callback |
| /api/tools/confirmation/send | POST | Send SMS confirmation |
| /api/tools/contacts/lookup | POST | Contact lookup |
| /api/tools/email/send | POST | Send email from agent |
| /api/tools/escalate | POST | Escalate to human |
| /api/tools/faq/search | POST | Search FAQs |
| /api/tools/feedback/collect | POST | Collect feedback |
| /api/tools/gohighlevel/lookup | POST | GoHighLevel CRM lookup |
| /api/tools/housecallpro/* | POST | Housecall Pro: lookup, availability, book, create-estimate |
| /api/tools/hubspot/lookup | POST | HubSpot CRM lookup |
| /api/tools/intake/collect | POST | Collect intake data |
| /api/tools/jobber/* | POST | Jobber: lookup, availability, book, create-quote |
| /api/tools/leads/create | POST | Create lead from call |
| /api/tools/leads/update | POST | Update lead data |
| /api/tools/locations/nearest | POST | Find nearest location |
| /api/tools/notes/create | POST | Create call notes |
| /api/tools/policies/search | POST | Search business policies |
| /api/tools/salesforce/lookup | POST | Salesforce CRM lookup |
| /api/tools/services/search | POST | Search available services |
| /api/tools/sms/send | POST | Send SMS via Twilio |
| /api/tools/transfer/initiate | POST | Initiate call transfer |
| /api/tools/waitlist/add | POST | Add to waitlist |

### Webhooks (Inbound)
| Route | Methods | Auth | Source |
|-------|---------|------|--------|
| /api/webhooks/retell | POST | Retell HMAC signature | Retell AI call events |
| /api/webhooks/stripe | POST | Stripe signature | Stripe payment events |
| /api/webhooks/housecallpro | POST | Shared secret header | Housecall Pro events |
| /api/webhooks/jobber | POST | Shared secret header | Jobber events |
| /api/webhooks/resend/inbound | POST | Query param secret | Inbound email replies (callbacks) |

### Cron Jobs (Vercel Cron)
| Route | Schedule | Purpose |
|-------|----------|---------|
| /api/cron/daily-digest | Hourly | Send daily email digests (checks per-client timezone/hour) |
| /api/cron/checkin-email | Hourly | Send check-in emails to new clients |
| /api/cron/usage-alerts | Hourly | Check usage thresholds, send alerts |
| /api/cron/retry-queue | Every 5 min | Retry failed webhook deliveries |
| /api/cron/send-emails | Every 5 min | Send scheduled/delayed emails |
| /api/cron/process-callbacks | Every 5 min | Process pending callback calls |

### Other Public Endpoints
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/contact | POST | Contact form submission (rate limited) |
| /api/demo-call | POST | Marketing live demo call (rate limited) |
| /api/agent-templates | GET | Agent template catalog |
| /api/solutions | GET | Solution catalog |
| /api/pii-redaction | GET, PUT | PII redaction config |
| /api/post-call-actions | GET, PUT | Post-call action config |
| /api/settings | GET, PUT | Business settings |
| /api/whitelabel | GET, PUT | Whitelabel settings |

### Misc
| Route | Methods | Purpose |
|-------|---------|---------|
| /api/calls | GET | List call logs |
| /api/campaigns | GET, POST | Campaign management |
| /api/campaigns/[id] | GET, PATCH, DELETE | Individual campaign |
| /api/conversation-flows | GET, POST | Conversation flow management |
| /api/conversation-flows/[id] | GET, PUT, DELETE | Individual flow |
| /api/leads | GET, POST | Lead management |
| /api/leads/[id] | GET, PATCH, DELETE | Individual lead |
| /api/leads/[id]/score | POST | Score a lead |
| /api/leads/import | POST | Bulk lead import |
| /api/leads/scoring-rules | GET, PUT | Lead scoring rules |
| /api/members | GET, POST | Team member management |
| /api/phone-numbers | GET | List phone numbers |
| /api/phone-numbers/[id] | PATCH, DELETE | Update / delete phone number |
| /api/phone-numbers/[id]/assign | PUT | Assign phone to agent |
| /api/phone-numbers/caller-id | POST | Verify caller ID (Hiya) |
| /api/phone-numbers/import | POST | Import existing numbers |
| /api/phone-numbers/purchase | POST | Purchase new number (Twilio) |
| /api/phone-numbers/search | GET | Search available numbers (Twilio) |
| /api/sip-trunks | GET, POST | SIP trunk management |
| /api/sip-trunks/[id] | PATCH, DELETE | Individual SIP trunk |
| /api/usage/agent-costs | GET | Agent cost breakdown |
| /api/usage/alerts | GET, PUT | Usage alert settings |
| /api/usage/forecast | GET | Usage forecast |

---

## 6. External Service Integrations

### 6.1 Retell AI (Core)
**Purpose**: AI phone/chat/SMS agent engine.

**Server-side usage** (`retell-sdk`):
- Webhook signature verification (`Retell.verify`)
- Agent CRUD via REST API (`https://api.retellai.com/...`)
- Call creation (web calls, phone calls, chat)
- Knowledge base management
- Voice listing
- Conversation flow compilation

**Client-side usage** (`retell-client-js-sdk`):
- Web call initiation in browser via `RetellWebClient`

**API key resolution chain** (per-agent):
1. Agent-level encrypted key (`agents.retell_api_key_encrypted`)
2. Organization integration key (`integrations` table, provider="retell")
3. Platform-level env var (`RETELL_API_KEY`)

**Endpoints called**:
- `GET /get-agent/{id}`, `PATCH /update-agent/{id}`, `DELETE /delete-agent/{id}`
- `POST /v2/create-web-call`, `POST /v2/create-phone-call`
- `GET /list-voices`, `GET /get-call/{id}`, `GET /list-calls`
- Retell-llm and conversation-flow engine endpoints

### 6.2 Supabase
**Purpose**: Database, auth, row-level security.

**Auth**: Supabase Auth with email/password, invite links via `admin.generateLink`.

**Client types**:
- `createClient()` -- cookie-based server client (uses anon key + user session)
- `createBrowserClient()` -- client-side browser client
- `createServiceClient()` -- service role client (bypasses RLS)

**Tables** (from schema + migrations, ~40 tables):

Core: `organizations`, `users`, `clients`
Agents: `agents`, `widget_config`, `ai_analysis_config`, `topics`, `campaign_config`
Permissions: `client_access`
Phone/Calls: `phone_numbers`, `call_logs`
Workflows: `solutions`, `client_solutions`
Billing: `stripe_connections`, `client_plans`, `plan_addons`, `client_addons`, `pricing_tables`
Templates: `agent_templates`
Settings: `organization_settings`, `whitelabel_settings`, `email_templates`, `integrations`
Logs: `webhook_logs`
Leads/Campaigns: `leads`, `campaigns`, `campaign_leads`
Business KB: `business_settings`, `business_hours`, `business_services`, `business_faqs`, `business_policies`, `business_locations`
Onboarding: `client_onboarding`
Post-Call: `post_call_actions`, `scheduled_emails`
Automations: `automation_recipes`, `client_automations`, `automation_logs`
OAuth: `oauth_connections`
KB Sources: `knowledge_base_sources`
Features: `sip_trunks`, `pii_redaction_configs`, `conversation_flows`
Zapier/Make/n8n: `zapier_subscriptions`, `make_subscriptions`, `n8n_subscriptions`
Usage: `usage_alert_settings`
Scoring: `lead_scores`, `lead_scoring_rules`
Callbacks: `pending_callbacks`
Integration Events: `integration_events`
Waitlist/Feedback: `waitlist_entries`, `feedback_entries`
Integration Requests: `integration_requests`
CRM: `crm_integrations`

**RLS**: Enabled on core tables. Startup users see all org data; client users see only their own client data.

### 6.3 Stripe
**Purpose**: SaaS billing -- subscriptions, checkout, invoices, Stripe Connect.

**Integration pattern**: Stripe Connect (startup connects their Stripe account, bills clients through it).

**Inbound webhook** (`/api/webhooks/stripe`):
- `checkout.session.completed` -- auto-provisions new client, creates auth user, sends welcome email
- `customer.subscription.deleted` -- deactivates client
- `customer.subscription.updated` -- handles past_due / reactivation
- `invoice.payment_failed` -- flags account
- `invoice.paid` -- sends receipt email

**Functions** (`src/lib/stripe.ts`):
- `createCheckoutSession`, `createConnectAccount`, `createAccountLink`
- `listProducts`, `createProduct`, `createPrice`
- `listSubscriptions`, `listInvoices`, `listCharges`
- `createCoupon`, `listCoupons`
- `createBillingPortalSession`, `retrieveSubscription`, `cancelSubscription`
- `constructWebhookEvent` (signature verification)

### 6.4 Resend (Email)
**Purpose**: Transactional email delivery.

**Usage**:
- Welcome emails on checkout completion
- Payment receipt emails
- Post-call email summaries
- Caller follow-up emails
- Daily digest emails
- Contact form notifications
- Check-in emails
- First-call celebration emails
- Callback request emails
- Inbound email parsing (via webhook at `/api/webhooks/resend/inbound`)

### 6.5 Twilio (SMS & Phone Numbers)
**Purpose**: SMS sending, phone number provisioning, SIP trunking.

**SMS** (`src/lib/twilio.ts`):
- Platform-initiated SMS: `TWILIO_PHONE_NUMBER` via `sendSms()`
- Agent-initiated SMS during calls: `TWILIO_FROM_NUMBER` via `/api/tools/sms/send`, `/api/tools/confirmation/send`

**Phone numbers**:
- Search available numbers: `/api/phone-numbers/search`
- Purchase numbers: `/api/phone-numbers/purchase`
- Import existing numbers: `/api/phone-numbers/import`
- SIP trunk management: `/api/sip-trunks/*`

**SIP config**: `TWILIO_SIP_TRUNK_SID`, `TWILIO_SIP_TERMINATION_URI`, `TWILIO_SIP_USERNAME`, `TWILIO_SIP_PASSWORD`

### 6.6 OAuth Integrations (8 Providers)

All managed via `/api/oauth/authorize` (redirect) and `/api/oauth/callback` (token exchange + storage).

| Provider | Purpose | Scopes |
|----------|---------|--------|
| **Google** | Calendar scheduling, Sheets export | calendar.events, spreadsheets, drive.readonly, userinfo.email |
| **Slack** | Channel notifications | chat:write, channels:read |
| **HubSpot** | CRM contact/deal lookup | crm.objects.contacts.read/write, crm.objects.deals.read |
| **Calendly** | Appointment scheduling | (default) |
| **QuickBooks** | Accounting | com.intuit.quickbooks.accounting |
| **Salesforce** | CRM lookup | api, refresh_token, id |
| **GoHighLevel** | CRM/contact management | contacts.readonly/write, opportunities, locations |
| **Housecall Pro** | Home services job/estimate mgmt | (default) |
| **Jobber** | Home services job/quote mgmt | read:clients, write:clients, read:jobs, write:jobs, read:quotes, write:quotes, read:schedules |

**Token management** (`src/lib/oauth/token-manager.ts`): Auto-refresh with 5-min buffer, encrypted storage, in-memory refresh locks.

**OAuth state** (`src/lib/oauth/state.ts`): AES-256-GCM encrypted state with 10-min expiry.

### 6.7 Hiya Connect
**Purpose**: Branded caller ID verification.
**Config**: `HIYA_APP_ID`, `HIYA_APP_SECRET`
**Endpoint**: `/api/phone-numbers/caller-id`

### 6.8 Zapier / Make / n8n
**Purpose**: Third-party automation platform integration.

**Pattern** (identical for all three):
- Auth: API key verification
- Subscribe: Register webhook URL for event type
- Dispatch: POST call data to subscribed hooks on `call.completed`
- Auto-deactivate on 410 Gone response

---

## 7. Data Flow Diagrams

### 7.1 Inbound Call Flow

```
Phone Call → Retell AI Agent → [AI processes call]
                                    ↓
                              Call Events (started/ended/analyzed)
                                    ↓
                          POST /api/webhooks/retell
                                    ↓
                     ┌── Verify HMAC signature ──┐
                     │                           │
                ┌────┴────┐               ┌──────┴──────┐
                │call_started│           │call_ended    │
                │Insert      │           │Update call_log│
                │call_log    │           │Handle callback│
                └─────────────┘          │completion    │
                                         └──────┬──────┘
                                                │
                                    ┌───────────┴──────────────┐
                                    │       call_analyzed      │
                                    │                          │
                              ┌─────┴─────┐                   │
                              │PII Redact  │                   │
                              └─────┬─────┘                   │
                                    │                          │
                         ┌──────────┴────────────────┐        │
                         │  Promise.all (parallel)    │        │
                         ├─ Post-call actions (email, SMS)     │
                         ├─ Automation recipes                 │
                         ├─ Zapier dispatch                    │
                         ├─ Make dispatch                      │
                         ├─ n8n dispatch                       │
                         └─ Lead scoring                       │
                                                               │
                     ┌─ First-call notification (if new client)│
                     ├─ Increment call counter                 │
                     └─ Forward to agent/solution webhooks     │
```

### 7.2 Checkout & Client Provisioning Flow

```
User (marketing site or public pricing page)
    ↓
POST /api/checkout or /api/marketing-checkout
    ↓ (rate limited)
Look up plan → Get Stripe connected account → Create Stripe Checkout Session
    ↓
Stripe Checkout (hosted)
    ↓ (payment)
Stripe webhook → POST /api/webhooks/stripe (checkout.session.completed)
    ↓
1. Look up plan features
2. Create client record (with slug)
3. Create auth user via Supabase admin.generateLink
4. Create users table row
5. Send branded welcome email (Resend)
6. Set client_access permissions based on plan
7. Create client_onboarding record
```

### 7.3 OAuth Integration Flow

```
Client user clicks "Connect" → GET /api/oauth/authorize
    ↓
Encrypt state (clientId + provider + redirect + timestamp)
    ↓
Redirect to provider auth URL (Google, Slack, HubSpot, etc.)
    ↓
User authorizes → Provider redirects to GET /api/oauth/callback
    ↓
1. Decrypt & validate state (10-min expiry)
2. Verify user authorization for clientId
3. Exchange code for tokens
4. Fetch provider-specific user info
5. Encrypt tokens → Upsert oauth_connections
6. Register Retell agent tools (non-blocking)
7. Redirect to /<slug>/portal/integrations?connected=<provider>
```

### 7.4 Callback Pipeline Flow

```
During call: Retell agent calls POST /api/tools/callback
    ↓
Create pending_callback record (status: pending)
    ↓
Send email to business owner with callback UUID in reply-to address
    ↓
Business owner replies to callback-{uuid}@reply.invarialabs.com
    ↓
Resend forwards to POST /api/webhooks/resend/inbound
    ↓
Parse reply body → Update pending_callback (status: answered, answer stored)
    ↓
Cron: GET /api/cron/process-callbacks (every 5 min)
    ↓
Find answered callbacks where next_attempt_at <= now
    ↓
Create outbound Retell phone call with callback_context dynamic variable
    ↓
Update status to calling_back → Retell calls caller → call_ended webhook
    ↓
If call successful → completed | If failed → retry (up to max_attempts)
    ↓
Expire pending callbacks older than 48 hours
```

---

## 8. Shared Libraries (`src/lib/`)

### Auth & API Helpers
| File | Purpose |
|------|---------|
| `api/auth.ts` | `requireAuth()` -- extracts user from Supabase session, returns 401 if not authenticated |
| `api/get-client-id.ts` | `getClientId()` -- resolves client_id from user role (client users) or query param (startup admins), verifies org membership |

### Supabase
| File | Purpose |
|------|---------|
| `supabase/server.ts` | `createClient()` (cookie-based), `createServiceClient()` (service role) |
| `supabase/client.ts` | `createBrowserClient()` (client-side) |
| `supabase/middleware.ts` | `updateSession()` -- session refresh, route protection, role-based redirects, slug validation |

### Security
| File | Purpose |
|------|---------|
| `crypto.ts` | AES-256-GCM encryption/decryption for API keys and OAuth tokens |
| `rate-limit.ts` | In-memory sliding window rate limiter (20 req/min default), IP extraction |
| `pii-redaction.ts` | PII redaction for transcripts and text (phone, email, SSN, credit card, names, custom patterns) |

### Integrations
| File | Purpose |
|------|---------|
| `stripe.ts` | All Stripe API wrappers (products, prices, subscriptions, invoices, etc.) |
| `resend.ts` | Email sending via Resend |
| `twilio.ts` | SMS sending via Twilio |
| `integrations.ts` | `getIntegrationKey()` -- fetch and decrypt org integration API keys |
| `oauth/providers.ts` | OAuth provider configs (URLs, scopes, client ID/secret) for 8 providers |
| `oauth/token-manager.ts` | `getValidToken()` -- auto-refresh OAuth tokens with locking |
| `oauth/state.ts` | Encrypted OAuth state parameter (CSRF protection) |
| `oauth/execute-native.ts` | Execute native integration actions (Google Sheets append, Slack message, etc.) |
| `oauth/register-agent-tools.ts` | Register Retell tools for a provider after OAuth connection |
| `oauth/executors/` | Provider-specific executors: google-sheets, slack, hubspot, salesforce, gohighlevel, housecallpro, jobber, notion, quickbooks, twilio-sms |
| `zapier.ts` | Dispatch events to Zapier subscriptions |
| `make.ts` | Dispatch events to Make subscriptions |
| `n8n.ts` | Dispatch events to n8n subscriptions |
| `integration-events.ts` | Log integration sync events |
| `integration-recipes.ts` | Execute automation recipes (webhook, native, email) |
| `integration-retry.ts` | Retry queue for failed webhook deliveries |

### Agent & Prompt
| File | Purpose |
|------|---------|
| `prompt-generator.ts` | Generate Retell system prompts from business config |
| `prompt-templates.ts` | Template strings for different industries |
| `prompt-tree-types.ts` | TypeScript types for the visual prompt tree editor |
| `compile-flow-to-retell.ts` | Convert conversation flow graph to Retell retell-llm states |
| `conversation-flow-templates.ts` | Template conversation flows |
| `hvac-templates.ts` | HVAC-specific prompt templates |

### Business Logic
| File | Purpose |
|------|---------|
| `post-call-actions.ts` | Execute post-call actions (email summary, SMS notification, caller follow-up) |
| `lead-scoring.ts` | Score leads based on call data |
| `plan-access.ts` | `getClientPlanAccess()` -- compute feature gates from plan + add-ons |
| `service-mapper.ts` | Map business services to integration services |
| `callback-utils.ts` | Callback pipeline utilities |
| `transcript-extraction.ts` | Extract structured data from call transcripts |
| `transcript-utils.ts` | Transcript formatting helpers |
| `retell-costs.ts` | Calculate per-call costs from Retell config |
| `knowledge-base-generator.ts` | Generate knowledge base content from business data |

### Utilities
| File | Purpose |
|------|---------|
| `utils.ts` | `cn()` -- Tailwind class merging |
| `logger.ts` | JSON structured logger (info/warn/error) |
| `marketing/industries.ts` | Industry data for marketing pages |

---

## 9. Middleware

**File**: `src/proxy.ts` (appears to be used as middleware export)
**Matcher**: All routes except static assets (`_next/static`, `_next/image`, favicons, images)

**Behavior** (`src/lib/supabase/middleware.ts`):
1. Refresh Supabase auth session cookies
2. Redirect unauthenticated users to `/login` (except public routes + API routes + marketing pages)
3. Redirect authenticated users away from auth pages (but not marketing pages)
4. Handle legacy `/portal` paths → redirect to `/<slug>/portal`
5. Role-based access control:
   - Client users cannot access admin routes (`/dashboard`, `/agents`, `/clients`, `/settings`, `/billing`, `/saas`, `/integrations`, `/workflows`)
   - Startup users cannot access portal routes (`/<slug>/portal/...`)
6. Validate URL slug matches the authenticated client user's actual slug (prevent accessing other clients' portals)
7. Determine onboarding status for redirect decisions

---

## 10. Environment Variables Summary

### Required Core
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RETELL_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `ENCRYPTION_KEY` (64-char hex, AES-256)
- `CRON_SECRET` (Vercel cron auth)
- `NEXT_PUBLIC_APP_URL`

### OAuth (per-provider pairs)
- Google, Slack, HubSpot, Calendly, QuickBooks, Salesforce, GoHighLevel, Housecall Pro, Jobber

### Twilio
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_FROM_NUMBER`
- `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_SIP_TRUNK_SID`, `TWILIO_SIP_TERMINATION_URI`, `TWILIO_SIP_USERNAME`, `TWILIO_SIP_PASSWORD`

### Other
- `RETELL_TOOLS_API_KEY` (auth for Retell custom tools)
- `HIYA_APP_ID`, `HIYA_APP_SECRET` (branded caller ID)
- `HOUSECALLPRO_WEBHOOK_SECRET`, `JOBBER_WEBHOOK_SECRET` (inbound webhook auth)
- `RETELL_AGENT_*` (8 demo agent IDs), `RETELL_FROM_NUMBER`
- `PLATFORM_PLAN_ID_STARTER`, `PLATFORM_PLAN_ID_PROFESSIONAL`
- `CONTACT_FORM_EMAIL`, `MARKETING_SITE_URL`

---

## 11. Testing

- **Framework**: Vitest
- **Test files**: 7 test files in `src/lib/__tests__/` and `src/lib/oauth/executors/__tests__/`
  - `hvac-templates.test.ts`
  - `integration-events.test.ts`
  - `integration-retry.test.ts`
  - `service-mapper.test.ts`
  - `transcript-extraction.test.ts`
  - `housecallpro.test.ts`
  - `jobber.test.ts`
- **Coverage**: Limited to utility/integration logic; no API route tests or component tests

---

## 12. Key Architectural Observations

1. **Multi-tenant with two user tiers**: Startup (admin) and Client (end user). RLS + middleware enforce separation.
2. **Retell AI is the core dependency**: Nearly every agent operation proxies through Retell's API.
3. **Extensive OAuth integration**: 8 OAuth providers with token management, auto-refresh, and encrypted storage.
4. **Event-driven post-call pipeline**: Retell webhook triggers a cascade of actions (PII redaction, post-call actions, automation recipes, Zapier/Make/n8n dispatch, lead scoring, callback management).
5. **SaaS white-labeling**: Whitelabel settings, custom CSS, branded emails, Stripe Connect for billing.
6. **Conversation flow visual editor**: Uses @xyflow/react for drag-and-drop flow building that compiles to Retell retell-llm states.
7. **Callback pipeline**: Unique feature -- caller asks question agent can't answer, business owner responds via email, AI calls caller back with the answer.
8. **Cron-based background processing**: 6 cron jobs for digest emails, check-in emails, usage alerts, retry queue, scheduled emails, callback processing.
