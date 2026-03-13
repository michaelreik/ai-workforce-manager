"use client";

import { useTranslations } from "@/i18n/use-translations";

export default function AnalyticsPage() {
  const { t } = useTranslations("analytics");

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">
        Cost analytics, agent performance, and ROI tracking.
      </p>
    </div>
  );
}
