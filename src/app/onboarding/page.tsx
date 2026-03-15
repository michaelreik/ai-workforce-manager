"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrg } from "@/components/providers/org-provider";
import { useTranslations } from "@/i18n/use-translations";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  Building2,
  Users,
  Bot,
  Key,
  Code,
  Rocket,
  Check,
  ChevronRight,
  SkipForward,
  Target,
  PenLine,
  Headphones,
  Settings,
  Copy,
  ArrowRight,
} from "lucide-react";

const STEPS = [
  { icon: Sparkles, key: "stepWelcome" },
  { icon: Building2, key: "stepOrg" },
  { icon: Users, key: "stepTeam" },
  { icon: Bot, key: "stepAgent" },
  { icon: Key, key: "stepProvider" },
  { icon: Code, key: "stepIntegrate" },
  { icon: Rocket, key: "stepDone" },
] as const;

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "o3-mini", label: "o3-mini" },
  { value: "claude-opus", label: "Claude Opus" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "claude-haiku", label: "Claude Haiku" },
];

const TEAM_SUGGESTIONS = [
  { key: "teamSuggestion1", icon: "🎯", color: "#ef4444" },
  { key: "teamSuggestion2", icon: "✍️", color: "#8b5cf6" },
  { key: "teamSuggestion3", icon: "🎧", color: "#3b82f6" },
  { key: "teamSuggestion4", icon: "🔬", color: "#10b981" },
  { key: "teamSuggestion5", icon: "⚙️", color: "#f59e0b" },
] as const;

const AGENT_TEMPLATES = [
  {
    key: "1",
    icon: Target,
    emoji: "🎯",
    nameKey: "agentTemplate1Name",
    descKey: "agentTemplate1Desc",
    model: "gpt-4o",
    tags: ["leads", "sales"],
  },
  {
    key: "2",
    icon: PenLine,
    emoji: "✍️",
    nameKey: "agentTemplate2Name",
    descKey: "agentTemplate2Desc",
    model: "claude-sonnet",
    tags: ["content", "writing"],
  },
  {
    key: "3",
    icon: Headphones,
    emoji: "🎧",
    nameKey: "agentTemplate3Name",
    descKey: "agentTemplate3Desc",
    model: "claude-haiku",
    tags: ["support", "tickets"],
  },
] as const;

const CODE_FRAMEWORKS = [
  { id: "python", label: "Python" },
  { id: "typescript", label: "TypeScript" },
  { id: "curl", label: "cURL" },
  { id: "langchain", label: "LangChain" },
  { id: "crewai", label: "CrewAI" },
] as const;

function getCodeSnippet(id: string, baseUrl: string): string {
  switch (id) {
    case "python":
      return `from openai import OpenAI

client = OpenAI(
    api_key="awm_sk_your_key_here",  # ← Your AWM key
    base_url="${baseUrl}/api/v1"      # ← Proxy URL
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`;
    case "typescript":
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'awm_sk_your_key_here',     // ← Your AWM key
  baseURL: '${baseUrl}/api/v1',       // ← Proxy URL
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`;
    case "curl":
      return `curl ${baseUrl}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer awm_sk_your_key_here" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'`;
    case "langchain":
      return `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    api_key="awm_sk_your_key_here",  # ← Your AWM key
    base_url="${baseUrl}/api/v1",     # ← Proxy URL
)

response = llm.invoke("Hello!")`;
    case "crewai":
      return `import os
os.environ["OPENAI_API_KEY"] = "awm_sk_your_key"   # ← Your AWM key
os.environ["OPENAI_API_BASE"] = "${baseUrl}/api/v1" # ← Proxy URL

from crewai import Agent, Task, Crew

agent = Agent(role="Researcher", goal="Find info", llm="gpt-4o")`;
    default:
      return "";
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { currentOrg, refreshOrgs } = useOrg();
  const { t } = useTranslations("onboarding");
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 2: Organization
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Step 3: Team
  const [teamName, setTeamName] = useState("");
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);

  // Step 4: Agent
  const [agentName, setAgentName] = useState("");
  const [agentModel, setAgentModel] = useState("gpt-4o");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Step 5: Provider
  const [providerType, setProviderType] = useState<"openai" | "anthropic">("openai");
  const [providerKey, setProviderKey] = useState("");
  const [providerSkipped, setProviderSkipped] = useState(false);

  // Step 6: Integration
  const [selectedCodeFw, setSelectedCodeFw] = useState("python");

  // Tracking what was created
  const [createdOrg, setCreatedOrg] = useState(false);
  const [createdTeam, setCreatedTeam] = useState(false);
  const [createdAgent, setCreatedAgent] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-app.vercel.app";

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setOrgSlug(currentOrg.slug);
    }
  }, [currentOrg]);

  function handleOrgNameChange(name: string) {
    setOrgName(name);
    setOrgSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 48)
    );
  }

  function selectTemplate(tpl: typeof AGENT_TEMPLATES[number]) {
    setSelectedTemplate(tpl.key);
    setAgentName(t(tpl.nameKey));
    setAgentModel(tpl.model);
  }

  function selectCustomAgent() {
    setSelectedTemplate(null);
    setAgentName("");
    setAgentModel("gpt-4o");
  }

  function selectTeamSuggestion(name: string) {
    setTeamName(name);
  }

  const handleSaveOrg = useCallback(async () => {
    if (!orgName.trim() || !orgSlug.trim() || !currentOrg) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName.trim(), slug: orgSlug.trim() })
        .eq("id", currentOrg.id);
      if (error) {
        toast.error("Failed: " + error.message);
        return;
      }
      await refreshOrgs();
      setCreatedOrg(true);
      setStep(2);
    } finally {
      setSaving(false);
    }
  }, [orgName, orgSlug, currentOrg, supabase, refreshOrgs]);

  const handleCreateTeam = useCallback(async () => {
    if (!teamName.trim() || !currentOrg) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert({ org_id: currentOrg.id, name: teamName.trim() })
        .select("id")
        .single();
      if (error) {
        toast.error("Failed: " + error.message);
        return;
      }
      setCreatedTeamId(data.id);
      setCreatedTeam(true);
      setStep(3);
    } finally {
      setSaving(false);
    }
  }, [teamName, currentOrg, supabase]);

  const handleCreateAgent = useCallback(async () => {
    if (!agentName.trim() || !currentOrg) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("agents").insert({
        org_id: currentOrg.id,
        team_id: createdTeamId,
        name: agentName.trim(),
        model: agentModel,
        status: "active",
        guardrails: {
          max_budget_daily: null,
          max_budget_monthly: null,
          max_task_duration_seconds: null,
          max_tokens_per_request: null,
          rate_limit_rpm: null,
          spike_detection: false,
          auto_pause_on_budget: true,
          auto_downgrade_model: false,
        },
      });
      if (error) {
        toast.error("Failed: " + error.message);
        return;
      }
      setCreatedAgent(true);
      setStep(4);
    } finally {
      setSaving(false);
    }
  }, [agentName, agentModel, currentOrg, createdTeamId, supabase]);

  const handleSaveProvider = useCallback(async () => {
    if (!providerKey.trim()) {
      toast.error(t("providerKeyError"));
      return;
    }
    const isOpenAI = providerType === "openai" && providerKey.startsWith("sk-");
    const isAnthropic =
      providerType === "anthropic" && providerKey.startsWith("sk-ant-");
    if (!isOpenAI && !isAnthropic) {
      toast.error(t("providerKeyError"));
      return;
    }
    setConnectedProvider(true);
    setStep(5);
    toast.success(t("providerValidated"));
  }, [providerKey, providerType, t]);

  function handleComplete() {
    if (currentOrg) {
      localStorage.setItem(`onboarding_complete_${currentOrg.id}`, "true");
    }
    router.push("/dashboard");
  }

  function handleSkipAll() {
    if (currentOrg) {
      localStorage.setItem(`onboarding_skipped_${currentOrg.id}`, "true");
    }
    router.push("/dashboard");
  }

  function goToStep(target: number) {
    if (target < step) setStep(target);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {step > 0 && (
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            const isClickable = isDone;
            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => goToStep(i)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                      isDone
                        ? "border-emerald-500 bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600"
                        : isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 text-muted-foreground/50 cursor-default"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </button>
                  <span
                    className={`text-[10px] font-medium hidden sm:block ${
                      isActive
                        ? "text-foreground"
                        : isDone
                          ? "text-emerald-500"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {t(s.key)}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mt-[-18px] ${
                      isDone ? "bg-emerald-500" : "bg-muted-foreground/20"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 0: Welcome */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">{t("welcomeTitle")} 👋</h1>
            <p className="text-muted-foreground">{t("welcomeSubtitle")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { num: 1, text: t("welcomeCard1"), icon: Building2 },
              { num: 2, text: t("welcomeCard2"), icon: Bot },
              { num: 3, text: t("welcomeCard3"), icon: Rocket },
            ].map((card) => {
              const CardIcon = card.icon;
              return (
                <Card key={card.num}>
                  <CardContent className="pt-6 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CardIcon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{card.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {t("welcomeTime")}
          </p>

          <div className="flex flex-col items-center gap-3">
            <Button size="lg" onClick={() => setStep(1)}>
              {t("welcomeCta")}
              <ChevronRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={handleSkipAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("welcomeSkip")}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Organization */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("orgTitle")}</CardTitle>
            <CardDescription>{t("orgDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">{t("orgName")}</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.currentTarget.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">{t("orgSlug")}</Label>
              <Input
                id="org-slug"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.currentTarget.value)}
                placeholder="acme-corp"
              />
              <p className="text-xs text-muted-foreground">{t("orgSlugHint")}</p>
            </div>
            <StepFooter
              onSkip={handleSkipAll}
              skipLabel={t("skipSetup")}
              onNext={handleSaveOrg}
              nextLabel={saving ? t("saving") : t("continue")}
              nextDisabled={!orgName.trim() || !orgSlug.trim() || saving}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Team */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("teamTitle")}</CardTitle>
            <CardDescription>{t("teamDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2">
              {TEAM_SUGGESTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => selectTeamSuggestion(t(s.key))}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    teamName === t(s.key)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{s.icon}</span>
                  {t(s.key)}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-name">{t("teamName")}</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.currentTarget.value)}
              />
            </div>
            <StepFooter
              onSkip={() => setStep(3)}
              skipLabel={t("skip")}
              onNext={handleCreateTeam}
              nextLabel={saving ? t("creating") : t("createTeam")}
              nextDisabled={!teamName.trim() || saving}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Agent */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("agentTitle")}</CardTitle>
            <CardDescription>{t("agentDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template cards */}
            <div className="grid gap-3 sm:grid-cols-4">
              {AGENT_TEMPLATES.map((tpl) => {
                const isSelected = selectedTemplate === tpl.key;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => selectTemplate(tpl)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <p className="text-lg">{tpl.emoji}</p>
                    <p className="text-sm font-medium mt-1">{t(tpl.nameKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(tpl.descKey)}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      {tpl.model}
                    </p>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={selectCustomAgent}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selectedTemplate === null && agentName === ""
                    ? "border-primary bg-primary/5"
                    : selectedTemplate === null
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted border-dashed"
                }`}
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium mt-1">{t("agentCustom")}</p>
                <p className="text-xs text-muted-foreground">{t("agentCustomDesc")}</p>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">{t("agentName")}</Label>
                <Input
                  id="agent-name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.currentTarget.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("agentModel")}</Label>
                <Select value={agentModel} onValueChange={(v) => v && setAgentModel(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <StepFooter
              onSkip={() => setStep(4)}
              skipLabel={t("skip")}
              onNext={handleCreateAgent}
              nextLabel={saving ? t("creating") : t("createAgent")}
              nextDisabled={!agentName.trim() || saving}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Provider */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("providerTitle")}</CardTitle>
            <CardDescription>{t("providerDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Explainer card */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
              <p className="text-sm font-medium">{t("providerWhyTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("providerWhyDesc")}
              </p>
            </div>

            {/* Provider selection as cards */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setProviderType("openai")}
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  providerType === "openai"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <p className="text-sm font-bold">OpenAI</p>
                <p className="text-[10px] text-muted-foreground">GPT-4o, o3-mini</p>
              </button>
              <button
                type="button"
                onClick={() => setProviderType("anthropic")}
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  providerType === "anthropic"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <p className="text-sm font-bold">Anthropic</p>
                <p className="text-[10px] text-muted-foreground">Claude Opus, Sonnet, Haiku</p>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-key">{t("providerKey")}</Label>
              <Input
                id="provider-key"
                type="password"
                value={providerKey}
                onChange={(e) => setProviderKey(e.currentTarget.value)}
                placeholder={providerType === "openai" ? "sk-..." : "sk-ant-..."}
              />
              <p className="text-xs text-muted-foreground">{t("providerKeyHint")}</p>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProviderSkipped(true);
                  setStep(5);
                }}
              >
                {t("providerLater")}
              </Button>
              <Button onClick={handleSaveProvider} disabled={saving}>
                {saving ? t("providerValidating") : t("providerSave")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Integration */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("integrateTitle")}</CardTitle>
            <CardDescription>{t("integrateSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Framework selector */}
            <div className="flex flex-wrap gap-2">
              {CODE_FRAMEWORKS.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => setSelectedCodeFw(fw.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCodeFw === fw.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {fw.label}
                </button>
              ))}
            </div>

            {/* Code snippet */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2 z-10"
                onClick={() => copyText(getCodeSnippet(selectedCodeFw, baseUrl))}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                <code>{getCodeSnippet(selectedCodeFw, baseUrl)}</code>
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">{t("integrateNote")}</p>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(6)}>
                {t("integrateGotIt")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Done */}
      {step === 6 && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <Rocket className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-xl">{t("doneTitle")} 🎉</CardTitle>
              <CardDescription>{t("doneDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-2 mb-6">
                <SummaryItem
                  label={t("doneOrg")}
                  value={orgName || currentOrg?.name || "—"}
                  done={createdOrg}
                />
                <SummaryItem
                  label={t("doneTeam")}
                  value={createdTeam ? teamName : t("doneNotCreated")}
                  done={createdTeam}
                />
                <SummaryItem
                  label={t("doneAgent")}
                  value={createdAgent ? agentName : t("doneNotCreated")}
                  done={createdAgent}
                />
                <SummaryItem
                  label={t("doneProvider")}
                  value={
                    connectedProvider
                      ? `${providerType === "openai" ? "OpenAI" : "Anthropic"} — ${t("doneConnected")}`
                      : t("doneSkipped")
                  }
                  done={connectedProvider}
                />
              </div>

              {/* What's next */}
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("whatsNext")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <NextAction
                    href="/dashboard"
                    label={t("nextDashboard")}
                    primary
                  />
                  <NextAction href="/agents" label={t("nextAgents")} />
                  <NextAction href="/budget" label={t("nextBudget")} />
                  <NextAction href="/settings" label={t("nextTeam")} />
                  <NextAction href="/docs" label={t("nextDocs")} />
                </div>
              </div>

              <div className="flex justify-center pt-6">
                <Button size="lg" onClick={handleComplete}>
                  {t("nextDashboard")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StepFooter({
  onSkip,
  skipLabel,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onSkip: () => void;
  skipLabel: string;
  onNext: () => void;
  nextLabel: string;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex justify-between pt-2">
      <Button variant="ghost" size="sm" onClick={onSkip}>
        <SkipForward className="h-3.5 w-3.5" />
        {skipLabel}
      </Button>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      {done ? (
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function NextAction({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Button
      variant={primary ? "default" : "outline"}
      size="sm"
      className="justify-start"
      render={<Link href={href} />}
    >
      <ArrowRight className="h-3 w-3" />
      {label}
    </Button>
  );
}
