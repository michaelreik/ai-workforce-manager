"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/i18n/use-translations";
import {
  BarChart3,
  Cable,
  Users,
  Upload,
  ClipboardList,
  Sparkles,
  BookOpen,
} from "lucide-react";

const workspaceNav = [
  { key: "overview", href: "/workspace/analytics", icon: BarChart3 },
  { key: "sources", href: "/workspace/sources", icon: Cable },
  { key: "members", href: "/workspace/members", icon: Users },
  { key: "importNav", href: "/workspace/import", icon: Upload },
  { key: "surveysNav", href: "/workspace/surveys", icon: ClipboardList },
  { key: "optimizationNav", href: "/workspace/optimization", icon: Sparkles },
  { key: "adoptionNav", href: "/workspace/adoption", icon: BookOpen },
] as const;

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslations("workspace");

  return (
    <div className="space-y-6">
      {/* Workspace sub-navigation */}
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border pb-2">
        {workspaceNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
