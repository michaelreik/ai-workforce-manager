import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Generate a new API key
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, agent_id, expires_in_days, org_id } = body as {
    name: string;
    agent_id?: string;
    expires_in_days?: number;
    org_id: string;
  };

  if (!name || !org_id) {
    return NextResponse.json(
      { error: "name and org_id are required" },
      { status: 400 }
    );
  }

  // Verify user belongs to this org
  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Generate the key
  const rawKey = `awm_sk_${crypto.randomBytes(36).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 15);

  let expiresAt: string | null = null;
  if (expires_in_days) {
    const d = new Date();
    d.setDate(d.getDate() + expires_in_days);
    expiresAt = d.toISOString();
  }

  const { error } = await supabase.from("api_keys").insert({
    org_id,
    name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    agent_id: agent_id || null,
    permissions: ["proxy"],
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }

  // Return the raw key ONCE
  return NextResponse.json({ key: rawKey, prefix: keyPrefix });
}

// Delete an API key
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("api_keys").delete().eq("id", keyId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
