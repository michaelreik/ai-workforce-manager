"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "@/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { MODEL_PRICING } from "@/lib/pricing";
import {
  UserPlus,
  Plug,
  KeyRound,
  Code,
  Rocket,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  ArrowRight,
  Search,
  DollarSign,
  ShieldAlert,
} from "lucide-react";

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://your-app.vercel.app";

// --- Nav items ---
const NAV_ITEMS = [
  { id: "getting-started", key: "navGettingStarted" },
  { id: "how-it-works", key: "navHowItWorks" },
  { id: "setup-guide", key: "navSetupGuide" },
  { id: "code-examples", key: "navCodeExamples" },
  { id: "use-cases", key: "navUseCases" },
  { id: "faq", key: "navFaq" },
  { id: "troubleshooting", key: "navTroubleshooting" },
] as const;

// --- Code snippets ---
function getCodeBefore(id: string): string {
  switch (id) {
    case "python":
      return `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`;
    case "typescript":
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-openai-key',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`;
    case "anthropic":
      return `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`;
    case "langchain":
      return `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    api_key="sk-your-openai-key",
)

response = llm.invoke("Hello!")`;
    case "crewai":
      return `import os
os.environ["OPENAI_API_KEY"] = "sk-your-key"

from crewai import Agent, Task, Crew

agent = Agent(
    role="Researcher",
    goal="Find information",
    llm="gpt-4o",
)`;
    case "curl":
      return `curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-key" \\
  -d '{"model":"gpt-4o","messages":[...]}'`;
    default:
      return "";
  }
}

function getCodeAfter(id: string): string {
  const url = `${BASE_URL}/api/v1`;
  switch (id) {
    case "python":
      return `from openai import OpenAI

client = OpenAI(
    api_key="awm_sk_your_key_here",  # ← NEW
    base_url="${url}"                 # ← NEW
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`;
    case "typescript":
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'awm_sk_your_key_here',     // ← NEW
  baseURL: '${url}',                  // ← NEW
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`;
    case "anthropic":
      return `from openai import OpenAI

# Use OpenAI SDK — proxy handles format conversion
client = OpenAI(
    api_key="awm_sk_your_key_here",  # ← NEW
    base_url="${url}"                 # ← NEW
)

response = client.chat.completions.create(
    model="claude-sonnet",           # ← Any model
    messages=[{"role": "user", "content": "Hello!"}]
)`;
    case "langchain":
      return `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    api_key="awm_sk_your_key_here",  # ← NEW
    base_url="${url}",               # ← NEW
)

response = llm.invoke("Hello!")`;
    case "crewai":
      return `import os
os.environ["OPENAI_API_KEY"] = "awm_sk_your_key"   # ← NEW
os.environ["OPENAI_API_BASE"] = "${url}"            # ← NEW

from crewai import Agent, Task, Crew

agent = Agent(
    role="Researcher",
    goal="Find information",
    llm="gpt-4o",
)`;
    case "curl":
      return `curl ${url}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer awm_sk_your_key" \\
  -d '{"model":"gpt-4o","messages":[...]}'`;
    default:
      return "";
  }
}

const CODE_FRAMEWORKS = [
  { id: "python", label: "Python (OpenAI)" },
  { id: "typescript", label: "TypeScript" },
  { id: "anthropic", label: "Anthropic via Proxy" },
  { id: "langchain", label: "LangChain" },
  { id: "crewai", label: "CrewAI" },
  { id: "curl", label: "cURL" },
] as const;

// N8n/Make/Zapier instructions
function getNoCodeSteps(
  id: string,
  url: string
): { text: string; value?: string }[] {
  if (id === "n8n")
    return [
      { text: "Open your HTTP Request node" },
      { text: "Set Method to POST" },
      { text: "Set URL to:", value: url },
      { text: "Add Header: Authorization" },
      { text: "Set Header Value to:", value: "Bearer awm_sk_your_key_here" },
      { text: "Set Body (JSON) with your model and messages" },
    ];
  if (id === "make")
    return [
      { text: "Add an HTTP module (Make a request)" },
      { text: "Set URL to:", value: url },
      { text: "Set Method to POST" },
      {
        text: "Add Header — Key: Authorization, Value:",
        value: "Bearer awm_sk_your_key_here",
      },
      { text: "Set Body type to Raw → JSON" },
      { text: "Add your model and messages to the JSON body" },
    ];
  if (id === "zapier")
    return [
      { text: 'Add a "Webhooks by Zapier" action (POST)' },
      { text: "Set URL to:", value: url },
      { text: "Set Payload Type to JSON" },
      {
        text: "Add Header — Authorization:",
        value: "Bearer awm_sk_your_key_here",
      },
      { text: "Add Data fields: model, messages" },
    ];
  return [];
}

const NOCODE_FRAMEWORKS = [
  { id: "n8n", label: "n8n" },
  { id: "make", label: "Make (Integromat)" },
  { id: "zapier", label: "Zapier" },
] as const;

// --- Main component ---

export default function DocsPage() {
  const { t } = useTranslations("docs");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("getting-started");
  const [selectedCodeFw, setSelectedCodeFw] = useState("python");
  const [selectedNoCodeFw, setSelectedNoCodeFw] = useState("n8n");
  const [openSetupSteps, setOpenSetupSteps] = useState<Set<string>>(
    new Set(["step1"])
  );
  const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0% -60% 0%" }
    );

    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  function toggleSetupStep(step: string) {
    setOpenSetupSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  }

  function toggleFaq(id: string) {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  const proxyUrl = `${BASE_URL}/api/v1/chat/completions`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold">
            OpenManage AI
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/dashboard" />}
            >
              {t("backToApp")}
            </Button>
            <Button size="sm" render={<Link href="/signup" />}>
              {t("signUp")}
            </Button>
            <button
              type="button"
              className="lg:hidden p-1"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl flex">
        {/* Sidebar Nav */}
        <aside
          className={`fixed lg:sticky top-14 z-40 h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-border bg-background overflow-y-auto p-4 transition-transform lg:translate-x-0 ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileNavOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  activeSection === item.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t(item.key)}
              </a>
            ))}
          </nav>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 lg:px-12 py-8 space-y-24">
          {/* ===== Section 1: Getting Started ===== */}
          <section id="getting-started" className="scroll-mt-20">
            {/* Hero */}
            <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 lg:p-12">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
                {t("heroTitle")}
              </h1>
              <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
                {t("heroSubtitle")}
              </p>
              <Button className="mt-6" render={<Link href="/signup" />}>
                {t("heroCta")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 5-step timeline */}
            <div className="mt-10 space-y-0">
              {[
                {
                  icon: UserPlus,
                  title: t("step1Title"),
                  desc: t("step1Desc"),
                },
                {
                  icon: Plug,
                  title: t("step2Title"),
                  desc: t("step2Desc"),
                },
                {
                  icon: KeyRound,
                  title: t("step3Title"),
                  desc: t("step3Desc"),
                },
                {
                  icon: Code,
                  title: t("step4Title"),
                  desc: t("step4Desc"),
                },
                {
                  icon: Rocket,
                  title: t("step5Title"),
                  desc: t("step5Desc"),
                },
              ].map((step, i) => {
                const Icon = step.icon;
                const isLast = i === 4;
                return (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                        <Icon className="h-5 w-5" />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-border my-1" />
                      )}
                    </div>
                    <div className={isLast ? "pb-0" : "pb-8"}>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== Section 2: How It Works ===== */}
          <section id="how-it-works" className="scroll-mt-20">
            <h2 className="text-2xl font-bold">{t("howItWorksTitle")}</h2>

            {/* Flow diagram */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 justify-center">
              <FlowBox label={t("howYourAgent")} accent={false} />
              <FlowArrow />
              <FlowBox label={t("howProxy")} accent>
                <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                  {[
                    t("howProxyAuth"),
                    t("howProxyBudget"),
                    t("howProxyGuardrails"),
                    t("howProxyTrack"),
                  ].map((s) => (
                    <span
                      key={s}
                      className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </FlowBox>
              <FlowArrow />
              <FlowBox label={t("howProvider")} accent={false} />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {t("howSubtitle")}
            </p>

            {/* 3 benefit cards */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <BenefitCard
                icon={<Search className="h-5 w-5" />}
                title={t("howVisibilityTitle")}
                desc={t("howVisibilityDesc")}
              />
              <BenefitCard
                icon={<DollarSign className="h-5 w-5" />}
                title={t("howBudgetTitle")}
                desc={t("howBudgetDesc")}
              />
              <BenefitCard
                icon={<ShieldAlert className="h-5 w-5" />}
                title={t("howKillSwitchTitle")}
                desc={t("howKillSwitchDesc")}
              />
            </div>
          </section>

          {/* ===== Section 3: Setup Guide ===== */}
          <section id="setup-guide" className="scroll-mt-20">
            <h2 className="text-2xl font-bold">{t("setupGuideTitle")}</h2>
            <div className="mt-6 space-y-2">
              {/* Step 1 */}
              <AccordionItem
                open={openSetupSteps.has("step1")}
                onToggle={() => toggleSetupStep("step1")}
                title={`1. ${t("setupStep1Title")}`}
              >
                <p className="text-sm text-muted-foreground">
                  {t("setupStep1Desc")}
                </p>
              </AccordionItem>

              {/* Step 2 */}
              <AccordionItem
                open={openSetupSteps.has("step2")}
                onToggle={() => toggleSetupStep("step2")}
                title={`2. ${t("setupStep2Title")}`}
              >
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-mono text-xs text-foreground bg-muted rounded px-2 py-1 inline-block">
                    {t("setupStep2Path")}
                  </p>
                  <p>{t("setupStep2Desc")}</p>
                  <p>{t("setupStep2Providers")}</p>
                  <p>{t("setupStep2Test")}</p>
                </div>
              </AccordionItem>

              {/* Step 3 */}
              <AccordionItem
                open={openSetupSteps.has("step3")}
                onToggle={() => toggleSetupStep("step3")}
                title={`3. ${t("setupStep3Title")}`}
              >
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-mono text-xs text-foreground bg-muted rounded px-2 py-1 inline-block">
                    {t("setupStep3Path")}
                  </p>
                  <p>{t("setupStep3Desc")}</p>
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-500 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {t("setupStep3Warning")}
                  </div>
                  <p className="font-mono text-xs">{t("setupStep3Format")}</p>
                </div>
              </AccordionItem>

              {/* Step 4 */}
              <AccordionItem
                open={openSetupSteps.has("step4")}
                onToggle={() => toggleSetupStep("step4")}
                title={`4. ${t("setupStep4Title")}`}
              >
                <div className="space-y-3">
                  <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium">
                    {t("setupStep4Highlight")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    See the Code Examples section below for every framework.
                  </p>
                </div>
              </AccordionItem>

              {/* Step 5 */}
              <AccordionItem
                open={openSetupSteps.has("step5")}
                onToggle={() => toggleSetupStep("step5")}
                title={`5. ${t("setupStep5Title")}`}
              >
                <div className="space-y-2">
                  {[
                    t("setupStep5Check1"),
                    t("setupStep5Check2"),
                    t("setupStep5Check3"),
                    t("setupStep5Check4"),
                  ].map((check, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      {check}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    <a
                      href="#troubleshooting"
                      className="text-primary hover:underline"
                    >
                      {t("setupStep5Trouble")}
                    </a>
                  </p>
                </div>
              </AccordionItem>
            </div>
          </section>

          {/* ===== Section 4: Code Examples ===== */}
          <section id="code-examples" className="scroll-mt-20">
            <h2 className="text-2xl font-bold">{t("codeExamplesTitle")}</h2>

            {/* Code frameworks */}
            <div className="mt-6 flex flex-wrap gap-2">
              {CODE_FRAMEWORKS.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => setSelectedCodeFw(fw.id)}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    selectedCodeFw === fw.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {fw.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* Before */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("codeBefore")}
                </p>
                <pre className="rounded-lg bg-muted/50 p-4 text-xs overflow-x-auto opacity-60 border border-border">
                  <code>{getCodeBefore(selectedCodeFw)}</code>
                </pre>
              </div>

              {/* After */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">
                    {t("codeAfter")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => copyText(getCodeAfter(selectedCodeFw))}
                  >
                    <Copy className="h-3 w-3" />
                    {t("codeCopy")}
                  </Button>
                </div>
                <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto border border-primary/20">
                  <code>{getCodeAfter(selectedCodeFw)}</code>
                </pre>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {t("codeThatsIt")}
            </p>

            {/* No-code tools */}
            <div className="mt-8">
              <div className="flex flex-wrap gap-2 mb-4">
                {NOCODE_FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => setSelectedNoCodeFw(fw.id)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      selectedNoCodeFw === fw.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {fw.label}
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-border p-4 space-y-3">
                {getNoCodeSteps(selectedNoCodeFw, proxyUrl).map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <div className="space-y-1 pt-0.5">
                      <p className="text-sm">{step.text}</p>
                      {step.value && (
                        <button
                          type="button"
                          onClick={() => copyText(step.value!)}
                          className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs font-mono hover:bg-muted/80 transition-colors"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                          {step.value}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ===== Section 5: Use Cases ===== */}
          <section id="use-cases" className="scroll-mt-20">
            <h2 className="text-2xl font-bold">{t("useCasesTitle")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <UseCaseCard
                title={t("useCase1Title")}
                setup={t("useCase1Setup")}
                metrics={[t("useCase1Metric1"), t("useCase1Metric2")]}
                roi={t("useCase1Roi")}
              />
              <UseCaseCard
                title={t("useCase2Title")}
                setup={t("useCase2Setup")}
                metrics={[t("useCase2Metric1"), t("useCase2Metric2")]}
                roi={t("useCase2Roi")}
              />
              <UseCaseCard
                title={t("useCase3Title")}
                setup={t("useCase3Setup")}
                metrics={[t("useCase3Metric1"), t("useCase3Metric2")]}
                roi={t("useCase3Roi")}
              />
            </div>
          </section>

          {/* ===== Section 6: FAQ ===== */}
          <section id="faq" className="scroll-mt-20">
            <h2 className="text-2xl font-bold">{t("faqTitle")}</h2>
            <div className="mt-6 space-y-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <AccordionItem
                  key={n}
                  open={openFaqs.has(`faq${n}`)}
                  onToggle={() => toggleFaq(`faq${n}`)}
                  title={t(`faq${n}Q`)}
                >
                  <p className="text-sm text-muted-foreground">
                    {t(`faq${n}A`)}
                  </p>
                </AccordionItem>
              ))}
            </div>
          </section>

          {/* ===== Section 7: Troubleshooting ===== */}
          <section id="troubleshooting" className="scroll-mt-20">
            <h2 className="text-2xl font-bold">{t("troubleshootingTitle")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: t("troubleTitle401"),
                  desc: t("troubleDesc401"),
                  color: "text-red-400",
                },
                {
                  title: t("troubleTitle429Budget"),
                  desc: t("troubleDesc429Budget"),
                  color: "text-amber-400",
                },
                {
                  title: t("troubleTitle429Rate"),
                  desc: t("troubleDesc429Rate"),
                  color: "text-amber-400",
                },
                {
                  title: t("troubleTitle502"),
                  desc: t("troubleDesc502"),
                  color: "text-red-400",
                },
                {
                  title: t("troubleTitleNoTasks"),
                  desc: t("troubleDescNoTasks"),
                  color: "text-blue-400",
                },
                {
                  title: t("troubleTitleZeroCost"),
                  desc: t("troubleDescZeroCost"),
                  color: "text-blue-400",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border p-4 space-y-2"
                >
                  <h3 className={`text-sm font-semibold ${item.color}`}>
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-border pt-8 pb-12">
            <p className="text-sm text-muted-foreground text-center">
              {t("footerStuck")}
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t("footerLanding")}
              </Link>
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t("footerLogin")}
              </Link>
              <Link
                href="/signup"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t("footerSignup")}
              </Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

// --- Sub-components ---

function FlowBox({
  label,
  accent,
  children,
}: {
  label: string;
  accent: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-6 py-4 text-center min-w-[140px] ${
        accent
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-muted/30"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="text-muted-foreground hidden sm:block">
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border p-5 space-y-2">
      <div className="text-primary">{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function AccordionItem({
  open,
  onToggle,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function UseCaseCard({
  title,
  setup,
  metrics,
  roi,
}: {
  title: string;
  setup: string;
  metrics: string[];
  roi: string;
}) {
  return (
    <div className="rounded-lg border border-border p-5 space-y-3">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="text-xs text-muted-foreground">{setup}</p>
      <div className="space-y-1">
        {metrics.map((m, i) => (
          <p
            key={i}
            className="text-xs font-mono bg-muted rounded px-2 py-1"
          >
            {m}
          </p>
        ))}
      </div>
      <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-xs text-emerald-500 font-medium">
        {roi}
      </div>
    </div>
  );
}
