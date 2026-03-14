"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useTranslations } from "@/i18n/use-translations";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "@/types/database";

const PAGE_SIZE = 50;

type SortKey = "started_at" | "cost" | "duration_ms" | "tokens_input" | "tokens_output";
type SortDir = "asc" | "desc";

const taskStatusConfig: Record<
  Task["status"],
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  completed: { variant: "default", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  running: { variant: "secondary", className: "bg-blue-500/15 text-blue-500 border-blue-500/20" },
  failed: { variant: "destructive" },
  killed: { variant: "outline" },
};

export function AgentTaskHistoryTab({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslations("agents");

  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    let result = [...tasks];
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });
    return result;
  }, [tasks, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder={t("filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="completed">{t("taskCompleted")}</SelectItem>
            <SelectItem value="running">{t("taskRunning")}</SelectItem>
            <SelectItem value="failed">{t("taskFailed")}</SelectItem>
            <SelectItem value="killed">{t("taskKilled")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} {t("tasksTotal")}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("started_at")}
              >
                {t("taskTimestamp")}{sortIndicator("started_at")}
              </TableHead>
              <TableHead>{t("taskType")}</TableHead>
              <TableHead>{t("taskStatus")}</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("tokens_input")}
              >
                {t("taskTokensIn")}{sortIndicator("tokens_input")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("tokens_output")}
              >
                {t("taskTokensOut")}{sortIndicator("tokens_output")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("cost")}
              >
                {t("taskCost")}{sortIndicator("cost")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("duration_ms")}
              >
                {t("taskDuration")}{sortIndicator("duration_ms")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t("noTasks")}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((task) => {
                const statusCfg = taskStatusConfig[task.status];
                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedTask(task)}
                  >
                    <TableCell className="text-xs">
                      {new Date(task.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.task_type || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant} className={statusCfg.className}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {task.tokens_input.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {task.tokens_output.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      ${Number(task.cost).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {task.duration_ms != null
                        ? `${(task.duration_ms / 1000).toFixed(1)}s`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("page")} {page + 1} / {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("taskDetails")}</SheetTitle>
            <SheetDescription>
              {selectedTask && new Date(selectedTask.started_at).toLocaleString()}
            </SheetDescription>
          </SheetHeader>
          {selectedTask && (
            <div className="space-y-4 mt-6">
              <DetailRow label={t("taskStatus")} value={selectedTask.status} />
              <DetailRow label={t("taskType")} value={selectedTask.task_type || "—"} />
              <DetailRow label={t("modelUsed")} value={selectedTask.model_used} />
              <DetailRow
                label={t("taskTokensIn")}
                value={selectedTask.tokens_input.toLocaleString()}
              />
              <DetailRow
                label={t("taskTokensOut")}
                value={selectedTask.tokens_output.toLocaleString()}
              />
              <DetailRow
                label={t("taskCost")}
                value={`$${Number(selectedTask.cost).toFixed(6)}`}
              />
              <DetailRow
                label={t("taskDuration")}
                value={
                  selectedTask.duration_ms != null
                    ? `${(selectedTask.duration_ms / 1000).toFixed(1)}s`
                    : "—"
                }
              />
              {selectedTask.result_quality != null && (
                <DetailRow
                  label={t("taskQuality")}
                  value={`${(selectedTask.result_quality * 100).toFixed(0)}%`}
                />
              )}
              {selectedTask.output_units > 0 && (
                <DetailRow
                  label={t("taskOutputUnits")}
                  value={String(selectedTask.output_units)}
                />
              )}
              {selectedTask.error_message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("taskError")}</p>
                  <p className="text-sm text-red-500 bg-red-500/10 rounded-md p-2">
                    {selectedTask.error_message}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
