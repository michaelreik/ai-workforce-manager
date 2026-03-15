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
- [x] Organization switcher in sidebar (dropdown, only shows when user has multiple orgs)

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

> **Phase 1 COMPLETE**

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
- [x] `/budget/allocate` page
- [x] Editable team budgets (proportionally distributes to agents)
- [x] Expandable teams → editable per-agent budgets
- [x] Real-time org total / allocated / unallocated summary bar
- [x] Over-allocated warning badge
- [x] "changed" badge on modified agents
- [x] Save → upserts budget_entries + updates team budget_monthly + audit log
- [x] "Allocate Budget" button on budget overview page linking to allocate page

### Prompt 12 — Kill Switch & Controls
- [x] Quick Controls section on dashboard (live at-risk agents: >90% budget or error state)
  - [x] Pause/Resume buttons per agent
  - [x] Link to agent detail page
- [x] Guardrail enforcement in proxy (budget checks, auto-pause on exceeded — done in Phase 3)
- [x] "Emergency: Pause All Agents" button (with confirmation, audit log entry)
- [x] Spike detection (cost > 3x rolling average → auto-pause + alert + audit log)

> **Phase 4 COMPLETE**

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

> **Phase 5 COMPLETE**

---

## Phase 6 — Realtime & Alerts (Tag 15–16)

### Prompt 16 — Realtime Updates
- [x] `useRealtime` hook (`src/hooks/use-realtime.ts`)
  - [x] Generic hook for subscribing to any table's postgres_changes
  - [x] Supports INSERT, UPDATE, DELETE, or * events
  - [x] Optional filter (e.g. `org_id=eq.xxx`)
  - [x] Returns connection status (connecting/connected/disconnected)
  - [x] Stable callback refs to avoid re-subscriptions
  - [x] Automatic cleanup on unmount
- [x] Header: live alert count (increments on new alerts, decrements on acknowledge)
- [x] Header: live active agent count (re-fetches on agent status change)
- [x] Alerts page: new alerts appear in real-time without refresh
- [x] Alerts page: status updates reflected in real-time
- [x] "Live" indicator (green dot next to org name, tooltip shows connection status)
- [x] Reconnection fallback with polling (30s interval via `onPollFallback` callback when disconnected)

### Prompt 17 — Alert System
- [x] Alert bell dropdown in header:
  - [x] Shows latest 8 unacknowledged alerts with severity icons and relative time
  - [x] Acknowledge button per alert directly from dropdown
  - [x] Unread count badge (caps at 99+)
  - [x] Empty state when no alerts
  - [x] "View All Alerts" link to /alerts page
- [x] `/alerts` page with full functionality:
  - [x] Summary cards (total, unacknowledged, critical, resolved) — clickable as quick filters
  - [x] Filterable by severity (all/critical/warning/info) and status (all/unacknowledged/acknowledged/resolved)
  - [x] Table with severity badge, type, message, agent link, relative time, status
  - [x] Per-row actions: acknowledge, resolve, view agent
  - [x] Bulk actions: select via checkboxes, acknowledge/resolve selected
  - [x] Pagination (20 per page)
  - [x] Empty state with helpful description
  - [x] Unacknowledged rows highlighted
- [x] Alert creation logic (budget warnings, exceeded, error spike, kill-switch — in proxy, Phase 3)
- [x] Toast notifications for critical alerts (via Realtime + Sonner, with "View" action button)
- [x] Email notifications via Resend:
  - [x] `src/lib/email.ts` — Resend client with lazy init, HTML email templates
  - [x] `POST /api/alerts/notify` — sends critical alert emails to org admins/owners
  - [x] `POST /api/alerts/digest` — daily digest email (for cron job) with KPIs, alerts, top spender
  - [x] `src/lib/alerts.ts` — `createAlert()` helper that inserts alert + fires email for critical alerts
  - [x] Proxy updated to use `createAlert()` for all 5 alert insertion points
  - [x] Graceful fallback when RESEND_API_KEY is not set (logs warning, skips email)
  - Requires env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `INTERNAL_API_SECRET`

> **Phase 6 COMPLETE**

---

## Phase 7 — Polish, Payments & Landing Page (Tag 17–20)

### Prompt 18 — Organization Settings
- [x] `/settings` page with tabbed layout (General, Members, Billing, Notifications)
- [x] General tab:
  - [x] Editable org name and slug
  - [x] Current plan badge with plan description
  - [x] Quick links to API Keys and Integration sub-pages
  - [x] Danger zone with delete organization (contact support)
- [x] Members tab:
  - [x] Invite member form (email + role selector)
  - [x] Members table with role, joined date
  - [x] Inline role change (dropdown: Viewer, Manager, Admin)
  - [x] Remove member with confirmation
  - [x] Role permissions reference card (Owner, Admin, Manager, Viewer)
- [x] Billing tab:
  - [x] Current plan display with feature limits (agents, requests, teams)
  - [x] Upgrade button (disabled, Stripe coming soon)
- [x] Notifications tab:
  - [x] Toggle switches for: Critical alerts, Warning alerts, Info alerts, Daily digest
  - [x] Save preferences button
- [x] Full i18n (en + de)

### Prompt 19 — Stripe Integration
- [x] `src/lib/stripe.ts` — Stripe client (lazy init), plan config with limits
- [x] `POST /api/stripe/checkout` — creates Checkout session for Pro/Enterprise upgrades
  - [x] Creates/reuses Stripe customer, stores `stripe_customer_id` on org
  - [x] Success/cancel redirects back to billing tab
- [x] `POST /api/stripe/portal` — creates Customer Portal session for managing subscription
- [x] `POST /api/webhooks/stripe` — handles subscription lifecycle events:
  - [x] `checkout.session.completed` → update org plan + audit log
  - [x] `customer.subscription.updated` → plan change detection + audit log
  - [x] `customer.subscription.deleted` → downgrade to free + audit log
  - [x] `invoice.payment_failed` → critical alert to org admins
- [x] Plan limit enforcement in proxy (request count per month, 429 on limit)
- [x] Billing tab updated: upgrade buttons, manage billing link, pricing comparison cards
- [x] i18n keys (en + de)
- Requires env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`

### Prompt 20 — Landing Page
- [x] Public landing page at `/`
- [x] Sticky nav with scroll blur effect
- [x] Hero section with gradient background, headline, CTAs, and dashboard mockup
- [x] Problem section (runaway costs, resource conflicts, wasted spend)
- [x] Analogy section (managing people vs managing AI agents — comparison table)
- [x] Features section (Workforce Overview, Budget Control, ROI Tracking, Kill Switch)
- [x] Social proof quote
- [x] ROI example card (Lead Generator: 340 leads, $0.37/lead, 13,286% ROI)
- [x] Pricing section (Free / Pro $49 / Enterprise $199)
- [x] CTA section + footer
- [x] Scroll-triggered fade-in animations (IntersectionObserver, no Framer Motion needed)
- [x] Authenticated users redirected to /dashboard
- [x] Dark mode, responsive design

### Prompt 21 — Onboarding Flow
- [x] 6-step guided onboarding at `/onboarding`:
  - [x] Step 1: Name your organization (pre-filled, editable name + slug)
  - [x] Step 2: Create your first team
  - [x] Step 3: Add your first agent (name + model selector)
  - [x] Step 4: Connect LLM provider (OpenAI/Anthropic key validation)
  - [x] Step 5: Integration snippet (Python code example)
  - [x] Step 6: "You're all set!" completion screen
- [x] Visual progress bar with step icons and connector lines
- [x] Skip button on every step + skip-all option
- [x] Signup redirects to `/onboarding` instead of `/dashboard`
- [x] Onboarding checklist banner on dashboard:
  - [x] Checks actual data (teams, agents, API keys exist)
  - [x] Progress bar + clickable checklist items linking to relevant pages
  - [x] Auto-dismisses when all steps complete
  - [x] Dismissible via X button (persists in localStorage)

> **Phase 7 COMPLETE** — All 21 prompts implemented. MVP is launch-ready.

---

## V2 — Team Management

### Prompt 22 — Full Team Management
- [x] Database migration (`00002_team_management.sql`):
  - [x] `color`, `icon`, `lead_user_id`, `updated_at` columns on `teams`
  - [x] `team_members` table with role constraint (`member`/`lead`), unique(team_id, user_id)
  - [x] Indexes on `team_members(team_id)`, `team_members(user_id)`, `teams(lead_user_id)`
  - [x] RLS policy on `team_members` via `user_org_ids()`
  - [x] `updated_at` trigger on teams
- [x] TypeScript types: extended `Team` type, added `TeamMember` type
- [x] i18n: `teams` namespace (~50 keys) in EN + DE, `teams` key in `nav` namespace
- [x] Sidebar: `Teams` nav item (Users icon) between Agents and Budget
- [x] Team Card component (`src/components/teams/team-card.tsx`):
  - [x] Color accent bar, icon, name, description, lead name, agent count, budget progress bar
  - [x] Edit and View Details action buttons
- [x] Team Form Modal (`src/components/teams/team-form-modal.tsx`):
  - [x] Name (required), description, icon picker (12 emojis), color picker (8 presets)
  - [x] Monthly budget input, team lead select (from org members)
  - [x] Create and edit modes
- [x] Teams overview page (`/teams`):
  - [x] Search filter, responsive card grid, skeleton loading, empty state
  - [x] Create/Edit via modal, delete with name-confirmation dialog
  - [x] Audit log entries on create/edit/delete
- [x] Team detail page (`/teams/[id]`):
  - [x] Header with back button, color bar, icon, name, edit/delete actions
  - [x] Stats row: 4 cards (agents, budget, spent, success rate)
  - [x] Agents tab: agent cards grid, add agent dialog (unassigned agents), remove from team
  - [x] Members tab: member list with role badges, add/remove members
  - [x] Budget tab: 30-day cumulative spend area chart (Recharts) with budget limit reference line
  - [x] Activity tab: audit log timeline (reuses `AgentAuditLogTab`)
- [x] Seed data updated: team `color`, `icon`, `lead_user_id`; `team_members` rows
- [x] Build passes (`npm run build`)

### Prompt 23 — User Profile Settings
- [x] Database migration (`00003_user_profiles.sql`):
  - [x] `user_profiles` table: display_name, avatar_url, timezone, theme, two_factor_enabled, notification_prefs (JSONB)
  - [x] RLS policy: users can only manage their own profile
  - [x] `updated_at` trigger
- [x] TypeScript type: `UserProfile`
- [x] i18n: `profile` namespace (~45 keys) in EN + DE, `profile` key in `nav` namespace
- [x] Profile page (`/profile`) with sections:
  - [x] Personal Info: avatar display, display name, email (read-only)
  - [x] Appearance: theme picker (dark/light/system) with live apply, timezone selector (15 common zones)
  - [x] Security: 2FA status badge (UI ready, enable/disable disabled — coming soon), password change form with validation
  - [x] Notification Preferences: 4 toggles (critical, warning, info, digest) with descriptions
  - [x] Data & Privacy: GDPR data export request button, delete account button (disabled, contact support)
- [x] Header: "Profile" link now points to `/profile` instead of `/settings`
- [x] Breadcrumbs: added `profile` and `teams` to nav keys
- [x] Seed data: demo user profile with timezone and notification prefs
- [x] Build passes (`npm run build`)

### Prompt 25 (partial) — Contextual Help & Empty States
- [x] `HelpTooltip` component (`src/components/ui/help-tooltip.tsx`):
  - [x] Reusable `?` icon with tooltip content and optional "Learn more" link
  - [x] Uses Radix Tooltip via shadcn/ui
- [x] `EmptyState` component (`src/components/ui/empty-state.tsx`):
  - [x] Reusable empty state with icon, title, description, primary/secondary action buttons
- [x] Contextual help tooltips added to:
  - [x] Guardrails: Budget Limits, Execution Limits, Automation sections
  - [x] Dashboard: Quick Controls / Kill Switch section
  - [x] Budget: Team Budgets section, Timeline chart
- [x] i18n help text keys (en + de) for all tooltips
