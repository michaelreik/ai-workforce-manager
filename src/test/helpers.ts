import crypto from 'crypto';

export function createTestApiKey() {
  const key = `awm_sk_test_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export function createMockSupabase() {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn(() => queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _queryBuilder: queryBuilder,
  };
}

export function createMockOrg(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Test Org',
    slug: 'test-org',
    plan: 'pro',
    stripe_customer_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAgent(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    org_id: crypto.randomUUID(),
    team_id: null,
    name: 'Test Agent',
    description: null,
    status: 'active',
    model: 'gpt-4o',
    fallback_model: null,
    tags: [],
    guardrails: {
      max_budget_daily: null,
      max_budget_monthly: 100,
      max_task_duration_seconds: null,
      max_tokens_per_request: null,
      spike_detection: false,
      auto_pause_on_budget: true,
      auto_downgrade_model: false,
      rate_limit_rpm: null,
    },
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockApiKey(overrides = {}) {
  const { key, hash, prefix } = createTestApiKey();
  return {
    data: {
      id: crypto.randomUUID(),
      org_id: crypto.randomUUID(),
      name: 'Test Key',
      key_hash: hash,
      key_prefix: prefix,
      agent_id: null,
      permissions: ['proxy'],
      last_used_at: null,
      expires_at: null,
      created_at: new Date().toISOString(),
      ...overrides,
    },
    key,
  };
}
