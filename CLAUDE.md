# AI Workforce Manager

## Project Overview
OpenManage AI — management layer for AI agents and AI workforce governance. Budget control, performance tracking, kill switches, workspace analytics, and seat optimization. Built as a multi-tenant SaaS.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: Tailwind CSS v4 + shadcn/ui (base-nova style, base-ui primitives)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Charts**: Recharts
- **State**: Zustand
- **i18n**: Custom lightweight solution (see `src/i18n/`)
- **Validation**: Zod
- **Testing**: Vitest + Testing Library + MSW
- **Deployment**: Docker + Kubernetes (GKE) + GitHub Actions CI/CD
- **Payments**: Stripe
- **Email**: Resend

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run test` — Run all tests (86 tests, 6 suites)
- `npm run test:watch` — Watch mode
- `npm run test:coverage` — With coverage report

## Important Conventions

### shadcn/ui (base-nova / base-ui)
- Components use `render` prop for composition, NOT `asChild`
- Example: `<SidebarMenuButton render={<Link href="/foo" />}>` instead of `asChild`
- Button component is from `@base-ui/react/button`

### Multi-Tenant
- Every data table has `org_id` column
- RLS policies enforce org scoping via `user_org_ids()` helper function
- Always filter by `org_id` in queries

### i18n
- Messages in `src/i18n/messages/{locale}.json`
- Use `useTranslations(namespace)` hook in client components
- Currently: English (en) and German (de)
- Default locale: English
- All user-facing text must have keys in both locale files

### Database Migrations
- Migration files in `supabase/migrations/` with sequential numbering: `00001_`, `00002_`, etc.
- Always include RLS policies for new tables (use `user_org_ids()`)
- Always add `org_id` column to new tables
- Add `updated_at` triggers where appropriate
- Use `SECURITY DEFINER` for RPC functions that need to bypass RLS

### Security
- Provider API keys are encrypted with AES-256-GCM before storing in DB (`src/lib/crypto.ts`)
- `decrypt()` handles un-encrypted strings (migration period fallback)
- Requires `ENCRYPTION_KEY` env var (generate with: `openssl rand -hex 32`)
- API routes that modify data must verify org membership
- API keys for the proxy use SHA-256 hashing (never store raw keys)

### Testing
- Test files: `src/lib/__tests__/` and co-located `__tests__/` directories
- Mock factories in `src/test/helpers.ts` (createMockOrg, createMockAgent, createMockApiKey)
- MSW for external API mocking (`src/test/mocks/`)
- Real implementations for pricing, rate-limiter, crypto (no mocks for these)
- `src/test/` and `**/*.test.{ts,tsx}` are excluded from tsconfig to avoid build errors

## File Structure
```
src/
├── app/
│   ├── (auth)/                 # Login, signup
│   ├── (dashboard)/            # Authenticated pages
│   │   ├── agents/             # Agent management (CRUD, detail, guardrails)
│   │   ├── teams/              # Team management
│   │   ├── budget/             # Budget overview + allocation
│   │   ├── analytics/          # Agent analytics, ROI, recommendations
│   │   ├── alerts/             # Alert management
│   │   ├── workspace/          # Workspace analytics
│   │   │   ├── analytics/      # Unified AI usage dashboard
│   │   │   ├── sources/        # Usage data sources (API sync, CSV, manual)
│   │   │   ├── members/        # Employee directory
│   │   │   ├── surveys/        # Impact surveys + results
│   │   │   ├── import/         # CSV import
│   │   │   ├── optimization/   # Seat optimization engine
│   │   │   └── adoption/       # AI adoption playbook
│   │   ├── settings/           # Org settings, providers, API keys, integration
│   │   └── profile/            # User profile
│   ├── api/
│   │   ├── v1/chat/completions/ # OpenAI-compatible proxy (core product)
│   │   ├── sync/               # Provider data sync (cron + manual)
│   │   ├── providers/          # Provider management + health checks
│   │   ├── stripe/             # Stripe checkout + portal
│   │   ├── alerts/             # Alert notifications + digest
│   │   └── webhooks/           # Stripe webhooks
│   ├── docs/                   # Public help center
│   └── onboarding/             # Guided setup wizard
├── components/
│   ├── layout/                 # Sidebar, header, breadcrumbs
│   ├── providers/              # Context providers (org, auth)
│   ├── ui/                     # shadcn/ui components
│   ├── agents/                 # Agent-specific components
│   └── teams/                  # Team-specific components
├── lib/
│   ├── sync/                   # Provider sync framework (base + OpenAI + GitHub Copilot + Anthropic)
│   ├── crypto.ts               # AES-256-GCM encryption
│   ├── rate-limiter.ts         # In-memory sliding window rate limiter
│   ├── pricing.ts              # Model pricing table + cost calculation
│   ├── alerts.ts               # Alert creation helper
│   ├── email.ts                # Resend email client + templates
│   ├── stripe.ts               # Stripe client + plan config
│   └── supabase/               # Supabase client helpers (browser + server + service)
├── hooks/                      # Custom hooks (use-realtime, etc.)
├── i18n/                       # Translation system + locale files
├── test/                       # Test infrastructure, helpers, MSW mocks
└── types/                      # TypeScript types (database.ts)
```

## Architecture — Core Proxy Flow
```
Agent/Client → POST /api/v1/chat/completions (Bearer: awm_sk_...)
  → Auth (SHA-256 key lookup)
  → Rate limit check (org-level + agent-level)
  → Budget check (daily + monthly)
  → Guardrails check (max tokens, agent status)
  → Forward to LLM provider (OpenAI/Anthropic/Google, keys from DB or env)
  → Track usage (tokens, cost, duration → tasks table)
  → Update budgets (atomic RPC: increment_budget_spent)
  → Spike detection (3x rolling avg → auto-pause)
  → Return response (OpenAI format, even for Anthropic)
```

## Deployment
- **Staging**: https://staging.openmanage.ai — auto-deploys on push to `main`
- **Production**: https://openmanage.ai — manual trigger via GitHub Actions
- **Docker**: Multi-stage build with `output: "standalone"`
- **K8s**: Staging (2-5 replicas) + Production (3-20 replicas) with HPA
- See `DEPLOYMENT.md` for full ops guide

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` — AES-256 key for provider API key encryption (generate: `openssl rand -hex 32`)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID`
- `RESEND_API_KEY` (optional) / `INTERNAL_API_SECRET` (optional)
- `CRON_SECRET` — Vercel/K8s cron secret for scheduled sync
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (optional fallback, prefer DB providers)

## Remaining Work (V3)
- [ ] Survey taking UI — public-facing page for employees to fill out surveys (email link / in-app)
- [ ] Plan gate enforcement — restrict Workspace features to Pro+/Enterprise plans
- [ ] SCIM integration — auto-sync members from Azure AD, Okta, Google Workspace
- [ ] Workspace Assistants UI — manage/track custom GPTs and bots (table exists, no UI yet)
