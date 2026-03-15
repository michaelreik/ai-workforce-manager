type WindowEntry = { count: number; windowStart: number };

const store = new Map<string, WindowEntry>();
let cleanupCounter = 0;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();

  // Periodic cleanup of expired entries (every 100 calls)
  if (++cleanupCounter % 100 === 0) {
    for (const [k, v] of store) {
      if (now - v.windowStart > windowMs * 2) store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (entry.count >= limit) {
    const resetMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.count++;
  const resetMs = windowMs - (now - entry.windowStart);
  return { allowed: true, remaining: limit - entry.count, resetMs };
}

export function _resetForTesting() {
  store.clear();
  cleanupCounter = 0;
}

export function getOrgRateLimit(plan: string): number {
  switch (plan) {
    case "enterprise":
      return 2000;
    case "pro":
      return 500;
    default:
      return 100; // free
  }
}
