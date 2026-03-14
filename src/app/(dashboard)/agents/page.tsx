"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/use-translations";
import { AgentCard, type AgentWithStats } from "@/components/agents/agent-card";
import { AgentFormModal } from "@/components/agents/agent-form-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Bot } from "lucide-react";
import { toast } from "sonner";
import type { Agent, Team, BudgetEntry, Task, Guardrails } from "@/types/database";

type StatusFilter = "all" | "active" | "paused" | "error" | "stopped";
type TeamFilter = string; // team id or "all"
type ModelFilter = string; // model name or "all"

export default function AgentsPage() {
  const { t } = useTranslations("agents");
  const { t: tCommon } = useTranslations("common");

  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [formModalOpen, setFormModalOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      // Fetch agents, teams, budget entries, and today's tasks in parallel
      const today = new Date().toISOString().split("T")[0];
      const currentMonthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
        .toISOString()
        .split("T")[0];

      const [agentsRes, teamsRes, budgetRes, tasksRes] = await Promise.all([
        supabase.from("agents").select("*").order("name"),
        supabase.from("teams").select("*"),
        supabase
          .from("budget_entries")
          .select("*")
          .eq("period_type", "monthly")
          .gte("period_start", currentMonthStart),
        supabase
          .from("tasks")
          .select("agent_id, status, cost")
          .gte("started_at", `${today}T00:00:00`),
      ]);

      if (agentsRes.error) throw agentsRes.error;
      if (teamsRes.error) throw teamsRes.error;

      const teamsData = (teamsRes.data || []) as Team[];
      const teamsMap = new Map(teamsData.map((t) => [t.id, t]));
      setTeams(teamsData);

      // Build budget map: agent_id -> { allocated, spent }
      const budgetMap = new Map<string, { allocated: number; spent: number }>();
      for (const entry of (budgetRes.data || []) as BudgetEntry[]) {
        if (entry.agent_id) {
          const existing = budgetMap.get(entry.agent_id) || {
            allocated: 0,
            spent: 0,
          };
          existing.allocated += Number(entry.allocated);
          existing.spent += Number(entry.spent);
          budgetMap.set(entry.agent_id, existing);
        }
      }

      // Build today's task stats: agent_id -> { count, cost }
      const taskStatsMap = new Map<
        string,
        { count: number; cost: number }
      >();
      for (const task of (tasksRes.data || []) as Pick<
        Task,
        "agent_id" | "status" | "cost"
      >[]) {
        const existing = taskStatsMap.get(task.agent_id) || {
          count: 0,
          cost: 0,
        };
        existing.count += 1;
        existing.cost += Number(task.cost);
        taskStatsMap.set(task.agent_id, existing);
      }

      // Combine everything
      const enrichedAgents: AgentWithStats[] = (
        agentsRes.data as Agent[]
      ).map((agent) => {
        const budget = budgetMap.get(agent.id) || {
          allocated: 0,
          spent: 0,
        };
        const taskStats = taskStatsMap.get(agent.id) || {
          count: 0,
          cost: 0,
        };

        // Use guardrails max_budget_monthly as allocated if no budget entry
        const allocated =
          budget.allocated > 0
            ? budget.allocated
            : agent.guardrails?.max_budget_monthly || 0;

        return {
          ...agent,
          team: agent.team_id ? teamsMap.get(agent.team_id) || null : null,
          budget_spent: budget.spent,
          budget_allocated: allocated,
          tasks_today: taskStats.count,
          cost_today: taskStats.cost,
        };
      });

      setAgents(enrichedAgents);
    } catch (err) {
      console.error("Failed to load agents:", err);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(
    agentId: string,
    newStatus: "active" | "paused"
  ) {
    const { error } = await supabase
      .from("agents")
      .update({ status: newStatus })
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to update agent status");
      return;
    }

    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, status: newStatus } : a))
    );
    toast.success(
      newStatus === "paused" ? t("agentPaused") : t("agentResumed")
    );
  }

  async function handleCreateAgent(data: {
    name: string;
    description: string | null;
    team_id: string | null;
    model: string;
    fallback_model: string | null;
    tags: string[];
    guardrails: Guardrails;
  }) {
    const { error } = await supabase.from("agents").insert({
      name: data.name,
      description: data.description,
      team_id: data.team_id,
      model: data.model,
      fallback_model: data.fallback_model,
      tags: data.tags,
      guardrails: data.guardrails,
      status: "active",
      metadata: {},
    });

    if (error) {
      toast.error("Failed to create agent");
      return;
    }

    toast.success(t("agentCreated"));
    setFormModalOpen(false);
    loadAgents();
  }

  // Get unique models for filter
  const uniqueModels = useMemo(
    () => [...new Set(agents.map((a) => a.model))].sort(),
    [agents]
  );

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(q);
        const matchesDesc = agent.description?.toLowerCase().includes(q);
        const matchesModel = agent.model.toLowerCase().includes(q);
        const matchesTeam = agent.team?.name.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesModel && !matchesTeam) {
          return false;
        }
      }
      // Status filter
      if (statusFilter !== "all" && agent.status !== statusFilter) return false;
      // Team filter
      if (teamFilter !== "all" && agent.team_id !== teamFilter) return false;
      // Model filter
      if (modelFilter !== "all" && agent.model !== modelFilter) return false;
      return true;
    });
  }, [agents, searchQuery, statusFilter, teamFilter, modelFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setFormModalOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("addAgent")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tCommon("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={t("filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="active">{t("status.active")}</SelectItem>
              <SelectItem value="paused">{t("status.paused")}</SelectItem>
              <SelectItem value="error">{t("status.error")}</SelectItem>
              <SelectItem value="stopped">{t("status.stopped")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={(v) => v && setTeamFilter(v)}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={t("filterTeam")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTeams")}</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modelFilter} onValueChange={(v) => v && setModelFilter(v)}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={t("filterModel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allModels")}</SelectItem>
              {uniqueModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("noAgents")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || statusFilter !== "all" || teamFilter !== "all" || modelFilter !== "all"
              ? t("noAgentsFiltered")
              : t("noAgentsYet")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Add Agent Modal */}
      <AgentFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        teams={teams}
        onSave={handleCreateAgent}
      />
    </div>
  );
}
