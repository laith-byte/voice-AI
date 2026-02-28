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
    const accessToken = await getValidToken(client_id, "housecallpro");

    // Get all employees/technicians
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

    // W12: Check schedule for ALL employees, not just the first one
    const allBusySlots: { start: string; end: string }[] = [];

    await Promise.all(
      employees.map(async (employee: { id: string }) => {
        try {
          const scheduleRes = await fetch(
            `https://api.housecallpro.com/pro/v1/schedule?employee_id=${employee.id}&date=${date}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!scheduleRes.ok) return;

          const scheduleData = await scheduleRes.json();
          const events = scheduleData.events || scheduleData.jobs || [];
          for (const event of events) {
            allBusySlots.push({
              start: event.start_time || event.scheduled_start,
              end: event.end_time || event.scheduled_end,
            });
          }
        } catch {
          // Skip this employee on error — partial availability is better than none
        }
      })
    );

    // Generate available slots based on schedule gaps
    // A slot is available if ANY employee is free during that window
    const workStart = 8; // 8 AM
    const workEnd = 17; // 5 PM
    const slotDuration = 2; // 2-hour slots for field service
    const employeeCount = employees.length;

    const availableSlots: string[] = [];
    for (let hour = workStart; hour < workEnd; hour += slotDuration) {
      const slotStart = `${date}T${String(hour).padStart(2, "0")}:00:00`;
      const slotEnd = `${date}T${String(hour + slotDuration).padStart(2, "0")}:00:00`;

      // Count how many employees are busy in this slot
      const busyCount = allBusySlots.filter(
        (busy) => busy.start < slotEnd && busy.end > slotStart
      ).length;

      // Available if at least one employee is free
      if (busyCount < employeeCount) {
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
