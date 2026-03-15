import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageSource } from "@/types/database";
import { ProviderSync, type UsageRecord, type UserRecord } from "./base-sync";

/**
 * Syncs usage data from GitHub Copilot API.
 *
 * Endpoints:
 * - GET /orgs/{org}/copilot/usage
 * - GET /orgs/{org}/copilot/billing/seats
 */
export class GitHubCopilotSyncProvider extends ProviderSync {
  private token: string;
  private orgName: string;

  constructor(supabase: SupabaseClient, source: UsageSource) {
    super(supabase, source);
    const config = source.config as Record<string, string>;
    this.token = config.github_token || "";
    this.orgName = config.github_org || "";
  }

  private async fetchGH(path: string) {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API error ${res.status}: ${body.slice(0, 200)}`);
    }

    return res.json();
  }

  async fetchUsers(): Promise<UserRecord[]> {
    try {
      const data = await this.fetchGH(
        `/orgs/${this.orgName}/copilot/billing/seats`
      );

      return ((data.seats || []) as Array<{
        assignee?: { login?: string; email?: string; name?: string };
        plan_type?: string;
      }>).map((seat) => ({
        email: seat.assignee?.email || `${seat.assignee?.login}@github`,
        name: seat.assignee?.name || seat.assignee?.login || null,
        role: seat.plan_type || null,
      })).filter((u) => u.email);
    } catch (err) {
      console.error("GitHub fetchUsers failed:", err);
      return [];
    }
  }

  async fetchUsageData(
    startDate: string,
    endDate: string
  ): Promise<UsageRecord[]> {
    try {
      const data = await this.fetchGH(
        `/orgs/${this.orgName}/copilot/usage`
      );

      const records: UsageRecord[] = [];

      for (const day of (data || []) as Array<{
        day?: string;
        breakdown?: Array<{
          login?: string;
          email?: string;
          suggestions_count?: number;
          acceptances_count?: number;
          lines_suggested?: number;
          lines_accepted?: number;
          active_users?: number;
        }>;
        total_suggestions_count?: number;
        total_acceptances_count?: number;
        total_lines_suggested?: number;
        total_lines_accepted?: number;
      }>) {
        const date = day.day || new Date().toISOString().split("T")[0];

        // Skip dates outside range
        if (date < startDate || date > endDate) continue;

        if (day.breakdown) {
          for (const user of day.breakdown) {
            records.push({
              email: user.email || `${user.login}@github`,
              date,
              messages_count: user.suggestions_count || 0,
              conversations_count: user.acceptances_count || 0,
              tokens_used: 0, // Copilot doesn't expose token counts
              cost: 0,
              models_used: ["copilot"],
              task_categories: { coding: user.suggestions_count || 0 },
            });
          }
        } else {
          // Aggregate only
          records.push({
            email: "__aggregate__",
            date,
            messages_count: day.total_suggestions_count || 0,
            conversations_count: day.total_acceptances_count || 0,
            tokens_used: 0,
            cost: 0,
            models_used: ["copilot"],
            task_categories: {
              coding: day.total_suggestions_count || 0,
            },
          });
        }
      }

      return records;
    } catch (err) {
      console.error("GitHub fetchUsageData failed:", err);
      throw err;
    }
  }
}
