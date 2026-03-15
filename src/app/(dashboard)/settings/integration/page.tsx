"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/components/providers/org-provider";
import { useTranslations } from "@/i18n/use-translations";
import { MODEL_PRICING } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plug,
  Key,
  Rocket,
  PartyPopper,
  ArrowRight,
} from "lucide-react";

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://your-app.vercel.app";

// --- Framework definitions ---

type Framework = {
  id: string;
  label: string;
  type: "code" | "nocode";
};

const FRAMEWORKS: Framework[] = [
  { id: "python-openai", label: "Python (OpenAI)", type: "code" },
  { id: "typescript", label: "TypeScript", type: "code" },
  { id: "anthropic-proxy", label: "Python (Anthropic)", type: "code" },
  { id: "langchain", label: "LangChain", type: "code" },
  { id: "crewai", label: "CrewAI", type: "code" },
  { id: "curl", label: "cURL", type: "code" },
  { id: "n8n", label: "n8n", type: "nocode" },
  { id: "make", label: "Make", type: "nocode" },
  { id: "zapier", label: "Zapier", type: "nocode" },
];

function getBeforeCode(id: string): string {
  switch (id) {
    case "python-openai":
      return `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",        # ← direct to OpenAI
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`;
    case "typescript":
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-openai-key',           // ← direct to OpenAI
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`;
    case "anthropic-proxy":
      return `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",        # ← direct to provider
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`;
    case "langchain":
      return `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    api_key="sk-your-openai-key",        # ← direct to OpenAI
)

response = llm.invoke("Hello!")
print(response.content)`;
    case "crewai":
      return `import os
os.environ["OPENAI_API_KEY"] = "sk-your-openai-key"  # ← direct

from crewai import Agent, Task, Crew

agent = Agent(
    role="Researcher",
    goal="Find information",
    llm="gpt-4o",
)`;
    case "curl":
      return `curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-openai-key" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
    default:
      return "";
  }
}

function getAfterCode(id: string, apiKey: string): string {
  const key = apiKey || "awm_sk_your_key_here";
  const url = `${BASE_URL}/api/v1`;

  switch (id) {
    case "python-openai":
      return `from openai import OpenAI

client = OpenAI(
    api_key="${key}",        # ← Your AWM key
    base_url="${url}"        # ← Proxy URL
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`;
    case "typescript":
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '${key}',           // ← Your AWM key
  baseURL: '${url}',          // ← Proxy URL
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`;
    case "anthropic-proxy":
      return `from openai import OpenAI

# Use OpenAI SDK — the proxy handles Anthropic format conversion
client = OpenAI(
    api_key="${key}",        # ← Your AWM key
    base_url="${url}"        # ← Proxy URL
)

response = client.chat.completions.create(
    model="claude-sonnet",              # ← Any supported model
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`;
    case "langchain":
      return `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    api_key="${key}",        # ← Your AWM key
    base_url="${url}",       # ← Proxy URL
)

response = llm.invoke("Hello!")
print(response.content)`;
    case "crewai":
      return `import os
os.environ["OPENAI_API_KEY"] = "${key}"          # ← Your AWM key
os.environ["OPENAI_API_BASE"] = "${url}"         # ← Proxy URL

from crewai import Agent, Task, Crew

agent = Agent(
    role="Researcher",
    goal="Find information",
    llm="gpt-4o",
)`;
    case "curl":
      return `curl ${url}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
    default:
      return "";
  }
}

// --- Highlighted lines (0-indexed) for the "after" code blocks ---
function getHighlightedLines(id: string): number[] {
  switch (id) {
    case "python-openai":
      return [3, 4];
    case "typescript":
      return [3, 4];
    case "anthropic-proxy":
      return [3, 4, 9];
    case "langchain":
      return [3, 4];
    case "crewai":
      return [1, 2];
    case "curl":
      return [0, 2];
    default:
      return [];
  }
}

function getStrikethroughLines(id: string): number[] {
  switch (id) {
    case "python-openai":
      return [3];
    case "typescript":
      return [3];
    case "anthropic-proxy":
      return [3];
    case "langchain":
      return [3];
    case "crewai":
      return [1];
    case "curl":
      return [0, 2];
    default:
      return [];
  }
}

// --- Component ---

export default function IntegrationPage() {
  const { t } = useTranslations("settings");
  const { currentOrg } = useOrg();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [hasProvider, setHasProvider] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasTask, setHasTask] = useState(false);
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string | null>(null);
  const [orgPlan, setOrgPlan] = useState("free");

  const [selectedFramework, setSelectedFramework] = useState("python-openai");

  // Reference section accordion
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentOrg) loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function loadStatus() {
    setLoading(true);
    const orgId = currentOrg!.id;

    const [providersRes, keysRes, tasksRes, orgRes] = await Promise.all([
      supabase
        .from("providers")
        .select("id")
        .eq("org_id", orgId)
        .eq("health_status", "healthy")
        .limit(1),
      supabase
        .from("api_keys")
        .select("id, key_prefix")
        .eq("org_id", orgId)
        .limit(1),
      supabase
        .from("tasks")
        .select("id")
        .eq("org_id", orgId)
        .limit(1),
      supabase
        .from("organizations")
        .select("plan")
        .eq("id", orgId)
        .single(),
    ]);

    setHasProvider((providersRes.data?.length || 0) > 0);
    setHasApiKey((keysRes.data?.length || 0) > 0);
    setApiKeyPrefix(keysRes.data?.[0]?.key_prefix || null);
    setHasTask((tasksRes.data?.length || 0) > 0);
    setOrgPlan(orgRes.data?.plan || "free");
    setLoading(false);
  }

  function toggleSection(section: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("copied"));
  }

  const maskedKey = apiKeyPrefix ? `${apiKeyPrefix}****` : "";
  const completedSteps = [hasProvider, hasApiKey, hasTask].filter(Boolean).length;
  const allComplete = completedSteps === 3;
  const fw = FRAMEWORKS.find((f) => f.id === selectedFramework)!;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("integration")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("integrationDesc")}
        </p>
      </div>

      {/* Section 1: Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {t("intQuickStart")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("intQuickStartDesc")}
          </p>
        </CardHeader>
        <CardContent>
          {allComplete ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <PartyPopper className="h-5 w-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-medium text-emerald-500">
                {t("intAllSet")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                render={<Link href="/dashboard" />}
              >
                {t("intViewDashboard")}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Step 1: Provider */}
              <StepCard
                done={hasProvider}
                label={t("intStepProvider")}
                icon={<Plug className="h-4 w-4" />}
                action={
                  !hasProvider ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href="/settings/providers" />}
                    >
                      {t("intStepProviderAction")}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  ) : undefined
                }
              />

              {/* Step 2: API Key */}
              <StepCard
                done={hasApiKey}
                label={t("intStepApiKey")}
                icon={<Key className="h-4 w-4" />}
                action={
                  !hasApiKey ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href="/settings/api-keys" />}
                    >
                      {t("intStepApiKeyAction")}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  ) : undefined
                }
              />

              {/* Step 3: First Request */}
              <StepCard
                done={hasTask}
                label={t("intStepFirstRequest")}
                icon={<Rocket className="h-4 w-4" />}
                action={
                  !hasTask ? (
                    <span className="text-xs text-muted-foreground">
                      {t("intStepFirstRequestAction")} ↓
                    </span>
                  ) : undefined
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Integration Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("intIntegrationCode")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("intIntegrationCodeDesc")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Framework selector chips */}
          <div className="flex flex-wrap gap-2">
            {FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFramework(f.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedFramework === f.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Code comparison or no-code instructions */}
          {fw.type === "code" ? (
            <CodeComparison
              frameworkId={selectedFramework}
              apiKey={maskedKey}
              hasKey={hasApiKey}
              t={t}
              onCopy={copyText}
            />
          ) : (
            <NoCodeInstructions
              frameworkId={selectedFramework}
              apiKey={maskedKey}
              hasKey={hasApiKey}
              t={t}
              onCopy={copyText}
            />
          )}

          <p className="text-xs text-muted-foreground">{t("intCodeNote")}</p>
        </CardContent>
      </Card>

      {/* Section 3: Reference (collapsible) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("intReference")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          {/* Models & Pricing */}
          <AccordionSection
            title={t("intModelsAndPricing")}
            open={openSections.has("models")}
            onToggle={() => toggleSection("models")}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("intModelName")}</th>
                    <th className="pb-2 font-medium">{t("intProvider")}</th>
                    <th className="pb-2 font-medium text-right">{t("intInputPrice")}</th>
                    <th className="pb-2 font-medium text-right">{t("intOutputPrice")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(MODEL_PRICING).map(([model, info]) => (
                    <tr key={model}>
                      <td className="py-2 font-mono text-xs">{model}</td>
                      <td className="py-2 capitalize">{info.provider}</td>
                      <td className="py-2 text-right">${info.input.toFixed(2)}</td>
                      <td className="py-2 text-right">${info.output.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionSection>

          {/* API Reference */}
          <AccordionSection
            title={t("intApiReference")}
            open={openSections.has("api")}
            onToggle={() => toggleSection("api")}
          >
            <div className="space-y-3 text-sm">
              <RefRow label={t("intApiBaseUrl")}>
                <CopyableValue value={`${BASE_URL}/api/v1`} onCopy={copyText} />
              </RefRow>
              <RefRow label={t("intApiEndpoint")}>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  POST /chat/completions
                </code>
              </RefRow>
              <RefRow label={t("intApiAuth")}>{t("intApiAuthDesc")}</RefRow>
              <RefRow label={t("intApiFormat")}>{t("intApiFormatDesc")}</RefRow>
              <RefRow label={t("intApiResponse")}>{t("intApiResponseDesc")}</RefRow>
              <RefRow label={t("intApiStreaming")}>{t("intApiStreamingDesc")}</RefRow>
            </div>
          </AccordionSection>

          {/* Rate Limits */}
          <AccordionSection
            title={t("intRateLimits")}
            open={openSections.has("rates")}
            onToggle={() => toggleSection("rates")}
          >
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("intPlan")}</th>
                    <th className="pb-2 font-medium text-right">{t("intReqPerMin")}</th>
                    <th className="pb-2 font-medium text-right">{t("intReqPerMonth")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { plan: "Free", rpm: "100", monthly: "1,000", id: "free" },
                    { plan: "Pro", rpm: "500", monthly: "50,000", id: "pro" },
                    { plan: "Enterprise", rpm: "2,000", monthly: "Unlimited", id: "enterprise" },
                  ].map((row) => (
                    <tr key={row.id}>
                      <td className="py-2">
                        {row.plan}
                        {row.id === orgPlan && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Current
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">{row.rpm}</td>
                      <td className="py-2 text-right">{row.monthly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button
                variant="link"
                size="sm"
                className="px-0 h-auto text-xs"
                render={<Link href="/settings" />}
              >
                {t("intNeedMore")}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </AccordionSection>

          {/* Response Headers */}
          <AccordionSection
            title={t("intResponseHeaders")}
            open={openSections.has("headers")}
            onToggle={() => toggleSection("headers")}
          >
            <div className="space-y-2 text-sm">
              <HeaderRow header="X-RateLimit-Limit" desc={t("intHeaderLimit")} />
              <HeaderRow header="X-RateLimit-Remaining" desc={t("intHeaderRemaining")} />
              <HeaderRow header="Retry-After" desc={t("intHeaderRetry")} />
            </div>
          </AccordionSection>

          {/* Error Codes */}
          <AccordionSection
            title={t("intErrorCodes")}
            open={openSections.has("errors")}
            onToggle={() => toggleSection("errors")}
          >
            <div className="space-y-3">
              {[
                { code: "401", desc: t("intError401") },
                { code: "404", desc: t("intError404") },
                { code: "429", desc: t("intError429") },
                { code: "502", desc: t("intError502") },
              ].map((e) => (
                <div key={e.code} className="flex gap-3">
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">
                    {e.code}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{e.desc}</p>
                </div>
              ))}
            </div>
          </AccordionSection>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function StepCard({
  done,
  label,
  icon,
  action,
}: {
  done: boolean;
  label: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex-1 rounded-lg border p-4 space-y-2 ${
        done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 pl-6">
        {done ? (
          <span className="text-xs text-emerald-500">{icon}</span>
        ) : (
          action
        )}
      </div>
    </div>
  );
}

function CodeComparison({
  frameworkId,
  apiKey,
  hasKey,
  t,
  onCopy,
}: {
  frameworkId: string;
  apiKey: string;
  hasKey: boolean;
  t: (key: string) => string;
  onCopy: (text: string) => void;
}) {
  const before = getBeforeCode(frameworkId);
  const after = getAfterCode(frameworkId, apiKey);
  const highlights = getHighlightedLines(frameworkId);
  const strikethroughs = getStrikethroughLines(frameworkId);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Before */}
      <div className="lg:col-span-2 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("intCurrentCode")}
        </p>
        <pre className="rounded-lg bg-muted/50 p-4 text-xs overflow-x-auto opacity-60">
          <code>
            {before.split("\n").map((line, i) => (
              <span
                key={i}
                className={
                  strikethroughs.includes(i) ? "line-through text-destructive/60" : ""
                }
              >
                {line}
                {"\n"}
              </span>
            ))}
          </code>
        </pre>
      </div>

      {/* After */}
      <div className="lg:col-span-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">
            {t("intUpdatedCode")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onCopy(after)}
          >
            <Copy className="h-3 w-3" />
            {t("intCopy")}
          </Button>
        </div>
        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto relative">
          <code>
            {after.split("\n").map((line, i) => (
              <span
                key={i}
                className={
                  highlights.includes(i)
                    ? "bg-emerald-500/10 border-l-2 border-emerald-500 -ml-4 pl-[14px] inline-block w-full"
                    : ""
                }
              >
                {line}
                {"\n"}
              </span>
            ))}
          </code>
          {!hasKey && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-[10px]">
                {t("intNoKeyHint")} ↑
              </Badge>
            </div>
          )}
        </pre>
      </div>
    </div>
  );
}

function NoCodeInstructions({
  frameworkId,
  apiKey,
  hasKey,
  t,
  onCopy,
}: {
  frameworkId: string;
  apiKey: string;
  hasKey: boolean;
  t: (key: string) => string;
  onCopy: (text: string) => void;
}) {
  const key = apiKey || "awm_sk_your_key_here";
  const url = `${BASE_URL}/api/v1/chat/completions`;
  const bearerValue = `Bearer ${key}`;

  type Step = { text: string; copyable?: string };
  let title = "";
  let steps: Step[] = [];

  if (frameworkId === "n8n") {
    title = t("intN8nTitle");
    steps = [
      { text: t("intN8nStep1") },
      { text: t("intN8nStep2") },
      { text: t("intN8nStep3"), copyable: url },
      { text: t("intN8nStep4") },
      { text: t("intN8nStep5"), copyable: bearerValue },
      { text: t("intN8nStep6") },
    ];
  } else if (frameworkId === "make") {
    title = t("intMakeTitle");
    steps = [
      { text: t("intMakeStep1") },
      { text: t("intMakeStep2"), copyable: url },
      { text: t("intMakeStep3") },
      { text: t("intMakeStep4"), copyable: bearerValue },
      { text: t("intMakeStep5") },
      { text: t("intMakeStep6") },
    ];
  } else if (frameworkId === "zapier") {
    title = t("intZapierTitle");
    steps = [
      { text: t("intZapierStep1") },
      { text: t("intZapierStep2"), copyable: url },
      { text: t("intZapierStep3") },
      { text: t("intZapierStep4"), copyable: bearerValue },
      { text: t("intZapierStep5") },
    ];
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {i + 1}
            </span>
            <div className="space-y-1 pt-0.5">
              <p className="text-sm">{step.text}</p>
              {step.copyable && (
                <button
                  type="button"
                  onClick={() => onCopy(step.copyable!)}
                  className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs font-mono hover:bg-muted/80 transition-colors"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                  {step.copyable}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!hasKey && (
        <Badge variant="secondary" className="text-[10px]">
          {t("intNoKeyHint")} ↑
        </Badge>
      )}
    </div>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function RefRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <span className="text-muted-foreground font-medium min-w-[140px] shrink-0">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}

function CopyableValue({
  value,
  onCopy,
}: {
  value: string;
  onCopy: (text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs font-mono hover:bg-muted/80 transition-colors"
    >
      <Copy className="h-3 w-3 text-muted-foreground" />
      {value}
    </button>
  );
}

function HeaderRow({ header, desc }: { header: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
        {header}
      </code>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </div>
  );
}
