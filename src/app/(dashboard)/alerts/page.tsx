"use client";

import { useTranslations } from "@/i18n/use-translations";

export default function AlertsPage() {
  const { t } = useTranslations("alerts");

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">
        View and manage alerts for your AI workforce.
      </p>
    </div>
  );
}
