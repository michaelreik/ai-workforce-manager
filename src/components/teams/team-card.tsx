"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Eye, Pencil, User } from "lucide-react";
import { useTranslations } from "@/i18n/use-translations";
import type { Team } from "@/types/database";

export type TeamWithStats = Team & {
  agentCount: number;
  budgetSpent: number;
  leadName: string | null;
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

export function TeamCard({
  team,
  onEdit,
}: {
  team: TeamWithStats;
  onEdit?: (team: TeamWithStats) => void;
}) {
  const { t } = useTranslations("teams");

  const budgetPercentage =
    Number(team.budget_monthly) > 0
      ? Math.min(
          Math.round((team.budgetSpent / Number(team.budget_monthly)) * 100),
          100
        )
      : 0;

  return (
    <Card className="group relative transition-colors hover:border-foreground/20">
      {/* Color accent bar */}
      <div
        className="h-1 w-full rounded-t-lg"
        style={{ backgroundColor: team.color }}
      />

      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{team.icon}</span>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {team.name}
            </CardTitle>
            {team.description && (
              <p className="text-xs text-muted-foreground truncate">
                {team.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Team Lead */}
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {team.leadName || t("noLeadAssigned")}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Bot className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {team.agentCount} {t("agentCount")}
            </span>
          </div>
          <span className="text-muted-foreground">
            ${Number(team.budget_monthly).toFixed(2)}
          </span>
        </div>

        {/* Budget Progress */}
        {Number(team.budget_monthly) > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                ${team.budgetSpent.toFixed(2)} / $
                {Number(team.budget_monthly).toFixed(2)}
              </span>
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
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          {onEdit && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => onEdit(team)}
            >
              <Pencil className="h-3 w-3" />
              {t("editTeam")}
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            nativeButton={false}
            render={<Link href={`/teams/${team.id}`} />}
          >
            <Eye className="h-3 w-3" />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
