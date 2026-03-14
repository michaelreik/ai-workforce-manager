import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "OpenManage AI <alerts@openmanage.ai>";

type AlertEmailParams = {
  to: string[];
  orgName: string;
  agentName: string | null;
  alertType: string;
  severity: string;
  message: string;
  dashboardUrl: string;
};

export async function sendAlertEmail(params: AlertEmailParams) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set, skipping email notification");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const severityLabel = params.severity.toUpperCase();
  const severityEmoji =
    params.severity === "critical"
      ? "🔴"
      : params.severity === "warning"
        ? "🟡"
        : "🔵";

  const subject = `${severityEmoji} [${severityLabel}] ${params.alertType.replace(/_/g, " ")} — ${params.agentName || params.orgName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 2px solid ${params.severity === "critical" ? "#ef4444" : params.severity === "warning" ? "#f59e0b" : "#3b82f6"}; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 18px; color: #111;">
          ${severityEmoji} ${severityLabel} Alert
        </h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #666;">
          ${params.orgName}${params.agentName ? ` — ${params.agentName}` : ""}
        </p>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">
          ${params.message}
        </p>
      </div>

      <table style="width: 100%; font-size: 13px; color: #666; margin-bottom: 24px;">
        <tr>
          <td style="padding: 4px 0;"><strong>Type:</strong></td>
          <td style="padding: 4px 0;">${params.alertType.replace(/_/g, " ")}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Severity:</strong></td>
          <td style="padding: 4px 0;">${severityLabel}</td>
        </tr>
        ${params.agentName ? `<tr><td style="padding: 4px 0;"><strong>Agent:</strong></td><td style="padding: 4px 0;">${params.agentName}</td></tr>` : ""}
        <tr>
          <td style="padding: 4px 0;"><strong>Time:</strong></td>
          <td style="padding: 4px 0;">${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
        </tr>
      </table>

      <a href="${params.dashboardUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View in Dashboard →
      </a>

      <p style="margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px;">
        You're receiving this because you're an admin of ${params.orgName} on OpenManage AI.
        <br />Manage notification preferences in <a href="${params.dashboardUrl}/settings" style="color: #999;">Settings</a>.
      </p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send alert email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Resend error:", err);
    return { success: false, error: String(err) };
  }
}

type DigestEmailParams = {
  to: string[];
  orgName: string;
  dashboardUrl: string;
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    totalSpent: number;
    budgetAllocated: number;
    activeAgents: number;
    totalAgents: number;
    topSpendingAgent: string | null;
    topSpendingAmount: number;
  };
  recentAlerts: {
    severity: string;
    message: string;
    agentName: string | null;
    createdAt: string;
  }[];
};

export async function sendDailyDigest(params: DigestEmailParams) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set, skipping digest email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const { summary, recentAlerts } = params;
  const budgetPct =
    summary.budgetAllocated > 0
      ? Math.round((summary.totalSpent / summary.budgetAllocated) * 100)
      : 0;

  const alertRows = recentAlerts
    .slice(0, 10)
    .map((a) => {
      const emoji =
        a.severity === "critical"
          ? "🔴"
          : a.severity === "warning"
            ? "🟡"
            : "🔵";
      return `<tr>
        <td style="padding: 6px 8px; font-size: 13px;">${emoji}</td>
        <td style="padding: 6px 8px; font-size: 13px;">${a.message}</td>
        <td style="padding: 6px 8px; font-size: 13px; color: #666;">${a.agentName || "—"}</td>
      </tr>`;
    })
    .join("");

  const subject = `📊 Daily Digest — ${params.orgName} (${summary.criticalAlerts > 0 ? `${summary.criticalAlerts} critical` : `${summary.totalAlerts} alerts`})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 4px; font-size: 18px;">📊 Daily Digest</h2>
      <p style="margin: 0 0 24px; font-size: 13px; color: #666;">${params.orgName} — ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</p>

      <!-- KPIs -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 8px; text-align: center; width: 25%;">
            <div style="font-size: 20px; font-weight: 700;">${summary.activeAgents}</div>
            <div style="font-size: 11px; color: #666;">Active Agents</div>
          </td>
          <td style="padding: 12px; background: #f9fafb; text-align: center; width: 25%;">
            <div style="font-size: 20px; font-weight: 700;">$${summary.totalSpent.toFixed(2)}</div>
            <div style="font-size: 11px; color: #666;">Spent Yesterday</div>
          </td>
          <td style="padding: 12px; background: #f9fafb; text-align: center; width: 25%;">
            <div style="font-size: 20px; font-weight: 700; color: ${budgetPct > 90 ? "#ef4444" : budgetPct > 70 ? "#f59e0b" : "#22c55e"};">${budgetPct}%</div>
            <div style="font-size: 11px; color: #666;">Budget Used</div>
          </td>
          <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 8px 0; text-align: center; width: 25%;">
            <div style="font-size: 20px; font-weight: 700; color: ${summary.criticalAlerts > 0 ? "#ef4444" : "#333"};">${summary.totalAlerts}</div>
            <div style="font-size: 11px; color: #666;">Alerts</div>
          </td>
        </tr>
      </table>

      ${summary.topSpendingAgent ? `
      <p style="font-size: 13px; color: #666; margin-bottom: 24px;">
        💰 Top spender: <strong>${summary.topSpendingAgent}</strong> ($${summary.topSpendingAmount.toFixed(2)})
      </p>` : ""}

      ${recentAlerts.length > 0 ? `
      <h3 style="font-size: 14px; margin: 0 0 8px;">Yesterday's Alerts</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        ${alertRows}
      </table>` : `<p style="font-size: 13px; color: #22c55e; margin-bottom: 24px;">✅ No alerts yesterday — all clear!</p>`}

      <a href="${params.dashboardUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
        Open Dashboard →
      </a>

      <p style="margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px;">
        Daily digest for ${params.orgName} on OpenManage AI.
        <br />Manage in <a href="${params.dashboardUrl}/settings" style="color: #999;">Settings</a>.
      </p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send digest email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Resend error:", err);
    return { success: false, error: String(err) };
  }
}
