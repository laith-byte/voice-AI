import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getValidToken } from "@/lib/oauth/token-manager";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { date, duration_minutes = 60 } = body;

  if (!date) {
    return NextResponse.json(
      { error: "client_id and date are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "google");

    // Get the client's selected calendar from their automation config
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

    // Parse date and set business hours (8 AM - 6 PM)
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(18, 0, 0, 0);

    // Check FreeBusy
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busySlots =
      freeBusy.data.calendars?.[calendarId]?.busy || [];

    // Generate available slots in 30-min increments
    const slots: string[] = [];
    const durationMs = duration_minutes * 60 * 1000;
    const slotIncrement = 30 * 60 * 1000;

    for (
      let time = dayStart.getTime();
      time + durationMs <= dayEnd.getTime();
      time += slotIncrement
    ) {
      const slotStart = new Date(time);
      const slotEnd = new Date(time + durationMs);

      const isBusy = busySlots.some((busy) => {
        const busyStart = new Date(busy.start!).getTime();
        const busyEnd = new Date(busy.end!).getTime();
        return slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart;
      });

      if (!isBusy) {
        slots.push(
          slotStart.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        );
      }
    }

    return NextResponse.json({
      slots,
      earliest: slots[0] || null,
      date: targetDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    });
  } catch (err) {
    console.error("Calendar availability error:", err);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
