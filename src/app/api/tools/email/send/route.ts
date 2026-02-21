import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { to_email, subject, body: email_body } = body;

  if (!client_id || !to_email || !subject || !email_body) {
    return NextResponse.json(
      { error: "client_id, to_email, subject, and body are required" },
      { status: 400 }
    );
  }

  try {
    const result = await sendEmail({
      to: to_email,
      subject,
      html: email_body,
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
