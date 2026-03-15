"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/use-translations";
import { X } from "lucide-react";
import type { Agent, Team, Guardrails } from "@/types/database";

const MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "o3-mini",
  "claude-opus",
  "claude-sonnet",
  "claude-haiku",
  "gemini-pro",
  "gemini-flash",
] as const;

type GuardrailPreset = "conservative" | "standard" | "aggressive" | "custom";

const GUARDRAIL_PRESETS: Record<GuardrailPreset, Guardrails> = {
  conservative: {
    max_budget_daily: 5,
    max_budget_monthly: 50,
    max_task_duration_seconds: 60,
    max_tokens_per_request: 2048,
    rate_limit_rpm: 10,
    spike_detection: true,
    auto_pause_on_budget: true,
    auto_downgrade_model: true,
  },
  standard: {
    max_budget_daily: 20,
    max_budget_monthly: 200,
    max_task_duration_seconds: 300,
    max_tokens_per_request: 4096,
    rate_limit_rpm: 30,
    spike_detection: true,
    auto_pause_on_budget: true,
    auto_downgrade_model: false,
  },
  aggressive: {
    max_budget_daily: 100,
    max_budget_monthly: 1000,
    max_task_duration_seconds: 600,
    max_tokens_per_request: 16384,
    rate_limit_rpm: 100,
    spike_detection: false,
    auto_pause_on_budget: false,
    auto_downgrade_model: false,
  },
  custom: {
    max_budget_daily: null,
    max_budget_monthly: null,
    max_task_duration_seconds: null,
    max_tokens_per_request: null,
    rate_limit_rpm: null,
    spike_detection: false,
    auto_pause_on_budget: true,
    auto_downgrade_model: false,
  },
};

type AgentFormData = {
  name: string;
  description: string;
  team_id: string;
  model: string;
  fallback_model: string;
  max_budget_monthly: string;
  max_budget_daily: string;
  tags: string[];
  guardrail_preset: GuardrailPreset;
};

type FormErrors = Partial<Record<keyof AgentFormData, string>>;

function validate(form: AgentFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "required";
  if (!form.model) errors.model = "required";
  if (form.max_budget_monthly && Number(form.max_budget_monthly) < 0)
    errors.max_budget_monthly = "invalid";
  if (form.max_budget_daily && Number(form.max_budget_daily) < 0)
    errors.max_budget_daily = "invalid";
  return errors;
}

export function AgentFormModal({
  open,
  onOpenChange,
  teams,
  agent,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  agent?: Agent | null;
  onSave: (data: {
    name: string;
    description: string | null;
    team_id: string | null;
    model: string;
    fallback_model: string | null;
    tags: string[];
    guardrails: Guardrails;
  }) => void;
}) {
  const { t } = useTranslations("agents");
  const { t: tCommon } = useTranslations("common");

  const isEdit = !!agent;

  const [form, setForm] = useState<AgentFormData>({
    name: "",
    description: "",
    team_id: "",
    model: "",
    fallback_model: "",
    max_budget_monthly: "",
    max_budget_daily: "",
    tags: [],
    guardrail_preset: "standard",
  });
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // Populate form when editing
  useEffect(() => {
    if (agent) {
      setForm({ // eslint-disable-line react-hooks/set-state-in-effect
        name: agent.name,
        description: agent.description || "",
        team_id: agent.team_id || "",
        model: agent.model,
        fallback_model: agent.fallback_model || "",
        max_budget_monthly: agent.guardrails.max_budget_monthly?.toString() || "",
        max_budget_daily: agent.guardrails.max_budget_daily?.toString() || "",
        tags: agent.tags || [],
        guardrail_preset: "custom",
      });
    } else {
      setForm({
        name: "",
        description: "",
        team_id: "",
        model: "",
        fallback_model: "",
        max_budget_monthly: "",
        max_budget_daily: "",
        tags: [],
        guardrail_preset: "standard",
      });
    }
    setErrors({});
    setTagInput("");
  }, [agent, open]);

  function updateField<K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleAddTag() {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      updateField("tags", [...form.tags, tag]);
    }
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    updateField("tags", form.tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  }

  function handleSubmit() {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Build guardrails from preset + budget overrides
    const preset = GUARDRAIL_PRESETS[form.guardrail_preset];
    const guardrails: Guardrails = {
      ...preset,
      max_budget_daily: form.max_budget_daily
        ? Number(form.max_budget_daily)
        : preset.max_budget_daily,
      max_budget_monthly: form.max_budget_monthly
        ? Number(form.max_budget_monthly)
        : preset.max_budget_monthly,
    };

    onSave({
      name: form.name.trim(),
      description: form.description.trim() || null,
      team_id: form.team_id || null,
      model: form.model,
      fallback_model: form.fallback_model || null,
      tags: form.tags,
      guardrails,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editAgent") : t("addAgent")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("editAgentDesc") : t("addAgentDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name">{t("formName")} *</Label>
            <Input
              id="agent-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder={t("formNamePlaceholder")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{t("formRequired")}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="agent-desc">{t("formDescription")}</Label>
            <Textarea
              id="agent-desc"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder={t("formDescPlaceholder")}
              rows={2}
            />
          </div>

          {/* Team */}
          <div className="space-y-2">
            <Label>{t("formTeam")}</Label>
            <Select
              value={form.team_id || undefined}
              onValueChange={(v) => v && updateField("team_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("formTeamPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary Model */}
          <div className="space-y-2">
            <Label>{t("formModel")} *</Label>
            <Select
              value={form.model || undefined}
              onValueChange={(v) => v && updateField("model", v)}
            >
              <SelectTrigger aria-invalid={!!errors.model}>
                <SelectValue placeholder={t("formModelPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.model && (
              <p className="text-xs text-destructive">{t("formRequired")}</p>
            )}
          </div>

          {/* Fallback Model */}
          <div className="space-y-2">
            <Label>{t("formFallbackModel")}</Label>
            <Select
              value={form.fallback_model || undefined}
              onValueChange={(v) => v && updateField("fallback_model", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("formFallbackPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget-monthly">{t("formBudgetMonthly")}</Label>
              <Input
                id="budget-monthly"
                type="number"
                step="0.01"
                min="0"
                value={form.max_budget_monthly}
                onChange={(e) => updateField("max_budget_monthly", e.target.value)}
                placeholder="200.00"
                aria-invalid={!!errors.max_budget_monthly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-daily">{t("formBudgetDaily")}</Label>
              <Input
                id="budget-daily"
                type="number"
                step="0.01"
                min="0"
                value={form.max_budget_daily}
                onChange={(e) => updateField("max_budget_daily", e.target.value)}
                placeholder="20.00"
                aria-invalid={!!errors.max_budget_daily}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>{t("formTags")}</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={t("formTagPlaceholder")}
              />
              <Button variant="outline" size="sm" onClick={handleAddTag} type="button">
                {t("formAddTag")}
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Guardrail Preset */}
          <div className="space-y-2">
            <Label>{t("formGuardrailPreset")}</Label>
            <Select
              value={form.guardrail_preset}
              onValueChange={(v) => v && updateField("guardrail_preset", v as GuardrailPreset)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">{t("presetConservative")}</SelectItem>
                <SelectItem value="standard">{t("presetStandard")}</SelectItem>
                <SelectItem value="aggressive">{t("presetAggressive")}</SelectItem>
                <SelectItem value="custom">{t("presetCustom")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(`presetDesc_${form.guardrail_preset}`)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {isEdit ? tCommon("save") : tCommon("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
