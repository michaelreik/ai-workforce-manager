"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/i18n/use-translations";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Agent, Task, Team } from "@/types/database";

type AgentStats = {
  id: string;
  name: string;
  team: string;
  tasks: number;
  successRate: number;
  avgCost: number;
  avgDuration: number;
  totalCost: number;
  outputUnits: number;
  costPerUnit: number;
};

type SortKey = keyof Pick<
  AgentStats,
  "tasks" | "successRate" | "avgCost" | "avgDuration" | "totalCost" | "costPerUnit"
>;

function getEfficiencyColor(costPerUnit: number, avg: number): string {
  if (costPerUnit === 0) return "text-muted-foreground";
  if (costPerUnit <= avg * 0.7) return "text-emerald-500";
  if (costPerUnit <= avg * 1.3) return "text-amber-500";
  return "text-red-500";
}

export function AnalyticsAgentPerformance({
  tasks,
  agents,
  teams,
}: {
  tasks: Task[];
  agents: Agent[];
  teams: Team[];
}) {
  const { t } = useTranslations("analytics");
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const teamsMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const agentStats: AgentStats[] = useMemo(() => {
    const statsMap = new Map<string, Task[]>();
    for (const task of tasks) {
      const arr = statsMap.get(task.agent_id) || [];
      arr.push(task);
      statsMap.set(task.agent_id, arr);
    }

    return agents.map((agent) => {
      const agentTasks = statsMap.get(agent.id) || [];
      const completed = agentTasks.filter((t) => t.status === "completed");
      const totalCost = agentTasks.reduce((s, t) => s + Number(t.cost), 0);
      const avgCost = agentTasks.length > 0 ? totalCost / agentTasks.length : 0;
      const tasksWithDur = agentTasks.filter((t) => t.duration_ms != null);
      const avgDuration =
        tasksWithDur.length > 0
          ? tasksWithDur.reduce((s, t) => s + (t.duration_ms || 0), 0) /
            tasksWithDur.length /
            1000
          : 0;
      const outputUnits = agentTasks.reduce((s, t) => s + t.output_units, 0);

      return {
        id: agent.id,
        name: agent.name,
        team: (agent.team_id && teamsMap.get(agent.team_id)) || "—",
        tasks: agentTasks.length,
        successRate:
          agentTasks.length > 0
            ? Math.round((completed.length / agentTasks.length) * 100)
            : 0,
        avgCost,
        avgDuration,
        totalCost,
        outputUnits,
        costPerUnit: outputUnits > 0 ? totalCost / outputUnits : 0,
      };
    });
  }, [tasks, agents, teamsMap]);

  const avgCostPerUnit = useMemo(() => {
    const withUnits = agentStats.filter((a) => a.costPerUnit > 0);
    if (withUnits.length === 0) return 1;
    return (
      withUnits.reduce((s, a) => s + a.costPerUnit, 0) / withUnits.length
    );
  }, [agentStats]);

  const sorted = useMemo(() => {
    return [...agentStats].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [agentStats, sortKey, sortDir]);

  // Bar chart data (top agents by cost)
  const chartData = useMemo(() => {
    return [...agentStats]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)
      .map((a) => ({
        name: a.name.length > 15 ? a.name.slice(0, 14) + "…" : a.name,
        cost: Number(a.totalCost.toFixed(2)),
        tasks: a.tasks,
      }));
  }, [agentStats]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("costByAgent")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(value, name) => [
                    name === "cost" ? `$${value}` : value,
                    name === "cost" ? t("totalCost") : t("taskCount"),
                  ]}
                />
                <Bar
                  dataKey="cost"
                  fill="var(--color-primary)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("performanceTable")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("agent")}</TableHead>
                  <TableHead>{t("team")}</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("tasks")}
                  >
                    {t("taskCount")}{sortIndicator("tasks")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("successRate")}
                  >
                    {t("successRate")}{sortIndicator("successRate")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("avgCost")}
                  >
                    {t("avgCostTask")}{sortIndicator("avgCost")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("avgDuration")}
                  >
                    {t("avgDuration")}{sortIndicator("avgDuration")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("totalCost")}
                  >
                    {t("totalCost")}{sortIndicator("totalCost")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("costPerUnit")}
                  >
                    {t("costPerUnit")}{sortIndicator("costPerUnit")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.team}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.tasks}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          a.successRate >= 90
                            ? "text-emerald-500"
                            : a.successRate >= 70
                              ? "text-amber-500"
                              : "text-red-500"
                        }
                      >
                        {a.successRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      ${a.avgCost.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {a.avgDuration.toFixed(1)}s
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${a.totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${getEfficiencyColor(a.costPerUnit, avgCostPerUnit)}`}
                    >
                      {a.costPerUnit > 0
                        ? `$${a.costPerUnit.toFixed(4)}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
