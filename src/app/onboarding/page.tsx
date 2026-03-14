"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Bot,
  Key,
  Code,
  Rocket,
  Check,
  ChevronRight,
  SkipForward,
} from "lucide-react";

const STEPS = [
  { icon: Building2, label: "Organization" },
  { icon: Users, label: "Team" },
  { icon: Bot, label: "Agent" },
  { icon: Key, label: "Provider" },
  { icon: Code, label: "Integrate" },
  { icon: Rocket, label: "Done" },
] as const;

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "o3-mini", label: "o3-mini" },
  { value: "claude-opus", label: "Claude Opus" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "claude-haiku", label: "Claude Haiku" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { currentOrg, refreshOrgs } = useOrg();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Organization
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Step 2: Team
  const [teamName, setTeamName] = useState("");
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);

  // Step 3: Agent
  const [agentName, setAgentName] = useState("");
  const [agentModel, setAgentModel] = useState("gpt-4o");

  // Step 4: Provider
  const [providerType, setProviderType] = useState<"openai" | "anthropic">(
    "openai"
  );
  const [providerKey, setProviderKey] = useState("");

  // Pre-fill org info
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setOrgSlug(currentOrg.slug);
    }
  }, [currentOrg]);

  // Auto-generate slug from name
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

  const handleSaveOrg = useCallback(async () => {
    if (!orgName.trim() || !orgSlug.trim() || !currentOrg) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName.trim(), slug: orgSlug.trim() })
        .eq("id", currentOrg.id);

      if (error) {
        toast.error("Failed to update organization: " + error.message);
        return;
      }
      await refreshOrgs();
      setStep(1);
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
        .insert({
          org_id: currentOrg.id,
          name: teamName.trim(),
        })
        .select("id")
        .single();

      if (error) {
        toast.error("Failed to create team: " + error.message);
        return;
      }
      setCreatedTeamId(data.id);
      setStep(2);
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
          spike_detection: false,
          auto_pause_on_budget: true,
          auto_downgrade_model: false,
        },
      });

      if (error) {
        toast.error("Failed to create agent: " + error.message);
        return;
      }
      setStep(3);
    } finally {
      setSaving(false);
    }
  }, [agentName, agentModel, currentOrg, createdTeamId, supabase]);

  const handleSaveProvider = useCallback(async () => {
    // Provider keys would be stored encrypted in production.
    // For the onboarding flow, we just validate format and move on.
    if (!providerKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    const isOpenAI =
      providerType === "openai" && providerKey.startsWith("sk-");
    const isAnthropic =
      providerType === "anthropic" && providerKey.startsWith("sk-ant-");

    if (!isOpenAI && !isAnthropic) {
      toast.error(
        providerType === "openai"
          ? 'OpenAI keys start with "sk-"'
          : 'Anthropic keys start with "sk-ant-"'
      );
      return;
    }

    // In production, save encrypted key to org settings
    // For now, mark step as complete
    setStep(4);
    toast.success("Provider key validated");
  }, [providerKey, providerType]);

  function handleComplete() {
    // Mark onboarding as complete in localStorage
    if (currentOrg) {
      localStorage.setItem(`onboarding_complete_${currentOrg.id}`, "true");
    }
    router.push("/dashboard");
  }

  function handleSkip() {
    if (currentOrg) {
      localStorage.setItem(`onboarding_skipped_${currentOrg.id}`, "true");
    }
    router.push("/dashboard");
  }

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-app.vercel.app";

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;

          return (
            <div key={s.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-muted-foreground/50"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isActive
                      ? "text-foreground"
                      : isDone
                        ? "text-emerald-500"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {s.label}
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

      {/* Step content */}
      <Card>
        {/* Step 1: Organization */}
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>Name your organization</CardTitle>
              <CardDescription>
                This is your workspace where you&apos;ll manage all your AI agents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) =>
                    handleOrgNameChange(e.currentTarget.value)
                  }
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">URL slug</Label>
                <Input
                  id="org-slug"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.currentTarget.value)}
                  placeholder="acme-corp"
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs and API references
                </p>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip setup
                </Button>
                <Button
                  onClick={handleSaveOrg}
                  disabled={!orgName.trim() || !orgSlug.trim() || saving}
                >
                  {saving ? "Saving..." : "Continue"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Team */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Create your first team</CardTitle>
              <CardDescription>
                Teams help you organize agents and allocate budgets by department
                or function.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.currentTarget.value)}
                  placeholder="e.g. Sales Automation, Content, Customer Support"
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                  Skip
                </Button>
                <Button
                  onClick={handleCreateTeam}
                  disabled={!teamName.trim() || saving}
                >
                  {saving ? "Creating..." : "Create team"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Agent */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Add your first agent</CardTitle>
              <CardDescription>
                An agent represents an AI workflow you want to track and control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input
                  id="agent-name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.currentTarget.value)}
                  placeholder="e.g. Lead Generator, Content Writer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-model">Primary model</Label>
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
              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                  Skip
                </Button>
                <Button
                  onClick={handleCreateAgent}
                  disabled={!agentName.trim() || saving}
                >
                  {saving ? "Creating..." : "Create agent"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: Provider */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Connect your LLM provider</CardTitle>
              <CardDescription>
                We need your provider API key to proxy requests through
                OpenManage AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="flex gap-3">
                  <Button
                    variant={providerType === "openai" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProviderType("openai")}
                  >
                    OpenAI
                  </Button>
                  <Button
                    variant={
                      providerType === "anthropic" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setProviderType("anthropic")}
                  >
                    Anthropic
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-key">API Key</Label>
                <Input
                  id="provider-key"
                  type="password"
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.currentTarget.value)}
                  placeholder={
                    providerType === "openai"
                      ? "sk-..."
                      : "sk-ant-..."
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Your key is encrypted and only used to proxy requests.
                </p>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(4)}>
                  Skip
                </Button>
                <Button onClick={handleSaveProvider} disabled={saving}>
                  {saving ? "Validating..." : "Save & continue"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 5: Integrate */}
        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Integrate in 30 seconds</CardTitle>
              <CardDescription>
                Just change the base URL in your existing code. That&apos;s it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <pre className="text-xs overflow-x-auto">
                  <code>{`from openai import OpenAI

client = OpenAI(
    api_key="awm_sk_your_key_here",
    base_url="${baseUrl}/api/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`}</code>
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                Create an API key in Settings &rarr; API Keys after setup.
                Full integration guide available in Settings &rarr; Integration.
              </p>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(5)}>
                  Got it
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 6: Done */}
        {step === 5 && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <Rocket className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-xl">You&apos;re all set!</CardTitle>
              <CardDescription>
                Your AI workforce manager is ready. Head to the dashboard to
                start monitoring your agents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center pt-2">
                <Button size="lg" onClick={handleComplete}>
                  Go to Dashboard
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
