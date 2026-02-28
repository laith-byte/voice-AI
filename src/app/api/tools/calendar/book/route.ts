import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getValidToken } from "@/lib/oauth/token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const {
    start_time,
    end_time,
    summary = "Appointment",
    attendee_email,
    attendee_name,
    attendee_phone,
  } = body;

  if (!start_time || !end_time) {
    return NextResponse.json(
      { error: "client_id, start_time, and end_time are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "google");

    // Get client's selected calendar
    const supabase = await createServiceClient();
    const { data: automation } = await supabase
      .from("client_automations")
      .select("config, automation_recipes!inner(provider)")
      .eq("client_id", client_id)
      .eq("automation_recipes.provider", "google-calendar")
      .eq("is_enabled", true)
      .single();

    const calendarId =
      (automation?.config as Record<string, string>)?.calendar_id || "primary";

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth });

    const eventDescription = [
      attendee_name && `Name: ${attendee_name}`,
      attendee_phone && `Phone: ${attendee_phone}`,
      "Booked by AI phone agent",
    ]
      .filter(Boolean)
      .join("\n");

    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description: eventDescription,
        start: { dateTime: start_time },
        end: { dateTime: end_time },
        attendees: attendee_email ? [{ email: attendee_email }] : undefined,
      },
    });

    const eventStart = new Date(start_time);
    const eventTime = eventStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }) +
      " at " +
      eventStart.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    return NextResponse.json({
      success: true,
      event_id: event.data.id,
      event_time: eventTime,
    });
  } catch (err) {
    console.error("Calendar booking error:", err);
    return NextResponse.json(
      { error: "Failed to book appointment" },
      { status: 500 }
    );
  }
}
