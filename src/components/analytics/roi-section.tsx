"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/use-translations";
import { TrendingUp, TrendingDown, Star } from "lucide-react";
import type { Agent, Task } from "@/types/database";

type AgentROI = {
  id: string;
  name: string;
  outputUnits: number;
  totalCost: number;
  costPerUnit: number;
  outputValue: number;
  revenueValue: number;
  roi: number;
  unitName: string;
};

export function AnalyticsROI({
  tasks,
  agents,
}: {
  tasks: Task[];
  agents: Agent[];
}) {
  const { t } = useTranslations("analytics");

  const agentROIs: AgentROI[] = useMemo(() => {
    return agents
      .map((agent) => {
        const agentTasks = tasks.filter((t) => t.agent_id === agent.id);
        const totalCost = agentTasks.reduce((s, t) => s + Number(t.cost), 0);
        const outputUnits = agentTasks.reduce(
          (s, t) => s + t.output_units,
          0
        );

        // Get ROI config from metadata
        const meta = agent.metadata as {
          output_value?: number;
          output_unit_name?: string;
        };
        const outputValue = meta?.output_value || 0;
        const unitName = meta?.output_unit_name || "Units";

        const costPerUnit = outputUnits > 0 ? totalCost / outputUnits : 0;
        const revenueValue = outputUnits * outputValue;
        const roi =
          totalCost > 0 ? ((revenueValue - totalCost) / totalCost) * 100 : 0;

        return {
          id: agent.id,
          name: agent.name,
          outputUnits,
          totalCost,
          costPerUnit,
          outputValue,
          revenueValue,
          roi,
          unitName,
        };
      })
      .filter((a) => a.outputUnits > 0 || a.outputValue > 0)
      .sort((a, b) => b.roi - a.roi);
  }, [tasks, agents]);

  // Overall totals
  const totals = useMemo(() => {
    const totalCost = agentROIs.reduce((s, a) => s + a.totalCost, 0);
    const totalRevenue = agentROIs.reduce((s, a) => s + a.revenueValue, 0);
    const overallROI =
      totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    return { totalCost, totalRevenue, overallROI };
  }, [agentROIs]);

  // Star performers (top 3 by ROI)
  const starPerformers = agentROIs.filter((a) => a.roi > 0).slice(0, 3);

  if (agentROIs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">{t("noROIData")}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {t("noROIDataDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              ${totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalCost")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totals.totalCost.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("overallROI")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totals.overallROI >= 0 ? "text-emerald-500" : "text-red-500"}`}
            >
              {totals.overallROI >= 0 ? "+" : ""}
              {totals.overallROI.toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Star Performers */}
      {starPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              {t("starPerformers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {starPerformers.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium text-sm">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {agent.outputUnits.toLocaleString()} {agent.unitName} &middot;{" "}
                    {t("cost")}: ${agent.totalCost.toFixed(2)} &middot;{" "}
                    {t("revenue")}: ${agent.revenueValue.toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant="default"
                  className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                >
                  ROI: +{agent.roi.toFixed(0)}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-Agent ROI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agentROIs.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {agent.name}
                </CardTitle>
                {agent.roi > 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{agent.unitName}</span>
                <span className="font-medium">
                  {agent.outputUnits.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("cost")}</span>
                <span className="font-medium">
                  ${agent.totalCost.toFixed(2)}
                </span>
              </div>
              {agent.outputValue > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("revenueValue")}
                  </span>
                  <span className="font-medium text-emerald-500">
                    ${agent.revenueValue.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {t("costPer")} {agent.unitName.toLowerCase()}
                </span>
                <span className="font-medium">
                  ${agent.costPerUnit.toFixed(4)}
                </span>
              </div>
              {agent.outputValue > 0 && (
                <div className="flex justify-between text-xs border-t border-border pt-2">
                  <span className="text-muted-foreground font-medium">
                    ROI
                  </span>
                  <span
                    className={`font-bold ${agent.roi >= 0 ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {agent.roi >= 0 ? "+" : ""}
                    {agent.roi.toFixed(0)}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
