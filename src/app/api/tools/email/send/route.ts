import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { to_email, subject, body: email_body } = body;

  if (!to_email || !subject || !email_body) {
    return NextResponse.json(
      { error: "to_email, subject, and body are required" },
      { status: 400 }
    );
  }

  try {
    // HIGH-06: Sanitize HTML — strip dangerous tags/attributes to prevent phishing
    const sanitizedHtml = (email_body as string)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[\s\S]*?>/gi, "")
      .replace(/<form[\s\S]*?<\/form>/gi, "")
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\bon\w+\s*=\s*\S+/gi, "")
      .replace(/javascript\s*:/gi, "blocked:");

    const result = await sendEmail({
      to: to_email,
      subject,
      html: sanitizedHtml,
    });

    return NextResponse.json({
      success: true,
      email_id: result.data?.id,
    });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
