"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/use-translations";
import { Bot, DollarSign, AlertTriangle, Activity } from "lucide-react";

const stats = [
  {
    key: "totalSpent",
    value: "$42.50",
    subtitle: "of $100 daily budget",
    icon: DollarSign,
    trend: "+12% from yesterday",
  },
  {
    key: "activeAgents",
    value: "4",
    subtitle: "of 6 total",
    icon: Bot,
    trend: "1 paused, 1 error",
  },
  {
    key: "totalBudget",
    value: "$1,247",
    subtitle: "spent this month",
    icon: Activity,
    trend: "62% of monthly budget",
  },
  {
    key: "alertsToday",
    value: "3",
    subtitle: "unacknowledged",
    icon: AlertTriangle,
    trend: "1 critical",
  },
];

export default function DashboardPage() {
  const { t } = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("welcome")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(stat.key)}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.subtitle}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Controls placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("quickControls")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5" />
                <div>
                  <p className="font-medium text-sm">Content Writer</p>
                  <p className="text-xs text-muted-foreground">
                    GPT-4o &middot; Content Team
                  </p>
                </div>
              </div>
              <Badge variant="destructive">95% budget</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5" />
                <div>
                  <p className="font-medium text-sm">Email Responder</p>
                  <p className="text-xs text-muted-foreground">
                    GPT-4o-mini &middot; Support Team
                  </p>
                </div>
              </div>
              <Badge variant="destructive">Error</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
