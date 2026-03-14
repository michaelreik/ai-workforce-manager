"use client";

import { useEffect, useState, useMemo } from "react";
import { Bell, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/(auth)/actions";
import Link from "next/link";

type HeaderStats = {
  dailySpent: number;
  dailyAllocated: number;
  activeAgents: number;
  unacknowledgedAlerts: number;
};

export function AppHeader() {
  const { t } = useTranslations("header");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState<HeaderStats | null>(null);

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
          .select("id")
          .eq("org_id", currentOrg!.id)
          .eq("acknowledged", false),
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

      setStats({
        dailySpent,
        dailyAllocated,
        activeAgents: agentsRes.data?.length || 0,
        unacknowledgedAlerts: alertsRes.data?.length || 0,
      });
    }

    fetchStats();
  }, [currentOrg, supabase]);

  const orgInitials = currentOrg?.name
    ? currentOrg.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      {/* Org name & stats */}
      <div className="flex items-center gap-6 flex-1">
        {orgLoading ? (
          <Skeleton className="h-4 w-28" />
        ) : (
          <span className="font-semibold text-sm">
            {currentOrg?.name || t("noOrg")}
          </span>
        )}

        <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
          {stats ? (
            <>
              <div>
                {t("dailyBudget")}:{" "}
                <span className="text-foreground font-medium">
                  ${stats.dailySpent.toFixed(2)} / ${stats.dailyAllocated.toFixed(2)}
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

      {/* Alerts bell */}
      <Link href="/alerts" className="relative">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        {stats && stats.unacknowledgedAlerts > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
          >
            {stats.unacknowledgedAlerts}
          </Badge>
        )}
      </Link>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative h-8 w-8 rounded-full cursor-pointer"
        >
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
