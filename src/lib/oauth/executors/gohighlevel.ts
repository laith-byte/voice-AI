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
}

interface GHLContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
}

interface GHLSearchResponse {
  contacts: GHLContact[];
  total: number;
}

const GHL_API_BASE = "https://services.leadconnectorhq.com";

async function ghlRequest(
  accessToken: string,
  path: string,
  locationId: string,
  options?: RequestInit
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };

  const res = await fetch(`${GHL_API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });
  return res;
}

export async function executeGoHighLevel(
  callLog: CallLog,
  clientId: string,
  _config: Record<string, unknown>
): Promise<void> {
  if (!callLog.from_number) return;

  const accessToken = await getValidToken(clientId, "gohighlevel");

  // Get location ID from stored connection metadata
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();
  const { data: connection } = await supabase
    .from("oauth_connections")
    .select("provider_metadata")
    .eq("client_id", clientId)
    .eq("provider", "gohighlevel")
    .single();

  const locationId = (connection?.provider_metadata as Record<string, string>)?.location_id;
  if (!locationId) throw new Error("GoHighLevel location_id not found in connection metadata");

  // Search for existing contact by phone
  const phone = callLog.from_number;
  const searchRes = await ghlRequest(
    accessToken,
    `/contacts/?locationId=${locationId}&query=${encodeURIComponent(phone)}`,
    locationId
  );

  if (!searchRes.ok) {
    throw new Error(`GoHighLevel contact search failed: ${searchRes.status}`);
  }

  const searchData: GHLSearchResponse = await searchRes.json();

  let contactId: string;

  if (searchData.contacts.length > 0) {
    // Update existing contact
    contactId = searchData.contacts[0].id;
    const putRes = await ghlRequest(
      accessToken,
      `/contacts/${contactId}`,
      locationId,
      {
        method: "PUT",
        body: JSON.stringify({
          customFields: [
            {
              key: "last_ai_call",
              value: new Date().toISOString(),
            },
          ],
        }),
      }
    );
    if (!putRes.ok) {
      console.error(`GoHighLevel contact update failed: ${putRes.status}`);
    }
  } else {
    // Create new contact
    const createRes = await ghlRequest(
      accessToken,
      "/contacts/",
      locationId,
      {
        method: "POST",
        body: JSON.stringify({
          phone,
          locationId,
          source: "AI Phone Call",
          tags: ["ai-call"],
        }),
      }
    );

    if (!createRes.ok) {
      throw new Error(`GoHighLevel contact creation failed: ${createRes.status}`);
    }

    const createData = await createRes.json();
    contactId = createData.contact.id;
  }

  // Log the call as a note on the contact
  const noteBody = [
    `AI Phone Call - ${callLog.status}`,
    `Duration: ${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`,
    callLog.summary && `Summary: ${callLog.summary}`,
    `Call ID: ${callLog.retell_call_id}`,
    `Direction: ${callLog.direction}`,
  ]
    .filter(Boolean)
    .join("\n");

  const noteRes = await ghlRequest(
    accessToken,
    `/contacts/${contactId}/notes`,
    locationId,
    {
      method: "POST",
      body: JSON.stringify({
        body: noteBody,
      }),
    }
  );
  if (!noteRes.ok) {
    console.error(`GoHighLevel note creation failed: ${noteRes.status}`);
  }
}
