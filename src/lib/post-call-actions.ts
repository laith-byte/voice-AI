import { createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CallLog {
  id: string;
  retell_call_id: string;
  client_id: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  summary: string | null;
  transcript: unknown;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  post_call_analysis: unknown;
  metadata: Record<string, unknown> | null;
}

interface PostCallAction {
  id: string;
  client_id: string;
  action_type: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main executor — called from the Retell webhook handler
// ---------------------------------------------------------------------------

export async function executePostCallActions(
  callLog: CallLog,
  clientId: string
) {
  const supabase = await createServiceClient();

  // 1. Fetch all enabled actions for this client
  const { data: actions } = await supabase
    .from("post_call_actions")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_enabled", true);

  if (!actions?.length) return;

  // 2. Fetch business settings for template variables (business name, etc.)
  const { data: settings } = await supabase
    .from("business_settings")
    .select("business_name, contact_email")
    .eq("client_id", clientId)
    .single();

  const businessName = settings?.business_name || "Your Business";

  // 3. Execute each action
  for (const action of actions as PostCallAction[]) {
    const config = action.config;

    // Check trigger filter
    const callStatus = callLog.status; // 'completed', 'in_progress', etc.
    const trigger = (config.trigger as string) || "all";
    if (trigger !== "all" && trigger !== callStatus) continue;

    try {
      switch (action.action_type) {
        case "email_summary":
          await sendEmailSummary(callLog, config, businessName);
          break;
        case "sms_notification":
          await sendSmsNotification(callLog, config, businessName);
          break;
        case "caller_followup_email":
          await sendCallerFollowup(callLog, config, businessName);
          break;
        case "webhook":
          await sendWebhook(callLog, config);
          break;
        // daily_digest is handled by a cron job, not per-call
      }
    } catch (err) {
      console.error(
        `Post-call action ${action.action_type} failed for client ${clientId}:`,
        err
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Email Summary
// ---------------------------------------------------------------------------

async function sendEmailSummary(
  callLog: CallLog,
  config: Record<string, unknown>,
  businessName: string
) {
  const recipients = (config.recipients as string[]) || [];
  if (recipients.length === 0) return;

  const includeSummary = config.include_summary !== false;
  const includeTranscript = config.include_transcript === true;
  const includeCallerInfo = config.include_caller_info !== false;
  const includeRecording = config.include_recording === true;

  const callDate = callLog.started_at
    ? new Date(callLog.started_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown time";

  const subject = `Call Summary — ${businessName} — ${callDate}`;

  let html = `<div style="font-family: sans-serif; max-width: 600px;">`;
  html += `<h2 style="color: #1a1a2e; margin-bottom: 16px;">Call Summary</h2>`;

  if (includeCallerInfo) {
    html += `<div style="background: #f8f9fa; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">`;
    html += `<p style="margin: 4px 0;"><strong>Caller:</strong> ${callLog.from_number || "Unknown"}</p>`;
    html += `<p style="margin: 4px 0;"><strong>Duration:</strong> ${formatDuration(callLog.duration_seconds)}</p>`;
    html += `<p style="margin: 4px 0;"><strong>Status:</strong> ${callLog.status}</p>`;
    html += `<p style="margin: 4px 0;"><strong>Time:</strong> ${callDate}</p>`;
    html += `</div>`;
  }

  if (includeSummary && callLog.summary) {
    html += `<h3 style="color: #333; margin-top: 16px;">Summary</h3>`;
    html += `<p style="color: #555; line-height: 1.6;">${escapeHtml(callLog.summary)}</p>`;
  }

  if (includeTranscript && callLog.transcript) {
    html += `<h3 style="color: #333; margin-top: 16px;">Transcript</h3>`;
    html += `<div style="background: #f8f9fa; padding: 12px 16px; border-radius: 8px; font-size: 13px; line-height: 1.6;">`;
    html += formatTranscriptHtml(callLog.transcript);
    html += `</div>`;
  }

  if (includeRecording && callLog.recording_url) {
    html += `<p style="margin-top: 16px;"><a href="${escapeHtml(callLog.recording_url)}" style="color: #6366f1;">Listen to recording</a></p>`;
  }

  html += `<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />`;
  html += `<p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(businessName)} via Invaria Labs</p>`;
  html += `</div>`;

  // Use the existing resend helper
  const { sendEmail } = await import("@/lib/resend");

  for (const recipient of recipients) {
    await sendEmail({
      to: recipient.trim(),
      subject,
      html,
      from: `${businessName} <notifications@invarialabs.com>`,
    });
  }
}

// ---------------------------------------------------------------------------
// SMS Notification
// ---------------------------------------------------------------------------

async function sendSmsNotification(
  callLog: CallLog,
  config: Record<string, unknown>,
  businessName: string
) {
  const phoneNumber = config.phone_number as string;
  if (!phoneNumber) return;

  const durationStr = formatDuration(callLog.duration_seconds);
  const summarySnippet = callLog.summary
    ? callLog.summary.slice(0, 140)
    : "No summary available";

  const message = `${businessName} — New call from ${callLog.from_number || "Unknown"} (${durationStr}). ${summarySnippet}`;

  await sendSms(phoneNumber, message);
}

// ---------------------------------------------------------------------------
// Caller Follow-up Email
// ---------------------------------------------------------------------------

async function sendCallerFollowup(
  callLog: CallLog,
  config: Record<string, unknown>,
  businessName: string
) {
  // We need the caller's email from the post_call_analysis or metadata
  const analysis = callLog.post_call_analysis as Record<string, unknown> | null;
  const callerEmail =
    (analysis?.caller_email as string) ||
    (callLog.metadata?.caller_email as string);

  if (!callerEmail) return; // Can't send without email

  const callerName =
    (analysis?.caller_name as string) ||
    (callLog.metadata?.caller_name as string) ||
    "there";

  const subjectTemplate = (config.subject as string) || `Thanks for calling ${businessName}!`;
  const bodyTemplate =
    (config.body as string) ||
    `Hi ${callerName},\n\nThank you for calling ${businessName} today. If you have any further questions, please don't hesitate to reach out.\n\nBest regards,\n${businessName}`;

  // Simple template variable replacement
  const subject = subjectTemplate
    .replace(/\{\{business_name\}\}/g, businessName)
    .replace(/\{\{caller_name\}\}/g, callerName);

  const body = bodyTemplate
    .replace(/\{\{business_name\}\}/g, businessName)
    .replace(/\{\{caller_name\}\}/g, callerName);

  const delayMinutes = (config.delay_minutes as number) || 0;

  const sendFn = async () => {
    const { sendEmail } = await import("@/lib/resend");
    await sendEmail({
      to: callerEmail,
      subject,
      html: `<div style="font-family: sans-serif; max-width: 600px; line-height: 1.6;">${body.replace(/\n/g, "<br/>")}</div>`,
      from: `${businessName} <noreply@invarialabs.com>`,
    });
  };

  // Note: delay_minutes is ignored on serverless — setTimeout callbacks are lost
  // when the function terminates. Send immediately.
  await sendFn();
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

async function sendWebhook(
  callLog: CallLog,
  config: Record<string, unknown>
) {
  const url = config.url as string;
  if (!url) return;

  const events = (config.events as string[]) || ["completed", "missed"];
  const callEvent =
    callLog.status === "missed" ? "missed" : "completed";

  if (!events.includes(callEvent) && !events.includes("all")) return;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: `call.${callEvent}`,
      call_id: callLog.retell_call_id,
      from: callLog.from_number,
      to: callLog.to_number,
      direction: callLog.direction,
      duration_seconds: callLog.duration_seconds,
      status: callLog.status,
      summary: callLog.summary,
      transcript: callLog.transcript,
      recording_url: callLog.recording_url,
      started_at: callLog.started_at,
      ended_at: callLog.ended_at,
      post_call_analysis: callLog.post_call_analysis,
      metadata: callLog.metadata,
      timestamp: new Date().toISOString(),
    }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatTranscriptHtml(transcript: unknown): string {
  if (!transcript) return "<p>No transcript available.</p>";

  // Retell sends transcript_object as an array of { role, content }
  if (Array.isArray(transcript)) {
    return transcript
      .map((entry: { role?: string; content?: string; words?: string }) => {
        const role = entry.role === "agent" ? "Agent" : "Caller";
        const content = entry.content || entry.words || "";
        return `<p><strong>${role}:</strong> ${escapeHtml(content)}</p>`;
      })
      .join("");
  }

  if (typeof transcript === "string") {
    return `<p>${escapeHtml(transcript)}</p>`;
  }

  return "<p>Transcript format not recognized.</p>";
}
