-- AI Workforce Manager — Seed Data
-- Generates realistic demo data for development

-- ============================================================
-- 1. Create a demo user in auth.users
-- ============================================================
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@acme-ai.com',
  crypt('demo1234', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"email": "demo@acme-ai.com"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'demo@acme-ai.com',
  jsonb_build_object('sub', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'email', 'demo@acme-ai.com'),
  'email',
  now(),
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Organization
-- ============================================================
INSERT INTO organizations (id, name, slug, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme AI Corp', 'acme-ai', 'pro');

-- ============================================================
-- 3. Org Member (demo user as owner)
-- ============================================================
INSERT INTO org_members (org_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'owner');

-- ============================================================
-- 4. Teams
-- ============================================================
INSERT INTO teams (id, org_id, name, budget_monthly, description, color, icon, lead_user_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Lead Generation', 500.00, 'Automated lead generation and qualification pipeline', '#6366f1', '🎯', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Content', 350.00, 'Blog posts, social media, and marketing content creation', '#ec4899', '✍️', NULL),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Customer Support', 250.00, 'Ticket handling, email responses, and FAQ updates', '#10b981', '💬', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- ============================================================
-- 5. Agents
-- ============================================================
INSERT INTO agents (id, org_id, team_id, name, description, status, model, fallback_model, tags, guardrails, metadata) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Lead Generator',
    'Scrapes and enriches B2B leads from multiple sources',
    'active',
    'gpt-4o',
    'gpt-4o-mini',
    ARRAY['sales', 'scraping', 'b2b'],
    '{"max_budget_daily": 25, "max_budget_monthly": 350, "max_task_duration_seconds": 120, "max_tokens_per_request": 4096, "spike_detection": true, "auto_pause_on_budget": true, "auto_downgrade_model": true}'::jsonb,
    '{"output_value": 50, "output_unit": "Leads"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Lead Qualifier',
    'Scores and qualifies incoming leads using AI analysis',
    'active',
    'claude-sonnet',
    'claude-haiku',
    ARRAY['sales', 'scoring', 'qualification'],
    '{"max_budget_daily": 15, "max_budget_monthly": 200, "max_task_duration_seconds": 60, "max_tokens_per_request": 2048, "spike_detection": true, "auto_pause_on_budget": true, "auto_downgrade_model": false}'::jsonb,
    '{"output_value": 30, "output_unit": "Qualified Leads"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'Content Writer',
    'Generates blog posts and marketing copy',
    'active',
    'gpt-4o',
    'gpt-4o-mini',
    ARRAY['content', 'blog', 'marketing'],
    '{"max_budget_daily": 20, "max_budget_monthly": 300, "max_task_duration_seconds": 300, "max_tokens_per_request": 8192, "spike_detection": true, "auto_pause_on_budget": true, "auto_downgrade_model": false}'::jsonb,
    '{"output_value": 10, "output_unit": "Articles"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'Research Agent',
    'Deep research on industry topics for content strategy',
    'paused',
    'o3-mini',
    NULL,
    ARRAY['research', 'analysis'],
    '{"max_budget_daily": 10, "max_budget_monthly": 100, "max_task_duration_seconds": 180, "max_tokens_per_request": 4096, "spike_detection": false, "auto_pause_on_budget": true, "auto_downgrade_model": false}'::jsonb,
    '{"output_value": 5, "output_unit": "Reports"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Support Bot',
    'Handles tier-1 customer support tickets automatically',
    'active',
    'claude-haiku',
    NULL,
    ARRAY['support', 'tickets', 'customer'],
    '{"max_budget_daily": 10, "max_budget_monthly": 150, "max_task_duration_seconds": 30, "max_tokens_per_request": 1024, "spike_detection": true, "auto_pause_on_budget": true, "auto_downgrade_model": false}'::jsonb,
    '{"output_value": 8, "output_unit": "Tickets Resolved"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Email Responder',
    'Drafts and sends email responses to customer inquiries',
    'error',
    'gpt-4o-mini',
    NULL,
    ARRAY['support', 'email', 'drafting'],
    '{"max_budget_daily": 8, "max_budget_monthly": 100, "max_task_duration_seconds": 45, "max_tokens_per_request": 2048, "spike_detection": false, "auto_pause_on_budget": true, "auto_downgrade_model": false}'::jsonb,
    '{"output_value": 5, "output_unit": "Emails Sent"}'::jsonb
  );

-- ============================================================
-- 6. Tasks (500+ across last 30 days)
-- ============================================================
-- Use generate_series to create realistic task data

-- Lead Generator tasks (~120 tasks, active, good performance)
INSERT INTO tasks (org_id, agent_id, status, model_used, tokens_input, tokens_output, cost, duration_ms, task_type, result_quality, output_units, metadata, started_at, finished_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  CASE WHEN random() < 0.92 THEN 'completed' WHEN random() < 0.97 THEN 'failed' ELSE 'completed' END,
  CASE WHEN random() < 0.85 THEN 'gpt-4o' ELSE 'gpt-4o-mini' END,
  (800 + floor(random() * 1200))::int,
  (200 + floor(random() * 800))::int,
  (0.005 + random() * 0.025)::decimal(10,6),
  (1500 + floor(random() * 8000))::int,
  'lead_gen',
  (0.70 + random() * 0.30)::decimal(3,2),
  CASE WHEN random() < 0.92 THEN (1 + floor(random() * 4))::int ELSE 0 END,
  '{}'::jsonb,
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 12)::int),
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 12)::int) + (interval '1 second' * (1.5 + random() * 8))
FROM generate_series(1, 120);

-- Lead Qualifier tasks (~90 tasks)
INSERT INTO tasks (org_id, agent_id, status, model_used, tokens_input, tokens_output, cost, duration_ms, task_type, result_quality, output_units, metadata, started_at, finished_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  CASE WHEN random() < 0.95 THEN 'completed' ELSE 'failed' END,
  'claude-sonnet',
  (500 + floor(random() * 1000))::int,
  (100 + floor(random() * 500))::int,
  (0.003 + random() * 0.015)::decimal(10,6),
  (800 + floor(random() * 4000))::int,
  'lead_gen',
  (0.75 + random() * 0.25)::decimal(3,2),
  CASE WHEN random() < 0.95 THEN 1 ELSE 0 END,
  '{}'::jsonb,
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 14)::int),
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 14)::int) + (interval '1 second' * (0.8 + random() * 4))
FROM generate_series(1, 90);

-- Content Writer tasks (~80 tasks, high cost, near budget limit)
INSERT INTO tasks (org_id, agent_id, status, model_used, tokens_input, tokens_output, cost, duration_ms, task_type, result_quality, output_units, metadata, started_at, finished_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  CASE WHEN random() < 0.88 THEN 'completed' WHEN random() < 0.95 THEN 'failed' ELSE 'completed' END,
  'gpt-4o',
  (2000 + floor(random() * 3000))::int,
  (1500 + floor(random() * 4000))::int,
  (0.02 + random() * 0.06)::decimal(10,6),
  (5000 + floor(random() * 25000))::int,
  'content',
  (0.65 + random() * 0.35)::decimal(3,2),
  CASE WHEN random() < 0.88 THEN 1 ELSE 0 END,
  '{}'::jsonb,
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 10)::int),
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 10)::int) + (interval '1 second' * (5 + random() * 25))
FROM generate_series(1, 80);

-- Research Agent tasks (~40 tasks, stopped mid-month due to budget)
INSERT INTO tasks (org_id, agent_id, status, model_used, tokens_input, tokens_output, cost, duration_ms, task_type, result_quality, output_units, metadata, started_at, finished_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000004',
  CASE WHEN random() < 0.85 THEN 'completed' WHEN random() < 0.90 THEN 'failed' ELSE 'killed' END,
  'o3-mini',
  (1000 + floor(random() * 2000))::int,
  (500 + floor(random() * 2000))::int,
  (0.004 + random() * 0.02)::decimal(10,6),
  (3000 + floor(random() * 15000))::int,
  'research',
  (0.60 + random() * 0.40)::decimal(3,2),
  CASE WHEN random() < 0.85 THEN 1 ELSE 0 END,
  '{}'::jsonb,
  now() - (interval '1 day' * (15 + (random() * 15)::int)) - (interval '1 hour' * (random() * 8)::int),
  now() - (interval '1 day' * (15 + (random() * 15)::int)) - (interval '1 hour' * (random() * 8)::int) + (interval '1 second' * (3 + random() * 15))
FROM generate_series(1, 40);

-- Support Bot tasks (~150 tasks, high volume, low cost)
INSERT INTO tasks (org_id, agent_id, status, model_used, tokens_input, tokens_output, cost, duration_ms, task_type, result_quality, output_units, metadata, started_at, finished_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  CASE WHEN random() < 0.94 THEN 'completed' ELSE 'failed' END,
  'claude-haiku',
  (200 + floor(random() * 600))::int,
  (100 + floor(random() * 400))::int,
  (0.0002 + random() * 0.002)::decimal(10,6),
  (400 + floor(random() * 2000))::int,
  'support',
  (0.72 + random() * 0.28)::decimal(3,2),
  CASE WHEN random() < 0.94 THEN 1 ELSE 0 END,
  '{}'::jsonb,
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 16)::int),
  now() - (interval '1 day' * (random() * 30)::int) - (interval '1 hour' * (random() * 16)::int) + (interval '1 second' * (0.4 + random() * 2))
FROM generate_series(1, 150);

-- Email Responder tasks (~50 tasks, some recent failures causing error state)
INSERT INTO tasks (org_id, agent_id, status, model_used, tokens_input, tokens_output, cost, duration_ms, task_type, result_quality, output_units, error_message, metadata, started_at, finished_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000006',
  CASE
    WHEN s <= 35 THEN (CASE WHEN random() < 0.90 THEN 'completed' ELSE 'failed' END)
    ELSE (CASE WHEN random() < 0.30 THEN 'completed' ELSE 'failed' END)
  END,
  'gpt-4o-mini',
  (300 + floor(random() * 800))::int,
  (150 + floor(random() * 600))::int,
  (0.0003 + random() * 0.003)::decimal(10,6),
  (600 + floor(random() * 3000))::int,
  'support',
  CASE
    WHEN s <= 35 THEN (0.70 + random() * 0.30)::decimal(3,2)
    ELSE (0.20 + random() * 0.40)::decimal(3,2)
  END,
  CASE
    WHEN s <= 35 THEN (CASE WHEN random() < 0.90 THEN 1 ELSE 0 END)
    ELSE (CASE WHEN random() < 0.30 THEN 1 ELSE 0 END)
  END,
  CASE
    WHEN s > 35 AND random() > 0.30 THEN 'Rate limit exceeded: 429 Too Many Requests from upstream provider'
    ELSE NULL
  END,
  '{}'::jsonb,
  now() - (interval '1 day' * CASE WHEN s <= 35 THEN (5 + (random() * 25)::int) ELSE ((random() * 4)::int) END) - (interval '1 hour' * (random() * 12)::int),
  now() - (interval '1 day' * CASE WHEN s <= 35 THEN (5 + (random() * 25)::int) ELSE ((random() * 4)::int) END) - (interval '1 hour' * (random() * 12)::int) + (interval '1 second' * (0.6 + random() * 3))
FROM generate_series(1, 50) AS s;

-- ============================================================
-- 7. Budget Entries (monthly for current month)
-- ============================================================
INSERT INTO budget_entries (org_id, agent_id, team_id, period_type, period_start, allocated, spent) VALUES
  -- Lead Generator: 65% budget used
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'monthly', date_trunc('month', now())::date, 350.00, 227.50),
  -- Lead Qualifier: 40% budget used
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'monthly', date_trunc('month', now())::date, 200.00, 80.00),
  -- Content Writer: 95% budget used — near limit!
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'monthly', date_trunc('month', now())::date, 300.00, 285.00),
  -- Research Agent: 100% budget — paused
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'monthly', date_trunc('month', now())::date, 100.00, 100.00),
  -- Support Bot: 20% budget used
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'monthly', date_trunc('month', now())::date, 150.00, 30.00),
  -- Email Responder: 55% budget used (but in error state)
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'monthly', date_trunc('month', now())::date, 100.00, 55.00);

-- Daily budget entries for today
INSERT INTO budget_entries (org_id, agent_id, team_id, period_type, period_start, allocated, spent) VALUES
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'daily', now()::date, 25.00, 16.25),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'daily', now()::date, 15.00, 6.00),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'daily', now()::date, 20.00, 19.00),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'daily', now()::date, 10.00, 1.25);

-- ============================================================
-- 8. Alerts
-- ============================================================
INSERT INTO alerts (org_id, agent_id, type, severity, message, acknowledged, resolved, created_at) VALUES
  -- Critical: Content Writer near budget limit
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'budget_warning', 'critical', 'Content Writer has used 95% of its monthly budget ($285 / $300). Auto-pause will trigger at 100%.', false, false, now() - interval '2 hours'),
  -- Warning: Research Agent hit budget limit and was paused
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'budget_exceeded', 'critical', 'Research Agent exceeded monthly budget ($100 / $100). Agent has been auto-paused.', true, true, now() - interval '5 days'),
  -- Error: Email Responder rate limit
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', 'error_spike', 'critical', 'Email Responder error rate exceeded 30% in the last hour (70% failure rate). Agent needs attention.', false, false, now() - interval '45 minutes'),
  -- Warning: Lead Generator daily spike
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'budget_warning', 'warning', 'Lead Generator daily spend is 65% of daily budget at 2pm. Projected to exceed by end of day.', true, false, now() - interval '3 hours'),
  -- Kill switch event on Research Agent
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'kill_switch', 'critical', 'Kill switch activated for Research Agent. Budget guardrail triggered automatic shutdown.', true, true, now() - interval '5 days' + interval '10 minutes');

-- ============================================================
-- 9. Audit Log
-- ============================================================
INSERT INTO audit_log (org_id, user_id, action, target_type, target_id, details, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'agent_paused', 'agent', '20000000-0000-0000-0000-000000000004', '{"reason": "budget_exceeded", "budget_spent": 100.00, "budget_limit": 100.00}'::jsonb, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'kill_switch', 'agent', '20000000-0000-0000-0000-000000000004', '{"reason": "manual", "triggered_by": "guardrail"}'::jsonb, now() - interval '5 days' + interval '10 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'budget_changed', 'agent', '20000000-0000-0000-0000-000000000003', '{"field": "max_budget_monthly", "old_value": 250, "new_value": 300}'::jsonb, now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'model_changed', 'agent', '20000000-0000-0000-0000-000000000001', '{"old_model": "gpt-4o-mini", "new_model": "gpt-4o", "reason": "quality improvement"}'::jsonb, now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'agent_resumed', 'agent', '20000000-0000-0000-0000-000000000005', '{"reason": "manual"}'::jsonb, now() - interval '8 days');

-- ============================================================
-- 10. Team Members
-- ============================================================
INSERT INTO team_members (team_id, user_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'lead'),
  ('10000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'lead');
