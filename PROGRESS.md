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

> **Phase 2 COMPLETE**

---

## Phase 3 — API Proxy Layer (Tag 6–8)

### Prompt 7 — Proxy API Route
- [x] `/api/v1/chat/completions` OpenAI-compatible proxy
- [x] API key authentication (SHA-256 hash lookup)
- [x] Budget checks before forwarding (daily + monthly)
- [x] Guardrail enforcement (token limits, budget limits)
- [x] Token usage tracking + cost calculation (model pricing table)
- [x] Model fallback on failure
- [x] Anthropic-to-OpenAI response format conversion
- [x] Budget threshold alerts (80% warning, 100% exceeded)
- [x] Auto-pause on budget exceeded (if guardrail enabled)

### Prompt 8 — API Key Management
- [x] `/settings/api-keys` page
- [x] Create/delete API keys
- [x] SHA-256 hashing, show key only once (reveal modal)
- [x] Scope to specific agent or all agents
- [x] Expiration options (never, 30d, 90d, 1y)

### Prompt 9 — Integration Guide
- [x] `/settings/integration` page with code snippets
- [x] Tabs: OpenAI Python, OpenAI TS, Anthropic, cURL, LangChain
- [x] Copy button on each snippet
- [x] Test Connection button

> **Phase 3 COMPLETE**

---

## Phase 4 — Budget & Token Control (Tag 9–11)

### Prompt 10 — Budget Overview
- [x] `/budget` page with summary cards (total monthly, total spent, remaining + days left, projected month-end)
- [x] Team budget cards (budget bar, agent count, top spender per team, unallocated budget)
- [x] Budget timeline chart (30-day cumulative spend area chart with budget limit reference line, Recharts)
- [x] Skeleton loading states
- [x] i18n support with interpolation (en + de)

### Prompt 11 — Budget Allocation
- [ ] `/budget/allocate` page
- [ ] Editable team/agent budgets
- [ ] Real-time unallocated budget calculation

### Prompt 12 — Kill Switch & Controls
- [x] Quick Controls section on dashboard (live at-risk agents: >90% budget or error state)
  - [x] Pause/Resume buttons per agent
  - [x] Link to agent detail page
- [x] Guardrail enforcement in proxy (budget checks, auto-pause on exceeded — done in Phase 3)
- [ ] "Emergency: Pause All Agents" button
- [ ] Spike detection (cost > 3x rolling average → auto-pause + alert)

---

## Phase 5 — Analytics & ROI (Tag 12–14)

### Prompt 13 — Analytics Dashboard
- [x] `/analytics` with tabbed layout (Cost, Performance, Models, ROI, Recommendations)
- [x] Cost Overview: KPI cards (total, change, avg/task, most expensive), daily cost line chart with anomaly highlighting
- [x] Agent Performance: horizontal bar chart + sortable table (tasks, success rate, avg cost, duration, cost/unit)
- [x] Model Comparison: bar chart + stats table, savings insights for expensive models
- [x] Date range picker (7d / 30d / 90d)
- [x] All charts with Recharts

### Prompt 14 — ROI Calculator
- [x] ROI section on analytics page (tab)
- [x] Per-agent ROI cards: output units, cost, revenue value, cost/unit, ROI %
- [x] Overall summary: total revenue, total cost, overall ROI
- [x] Star performers highlight (top 3 by ROI)
- [x] Reads output_value and output_unit_name from agent metadata

### Prompt 15 — Optimization Recommendations
- [x] Rule-based recommendations (model downgrade, cost increase, error rate, team budget, idle agents)
- [x] Actionable cards with severity icons, impact text, and "View Agent" / "View Budget" links
- [x] Sorted by severity (critical → warning → info)

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
