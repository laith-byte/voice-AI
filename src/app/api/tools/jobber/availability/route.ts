import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { jobberGraphQL } from "@/lib/oauth/executors/jobber";
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
    const accessToken = await getValidToken(client_id, "jobber");

    // Query calendar entries for the date
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;

    const result = await jobberGraphQL(
      accessToken,
      `query($startAt: DateTime!, $endAt: DateTime!) { calendarEvents(filter: { startAt: { gte: $startAt }, endAt: { lte: $endAt } }) { nodes { startAt endAt title } } }`,
      { startAt: startOfDay, endAt: endOfDay }
    );

    const events = (result.data?.calendarEvents as { nodes: { startAt: string; endAt: string; title: string }[] })?.nodes || [];

    // Generate available slots in business hours (8 AM - 6 PM) in 1-hour increments
    const slots: string[] = [];
    const targetDate = new Date(date);

    for (let hour = 8; hour < 18; hour++) {
      const slotStart = new Date(targetDate);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(targetDate);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      const isBusy = events.some((event) => {
        const eventStart = new Date(event.startAt).getTime();
        const eventEnd = new Date(event.endAt).getTime();
        return slotStart.getTime() < eventEnd && slotEnd.getTime() > eventStart;
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
    console.error("Jobber availability error:", err);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
