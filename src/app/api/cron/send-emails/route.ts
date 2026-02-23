import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Fetch scheduled emails that are due (send_at <= now) and not yet sent
    const { data: emails, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString())
      .order("send_at")
      .limit(50);

    if (error) {
      logger.error("Failed to fetch scheduled emails", { error: error.message });
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    if (!emails?.length) {
      return NextResponse.json({ message: "No emails due", sent: 0 });
    }

    let sent = 0;

    for (const email of emails) {
      try {
        await sendEmail({
          to: email.to,
          subject: email.subject,
          html: email.html,
          from: email.from_address,
        });

        await supabase
          .from("scheduled_emails")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);

        sent++;
      } catch (err) {
        logger.error("Failed to send scheduled email", {
          emailId: email.id,
          error: String(err),
        });

        await supabase
          .from("scheduled_emails")
          .update({ status: "failed", error: String(err) })
          .eq("id", email.id);
      }
    }

    return NextResponse.json({ message: "Scheduled emails processed", sent });
  } catch (err) {
    logger.error("Send-emails cron failed", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
