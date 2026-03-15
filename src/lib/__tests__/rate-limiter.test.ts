import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, getOrgRateLimit, _resetForTesting } from "../rate-limiter";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request", () => {
    const result = checkRateLimit("test-1", 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("allows requests up to limit then blocks", () => {
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit("test-2", 10);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - i);
    }
    const blocked = checkRateLimit("test-2", 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-3", 5);
    }
    const blocked = checkRateLimit("test-3", 5);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(60001);

    const afterReset = checkRateLimit("test-3", 5);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(4);
  });

  it("returns correct resetMs", () => {
    checkRateLimit("test-4", 10, 60000);
    vi.advanceTimersByTime(20000);
    const result = checkRateLimit("test-4", 10, 60000);
    expect(result.resetMs).toBeCloseTo(40000, -2);
  });

  it("handles different keys independently", () => {
    checkRateLimit("org:A", 2);
    checkRateLimit("org:A", 2);
    const blockedA = checkRateLimit("org:A", 2);
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit("org:B", 2);
    expect(allowedB.allowed).toBe(true);
  });

  it("cleanup removes expired entries", () => {
    // Create entries that will expire
    for (let i = 0; i < 50; i++) {
      checkRateLimit(`cleanup-${i}`, 1000);
    }

    vi.advanceTimersByTime(130000); // Past 2x window

    // Trigger cleanup (every 100 calls)
    for (let i = 50; i < 150; i++) {
      checkRateLimit(`cleanup-new-${i}`, 1000);
    }

    // Old entries should have been cleaned up — verify by checking
    // that an old key starts fresh
    const result = checkRateLimit("cleanup-0", 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999);
  });

  it("handles zero limit", () => {
    // First call creates a new window (allowed), but remaining is -1
    const first = checkRateLimit("test-zero", 0);
    expect(first.remaining).toBeLessThan(0);
    // Second call is blocked
    const second = checkRateLimit("test-zero", 0);
    expect(second.allowed).toBe(false);
    expect(second.remaining).toBe(0);
  });

  it("handles custom window size", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-custom", 5, 1000);
    }
    const blocked = checkRateLimit("test-custom", 5, 1000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    const afterReset = checkRateLimit("test-custom", 5, 1000);
    expect(afterReset.allowed).toBe(true);
  });
});

describe("getOrgRateLimit", () => {
  it("returns correct limits per plan", () => {
    expect(getOrgRateLimit("free")).toBe(100);
    expect(getOrgRateLimit("pro")).toBe(500);
    expect(getOrgRateLimit("enterprise")).toBe(2000);
  });

  it("defaults to free for unknown plans", () => {
    expect(getOrgRateLimit("unknown")).toBe(100);
    expect(getOrgRateLimit("")).toBe(100);
  });
});
