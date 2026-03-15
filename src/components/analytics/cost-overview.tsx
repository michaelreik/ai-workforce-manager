"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n/use-translations";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { DollarSign, TrendingUp, Activity, Crown } from "lucide-react";
import type { Agent, Task } from "@/types/database";

export function AnalyticsCostOverview({
  tasks,
  agents,
  dateRange,
}: {
  tasks: Task[];
  agents: Agent[];
  dateRange: string;
}) {
  const { t } = useTranslations("analytics");

  const metrics = useMemo(() => {
    const totalCost = tasks.reduce((sum, t) => sum + Number(t.cost), 0);
    const totalTasks = tasks.length;
    const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;

    // Cost by agent
    const costByAgent = new Map<string, number>();
    for (const task of tasks) {
      costByAgent.set(
        task.agent_id,
        (costByAgent.get(task.agent_id) || 0) + Number(task.cost)
      );
    }

    let mostExpensiveAgent = "—";
    let maxCost = 0;
    for (const [agentId, cost] of costByAgent) {
      if (cost > maxCost) {
        maxCost = cost;
        mostExpensiveAgent =
          agents.find((a) => a.id === agentId)?.name || "Unknown";
      }
    }

    // Previous period comparison (rough: compare first half vs second half)
    const midpoint = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    midpoint.setDate(midpoint.getDate() - Math.floor(days / 2));
    const midpointStr = midpoint.toISOString();

    const recentCost = tasks
      .filter((t) => t.started_at >= midpointStr)
      .reduce((sum, t) => sum + Number(t.cost), 0);
    const olderCost = tasks
      .filter((t) => t.started_at < midpointStr)
      .reduce((sum, t) => sum + Number(t.cost), 0);

    const costChange =
      olderCost > 0 ? ((recentCost - olderCost) / olderCost) * 100 : 0;

    return {
      totalCost,
      avgCostPerTask,
      mostExpensiveAgent,
      mostExpensiveCost: maxCost,
      costChange,
    };
  }, [tasks, agents, dateRange]);

  // Daily cost chart data
  const chartData = useMemo(() => {
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const dailyCosts: { date: string; label: string; cost: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayCost = tasks
        .filter((t) => t.started_at.split("T")[0] === dateStr)
        .reduce((sum, t) => sum + Number(t.cost), 0);
      dailyCosts.push({
        date: dateStr,
        label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        cost: Number(dayCost.toFixed(4)),
      });
    }

    return dailyCosts;
  }, [tasks, dateRange]);

  // Average daily cost for anomaly detection
  const avgDailyCost = useMemo(() => {
    const total = chartData.reduce((sum, d) => sum + d.cost, 0);
    return chartData.length > 0 ? total / chartData.length : 0;
  }, [chartData]);

  const kpiCards = [
    {
      key: "totalCost",
      value: `$${metrics.totalCost.toFixed(2)}`,
      icon: DollarSign,
      sub: t("thisMonth"),
    },
    {
      key: "costChange",
      value: `${metrics.costChange >= 0 ? "+" : ""}${metrics.costChange.toFixed(1)}%`,
      icon: TrendingUp,
      sub: t("vsLastPeriod"),
      className: metrics.costChange > 0 ? "text-red-500" : "text-emerald-500",
    },
    {
      key: "avgCostPerTask",
      value: `$${metrics.avgCostPerTask.toFixed(4)}`,
      icon: Activity,
      sub: t("perTask"),
    },
    {
      key: "mostExpensive",
      value: metrics.mostExpensiveAgent,
      icon: Crown,
      sub: `$${metrics.mostExpensiveCost.toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(card.key)}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.className || ""}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dailyCost")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={dateRange === "7d" ? 0 : dateRange === "30d" ? 4 : 13}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, t("cost")]}
                />
                <ReferenceLine
                  y={avgDailyCost * 2}
                  stroke="var(--color-destructive)"
                  strokeDasharray="3 3"
                  label={{
                    value: t("anomalyThreshold"),
                    fill: "var(--color-destructive)",
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isAnomaly = payload.cost > avgDailyCost * 2;
                    return (
                      <circle
                        key={payload.date}
                        cx={cx}
                        cy={cy}
                        r={isAnomaly ? 5 : 2.5}
                        fill={
                          isAnomaly
                            ? "var(--color-destructive)"
                            : "var(--color-primary)"
                        }
                        stroke="none"
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
