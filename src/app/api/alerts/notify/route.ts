import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/service";
import { sendAlertEmail } from "@/lib/email";

/**
 * POST /api/alerts/notify
 * Sends email notifications for critical alerts.
 * Called internally by the proxy when a critical alert is created.
 *
 * Body: { org_id, alert_id }
 */
export async function POST(request: NextRequest) {
  // Simple internal auth via secret header
  const internalSecret = request.headers.get("x-internal-secret");
  if (
    !process.env.INTERNAL_API_SECRET ||
    internalSecret !== process.env.INTERNAL_API_SECRET
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { org_id, alert_id } = body;

  if (!org_id || !alert_id) {
    return NextResponse.json(
      { error: "Missing org_id or alert_id" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  // Fetch alert
  const { data: alert, error: alertError } = await supabase
    .from("alerts")
    .select("*")
    .eq("id", alert_id)
    .single();

  if (alertError || !alert) {
    return NextResponse.json(
      { error: "Alert not found" },
      { status: 404 }
    );
  }

  // Only send emails for critical alerts
  if (alert.severity !== "critical") {
    return NextResponse.json({ skipped: true, reason: "Not critical" });
  }

  // Fetch org
  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug")
    .eq("id", org_id)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Fetch admin/owner emails
  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", org_id)
    .in("role", ["admin", "owner"]);

  if (!members || members.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No admins" });
  }

  // Fetch user emails from auth.users
  const userIds = members.map((m) => m.user_id);
  const { data: users } = await supabase.auth.admin.listUsers();

  const adminEmails = (users?.users || [])
    .filter((u) => userIds.includes(u.id) && u.email)
    .map((u) => u.email!);

  if (adminEmails.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No admin emails" });
  }

  // Fetch agent name if applicable
  let agentName: string | null = null;
  if (alert.agent_id) {
    const { data: agent } = await supabase
      .from("agents")
      .select("name")
      .eq("id", alert.agent_id)
      .single();
    agentName = agent?.name || null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.openmanage.ai";

  const result = await sendAlertEmail({
    to: adminEmails,
    orgName: org.name,
    agentName,
    alertType: alert.type,
    severity: alert.severity,
    message: alert.message,
    dashboardUrl: alert.agent_id
      ? `${baseUrl}/agents/${alert.agent_id}`
      : `${baseUrl}/alerts`,
  });

  return NextResponse.json(result);
}
