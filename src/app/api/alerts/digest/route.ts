import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/service";
import { sendDailyDigest } from "@/lib/email";

/**
 * POST /api/alerts/digest
 * Sends daily digest emails to all orgs with active agents.
 * Intended to be called by a cron job (e.g., Vercel Cron) at 9am daily.
 *
 * Auth: CRON_SECRET header or INTERNAL_API_SECRET
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-internal-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (
    !process.env.INTERNAL_API_SECRET ||
    secret !== process.env.INTERNAL_API_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  // Fetch all orgs with active agents
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.openmanage.ai";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const results: { orgId: string; success: boolean; error?: string }[] = [];

  for (const org of orgs) {
    // Fetch admin emails
    const { data: members } = await supabase
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", org.id)
      .in("role", ["admin", "owner"]);

    if (!members || members.length === 0) continue;

    const userIds = members.map((m) => m.user_id);
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminEmails = (users?.users || [])
      .filter((u) => userIds.includes(u.id) && u.email)
      .map((u) => u.email!);

    if (adminEmails.length === 0) continue;

    // Fetch yesterday's data
    const [alertsRes, agentsRes, tasksRes, budgetRes] = await Promise.all([
      supabase
        .from("alerts")
        .select("severity, message, agent_id, created_at")
        .eq("org_id", org.id)
        .gte("created_at", `${yesterdayStr}T00:00:00`)
        .lt("created_at", `${yesterdayStr}T23:59:59`)
        .order("created_at", { ascending: false }),
      supabase
        .from("agents")
        .select("id, name, status")
        .eq("org_id", org.id),
      supabase
        .from("tasks")
        .select("agent_id, cost")
        .eq("org_id", org.id)
        .gte("started_at", `${yesterdayStr}T00:00:00`)
        .lt("started_at", `${yesterdayStr}T23:59:59`),
      supabase
        .from("budget_entries")
        .select("allocated, spent")
        .eq("org_id", org.id)
        .eq("period_type", "monthly")
        .gte(
          "period_start",
          new Date(yesterday.getFullYear(), yesterday.getMonth(), 1)
            .toISOString()
            .split("T")[0]
        ),
    ]);

    const alerts = alertsRes.data || [];
    const agents = agentsRes.data || [];
    const tasks = tasksRes.data || [];
    const budgetEntries = budgetRes.data || [];

    const agentMap = new Map(agents.map((a) => [a.id, a.name]));
    const totalSpent = tasks.reduce((s, t) => s + Number(t.cost), 0);
    const budgetAllocated = budgetEntries.reduce(
      (s, e) => s + Number(e.allocated),
      0
    );

    // Find top spender
    const spendByAgent = new Map<string, number>();
    for (const task of tasks) {
      spendByAgent.set(
        task.agent_id,
        (spendByAgent.get(task.agent_id) || 0) + Number(task.cost)
      );
    }
    let topAgent: string | null = null;
    let topAmount = 0;
    for (const [agentId, amount] of spendByAgent) {
      if (amount > topAmount) {
        topAmount = amount;
        topAgent = agentMap.get(agentId) || null;
      }
    }

    const result = await sendDailyDigest({
      to: adminEmails,
      orgName: org.name,
      dashboardUrl: baseUrl,
      summary: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
        totalSpent,
        budgetAllocated,
        activeAgents: agents.filter((a) => a.status === "active").length,
        totalAgents: agents.length,
        topSpendingAgent: topAgent,
        topSpendingAmount: topAmount,
      },
      recentAlerts: alerts.map((a) => ({
        severity: a.severity,
        message: a.message,
        agentName: a.agent_id ? agentMap.get(a.agent_id) || null : null,
        createdAt: a.created_at,
      })),
    });

    results.push({ orgId: org.id, ...result });
  }

  return NextResponse.json({
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
