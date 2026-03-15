"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BarChart3,
  Users,
  ClipboardList,
  Download,
  Star,
  MessageSquare,
  Hash,
  ListChecks,
  AlignLeft,
  Gauge,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Survey, SurveyQuestion, SurveyResponse } from "@/types/database";

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "" },
  active: {
    label: "Active",
    color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground" },
};

type QuestionResults = {
  question: SurveyQuestion;
  answers: unknown[];
  distribution?: { label: string; count: number; percentage: number }[];
  average?: number;
  median?: number;
  textResponses?: string[];
};

function QuestionIcon({ type }: { type: string }) {
  switch (type) {
    case "rating":
      return <Star className="h-4 w-4" />;
    case "scale":
      return <Gauge className="h-4 w-4" />;
    case "number":
      return <Hash className="h-4 w-4" />;
    case "single_choice":
    case "multi_choice":
      return <ListChecks className="h-4 w-4" />;
    case "text":
    default:
      return <AlignLeft className="h-4 w-4" />;
  }
}

function RatingChart({ results }: { results: QuestionResults }) {
  const data = [1, 2, 3, 4, 5].map((rating) => {
    const count = results.answers.filter((a) => Number(a) === rating).length;
    return { rating: `${rating}★`, count, percentage: results.answers.length > 0 ? Math.round((count / results.answers.length) * 100) : 0 };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold">
          {results.average?.toFixed(1) ?? "—"}
          <span className="text-lg text-muted-foreground">/5</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {results.answers.length} responses
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="rating" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            formatter={(value) => [`${value} responses`]}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScaleChart({ results }: { results: QuestionResults }) {
  if (!results.distribution) return null;
  const data = results.distribution;

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">{item.count} ({item.percentage}%)</span>
          </div>
          <Progress value={item.percentage} className="h-2" />
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-2">
        {results.answers.length} responses
      </p>
    </div>
  );
}

function ChoiceChart({ results }: { results: QuestionResults }) {
  if (!results.distribution) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={results.distribution}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            strokeWidth={2}
            stroke="hsl(var(--card))"
          >
            {results.distribution.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            formatter={(value, name) => [`${value} (${results.distribution!.find(d => d.label === String(name))?.percentage ?? 0}%)`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 flex flex-col justify-center">
        {results.distribution.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-muted-foreground flex-1 truncate">{item.label}</span>
            <span className="font-medium">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberChart({ results }: { results: QuestionResults }) {
  const numbers = results.answers.map(Number).filter((n) => !isNaN(n));
  const avg = numbers.length > 0 ? numbers.reduce((s, n) => s + n, 0) / numbers.length : 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const med = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const min = sorted.length > 0 ? sorted[0] : 0;
  const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold">{avg.toFixed(1)}</p>
        <p className="text-xs text-muted-foreground">Average</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{med}</p>
        <p className="text-xs text-muted-foreground">Median</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{min}</p>
        <p className="text-xs text-muted-foreground">Min</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{max}</p>
        <p className="text-xs text-muted-foreground">Max</p>
      </div>
    </div>
  );
}

function TextResults({ results }: { results: QuestionResults }) {
  const texts = results.textResponses || [];
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? texts : texts.slice(0, 5);

  return (
    <div className="space-y-2">
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No text responses</p>
      ) : (
        <>
          {visible.map((text, i) => (
            <div key={i} className="rounded-md bg-muted/50 p-3 text-sm">
              &ldquo;{text}&rdquo;
            </div>
          ))}
          {texts.length > 5 && !showAll && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              Show all {texts.length} responses
            </Button>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {texts.length} responses
      </p>
    </div>
  );
}

function QuestionResultCard({ results }: { results: QuestionResults }) {
  const { question } = results;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <QuestionIcon type={question.type} />
          <CardTitle className="text-sm font-medium">{question.text}</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs capitalize">
            {question.type.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {question.type === "rating" && <RatingChart results={results} />}
        {question.type === "scale" && <ScaleChart results={results} />}
        {(question.type === "single_choice" || question.type === "multi_choice") && (
          <ChoiceChart results={results} />
        )}
        {question.type === "number" && <NumberChart results={results} />}
        {question.type === "text" && <TextResults results={results} />}
      </CardContent>
    </Card>
  );
}

function processResults(
  survey: Survey,
  responses: SurveyResponse[]
): QuestionResults[] {
  return survey.questions.map((question) => {
    const answers = responses
      .map((r) => {
        const a = r.answers as Record<string, unknown>;
        return a[question.id];
      })
      .filter((a) => a !== undefined && a !== null && a !== "");

    const result: QuestionResults = { question, answers };

    switch (question.type) {
      case "rating": {
        const nums = answers.map(Number).filter((n) => !isNaN(n));
        result.average =
          nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        break;
      }
      case "scale": {
        const options = question.options || [];
        const dist = options.map((opt) => {
          const count = answers.filter((a) => a === opt).length;
          return {
            label: opt,
            count,
            percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
          };
        });
        result.distribution = dist;
        break;
      }
      case "single_choice": {
        const options = question.options || [];
        const counts = new Map<string, number>();
        for (const a of answers) {
          const key = String(a);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        result.distribution = options.map((opt) => ({
          label: opt,
          count: counts.get(opt) || 0,
          percentage: answers.length > 0 ? Math.round(((counts.get(opt) || 0) / answers.length) * 100) : 0,
        }));
        break;
      }
      case "multi_choice": {
        const options = question.options || [];
        const counts = new Map<string, number>();
        for (const a of answers) {
          const selections = Array.isArray(a) ? a : [a];
          for (const sel of selections) {
            const key = String(sel);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
        result.distribution = options.map((opt) => ({
          label: opt,
          count: counts.get(opt) || 0,
          percentage: answers.length > 0 ? Math.round(((counts.get(opt) || 0) / answers.length) * 100) : 0,
        }));
        break;
      }
      case "number": {
        const nums = answers.map(Number).filter((n) => !isNaN(n));
        result.average =
          nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        const sorted = [...nums].sort((a, b) => a - b);
        result.median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
        break;
      }
      case "text": {
        result.textResponses = answers.map(String);
        break;
      }
    }

    return result;
  });
}

function exportCSV(survey: Survey, responses: SurveyResponse[]) {
  const headers = ["Response ID", "Submitted At", ...survey.questions.map((q) => q.text)];
  const rows = responses.map((r) => {
    const answers = r.answers as Record<string, unknown>;
    return [
      r.id,
      new Date(r.submitted_at).toISOString(),
      ...survey.questions.map((q) => {
        const val = answers[q.id];
        if (Array.isArray(val)) return val.join("; ");
        return String(val ?? "");
      }),
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${survey.title.replace(/\s+/g, "-").toLowerCase()}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SurveyResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslations("workspace");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<QuestionResults[]>([]);

  const supabase = useMemo(() => createClient(), []);
  const surveyId = params.id as string;

  useEffect(() => {
    if (!currentOrg || !surveyId) return;

    async function fetchData() {
      setLoading(true);
      const [surveyRes, responsesRes] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", surveyId).eq("org_id", currentOrg!.id).single(),
        supabase.from("survey_responses").select("*").eq("survey_id", surveyId).eq("org_id", currentOrg!.id).order("submitted_at", { ascending: false }),
      ]);

      if (surveyRes.error || !surveyRes.data) {
        router.push("/workspace/surveys");
        return;
      }

      const s = surveyRes.data as Survey;
      const r = (responsesRes.data || []) as SurveyResponse[];
      setSurvey(s);
      setResponses(r);
      setResults(processResults(s, r));
      setLoading(false);
    }
    fetchData();
  }, [currentOrg, surveyId, supabase, router]);

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!survey) return null;

  const statusCfg = STATUS_CONFIG[survey.status];
  const totalMembers = 0; // Would come from workspace_members count
  const responseRate = totalMembers > 0 ? Math.round((responses.length / totalMembers) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/workspace/surveys")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{survey.title}</h1>
            <Badge variant="outline" className={statusCfg.color}>
              {statusCfg.label}
            </Badge>
          </div>
          {survey.description && (
            <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>
          )}
        </div>
        {responses.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => exportCSV(survey, responses)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <MessageSquare className="h-4 w-4" />
              Responses
            </div>
            <p className="text-2xl font-bold">{responses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ClipboardList className="h-4 w-4" />
              Questions
            </div>
            <p className="text-2xl font-bold">{survey.questions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Response Rate
            </div>
            <p className="text-2xl font-bold">
              {responseRate !== null ? `${responseRate}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <BarChart3 className="h-4 w-4" />
              Anonymous
            </div>
            <p className="text-2xl font-bold">{survey.is_anonymous ? "Yes" : "No"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {responses.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No responses yet"
          description={
            survey.status === "draft"
              ? "This survey is still in draft. Activate it to start collecting responses."
              : "Responses will appear here as members complete the survey."
          }
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Results by Question
          </h2>
          {results.map((r, i) => (
            <QuestionResultCard key={r.question.id} results={r} />
          ))}
        </div>
      )}
    </div>
  );
}
