"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Users,
  Settings2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Agent, Team, BudgetEntry, Task } from "@/types/database";

type TeamBudget = {
  team: Team;
  allocated: number;
  spent: number;
  agentCount: number;
  topSpender: { name: string; spent: number } | null;
};

type DailySpend = {
  date: string;
  label: string;
  cumulative: number;
};

export default function BudgetPage() {
  const { t } = useTranslations("budget");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [loading, setLoading] = useState(true);

  // Summary
  const [monthlyAllocated, setMonthlyAllocated] = useState(0);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [projectedSpend, setProjectedSpend] = useState(0);

  // Teams
  const [teamBudgets, setTeamBudgets] = useState<TeamBudget[]>([]);

  // Chart
  const [dailyData, setDailyData] = useState<DailySpend[]>([]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchBudgetData() {
      setLoading(true);
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split("T")[0];
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();
        const dayOfMonth = now.getDate();

        // Fetch 30 days of tasks for the chart
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [budgetRes, agentsRes, teamsRes, tasksRes] = await Promise.all([
          supabase
            .from("budget_entries")
            .select("*")
            .eq("org_id", currentOrg!.id)
            .eq("period_type", "monthly")
            .gte("period_start", monthStartStr),
          supabase
            .from("agents")
            .select("id, name, team_id")
            .eq("org_id", currentOrg!.id),
          supabase
            .from("teams")
            .select("*")
            .eq("org_id", currentOrg!.id),
          supabase
            .from("tasks")
            .select("cost, started_at, agent_id")
            .eq("org_id", currentOrg!.id)
            .gte("started_at", thirtyDaysAgo.toISOString())
            .order("started_at", { ascending: true }),
        ]);

        const budgetEntries = (budgetRes.data || []) as BudgetEntry[];
        const agents = (agentsRes.data || []) as Pick<
          Agent,
          "id" | "name" | "team_id"
        >[];
        const teams = (teamsRes.data || []) as Team[];
        const tasks = (tasksRes.data || []) as Pick<
          Task,
          "cost" | "started_at" | "agent_id"
        >[];

        // --- Summary ---
        const totalAllocated = budgetEntries.reduce(
          (s, e) => s + Number(e.allocated),
          0
        );
        const totalSpent = budgetEntries.reduce(
          (s, e) => s + Number(e.spent),
          0
        );
        setMonthlyAllocated(totalAllocated);
        setMonthlySpent(totalSpent);

        // Project: linear extrapolation based on days elapsed
        const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
        setProjectedSpend(dailyAvg * daysInMonth);

        // --- Team budgets ---
        const budgetByAgent = new Map<
          string,
          { allocated: number; spent: number }
        >();
        for (const entry of budgetEntries) {
          if (entry.agent_id) {
            const e = budgetByAgent.get(entry.agent_id) || {
              allocated: 0,
              spent: 0,
            };
            e.allocated += Number(entry.allocated);
            e.spent += Number(entry.spent);
            budgetByAgent.set(entry.agent_id, e);
          }
        }

        const teamBudgetData: TeamBudget[] = teams.map((team) => {
          const teamAgents = agents.filter((a) => a.team_id === team.id);
          let allocated = 0;
          let spent = 0;
          let topSpender: { name: string; spent: number } | null = null;

          for (const agent of teamAgents) {
            const ab = budgetByAgent.get(agent.id);
            if (ab) {
              allocated += ab.allocated;
              spent += ab.spent;
              if (!topSpender || ab.spent > topSpender.spent) {
                topSpender = { name: agent.name, spent: ab.spent };
              }
            }
          }

          // Fall back to team.budget_monthly if no entries
          if (allocated === 0) {
            allocated = Number(team.budget_monthly);
          }

          return {
            team,
            allocated,
            spent,
            agentCount: teamAgents.length,
            topSpender,
          };
        });

        setTeamBudgets(teamBudgetData);

        // --- Daily cumulative spend chart (last 30 days) ---
        const dailyMap = new Map<string, number>();
        for (const task of tasks) {
          const day = task.started_at.split("T")[0];
          dailyMap.set(day, (dailyMap.get(day) || 0) + Number(task.cost));
        }

        // Build sorted array of last 30 days
        const chartData: DailySpend[] = [];
        let cumulative = 0;
        for (let i = 30; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const daySpend = dailyMap.get(dateStr) || 0;
          cumulative += daySpend;
          chartData.push({
            date: dateStr,
            label: `${d.getMonth() + 1}/${d.getDate()}`,
            cumulative: Number(cumulative.toFixed(2)),
          });
        }
        setDailyData(chartData);
      } catch (err) {
        console.error("Failed to load budget data:", err);
        toast.error("Failed to load budget data");
      } finally {
        setLoading(false);
      }
    }

    fetchBudgetData();
  }, [currentOrg, supabase]);

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const remaining = monthlyAllocated - monthlySpent;
  const now = new Date();
  const daysLeft =
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
    now.getDate();
  const overBudget = projectedSpend > monthlyAllocated && monthlyAllocated > 0;
  const unallocated =
    monthlyAllocated - teamBudgets.reduce((s, tb) => s + tb.allocated, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/budget/allocate" />}>
          <Settings2 className="h-4 w-4" />
          {t("allocate")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalMonthly")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyAllocated.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("acrossTeams", { count: teamBudgets.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalSpent")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlySpent.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyAllocated > 0
                ? `${Math.round((monthlySpent / monthlyAllocated) * 100)}% ${t("ofBudget")}`
                : t("noBudgetSet")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("remaining")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${remaining < 0 ? "text-destructive" : ""}`}
            >
              ${remaining.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("daysLeft", { count: daysLeft })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("projected")}
            </CardTitle>
            {overBudget ? (
              <TrendingUp className="h-4 w-4 text-destructive" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${overBudget ? "text-destructive" : "text-emerald-500"}`}
            >
              ${projectedSpend.toFixed(2)}
            </div>
            {overBudget && monthlyAllocated > 0 && (
              <p className="text-xs text-destructive mt-1">
                {t("overBudgetBy", {
                  amount: (projectedSpend - monthlyAllocated).toFixed(2),
                })}
              </p>
            )}
            {!overBudget && (
              <p className="text-xs text-emerald-500 mt-1">
                {t("onTrack")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Budgets */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {t("teamBudgets")}
          <HelpTooltip content={t("helpTeamBudgets")} />
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teamBudgets.map((tb) => {
            const pct =
              tb.allocated > 0
                ? Math.round((tb.spent / tb.allocated) * 100)
                : 0;
            const barColor =
              pct >= 90
                ? "bg-red-500"
                : pct >= 70
                  ? "bg-amber-500"
                  : "bg-emerald-500";
            const textColor =
              pct >= 90
                ? "text-red-500"
                : pct >= 70
                  ? "text-amber-500"
                  : "text-emerald-500";

            return (
              <Card key={tb.team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {tb.team.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {tb.agentCount}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Budget bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        ${tb.spent.toFixed(2)} / ${tb.allocated.toFixed(2)}
                      </span>
                      <span className={textColor}>{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Top spender */}
                  {tb.topSpender && (
                    <p className="text-xs text-muted-foreground">
                      {t("topSpender")}: {tb.topSpender.name} ($
                      {tb.topSpender.spent.toFixed(2)})
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Unallocated */}
        {unallocated !== 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            {t("unallocated")}: ${unallocated.toFixed(2)}
          </p>
        )}
      </div>

      {/* Budget Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {t("timeline")}
            <HelpTooltip content={t("helpTimeline")} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [
                    `$${Number(value).toFixed(2)}`,
                    t("cumulativeSpend"),
                  ]}
                  labelFormatter={(label) => String(label)}
                />
                {monthlyAllocated > 0 && (
                  <ReferenceLine
                    y={monthlyAllocated}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="6 3"
                    label={{
                      value: t("budgetLimit"),
                      position: "insideTopRight",
                      fill: "hsl(var(--destructive))",
                      fontSize: 11,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorSpend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("noData")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
