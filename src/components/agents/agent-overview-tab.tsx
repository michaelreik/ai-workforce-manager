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
} from "recharts";
import {
  DollarSign,
  CheckCircle2,
  ListChecks,
  Clock,
} from "lucide-react";
import type { Agent, Task, BudgetEntry } from "@/types/database";

function getBudgetColor(percentage: number): string {
  if (percentage >= 90) return "text-red-500";
  if (percentage >= 70) return "text-amber-500";
  return "text-emerald-500";
}

function getBudgetBgColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

export function AgentOverviewTab({
  agent,
  tasks,
  budgetEntries,
}: {
  agent: Agent;
  tasks: Task[];
  budgetEntries: BudgetEntry[];
}) {
  const { t } = useTranslations("agents");

  // Compute metrics
  const metrics = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const totalTasks = tasks.length;
    const successRate =
      totalTasks > 0
        ? Math.round((completedTasks.length / totalTasks) * 100)
        : 0;

    const totalCost = tasks.reduce((sum, t) => sum + Number(t.cost), 0);
    const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;

    const tasksWithDuration = tasks.filter((t) => t.duration_ms != null);
    const avgDurationMs =
      tasksWithDuration.length > 0
        ? tasksWithDuration.reduce((sum, t) => sum + (t.duration_ms || 0), 0) /
          tasksWithDuration.length
        : 0;
    const avgDurationSec = avgDurationMs / 1000;

    const today = new Date().toISOString().split("T")[0];
    const tasksToday = tasks.filter(
      (t) => t.started_at.split("T")[0] === today
    ).length;

    return { successRate, avgCostPerTask, avgDurationSec, tasksToday };
  }, [tasks]);

  // Budget data
  const budget = useMemo(() => {
    const monthlyEntry = budgetEntries.find((e) => e.period_type === "monthly");
    const allocated = monthlyEntry
      ? Number(monthlyEntry.allocated)
      : agent.guardrails?.max_budget_monthly || 0;
    const spent = monthlyEntry ? Number(monthlyEntry.spent) : 0;
    const percentage = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
    return { allocated, spent, percentage: Math.min(percentage, 100) };
  }, [budgetEntries, agent.guardrails]);

  // Chart data: costs over last 7 days
  const chartData = useMemo(() => {
    const days: { date: string; cost: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayCost = tasks
        .filter((t) => t.started_at.split("T")[0] === dateStr)
        .reduce((sum, t) => sum + Number(t.cost), 0);
      days.push({
        date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        cost: Number(dayCost.toFixed(4)),
      });
    }
    return days;
  }, [tasks]);

  const metricCards = [
    {
      key: "avgCostPerTask",
      value: `$${metrics.avgCostPerTask.toFixed(4)}`,
      icon: DollarSign,
    },
    {
      key: "successRate",
      value: `${metrics.successRate}%`,
      icon: CheckCircle2,
    },
    {
      key: "tasksToday",
      value: String(metrics.tasksToday),
      icon: ListChecks,
    },
    {
      key: "avgResponseTime",
      value: `${metrics.avgDurationSec.toFixed(1)}s`,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Budget Gauge + Model Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Budget Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("monthlyBudget")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budget.allocated > 0 ? (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold ${getBudgetColor(budget.percentage)}`}>
                    {budget.percentage}%
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">
                    {t("budgetUsed")}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBudgetBgColor(budget.percentage)}`}
                    style={{ width: `${budget.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  ${budget.spent.toFixed(2)} / ${budget.allocated.toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noBudgetSet")}</p>
            )}
          </CardContent>
        </Card>

        {/* Model Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("modelInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("primaryModel")}</p>
              <p className="text-lg font-semibold">{agent.model}</p>
            </div>
            {agent.fallback_model && (
              <div>
                <p className="text-xs text-muted-foreground">{t("fallbackModel")}</p>
                <p className="text-sm font-medium">{agent.fallback_model}</p>
              </div>
            )}
            {agent.tags && agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {agent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(metric.key)}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost Chart (7 days) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("costLast7Days")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 3 }}
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
