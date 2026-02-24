import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

/**
 * Extract the reply body from an email, stripping quoted text and signatures.
 */
function extractReplyBody(text: string): string {
  const lines = text.split("\n");
  const replyLines: string[] = [];

  for (const line of lines) {
    // Stop at common quoted-text markers
    if (/^>/.test(line)) break;
    if (/^On .+ wrote:/.test(line)) break;
    if (/^---/.test(line)) break;
    if (/^From:/.test(line)) break;
    if (/^Sent from my/.test(line)) break;
    if (/^_{3,}/.test(line)) break;
    replyLines.push(line);
  }

  return replyLines.join("\n").trim();
}

/**
 * Parse callback UUID from the "to" address.
 * Expected format: callback-{uuid}@reply.invarialabs.com
 */
function parseCallbackId(toAddress: string): string | null {
  const match = toAddress.match(/callback-([0-9a-f-]{36})@/i);
  return match ? match[1] : null;
}

/**
 * Calculate next_attempt_at based on caller's timezone.
 * If before 8 PM local time → now (immediate).
 * If after 8 PM → 9 AM next day local time.
 */
function calculateNextAttempt(timezone: string): string {
  const now = new Date();

  let callerHour: number;
  try {
    callerHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }).format(now)
    );
  } catch {
    callerHour = now.getUTCHours();
  }

  if (callerHour >= 8 && callerHour < 20) {
    // Between 8 AM and 8 PM — call back immediately
    return now.toISOString();
  }

  // Outside 8 AM–8 PM window — schedule for 9 AM next day in caller's timezone
  // Calculate the offset to get to 9 AM local time tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get the hour in the caller's timezone for tomorrow at the current UTC time
  let tomorrowHour: number;
  try {
    tomorrowHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }).format(tomorrow)
    );
  } catch {
    tomorrowHour = tomorrow.getUTCHours();
  }

  // Adjust to reach 9 AM local time
  const hoursToAdd = (9 - tomorrowHour + 24) % 24;
  tomorrow.setHours(tomorrow.getHours() + hoursToAdd);
  tomorrow.setMinutes(0, 0, 0);

  return tomorrow.toISOString();
}

export async function POST(request: NextRequest) {
  // Verify inbound webhook secret (passed as query param in the Resend webhook URL config)
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!secret || secret !== process.env.RESEND_INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Resend inbound webhook payload has: from, to, subject, text, html
    const toAddresses: string[] = Array.isArray(body.to)
      ? body.to
      : typeof body.to === "string"
        ? [body.to]
        : [];

    // Find the callback ID from the to addresses
    let callbackId: string | null = null;
    for (const addr of toAddresses) {
      callbackId = parseCallbackId(addr);
      if (callbackId) break;
    }

    if (!callbackId) {
      logger.warn("Resend inbound: no callback ID found in to addresses", {
        to: toAddresses,
      });
      return NextResponse.json({ received: true });
    }

    // Extract the reply text
    const rawText = body.text || body.html?.replace(/<[^>]+>/g, " ") || "";
    const answer = extractReplyBody(rawText);

    if (!answer) {
      logger.warn("Resend inbound: empty reply body", { callbackId });
      // Notify the business owner that we couldn't parse their reply
      const senderEmail = body.from;
      if (senderEmail) {
        await sendEmail({
          to: senderEmail,
          subject: "Re: Callback Request — We couldn't read your reply",
          html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <p>We received your reply but couldn't extract the answer text (it may have been empty or only contained your email signature).</p>
              <p><strong>Please reply again with just the answer in the body of your email.</strong></p>
            </div>
          `,
        });
      }
      return NextResponse.json({ received: true });
    }

    const supabase = await createServiceClient();

    // Fetch the pending callback
    const { data: callback, error: fetchError } = await supabase
      .from("pending_callbacks")
      .select("id, status, timezone")
      .eq("id", callbackId)
      .single();

    if (fetchError || !callback) {
      logger.warn("Resend inbound: callback not found", { callbackId });
      return NextResponse.json({ received: true });
    }

    if (callback.status !== "pending") {
      logger.warn("Resend inbound: callback not in pending status", {
        callbackId,
        status: callback.status,
      });
      return NextResponse.json({ received: true });
    }

    // Calculate when to make the callback
    const nextAttemptAt = calculateNextAttempt(callback.timezone);

    // Update the callback with the answer
    const { error: updateError } = await supabase
      .from("pending_callbacks")
      .update({
        status: "answered",
        business_owner_answer: answer,
        answered_at: new Date().toISOString(),
        next_attempt_at: nextAttemptAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callbackId);

    if (updateError) {
      logger.error("Resend inbound: failed to update callback", {
        callbackId,
        error: String(updateError),
      });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    logger.info("Resend inbound: callback answered", {
      callbackId,
      nextAttemptAt,
    });

    return NextResponse.json({ received: true, callbackId });
  } catch (err) {
    logger.error("Resend inbound webhook error", { error: String(err) });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
