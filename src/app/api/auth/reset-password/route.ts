import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const origin = request.nextUrl.origin;

  // Generate a recovery link without sending Supabase's default email
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${origin}/reset-password`,
    },
  });

  if (error) {
    // Don't reveal whether the email exists — always return success
    console.error("generateLink error:", error.message);
    return NextResponse.json({ success: true });
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    console.error("No action_link returned for recovery");
    return NextResponse.json({ success: true });
  }

  // Send custom branded email via Resend
  try {
    await sendEmail({
      to: email,
      subject: "Reset Your Password — Invaria Labs",
      from: "Invaria Labs <noreply@invarialabs.com>",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Invaria Labs</span>
        </td></tr>
        <!-- Card -->
        <tr><td style="background-color:#1e293b;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:48px 40px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;">
            Reset Your Password
          </h1>
          <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.7);text-align:center;line-height:1.6;">
            We received a request to reset your password. Click the button below to choose a new one.
          </p>
          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${actionLink}" style="display:inline-block;padding:14px 40px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">
              Reset Password
            </a>
          </div>
          <!-- Divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 24px;"></div>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.5;">
            This link expires in 24 hours. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
            Invaria Labs &mdash; AI-Powered Phone Agents
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  } catch (err) {
    console.error("Failed to send reset email:", err);
  }

  // Always return success to avoid email enumeration
  return NextResponse.json({ success: true });
}
