import { describe, it, expect } from "vitest";
import { calculateCost, getProvider, MODEL_PRICING } from "../pricing";

describe("calculateCost", () => {
  it("calculates GPT-4o cost correctly", () => {
    const cost = calculateCost("gpt-4o", 1000, 500);
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  it("calculates GPT-4o-mini cost correctly", () => {
    const cost = calculateCost("gpt-4o-mini", 10000, 5000);
    expect(cost).toBeCloseTo(0.0045, 6);
  });

  it("calculates Claude Opus cost correctly (most expensive)", () => {
    const cost = calculateCost("claude-opus", 1000, 1000);
    expect(cost).toBeCloseTo(0.09, 6);
  });

  it("calculates Claude Haiku cost correctly (cheapest)", () => {
    const cost = calculateCost("claude-haiku", 100000, 50000);
    expect(cost).toBeCloseTo(0.0875, 6);
  });

  it("returns 0 for unknown model", () => {
    expect(calculateCost("nonexistent-model", 1000, 1000)).toBe(0);
  });

  it("handles zero tokens", () => {
    expect(calculateCost("gpt-4o", 0, 0)).toBe(0);
  });

  it("handles very large token counts (1M+ tokens)", () => {
    const cost = calculateCost("gpt-4o", 2000000, 1000000);
    expect(cost).toBeCloseTo(15, 4);
  });

  it.each(Object.keys(MODEL_PRICING))(
    "calculates positive cost for model %s with non-zero tokens",
    (model) => {
      const cost = calculateCost(model, 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    }
  );
});

describe("getProvider", () => {
  it("returns 'openai' for gpt models", () => {
    expect(getProvider("gpt-4o")).toBe("openai");
    expect(getProvider("gpt-4o-mini")).toBe("openai");
    expect(getProvider("o3-mini")).toBe("openai");
  });

  it("returns 'anthropic' for claude models", () => {
    expect(getProvider("claude-opus")).toBe("anthropic");
    expect(getProvider("claude-sonnet")).toBe("anthropic");
    expect(getProvider("claude-haiku")).toBe("anthropic");
  });

  it("returns 'google' for gemini models", () => {
    expect(getProvider("gemini-pro")).toBe("google");
    expect(getProvider("gemini-flash")).toBe("google");
  });

  it("returns null for unknown models", () => {
    expect(getProvider("unknown-model")).toBeNull();
    expect(getProvider("")).toBeNull();
  });
});

describe("MODEL_PRICING", () => {
  it("all models have positive pricing", () => {
    for (const [, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
    }
  });

  it("all models have a valid provider", () => {
    const validProviders = ["openai", "anthropic", "google"];
    for (const [, pricing] of Object.entries(MODEL_PRICING)) {
      expect(validProviders).toContain(pricing.provider);
    }
  });
});
