# AI Workforce Manager

Management layer for AI agents — budget control, performance tracking, guardrails, and kill switches. Built as a multi-tenant SaaS.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Tailwind CSS v4 + shadcn/ui (base-nova style)
- **Database:** Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Charts:** Recharts
- **Payments:** Stripe
- **Email:** Resend
- **i18n:** English + German

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker (required by Supabase local development)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (local: `http://localhost:3000`) |
| `ENCRYPTION_KEY` | Yes | AES-256 key for provider API key encryption |
| `OPENAI_API_KEY` | No | Fallback OpenAI key (prefer DB providers) |
| `ANTHROPIC_API_KEY` | No | Fallback Anthropic key (prefer DB providers) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for billing |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | No | Stripe price ID for Pro plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | No | Stripe price ID for Enterprise plan |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `RESEND_FROM_EMAIL` | No | Sender email address |
| `INTERNAL_API_SECRET` | No | Secret for server-to-server API calls (alert emails, digest) |

Generate an encryption key:

```bash
openssl rand -hex 32
```

### 3. Start Supabase locally

```bash
supabase start
```

This prints your local `anon key` and `service_role key` — copy them into `.env.local`.

### 4. Run migrations and seed data

```bash
supabase db reset
```

This applies all migrations from `supabase/migrations/` and runs `supabase/seed.sql`, which creates:

- 1 demo organization ("Acme AI Corp")
- 3 teams with color/icon customization
- 6 agents across teams
- 530 tasks spread across 30 days
- 5 alerts (budget warnings, errors, kill-switch)
- Demo user: `demo@acme-ai.com` / `demo1234`

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with the demo credentials or create a new account.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run seed` | Reset DB and re-seed (`supabase db reset`) |

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup pages
│   ├── (dashboard)/     # Authenticated dashboard routes
│   │   ├── agents/      # Agent overview + detail pages
│   │   ├── teams/       # Team overview + detail pages
│   │   ├── budget/      # Budget overview + allocation
│   │   ├── analytics/   # Analytics dashboard (cost, performance, ROI)
│   │   ├── alerts/      # Alert management
│   │   ├── settings/    # Org settings, API keys, providers, integration
│   │   └── profile/     # User profile settings
│   ├── api/             # API routes (proxy, providers, keys, stripe, alerts)
│   ├── docs/            # Public help center
│   └── onboarding/      # Guided onboarding wizard
├── components/
│   ├── layout/          # Sidebar, header, breadcrumbs
│   ├── providers/       # Context providers (auth, org, theme, i18n)
│   ├── ui/              # shadcn/ui components
│   ├── agents/          # Agent-specific components
│   ├── teams/           # Team-specific components
│   └── landing/         # Landing page
├── hooks/               # Custom hooks (useRealtime)
├── i18n/                # Translations (en.json, de.json)
├── lib/                 # Utilities (supabase, stripe, crypto, email, rate-limiter)
└── types/               # TypeScript types
supabase/
├── migrations/          # SQL migrations (00001–00006)
└── seed.sql             # Demo data
```

## Key Features

- **Agent Management** — Create, configure, and monitor AI agents with guardrails
- **OpenAI-compatible Proxy** — `POST /api/v1/chat/completions` with budget enforcement, rate limiting, and token tracking
- **Budget Control** — Org, team, and per-agent budgets with real-time tracking and alerts
- **Kill Switch** — Emergency pause all agents, spike detection with auto-pause
- **Analytics & ROI** — Cost analysis, model comparison, per-agent ROI calculation
- **Real-time Updates** — Supabase Realtime for live alert counts, agent status changes
- **Multi-tenant** — RLS-enforced org isolation, org switcher, role-based access
- **Provider Management** — Store multiple LLM provider keys (encrypted), health checks, fallback
- **Stripe Billing** — Free / Pro / Enterprise plans with usage limits
- **Email Alerts** — Critical alert emails and daily digest via Resend
- **i18n** — English and German, extensible

## Stripe Setup (optional)

1. Create products and prices in the [Stripe Dashboard](https://dashboard.stripe.com)
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID` in `.env.local`
3. For local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. Set the webhook signing secret as `STRIPE_WEBHOOK_SECRET`

## Deployment

Deploy to [Vercel](https://vercel.com) with a hosted Supabase project:

1. Create a [Supabase project](https://supabase.com/dashboard)
2. Link locally: `supabase link --project-ref <ref>`
3. Push migrations: `supabase db push`
4. Set all environment variables in Vercel
5. Deploy: `vercel --prod`
