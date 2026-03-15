import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { _resetForTesting } from "@/lib/rate-limiter";

// --- Mock Supabase ---

let mockQueryResults: Record<string, unknown> = {};

function setQueryResult(table: string, method: string, result: unknown) {
  mockQueryResults[`${table}.${method}`] = result;
}

function getQueryResult(table: string, method: string) {
  return (
    mockQueryResults[`${table}.${method}`] ??
    mockQueryResults[`${table}.default`] ?? { data: null, error: null }
  );
}

const createMockQueryBuilder = (table: string) => {
  const builder: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "in",
    "gte",
    "lt",
    "order",
    "limit",
  ];
  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => getQueryResult(table, "single"));
  builder.then = vi.fn().mockImplementation((cb) => {
    const result = getQueryResult(table, "single");
    return Promise.resolve(cb ? cb(result) : result);
  });
  return builder;
};

const mockSupabase = {
  from: vi.fn((table: string) => createMockQueryBuilder(table)),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase/service", () => ({
  createClient: () => mockSupabase,
}));

// --- Mock createAlert (spy on calls without real email) ---
const mockCreateAlert = vi.fn();
vi.mock("@/lib/alerts", () => ({
  createAlert: (...args: unknown[]) => mockCreateAlert(...args),
}));

// --- Mock fetch for provider APIs ---
const originalFetch = globalThis.fetch;
let mockFetchHandler: ((url: string, init?: RequestInit) => Promise<Response>) | null = null;

// --- Helpers ---

function createApiKeyAndHash() {
  const key = `awm_sk_test_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, hash };
}

function createProxyRequest(
  body: Record<string, unknown>,
  apiKey: string
): NextRequest {
  return new NextRequest("http://localhost/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

const DEFAULT_AGENT = {
  id: "agent-1",
  org_id: "org-1",
  team_id: null,
  name: "Test Agent",
  status: "active",
  model: "gpt-4o",
  fallback_model: null,
  guardrails: {
    max_budget_daily: null,
    max_budget_monthly: null,
    max_task_duration_seconds: null,
    max_tokens_per_request: null,
    spike_detection: false,
    auto_pause_on_budget: true,
    auto_downgrade_model: false,
    rate_limit_rpm: null,
  },
  metadata: {},
};

const OPENAI_RESPONSE = {
  id: "chatcmpl-test",
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
};

function setupDefaultMocks(apiKeyHash: string) {
  // api_keys lookup
  setQueryResult("api_keys", "single", {
    data: {
      id: "key-1",
      org_id: "org-1",
      agent_id: null,
      key_hash: apiKeyHash,
      permissions: ["proxy"],
      expires_at: null,
    },
    error: null,
  });

  // agents lookup
  setQueryResult("agents", "single", {
    data: DEFAULT_AGENT,
    error: null,
  });

  // org plan
  setQueryResult("organizations", "single", {
    data: { plan: "pro" },
    error: null,
  });

  // budget entries
  setQueryResult("budget_entries", "single", {
    data: [],
    error: null,
  });

  // tasks count for plan limit
  setQueryResult("tasks", "single", {
    data: null,
    error: null,
    count: 0,
  });

  // providers (no DB provider)
  setQueryResult("providers", "single", {
    data: null,
    error: { code: "PGRST116" },
  });
}

// --- Import POST handler ---
let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  mockQueryResults = {};
  mockCreateAlert.mockReset();
  _resetForTesting();

  // Set env vars
  process.env.ENCRYPTION_KEY = "test-encryption-key-1234567890";
  process.env.OPENAI_API_KEY = "sk-test-openai";
  process.env.ANTHROPIC_API_KEY = "sk-test-anthropic";

  // Mock fetch for provider APIs
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();

    if (mockFetchHandler) {
      return mockFetchHandler(url, init as RequestInit);
    }

    // Default: OpenAI success
    if (url.includes("api.openai.com")) {
      return new Response(JSON.stringify(OPENAI_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default: Anthropic success
    if (url.includes("api.anthropic.com")) {
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Hello!" }],
          usage: { input_tokens: 100, output_tokens: 50 },
          stop_reason: "end_turn",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404 });
  }) as typeof fetch;

  // Dynamic import to pick up mocks
  const mod = await import("../route");
  POST = mod.POST;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mockFetchHandler = null;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

// ========== Authentication Tests ==========

describe("authentication", () => {
  it("returns 401 without Authorization header", async () => {
    const req = new NextRequest("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid API key", async () => {
    setQueryResult("api_keys", "single", { data: null, error: { code: "PGRST116" } });

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      "awm_sk_invalid_key"
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with expired API key", async () => {
    const { key, hash } = createApiKeyAndHash();
    setQueryResult("api_keys", "single", {
      data: {
        id: "key-1",
        org_id: "org-1",
        agent_id: null,
        key_hash: hash,
        permissions: ["proxy"],
        expires_at: "2020-01-01T00:00:00Z", // expired
      },
      error: null,
    });

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toContain("expired");
  });
});

// ========== Agent Resolution Tests ==========

describe("agent resolution", () => {
  it("returns 404 when no active agent found", async () => {
    const { key, hash } = createApiKeyAndHash();
    setQueryResult("api_keys", "single", {
      data: { id: "key-1", org_id: "org-1", agent_id: null, key_hash: hash, permissions: ["proxy"], expires_at: null },
      error: null,
    });
    setQueryResult("agents", "single", { data: null, error: { code: "PGRST116" } });

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 429 when agent is paused", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);
    setQueryResult("agents", "single", {
      data: { ...DEFAULT_AGENT, status: "paused" },
      error: null,
    });

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.message).toContain("paused");
  });
});

// ========== Guardrail Tests ==========

describe("guardrails", () => {
  it("returns 429 when max_tokens_per_request exceeded", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);
    setQueryResult("agents", "single", {
      data: {
        ...DEFAULT_AGENT,
        guardrails: { ...DEFAULT_AGENT.guardrails, max_tokens_per_request: 1000 },
      },
      error: null,
    });

    const req = createProxyRequest(
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 2000,
      },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.type).toBe("guardrail_error");
  });
});

// ========== Request Validation Tests ==========

describe("request validation", () => {
  it("returns 400 for invalid JSON body", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    const req = new NextRequest("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: "not-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when model field is missing", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    const req = createProxyRequest(
      { messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("model");
  });
});

// ========== Forwarding Tests ==========

describe("forwarding", () => {
  it("forwards to OpenAI for gpt models and returns response", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.choices).toBeDefined();
    expect(body.choices[0].message.content).toBe("Hello!");
  });

  it("forwards to Anthropic for claude models and converts response", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);
    setQueryResult("agents", "single", {
      data: { ...DEFAULT_AGENT, model: "claude-sonnet" },
      error: null,
    });

    const req = createProxyRequest(
      { model: "claude-sonnet", messages: [{ role: "user", content: "Hello" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should be converted to OpenAI format
    expect(body.choices).toBeDefined();
    expect(body.usage).toBeDefined();
  });

  it("returns 502 when provider is unreachable", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    mockFetchHandler = async () => {
      throw new Error("Network error");
    };

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("returns provider error status when provider returns non-200", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    mockFetchHandler = async (url) => {
      if (url.includes("openai")) {
        return new Response(JSON.stringify({ error: { message: "Server error" } }), {
          status: 500,
        });
      }
      return new Response("", { status: 404 });
    };

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ========== Provider Key Resolution Tests ==========

describe("provider key resolution", () => {
  it("falls back to env var when no DB provider exists", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    let capturedAuth = "";
    mockFetchHandler = async (url, init) => {
      if (url.includes("openai")) {
        capturedAuth = (init?.headers as Record<string, string>)?.Authorization || "";
        return new Response(JSON.stringify(OPENAI_RESPONSE), { status: 200 });
      }
      return new Response("", { status: 404 });
    };

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    await POST(req);
    expect(capturedAuth).toBe("Bearer sk-test-openai");
  });

  it("returns 500 when no key available (DB or env)", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);
    delete process.env.OPENAI_API_KEY;

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.type).toBe("config_error");
  });
});

// ========== Rate Limiting Tests ==========

describe("rate limiting", () => {
  it("returns 429 with headers when org rate limit exceeded", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    // Free plan = 100 rpm. Make 100 allowed calls to exhaust limit
    // Since rate limiter is real (not mocked), we need to exhaust it
    setQueryResult("organizations", "single", {
      data: { plan: "free" },
      error: null,
    });

    // Exhaust the org rate limit by calling checkRateLimit directly
    const { checkRateLimit: rl } = await import("@/lib/rate-limiter");
    for (let i = 0; i < 100; i++) {
      rl(`org:org-1`, 100, 60000);
    }

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
  });
});

// ========== Usage Recording Tests ==========

describe("usage recording", () => {
  it("records task via supabase after successful response", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify tasks insert was called
    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
  });

  it("calls budget RPC after successful response", async () => {
    const { key, hash } = createApiKeyAndHash();
    setupDefaultMocks(hash);

    const req = createProxyRequest(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      key
    );
    await POST(req);

    // Verify budget RPCs were called
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "increment_budget_spent",
      expect.objectContaining({
        p_org_id: "org-1",
        p_agent_id: "agent-1",
      })
    );
  });
});
