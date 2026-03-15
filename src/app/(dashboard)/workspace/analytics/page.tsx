"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  Users,
  Bot,
  TrendingUp,
  BarChart3,
  Cable,
} from "lucide-react";
import type {
  UsageSource,
  WorkspaceMember,
  HumanUsage,
  MemberToolAssignment,
  Agent,
  BudgetEntry,
} from "@/types/database";

type SourceSpend = {
  name: string;
  humanCost: number;
  seatCost: number;
};

type TeamUsage = {
  team: string;
  messages: number;
  members: number;
};

export default function WorkspaceAnalyticsPage() {
  const { t } = useTranslations("workspace");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [loading, setLoading] = useState(true);

  // Data
  const [sources, setSources] = useState<UsageSource[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [humanUsage, setHumanUsage] = useState<HumanUsage[]>([]);
  const [assignments, setAssignments] = useState<MemberToolAssignment[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [agentSpend, setAgentSpend] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchAll() {
      setLoading(true);
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
        .toISOString()
        .split("T")[0];

      const [sourcesRes, membersRes, usageRes, assignRes, agentsRes, budgetRes] =
        await Promise.all([
          supabase.from("usage_sources").select("*").eq("org_id", currentOrg!.id),
          supabase.from("workspace_members").select("*").eq("org_id", currentOrg!.id),
          supabase
            .from("human_usage")
            .select("*")
            .eq("org_id", currentOrg!.id)
            .gte("date", monthStart),
          supabase.from("member_tool_assignments").select("*").eq("org_id", currentOrg!.id),
          supabase
            .from("agents")
            .select("id")
            .eq("org_id", currentOrg!.id)
            .eq("status", "active"),
          supabase
            .from("budget_entries")
            .select("spent")
            .eq("org_id", currentOrg!.id)
            .eq("period_type", "monthly")
            .gte("period_start", monthStart),
        ]);

      setSources((sourcesRes.data || []) as UsageSource[]);
      setMembers((membersRes.data || []) as WorkspaceMember[]);
      setHumanUsage((usageRes.data || []) as HumanUsage[]);
      setAssignments((assignRes.data || []) as MemberToolAssignment[]);
      setAgentCount(agentsRes.data?.length || 0);
      setAgentSpend(
        ((budgetRes.data || []) as Pick<BudgetEntry, "spent">[]).reduce(
          (s, e) => s + Number(e.spent),
          0
        )
      );
      setLoading(false);
    }

    fetchAll();
  }, [currentOrg, supabase]);

  // Computed stats
  const totalSeatCost = assignments.reduce(
    (s, a) => s + Number(a.monthly_cost),
    0
  );
  const humanApiCost = humanUsage.reduce((s, u) => s + Number(u.cost), 0);
  const totalAISpend = agentSpend + totalSeatCost + humanApiCost;

  const activeMembers = new Set(
    humanUsage.filter((u) => u.messages_count > 0).map((u) => u.member_id)
  ).size;

  const adoptionRate =
    members.length > 0
      ? Math.round((activeMembers / members.length) * 100)
      : 0;

  // Spend by source
  const sourceMap = new Map(sources.map((s) => [s.id, s.name]));
  const spendBySource: SourceSpend[] = sources.map((source) => {
    const sourceUsage = humanUsage.filter((u) => u.source_id === source.id);
    const sourceAssignments = assignments.filter(
      (a) => a.source_id === source.id
    );
    return {
      name: source.name,
      humanCost: sourceUsage.reduce((s, u) => s + Number(u.cost), 0),
      seatCost: sourceAssignments.reduce(
        (s, a) => s + Number(a.monthly_cost),
        0
      ),
    };
  });

  // Usage by team
  const teamUsage: TeamUsage[] = [];
  const teamMap = new Map<string, { messages: number; memberIds: Set<string> }>();
  for (const u of humanUsage) {
    const member = members.find((m) => m.id === u.member_id);
    const team = member?.department || "Unassigned";
    const entry = teamMap.get(team) || { messages: 0, memberIds: new Set() };
    entry.messages += u.messages_count;
    if (u.member_id) entry.memberIds.add(u.member_id);
    teamMap.set(team, entry);
  }
  for (const [team, data] of teamMap) {
    teamUsage.push({
      team,
      messages: data.messages,
      members: data.memberIds.size,
    });
  }
  teamUsage.sort((a, b) => b.messages - a.messages);

  // Power users
  const memberMessages = new Map<string, number>();
  for (const u of humanUsage) {
    if (u.member_id) {
      memberMessages.set(
        u.member_id,
        (memberMessages.get(u.member_id) || 0) + u.messages_count
      );
    }
  }
  const powerUsers = Array.from(memberMessages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([memberId, messages]) => {
      const member = members.find((m) => m.id === memberId);
      return {
        name: member?.name || member?.email || "Unknown",
        department: member?.department || "—",
        messages,
      };
    });

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const hasData = sources.length > 0 || agentCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("analyticsTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("analyticsSubtitle")}
        </p>
      </div>

      {!hasData ? (
        <EmptyState
          icon={Cable}
          title={t("noData")}
          description={t("noDataDesc")}
          actionLabel={t("addSource")}
          actionHref="/workspace/sources"
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("totalAISpend")}
                  </p>
                  <p className="text-2xl font-bold">
                    ${totalAISpend.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("activeUsers")}
                  </p>
                  <p className="text-2xl font-bold">{activeMembers}</p>
                  <p className="text-xs text-muted-foreground">
                    of {members.length}
                  </p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("activeAgents")}
                  </p>
                  <p className="text-2xl font-bold">{agentCount}</p>
                </div>
                <Bot className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("adoptionRate")}
                  </p>
                  <p className="text-2xl font-bold">{adoptionRate}%</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
              <TabsTrigger value="people">{t("people")}</TabsTrigger>
              <TabsTrigger value="tools">{t("tools")}</TabsTrigger>
              <TabsTrigger value="cost">{t("costAnalysis")}</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Spend by Source */}
              {spendBySource.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("spendBySource")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={spendBySource}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `$${v}`}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="seatCost"
                          stackId="a"
                          fill="var(--color-primary)"
                          name="Seat Costs"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="humanCost"
                          stackId="a"
                          fill="var(--color-primary)"
                          opacity={0.5}
                          name="API Usage"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Usage by Team */}
              {teamUsage.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("usageByTeam")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={teamUsage} layout="vertical">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="team"
                          type="category"
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          width={100}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="messages"
                          fill="var(--color-primary)"
                          name="Messages"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* People Tab */}
            <TabsContent value="people" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("powerUsers")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {powerUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t("noData")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {powerUsers.map((user, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-muted-foreground w-6">
                              #{i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium">
                                {user.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {user.department}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {user.messages} {t("messages")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("usageByTool")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t("noData")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sources.map((source) => {
                        const sourceUsage = humanUsage.filter(
                          (u) => u.source_id === source.id
                        );
                        const totalMessages = sourceUsage.reduce(
                          (s, u) => s + u.messages_count,
                          0
                        );
                        const uniqueUsers = new Set(
                          sourceUsage.map((u) => u.member_id)
                        ).size;

                        return (
                          <div
                            key={source.id}
                            className="flex items-center justify-between rounded-lg border border-border p-3"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {source.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {source.provider} · {source.product}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span>
                                {uniqueUsers} {t("users")}
                              </span>
                              <span>
                                {totalMessages} {t("messages")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cost Analysis Tab */}
            <TabsContent value="cost" className="space-y-6 mt-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">
                      Agent API Costs
                    </p>
                    <p className="text-xl font-bold">
                      ${agentSpend.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">
                      Human Seat Licenses
                    </p>
                    <p className="text-xl font-bold">
                      ${totalSeatCost.toFixed(2)}{t("perMonth")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">
                      Human API Usage
                    </p>
                    <p className="text-xl font-bold">
                      ${humanApiCost.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
