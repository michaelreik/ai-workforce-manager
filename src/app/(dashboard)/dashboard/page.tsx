"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bot,
  DollarSign,
  AlertTriangle,
  Activity,
  Pause,
  Play,
  Eye,
  OctagonX,
} from "lucide-react";
import type { Agent, Team, BudgetEntry, Alert } from "@/types/database";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";

type DashboardStats = {
  dailySpent: number;
  dailyAllocated: number;
  monthlySpent: number;
  monthlyAllocated: number;
  activeAgents: number;
  totalAgents: number;
  pausedAgents: number;
  errorAgents: number;
  unacknowledgedAlerts: number;
  criticalAlerts: number;
};

type AtRiskAgent = Agent & {
  teamName: string | null;
  budgetPercentage: number;
};

export default function DashboardPage() {
  const { t } = useTranslations("dashboard");
  const { t: tAgents } = useTranslations("agents");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [atRiskAgents, setAtRiskAgents] = useState<AtRiskAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchDashboard() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const monthStart = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
          .toISOString()
          .split("T")[0];

        const [
          dailyBudgetRes,
          monthlyBudgetRes,
          agentsRes,
          teamsRes,
          alertsRes,
        ] = await Promise.all([
          supabase
            .from("budget_entries")
            .select("allocated, spent")
            .eq("org_id", currentOrg!.id)
            .eq("period_type", "daily")
            .eq("period_start", today),
          supabase
            .from("budget_entries")
            .select("allocated, spent")
            .eq("org_id", currentOrg!.id)
            .eq("period_type", "monthly")
            .gte("period_start", monthStart),
          supabase
            .from("agents")
            .select("*")
            .eq("org_id", currentOrg!.id),
          supabase
            .from("teams")
            .select("id, name")
            .eq("org_id", currentOrg!.id),
          supabase
            .from("alerts")
            .select("severity, acknowledged")
            .eq("org_id", currentOrg!.id)
            .eq("acknowledged", false),
        ]);

        const dailyEntries = (dailyBudgetRes.data || []) as Pick<
          BudgetEntry,
          "allocated" | "spent"
        >[];
        const monthlyEntries = (monthlyBudgetRes.data || []) as Pick<
          BudgetEntry,
          "allocated" | "spent"
        >[];
        const agents = (agentsRes.data || []) as Agent[];
        const teams = (teamsRes.data || []) as Pick<Team, "id" | "name">[];
        const alerts = (alertsRes.data || []) as Pick<
          Alert,
          "severity" | "acknowledged"
        >[];

        const teamsMap = new Map(teams.map((t) => [t.id, t.name]));

        // Build budget map per agent for at-risk calculation
        const monthlyBudgetMap = new Map<
          string,
          { allocated: number; spent: number }
        >();
        for (const entry of (monthlyBudgetRes.data || []) as BudgetEntry[]) {
          if (entry.agent_id) {
            const existing = monthlyBudgetMap.get(entry.agent_id) || {
              allocated: 0,
              spent: 0,
            };
            existing.allocated += Number(entry.allocated);
            existing.spent += Number(entry.spent);
            monthlyBudgetMap.set(entry.agent_id, existing);
          }
        }

        // Identify at-risk agents: >90% budget OR error status
        const risk: AtRiskAgent[] = agents
          .map((agent) => {
            const budget = monthlyBudgetMap.get(agent.id);
            const allocated =
              budget?.allocated ||
              agent.guardrails?.max_budget_monthly ||
              0;
            const spent = budget?.spent || 0;
            const pct = allocated > 0 ? (spent / allocated) * 100 : 0;

            return {
              ...agent,
              teamName: agent.team_id
                ? teamsMap.get(agent.team_id) || null
                : null,
              budgetPercentage: Math.round(pct),
            };
          })
          .filter((a) => a.budgetPercentage >= 90 || a.status === "error")
          .sort((a, b) => b.budgetPercentage - a.budgetPercentage);

        setAtRiskAgents(risk);

        setStats({
          dailySpent: dailyEntries.reduce(
            (sum, e) => sum + Number(e.spent),
            0
          ),
          dailyAllocated: dailyEntries.reduce(
            (sum, e) => sum + Number(e.allocated),
            0
          ),
          monthlySpent: monthlyEntries.reduce(
            (sum, e) => sum + Number(e.spent),
            0
          ),
          monthlyAllocated: monthlyEntries.reduce(
            (sum, e) => sum + Number(e.allocated),
            0
          ),
          activeAgents: agents.filter((a) => a.status === "active").length,
          totalAgents: agents.length,
          pausedAgents: agents.filter((a) => a.status === "paused").length,
          errorAgents: agents.filter((a) => a.status === "error").length,
          unacknowledgedAlerts: alerts.length,
          criticalAlerts: alerts.filter((a) => a.severity === "critical")
            .length,
        });
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [currentOrg, supabase]);

  async function handleToggleAgent(
    agentId: string,
    newStatus: "active" | "paused"
  ) {
    const { error } = await supabase
      .from("agents")
      .update({ status: newStatus })
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to update agent");
      return;
    }

    setAtRiskAgents((prev) =>
      newStatus === "active"
        ? prev.map((a) =>
            a.id === agentId ? { ...a, status: newStatus } : a
          )
        : prev.map((a) =>
            a.id === agentId ? { ...a, status: newStatus } : a
          )
    );
    toast.success(
      newStatus === "paused"
        ? tAgents("agentPaused")
        : tAgents("agentResumed")
    );
  }

  async function handlePauseAll() {
    if (!currentOrg) return;
    if (!confirm(t("pauseAllConfirm"))) return;

    const { error } = await supabase
      .from("agents")
      .update({ status: "paused" })
      .eq("org_id", currentOrg.id)
      .eq("status", "active");

    if (error) {
      toast.error("Failed to pause agents");
      return;
    }

    // Audit log
    await supabase.from("audit_log").insert({
      org_id: currentOrg.id,
      action: "emergency_pause_all",
      target_type: "agent",
      details: { reason: "manual_emergency" },
    });

    setAtRiskAgents((prev) =>
      prev.map((a) =>
        a.status === "active" ? { ...a, status: "paused" as const } : a
      )
    );
    if (stats) {
      setStats({ ...stats, activeAgents: 0, pausedAgents: stats.pausedAgents + stats.activeAgents });
    }
    toast.success(t("allAgentsPaused"));
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const monthlyPct =
    stats && stats.monthlyAllocated > 0
      ? Math.round((stats.monthlySpent / stats.monthlyAllocated) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("welcome")}</p>
      </div>

      {/* Onboarding checklist banner */}
      <OnboardingChecklist />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Daily Spend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalSpent")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.dailySpent.toFixed(2) ?? "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of ${stats?.dailyAllocated.toFixed(2) ?? "0.00"} daily budget
            </p>
          </CardContent>
        </Card>

        {/* Active Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("activeAgents")}
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAgents ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {stats?.totalAgents ?? 0} total
            </p>
            {stats && (stats.pausedAgents > 0 || stats.errorAgents > 0) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[
                  stats.pausedAgents > 0 && `${stats.pausedAgents} paused`,
                  stats.errorAgents > 0 && `${stats.errorAgents} error`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalBudget")}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.monthlySpent.toFixed(2) ?? "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              spent this month
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyPct}% of monthly budget
            </p>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("alertsToday")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.unacknowledgedAlerts ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              unacknowledged
            </p>
            {stats && stats.criticalAlerts > 0 && (
              <p className="text-xs text-destructive mt-1">
                {stats.criticalAlerts} critical
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Controls — At-Risk Agents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("quickControls")}</CardTitle>
          {stats && stats.activeAgents > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePauseAll}
            >
              <OctagonX className="h-4 w-4" />
              {t("pauseAll")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {atRiskAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No agents at risk
            </p>
          ) : (
            <div className="space-y-3">
              {atRiskAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Bot className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {agent.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.model}
                        {agent.teamName && ` · ${agent.teamName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {agent.status === "error" ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : agent.budgetPercentage >= 100 ? (
                      <Badge variant="destructive">
                        {agent.budgetPercentage}% budget
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/20">
                        {agent.budgetPercentage}% budget
                      </Badge>
                    )}
                    {agent.status === "active" && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleToggleAgent(agent.id, "paused")}
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                    )}
                    {agent.status === "paused" && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleToggleAgent(agent.id, "active")}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="xs"
                      nativeButton={false}
                      render={<Link href={`/agents/${agent.id}`} />}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
