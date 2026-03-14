"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/use-translations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Pause,
  Play,
  Trash2,
  OctagonX,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { AgentOverviewTab } from "@/components/agents/agent-overview-tab";
import { AgentTaskHistoryTab } from "@/components/agents/agent-task-history-tab";
import { AgentGuardrailsTab } from "@/components/agents/agent-guardrails-tab";
import { AgentAuditLogTab } from "@/components/agents/agent-audit-log-tab";
import type { Agent, Team, Task, BudgetEntry, AuditLog } from "@/types/database";

const statusConfig: Record<
  Agent["status"],
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  active: { variant: "default", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  paused: { variant: "secondary", className: "bg-amber-500/15 text-amber-500 border-amber-500/20" },
  error: { variant: "destructive" },
  stopped: { variant: "outline" },
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const { t } = useTranslations("agents");
  const { t: tCommon } = useTranslations("common");

  const [agent, setAgent] = useState<Agent | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Kill switch dialog
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [killConfirmName, setKillConfirmName] = useState("");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadAgent = useCallback(async () => {
    setLoading(true);
    try {
      const [agentRes, tasksRes, budgetRes, auditRes] = await Promise.all([
        supabase.from("agents").select("*").eq("id", agentId).single(),
        supabase
          .from("tasks")
          .select("*")
          .eq("agent_id", agentId)
          .order("started_at", { ascending: false })
          .limit(500),
        supabase
          .from("budget_entries")
          .select("*")
          .eq("agent_id", agentId)
          .order("period_start", { ascending: false }),
        supabase
          .from("audit_log")
          .select("*")
          .eq("target_type", "agent")
          .eq("target_id", agentId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (agentRes.error || !agentRes.data) {
        toast.error("Agent not found");
        router.push("/agents");
        return;
      }

      const agentData = agentRes.data as Agent;
      setAgent(agentData);
      setTasks((tasksRes.data || []) as Task[]);
      setBudgetEntries((budgetRes.data || []) as BudgetEntry[]);
      setAuditLogs((auditRes.data || []) as AuditLog[]);

      // Fetch team if assigned
      if (agentData.team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("id", agentData.team_id)
          .single();
        setTeam((teamData as Team) || null);
      }
    } catch (err) {
      console.error("Failed to load agent:", err);
      toast.error("Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId, supabase, router]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  async function handleToggleStatus() {
    if (!agent) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("agents")
      .update({ status: newStatus })
      .eq("id", agent.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setAgent({ ...agent, status: newStatus });
    toast.success(newStatus === "paused" ? t("agentPaused") : t("agentResumed"));
  }

  async function handleKillSwitch() {
    if (!agent || killConfirmName !== agent.name) return;
    const { error } = await supabase
      .from("agents")
      .update({ status: "stopped" })
      .eq("id", agent.id);
    if (error) {
      toast.error("Failed to stop agent");
      return;
    }
    setAgent({ ...agent, status: "stopped" });
    setKillDialogOpen(false);
    setKillConfirmName("");
    toast.success(t("agentKilled"));
  }

  async function handleDelete() {
    if (!agent || deleteConfirmName !== agent.name) return;
    const { error } = await supabase.from("agents").delete().eq("id", agent.id);
    if (error) {
      toast.error("Failed to delete agent");
      return;
    }
    toast.success(t("agentDeleted"));
    router.push("/agents");
  }

  async function handleGuardrailsSave(guardrails: Agent["guardrails"]) {
    if (!agent) return;
    const { error } = await supabase
      .from("agents")
      .update({ guardrails })
      .eq("id", agent.id);
    if (error) {
      toast.error("Failed to save guardrails");
      return;
    }
    setAgent({ ...agent, guardrails });
    toast.success(t("guardrailsSaved"));
  }

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

  if (!agent) return null;

  const status = statusConfig[agent.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/agents" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <Badge variant={status.variant} className={status.className}>
                {t(`status.${agent.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {agent.model}
              {team && <> &middot; {team.name}</>}
              {agent.description && <> &middot; {agent.description}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(agent.status === "active" || agent.status === "paused") && (
            <Button variant="outline" size="sm" onClick={handleToggleStatus}>
              {agent.status === "active" ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {agent.status === "active" ? t("pause") : t("resume")}
            </Button>
          )}
          {agent.status !== "stopped" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setKillDialogOpen(true)}
            >
              <OctagonX className="h-4 w-4" />
              {t("kill")}
            </Button>
          )}
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

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("taskHistory")}</TabsTrigger>
          <TabsTrigger value="guardrails">{t("guardrails")}</TabsTrigger>
          <TabsTrigger value="audit">{t("auditLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <AgentOverviewTab
            agent={agent}
            tasks={tasks}
            budgetEntries={budgetEntries}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <AgentTaskHistoryTab tasks={tasks} />
        </TabsContent>

        <TabsContent value="guardrails" className="mt-6">
          <AgentGuardrailsTab
            guardrails={agent.guardrails}
            onSave={handleGuardrailsSave}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AgentAuditLogTab logs={auditLogs} />
        </TabsContent>
      </Tabs>

      {/* Kill Switch Dialog */}
      <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("killConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("killConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("killConfirmType")} <strong>{agent.name}</strong>
            </p>
            <Input
              value={killConfirmName}
              onChange={(e) => setKillConfirmName(e.target.value)}
              placeholder={agent.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={killConfirmName !== agent.name}
              onClick={handleKillSwitch}
            >
              {t("killConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("killConfirmType")} <strong>{agent.name}</strong>
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={agent.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== agent.name}
              onClick={handleDelete}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
