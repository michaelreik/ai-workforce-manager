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
import { useTranslations } from "@/i18n/use-translations";
import type { Team, OrgMember } from "@/types/database";

const ICONS = [
  "🤖", "🎯", "✍️", "💬", "📊", "🔬",
  "🚀", "💡", "🛡️", "📈", "🎨", "⚡",
] as const;

const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4",
] as const;

type TeamFormData = {
  name: string;
  description: string;
  icon: string;
  color: string;
  budget_monthly: string;
  lead_user_id: string;
};

type FormErrors = Partial<Record<keyof TeamFormData, string>>;

function validate(form: TeamFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "required";
  if (form.budget_monthly && Number(form.budget_monthly) < 0)
    errors.budget_monthly = "invalid";
  return errors;
}

export function TeamFormModal({
  open,
  onOpenChange,
  team,
  orgMembers,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
  orgMembers: { user_id: string; email: string }[];
  onSave: (data: {
    name: string;
    description: string | null;
    icon: string;
    color: string;
    budget_monthly: number;
    lead_user_id: string | null;
  }) => void;
}) {
  const { t } = useTranslations("teams");
  const { t: tCommon } = useTranslations("common");

  const isEdit = !!team;

  const [form, setForm] = useState<TeamFormData>({
    name: "",
    description: "",
    icon: "🤖",
    color: "#6366f1",
    budget_monthly: "",
    lead_user_id: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (team) {
      setForm({ // eslint-disable-line react-hooks/set-state-in-effect
        name: team.name,
        description: team.description || "",
        icon: team.icon,
        color: team.color,
        budget_monthly: Number(team.budget_monthly).toString(),
        lead_user_id: team.lead_user_id || "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        icon: "🤖",
        color: "#6366f1",
        budget_monthly: "",
        lead_user_id: "",
      });
    }
    setErrors({});
  }, [team, open]);

  function updateField<K extends keyof TeamFormData>(
    key: K,
    value: TeamFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit() {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSave({
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      color: form.color,
      budget_monthly: form.budget_monthly ? Number(form.budget_monthly) : 0,
      lead_user_id: form.lead_user_id || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTeam") : t("createTeam")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("editTeam") : t("createTeam")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="team-name">{t("formName")} *</Label>
            <Input
              id="team-name"
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
            <Label htmlFor="team-desc">{t("formDescription")}</Label>
            <Textarea
              id="team-desc"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder={t("formDescPlaceholder")}
              rows={2}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>{t("formIcon")}</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => updateField("icon", icon)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors ${
                    form.icon === icon
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>{t("formColor")}</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateField("color", color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    form.color === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label htmlFor="team-budget">{t("formBudget")}</Label>
            <Input
              id="team-budget"
              type="number"
              step="0.01"
              min="0"
              value={form.budget_monthly}
              onChange={(e) => updateField("budget_monthly", e.target.value)}
              placeholder="500.00"
              aria-invalid={!!errors.budget_monthly}
            />
          </div>

          {/* Team Lead */}
          <div className="space-y-2">
            <Label>{t("formLead")}</Label>
            <Select
              value={form.lead_user_id || undefined}
              onValueChange={(v) => v && updateField("lead_user_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("formLeadPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {orgMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
