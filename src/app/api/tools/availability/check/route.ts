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
  const { resource_type, date } = body;

  if (!client_id || !date) {
    return NextResponse.json(
      { error: "client_id and date are required" },
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

    // Parse the requested date and get the day of week
    const targetDate = new Date(date);
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    });
    const dayName = dayFormatter.format(targetDate);

    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    const dayIndex = dayMap[dayName];

    // Get business hours for that day
    const { data: hours } = await supabase
      .from("business_hours")
      .select("is_open, open_time, close_time")
      .eq("client_id", client_id)
      .eq("day_of_week", dayIndex)
      .single();

    if (!hours?.is_open || !hours.open_time || !hours.close_time) {
      return NextResponse.json({
        available: false,
        message: `Closed on ${dayName}`,
        slots: [],
      });
    }

    // Generate 30-minute slots during business hours
    const [openH, openM] = hours.open_time.split(":").map(Number);
    const [closeH, closeM] = hours.close_time.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const slots: string[] = [];
    for (let m = openMinutes; m + 30 <= closeMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      slots.push(`${displayH}:${min.toString().padStart(2, "0")} ${period}`);
    }

    return NextResponse.json({
      available: true,
      date: dayName,
      resource_type: resource_type || "general",
      hours: `${hours.open_time} - ${hours.close_time}`,
      slots,
    });
  } catch (err) {
    console.error("Availability check error:", err);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
