# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Invaria Labs is a Next.js 16 (App Router, Turbopack) AI voice agent platform. Single-app monolith (not a monorepo). See `CLAUDE.md` for stability rules and workflow conventions.

### Node version
The project requires **Node.js 20** (per `.nvmrc`). The VM snapshot has Node 20 installed via nvm. If the wrong version is active, run `source ~/.nvm/nvm.sh && nvm use 20`.

### Key commands
| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000, Turbopack) |
| Lint | `npm run lint` (ESLint 9, flat config) |
| Test | `npm run test` (Vitest, 12 test files, ~196 tests) |
| Build | `npm run build` |

### Environment variables
Copy `.env.example` to `.env.local`. Minimum required vars for the dev server to start:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — placeholder/local Supabase values are sufficient for marketing pages; auth-gated routes need a real Supabase project.
- `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`.
- `RETELL_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — placeholders let the server start; real keys needed for voice-agent and billing features.
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

### Gotchas
- The Sentry config in `next.config.ts` wraps with `withSentryConfig` but no-ops gracefully when `SENTRY_DSN` is unset. No action needed.
- Rate limiting falls back to in-memory when Upstash Redis env vars are missing — expected in local dev.
- The contact form submit (`/api/contact`) requires a real `RESEND_API_KEY` and `CONTACT_FORM_EMAIL` to work; without them it returns an error. This is expected.
- Lint has 4 pre-existing errors and 10 warnings in the codebase. These are not caused by environment setup.
- The middleware (`src/lib/supabase/middleware.ts`) calls `supabase.auth.getUser()` on every request. With placeholder Supabase keys the call fails silently and unauthenticated users hit public routes normally.
