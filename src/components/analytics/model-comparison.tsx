"use client";

import { useMemo } from "react";
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
  Legend,
} from "recharts";
import { Lightbulb } from "lucide-react";
import { MODEL_PRICING } from "@/lib/pricing";
import type { Agent, Task } from "@/types/database";

type ModelStats = {
  model: string;
  requests: number;
  avgTokens: number;
  avgCost: number;
  totalCost: number;
  avgQuality: number | null;
};

export function AnalyticsModelComparison({
  tasks,
  agents,
}: {
  tasks: Task[];
  agents: Agent[];
}) {
  const { t } = useTranslations("analytics");

  const modelStats: ModelStats[] = useMemo(() => {
    const byModel = new Map<string, Task[]>();
    for (const task of tasks) {
      const arr = byModel.get(task.model_used) || [];
      arr.push(task);
      byModel.set(task.model_used, arr);
    }

    return Array.from(byModel.entries())
      .map(([model, modelTasks]) => {
        const totalCost = modelTasks.reduce((s, t) => s + Number(t.cost), 0);
        const totalTokens = modelTasks.reduce(
          (s, t) => s + t.tokens_input + t.tokens_output,
          0
        );
        const qualityTasks = modelTasks.filter(
          (t) => t.result_quality != null
        );
        const avgQuality =
          qualityTasks.length > 0
            ? qualityTasks.reduce(
                (s, t) => s + (t.result_quality || 0),
                0
              ) / qualityTasks.length
            : null;

        return {
          model,
          requests: modelTasks.length,
          avgTokens:
            modelTasks.length > 0
              ? Math.round(totalTokens / modelTasks.length)
              : 0,
          avgCost: modelTasks.length > 0 ? totalCost / modelTasks.length : 0,
          totalCost,
          avgQuality,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [tasks]);

  // Chart data
  const chartData = useMemo(() => {
    return modelStats.map((m) => ({
      model: m.model,
      cost: Number(m.totalCost.toFixed(2)),
      requests: m.requests,
    }));
  }, [modelStats]);

  // Generate savings insights
  const insights = useMemo(() => {
    const suggestions: string[] = [];

    // Find agents using expensive models that could downgrade
    const expensiveModels = ["gpt-4o", "claude-opus"];
    const cheaperAlts: Record<string, string> = {
      "gpt-4o": "gpt-4o-mini",
      "claude-opus": "claude-sonnet",
    };

    for (const agent of agents) {
      if (expensiveModels.includes(agent.model)) {
        const agentTasks = tasks.filter((t) => t.agent_id === agent.id);
        if (agentTasks.length === 0) continue;

        const currentCost = agentTasks.reduce(
          (s, t) => s + Number(t.cost),
          0
        );
        const alt = cheaperAlts[agent.model];
        const currentPricing = MODEL_PRICING[agent.model];
        const altPricing = MODEL_PRICING[alt];

        if (currentPricing && altPricing) {
          const ratio =
            (altPricing.input + altPricing.output) /
            (currentPricing.input + currentPricing.output);
          const estimatedSavings = currentCost * (1 - ratio);

          if (estimatedSavings > 1) {
            suggestions.push(
              t("savingsInsight")
                .replace("{agent}", agent.name)
                .replace("{from}", agent.model)
                .replace("{to}", alt)
                .replace("{savings}", estimatedSavings.toFixed(2))
            );
          }
        }
      }
    }

    return suggestions;
  }, [agents, tasks, t]);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("costByModel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="model"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
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
                  formatter={(value, name) => [
                    name === "cost" ? `$${value}` : value,
                    name === "cost" ? t("totalCost") : t("requests"),
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="cost"
                  name={t("totalCost")}
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Model Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modelStats")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("model")}</TableHead>
                <TableHead className="text-right">{t("requests")}</TableHead>
                <TableHead className="text-right">{t("avgTokens")}</TableHead>
                <TableHead className="text-right">{t("avgCostTask")}</TableHead>
                <TableHead className="text-right">{t("totalCost")}</TableHead>
                <TableHead className="text-right">{t("avgQuality")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelStats.map((m) => (
                <TableRow key={m.model}>
                  <TableCell className="font-medium">{m.model}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.requests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {m.avgTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    ${m.avgCost.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${m.totalCost.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.avgQuality != null
                      ? `${(m.avgQuality * 100).toFixed(0)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Savings Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              {t("savingsOpportunities")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {insight}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
