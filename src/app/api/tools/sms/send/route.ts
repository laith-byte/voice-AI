import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { to_number, message_body } = body;

  if (!to_number || !message_body) {
    return NextResponse.json(
      { error: "to_number and message_body are required" },
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
