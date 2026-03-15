import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageSource } from "@/types/database";
import { ProviderSync, type UsageRecord, type UserRecord } from "./base-sync";

/**
 * Anthropic Admin API sync — currently limited.
 * Anthropic's admin/usage API is more restricted than OpenAI's.
 * This is a stub that can be expanded as the API evolves.
 */
export class AnthropicSyncProvider extends ProviderSync {
  private apiKey: string;

  constructor(supabase: SupabaseClient, source: UsageSource) {
    super(supabase, source);
    const config = source.config as Record<string, string>;
    this.apiKey = config.admin_api_key || "";
  }

  async fetchUsers(): Promise<UserRecord[]> {
    // Anthropic doesn't currently expose a user listing API
    // Users need to be added manually or via CSV
    return [];
  }

  async fetchUsageData(
    startDate: string,
    endDate: string
  ): Promise<UsageRecord[]> {
    // Anthropic usage data is limited — try the usage endpoint if available
    try {
      const res = await fetch("https://api.anthropic.com/v1/usage", {
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });

      if (!res.ok) {
        // Expected: Anthropic may not expose this endpoint yet
        console.warn("Anthropic usage API not available:", res.status);
        return [];
      }

      const data = await res.json();
      // Map whatever structure Anthropic returns
      return ((data.usage || []) as Array<{
        date?: string;
        input_tokens?: number;
        output_tokens?: number;
        cost?: number;
        model?: string;
      }>)
        .filter((d) => {
          const date = d.date || "";
          return date >= startDate && date <= endDate;
        })
        .map((d) => ({
          email: "__aggregate__",
          date: d.date || new Date().toISOString().split("T")[0],
          messages_count: 0,
          conversations_count: 0,
          tokens_used: (d.input_tokens || 0) + (d.output_tokens || 0),
          cost: d.cost || 0,
          models_used: d.model ? [d.model] : [],
          task_categories: {},
        }));
    } catch {
      return [];
    }
  }
}
