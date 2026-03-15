import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSyncProvider } from "@/lib/sync";
import { createAlert } from "@/lib/alerts";
import type { UsageSource } from "@/types/database";

/**
 * GET /api/sync
 * Cron endpoint — triggered by Vercel Cron every hour.
 * Syncs all active api_sync sources across all orgs.
 * Requires CRON_SECRET header for Vercel Cron or x-internal-secret for manual triggers.
 */
export async function GET(request: NextRequest) {
  // Verify cron authorization
  const cronSecret = request.headers.get("authorization");
  const internalSecret = request.headers.get("x-internal-secret");
  const isAuthorized =
    (process.env.CRON_SECRET && cronSecret === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.INTERNAL_API_SECRET && internalSecret === process.env.INTERNAL_API_SECRET);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all active api_sync sources across all orgs
  const { data: sources } = await supabase
    .from("usage_sources")
    .select("*")
    .eq("type", "api_sync")
    .eq("is_active", true);

  const sourcesToSync = (sources || []) as UsageSource[];

  if (sourcesToSync.length === 0) {
    return NextResponse.json({ message: "No sources to sync", synced: 0 });
  }

  const results: Array<{
    sourceId: string;
    sourceName: string;
    orgId: string;
    success: boolean;
    errors: string[];
  }> = [];

  for (const source of sourcesToSync) {
    const provider = getSyncProvider(supabase, source);
    if (!provider) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        orgId: source.org_id,
        success: false,
        errors: [`No sync provider for: ${source.provider}`],
      });
      continue;
    }

    const result = await provider.run();
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      orgId: source.org_id,
      success: result.success,
      errors: result.errors,
    });

    // Alert on failure
    if (!result.success) {
      await createAlert({
        supabase,
        org_id: source.org_id,
        type: "error_spike",
        severity: "warning",
        message: `Scheduled sync failed for "${source.name}": ${result.errors[0] || "Unknown error"}`,
      });
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    total: sourcesToSync.length,
    results,
  });
}

/**
 * POST /api/sync
 * Triggers a sync for one or all usage sources.
 *
 * Body: { source_id: string } — sync one source
 *   OR: { all: true }         — sync all active api_sync sources
 *
 * Auth: authenticated user (admin/owner) OR x-internal-secret (for cron)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const internalSecret = request.headers.get("x-internal-secret");
  const isCron =
    process.env.INTERNAL_API_SECRET &&
    internalSecret === process.env.INTERNAL_API_SECRET;

  // Auth check
  let orgId: string | null = null;
  if (!isCron) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's org
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .in("role", ["admin", "owner"])
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    orgId = membership.org_id;
  }

  const supabase = createServiceClient();
  const results: Array<{
    sourceId: string;
    sourceName: string;
    success: boolean;
    usersSync: number;
    usageSync: number;
    errors: string[];
  }> = [];

  // Determine which sources to sync
  let sourcesToSync: UsageSource[] = [];

  if (body.source_id) {
    const { data } = await supabase
      .from("usage_sources")
      .select("*")
      .eq("id", body.source_id)
      .eq("type", "api_sync")
      .single();

    if (data) sourcesToSync = [data as UsageSource];
  } else if (body.all) {
    const query = supabase
      .from("usage_sources")
      .select("*")
      .eq("type", "api_sync")
      .eq("is_active", true);

    if (orgId) query.eq("org_id", orgId);

    const { data } = await query;
    sourcesToSync = (data || []) as UsageSource[];
  }

  if (sourcesToSync.length === 0) {
    return NextResponse.json({
      message: "No sources to sync",
      results: [],
    });
  }

  // Run syncs (sequential to avoid rate limiting)
  for (const source of sourcesToSync) {
    const provider = getSyncProvider(supabase, source);
    if (!provider) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        success: false,
        usersSync: 0,
        usageSync: 0,
        errors: [`No sync provider for: ${source.provider}`],
      });
      continue;
    }

    const result = await provider.run();
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      ...result,
    });

    // Alert on repeated failures
    if (!result.success) {
      // Check if this is the 3rd consecutive failure
      const { data: recentSyncs } = await supabase
        .from("usage_sources")
        .select("sync_status")
        .eq("id", source.id)
        .single();

      if (recentSyncs?.sync_status === "error") {
        await createAlert({
          supabase,
          org_id: source.org_id,
          type: "error_spike",
          severity: "warning",
          message: `Usage sync failed for "${source.name}": ${result.errors[0] || "Unknown error"}`,
        });
      }
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
