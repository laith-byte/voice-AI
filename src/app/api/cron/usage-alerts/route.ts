import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { FALLBACK_COST_PER_MINUTE } from "@/lib/retell-costs";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Fetch all enabled alert settings with client info
  const { data: alerts } = await supabase
    .from("usage_alert_settings")
    .select("*, clients(name, organization_id, plan_id)")
    .eq("is_enabled", true);

  if (!alerts?.length) {
    return NextResponse.json({ message: "No active alerts", checked: 0, triggered: 0 });
  }

  // Group alerts by client_id
  const alertsByClient: Record<string, typeof alerts> = {};
  for (const alert of alerts) {
    const cid = alert.client_id;
    if (!alertsByClient[cid]) alertsByClient[cid] = [];
    alertsByClient[cid].push(alert);
  }

  let checkedCount = 0;
  let triggeredCount = 0;

  for (const [clientId, clientAlerts] of Object.entries(alertsByClient)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientInfo = (clientAlerts[0] as any).clients;
      const clientName = clientInfo?.name || "Your Business";
      const planId = clientInfo?.plan_id;

      // Get plan limits
      let planMinutes = 0;
      if (planId) {
        const { data: plan } = await supabase
          .from("client_plans")
          .select("call_minutes_included")
          .eq("id", planId)
          .single();
        planMinutes = plan?.call_minutes_included ?? 0;
      }

      // Get current month's call data
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: callLogs } = await supabase
        .from("call_logs")
        .select("duration_seconds")
        .eq("client_id", clientId)
        .gte("created_at", firstOfMonth);

      const totalCalls = callLogs?.length ?? 0;
      const totalSeconds = (callLogs ?? []).reduce(
        (sum, log) => sum + (log.duration_seconds ?? 0),
        0
      );
      const totalMinutes = totalSeconds / 60;
      const totalCost = totalMinutes * FALLBACK_COST_PER_MINUTE;

      // Get email recipients: client admin users
      const { data: clientUsers } = await supabase
        .from("users")
        .select("email")
        .eq("client_id", clientId)
        .eq("role", "client_admin");

      const recipients = (clientUsers ?? []).map((u) => u.email).filter(Boolean);
      if (recipients.length === 0) continue;

      for (const alert of clientAlerts) {
        checkedCount++;

        // Check 24h cooldown
        if (alert.last_triggered_at) {
          const lastTriggered = new Date(alert.last_triggered_at);
          const hoursSince = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) continue;
        }

        let shouldTrigger = false;
        let alertMessage = "";
        let currentValue = 0;
        let limitValue = 0;

        switch (alert.alert_type) {
          case "minutes_threshold": {
            if (alert.threshold_percent && planMinutes > 0) {
              const pct = (totalMinutes / planMinutes) * 100;
              if (pct >= alert.threshold_percent) {
                shouldTrigger = true;
                alertMessage = `You have used ${Math.round(totalMinutes).toLocaleString()} of ${planMinutes.toLocaleString()} included minutes (${Math.round(pct)}%).`;
                currentValue = totalMinutes;
                limitValue = planMinutes;
              }
            } else if (totalMinutes >= alert.threshold_value) {
              shouldTrigger = true;
              alertMessage = `You have used ${Math.round(totalMinutes).toLocaleString()} minutes this month, exceeding your alert threshold of ${alert.threshold_value} minutes.`;
              currentValue = totalMinutes;
              limitValue = alert.threshold_value;
            }
            break;
          }
          case "cost_threshold": {
            if (totalCost >= alert.threshold_value) {
              shouldTrigger = true;
              alertMessage = `Your estimated cost this month is $${totalCost.toFixed(2)}, exceeding your alert threshold of $${Number(alert.threshold_value).toFixed(2)}.`;
              currentValue = totalCost;
              limitValue = alert.threshold_value;
            }
            break;
          }
          case "calls_threshold": {
            if (totalCalls >= alert.threshold_value) {
              shouldTrigger = true;
              alertMessage = `You have made ${totalCalls.toLocaleString()} calls this month, exceeding your alert threshold of ${Number(alert.threshold_value).toLocaleString()} calls.`;
              currentValue = totalCalls;
              limitValue = alert.threshold_value;
            }
            break;
          }
        }

        if (shouldTrigger) {
          triggeredCount++;

          const html = buildAlertEmail(clientName, alert.alert_type, alertMessage, currentValue, limitValue);
          const subject = `Usage Alert: ${getAlertTypeLabel(alert.alert_type)} - ${clientName}`;

          for (const email of recipients) {
            try {
              await sendEmail({
                to: email,
                subject,
                html,
                from: `${clientName.replace(/[<>"'\r\n]/g, "")} <notifications@invarialabs.com>`,
              });
            } catch (err) {
              console.error(`Failed to send usage alert to ${email}:`, err);
            }
          }

          // Update last_triggered_at
          await supabase
            .from("usage_alert_settings")
            .update({ last_triggered_at: now.toISOString() })
            .eq("id", alert.id);
        }
      }
    } catch (err) {
      console.error(`Usage alert check failed for client ${clientId}:`, err);
    }
  }

  return NextResponse.json({ message: "Usage alerts checked", checked: checkedCount, triggered: triggeredCount });
}

function getAlertTypeLabel(alertType: string): string {
  switch (alertType) {
    case "minutes_threshold": return "Minutes Usage";
    case "cost_threshold": return "Cost Threshold";
    case "calls_threshold": return "Call Count";
    default: return "Usage";
  }
}

function buildAlertEmail(
  clientName: string,
  alertType: string,
  message: string,
  currentValue: number,
  limitValue: number
): string {
  const pct = limitValue > 0 ? Math.min(100, Math.round((currentValue / limitValue) * 100)) : 0;
  const barColor = pct >= 100 ? "#dc2626" : pct >= 90 ? "#f59e0b" : "#2563eb";

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Usage Alert - ${escapeHtml(clientName)}</h2>
      <p style="color: #666; font-size: 14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>

      <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <strong style="color: #92400e;">${getAlertTypeLabel(alertType)} Alert</strong>
        <p style="color: #78350f; margin: 8px 0 0 0; font-size: 14px;">${escapeHtml(message)}</p>
      </div>

      ${limitValue > 0 ? `
      <div style="margin: 16px 0;">
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background: ${barColor}; height: 100%; width: ${Math.min(100, pct)}%; border-radius: 4px;"></div>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">${pct}% of limit used</p>
      </div>
      ` : ""}

      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
        You can manage your alert preferences in your billing dashboard.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(clientName)} via Invaria Labs</p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
