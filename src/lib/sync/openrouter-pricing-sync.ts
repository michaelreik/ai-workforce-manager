import type { SupabaseClient } from "@supabase/supabase-js";

const OPENROUTER_API = "https://openrouter.ai/api/v1/models";

// Only sync models from these providers
const ALLOWED_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "google",
  "xai",
  "meta",
  "microsoft",
  "deepseek",
  "mistralai",
]);

type OpenRouterModel = {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
};

type SyncResult = {
  synced: number;
  skipped: number;
  errors: string[];
};

/**
 * Extract a short model ID from OpenRouter's full ID.
 * e.g. "openai/gpt-4o" → "gpt-4o", "anthropic/claude-3.5-sonnet" → "claude-3.5-sonnet"
 */
function toShortId(openrouterId: string): string {
  const parts = openrouterId.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : openrouterId;
}

/**
 * Extract provider from OpenRouter model ID.
 * e.g. "openai/gpt-4o" → "openai"
 */
function extractProvider(openrouterId: string): string {
  return openrouterId.split("/")[0] || "unknown";
}

/**
 * Convert per-token price string to per-1M-tokens number.
 * OpenRouter: "0.0000025" (per token) → 2.5 (per 1M tokens)
 */
function toPerMillion(perTokenStr: string): number {
  const perToken = parseFloat(perTokenStr);
  if (isNaN(perToken) || perToken <= 0) return 0;
  return perToken * 1_000_000;
}

/**
 * Syncs model pricing from OpenRouter's public API.
 * Upserts into model_pricing table.
 * Skips models marked as is_custom (admin overrides).
 */
export async function syncOpenRouterPricing(
  supabase: SupabaseClient
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] };

  // 1. Fetch models from OpenRouter
  let models: OpenRouterModel[];
  try {
    const res = await fetch(OPENROUTER_API);
    if (!res.ok) {
      throw new Error(`OpenRouter API returned ${res.status}`);
    }
    const data = (await res.json()) as { data: OpenRouterModel[] };
    models = data.data || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fetch failed: ${msg}`);
    return result;
  }

  // 2. Get existing custom models (don't overwrite these)
  const { data: customModels } = await supabase
    .from("model_pricing")
    .select("id")
    .eq("is_custom", true);

  const customIds = new Set((customModels || []).map((m) => m.id));

  // 3. Filter and transform
  const now = new Date().toISOString();
  const upsertRows: Array<{
    id: string;
    name: string;
    provider: string;
    input_price: number;
    output_price: number;
    context_length: number | null;
    openrouter_id: string;
    is_available: boolean;
    is_custom: boolean;
    last_synced_at: string;
  }> = [];

  for (const model of models) {
    const provider = extractProvider(model.id);

    // Skip providers we don't care about
    if (!ALLOWED_PROVIDERS.has(provider)) {
      result.skipped++;
      continue;
    }

    // Skip free models (price = 0)
    const inputPrice = toPerMillion(model.pricing?.prompt || "0");
    const outputPrice = toPerMillion(model.pricing?.completion || "0");
    if (inputPrice === 0 && outputPrice === 0) {
      result.skipped++;
      continue;
    }

    const shortId = toShortId(model.id);

    // Skip admin-overridden models
    if (customIds.has(shortId)) {
      result.skipped++;
      continue;
    }

    upsertRows.push({
      id: shortId,
      name: model.name || shortId,
      provider,
      input_price: inputPrice,
      output_price: outputPrice,
      context_length: model.context_length || null,
      openrouter_id: model.id,
      is_available: true,
      is_custom: false,
      last_synced_at: now,
    });
  }

  // 4. Upsert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < upsertRows.length; i += batchSize) {
    const batch = upsertRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("model_pricing")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      result.errors.push(`Batch ${i / batchSize}: ${error.message}`);
    } else {
      result.synced += batch.length;
    }
  }

  return result;
}
