"use client";

import { useTranslations } from "@/i18n/use-translations";

export default function AgentsPage() {
  const { t } = useTranslations("agents");

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">
        Manage and monitor your AI agents.
      </p>
    </div>
  );
}
