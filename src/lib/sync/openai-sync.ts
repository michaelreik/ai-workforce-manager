import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageSource } from "@/types/database";
import { ProviderSync, type UsageRecord, type UserRecord } from "./base-sync";

/**
 * Syncs usage data from OpenAI's Admin API.
 * Requires an Organization Admin API key.
 *
 * Endpoints:
 * - GET /v1/organization/users
 * - GET /v1/organization/usage (aggregated usage)
 * - GET /v1/organization/costs (cost breakdown)
 */
export class OpenAISyncProvider extends ProviderSync {
  private apiKey: string;
  private baseUrl: string;

  constructor(supabase: SupabaseClient, source: UsageSource) {
    super(supabase, source);
    const config = source.config as Record<string, string>;
    this.apiKey = config.admin_api_key || "";
    this.baseUrl = config.base_url || "https://api.openai.com";
  }

  private async fetchAPI(path: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 200)}`);
    }

    return res.json();
  }

  async fetchUsers(): Promise<UserRecord[]> {
    try {
      const data = await this.fetchAPI("/v1/organization/users", {
        limit: "100",
      });

      return ((data.members || data.data || []) as Array<{
        email?: string;
        user?: { email?: string; name?: string };
        role?: string;
      }>).map((m) => ({
        email: m.email || m.user?.email || "",
        name: m.user?.name || null,
        role: m.role || null,
      })).filter((u) => u.email);
    } catch (err) {
      console.error("OpenAI fetchUsers failed:", err);
      // Non-fatal: continue with usage sync
      return [];
    }
  }

  async fetchUsageData(
    startDate: string,
    endDate: string
  ): Promise<UsageRecord[]> {
    try {
      // Fetch usage data — the exact API structure depends on OpenAI's admin API version
      const data = await this.fetchAPI("/v1/organization/usage", {
        start_date: startDate,
        end_date: endDate,
      });

      const records: UsageRecord[] = [];
      const dailyUsage = data.data || data.daily_costs || [];

      for (const day of dailyUsage as Array<{
        date?: string;
        timestamp?: number;
        line_items?: Array<{
          name?: string;
          cost?: number;
          usage?: { prompt_tokens?: number; completion_tokens?: number; n_requests?: number };
        }>;
        results?: Array<{
          user_id?: string;
          email?: string;
          n_requests?: number;
          n_context_tokens_total?: number;
          n_generated_tokens_total?: number;
        }>;
      }>) {
        const date = day.date || (day.timestamp
          ? new Date(day.timestamp * 1000).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]);

        // If per-user data is available
        if (day.results) {
          for (const user of day.results) {
            if (!user.email) continue;
            records.push({
              email: user.email,
              date,
              messages_count: user.n_requests || 0,
              conversations_count: 0,
              tokens_used:
                (user.n_context_tokens_total || 0) +
                (user.n_generated_tokens_total || 0),
              cost: 0, // Calculated from tokens
              models_used: [],
              task_categories: {},
            });
          }
        }

        // If only aggregate data with line items
        if (day.line_items && !day.results) {
          let totalCost = 0;
          let totalTokens = 0;
          let totalRequests = 0;
          const models: string[] = [];

          for (const item of day.line_items) {
            totalCost += item.cost || 0;
            totalTokens +=
              (item.usage?.prompt_tokens || 0) +
              (item.usage?.completion_tokens || 0);
            totalRequests += item.usage?.n_requests || 0;
            if (item.name) models.push(item.name);
          }

          // Aggregate record (no per-user breakdown)
          records.push({
            email: "__aggregate__",
            date,
            messages_count: totalRequests,
            conversations_count: 0,
            tokens_used: totalTokens,
            cost: totalCost,
            models_used: [...new Set(models)],
            task_categories: {},
          });
        }
      }

      return records;
    } catch (err) {
      console.error("OpenAI fetchUsageData failed:", err);
      throw err;
    }
  }
}
