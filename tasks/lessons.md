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
