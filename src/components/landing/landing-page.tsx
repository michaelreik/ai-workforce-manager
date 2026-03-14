"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// --- Scroll animation hook ---

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// --- Nav ---

function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-lg border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            AI
          </div>
          <span className="font-semibold text-foreground">OpenManage AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/login" />}>
            Log in
          </Button>
          <Button size="sm" render={<Link href="/signup" />}>
            Start Free
          </Button>
        </div>
      </div>
    </nav>
  );
}

// --- Hero ---

function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-chart-2/5 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-6 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Now in public beta
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Manage Your AI Workforce
            <br />
            <span className="bg-gradient-to-r from-chart-1 to-chart-3 bg-clip-text text-transparent">
              Like Your Team
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The HR dashboard for AI agents. Budget control, performance
            tracking, and kill switches — built for managers, not engineers.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="px-8 h-11 text-base"
              render={<Link href="/signup" />}
            >
              Start Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 h-11 text-base"
              render={<a href="#features" />}
            >
              See Features
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free for up to 3 agents. No credit card required.
          </p>
        </FadeIn>

        {/* Dashboard mockup */}
        <FadeIn delay={400}>
          <div className="mt-16 mx-auto max-w-3xl rounded-xl border border-border bg-card/50 p-2 ring-1 ring-foreground/5 shadow-2xl">
            <div className="rounded-lg bg-card border border-border overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="text-[10px] text-muted-foreground ml-2">
                  OpenManage AI — Dashboard
                </span>
              </div>
              {/* Mock dashboard content */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Active Agents", value: "6", color: "text-emerald-400" },
                    { label: "Daily Spend", value: "$12.40", color: "text-chart-1" },
                    { label: "Monthly Budget", value: "$450", color: "text-chart-2" },
                    { label: "Alerts", value: "2", color: "text-yellow-400" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-lg bg-muted/30 border border-border p-3"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className={`text-lg font-bold ${kpi.color}`}>
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Mock agent rows */}
                <div className="space-y-2">
                  {[
                    { name: "Lead Generator", model: "GPT-4o", pct: 65, status: "active" },
                    { name: "Content Writer", model: "Claude Sonnet", pct: 93, status: "active" },
                    { name: "Support Bot", model: "Claude Haiku", pct: 20, status: "active" },
                  ].map((agent) => (
                    <div
                      key={agent.name}
                      className="flex items-center gap-3 rounded-lg bg-muted/20 border border-border px-4 py-2.5"
                    >
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium flex-1">
                        {agent.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {agent.model}
                      </span>
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            agent.pct > 90
                              ? "bg-red-500"
                              : agent.pct > 70
                                ? "bg-yellow-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${agent.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">
                        {agent.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// --- Problem Section ---

function ProblemSection() {
  const problems = [
    {
      icon: "\uD83D\uDCB8",
      title: "Runaway costs",
      description:
        'An agent in an endless loop cost us $3,000 overnight. No one noticed until the invoice.',
    },
    {
      icon: "\uD83D\uDEA6",
      title: "Resource conflicts",
      description:
        "Our HR bot blocked our sales bot because we hit the API rate limit. Both went down.",
    },
    {
      icon: "\uD83D\uDCC9",
      title: "Wasted spend",
      description:
        "We\u2019re using GPT-4o for tasks that GPT-4o-mini handles fine. Nobody tracks which model goes where.",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-foreground">
            Sound familiar?
          </h2>
          <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
            AI agents are powerful — but without oversight, they become
            expensive liabilities.
          </p>
        </FadeIn>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {problems.map((p, i) => (
            <FadeIn key={p.title} delay={i * 100}>
              <div className="rounded-xl border border-border bg-card p-6 h-full">
                <span className="text-3xl">{p.icon}</span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Analogy Section ---

function AnalogySection() {
  const rows = [
    { hr: "Salary & compensation", ai: "Token budget & cost caps" },
    { hr: "Work hours & overtime", ai: "Task duration & rate limits" },
    { hr: "Performance reviews", ai: "ROI & quality metrics" },
    { hr: "Hiring & firing", ai: "Deploy & kill switch" },
    { hr: "Department budgets", ai: "Team budget allocation" },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6">
        <FadeIn>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-foreground">
            Same logic. Finally available for AI agents.
          </h2>
          <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
            You already manage human teams with budgets, reviews, and
            escalation paths. Your AI workforce deserves the same.
          </p>
        </FadeIn>

        <FadeIn delay={150}>
          <div className="mt-12 rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-2">
              <div className="px-5 py-3 bg-muted/50 border-b border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Managing People
              </div>
              <div className="px-5 py-3 bg-primary/5 border-b border-border text-xs font-semibold text-primary uppercase tracking-wider">
                Managing AI Agents
              </div>
            </div>
            {rows.map((row, i) => (
              <div
                key={row.hr}
                className={`grid grid-cols-2 ${
                  i < rows.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="px-5 py-3.5 border-r border-border text-sm text-muted-foreground">
                  {row.hr}
                </div>
                <div className="px-5 py-3.5 text-sm text-foreground font-medium">
                  {row.ai}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// --- Features Section ---

function FeaturesSection() {
  const features = [
    {
      title: "Workforce Overview",
      description:
        "See all agents at a glance — status, budget usage, model, and performance in one dashboard.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      ),
    },
    {
      title: "Budget Control",
      description:
        "Set daily and monthly budgets per agent and team. Auto-pause when limits are hit. No more surprise invoices.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      title: "ROI Tracking",
      description:
        "Know exactly what each agent costs per lead, per article, per ticket. Real business metrics, not just token counts.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
    {
      title: "Kill Switch & Guardrails",
      description:
        "Spike detection, automatic pausing, and emergency kill switch. Stop runaway agents before they drain your budget.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="py-20 md:py-28 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-foreground">
            Everything you need to manage AI at scale
          </h2>
          <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
            From cost visibility to emergency controls — one platform for your
            entire AI workforce.
          </p>
        </FadeIn>

        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 100}>
              <div className="rounded-xl border border-border bg-card p-6 h-full flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Social Proof ---

function SocialProofSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <blockquote className="text-center">
            <p className="text-lg md:text-xl text-foreground italic leading-relaxed">
              &ldquo;This idea hits exactly the nerve of one of the biggest
              current problems when scaling AI in enterprises.&rdquo;
            </p>
            <footer className="mt-6 text-sm text-muted-foreground">
              — Early beta feedback
            </footer>
          </blockquote>
        </FadeIn>
      </div>
    </section>
  );
}

// --- ROI Example ---

function ROIExample() {
  return (
    <section className="py-20 md:py-28 bg-muted/20">
      <div className="mx-auto max-w-4xl px-6">
        <FadeIn>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-foreground">
            Know exactly what your AI agents deliver
          </h2>
          <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
            Real business metrics. Not just token counts.
          </p>
        </FadeIn>

        <FadeIn delay={150}>
          <div className="mt-12 rounded-xl border border-border bg-card p-6 md:p-8 max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-lg">
                🤖
              </div>
              <div>
                <p className="font-semibold text-foreground">Lead Generator</p>
                <p className="text-xs text-muted-foreground">GPT-4o &middot; Lead Generation Team</p>
              </div>
              <span className="ml-auto inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Top Performer
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Leads generated", value: "340" },
                { label: "Total cost", value: "$127" },
                { label: "Cost per lead", value: "$0.37" },
                { label: "ROI", value: "13,286%" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Revenue value</span>
                <span className="font-semibold text-emerald-400">$17,000</span>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// --- Pricing Section ---

function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Get started with your first agents",
      features: [
        "Up to 3 agents",
        "1 team",
        "1,000 proxy requests/month",
        "Basic analytics",
        "Community support",
      ],
      cta: "Start Free",
      href: "/signup",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$49",
      period: "/month",
      description: "For teams scaling their AI operations",
      features: [
        "Up to 20 agents",
        "Unlimited teams",
        "50,000 proxy requests/month",
        "Advanced analytics & ROI",
        "Email support",
        "Budget allocation",
        "Spike detection",
      ],
      cta: "Start Free Trial",
      href: "/signup",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "/month",
      description: "Full control for large AI deployments",
      features: [
        "Unlimited agents",
        "Unlimited requests",
        "SSO / SAML",
        "Custom integrations",
        "Dedicated support & SLA",
        "Audit log & compliance",
        "White-label option",
      ],
      cta: "Contact Sales",
      href: "/signup",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
            Start free. Scale as your AI workforce grows.
          </p>
        </FadeIn>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 100}>
              <div
                className={`rounded-xl border p-6 h-full flex flex-col ${
                  plan.highlighted
                    ? "border-primary bg-card ring-1 ring-primary/20"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <span className="inline-flex self-start items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary mb-4">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.description}
                </p>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <svg
                        className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  render={<Link href={plan.href} />}
                >
                  {plan.cta}
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- CTA Section ---

function CTASection() {
  return (
    <section className="py-20 md:py-28 bg-muted/20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Start managing your AI workforce today
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free for up to 3 agents. Set up in under 2 minutes.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              className="px-10 h-11 text-base"
              render={<Link href="/signup" />}
            >
              Get Started
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// --- Footer ---

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
              AI
            </div>
            <span className="text-sm font-medium text-foreground">
              OpenManage AI
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Log in
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} OpenManage AI. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// --- Landing Page ---

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <ProblemSection />
      <AnalogySection />
      <FeaturesSection />
      <SocialProofSection />
      <ROIExample />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
