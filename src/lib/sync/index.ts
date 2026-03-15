import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageSource } from "@/types/database";
import { ProviderSync } from "./base-sync";
import { OpenAISyncProvider } from "./openai-sync";
import { GitHubCopilotSyncProvider } from "./github-copilot-sync";
import { AnthropicSyncProvider } from "./anthropic-sync";

export function getSyncProvider(
  supabase: SupabaseClient,
  source: UsageSource
): ProviderSync | null {
  switch (source.provider) {
    case "openai":
      return new OpenAISyncProvider(supabase, source);
    case "github":
      return new GitHubCopilotSyncProvider(supabase, source);
    case "anthropic":
      return new AnthropicSyncProvider(supabase, source);
    default:
      return null;
  }
}

export { ProviderSync } from "./base-sync";
export type { UsageRecord, UserRecord, SyncResult } from "./base-sync";
