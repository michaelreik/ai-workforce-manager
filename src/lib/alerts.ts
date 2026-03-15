import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertType, AlertSeverity } from "@/types/database";

type CreateAlertParams = {
  supabase: SupabaseClient;
  org_id: string;
  agent_id?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
};

/**
 * Creates an alert and triggers email notification for critical alerts.
 * Email is sent asynchronously (fire-and-forget) to avoid blocking the proxy.
 */
export async function createAlert(params: CreateAlertParams) {
  const { supabase, org_id, agent_id, type, severity, message } = params;

  const { data: alert, error } = await supabase.from("alerts").insert({
    org_id,
    agent_id: agent_id || null,
    type,
    severity,
    message,
  }).select().single();

  if (error || !alert) {
    console.error("Failed to create alert:", error);
    return;
  }

  // Fire email notification for critical alerts (non-blocking)
  if (severity === "critical" && process.env.INTERNAL_API_SECRET) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/alerts/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ org_id, alert_id: alert.id }),
    }).catch((err) => {
      console.error("Failed to trigger alert email:", err);
    });
  }
}
