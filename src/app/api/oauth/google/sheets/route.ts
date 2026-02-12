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
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
    });

    const sheets = (res.data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      lastModified: f.modifiedTime,
    }));

    return NextResponse.json({ sheets });
  } catch (err) {
    console.error("Failed to list sheets:", err);
    return NextResponse.json(
      { error: "Failed to list spreadsheets" },
      { status: 500 }
    );
  }
}
