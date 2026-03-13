"use client";

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
import { useTranslations } from "@/i18n/use-translations";
import { logout } from "@/app/(auth)/actions";
import Link from "next/link";

export function AppHeader() {
  const { t } = useTranslations("header");

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      {/* Org name & stats */}
      <div className="flex items-center gap-6 flex-1">
        <span className="font-semibold text-sm">Acme AI Corp</span>

        <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            {t("dailyBudget")}:{" "}
            <span className="text-foreground font-medium">$42.50 / $100</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div>
            {t("activeAgents")}:{" "}
            <span className="text-foreground font-medium">4</span>
          </div>
        </div>
      </div>

      {/* Alerts bell */}
      <Link href="/alerts" className="relative">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
        >
          3
        </Badge>
      </Link>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative h-8 w-8 rounded-full cursor-pointer"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">MR</AvatarFallback>
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
