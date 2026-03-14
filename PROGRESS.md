# AI Workforce Manager — Progress Tracker

> Based on [ai-workforce-manager-plan.md](../ai-workforce-manager-plan.md)

---

## Phase 1 — Foundation & Auth & Multi-Tenant (Tag 1–2)

### Prompt 1 — Projekt-Setup
- [x] Next.js 16 app with App Router, TypeScript, Tailwind CSS v4
- [x] shadcn/ui setup (base-nova style, 17 components installed)
- [x] Supabase client with environment variables
- [x] Dark-mode dashboard layout
  - [x] Collapsible sidebar (Dashboard, Agents, Budget, Analytics, Alerts, Settings)
  - [x] Top header bar (org name, daily budget, active agent count, alerts bell with badge — all live from Supabase)
  - [x] Main content area with breadcrumbs
  - [x] User avatar dropdown (Profile, Org Settings, Logout)
- [x] i18n infrastructure (English + German, extensible)

### Prompt 2 — Auth & Multi-Tenant
- [x] Supabase Auth with email/password
- [x] Login page
- [x] Signup page
- [x] Auto-create organization on signup (name + slug)
- [x] Organization context provider (React context)
  - [x] Fetches user's orgs from Supabase on mount (org_members + organizations join)
  - [x] Auto-selects org from localStorage or falls back to first org
  - [x] Exposes orgs list, loading state, refreshOrgs(), and user role per org
  - [x] Listens to auth state changes (re-fetches on sign-in, clears on sign-out)
- [x] Middleware redirects unauthenticated users to /login
- [x] RLS policies on all tables scoped to org_id via `user_org_ids()`
- [ ] Organization switcher in sidebar (for users in multiple orgs)

### Prompt 3 — Seed Data
- [x] Seed script with demo data
- [x] 1 Organization "Acme AI Corp"
- [x] 3 Teams: Lead Generation, Content, Customer Support
- [x] 6 Agents across teams with varied statuses/budgets
- [x] 530 tasks spread across last 30 days
- [x] 5 alerts (budget warnings, errors, kill-switch)
- [x] `npm run seed` command
- [x] Demo user: `demo@acme-ai.com` / `demo1234`

### Phase 1 Checklist
- [x] App runs locally (`npm run dev`)
- [x] Login/Signup works (Supabase Auth)
- [x] Dashboard shell with navigation
- [x] Multi-Tenant with RLS
- [x] Build passes (`npm run build`)
- [x] Git repo connected & pushed
- [x] Demo data for development

> **Phase 1 COMPLETE** — Only the org switcher (Prompt 2) is deferred to later.

### Dashboard Page (wired up)
- [x] KPI cards with live Supabase data (daily spend, active agents, monthly budget, alerts)
- [x] Quick Controls section showing at-risk agents (>90% budget or error state)
- [x] Pause/Resume per agent, link to agent detail
- [x] Skeleton loading states

---

## Phase 2 — Agent Management (Tag 3–5)

### Prompt 4 — Agent Overview Page
- [x] `/agents` page with responsive card grid
- [x] Agent cards (name, status badge, team, model, budget bar, stats)
- [x] Search bar + filters (status, team, model)
- [x] "Add Agent" button

### Prompt 5 — Agent Detail Page
- [x] `/agents/[id]` with tabs (Overview, Task History, Guardrails, Audit Log)
- [x] Budget gauge, metrics row, cost chart
- [x] Task history table with pagination
- [x] Guardrails configuration form
- [x] Audit log timeline
- [x] Action buttons (Pause/Resume, Kill Switch, Edit, Delete)

### Prompt 6 — Add/Edit Agent Modal
- [x] Modal dialog for agent CRUD
- [x] Form validation (name + model required)
- [x] Guardrail presets (Conservative, Standard, Aggressive, Custom)
- [x] Creates agent with guardrails on save

---

## Phase 3 — API Proxy Layer (Tag 6–8)

### Prompt 7 — Proxy API Route
- [ ] `/api/v1/chat/completions` OpenAI-compatible proxy
- [ ] API key authentication
- [ ] Budget checks before forwarding
- [ ] Guardrail enforcement
- [ ] Token usage tracking + cost calculation
- [ ] Model fallback on failure

### Prompt 8 — API Key Management
- [ ] `/settings/api-keys` page
- [ ] Create/delete/rotate API keys
- [ ] SHA-256 hashing, show key only once

### Prompt 9 — Integration Guide
- [ ] `/settings/integration` page with code snippets
- [ ] Tabs: OpenAI Python, OpenAI TS, Anthropic, cURL, LangChain
- [ ] Test Connection button

---

## Phase 4 — Budget & Token Control (Tag 9–11)

### Prompt 10 — Budget Overview
- [ ] `/budget` page with summary cards
- [ ] Team budget cards
- [ ] Budget timeline chart (daily cumulative vs budget line)

### Prompt 11 — Budget Allocation
- [ ] `/budget/allocate` page
- [ ] Editable team/agent budgets
- [ ] Real-time unallocated budget calculation

### Prompt 12 — Kill Switch & Controls
- [x] Quick Controls section on dashboard (live at-risk agents: >90% budget + error state)
  - [x] Pause/Resume buttons per agent
  - [x] Link to agent detail page
- [ ] "Emergency: Pause All Agents" button
- [ ] Guardrail enforcement function (spike detection, auto-pause)

---

## Phase 5 — Analytics & ROI (Tag 12–14)

### Prompt 13 — Analytics Dashboard
- [ ] `/analytics` with cost overview, agent performance, model comparison
- [ ] Charts with Recharts
- [ ] Date range picker

### Prompt 14 — ROI Calculator
- [ ] Per-agent output value/unit configuration
- [ ] ROI section on analytics page

### Prompt 15 — Optimization Recommendations
- [ ] Rule-based recommendations (model downgrade, cost increase, error rate, idle agents)
- [ ] Actionable cards with "Take Action" buttons

---

## Phase 6 — Realtime & Alerts (Tag 15–16)

### Prompt 16 — Realtime Updates
- [ ] Supabase Realtime subscriptions
- [ ] Live status badges, budget numbers, alert counts
- [ ] `useRealtimeSubscription` hook
- [ ] "Live" indicator + reconnection fallback

### Prompt 17 — Alert System
- [ ] Alert bell dropdown in header
- [ ] `/alerts` page with filters + bulk actions
- [ ] Alert creation logic (budget, errors, loops, kill-switch)
- [ ] Email notifications via Resend
- [ ] Toast notifications for critical alerts

---

## Phase 7 — Polish, Payments & Landing Page (Tag 17–20)

### Prompt 18 — Organization Settings
- [ ] `/settings` tabs: General, Members, Billing, Notifications
- [ ] Invite members, change roles
- [ ] Provider API key management

### Prompt 19 — Stripe Integration
- [ ] Stripe Checkout for plan upgrades
- [ ] Webhook endpoint for subscription events
- [ ] Plan limit enforcement

### Prompt 20 — Landing Page
- [ ] Public landing page at `/`
- [ ] Hero, Problem, Analogy, Features, Pricing, CTA sections
- [ ] Framer Motion animations

### Prompt 21 — Onboarding Flow
- [ ] 6-step guided onboarding after signup
- [ ] Progress bar, skip button
- [ ] Checklist banner on dashboard until complete
