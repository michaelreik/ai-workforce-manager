# AI Workforce Manager

## Project Overview
Management layer for AI agents — budget control, performance tracking, guardrails, and kill switches. Built as a multi-tenant SaaS.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: Tailwind CSS v4 + shadcn/ui (base-nova style, base-ui primitives)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Charts**: Recharts
- **State**: Zustand
- **i18n**: Custom lightweight solution (see `src/i18n/`)
- **Validation**: Zod

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

### File Structure
- `src/app/(dashboard)/` — authenticated dashboard routes
- `src/app/(auth)/` — login/signup pages
- `src/components/layout/` — sidebar, header, breadcrumbs
- `src/components/providers/` — context providers
- `src/components/ui/` — shadcn/ui components
- `src/lib/supabase/` — Supabase client helpers
- `src/types/` — TypeScript types
- `supabase/migrations/` — SQL migration files

### Security
- Provider API keys are encrypted with AES-256-GCM before storing in DB (`src/lib/crypto.ts`)
- `decrypt()` handles un-encrypted strings (migration period fallback)
- Requires `ENCRYPTION_KEY` env var (generate with: `openssl rand -hex 32`)

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` — AES-256 key for provider API key encryption (generate: `openssl rand -hex 32`)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID`
- `RESEND_API_KEY` (optional) / `INTERNAL_API_SECRET` (optional)
- `CRON_SECRET` — Vercel Cron secret for scheduled sync (auto-set by Vercel)
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (optional fallback, prefer DB providers)

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
