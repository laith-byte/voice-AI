import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { to_number, message_body } = body;

  if (!client_id || !to_number || !message_body) {
    return NextResponse.json(
      { error: "client_id, to_number, and message_body are required" },
      { status: 400 }
    );
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const message = await client.messages.create({
      body: message_body,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: to_number,
    });

    return NextResponse.json({
      success: true,
      message_sid: message.sid,
    });
  } catch (err) {
    console.error("SMS send error:", err);
    return NextResponse.json(
      { error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}
