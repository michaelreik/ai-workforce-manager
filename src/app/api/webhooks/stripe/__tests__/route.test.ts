import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase
const mockQueryBuilder: Record<string, unknown> = {};
const methods = ["select", "insert", "update", "delete", "eq", "in", "gte", "order", "limit"];
for (const m of methods) {
  mockQueryBuilder[m] = vi.fn().mockReturnValue(mockQueryBuilder);
}
mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

const mockSupabase = {
  from: vi.fn(() => mockQueryBuilder),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase/service", () => ({
  createClient: () => mockSupabase,
}));

// Mock createAlert
const mockCreateAlert = vi.fn();
vi.mock("@/lib/alerts", () => ({
  createAlert: (...args: unknown[]) => mockCreateAlert(...args),
}));

// Mock Stripe
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
  PLANS: {
    free: { stripePriceId: null },
    pro: { stripePriceId: "price_pro" },
    enterprise: { stripePriceId: "price_ent" },
  },
}));

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  mockCreateAlert.mockReset();
  mockConstructEvent.mockReset();
  (mockQueryBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro";
  process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_ent";

  const mod = await import("../route");
  POST = mod.POST;
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

function createWebhookRequest(body = "{}") {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}

describe("Stripe webhook", () => {
  it("handles checkout.session.completed — updates org plan", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          customer: "cus_123",
          metadata: { org_id: "org-1", plan: "pro" },
        },
      },
    });

    const res = await POST(createWebhookRequest());
    expect(res.status).toBe(200);

    // Verify org plan update
    expect(mockSupabase.from).toHaveBeenCalledWith("organizations");
    expect(mockSupabase.from).toHaveBeenCalledWith("audit_log");
  });

  it("handles customer.subscription.updated — plan change", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_123",
          items: {
            data: [{ price: { id: "price_ent" } }],
          },
        },
      },
    });

    // Mock org lookup by stripe_customer_id
    (mockQueryBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: "org-1", plan: "pro" },
      error: null,
    });

    const res = await POST(createWebhookRequest());
    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith("organizations");
  });

  it("handles customer.subscription.deleted — downgrade to free", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: { customer: "cus_123" },
      },
    });

    (mockQueryBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: "org-1" },
      error: null,
    });

    const res = await POST(createWebhookRequest());
    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith("organizations");
    expect(mockSupabase.from).toHaveBeenCalledWith("audit_log");
  });

  it("handles invoice.payment_failed — creates critical alert", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: { customer: "cus_123" },
      },
    });

    (mockQueryBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: "org-1" },
      error: null,
    });

    const res = await POST(createWebhookRequest());
    expect(res.status).toBe(200);
    expect(mockCreateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        severity: "critical",
      })
    );
  });

  it("returns 400 for invalid webhook signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await POST(createWebhookRequest());
    expect(res.status).toBe(400);
  });

  it("returns 200 for unhandled event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });

    const res = await POST(createWebhookRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
