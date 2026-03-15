"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  DollarSign,
  Pencil,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import { AgentCard, type AgentWithStats } from "@/components/agents/agent-card";
import { AgentAuditLogTab } from "@/components/agents/agent-audit-log-tab";
import { TeamFormModal } from "@/components/teams/team-form-modal";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type {
  Team,
  Agent,
  Task,
  BudgetEntry,
  AuditLog,
  TeamMember,
  OrgMember,
} from "@/types/database";

type DailySpend = {
  date: string;
  label: string;
  cumulative: number;
};

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const { t } = useTranslations("teams");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg } = useOrg();

  const [team, setTeam] = useState<Team | null>(null);
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dailyData, setDailyData] = useState<DailySpend[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalSpent, setTotalSpent] = useState(0);
  const [avgSuccessRate, setAvgSuccessRate] = useState(0);

  // Dialogs
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [addAgentDialogOpen, setAddAgentDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const [
        teamRes,
        agentsRes,
        allAgentsRes,
        tasksRes,
        budgetRes,
        auditRes,
        membersRes,
        orgMembersRes,
      ] = await Promise.all([
        supabase.from("teams").select("*").eq("id", teamId).single(),
        supabase.from("agents").select("*").eq("team_id", teamId).order("name"),
        supabase.from("agents").select("*").order("name"),
        supabase
          .from("tasks")
          .select("agent_id, status, cost, started_at")
          .gte("started_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("budget_entries")
          .select("*")
          .eq("period_type", "monthly")
          .gte("period_start", currentMonthStart),
        supabase
          .from("audit_log")
          .select("*")
          .eq("target_type", "team")
          .eq("target_id", teamId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("team_members").select("*").eq("team_id", teamId),
        supabase.from("org_members").select("*"),
      ]);

      if (teamRes.error || !teamRes.data) {
        toast.error("Team not found");
        router.push("/teams");
        return;
      }

      const teamData = teamRes.data as Team;
      setTeam(teamData);
      setAllAgents((allAgentsRes.data || []) as Agent[]);
      setAuditLogs((auditRes.data || []) as AuditLog[]);
      setMembers((membersRes.data || []) as TeamMember[]);
      setOrgMembers((orgMembersRes.data || []) as OrgMember[]);

      const teamAgents = (agentsRes.data || []) as Agent[];
      const tasksData = (tasksRes.data || []) as Pick<
        Task,
        "agent_id" | "status" | "cost" | "started_at"
      >[];
      const budgetData = (budgetRes.data || []) as BudgetEntry[];

      // Build budget map for agents
      const budgetMap = new Map<string, { allocated: number; spent: number }>();
      for (const entry of budgetData) {
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

      // Today's task stats
      const today = now.toISOString().split("T")[0];
      const taskStatsMap = new Map<string, { count: number; cost: number }>();
      for (const task of tasksData) {
        if (task.started_at.startsWith(today)) {
          const existing = taskStatsMap.get(task.agent_id) || {
            count: 0,
            cost: 0,
          };
          existing.count += 1;
          existing.cost += Number(task.cost);
          taskStatsMap.set(task.agent_id, existing);
        }
      }

      // Enrich agents
      const enrichedAgents: AgentWithStats[] = teamAgents.map((agent) => {
        const budget = budgetMap.get(agent.id) || { allocated: 0, spent: 0 };
        const taskStats = taskStatsMap.get(agent.id) || { count: 0, cost: 0 };
        const allocated =
          budget.allocated > 0
            ? budget.allocated
            : agent.guardrails?.max_budget_monthly || 0;

        return {
          ...agent,
          team: teamData,
          budget_spent: budget.spent,
          budget_allocated: allocated,
          tasks_today: taskStats.count,
          cost_today: taskStats.cost,
        };
      });
      setAgents(enrichedAgents);

      // Team-level stats
      const teamBudgetEntries = budgetData.filter(
        (e) => e.team_id === teamId
      );
      const spent = teamBudgetEntries.reduce(
        (s, e) => s + Number(e.spent),
        0
      );
      setTotalSpent(spent);

      // Success rate from tasks for team agents
      const teamAgentIds = new Set(teamAgents.map((a) => a.id));
      const teamTasks = tasksData.filter((t) => teamAgentIds.has(t.agent_id));
      const completedTasks = teamTasks.filter(
        (t) => t.status === "completed"
      ).length;
      setAvgSuccessRate(
        teamTasks.length > 0
          ? Math.round((completedTasks / teamTasks.length) * 100)
          : 0
      );

      // Daily cumulative spend chart
      const dailyMap = new Map<string, number>();
      const teamTasksAll = tasksData.filter((t) =>
        teamAgentIds.has(t.agent_id)
      );
      for (const task of teamTasksAll) {
        const day = task.started_at.split("T")[0];
        dailyMap.set(day, (dailyMap.get(day) || 0) + Number(task.cost));
      }

      const chartData: DailySpend[] = [];
      let cumulative = 0;
      for (let i = 30; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const daySpend = dailyMap.get(dateStr) || 0;
        cumulative += daySpend;
        chartData.push({
          date: dateStr,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          cumulative: Number(cumulative.toFixed(2)),
        });
      }
      setDailyData(chartData);
    } catch (err) {
      console.error("Failed to load team:", err);
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [teamId, supabase, router]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function handleEditTeam(data: {
    name: string;
    description: string | null;
    icon: string;
    color: string;
    budget_monthly: number;
    lead_user_id: string | null;
  }) {
    if (!team) return;

    const { error } = await supabase
      .from("teams")
      .update({
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        budget_monthly: data.budget_monthly,
        lead_user_id: data.lead_user_id,
      })
      .eq("id", team.id);

    if (error) {
      toast.error("Failed to update team");
      return;
    }

    if (currentOrg) {
      await supabase.from("audit_log").insert({
        org_id: currentOrg.id,
        action: "team_updated",
        target_type: "team",
        target_id: team.id,
        details: { name: data.name },
      });
    }

    toast.success(t("teamUpdated"));
    setEditModalOpen(false);
    loadTeam();
  }

  async function handleDelete() {
    if (!team || deleteConfirmName !== team.name) return;

    await supabase
      .from("agents")
      .update({ team_id: null })
      .eq("team_id", team.id);

    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", team.id);

    if (error) {
      toast.error("Failed to delete team");
      return;
    }

    if (currentOrg) {
      await supabase.from("audit_log").insert({
        org_id: currentOrg.id,
        action: "team_deleted",
        target_type: "team",
        target_id: team.id,
        details: { name: team.name },
      });
    }

    toast.success(t("teamDeleted"));
    router.push("/teams");
  }

  async function handleAddAgent() {
    if (!selectedAgentId || !team) return;

    const { error } = await supabase
      .from("agents")
      .update({ team_id: team.id })
      .eq("id", selectedAgentId);

    if (error) {
      toast.error("Failed to add agent");
      return;
    }

    toast.success(t("agentAdded"));
    setAddAgentDialogOpen(false);
    setSelectedAgentId("");
    loadTeam();
  }

  async function handleRemoveAgent(agentId: string) {
    const { error } = await supabase
      .from("agents")
      .update({ team_id: null })
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to remove agent");
      return;
    }

    toast.success(t("agentRemoved"));
    loadTeam();
  }

  async function handleAddMember() {
    if (!selectedMemberId || !team) return;

    const { error } = await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: selectedMemberId,
      role: "member",
    });

    if (error) {
      toast.error("Failed to add member");
      return;
    }

    toast.success(t("memberAdded"));
    setAddMemberDialogOpen(false);
    setSelectedMemberId("");
    loadTeam();
  }

  async function handleRemoveMember(memberId: string) {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error("Failed to remove member");
      return;
    }

    toast.success(t("memberRemoved"));
    loadTeam();
  }

  // Unassigned agents for the "Add Agent" dialog
  const unassignedAgents = useMemo(
    () => allAgents.filter((a) => !a.team_id),
    [allAgents]
  );

  // Org members not already in the team
  const availableMembers = useMemo(() => {
    const existingUserIds = new Set(members.map((m) => m.user_id));
    return orgMembers.filter((m) => !existingUserIds.has(m.user_id));
  }, [orgMembers, members]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!team) return null;

  const orgMemberEmails = orgMembers.map((m) => ({
    user_id: m.user_id,
    email: m.user_id.slice(0, 8) + "...",
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/teams" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="h-8 w-1 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{team.icon}</span>
              <h1 className="text-2xl font-bold">{team.name}</h1>
            </div>
            {team.description && (
              <p className="text-sm text-muted-foreground">
                {team.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditModalOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            {tCommon("edit")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {tCommon("delete")}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("agentCount")}
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("budgetAllocated")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(team.budget_monthly).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("budgetSpent")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalSpent.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("successRate")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">{t("agents")}</TabsTrigger>
          <TabsTrigger value="members">{t("members")}</TabsTrigger>
          <TabsTrigger value="budget">{t("budget")}</TabsTrigger>
          <TabsTrigger value="activity">{t("activity")}</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("agents")}</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddAgentDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t("addAgent")}
              </Button>
            </div>

            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">{t("noAgents")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("noAgentsDesc")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="relative">
                    <AgentCard agent={agent} />
                    <Button
                      variant="ghost"
                      size="xs"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveAgent(agent.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("members")}</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddMemberDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t("addMember")}
              </Button>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">{t("noMembers")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("noMembersDesc")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {member.user_id.slice(0, 8)}...
                          </p>
                          <Badge
                            variant="secondary"
                            className="text-xs mt-0.5"
                          >
                            {member.role === "lead"
                              ? t("roleLead")
                              : t("roleMember")}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <X className="h-3 w-3" />
                        {t("removeMember")}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("budgetTimeline")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient
                        id="colorTeamSpend"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={team.color}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={team.color}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [
                        `$${Number(value).toFixed(2)}`,
                        t("cumulativeSpend"),
                      ]}
                      labelFormatter={(label) => String(label)}
                    />
                    {Number(team.budget_monthly) > 0 && (
                      <ReferenceLine
                        y={Number(team.budget_monthly)}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="6 3"
                        label={{
                          value: t("budgetLimit"),
                          position: "insideTopRight",
                          fill: "hsl(var(--destructive))",
                          fontSize: 11,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke={team.color}
                      strokeWidth={2}
                      fill="url(#colorTeamSpend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("noData")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <AgentAuditLogTab logs={auditLogs} />
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <TeamFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        team={team}
        orgMembers={orgMemberEmails}
        onSave={handleEditTeam}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("deleteConfirmType")} <strong>{team.name}</strong>
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={team.name}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== team.name}
              onClick={handleDelete}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Agent Dialog */}
      <Dialog open={addAgentDialogOpen} onOpenChange={setAddAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addAgent")}</DialogTitle>
          </DialogHeader>
          {unassignedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {t("noUnassignedAgents")}
            </p>
          ) : (
            <Select
              value={selectedAgentId || undefined}
              onValueChange={(v) => v && setSelectedAgentId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectAgent")} />
              </SelectTrigger>
              <SelectContent>
                {unassignedAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddAgentDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!selectedAgentId}
              onClick={handleAddAgent}
            >
              {t("addAgent")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={addMemberDialogOpen}
        onOpenChange={setAddMemberDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addMember")}</DialogTitle>
          </DialogHeader>
          {availableMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {t("noUnassignedAgents")}
            </p>
          ) : (
            <Select
              value={selectedMemberId || undefined}
              onValueChange={(v) => v && setSelectedMemberId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectMember")} />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.user_id.slice(0, 8)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddMemberDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!selectedMemberId}
              onClick={handleAddMember}
            >
              {t("addMember")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
