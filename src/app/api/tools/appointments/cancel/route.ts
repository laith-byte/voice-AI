import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getValidToken } from "@/lib/oauth/token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { event_id, reason } = body;

  if (!event_id) {
    return NextResponse.json(
      { error: "client_id and event_id are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "google");
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

    // Update the event description with cancellation reason before deleting
    if (reason) {
      await calendar.events.patch({
        calendarId,
        eventId: event_id,
        requestBody: {
          description: `CANCELLED: ${reason}`,
          status: "cancelled",
        },
      });
    } else {
      await calendar.events.delete({
        calendarId,
        eventId: event_id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Appointment has been cancelled",
    });
  } catch (err) {
    console.error("Appointment cancel error:", err);
    return NextResponse.json(
      { error: "Failed to cancel appointment" },
      { status: 500 }
    );
  }
}
