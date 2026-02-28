import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { to_number, appointment_details } = body;

  if (!to_number || !appointment_details) {
    return NextResponse.json(
      { error: "client_id, to_number, and appointment_details are required" },
      { status: 400 }
    );
  }

  try {
    const { date, time, location } = appointment_details;
    const parts = [
      "Your appointment has been confirmed:",
      date && `Date: ${date}`,
      time && `Time: ${time}`,
      location && `Location: ${location}`,
      "Reply CANCEL to cancel.",
    ].filter(Boolean);

    const messageBody = parts.join("\n");

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const message = await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: to_number,
    });

    return NextResponse.json({
      success: true,
      message_sid: message.sid,
    });
  } catch (err) {
    console.error("Confirmation send error:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation" },
      { status: 500 }
    );
  }
}
