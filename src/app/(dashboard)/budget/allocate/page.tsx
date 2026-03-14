"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Save,
  Users,
  Bot,
} from "lucide-react";
import type { Agent, Team, BudgetEntry } from "@/types/database";

type AgentBudgetRow = {
  id: string;
  name: string;
  currentBudget: number;
  currentSpent: number;
  newBudget: number;
  budgetEntryId: string | null;
};

type TeamBudgetRow = {
  team: Team;
  agents: AgentBudgetRow[];
  currentBudget: number;
  currentSpent: number;
  newBudget: number;
  expanded: boolean;
};

export default function BudgetAllocatePage() {
  const { t } = useTranslations("budget");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamRows, setTeamRows] = useState<TeamBudgetRow[]>([]);
  const [orgTotalBudget, setOrgTotalBudget] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchData() {
      setLoading(true);
      try {
        const monthStart = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
          .toISOString()
          .split("T")[0];

        const [teamsRes, agentsRes, budgetRes] = await Promise.all([
          supabase
            .from("teams")
            .select("*")
            .eq("org_id", currentOrg!.id)
            .order("name"),
          supabase
            .from("agents")
            .select("id, name, team_id, guardrails")
            .eq("org_id", currentOrg!.id)
            .order("name"),
          supabase
            .from("budget_entries")
            .select("*")
            .eq("org_id", currentOrg!.id)
            .eq("period_type", "monthly")
            .gte("period_start", monthStart),
        ]);

        const teams = (teamsRes.data || []) as Team[];
        const agents = (agentsRes.data || []) as Pick<
          Agent,
          "id" | "name" | "team_id" | "guardrails"
        >[];
        const budgetEntries = (budgetRes.data || []) as BudgetEntry[];

        // Map budget entries by agent_id
        const budgetByAgent = new Map<
          string,
          { allocated: number; spent: number; entryId: string }
        >();
        for (const entry of budgetEntries) {
          if (entry.agent_id) {
            budgetByAgent.set(entry.agent_id, {
              allocated: Number(entry.allocated),
              spent: Number(entry.spent),
              entryId: entry.id,
            });
          }
        }

        // Build team rows
        const rows: TeamBudgetRow[] = teams.map((team) => {
          const teamAgents = agents.filter((a) => a.team_id === team.id);

          const agentRows: AgentBudgetRow[] = teamAgents.map((agent) => {
            const budgetData = budgetByAgent.get(agent.id);
            const currentBudget =
              budgetData?.allocated ||
              agent.guardrails?.max_budget_monthly ||
              0;
            return {
              id: agent.id,
              name: agent.name,
              currentBudget,
              currentSpent: budgetData?.spent || 0,
              newBudget: currentBudget,
              budgetEntryId: budgetData?.entryId || null,
            };
          });

          const teamBudget = agentRows.reduce(
            (s, a) => s + a.currentBudget,
            0
          );
          const teamSpent = agentRows.reduce(
            (s, a) => s + a.currentSpent,
            0
          );

          return {
            team,
            agents: agentRows,
            currentBudget: teamBudget,
            currentSpent: teamSpent,
            newBudget: teamBudget,
            expanded: false,
          };
        });

        setTeamRows(rows);

        // Calculate org total from team budgets
        const total = rows.reduce((s, r) => s + r.currentBudget, 0);
        setOrgTotalBudget(total);
      } catch (err) {
        console.error("Failed to load allocation data:", err);
        toast.error("Failed to load budget data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentOrg, supabase]);

  const toggleTeamExpanded = useCallback((teamId: string) => {
    setTeamRows((prev) =>
      prev.map((r) =>
        r.team.id === teamId ? { ...r, expanded: !r.expanded } : r
      )
    );
  }, []);

  const updateAgentBudget = useCallback(
    (teamId: string, agentId: string, value: number) => {
      setTeamRows((prev) =>
        prev.map((r) => {
          if (r.team.id !== teamId) return r;
          const updatedAgents = r.agents.map((a) =>
            a.id === agentId ? { ...a, newBudget: value } : a
          );
          const newTeamBudget = updatedAgents.reduce(
            (s, a) => s + a.newBudget,
            0
          );
          return { ...r, agents: updatedAgents, newBudget: newTeamBudget };
        })
      );
    },
    []
  );

  const updateTeamBudget = useCallback(
    (teamId: string, value: number) => {
      setTeamRows((prev) =>
        prev.map((r) => {
          if (r.team.id !== teamId) return r;
          // Distribute proportionally across agents
          const currentTotal = r.agents.reduce(
            (s, a) => s + a.newBudget,
            0
          );
          const ratio = currentTotal > 0 ? value / currentTotal : 0;
          const updatedAgents = r.agents.map((a) => ({
            ...a,
            newBudget:
              currentTotal > 0
                ? Math.round(a.newBudget * ratio * 100) / 100
                : r.agents.length > 0
                  ? Math.round((value / r.agents.length) * 100) / 100
                  : 0,
          }));
          return { ...r, agents: updatedAgents, newBudget: value };
        })
      );
    },
    []
  );

  const totalAllocated = teamRows.reduce((s, r) => s + r.newBudget, 0);
  const unallocated = orgTotalBudget - totalAllocated;

  const hasChanges = teamRows.some((r) =>
    r.agents.some(
      (a) => Math.abs(a.newBudget - a.currentBudget) > 0.001
    )
  );

  async function handleSave() {
    if (!currentOrg) return;
    setSaving(true);

    try {
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
        .toISOString()
        .split("T")[0];

      // Collect all changed agents
      const changes: {
        agentId: string;
        teamId: string;
        newBudget: number;
        entryId: string | null;
      }[] = [];

      for (const team of teamRows) {
        for (const agent of team.agents) {
          if (Math.abs(agent.newBudget - agent.currentBudget) > 0.001) {
            changes.push({
              agentId: agent.id,
              teamId: team.team.id,
              newBudget: agent.newBudget,
              entryId: agent.budgetEntryId,
            });
          }
        }
      }

      // Upsert budget entries
      for (const change of changes) {
        if (change.entryId) {
          // Update existing entry
          await supabase
            .from("budget_entries")
            .update({ allocated: change.newBudget })
            .eq("id", change.entryId);
        } else {
          // Insert new entry
          await supabase.from("budget_entries").insert({
            org_id: currentOrg.id,
            agent_id: change.agentId,
            team_id: change.teamId,
            period_type: "monthly",
            period_start: monthStart,
            allocated: change.newBudget,
            spent: 0,
          });
        }

        // Create audit log entry
        await supabase.from("audit_log").insert({
          org_id: currentOrg.id,
          action: "budget_changed",
          target_type: "agent",
          target_id: change.agentId,
          details: {
            field: "allocated_monthly",
            old_value: teamRows
              .flatMap((r) => r.agents)
              .find((a) => a.id === change.agentId)?.currentBudget,
            new_value: change.newBudget,
          },
        });
      }

      // Update team budget_monthly fields
      for (const team of teamRows) {
        const teamNewTotal = team.agents.reduce(
          (s, a) => s + a.newBudget,
          0
        );
        if (Math.abs(teamNewTotal - team.currentBudget) > 0.001) {
          await supabase
            .from("teams")
            .update({ budget_monthly: teamNewTotal })
            .eq("id", team.team.id);
        }
      }

      toast.success(t("changesSaved"));

      // Update current values to match new values
      setTeamRows((prev) =>
        prev.map((r) => ({
          ...r,
          currentBudget: r.newBudget,
          currentSpent: r.currentSpent,
          agents: r.agents.map((a) => ({
            ...a,
            currentBudget: a.newBudget,
          })),
        }))
      );
      setOrgTotalBudget(totalAllocated);
    } catch (err) {
      console.error("Failed to save budget allocation:", err);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/budget" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("allocate")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("allocateSubtitle")}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4" />
          {saving ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t("orgBudget")}:
                </span>{" "}
                <span className="font-semibold">
                  ${orgTotalBudget.toFixed(2)}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div>
                <span className="text-muted-foreground">
                  {t("allocated")}:
                </span>{" "}
                <span className="font-semibold">
                  ${totalAllocated.toFixed(2)}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div>
                <span className="text-muted-foreground">
                  {t("unallocated")}:
                </span>{" "}
                <span
                  className={`font-semibold ${unallocated < 0 ? "text-destructive" : ""}`}
                >
                  ${unallocated.toFixed(2)}
                </span>
              </div>
            </div>
            {unallocated < 0 && (
              <Badge variant="destructive">{t("overAllocated")}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team list */}
      <div className="space-y-4">
        {teamRows.map((row) => {
          const pct =
            row.newBudget > 0
              ? Math.round((row.currentSpent / row.newBudget) * 100)
              : 0;

          return (
            <Card key={row.team.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={() => toggleTeamExpanded(row.team.id)}
                    className="flex items-center gap-2 text-left cursor-pointer"
                  >
                    {row.expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-sm font-semibold">
                      {row.team.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {row.agents.length}
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t("spent")}: ${row.currentSpent.toFixed(2)} ({pct}%)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={row.newBudget || ""}
                        onChange={(e) =>
                          updateTeamBudget(
                            row.team.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-28 h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>

              {row.expanded && row.agents.length > 0 && (
                <CardContent className="pt-0">
                  <Separator className="mb-3" />
                  <div className="space-y-2">
                    {row.agents.map((agent) => {
                      const agentPct =
                        agent.newBudget > 0
                          ? Math.round(
                              (agent.currentSpent / agent.newBudget) * 100
                            )
                          : 0;
                      const changed =
                        Math.abs(agent.newBudget - agent.currentBudget) > 0.001;

                      return (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between gap-4 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">
                              {agent.name}
                            </span>
                            {changed && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {t("changed")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {t("spent")}: ${agent.currentSpent.toFixed(2)} (
                              {agentPct}%)
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={agent.newBudget || ""}
                                onChange={(e) =>
                                  updateAgentBudget(
                                    row.team.id,
                                    agent.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24 h-7 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
