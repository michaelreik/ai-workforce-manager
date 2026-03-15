import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase server client
const mockQueryBuilder: Record<string, unknown> = {};
const methods = ["select", "insert", "update", "delete", "eq", "in", "gte", "order", "limit"];
for (const m of methods) {
  mockQueryBuilder[m] = vi.fn().mockReturnValue(mockQueryBuilder);
}
mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

const mockSupabase = {
  from: vi.fn(() => mockQueryBuilder),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
    }),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

// Mock Supabase service client (for health status update)
vi.mock("@/lib/supabase/service", () => ({
  createClient: () => ({
    from: vi.fn(() => mockQueryBuilder),
  }),
}));

// Track fetch calls
const originalFetch = globalThis.fetch;
let mockFetchHandler: ((url: string) => Promise<Response>) | null = null;

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  (mockQueryBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "test@test.com" } },
  });

  process.env.ENCRYPTION_KEY = "test-key-for-health-tests-1234567890";

  globalThis.fetch = vi.fn(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (mockFetchHandler) return mockFetchHandler(url);
    return new Response("", { status: 200 });
  }) as typeof fetch;

  const mod = await import("../route");
  POST = mod.POST;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mockFetchHandler = null;
  delete process.env.ENCRYPTION_KEY;
});

function createHealthRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/providers/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Provider health check", () => {
  it("returns healthy for OpenAI when list models succeeds", async () => {
    mockFetchHandler = async (url) => {
      if (url.includes("openai.com/v1/models")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response("", { status: 404 });
    };

    const req = createHealthRequest({
      provider_type: "openai",
      api_key: "sk-test",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.latencyMs).toBeDefined();
  });

  it("returns down for OpenAI when API returns 401", async () => {
    mockFetchHandler = async (url) => {
      if (url.includes("openai")) {
        return new Response(JSON.stringify({ error: "Invalid key" }), { status: 401 });
      }
      return new Response("", { status: 404 });
    };

    const req = createHealthRequest({
      provider_type: "openai",
      api_key: "sk-invalid",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.status).toBe("down");
    expect(body.message).toContain("Invalid");
  });

  it("returns healthy for Anthropic when test message succeeds", async () => {
    mockFetchHandler = async (url) => {
      if (url.includes("anthropic")) {
        return new Response(
          JSON.stringify({ content: [{ type: "text", text: "hi" }] }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    };

    const req = createHealthRequest({
      provider_type: "anthropic",
      api_key: "sk-ant-test",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  it("returns healthy for Anthropic on 429 (rate limited but key valid)", async () => {
    mockFetchHandler = async (url) => {
      if (url.includes("anthropic")) {
        return new Response("Rate limited", { status: 429 });
      }
      return new Response("", { status: 404 });
    };

    const req = createHealthRequest({
      provider_type: "anthropic",
      api_key: "sk-ant-test",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  it("decrypts API key when testing existing provider", async () => {
    // Encrypt a key
    const { encrypt } = await import("@/lib/crypto");
    const encrypted = encrypt("sk-real-key");

    (mockQueryBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: "prov-1",
        provider_type: "openai",
        api_key_encrypted: encrypted,
        base_url: null,
      },
      error: null,
    });

    let capturedAuth = "";
    mockFetchHandler = async (url) => {
      // Capture what key was sent to OpenAI
      capturedAuth = url;
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    };

    // Override fetch to capture headers
    globalThis.fetch = vi.fn(async (input, init) => {
      const headers = init?.headers as Record<string, string>;
      capturedAuth = headers?.Authorization || headers?.["api-key"] || "";
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as typeof fetch;

    const req = createHealthRequest({ provider_id: "prov-1" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // The decrypted key should have been used, not the encrypted blob
    expect(capturedAuth).toBe("Bearer sk-real-key");
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const req = createHealthRequest({
      provider_type: "openai",
      api_key: "sk-test",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
