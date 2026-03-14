// Model pricing per 1M tokens (USD)
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

export function getProvider(model: string): "openai" | "anthropic" | "google" | null {
  const pricing = MODEL_PRICING[model];
  return pricing?.provider ?? null;
}
