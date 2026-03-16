import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncOpenRouterPricing } from "@/lib/sync/openrouter-pricing-sync";
import { invalidatePricingCache } from "@/lib/pricing";

const CRON_SECRET = process.env.CRON_SECRET;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * POST /api/pricing/sync — Trigger OpenRouter pricing sync
 * Auth: CRON_SECRET or INTERNAL_API_SECRET or authenticated admin
 *
 * GET /api/pricing/sync — Vercel cron endpoint
 * Auth: CRON_SECRET via Authorization header
 */

async function handleSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const result = await syncOpenRouterPricing(supabase);

  // Invalidate cache after sync
  invalidatePricingCache();

  return NextResponse.json(result, {
    status: result.errors.length > 0 ? 207 : 200,
  });
}

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization") || "";
  const internalSecret = request.headers.get("x-internal-secret") || "";

  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return true;
  if (INTERNAL_API_SECRET && internalSecret === INTERNAL_API_SECRET) return true;

  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleSync();
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleSync();
}
