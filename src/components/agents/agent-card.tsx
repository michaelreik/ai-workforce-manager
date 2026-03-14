"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Pause, Play, Eye } from "lucide-react";
import { useTranslations } from "@/i18n/use-translations";
import type { Agent, Team } from "@/types/database";

type AgentWithStats = Agent & {
  team?: Team | null;
  budget_spent: number;
  budget_allocated: number;
  tasks_today: number;
  cost_today: number;
};

const statusConfig: Record<
  Agent["status"],
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  active: { variant: "default", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  paused: { variant: "secondary", className: "bg-amber-500/15 text-amber-500 border-amber-500/20" },
  error: { variant: "destructive" },
  stopped: { variant: "outline" },
};

const teamEmoji: Record<string, string> = {
  "Lead Generation": "\uD83C\uDFAF",
  "Content": "\u270D\uFE0F",
  "Customer Support": "\uD83D\uDCAC",
};

function getBudgetColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function getBudgetTextColor(percentage: number): string {
  if (percentage >= 90) return "text-red-500";
  if (percentage >= 70) return "text-amber-500";
  return "text-emerald-500";
}

export function AgentCard({
  agent,
  onToggleStatus,
}: {
  agent: AgentWithStats;
  onToggleStatus?: (agentId: string, newStatus: "active" | "paused") => void;
}) {
  const { t } = useTranslations("agents");
  const { t: tCommon } = useTranslations("common");

  const budgetPercentage =
    agent.budget_allocated > 0
      ? Math.min(Math.round((agent.budget_spent / agent.budget_allocated) * 100), 100)
      : 0;

  const status = statusConfig[agent.status];
  const emoji = (agent.team?.name && teamEmoji[agent.team.name]) || "\uD83E\uDD16";
  const isPausable = agent.status === "active";
  const isResumable = agent.status === "paused";

  return (
    <Card className="group relative transition-colors hover:border-foreground/20">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{emoji}</span>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {agent.name}
            </CardTitle>
            {agent.team && (
              <p className="text-xs text-muted-foreground truncate">
                {agent.team.name}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={status.variant}
          className={status.className}
        >
          {t(`status.${agent.status}`)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Model */}
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{agent.model}</span>
        </div>

        {/* Budget Progress */}
        {agent.budget_allocated > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("budgetUsed")}</span>
              <span className={getBudgetTextColor(budgetPercentage)}>
                {budgetPercentage}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBudgetColor(budgetPercentage)}`}
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              ${agent.budget_spent.toFixed(2)} / ${agent.budget_allocated.toFixed(2)}
            </p>
          </div>
        )}

        {/* Today's Stats */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="text-xs">
            <span className="text-muted-foreground">{t("tasksToday")}: </span>
            <span className="font-medium">{agent.tasks_today}</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">{t("costToday")}: </span>
            <span className="font-medium">${agent.cost_today.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {(isPausable || isResumable) && onToggleStatus && (
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                onToggleStatus(agent.id, isPausable ? "paused" : "active")
              }
            >
              {isPausable ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {isPausable ? t("pause") : t("resume")}
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            nativeButton={false}
            render={<Link href={`/agents/${agent.id}`} />}
          >
            <Eye className="h-3 w-3" />
            {t("details")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { AgentWithStats };
