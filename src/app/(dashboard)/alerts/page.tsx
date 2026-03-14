"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  ShieldAlert,
  Bot,
  Eye,
  CheckCheck,
} from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import type { Alert, Agent } from "@/types/database";

type AlertWithAgent = Alert & {
  agentName: string | null;
};

type FilterSeverity = "all" | "critical" | "warning" | "info";
type FilterStatus = "all" | "unacknowledged" | "acknowledged" | "resolved";

const severityConfig: Record<
  Alert["severity"],
  {
    icon: typeof AlertTriangle;
    className: string;
    badgeClass: string;
  }
> = {
  critical: {
    icon: ShieldAlert,
    className: "text-red-500",
    badgeClass: "bg-red-500/15 text-red-500 border-red-500/20",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-amber-500",
    badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  },
  info: {
    icon: Info,
    className: "text-blue-500",
    badgeClass: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  },
};

const PAGE_SIZE = 20;

export default function AlertsPage() {
  const { t } = useTranslations("alerts");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [alerts, setAlerts] = useState<AlertWithAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const supabase = useMemo(() => createClient(), []);
  const agentMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchAlerts() {
      setLoading(true);
      try {
        const [alertsRes, agentsRes] = await Promise.all([
          supabase
            .from("alerts")
            .select("*")
            .eq("org_id", currentOrg!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("agents")
            .select("id, name")
            .eq("org_id", currentOrg!.id),
        ]);

        const agentMap = new Map(
          ((agentsRes.data || []) as Pick<Agent, "id" | "name">[]).map((a) => [
            a.id,
            a.name,
          ])
        );
        agentMapRef.current = agentMap;

        const enriched: AlertWithAgent[] = (
          (alertsRes.data || []) as Alert[]
        ).map((alert) => ({
          ...alert,
          agentName: alert.agent_id
            ? agentMap.get(alert.agent_id) || null
            : null,
        }));

        setAlerts(enriched);
      } catch (err) {
        console.error("Failed to load alerts:", err);
        toast.error("Failed to load alerts");
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [currentOrg, supabase]);

  // Realtime: new alerts appear instantly
  const handleRealtimeInsert = useCallback((record: Alert) => {
    const enriched: AlertWithAgent = {
      ...record,
      agentName: record.agent_id
        ? agentMapRef.current.get(record.agent_id) || null
        : null,
    };
    setAlerts((prev) => [enriched, ...prev]);
  }, []);

  const handleRealtimeUpdate = useCallback((record: Alert) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === record.id
          ? {
              ...a,
              ...record,
              agentName: a.agentName,
            }
          : a
      )
    );
  }, []);

  useRealtime<Alert>({
    table: "alerts",
    filter: currentOrg ? `org_id=eq.${currentOrg.id}` : undefined,
    enabled: !!currentOrg,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
  });

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (severityFilter !== "all" && alert.severity !== severityFilter)
        return false;
      if (statusFilter === "unacknowledged" && alert.acknowledged) return false;
      if (statusFilter === "acknowledged" && (!alert.acknowledged || alert.resolved))
        return false;
      if (statusFilter === "resolved" && !alert.resolved) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE);
  const pagedAlerts = filteredAlerts.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  // Summary counts
  const counts = useMemo(() => {
    const unack = alerts.filter((a) => !a.acknowledged).length;
    const critical = alerts.filter(
      (a) => a.severity === "critical" && !a.resolved
    ).length;
    const resolved = alerts.filter((a) => a.resolved).length;
    return { total: alerts.length, unack, critical, resolved };
  }, [alerts]);

  async function handleAcknowledge(alertIds: string[]) {
    const { error } = await supabase
      .from("alerts")
      .update({ acknowledged: true })
      .in("id", alertIds);

    if (error) {
      toast.error("Failed to acknowledge alerts");
      return;
    }

    setAlerts((prev) =>
      prev.map((a) =>
        alertIds.includes(a.id) ? { ...a, acknowledged: true } : a
      )
    );
    setSelectedIds(new Set());
    toast.success(t("acknowledged", { count: alertIds.length }));
  }

  async function handleResolve(alertIds: string[]) {
    const { error } = await supabase
      .from("alerts")
      .update({ acknowledged: true, resolved: true })
      .in("id", alertIds);

    if (error) {
      toast.error("Failed to resolve alerts");
      return;
    }

    setAlerts((prev) =>
      prev.map((a) =>
        alertIds.includes(a.id)
          ? { ...a, acknowledged: true, resolved: true }
          : a
      )
    );
    setSelectedIds(new Set());
    toast.success(t("resolved", { count: alertIds.length }));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === pagedAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedAlerts.map((a) => a.id)));
    }
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    return date.toLocaleDateString();
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "all" ? "border-primary" : ""}`}
          onClick={() => {
            setStatusFilter("all");
            setPage(0);
          }}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("total")}</p>
                <p className="text-2xl font-bold">{counts.total}</p>
              </div>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "unacknowledged" ? "border-primary" : ""}`}
          onClick={() => {
            setStatusFilter("unacknowledged");
            setPage(0);
          }}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("unacknowledged")}
                </p>
                <p className="text-2xl font-bold">{counts.unack}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${severityFilter === "critical" ? "border-primary" : ""}`}
          onClick={() => {
            setSeverityFilter(
              severityFilter === "critical" ? "all" : "critical"
            );
            setPage(0);
          }}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("severity.critical")}
                </p>
                <p className="text-2xl font-bold text-red-500">
                  {counts.critical}
                </p>
              </div>
              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "resolved" ? "border-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "resolved" ? "all" : "resolved");
            setPage(0);
          }}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("resolvedLabel")}
                </p>
                <p className="text-2xl font-bold text-emerald-500">
                  {counts.resolved}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Select
            value={severityFilter}
            onValueChange={(v) => {
              if (v) {
                setSeverityFilter(v as FilterSeverity);
                setPage(0);
              }
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={t("filterSeverity")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSeverities")}</SelectItem>
              <SelectItem value="critical">{t("severity.critical")}</SelectItem>
              <SelectItem value="warning">{t("severity.warning")}</SelectItem>
              <SelectItem value="info">{t("severity.info")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              if (v) {
                setStatusFilter(v as FilterStatus);
                setPage(0);
              }
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={t("filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="unacknowledged">
                {t("unacknowledged")}
              </SelectItem>
              <SelectItem value="acknowledged">
                {t("acknowledgedLabel")}
              </SelectItem>
              <SelectItem value="resolved">{t("resolvedLabel")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAcknowledge([...selectedIds])}
            >
              <CheckCheck className="h-4 w-4" />
              {t("acknowledge")} ({selectedIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleResolve([...selectedIds])}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("resolve")} ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* Alerts Table */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">{t("noAlerts")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("noAlertsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={
                      pagedAlerts.length > 0 &&
                      selectedIds.size === pagedAlerts.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </TableHead>
                <TableHead className="w-24">{t("severityLabel")}</TableHead>
                <TableHead className="w-32">{t("typeLabel")}</TableHead>
                <TableHead>{t("messageLabel")}</TableHead>
                <TableHead className="w-28">{t("agentLabel")}</TableHead>
                <TableHead className="w-28">{t("timeLabel")}</TableHead>
                <TableHead className="w-24">{t("statusLabel")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedAlerts.map((alert) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;

                return (
                  <TableRow
                    key={alert.id}
                    className={
                      !alert.acknowledged ? "bg-muted/30" : undefined
                    }
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(alert.id)}
                        onChange={() => toggleSelect(alert.id)}
                        className="rounded border-border"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={config.badgeClass}>
                        <Icon className="h-3 w-3" />
                        {t(`severity.${alert.severity}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {alert.type.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">{alert.message}</p>
                    </TableCell>
                    <TableCell>
                      {alert.agentName ? (
                        <Link
                          href={`/agents/${alert.agent_id}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Bot className="h-3 w-3" />
                          {alert.agentName}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(alert.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {alert.resolved ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                        >
                          {t("resolvedLabel")}
                        </Badge>
                      ) : alert.acknowledged ? (
                        <Badge variant="secondary">
                          {t("acknowledgedLabel")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("new")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!alert.acknowledged && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleAcknowledge([alert.id])}
                            title={t("acknowledge")}
                          >
                            <CheckCheck className="h-3 w-3" />
                          </Button>
                        )}
                        {!alert.resolved && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleResolve([alert.id])}
                            title={t("resolve")}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        )}
                        {alert.agent_id && (
                          <Button
                            variant="ghost"
                            size="xs"
                            nativeButton={false}
                            render={
                              <Link href={`/agents/${alert.agent_id}`} />
                            }
                            title={t("viewAgent")}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("showing", {
                  from: page * PAGE_SIZE + 1,
                  to: Math.min((page + 1) * PAGE_SIZE, filteredAlerts.length),
                  total: filteredAlerts.length,
                })}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  {tCommon("back")}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  {tCommon("next")}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
