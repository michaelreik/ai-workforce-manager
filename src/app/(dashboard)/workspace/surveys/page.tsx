"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  ClipboardList,
  Trash2,
  Play,
  Square,
  BarChart3,
  Loader2,
} from "lucide-react";
import type { Survey, SurveyQuestion, SurveyResponse } from "@/types/database";

const SURVEY_TEMPLATES = {
  impact: {
    title: "AI Impact Survey",
    questions: [
      { id: "q1", type: "scale" as const, text: "How has AI impacted your productivity?", options: ["Strongly decreased", "Decreased", "No change", "Increased", "Strongly increased"] },
      { id: "q2", type: "number" as const, text: "Estimated hours saved per week using AI tools" },
      { id: "q3", type: "scale" as const, text: "Has AI improved the quality of your work?", options: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"] },
      { id: "q4", type: "rating" as const, text: "Overall satisfaction with AI tools (1-5)" },
      { id: "q5", type: "text" as const, text: "What tasks do you primarily use AI for?" },
    ],
  },
  satisfaction: {
    title: "Tool Satisfaction Survey",
    questions: [
      { id: "q1", type: "multi_choice" as const, text: "Which AI tools do you use most?", options: ["ChatGPT", "Claude", "Copilot", "Gemini", "Cursor", "Other"] },
      { id: "q2", type: "rating" as const, text: "Overall satisfaction (1-5)" },
      { id: "q3", type: "text" as const, text: "What would you improve about our AI tools?" },
    ],
  },
  training: {
    title: "Training Needs Assessment",
    questions: [
      { id: "q1", type: "scale" as const, text: "How confident are you using AI tools?", options: ["Not at all", "Slightly", "Somewhat", "Fairly", "Very confident"] },
      { id: "q2", type: "multi_choice" as const, text: "Which areas need more training?", options: ["Prompt engineering", "Code generation", "Content writing", "Data analysis", "Image generation", "Workflow automation"] },
      { id: "q3", type: "single_choice" as const, text: "Preferred training format", options: ["Video tutorials", "Live workshops", "Written guides", "1-on-1 coaching", "Self-paced course"] },
    ],
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "" },
  active: { label: "Active", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground" },
};

export default function SurveysPage() {
  const { t } = useTranslations("workspace");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [surveys, setSurveys] = useState<(Survey & { responseCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAnonymous, setFormAnonymous] = useState(true);
  const [formQuestions, setFormQuestions] = useState<SurveyQuestion[]>([]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;
    async function fetchSurveys() {
      setLoading(true);
      const [surveysRes, responsesRes] = await Promise.all([
        supabase.from("surveys").select("*").eq("org_id", currentOrg!.id).order("created_at", { ascending: false }),
        supabase.from("survey_responses").select("survey_id").eq("org_id", currentOrg!.id),
      ]);

      const responseCounts = new Map<string, number>();
      for (const r of (responsesRes.data || []) as Pick<SurveyResponse, "survey_id">[]) {
        responseCounts.set(r.survey_id, (responseCounts.get(r.survey_id) || 0) + 1);
      }

      const enriched = ((surveysRes.data || []) as Survey[]).map((s) => ({
        ...s,
        responseCount: responseCounts.get(s.id) || 0,
      }));
      setSurveys(enriched);
      setLoading(false);
    }
    fetchSurveys();
  }, [currentOrg, supabase]);

  function loadTemplate(key: keyof typeof SURVEY_TEMPLATES) {
    const tpl = SURVEY_TEMPLATES[key];
    setFormTitle(tpl.title);
    setFormQuestions(tpl.questions);
  }

  function addQuestion() {
    setFormQuestions((prev) => [
      ...prev,
      {
        id: `q${Date.now()}`,
        type: "text",
        text: "",
      },
    ]);
  }

  function updateQuestion(idx: number, updates: Partial<SurveyQuestion>) {
    setFormQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  }

  function removeQuestion(idx: number) {
    setFormQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (!currentOrg || !formTitle.trim() || formQuestions.length === 0) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("surveys")
      .insert({
        org_id: currentOrg.id,
        title: formTitle,
        description: formDesc || null,
        questions: formQuestions,
        is_anonymous: formAnonymous,
        status: "draft",
        target: "all",
      })
      .select()
      .single();

    if (error) {
      toast.error(t("saveFailed"));
    } else {
      setSurveys((prev) => [{ ...(data as Survey), responseCount: 0 }, ...prev]);
      toast.success(t("surveyCreated"));
      setShowCreateModal(false);
      setFormTitle(""); setFormDesc(""); setFormQuestions([]); setFormAnonymous(true);
    }
    setSaving(false);
  }

  async function handleStatusChange(id: string, newStatus: string) {
    await supabase.from("surveys").update({ status: newStatus }).eq("id", id);
    setSurveys((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus as Survey["status"] } : s))
    );
    toast.success(newStatus === "active" ? t("surveyActivated") : t("surveyClosed"));
  }

  async function handleDelete(id: string) {
    if (!confirm(t("surveyDeleteConfirm"))) return;
    await supabase.from("surveys").delete().eq("id", id);
    setSurveys((prev) => prev.filter((s) => s.id !== id));
    toast.success(t("surveyDeleted"));
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("surveysTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("surveysSubtitle")}</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          {t("createSurvey")}
        </Button>
      </div>

      {surveys.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("noSurveys")}
          description={t("noSurveysDesc")}
          actionLabel={t("createSurvey")}
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("surveyTitle")}</TableHead>
                <TableHead>{t("surveyStatus")}</TableHead>
                <TableHead>{t("surveyResponses")}</TableHead>
                <TableHead>{t("surveyCreated")}</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => {
                const statusCfg = STATUS_CONFIG[survey.status];
                return (
                  <TableRow key={survey.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{survey.title}</p>
                        {survey.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{survey.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {survey.questions.length} questions · {survey.is_anonymous ? "Anonymous" : "Named"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusCfg.color}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell>{survey.responseCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(survey.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {survey.status === "draft" && (
                          <Button variant="ghost" size="xs" onClick={() => handleStatusChange(survey.id, "active")}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        {survey.status === "active" && (
                          <Button variant="ghost" size="xs" onClick={() => handleStatusChange(survey.id, "closed")}>
                            <Square className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="xs" onClick={() => handleDelete(survey.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Survey Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createSurvey")}</DialogTitle>
            <DialogDescription>{t("createSurveyDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Templates */}
            <div className="space-y-2">
              <Label>{t("surveyTemplates")}</Label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(SURVEY_TEMPLATES).map(([key, tpl]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => loadTemplate(key as keyof typeof SURVEY_TEMPLATES)}
                  >
                    {tpl.title}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t("surveyTitle")} *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="AI Impact Survey" />
            </div>
            <div className="space-y-2">
              <Label>{t("surveyDescription")}</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Help us understand how AI tools impact your work..." rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("surveyAnonymous")}</p>
                <p className="text-xs text-muted-foreground">{t("surveyAnonymousDesc")}</p>
              </div>
              <Switch checked={formAnonymous} onCheckedChange={setFormAnonymous} />
            </div>

            <Separator />

            {/* Questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("surveyQuestions")} ({formQuestions.length})</Label>
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-3 w-3" />
                  {t("addQuestion")}
                </Button>
              </div>
              {formQuestions.map((q, idx) => (
                <Card key={q.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">Q{idx + 1}</span>
                      <Select
                        value={q.type}
                        onValueChange={(v) => v && updateQuestion(idx, { type: v as SurveyQuestion["type"] })}
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Free Text</SelectItem>
                          <SelectItem value="rating">Rating (1-5)</SelectItem>
                          <SelectItem value="scale">Likert Scale</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="single_choice">Single Choice</SelectItem>
                          <SelectItem value="multi_choice">Multi Choice</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="xs" onClick={() => removeQuestion(idx)} className="ml-auto">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={q.text}
                      onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                      placeholder="Question text..."
                    />
                    {(q.type === "single_choice" || q.type === "multi_choice" || q.type === "scale") && (
                      <Input
                        value={q.options?.join(", ") || ""}
                        onChange={(e) => updateQuestion(idx, { options: e.target.value.split(",").map((o) => o.trim()) })}
                        placeholder="Options (comma-separated)"
                        className="text-xs"
                      />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving || !formTitle.trim() || formQuestions.length === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {tCommon("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
