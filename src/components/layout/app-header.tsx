"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Bell,
  LogOut,
  Settings,
  User,
  Circle,
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/(auth)/actions";
import { toast } from "sonner";
import Link from "next/link";
import type { Alert, Agent } from "@/types/database";

type HeaderStats = {
  dailySpent: number;
  dailyAllocated: number;
  activeAgents: number;
  unacknowledgedAlerts: number;
};

const MAX_DROPDOWN_ALERTS = 8;

const severityIcon = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
} as const;

const severityColor = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
} as const;

export function AppHeader() {
  const { t } = useTranslations("header");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState<HeaderStats | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchStats() {
      const today = new Date().toISOString().split("T")[0];

      const [budgetRes, agentsRes, alertsRes] = await Promise.all([
        supabase
          .from("budget_entries")
          .select("allocated, spent")
          .eq("org_id", currentOrg!.id)
          .eq("period_type", "daily")
          .eq("period_start", today),
        supabase
          .from("agents")
          .select("id")
          .eq("org_id", currentOrg!.id)
          .eq("status", "active"),
        supabase
          .from("alerts")
          .select("*")
          .eq("org_id", currentOrg!.id)
          .eq("acknowledged", false)
          .order("created_at", { ascending: false })
          .limit(MAX_DROPDOWN_ALERTS),
      ]);

      const budgetEntries = budgetRes.data || [];
      const dailySpent = budgetEntries.reduce(
        (sum, e) => sum + Number(e.spent),
        0
      );
      const dailyAllocated = budgetEntries.reduce(
        (sum, e) => sum + Number(e.allocated),
        0
      );

      setRecentAlerts((alertsRes.data || []) as Alert[]);

      // Get total unack count (may be more than dropdown limit)
      const { count } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("org_id", currentOrg!.id)
        .eq("acknowledged", false);

      setStats({
        dailySpent,
        dailyAllocated,
        activeAgents: agentsRes.data?.length || 0,
        unacknowledgedAlerts: count || 0,
      });
    }

    fetchStats();
  }, [currentOrg, supabase]);

  // Realtime: alert changes
  const handleAlertInsert = useCallback(
    (record: Alert) => {
      setStats((prev) =>
        prev
          ? { ...prev, unacknowledgedAlerts: prev.unacknowledgedAlerts + 1 }
          : prev
      );
      // Add to dropdown
      setRecentAlerts((prev) =>
        [record, ...prev].slice(0, MAX_DROPDOWN_ALERTS)
      );
      // Toast for critical alerts
      if (record.severity === "critical") {
        toast.error(record.message, {
          duration: 8000,
          action: record.agent_id
            ? {
                label: t("viewAlert"),
                onClick: () => {
                  window.location.href = `/agents/${record.agent_id}`;
                },
              }
            : undefined,
        });
      }
    },
    [t]
  );

  const handleAlertUpdate = useCallback((record: Alert) => {
    if (record.acknowledged) {
      setStats((prev) =>
        prev
          ? {
              ...prev,
              unacknowledgedAlerts: Math.max(
                0,
                prev.unacknowledgedAlerts - 1
              ),
            }
          : prev
      );
      setRecentAlerts((prev) => prev.filter((a) => a.id !== record.id));
    }
  }, []);

  const { status: alertRealtimeStatus } = useRealtime<Alert>({
    table: "alerts",
    filter: currentOrg ? `org_id=eq.${currentOrg.id}` : undefined,
    enabled: !!currentOrg,
    onInsert: handleAlertInsert,
    onUpdate: handleAlertUpdate,
  });

  // Realtime: agent status changes
  const handleAgentUpdate = useCallback(
    (_record: Agent) => {
      if (!currentOrg) return;
      supabase
        .from("agents")
        .select("id")
        .eq("org_id", currentOrg.id)
        .eq("status", "active")
        .then(({ data }) => {
          setStats((prev) =>
            prev ? { ...prev, activeAgents: data?.length || 0 } : prev
          );
        });
    },
    [currentOrg, supabase]
  );

  const { status: agentRealtimeStatus } = useRealtime<Agent>({
    table: "agents",
    filter: currentOrg ? `org_id=eq.${currentOrg.id}` : undefined,
    enabled: !!currentOrg,
    onUpdate: handleAgentUpdate,
  });

  // Acknowledge single alert from dropdown
  async function handleAcknowledge(alertId: string) {
    await supabase
      .from("alerts")
      .update({ acknowledged: true })
      .eq("id", alertId);

    setRecentAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setStats((prev) =>
      prev
        ? {
            ...prev,
            unacknowledgedAlerts: Math.max(0, prev.unacknowledgedAlerts - 1),
          }
        : prev
    );
  }

  const isRealtimeConnected =
    alertRealtimeStatus === "connected" || agentRealtimeStatus === "connected";

  const orgInitials = currentOrg?.name
    ? currentOrg.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  function formatTimeShort(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(diffMs / 86400000);
    return `${days}d`;
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      {/* Org name & stats */}
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-2">
          {orgLoading ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <span className="font-semibold text-sm">
              {currentOrg?.name || t("noOrg")}
            </span>
          )}
          {/* Live indicator */}
          {!orgLoading && stats && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Circle
                    className={`h-2 w-2 shrink-0 ${
                      isRealtimeConnected
                        ? "fill-emerald-500 text-emerald-500"
                        : "fill-muted-foreground text-muted-foreground"
                    }`}
                  />
                }
              />
              <TooltipContent>
                {isRealtimeConnected
                  ? t("liveConnected")
                  : t("liveDisconnected")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
          {stats ? (
            <>
              <div>
                {t("dailyBudget")}:{" "}
                <span className="text-foreground font-medium">
                  ${stats.dailySpent.toFixed(2)} /{" "}
                  ${stats.dailyAllocated.toFixed(2)}
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div>
                {t("activeAgents")}:{" "}
                <span className="text-foreground font-medium">
                  {stats.activeAgents}
                </span>
              </div>
            </>
          ) : (
            !orgLoading && (
              <>
                <Skeleton className="h-4 w-32" />
                <Separator orientation="vertical" className="h-4" />
                <Skeleton className="h-4 w-20" />
              </>
            )
          )}
        </div>
      </div>

      {/* Alerts bell dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="relative cursor-pointer inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent hover:text-accent-foreground">
          <Bell className="h-4 w-4" />
          {stats && stats.unacknowledgedAlerts > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] pointer-events-none"
            >
              {stats.unacknowledgedAlerts > 99
                ? "99+"
                : stats.unacknowledgedAlerts}
            </Badge>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold">{t("alerts")}</span>
            {stats && stats.unacknowledgedAlerts > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {stats.unacknowledgedAlerts} {t("unread")}
              </Badge>
            )}
          </div>
          <DropdownMenuSeparator />
          {recentAlerts.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {t("noNewAlerts")}
              </p>
            </div>
          ) : (
            recentAlerts.map((alert) => {
              const Icon = severityIcon[alert.severity];
              const color = severityColor[alert.severity];
              return (
                <DropdownMenuItem
                  key={alert.id}
                  className="flex items-start gap-2.5 px-3 py-2.5 cursor-default"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs line-clamp-2 leading-relaxed">
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatTimeShort(alert.created_at)}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    className="shrink-0 h-6 w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcknowledge(alert.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAcknowledge(alert.id);
                    }}
                    title={t("acknowledge")}
                  >
                    <CheckCheck className="h-3 w-3" />
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="justify-center">
            <Link
              href="/alerts"
              className="text-xs text-primary hover:underline"
            >
              {t("viewAllAlerts")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="relative h-8 w-8 rounded-full cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{orgInitials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem>
            <Link href="/settings" className="flex items-center gap-2 w-full">
              <User className="h-4 w-4" />
              {t("profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/settings" className="flex items-center gap-2 w-full">
              <Settings className="h-4 w-4" />
              {t("orgSettings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
