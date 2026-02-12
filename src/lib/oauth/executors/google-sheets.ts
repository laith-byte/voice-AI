import { google } from "googleapis";
import { getValidToken } from "@/lib/oauth/token-manager";

interface CallLog {
  id: string;
  retell_call_id: string;
  from_number: string | null;
  to_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  post_call_analysis: unknown;
  tags?: string[] | null;
}

export async function executeGoogleSheets(
  callLog: CallLog,
  clientId: string,
  config: Record<string, unknown>
): Promise<void> {
  const spreadsheetId = config.spreadsheet_id as string;
  if (!spreadsheetId) {
    throw new Error("No spreadsheet_id configured");
  }

  const accessToken = await getValidToken(clientId, "google");

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: "v4", auth });

  const startedAt = callLog.started_at
    ? new Date(callLog.started_at).toLocaleString("en-US")
    : "";

  const row = [
    startedAt,
    callLog.from_number || "",
    callLog.to_number || "",
    callLog.direction,
    callLog.status,
    callLog.duration_seconds,
    callLog.summary || "",
    callLog.retell_call_id,
    callLog.tags?.join(", ") || "",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A:I",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}
