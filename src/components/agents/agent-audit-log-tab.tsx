"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "@/i18n/use-translations";
import {
  Pause,
  Play,
  DollarSign,
  Shield,
  OctagonX,
  Cpu,
  Settings,
} from "lucide-react";
import type { AuditLog } from "@/types/database";

const actionIcons: Record<string, typeof Pause> = {
  agent_paused: Pause,
  agent_resumed: Play,
  budget_changed: DollarSign,
  guardrail_changed: Shield,
  kill_switch: OctagonX,
  model_changed: Cpu,
};

export function AgentAuditLogTab({ logs }: { logs: AuditLog[] }) {
  const { t } = useTranslations("agents");

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">{t("noAuditLogs")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("noAuditLogsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

      {logs.map((log, i) => {
        const Icon = actionIcons[log.action] || Settings;
        const date = new Date(log.created_at);

        return (
          <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Icon */}
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Content */}
            <Card className="flex-1">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {formatAction(log.action)}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDetails(log.details)}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}
