import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { date } = body;

  if (!client_id || !date) {
    return NextResponse.json(
      { error: "client_id and date are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "housecallpro");

    // Get employees/technicians
    const employeesRes = await fetch(
      "https://api.housecallpro.com/pro/v1/employees",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!employeesRes.ok) {
      throw new Error(`Housecall Pro employees fetch failed: ${employeesRes.status}`);
    }

    const employeesData = await employeesRes.json();
    const employees = employeesData.employees || [];

    if (employees.length === 0) {
      return NextResponse.json({
        slots: [],
        earliest: null,
        date,
      });
    }

    // Check schedule for the first employee
    const employeeId = employees[0].id;
    const scheduleRes = await fetch(
      `https://api.housecallpro.com/pro/v1/schedule?employee_id=${employeeId}&date=${date}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!scheduleRes.ok) {
      throw new Error(`Housecall Pro schedule fetch failed: ${scheduleRes.status}`);
    }

    const scheduleData = await scheduleRes.json();

    // Generate available slots based on schedule gaps
    const busySlots = scheduleData.events || scheduleData.jobs || [];
    const workStart = 8; // 8 AM
    const workEnd = 17; // 5 PM
    const slotDuration = 2; // 2-hour slots for field service

    const availableSlots: string[] = [];
    for (let hour = workStart; hour < workEnd; hour += slotDuration) {
      const slotStart = `${date}T${String(hour).padStart(2, "0")}:00:00`;
      const slotEnd = `${date}T${String(hour + slotDuration).padStart(2, "0")}:00:00`;

      const isConflict = busySlots.some((event: Record<string, string>) => {
        const eventStart = event.start_time || event.scheduled_start;
        const eventEnd = event.end_time || event.scheduled_end;
        return eventStart < slotEnd && eventEnd > slotStart;
      });

      if (!isConflict) {
        availableSlots.push(
          `${String(hour).padStart(2, "0")}:00 - ${String(hour + slotDuration).padStart(2, "0")}:00`
        );
      }
    }

    return NextResponse.json({
      slots: availableSlots,
      earliest: availableSlots[0] || null,
      date,
    });
  } catch (err) {
    console.error("Housecall Pro availability error:", err);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
