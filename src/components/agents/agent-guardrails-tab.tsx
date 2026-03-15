"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useTranslations } from "@/i18n/use-translations";
import type { Guardrails } from "@/types/database";

export function AgentGuardrailsTab({
  guardrails,
  onSave,
}: {
  guardrails: Guardrails;
  onSave: (guardrails: Guardrails) => void;
}) {
  const { t } = useTranslations("agents");
  const { t: tCommon } = useTranslations("common");

  const [form, setForm] = useState<Guardrails>({ ...guardrails });
  const [dirty, setDirty] = useState(false);

  function updateField<K extends keyof Guardrails>(key: K, value: Guardrails[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    onSave(form);
    setDirty(false);
  }

  return (
    <div className="space-y-6">
      {/* Budget Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t("guardrailBudgetLimits")}
            <HelpTooltip content={t("helpBudgetLimits")} />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max_budget_daily">{t("guardrailMaxDaily")}</Label>
            <Input
              id="max_budget_daily"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.max_budget_daily ?? ""}
              onChange={(e) =>
                updateField(
                  "max_budget_daily",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_budget_monthly">{t("guardrailMaxMonthly")}</Label>
            <Input
              id="max_budget_monthly"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.max_budget_monthly ?? ""}
              onChange={(e) =>
                updateField(
                  "max_budget_monthly",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Execution Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t("guardrailExecLimits")}
            <HelpTooltip content={t("helpExecLimits")} />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max_task_duration_seconds">
              {t("guardrailMaxDuration")}
            </Label>
            <Input
              id="max_task_duration_seconds"
              type="number"
              min="0"
              placeholder="300"
              value={form.max_task_duration_seconds ?? ""}
              onChange={(e) =>
                updateField(
                  "max_task_duration_seconds",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_tokens_per_request">
              {t("guardrailMaxTokens")}
            </Label>
            <Input
              id="max_tokens_per_request"
              type="number"
              min="0"
              placeholder="4096"
              value={form.max_tokens_per_request ?? ""}
              onChange={(e) =>
                updateField(
                  "max_tokens_per_request",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t("guardrailRateLimiting")}
            <HelpTooltip content={t("helpRateLimiting")} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="rate_limit_rpm">{t("guardrailRateLimitRpm")}</Label>
            <Input
              id="rate_limit_rpm"
              type="number"
              min="1"
              placeholder={t("guardrailRateLimitPlaceholder")}
              value={form.rate_limit_rpm ?? ""}
              onChange={(e) =>
                updateField(
                  "rate_limit_rpm",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Automation Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t("guardrailAutomation")}
            <HelpTooltip content={t("helpAutomation")} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("guardrailAutoPause")}</p>
              <p className="text-xs text-muted-foreground">
                {t("guardrailAutoPauseDesc")}
              </p>
            </div>
            <Switch
              checked={form.auto_pause_on_budget}
              onCheckedChange={(checked) =>
                updateField("auto_pause_on_budget", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("guardrailAutoDowngrade")}</p>
              <p className="text-xs text-muted-foreground">
                {t("guardrailAutoDowngradeDesc")}
              </p>
            </div>
            <Switch
              checked={form.auto_downgrade_model}
              onCheckedChange={(checked) =>
                updateField("auto_downgrade_model", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("guardrailSpikeDetect")}</p>
              <p className="text-xs text-muted-foreground">
                {t("guardrailSpikeDetectDesc")}
              </p>
            </div>
            <Switch
              checked={form.spike_detection}
              onCheckedChange={(checked) =>
                updateField("spike_detection", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button disabled={!dirty} onClick={handleSave}>
          {tCommon("save")}
        </Button>
      </div>
    </div>
  );
}
