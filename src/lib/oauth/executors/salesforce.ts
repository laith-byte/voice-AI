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

interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

interface SalesforceContact {
  Id: string;
  FirstName: string | null;
  LastName: string | null;
  Phone: string | null;
  Email: string | null;
  Account?: { Name: string } | null;
}

async function salesforceRequest(
  instanceUrl: string,
  accessToken: string,
  path: string,
  options?: RequestInit
) {
  const res = await fetch(`${instanceUrl}/services/data/v59.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res;
}

export async function executeSalesforce(
  callLog: CallLog,
  clientId: string,
  _config: Record<string, unknown>
): Promise<void> {
  if (!callLog.from_number) return;

  const accessToken = await getValidToken(clientId, "salesforce");

  // Get the instance URL from the stored connection metadata
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();
  const { data: connection } = await supabase
    .from("oauth_connections")
    .select("provider_metadata")
    .eq("client_id", clientId)
    .eq("provider", "salesforce")
    .single();

  const instanceUrl = (connection?.provider_metadata as Record<string, string>)?.instance_url;
  if (!instanceUrl) throw new Error("Salesforce instance URL not found");

  // Search for existing contact by phone (SOQL query)
  const phone = callLog.from_number;
  const safePhone = phone.replace(/'/g, "\\'");
  const soql = `SELECT Id, FirstName, LastName, Phone, Email FROM Contact WHERE Phone = '${safePhone}' LIMIT 1`;
  const searchRes = await salesforceRequest(
    instanceUrl,
    accessToken,
    `/query?q=${encodeURIComponent(soql)}`
  );

  if (!searchRes.ok) {
    throw new Error(`Salesforce query failed: ${searchRes.status}`);
  }

  const searchData: SalesforceQueryResult<SalesforceContact> = await searchRes.json();

  let contactId: string;

  if (searchData.totalSize > 0) {
    // Update existing contact
    contactId = searchData.records[0].Id;
    const patchRes = await salesforceRequest(
      instanceUrl,
      accessToken,
      `/sobjects/Contact/${contactId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          Description: `Last AI call: ${new Date().toISOString()}`,
        }),
      }
    );
    if (!patchRes.ok) {
      console.error(`Salesforce contact update failed: ${patchRes.status}`);
    }
  } else {
    // Create new contact
    const createRes = await salesforceRequest(
      instanceUrl,
      accessToken,
      "/sobjects/Contact",
      {
        method: "POST",
        body: JSON.stringify({
          Phone: phone,
          LastName: phone, // LastName is required in Salesforce
          LeadSource: "AI Phone Call",
        }),
      }
    );

    if (!createRes.ok) {
      throw new Error(`Salesforce contact creation failed: ${createRes.status}`);
    }

    const createData = await createRes.json();
    contactId = createData.id;
  }

  // Log the call as a Task record
  const taskSubject = `AI Phone Call - ${callLog.status}`;
  const taskDescription = [
    `Duration: ${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`,
    callLog.summary && `Summary: ${callLog.summary}`,
    `Call ID: ${callLog.retell_call_id}`,
    `Direction: ${callLog.direction}`,
  ]
    .filter(Boolean)
    .join("\n");

  const taskRes = await salesforceRequest(
    instanceUrl,
    accessToken,
    "/sobjects/Task",
    {
      method: "POST",
      body: JSON.stringify({
        Subject: taskSubject,
        Description: taskDescription,
        WhoId: contactId,
        Status: "Completed",
        Priority: "Normal",
        Type: "Call",
        ActivityDate: callLog.started_at
          ? new Date(callLog.started_at).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      }),
    }
  );
  if (!taskRes.ok) {
    console.error(`Salesforce task creation failed: ${taskRes.status}`);
  }
}
