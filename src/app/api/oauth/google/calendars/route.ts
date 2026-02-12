import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { getValidToken } from "@/lib/oauth/token-manager";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  try {
    const accessToken = await getValidToken(clientId, "google");

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth });

    const res = await calendar.calendarList.list({ minAccessRole: "writer" });

    const calendars = (res.data.items || []).map((cal) => ({
      id: cal.id,
      name: cal.summary,
      primary: cal.primary || false,
    }));

    return NextResponse.json({ calendars });
  } catch (err) {
    console.error("Failed to list calendars:", err);
    return NextResponse.json(
      { error: "Failed to list calendars" },
      { status: 500 }
    );
  }
}
