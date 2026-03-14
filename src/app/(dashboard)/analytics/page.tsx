"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/use-translations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsCostOverview } from "@/components/analytics/cost-overview";
import { AnalyticsAgentPerformance } from "@/components/analytics/agent-performance";
import { AnalyticsModelComparison } from "@/components/analytics/model-comparison";
import { AnalyticsROI } from "@/components/analytics/roi-section";
import { AnalyticsRecommendations } from "@/components/analytics/recommendations";
import type { Agent, Task, Team, BudgetEntry } from "@/types/database";

type DateRange = "7d" | "30d" | "90d";

export default function AnalyticsPage() {
  const { t } = useTranslations("analytics");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const supabase = useMemo(() => createClient(), []);

  const rangeStart = useMemo(() => {
    const d = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [dateRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tasksRes, agentsRes, teamsRes, budgetRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .gte("started_at", rangeStart)
        .order("started_at", { ascending: false }),
      supabase.from("agents").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("budget_entries").select("*").eq("period_type", "monthly"),
    ]);

    setTasks((tasksRes.data || []) as Task[]);
    setAgents((agentsRes.data || []) as Agent[]);
    setTeams((teamsRes.data || []) as Team[]);
    setBudgetEntries((budgetRes.data || []) as BudgetEntry[]);
    setLoading(false);
  }, [supabase, rangeStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dateRangeButtons: { key: DateRange; label: string }[] = [
    { key: "7d", label: t("last7Days") },
    { key: "30d", label: t("last30Days") },
    { key: "90d", label: t("last90Days") },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {dateRangeButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={dateRange === btn.key ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setDateRange(btn.key)}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cost">
        <TabsList>
          <TabsTrigger value="cost">{t("costOverview")}</TabsTrigger>
          <TabsTrigger value="performance">{t("agentPerformance")}</TabsTrigger>
          <TabsTrigger value="models">{t("modelComparison")}</TabsTrigger>
          <TabsTrigger value="roi">{t("roi")}</TabsTrigger>
          <TabsTrigger value="recommendations">{t("recommendations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cost" className="mt-6">
          <AnalyticsCostOverview
            tasks={tasks}
            agents={agents}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <AnalyticsAgentPerformance
            tasks={tasks}
            agents={agents}
            teams={teams}
          />
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          <AnalyticsModelComparison tasks={tasks} agents={agents} />
        </TabsContent>

        <TabsContent value="roi" className="mt-6">
          <AnalyticsROI tasks={tasks} agents={agents} />
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <AnalyticsRecommendations
            tasks={tasks}
            agents={agents}
            teams={teams}
            budgetEntries={budgetEntries}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
