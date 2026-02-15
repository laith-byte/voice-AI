import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

// This route is designed to be called by a cron job (e.g. Vercel Cron).
// It runs hourly and checks which clients have a daily_digest action
// configured for the current hour, then sends their digest.

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Find all enabled daily_digest actions where send_at_hour matches current hour
  const { data: actions } = await supabase
    .from("post_call_actions")
    .select("*, clients(name, organization_id)")
    .eq("action_type", "daily_digest")
    .eq("is_enabled", true);

  if (!actions?.length) {
    return NextResponse.json({ message: "No digest actions found", sent: 0 });
  }

  let sentCount = 0;

  for (const action of actions) {
    const config = action.config as Record<string, unknown>;
    const sendAtHour = (config.send_at_hour as number) ?? 18;

    // Get client timezone from business_settings, default to UTC
    const { data: bizSettings } = await supabase
      .from("business_settings")
      .select("timezone")
      .eq("client_id", action.client_id)
      .single();

    const tz = bizSettings?.timezone || "UTC";
    let clientHour: number;
    try {
      clientHour = parseInt(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date())
      );
    } catch {
      clientHour = new Date().getUTCHours();
    }

    // Only send if the client's local hour matches the configured hour
    if (sendAtHour !== clientHour) continue;

    const recipients = (config.recipients as string[]) || [];
    if (recipients.length === 0) continue;

    const clientId = action.client_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientName = (action as any).clients?.name || "Your Business";

    try {
      // Fetch today's calls for this client (last 24 hours)
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const { data: calls } = await supabase
        .from("call_logs")
        .select("id, status, duration_seconds, summary, from_number, started_at")
        .eq("client_id", clientId)
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false });

      if (!calls?.length) continue; // No calls today, skip

      // Build digest
      const includeCount = config.include_count !== false;
      const includeAvgDuration = config.include_avg_duration !== false;
      const includeMissed = config.include_missed !== false;
      const includeTopics = config.include_topics !== false;
      const includeTranscripts = config.include_transcripts === true;

      const totalCalls = calls.length;
      const missedCalls = calls.filter((c) => c.status === "missed").length;
      const completedCalls = totalCalls - missedCalls;
      const totalDuration = calls.reduce(
        (acc, c) => acc + (c.duration_seconds || 0),
        0
      );
      const avgDuration =
        completedCalls > 0 ? Math.round(totalDuration / completedCalls) : 0;

      let html = `<div style="font-family: sans-serif; max-width: 600px;">`;
      html += `<h2 style="color: #1a1a2e;">Daily Call Digest — ${escapeHtml(clientName)}</h2>`;
      html += `<p style="color: #666; font-size: 14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>`;

      if (includeCount) {
        html += `<div style="background: #f0f4ff; padding: 16px; border-radius: 8px; margin: 16px 0;">`;
        html += `<div style="display: flex; gap: 24px;">`;
        html += `<div><strong style="font-size: 24px; color: #4f46e5;">${totalCalls}</strong><br/><span style="color: #666; font-size: 12px;">Total Calls</span></div>`;
        html += `<div><strong style="font-size: 24px; color: #059669;">${completedCalls}</strong><br/><span style="color: #666; font-size: 12px;">Completed</span></div>`;
        if (includeMissed) {
          html += `<div><strong style="font-size: 24px; color: #dc2626;">${missedCalls}</strong><br/><span style="color: #666; font-size: 12px;">Missed</span></div>`;
        }
        if (includeAvgDuration) {
          html += `<div><strong style="font-size: 24px; color: #7c3aed;">${formatDuration(avgDuration)}</strong><br/><span style="color: #666; font-size: 12px;">Avg Duration</span></div>`;
        }
        html += `</div></div>`;
      }

      if (includeTopics) {
        const summaries = calls
          .filter((c) => c.summary)
          .slice(0, 10);

        if (summaries.length > 0) {
          html += `<h3 style="color: #333; margin-top: 20px;">Call Summaries</h3>`;
          html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
          html += `<tr style="background: #f8f9fa; text-align: left;"><th style="padding: 8px;">Time</th><th style="padding: 8px;">Caller</th><th style="padding: 8px;">Summary</th></tr>`;

          for (const c of summaries) {
            const time = c.started_at
              ? new Date(c.started_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—";
            html += `<tr style="border-bottom: 1px solid #eee;">`;
            html += `<td style="padding: 8px; white-space: nowrap;">${time}</td>`;
            html += `<td style="padding: 8px;">${escapeHtml(c.from_number || "Unknown")}</td>`;
            html += `<td style="padding: 8px; color: #555;">${escapeHtml((c.summary || "").slice(0, 120))}${(c.summary || "").length > 120 ? "..." : ""}</td>`;
            html += `</tr>`;
          }
          html += `</table>`;
        }
      }

      if (includeTranscripts) {
        html += `<p style="color: #999; font-size: 12px; margin-top: 16px;">Full transcripts are available in your dashboard.</p>`;
      }

      html += `<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />`;
      html += `<p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(clientName)} via Invaria Labs</p>`;
      html += `</div>`;

      const subject = `Daily Call Digest — ${clientName} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      for (const recipient of recipients) {
        await sendEmail({
          to: recipient.trim(),
          subject,
          html,
          from: `${clientName.replace(/[<>"'\r\n]/g, "")} <notifications@invarialabs.com>`,
        });
      }

      sentCount++;
    } catch (err) {
      console.error(`Daily digest failed for client ${clientId}:`, err);
    }
  }

  return NextResponse.json({ message: "Digest processed", sent: sentCount });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
