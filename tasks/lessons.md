# Lessons & Rules

## Workflow Rules (from user)

### Plan Mode
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### Subagents
- Use subagents liberally to keep main context clean
- Offload research, exploration, parallel analysis to subagents
- One task per subagent for focused execution

### Self-Improvement
- After ANY correction: update this file with the pattern
- Write rules that prevent the same mistake
- Review this file at session start

### Verification
- Never mark a task complete without proving it works
- Ask: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

### Core Principles
- **Simplicity First**: Make every change as simple as possible
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards
- **Minimal Impact**: Only touch what's necessary. Avoid introducing bugs

---

## Learned Patterns

### Platform Vet Audit (2026-02-22)

**Pattern: Admin pages bypass API routes**
- 4 admin pages write directly to Supabase from client components instead of going through API routes
- This bypasses server-side validation, logging, and rate limiting
- Rule: ALL mutations (insert/update/delete) must go through API routes, never direct Supabase client calls from "use client" components
- Even when RLS protects the data, API routes add defense-in-depth

**Pattern: Unscoped queries leak cross-org data**
- Dashboard onboarding query fetched ALL records without organization_id filter
- Rule: Every Supabase query in a multi-tenant app MUST include the tenant filter (organization_id or client_id)
- Don't rely solely on RLS — code-level scoping is a required safety net

**Pattern: Team agent mailbox issues**
- Some team agents went idle repeatedly without processing their task
- Workaround: Use direct Task agents (non-team) for independent audit work that doesn't need inter-agent coordination
- Team agents are better for tasks that require back-and-forth communication

**Pattern: Large audit agents hit context limits**
- Admin audit agent ran out of context reading 38 page files
- Workaround: Instruct agents to be concise — read files, note only issues, don't reproduce file contents
- Keep audit reports focused on findings, not file listings

**Pattern: OG images for social sharing**
- Marketing site had OG title/description but no image property
- Rule: Every marketing page needs an OG image for social previews. Add `opengraph-image.png` to public/ or set `openGraph.images` in metadata

**Pattern: Meta description accuracy**
- Pricing page said "Start free" but cheapest plan is $499/mo
- Rule: Always verify meta descriptions match actual product/pricing reality

### Reaudit V2 (2026-02-23)

**Pattern: Rename is a coordinated operation — labels alone are insufficient**
- Renaming "Automations" to "Integrations" and "Business Settings" to "Knowledge Base" only updated UI labels
- Route folders, API endpoints, component folders, import paths, middleware route lists, OAuth callbacks, feature gate keys, and marketing copy were NOT updated
- Result: ~45 files and ~100 import references still use old names
- Rule: When renaming a feature, create a checklist: (1) route folders, (2) API endpoint folders, (3) component folders, (4) library files, (5) import paths in all consumers, (6) middleware/auth route lists, (7) sidebar/nav labels on ALL layouts (admin + client), (8) page titles/headings, (9) OAuth redirect URLs, (10) feature gate keys, (11) marketing copy, (12) error messages/toasts, (13) comments. Complete ALL before shipping.

**Pattern: Direct Supabase mutations are persistent — previous fixes didn't catch client portal pages**
- V1 audit found 4 admin pages bypassing API routes → fixed
- V2 audit found 5 MORE client portal pages doing the same (topics, campaigns, leads, widget, agent-settings widget)
- Rule: After fixing a class of bugs, grep the ENTIRE codebase for the same pattern, not just the pages you already know about
- Grep: `supabase.from.*\.(insert|update|upsert|delete)` in all "use client" files

**Pattern: Old pages survive rename — orphaned routes**
- Old `settings/business/page.tsx` still exists with "Business Settings" title after KB was created
- Old `/automations` route still exists after "Integrations" rename
- Rule: When creating a replacement page, DELETE or redirect the old page in the same PR. Never leave orphaned routes.

**Pattern: Admin action link must be tested**
- Admin "Set Up" button navigated to `/clients/{id}/automations` — a route that doesn't exist → 404
- Rule: Every navigation action in admin UI must be tested against actual route existence

**Pattern: Team agents work well for parallel independent audit**
- V2 used team of 5 agents, all completed successfully and produced comprehensive reports
- Key success factor: very detailed prompts with specific scope, file patterns, and output format
- Each agent completed in 5-10 minutes with focused scope
- Rule: Team agents work well when (1) tasks are fully independent, (2) prompts are detailed, (3) output format is specified, (4) agents are told to be concise

### Final Gate Audit #6 (2026-02-23)

**Pattern: Direct mutation grep must cover ALL "use client" files, not just known pages**
- Audit #1 fixed 4 admin pages. Audit #2 fixed 5 client pages. Audit #6 STILL found 8 more: agent-settings (6 mutations), ai-analysis (2), billing/connect, saas/connect, saas/plans (2), saas/pricing-tables
- The grep was only run against pages the auditors were told to look at
- Rule: After EVERY mutation fix round, run this exact command and verify ZERO hits:
  `grep -rl "use client" src/app/ | xargs grep -l "supabase\.from.*\.\(insert\|update\|upsert\|delete\)"`
- If any hits remain, they are blockers. No exceptions.

**Pattern: Warnings flagged in audits must be FIXED, not just documented**
- Audit #5 flagged: pricing FAQ "automations", contact form HVAC industries, Features "Coming Soon" inconsistency, metadataBase not set, console.log in API route, 6 unused imports
- Audit #6 found ALL SIX still present — zero were fixed between audits
- Rule: When an audit flags a warning, create a task for it. Don't just document it. If a warning comes back in the next audit, it automatically becomes a blocker.

**Pattern: Build warnings must reach zero before shipping**
- "Zero errors" is not enough. Build warnings (metadataBase, middleware deprecated) indicate real issues
- Lint warnings (unused imports) indicate dead code
- Rule: `npm run build 2>&1 | grep "⚠"` must return nothing. `npm run lint` must show 0 problems.

**Pattern: Login/auth forms must use API routes like everything else**
- Login form called `supabase.auth.signInWithPassword()` directly from the client
- This bypassed rate limiting, exposed raw Supabase error messages, and was inconsistent with the API-route pattern
- Rule: Auth operations (login, signup, password reset) should go through API routes that add rate limiting and sanitized error messages

**Pattern: Marketing content must be reviewed after product changes**
- Contact form industry dropdown was created during HVAC-only era, never updated when the platform expanded to 8 verticals
- Features page "Coming Soon" flags were never removed when the integrations became available
- Rule: After any major product change (new verticals, new integrations, new features), grep marketing content for outdated references

### Audit #8 — Two-Model Verification (2026-02-23)

**Pattern: Direct mutation grep catches portal pages but misses admin (startup) pages**
- Audits #1, #2, #6 fixed portal and known admin pages. Audit #8 STILL found 4 MORE in (startup): saas/advanced, agents/layout, agents/campaigns, agents/widget
- The grep command `grep -rl "use client" src/app/` does catch these, but agents fixing mutations were only told about specific files
- Rule: After EVERY mutation fix round, run the exhaustive grep AND manually inspect every result. Don't rely on agents only fixing files they were told about.

**Pattern: Auth operations must be caught comprehensively, not just login**
- Audit #6 fixed login form's direct `supabase.auth.signInWithPassword()`. Audit #8 found `change-password.tsx` also calls `signInWithPassword()` and `updateUser()` directly
- Rule: When fixing a class of auth bypass, grep for ALL auth method patterns: `supabase.auth.signIn`, `supabase.auth.signUp`, `supabase.auth.updateUser`, `supabase.auth.signOut` in all "use client" files

**Pattern: Rename text must cover admin pages too, not just client portal and marketing**
- Audit #8 found 5 "Automations" references in admin UI text (plans page, integrations page, solutions page)
- Previous rename focused on route folders, components, and marketing — admin page content was not checked
- Rule: Add admin page content strings to the rename checklist: dialog titles, empty states, section headers, subtitles

**Pattern: Team agents can't run npm commands in background mode**
- Build/security agent couldn't execute `npm run build` or `npm run lint` due to bash permissions in background mode
- Rule: Always run build/lint from the main agent context, not from background subagents. Include the results in the agent prompt if needed.
