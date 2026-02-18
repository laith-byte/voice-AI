import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";

export async function POST(request: NextRequest) {
  // Auth: Retell custom tool uses shared API key
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const {
    event_type_uri,
    start_time,
    invitee_name,
    invitee_email,
    invitee_phone,
  } = body;

  if (!client_id || !event_type_uri || !start_time) {
    return NextResponse.json(
      { error: "client_id, event_type_uri, and start_time are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "calendly");

    // Create a one-off scheduling link for this event type
    const schedulingRes = await fetch("https://api.calendly.com/scheduling_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_event_count: 1,
        owner: event_type_uri,
        owner_type: "EventType",
      }),
    });

    if (!schedulingRes.ok) {
      const err = await schedulingRes.text();
      console.error("Calendly scheduling link error:", err);
      return NextResponse.json({ error: "Failed to create scheduling link" }, { status: 500 });
    }

    const schedulingData = await schedulingRes.json();
    const bookingUrl = schedulingData.resource?.booking_url;

    const eventStart = new Date(start_time);
    const eventTime =
      eventStart.toLocaleDateString("en-US", {
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
      booking_url: bookingUrl,
      event_time: eventTime,
      invitee: {
        name: invitee_name || null,
        email: invitee_email || null,
        phone: invitee_phone || null,
      },
    });
  } catch (err) {
    console.error("Calendly booking error:", err);
    return NextResponse.json(
      { error: "Failed to book Calendly appointment" },
      { status: 500 }
    );
  }
}
