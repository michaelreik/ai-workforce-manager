"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/use-translations";
import {
  ArrowDownCircle,
  AlertTriangle,
  XCircle,
  DollarSign,
  PauseCircle,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import type { Agent, Task, Team, BudgetEntry } from "@/types/database";

type Recommendation = {
  id: string;
  severity: "info" | "warning" | "critical";
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  impact: string;
  actionLabel: string;
  actionHref: string;
};

export function AnalyticsRecommendations({
  tasks,
  agents,
  teams,
  budgetEntries,
}: {
  tasks: Task[];
  agents: Agent[];
  teams: Team[];
  budgetEntries: BudgetEntry[];
}) {
  const { t } = useTranslations("analytics");

  const recommendations: Recommendation[] = useMemo(() => {
    const recs: Recommendation[] = [];

    for (const agent of agents) {
      if (agent.status !== "active" && agent.status !== "paused") continue;

      const agentTasks = tasks.filter((tt) => tt.agent_id === agent.id);

      // Rule 1: Expensive model that could be downgraded
      const expensiveModels = ["gpt-4o", "claude-opus"];
      const cheaperAlts: Record<string, string> = {
        "gpt-4o": "gpt-4o-mini",
        "claude-opus": "claude-sonnet",
      };

      if (expensiveModels.includes(agent.model) && agentTasks.length > 10) {
        const qualityTasks = agentTasks.filter(
          (tt) => tt.result_quality != null
        );
        const avgQuality =
          qualityTasks.length > 0
            ? qualityTasks.reduce(
                (s, tt) => s + (tt.result_quality || 0),
                0
              ) / qualityTasks.length
            : 0;

        if (avgQuality >= 0.8 || qualityTasks.length === 0) {
          const totalCost = agentTasks.reduce(
            (s, tt) => s + Number(tt.cost),
            0
          );
          const alt = cheaperAlts[agent.model];
          const estimatedSavings = totalCost * 0.7;

          recs.push({
            id: `downgrade-${agent.id}`,
            severity: "info",
            icon: ArrowDownCircle,
            title: t("recDowngradeTitle").replace("{agent}", agent.name),
            description: t("recDowngradeDesc")
              .replace("{from}", agent.model)
              .replace("{to}", alt),
            impact: t("recSavings").replace(
              "{amount}",
              estimatedSavings.toFixed(2)
            ),
            actionLabel: t("recViewAgent"),
            actionHref: `/agents/${agent.id}`,
          });
        }
      }

      // Rule 2: Cost increase >50%
      if (agentTasks.length > 20) {
        const mid = new Date();
        mid.setDate(mid.getDate() - 15);
        const midStr = mid.toISOString();

        const recentCost = agentTasks
          .filter((tt) => tt.started_at >= midStr)
          .reduce((s, tt) => s + Number(tt.cost), 0);
        const olderCost = agentTasks
          .filter((tt) => tt.started_at < midStr)
          .reduce((s, tt) => s + Number(tt.cost), 0);

        if (olderCost > 0) {
          const increase = ((recentCost - olderCost) / olderCost) * 100;
          if (increase > 50) {
            recs.push({
              id: `cost-increase-${agent.id}`,
              severity: "warning",
              icon: AlertTriangle,
              title: t("recCostIncreaseTitle").replace("{agent}", agent.name),
              description: t("recCostIncreaseDesc").replace(
                "{pct}",
                increase.toFixed(0)
              ),
              impact: t("recCostImpact")
                .replace("{old}", olderCost.toFixed(2))
                .replace("{new}", recentCost.toFixed(2)),
              actionLabel: t("recViewAgent"),
              actionHref: `/agents/${agent.id}`,
            });
          }
        }
      }

      // Rule 3: High error rate
      if (agentTasks.length > 5) {
        const failed = agentTasks.filter((tt) => tt.status === "failed");
        const errorRate = (failed.length / agentTasks.length) * 100;
        if (errorRate > 20) {
          recs.push({
            id: `error-rate-${agent.id}`,
            severity: "critical",
            icon: XCircle,
            title: t("recErrorTitle").replace("{agent}", agent.name),
            description: t("recErrorDesc").replace(
              "{pct}",
              errorRate.toFixed(0)
            ),
            impact: `${failed.length} / ${agentTasks.length} ${t("tasksFailed")}`,
            actionLabel: t("recViewAgent"),
            actionHref: `/agents/${agent.id}`,
          });
        }
      }

      // Rule 5: Idle agent
      if (agent.status === "active") {
        const lastTask = agentTasks[0]; // sorted desc by started_at
        if (lastTask) {
          const daysSinceLastTask = Math.floor(
            (Date.now() - new Date(lastTask.started_at).getTime()) / // eslint-disable-line react-hooks/purity
              (1000 * 60 * 60 * 24)
          );
          if (daysSinceLastTask >= 7) {
            recs.push({
              id: `idle-${agent.id}`,
              severity: "info",
              icon: PauseCircle,
              title: t("recIdleTitle").replace("{agent}", agent.name),
              description: t("recIdleDesc").replace(
                "{days}",
                String(daysSinceLastTask)
              ),
              impact: t("recIdleImpact"),
              actionLabel: t("recViewAgent"),
              actionHref: `/agents/${agent.id}`,
            });
          }
        } else if (agentTasks.length === 0) {
          recs.push({
            id: `idle-${agent.id}`,
            severity: "info",
            icon: PauseCircle,
            title: t("recIdleTitle").replace("{agent}", agent.name),
            description: t("recIdleNoTasks"),
            impact: t("recIdleImpact"),
            actionLabel: t("recViewAgent"),
            actionHref: `/agents/${agent.id}`,
          });
        }
      }
    }

    // Rule 4: Team budget >90% used with >10 days remaining
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

    if (daysLeft > 10) {
      for (const team of teams) {
        if (team.budget_monthly <= 0) continue;

        const teamAgentIds = new Set(
          agents.filter((a) => a.team_id === team.id).map((a) => a.id)
        );
        const teamCost = tasks
          .filter((tt) => teamAgentIds.has(tt.agent_id))
          .reduce((s, tt) => s + Number(tt.cost), 0);
        const pct = (teamCost / team.budget_monthly) * 100;

        if (pct > 90) {
          const projected =
            (teamCost / (now.getDate())) *
            new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const overBy = projected - team.budget_monthly;

          recs.push({
            id: `team-budget-${team.id}`,
            severity: "warning",
            icon: DollarSign,
            title: t("recTeamBudgetTitle").replace("{team}", team.name),
            description: t("recTeamBudgetDesc")
              .replace("{pct}", pct.toFixed(0))
              .replace("{days}", String(daysLeft)),
            impact: t("recTeamBudgetImpact").replace(
              "{amount}",
              overBy.toFixed(2)
            ),
            actionLabel: t("recViewBudget"),
            actionHref: "/budget",
          });
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return recs.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }, [tasks, agents, teams, budgetEntries, t]);

  const severityColors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-500 border-red-500/20",
    warning: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    info: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  };

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">{t("noRecommendations")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("noRecommendationsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <Card key={rec.id}>
          <CardContent className="flex items-start gap-4 p-4">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${severityColors[rec.severity].split(" ").slice(0, 1).join(" ")}`}
            >
              <rec.icon
                className={`h-5 w-5 ${severityColors[rec.severity].split(" ").slice(1, 2).join(" ")}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">{rec.title}</p>
                <Badge
                  variant="outline"
                  className={severityColors[rec.severity]}
                >
                  {rec.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {rec.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {rec.impact}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={rec.actionHref} />}
            >
              {rec.actionLabel}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
