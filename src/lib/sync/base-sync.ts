import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageSource } from "@/types/database";

export type UsageRecord = {
  email: string;
  date: string;
  messages_count: number;
  conversations_count: number;
  tokens_used: number;
  cost: number;
  models_used: string[];
  task_categories: Record<string, number>;
};

export type UserRecord = {
  email: string;
  name: string | null;
  role: string | null;
};

export type SyncResult = {
  success: boolean;
  usersSync: number;
  usageSync: number;
  errors: string[];
};

export abstract class ProviderSync {
  protected supabase: SupabaseClient;
  protected source: UsageSource;

  constructor(supabase: SupabaseClient, source: UsageSource) {
    this.supabase = supabase;
    this.source = source;
  }

  abstract fetchUsageData(
    startDate: string,
    endDate: string
  ): Promise<UsageRecord[]>;

  abstract fetchUsers(): Promise<UserRecord[]>;

  async run(): Promise<SyncResult> {
    const errors: string[] = [];
    let usersSync = 0;
    let usageSync = 0;

    // 1. Update sync status
    await this.supabase
      .from("usage_sources")
      .update({ sync_status: "syncing" })
      .eq("id", this.source.id);

    try {
      // 2. Sync users
      const users = await this.fetchUsers();
      for (const user of users) {
        const { data: existing } = await this.supabase
          .from("workspace_members")
          .select("id")
          .eq("org_id", this.source.org_id)
          .eq("email", user.email)
          .single();

        if (!existing) {
          const { error } = await this.supabase
            .from("workspace_members")
            .insert({
              org_id: this.source.org_id,
              email: user.email,
              name: user.name,
              role: user.role,
            });
          if (error) {
            errors.push(`User ${user.email}: ${error.message}`);
          } else {
            usersSync++;
          }
        }
      }

      // 3. Sync usage — last 30 days by default
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      const usageData = await this.fetchUsageData(startDate, endDate);

      for (const record of usageData) {
        // Resolve member
        const { data: member } = await this.supabase
          .from("workspace_members")
          .select("id")
          .eq("org_id", this.source.org_id)
          .eq("email", record.email)
          .single();

        if (!member) {
          errors.push(`No member found for ${record.email}`);
          continue;
        }

        // Upsert usage
        const { error } = await this.supabase
          .from("human_usage")
          .upsert(
            {
              org_id: this.source.org_id,
              source_id: this.source.id,
              member_id: member.id,
              date: record.date,
              messages_count: record.messages_count,
              conversations_count: record.conversations_count,
              tokens_used: record.tokens_used,
              cost: record.cost,
              models_used: record.models_used,
              task_categories: record.task_categories,
            },
            { onConflict: "org_id,source_id,member_id,date" }
          );

        if (error) {
          errors.push(`Usage ${record.email}/${record.date}: ${error.message}`);
        } else {
          usageSync++;
        }
      }

      // 4. Update source status
      await this.supabase
        .from("usage_sources")
        .update({
          sync_status: errors.length > 0 ? "error" : "success",
          sync_error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", this.source.id);

      return { success: errors.length === 0, usersSync, usageSync, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.supabase
        .from("usage_sources")
        .update({
          sync_status: "error",
          sync_error: message,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", this.source.id);

      return {
        success: false,
        usersSync,
        usageSync,
        errors: [message, ...errors],
      };
    }
  }
}
