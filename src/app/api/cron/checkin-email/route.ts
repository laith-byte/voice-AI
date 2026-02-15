import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

// Runs hourly. Sends a 24-hour check-in email to clients who went live
// approximately 24 hours ago and haven't received a check-in yet.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Find clients who went live 23-25 hours ago (1-hour window) without a check-in email
  const now = new Date();
  const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

  const { data: candidates } = await supabase
    .from("client_onboarding")
    .select("client_id, business_name, contact_email, go_live_at, total_calls_since_live")
    .not("go_live_at", "is", null)
    .is("checkin_email_sent_at", null)
    .gte("go_live_at", twentyFiveHoursAgo.toISOString())
    .lte("go_live_at", twentyThreeHoursAgo.toISOString());

  if (!candidates?.length) {
    return NextResponse.json({ message: "No check-in emails to send", sent: 0 });
  }

  let sentCount = 0;

  for (const client of candidates) {
    if (!client.contact_email) continue;

    const bizName = client.business_name || "Your Business";
    const totalCalls = client.total_calls_since_live ?? 0;

    try {
      const html = `<div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a2e;">24-Hour Check-In: ${escapeHtml(bizName)}</h2>
        <p>It has been 24 hours since your AI agent went live. Here is a quick summary:</p>

        <div style="background: #f0f4ff; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center;">
          <strong style="font-size: 32px; color: #4f46e5;">${totalCalls}</strong>
          <br/>
          <span style="color: #666; font-size: 14px;">calls handled since go-live</span>
        </div>

        ${totalCalls > 0
          ? `<p>Your agent is actively handling calls. Visit your dashboard to review transcripts, summaries, and call recordings.</p>`
          : `<p>Your agent hasn't received any calls yet. Make sure your phone number is forwarding correctly, or try calling your agent number to test it out.</p>`
        }

        <p style="margin-top: 24px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://app.invarialabs.com"}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">View Dashboard</a>
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          Need help? Reply to this email or visit our support page.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(bizName)} via Invaria Labs</p>
      </div>`;

      await sendEmail({
        to: client.contact_email,
        subject: `24-Hour Check-In: ${bizName} - ${totalCalls} call${totalCalls === 1 ? "" : "s"} handled`,
        html,
        from: `${bizName.replace(/[<>"'\r\n]/g, "")} <notifications@invarialabs.com>`,
      });

      await supabase
        .from("client_onboarding")
        .update({ checkin_email_sent_at: new Date().toISOString() })
        .eq("client_id", client.client_id);

      sentCount++;
    } catch (err) {
      console.error(`Check-in email failed for client ${client.client_id}:`, err);
    }
  }

  return NextResponse.json({ message: "Check-in emails processed", sent: sentCount });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
