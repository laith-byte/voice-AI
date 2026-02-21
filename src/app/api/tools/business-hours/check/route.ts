import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;

  if (!client_id) {
    return NextResponse.json(
      { error: "client_id is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Get client timezone
    const { data: settings } = await supabase
      .from("business_settings")
      .select("timezone")
      .eq("client_id", client_id)
      .single();

    const timezone = settings?.timezone || "America/Los_Angeles";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const currentDay = parts.find((p) => p.type === "weekday")?.value;
    const currentHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const currentMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    const todayIndex = dayMap[currentDay || "Monday"];

    // Get all hours for this client
    const { data: hours } = await supabase
      .from("business_hours")
      .select("*")
      .eq("client_id", client_id)
      .order("day_of_week");

    const todayHours = hours?.find((h) => h.day_of_week === todayIndex);

    let is_open = false;
    let current_hours = "Closed today";

    if (todayHours?.is_open && todayHours.open_time && todayHours.close_time) {
      const [openH, openM] = todayHours.open_time.split(":").map(Number);
      const [closeH, closeM] = todayHours.close_time.split(":").map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      is_open = currentTimeMinutes >= openMinutes && currentTimeMinutes < closeMinutes;
      current_hours = `${todayHours.open_time} - ${todayHours.close_time}`;
    }

    // Find next open day/time
    let next_open: string | null = null;
    if (!is_open && hours?.length) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      for (let offset = 1; offset <= 7; offset++) {
        const checkDay = (todayIndex + offset) % 7;
        const dayHours = hours.find((h) => h.day_of_week === checkDay);
        if (dayHours?.is_open && dayHours.open_time) {
          next_open = `${dayNames[checkDay]} at ${dayHours.open_time}`;
          break;
        }
      }
    }

    return NextResponse.json({ is_open, current_hours, next_open });
  } catch (err) {
    console.error("Business hours check error:", err);
    return NextResponse.json(
      { error: "Failed to check business hours" },
      { status: 500 }
    );
  }
}
