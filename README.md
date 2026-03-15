# OpenManage AI

> The management layer for AI agents and AI workforce governance. Budget control, performance tracking, kill switches, and workspace analytics — built for managers, not engineers.

[![CI](https://github.com/michaelreik/ai-workforce-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/michaelreik/ai-workforce-manager/actions/workflows/ci.yml)

## What is OpenManage AI?

OpenManage AI gives you full visibility and control over your organization's AI usage — both automated agents and human employees using tools like ChatGPT, Claude, and GitHub Copilot.

**For AI Agents:**
- 🔌 OpenAI-compatible proxy — change 2 lines of code to start tracking
- 💰 Budget control per agent, team, and organization
- 🛑 Kill switch & guardrails — stop runaway agents instantly
- 📊 ROI tracking — cost per lead, cost per article, real business metrics

**For Workspace Analytics:**
- 👥 Track AI usage across ChatGPT, Claude, Copilot, Cursor, and more
- 📈 Adoption dashboards — who uses what, how much, and for what
- 💡 Seat optimization — find unused licenses and save money
- 📋 Impact surveys — measure how AI affects productivity

## Features

| Feature | Description |
|---------|-------------|
| Agent Management | CRUD, status control, templates, team assignment |
| API Proxy | OpenAI-compatible, transparent, supports streaming |
| Budget Control | Per-agent, per-team, per-org with auto-pause |
| Kill Switch | Emergency stop, spike detection, guardrails |
| Analytics & ROI | Cost tracking, model comparison, optimization recommendations |
| Workspace Analytics | Unified dashboard for all AI tool usage |
| Team Management | Organize agents and members into teams |
| Provider Management | Multi-provider support with health checks and failover |
| Alert System | Real-time alerts, email notifications, daily digest |
| Impact Surveys | Customizable surveys to measure AI adoption impact |
| Seat Optimization | Detect unused/underutilized licenses, save costs |
| Adoption Playbook | Score, champions program, stage-based guidance |
| Multi-Tenant | Organization-scoped with RLS from day 1 |
| i18n | English + German |
| Payments | Stripe integration (Free / Pro / Enterprise) |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **Charts:** Recharts
- **Payments:** Stripe
- **Email:** Resend
- **Deployment:** Docker + Kubernetes

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase project ([supabase.com](https://supabase.com))
- npm

### Setup

```bash
# Clone
git clone https://github.com/michaelreik/ai-workforce-manager.git
cd ai-workforce-manager

# Install dependencies
npm ci

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations
npx supabase db push

# Seed demo data (optional)
npm run seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo login: `demo@acme-ai.com` / `demo1234`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `ENCRYPTION_KEY` | ✅ | AES-256 key for provider key encryption (`openssl rand -hex 32`) |
| `STRIPE_SECRET_KEY` | Optional | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook signing secret |
| `RESEND_API_KEY` | Optional | Resend API key for email notifications |
| `INTERNAL_API_SECRET` | Optional | Secret for internal API routes (cron, sync) |
| `CRON_SECRET` | Optional | Vercel Cron secret (auto-set by Vercel) |

## How the Proxy Works

```
Your Agent → OpenManage AI Proxy → LLM Provider (OpenAI, Anthropic)
               ↓
         Budget Check
         Rate Limiting
         Token Tracking
         Cost Recording
         Spike Detection
```

**Integration — 2 lines of code:**

```python
from openai import OpenAI

client = OpenAI(
    api_key="awm_sk_your_key_here",                    # ← OpenManage API key
    base_url="https://openmanage.ai/api/v1"            # ← Proxy URL
)

# Everything else stays the same
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup
│   ├── (dashboard)/         # Authenticated pages
│   │   ├── agents/          # Agent management
│   │   ├── teams/           # Team management
│   │   ├── budget/          # Budget allocation
│   │   ├── analytics/       # Agent analytics & ROI
│   │   ├── alerts/          # Alert management
│   │   ├── workspace/       # Workspace analytics
│   │   │   ├── analytics/   # Unified AI dashboard
│   │   │   ├── sources/     # Usage sources
│   │   │   ├── members/     # Employee directory
│   │   │   ├── surveys/     # Impact surveys
│   │   │   ├── optimization/# Seat optimization
│   │   │   └── adoption/    # Adoption playbook
│   │   ├── settings/        # Org settings, providers, API keys
│   │   └── profile/         # User profile
│   ├── api/
│   │   ├── v1/chat/completions/  # The proxy
│   │   ├── sync/            # Provider data sync
│   │   ├── providers/       # Provider management
│   │   └── webhooks/        # Stripe webhooks
│   ├── docs/                # Public help center
│   └── onboarding/          # Guided setup
├── components/              # React components
├── lib/
│   ├── sync/                # Provider sync framework
│   ├── crypto.ts            # AES-256-GCM encryption
│   ├── rate-limiter.ts      # In-memory rate limiting
│   ├── pricing.ts           # Model pricing table
│   └── supabase/            # Supabase clients
├── i18n/                    # Internationalization (EN + DE)
└── types/                   # TypeScript types
```

## Testing

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

86 tests across 6 suites: Pricing, Rate Limiter, Crypto, Proxy Route, Stripe Webhook, Provider Health.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete Kubernetes deployment guide.

```bash
# Docker build
docker build -t openmanage-ai .

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production v1.0.0
```

## Supported Models

| Model | Provider | Input ($/1M tokens) | Output ($/1M tokens) |
|-------|----------|---------------------|----------------------|
| gpt-4o | OpenAI | $2.50 | $10.00 |
| gpt-4o-mini | OpenAI | $0.15 | $0.60 |
| o3-mini | OpenAI | $1.10 | $4.40 |
| claude-opus | Anthropic | $15.00 | $75.00 |
| claude-sonnet | Anthropic | $3.00 | $15.00 |
| claude-haiku | Anthropic | $0.25 | $1.25 |
| gemini-pro | Google | $1.25 | $5.00 |
| gemini-flash | Google | $0.075 | $0.30 |

## License

Private — All rights reserved.

---

Built with 👻 by [OpenManage AI](https://openmanage.ai)
