"use client";

import { useTranslations } from "@/i18n/use-translations";

export default function BudgetPage() {
  const { t } = useTranslations("budget");

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">
        Track and allocate budgets across teams and agents.
      </p>
    </div>
  );
}
