import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelPricingRecord } from "@/types/database";

// Static fallback pricing per 1M tokens (USD)
// Used when DB is unavailable or empty
export type ModelPricing = {
  input: number; // per 1M input tokens
  output: number; // per 1M output tokens
  provider: "openai" | "anthropic" | "google";
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { input: 2.5, output: 10, provider: "openai" },
  "gpt-4o-mini": { input: 0.15, output: 0.6, provider: "openai" },
  "o3-mini": { input: 1.1, output: 4.4, provider: "openai" },
  "claude-opus": { input: 15, output: 75, provider: "anthropic" },
  "claude-sonnet": { input: 3, output: 15, provider: "anthropic" },
  "claude-haiku": { input: 0.25, output: 1.25, provider: "anthropic" },
  "gemini-pro": { input: 1.25, output: 5, provider: "google" },
  "gemini-flash": { input: 0.075, output: 0.3, provider: "google" },
};

/**
 * Calculate cost using static fallback pricing.
 * Use calculateCostFromDb() for accurate DB-based pricing.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

/**
 * Get provider from static fallback.
 * Use getProviderFromDb() for DB-based lookup.
 */
export function getProvider(
  model: string
): "openai" | "anthropic" | "google" | null {
  const pricing = MODEL_PRICING[model];
  return pricing?.provider ?? null;
}

// --- DB-based pricing functions ---

// In-memory cache to avoid repeated DB queries within a request lifecycle
let pricingCache: { data: Map<string, ModelPricingRecord>; expiry: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all model pricing from DB with in-memory cache.
 * Falls back to static MODEL_PRICING if DB is empty or unavailable.
 */
export async function getModelPricingMap(
  supabase: SupabaseClient
): Promise<Map<string, ModelPricingRecord>> {
  // Check cache
  if (pricingCache && Date.now() < pricingCache.expiry) {
    return pricingCache.data;
  }

  try {
    const { data, error } = await supabase
      .from("model_pricing")
      .select("*")
      .order("provider")
      .order("name");

    if (error || !data || data.length === 0) {
      // Return static fallback as ModelPricingRecord format
      return staticFallbackMap();
    }

    const map = new Map<string, ModelPricingRecord>();
    for (const row of data as ModelPricingRecord[]) {
      map.set(row.id, row);
    }

    pricingCache = { data: map, expiry: Date.now() + CACHE_TTL_MS };
    return map;
  } catch {
    return staticFallbackMap();
  }
}

/**
 * Get only available models from DB.
 */
export async function getAvailableModels(
  supabase: SupabaseClient
): Promise<ModelPricingRecord[]> {
  try {
    const { data, error } = await supabase
      .from("model_pricing")
      .select("*")
      .eq("is_available", true)
      .order("provider")
      .order("name");

    if (error || !data || data.length === 0) {
      return Array.from(staticFallbackMap().values());
    }

    return data as ModelPricingRecord[];
  } catch {
    return Array.from(staticFallbackMap().values());
  }
}

/**
 * Calculate cost using DB pricing, falling back to static.
 */
export async function calculateCostFromDb(
  supabase: SupabaseClient,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const map = await getModelPricingMap(supabase);
  const pricing = map.get(model);

  if (pricing) {
    return (
      (inputTokens / 1_000_000) * Number(pricing.input_price) +
      (outputTokens / 1_000_000) * Number(pricing.output_price)
    );
  }

  // Fallback to static
  return calculateCost(model, inputTokens, outputTokens);
}

/**
 * Get provider from DB pricing, falling back to static.
 */
export async function getProviderFromDb(
  supabase: SupabaseClient,
  model: string
): Promise<string | null> {
  const map = await getModelPricingMap(supabase);
  const pricing = map.get(model);

  if (pricing) return pricing.provider;
  return getProvider(model);
}

/**
 * Invalidate the in-memory pricing cache.
 * Call after a sync or admin update.
 */
export function invalidatePricingCache(): void {
  pricingCache = null;
}

// --- Internal helpers ---

function staticFallbackMap(): Map<string, ModelPricingRecord> {
  const map = new Map<string, ModelPricingRecord>();
  const now = new Date().toISOString();

  for (const [id, pricing] of Object.entries(MODEL_PRICING)) {
    map.set(id, {
      id,
      name: id,
      provider: pricing.provider,
      input_price: pricing.input,
      output_price: pricing.output,
      context_length: null,
      openrouter_id: null,
      is_available: true,
      is_custom: false,
      last_synced_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  return map;
}
