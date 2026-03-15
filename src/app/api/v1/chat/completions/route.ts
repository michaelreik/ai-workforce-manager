import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/service";
import { calculateCost, getProvider, MODEL_PRICING } from "@/lib/pricing";
import { createAlert } from "@/lib/alerts";
import { getPlanLimits, type PlanId } from "@/lib/stripe";
import crypto from "crypto";
import type { Agent, BudgetEntry, Guardrails } from "@/types/database";

// --- Auth: resolve API key ---

async function authenticateRequest(
  authHeader: string | null,
  supabase: ReturnType<typeof createClient>
) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.slice(7);
  const keyHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKey) {
    return { error: "Invalid API key", status: 401 };
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { error: "API key has expired", status: 401 };
  }

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id);

  return { apiKey };
}

// --- Budget checks ---

async function checkBudget(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  agentId: string,
  guardrails: Guardrails
) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  // Check monthly budget
  if (guardrails.max_budget_monthly != null) {
    const { data: monthlyEntries } = await supabase
      .from("budget_entries")
      .select("spent")
      .eq("org_id", orgId)
      .eq("agent_id", agentId)
      .eq("period_type", "monthly")
      .gte("period_start", monthStart);

    const monthlySpent = (monthlyEntries || []).reduce(
      (sum, e) => sum + Number(e.spent),
      0
    );

    if (monthlySpent >= guardrails.max_budget_monthly) {
      return {
        exceeded: true,
        message: `Monthly budget exceeded ($${monthlySpent.toFixed(2)} / $${guardrails.max_budget_monthly.toFixed(2)})`,
      };
    }
  }

  // Check daily budget
  if (guardrails.max_budget_daily != null) {
    const { data: dailyEntries } = await supabase
      .from("budget_entries")
      .select("spent")
      .eq("org_id", orgId)
      .eq("agent_id", agentId)
      .eq("period_type", "daily")
      .eq("period_start", today);

    const dailySpent = (dailyEntries || []).reduce(
      (sum, e) => sum + Number(e.spent),
      0
    );

    if (dailySpent >= guardrails.max_budget_daily) {
      return {
        exceeded: true,
        message: `Daily budget exceeded ($${dailySpent.toFixed(2)} / $${guardrails.max_budget_daily.toFixed(2)})`,
      };
    }
  }

  return { exceeded: false };
}

// --- Forward to provider ---

async function forwardToOpenAI(
  model: string,
  body: Record<string, unknown>,
  apiKey: string,
  stream: boolean
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, model }),
  });
  return res;
}

async function forwardToAnthropic(
  model: string,
  body: Record<string, unknown>,
  apiKey: string,
  stream: boolean
) {
  // Map model names to Anthropic format
  const modelMap: Record<string, string> = {
    "claude-opus": "claude-opus-4-20250514",
    "claude-sonnet": "claude-sonnet-4-20250514",
    "claude-haiku": "claude-haiku-4-5-20251001",
  };

  const anthropicModel = modelMap[model] || model;

  // Convert OpenAI format messages to Anthropic format
  const messages = (body.messages as Array<{ role: string; content: string }>) || [];
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const anthropicBody: Record<string, unknown> = {
    model: anthropicModel,
    messages: nonSystemMessages,
    max_tokens: (body.max_tokens as number) || 4096,
    stream,
  };

  if (systemMessages.length > 0) {
    anthropicBody.system = systemMessages.map((m) => m.content).join("\n");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(anthropicBody),
  });
  return res;
}

// --- Convert Anthropic response to OpenAI format ---

function anthropicToOpenAI(
  anthropicRes: Record<string, unknown>,
  model: string
): Record<string, unknown> {
  const content = (
    anthropicRes.content as Array<{ type: string; text?: string }>
  )
    ?.filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("") || "";

  const usage = anthropicRes.usage as {
    input_tokens: number;
    output_tokens: number;
  } | undefined;

  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: anthropicRes.stop_reason === "end_turn" ? "stop" : "stop",
      },
    ],
    usage: {
      prompt_tokens: usage?.input_tokens || 0,
      completion_tokens: usage?.output_tokens || 0,
      total_tokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
    },
  };
}

// --- Record task and update budget ---

async function recordUsage(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  agentId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
  status: "completed" | "failed",
  errorMessage?: string
) {
  const cost = calculateCost(model, inputTokens, outputTokens);
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  // Insert task
  await supabase.from("tasks").insert({
    org_id: orgId,
    agent_id: agentId,
    status,
    model_used: model,
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    cost,
    duration_ms: durationMs,
    task_type: "proxy",
    error_message: errorMessage || null,
    started_at: now.toISOString(),
    finished_at: now.toISOString(),
  });

  // Upsert daily budget entry
  await supabase.rpc("increment_budget_spent", {
    p_org_id: orgId,
    p_agent_id: agentId,
    p_period_type: "daily",
    p_period_start: today,
    p_amount: cost,
  }).then(async (res) => {
    // Fallback if RPC doesn't exist: upsert manually
    if (res.error) {
      const { data: existing } = await supabase
        .from("budget_entries")
        .select("id, spent")
        .eq("org_id", orgId)
        .eq("agent_id", agentId)
        .eq("period_type", "daily")
        .eq("period_start", today)
        .single();

      if (existing) {
        await supabase
          .from("budget_entries")
          .update({ spent: Number(existing.spent) + cost })
          .eq("id", existing.id);
      } else {
        await supabase.from("budget_entries").insert({
          org_id: orgId,
          agent_id: agentId,
          period_type: "daily",
          period_start: today,
          allocated: 0,
          spent: cost,
        });
      }
    }
  });

  // Upsert monthly budget entry
  await supabase.rpc("increment_budget_spent", {
    p_org_id: orgId,
    p_agent_id: agentId,
    p_period_type: "monthly",
    p_period_start: monthStart,
    p_amount: cost,
  }).then(async (res) => {
    if (res.error) {
      const { data: existing } = await supabase
        .from("budget_entries")
        .select("id, spent")
        .eq("org_id", orgId)
        .eq("agent_id", agentId)
        .eq("period_type", "monthly")
        .eq("period_start", monthStart)
        .single();

      if (existing) {
        await supabase
          .from("budget_entries")
          .update({ spent: Number(existing.spent) + cost })
          .eq("id", existing.id);
      } else {
        await supabase.from("budget_entries").insert({
          org_id: orgId,
          agent_id: agentId,
          period_type: "monthly",
          period_start: monthStart,
          allocated: 0,
          spent: cost,
        });
      }
    }
  });

  // Check budget thresholds and create alerts
  const agent = await supabase
    .from("agents")
    .select("guardrails, name")
    .eq("id", agentId)
    .single();

  if (agent.data) {
    const guardrails = agent.data.guardrails as Guardrails;

    if (guardrails.max_budget_monthly != null) {
      const { data: monthlyEntries } = await supabase
        .from("budget_entries")
        .select("spent")
        .eq("org_id", orgId)
        .eq("agent_id", agentId)
        .eq("period_type", "monthly")
        .gte("period_start", monthStart);

      const totalSpent = (monthlyEntries || []).reduce(
        (sum, e) => sum + Number(e.spent),
        0
      );
      const pct = (totalSpent / guardrails.max_budget_monthly) * 100;

      if (pct >= 100) {
        await createAlert({
          supabase: supabase as never,
          org_id: orgId,
          agent_id: agentId,
          type: "budget_exceeded",
          severity: "critical",
          message: `${agent.data.name} has exceeded its monthly budget ($${totalSpent.toFixed(2)} / $${guardrails.max_budget_monthly.toFixed(2)})`,
        });

        // Auto-pause if enabled
        if (guardrails.auto_pause_on_budget) {
          await supabase
            .from("agents")
            .update({ status: "paused" })
            .eq("id", agentId);
        }
      } else if (pct >= 80) {
        // Check if we already have a recent budget_warning
        const { data: recentAlerts } = await supabase
          .from("alerts")
          .select("id")
          .eq("org_id", orgId)
          .eq("agent_id", agentId)
          .eq("type", "budget_warning")
          .eq("resolved", false)
          .limit(1);

        if (!recentAlerts || recentAlerts.length === 0) {
          await createAlert({
            supabase: supabase as never,
            org_id: orgId,
            agent_id: agentId,
            type: "budget_warning",
            severity: "warning",
            message: `${agent.data.name} has used ${pct.toFixed(0)}% of its monthly budget`,
          });
        }
      }
    }
  }

  return cost;
}

// --- Spike detection ---

async function checkSpikeDetection(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  agentId: string,
  agentName: string,
  currentCost: number,
  guardrails: Guardrails
) {
  if (!guardrails.spike_detection || currentCost === 0) return;

  // Get the last 20 completed tasks for this agent to compute rolling average
  const { data: recentTasks } = await supabase
    .from("tasks")
    .select("cost")
    .eq("org_id", orgId)
    .eq("agent_id", agentId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(21); // 21 because the current task is already inserted

  if (!recentTasks || recentTasks.length < 6) return; // Need enough history

  // Exclude the current task (most recent) from the average calculation
  const historicalTasks = recentTasks.slice(1);
  const avgCost =
    historicalTasks.reduce((sum, t) => sum + Number(t.cost), 0) /
    historicalTasks.length;

  if (avgCost <= 0) return;

  if (currentCost > avgCost * 3) {
    // Create spike alert
    await createAlert({
      supabase: supabase as never,
      org_id: orgId,
      agent_id: agentId,
      type: "kill_switch",
      severity: "critical",
      message: `Spike detected for ${agentName}: task cost $${currentCost.toFixed(4)} is ${(currentCost / avgCost).toFixed(1)}x the rolling average ($${avgCost.toFixed(4)})`,
    });

    // Auto-pause the agent
    await supabase
      .from("agents")
      .update({ status: "paused" })
      .eq("id", agentId);

    // Create audit log entry
    await supabase.from("audit_log").insert({
      org_id: orgId,
      action: "agent_paused",
      target_type: "agent",
      target_id: agentId,
      details: {
        reason: "spike_detection",
        current_cost: currentCost,
        rolling_average: avgCost,
        multiplier: currentCost / avgCost,
      },
    });
  }
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const supabase = createClient();

  // 1. Authenticate
  const authResult = await authenticateRequest(
    request.headers.get("authorization"),
    supabase
  );
  if ("error" in authResult) {
    return NextResponse.json(
      { error: { message: authResult.error, type: "auth_error" } },
      { status: authResult.status }
    );
  }
  const { apiKey } = authResult;

  // 2. Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body", type: "invalid_request" } },
      { status: 400 }
    );
  }

  const requestedModel = body.model as string;
  if (!requestedModel) {
    return NextResponse.json(
      { error: { message: "model is required", type: "invalid_request" } },
      { status: 400 }
    );
  }

  // 3. Resolve agent
  let agent: Agent | null = null;
  if (apiKey.agent_id) {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("id", apiKey.agent_id)
      .single();
    agent = data as Agent | null;
  } else {
    // Find agent by model match in this org, or use first active agent
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("org_id", apiKey.org_id)
      .eq("status", "active")
      .limit(1)
      .single();
    agent = data as Agent | null;
  }

  if (!agent) {
    return NextResponse.json(
      { error: { message: "No active agent found for this API key", type: "agent_error" } },
      { status: 404 }
    );
  }

  // 4. Check agent status
  if (agent.status !== "active") {
    return NextResponse.json(
      {
        error: {
          message: `Agent "${agent.name}" is ${agent.status}. Cannot process requests.`,
          type: "agent_error",
        },
      },
      { status: 429 }
    );
  }

  // 5. Check plan request limits
  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", agent.org_id)
    .single();

  if (org) {
    const limits = getPlanLimits((org.plan || "free") as PlanId);
    if (limits.maxRequests !== Infinity) {
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).toISOString();
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("org_id", agent.org_id)
        .gte("started_at", monthStart);

      if (count && count >= limits.maxRequests) {
        return NextResponse.json(
          {
            error: {
              message: `Plan limit reached: ${limits.maxRequests} requests/month on ${limits.name} plan. Upgrade for more.`,
              type: "plan_limit",
            },
          },
          { status: 429 }
        );
      }
    }
  }

  // 6. Check guardrails
  const guardrails = agent.guardrails;

  // Token limit check
  if (
    guardrails.max_tokens_per_request != null &&
    body.max_tokens &&
    (body.max_tokens as number) > guardrails.max_tokens_per_request
  ) {
    return NextResponse.json(
      {
        error: {
          message: `max_tokens (${body.max_tokens}) exceeds agent guardrail limit (${guardrails.max_tokens_per_request})`,
          type: "guardrail_error",
        },
      },
      { status: 429 }
    );
  }

  // Budget check
  const budgetCheck = await checkBudget(
    supabase,
    agent.org_id,
    agent.id,
    guardrails
  );
  if (budgetCheck.exceeded) {
    await createAlert({
      supabase: supabase as never,
      org_id: agent.org_id,
      agent_id: agent.id,
      type: "budget_exceeded",
      severity: "critical",
      message: budgetCheck.message || "Budget exceeded",
    });

    if (guardrails.auto_pause_on_budget) {
      await supabase
        .from("agents")
        .update({ status: "paused" })
        .eq("id", agent.id);
    }

    return NextResponse.json(
      { error: { message: budgetCheck.message, type: "budget_error" } },
      { status: 429 }
    );
  }

  // 6. Determine model to use and provider
  const modelToUse = requestedModel in MODEL_PRICING ? requestedModel : agent.model;
  const provider = getProvider(modelToUse);
  const isStream = body.stream === true;

  if (!provider) {
    return NextResponse.json(
      {
        error: {
          message: `Unsupported model: ${modelToUse}`,
          type: "invalid_request",
        },
      },
      { status: 400 }
    );
  }

  // 7. Get provider API key — try DB first, then env vars
  let providerKey: string | undefined;

  // Check for org-configured provider in DB
  const { data: dbProvider } = await supabase
    .from("providers")
    .select("api_key_encrypted, base_url")
    .eq("org_id", agent.org_id)
    .eq("provider_type", provider)
    .eq("health_status", "healthy")
    .order("is_default", { ascending: false })
    .limit(1)
    .single();

  if (dbProvider) {
    providerKey = dbProvider.api_key_encrypted;
  }

  // Fall back to env vars
  if (!providerKey) {
    const envKeys: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_API_KEY,
    };
    providerKey = envKeys[provider];
  }

  if (!providerKey) {
    return NextResponse.json(
      {
        error: {
          message: `No API key configured for provider: ${provider}. Add one in Settings → Providers.`,
          type: "config_error",
        },
      },
      { status: 500 }
    );
  }

  // 8. Forward request
  let providerResponse: Response;
  let usedModel = modelToUse;

  try {
    if (provider === "openai") {
      providerResponse = await forwardToOpenAI(modelToUse, body, providerKey, isStream);
    } else if (provider === "anthropic") {
      providerResponse = await forwardToAnthropic(modelToUse, body, providerKey, isStream);
    } else {
      return NextResponse.json(
        { error: { message: `Provider ${provider} not yet supported`, type: "config_error" } },
        { status: 501 }
      );
    }

    // If primary model fails and fallback is available, retry
    if (!providerResponse.ok && agent.fallback_model) {
      const fallbackProvider = getProvider(agent.fallback_model);
      // Try DB provider for fallback, then env var
      let fallbackKey: string | null = null;
      if (fallbackProvider) {
        const { data: fbProvider } = await supabase
          .from("providers")
          .select("api_key_encrypted")
          .eq("org_id", agent.org_id)
          .eq("provider_type", fallbackProvider)
          .order("is_default", { ascending: false })
          .limit(1)
          .single();
        fallbackKey = fbProvider?.api_key_encrypted || null;
        if (!fallbackKey) {
          const envKeys: Record<string, string | undefined> = {
            openai: process.env.OPENAI_API_KEY,
            anthropic: process.env.ANTHROPIC_API_KEY,
            google: process.env.GOOGLE_API_KEY,
          };
          fallbackKey = envKeys[fallbackProvider] || null;
        }
      }

      if (fallbackProvider && fallbackKey) {
        usedModel = agent.fallback_model;

        if (fallbackProvider === "openai") {
          providerResponse = await forwardToOpenAI(agent.fallback_model, body, fallbackKey, isStream);
        } else if (fallbackProvider === "anthropic") {
          providerResponse = await forwardToAnthropic(agent.fallback_model, body, fallbackKey, isStream);
        }

        // Create failover alert
        await createAlert({
          supabase: supabase as never,
          org_id: agent.org_id,
          agent_id: agent.id,
          type: "rate_limit",
          severity: "warning",
          message: `Model failover: ${modelToUse} → ${agent.fallback_model}`,
        });
      }
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await recordUsage(
      supabase,
      agent.org_id,
      agent.id,
      usedModel,
      0,
      0,
      durationMs,
      "failed",
      err instanceof Error ? err.message : "Provider request failed"
    );

    return NextResponse.json(
      {
        error: {
          message: "Failed to reach LLM provider",
          type: "provider_error",
        },
      },
      { status: 502 }
    );
  }

  // 9. Handle streaming response
  if (isStream && providerResponse.body) {
    // For streaming, pass through the response and record usage after
    // We can't easily extract token counts from streaming, so we estimate
    const responseStream = providerResponse.body;

    // Record a placeholder task (tokens will be approximate)
    const durationMs = Date.now() - startTime;
    recordUsage(
      supabase,
      agent.org_id,
      agent.id,
      usedModel,
      0, // Can't know until stream completes
      0,
      durationMs,
      "completed"
    );

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // 10. Handle non-streaming response
  const durationMs = Date.now() - startTime;

  if (!providerResponse.ok) {
    const errorBody = await providerResponse.text();
    await recordUsage(
      supabase,
      agent.org_id,
      agent.id,
      usedModel,
      0,
      0,
      durationMs,
      "failed",
      `Provider error (${providerResponse.status}): ${errorBody.slice(0, 500)}`
    );

    return NextResponse.json(
      {
        error: {
          message: "LLM provider returned an error",
          type: "provider_error",
          details: errorBody.slice(0, 500),
        },
      },
      { status: providerResponse.status }
    );
  }

  let responseBody: Record<string, unknown>;
  const rawBody = await providerResponse.json();

  // Convert Anthropic response to OpenAI format for transparent proxy
  if (provider === "anthropic" || getProvider(usedModel) === "anthropic") {
    responseBody = anthropicToOpenAI(rawBody, usedModel);
  } else {
    responseBody = rawBody;
  }

  // Extract token usage
  const usage = responseBody.usage as {
    prompt_tokens: number;
    completion_tokens: number;
  } | undefined;

  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;

  // Record usage
  const taskCost = await recordUsage(
    supabase,
    agent.org_id,
    agent.id,
    usedModel,
    inputTokens,
    outputTokens,
    durationMs,
    "completed"
  );

  // Spike detection (runs after recording so the task is in the DB)
  await checkSpikeDetection(
    supabase,
    agent.org_id,
    agent.id,
    agent.name,
    taskCost,
    guardrails
  );

  return NextResponse.json(responseBody);
}
