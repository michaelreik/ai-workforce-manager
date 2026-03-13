"use client";

import { useTranslations } from "@/i18n/use-translations";

export default function SettingsPage() {
  const { t } = useTranslations("settings");

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">
        Organization settings, members, and billing.
      </p>
    </div>
  );
}
