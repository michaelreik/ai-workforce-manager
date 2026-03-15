import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

/**
 * POST /api/providers
 * Creates a provider with encrypted API key.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    org_id,
    provider_type,
    display_name,
    api_key,
    base_url,
    rate_limit_rpm,
    is_default,
    health_status,
    last_health_check,
  } = body;

  if (!org_id || !provider_type || !display_name || !api_key) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify user is a member of the org they're creating a provider for
  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", org_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Forbidden: not a member of this organization" },
      { status: 403 }
    );
  }

  // Encrypt the API key before storing
  const api_key_encrypted = encrypt(api_key);

  const { data, error } = await supabase
    .from("providers")
    .insert({
      org_id,
      provider_type,
      display_name,
      api_key_encrypted,
      base_url: base_url || null,
      rate_limit_rpm: rate_limit_rpm || null,
      is_default: is_default || false,
      health_status: health_status || "unknown",
      last_health_check: last_health_check || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
