import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import type { Provider, HealthStatus } from "@/types/database";

/**
 * POST /api/providers/health
 * Tests connection to a provider by making a minimal API call.
 * Body: { provider_id: string } or { provider_type: string, api_key: string, base_url?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  let providerType: string;
  let apiKey: string;
  let baseUrl: string | null = null;

  if (body.provider_id) {
    // Test existing provider
    const { data: provider } = await supabase
      .from("providers")
      .select("*")
      .eq("id", body.provider_id)
      .single();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    providerType = provider.provider_type;
    apiKey = decrypt(provider.api_key_encrypted);
    baseUrl = provider.base_url;
  } else {
    // Test new provider (before saving)
    providerType = body.provider_type;
    apiKey = body.api_key;
    baseUrl = body.base_url || null;
  }

  const result = await testProviderConnection(providerType, apiKey, baseUrl);

  // Update health status if testing existing provider
  if (body.provider_id) {
    const { createClient: createServiceClient } = await import(
      "@/lib/supabase/service"
    );
    const serviceClient = createServiceClient();
    await serviceClient
      .from("providers")
      .update({
        health_status: result.status,
        last_health_check: new Date().toISOString(),
      })
      .eq("id", body.provider_id);
  }

  return NextResponse.json(result);
}

async function testProviderConnection(
  providerType: string,
  apiKey: string,
  baseUrl: string | null
): Promise<{ status: HealthStatus; message: string; latencyMs?: number }> {
  const start = Date.now();

  try {
    switch (providerType) {
      case "openai": {
        const url = baseUrl || "https://api.openai.com";
        const res = await fetch(`${url}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        const latencyMs = Date.now() - start;
        if (res.ok) {
          return { status: "healthy", message: "Connected to OpenAI", latencyMs };
        }
        if (res.status === 401) {
          return { status: "down", message: "Invalid API key" };
        }
        return { status: "degraded", message: `HTTP ${res.status}`, latencyMs };
      }

      case "anthropic": {
        const url = baseUrl || "https://api.anthropic.com";
        // Anthropic doesn't have a /models endpoint, use a minimal messages call
        const res = await fetch(`${url}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        const latencyMs = Date.now() - start;
        if (res.ok || res.status === 200) {
          return { status: "healthy", message: "Connected to Anthropic", latencyMs };
        }
        if (res.status === 401) {
          return { status: "down", message: "Invalid API key" };
        }
        // 429 means rate limited but key is valid
        if (res.status === 429) {
          return { status: "healthy", message: "Connected (rate limited)", latencyMs };
        }
        return { status: "degraded", message: `HTTP ${res.status}`, latencyMs };
      }

      case "google": {
        const url = baseUrl || "https://generativelanguage.googleapis.com";
        const res = await fetch(
          `${url}/v1beta/models?key=${apiKey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const latencyMs = Date.now() - start;
        if (res.ok) {
          return { status: "healthy", message: "Connected to Google AI", latencyMs };
        }
        if (res.status === 401 || res.status === 403) {
          return { status: "down", message: "Invalid API key" };
        }
        return { status: "degraded", message: `HTTP ${res.status}`, latencyMs };
      }

      case "azure": {
        if (!baseUrl) {
          return { status: "down", message: "Base URL required for Azure" };
        }
        const res = await fetch(`${baseUrl}/openai/models?api-version=2024-02-01`, {
          headers: { "api-key": apiKey },
          signal: AbortSignal.timeout(10000),
        });
        const latencyMs = Date.now() - start;
        if (res.ok) {
          return { status: "healthy", message: "Connected to Azure OpenAI", latencyMs };
        }
        if (res.status === 401) {
          return { status: "down", message: "Invalid API key" };
        }
        return { status: "degraded", message: `HTTP ${res.status}`, latencyMs };
      }

      default:
        return { status: "unknown", message: "Unknown provider type" };
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection failed";
    if (message.includes("timeout") || message.includes("abort")) {
      return { status: "degraded", message: "Connection timed out" };
    }
    return { status: "down", message };
  }
}
