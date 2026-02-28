import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { date } = body;

  if (!date) {
    return NextResponse.json(
      { error: "client_id and date are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "calendly");

    // Get current user URI
    const userRes = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: "Failed to fetch Calendly user" }, { status: 500 });
    }

    const userData = await userRes.json();
    const userUri = userData.resource.uri;

    // Get event types for this user
    const eventTypesRes = await fetch(
      `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&active=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!eventTypesRes.ok) {
      return NextResponse.json({ error: "Failed to fetch event types" }, { status: 500 });
    }

    const eventTypes = await eventTypesRes.json();

    // Get availability for the requested date
    const targetDate = new Date(date);
    const startTime = new Date(targetDate);
    startTime.setHours(0, 0, 0, 0);
    const endTime = new Date(targetDate);
    endTime.setHours(23, 59, 59, 999);

    const availabilityRes = await fetch(
      `https://api.calendly.com/user_availability_schedules?user=${encodeURIComponent(userUri)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const slots: string[] = [];

    if (availabilityRes.ok) {
      const availability = await availabilityRes.json();
      const dayOfWeek = targetDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

      for (const schedule of availability.collection || []) {
        for (const rule of schedule.rules || []) {
          if (rule.type === "wday" && rule.wday === dayOfWeek) {
            for (const interval of rule.intervals || []) {
              slots.push(`${interval.from} - ${interval.to}`);
            }
          }
        }
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
      event_types: (eventTypes.collection || []).map(
        (et: Record<string, unknown>) => ({
          name: et.name,
          duration: et.duration,
          slug: et.slug,
          scheduling_url: et.scheduling_url,
        })
      ),
    });
  } catch (err) {
    console.error("Calendly availability error:", err);
    return NextResponse.json(
      { error: "Failed to check Calendly availability" },
      { status: 500 }
    );
  }
}
