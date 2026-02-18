import { getValidToken } from "@/lib/oauth/token-manager";
import { createServiceClient } from "@/lib/supabase/server";

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

const QB_API_BASE = process.env.QUICKBOOKS_SANDBOX === "true"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

async function getRealmId(clientId: string): Promise<string> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("oauth_connections")
    .select("provider_metadata")
    .eq("client_id", clientId)
    .eq("provider", "quickbooks")
    .single();

  if (error || !data) {
    throw new Error("No QuickBooks connection found");
  }

  const metadata = data.provider_metadata as Record<string, unknown> | null;
  const realmId = metadata?.realm_id as string | undefined;
  if (!realmId) {
    throw new Error("No QuickBooks realm_id found — please reconnect QuickBooks");
  }
  return realmId;
}

async function qbFetch(
  accessToken: string,
  realmId: string,
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const url = `${QB_API_BASE}/v3/company/${realmId}/${endpoint}`;
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`QuickBooks API error (${res.status}): ${errText}`);
  }

  return res.json();
}

async function findOrCreateCustomer(
  accessToken: string,
  realmId: string,
  phone: string
): Promise<{ Id: string; DisplayName: string }> {
  // Search by phone number
  const query = `SELECT * FROM Customer WHERE PrimaryPhone = '${phone.replace(/'/g, "\\'")}'`;
  const searchResult = (await qbFetch(
    accessToken,
    realmId,
    `query?query=${encodeURIComponent(query)}`
  )) as { QueryResponse: { Customer?: { Id: string; DisplayName: string }[] } };

  if (searchResult.QueryResponse.Customer?.length) {
    return searchResult.QueryResponse.Customer[0];
  }

  // Create a new customer
  const createResult = (await qbFetch(accessToken, realmId, "customer", {
    method: "POST",
    body: {
      DisplayName: `Caller ${phone}`,
      PrimaryPhone: { FreeFormNumber: phone },
    },
  })) as { Customer: { Id: string; DisplayName: string } };

  return createResult.Customer;
}

export async function executeQuickBooks(
  callLog: CallLog,
  clientId: string,
  config: Record<string, unknown>
): Promise<void> {
  if (!callLog.from_number) return;

  const accessToken = await getValidToken(clientId, "quickbooks");
  const realmId = await getRealmId(clientId);

  const defaultItemName = (config.default_item_name as string) || "Phone Consultation";
  const defaultRate = Number(config.default_rate) || 0;

  // Find or create the customer
  const customer = await findOrCreateCustomer(
    accessToken,
    realmId,
    callLog.from_number
  );

  // Extract service info from post_call_analysis if available
  const analysis = callLog.post_call_analysis as Record<string, unknown> | null;
  const serviceName = (analysis?.service as string) || defaultItemName;
  const rate = Number(analysis?.rate) || defaultRate;

  const durationMinutes = Math.ceil(callLog.duration_seconds / 60);
  const description = [
    `AI Phone Call — ${callLog.status}`,
    `Duration: ${durationMinutes} min`,
    callLog.summary && `Summary: ${callLog.summary}`,
    `Call ID: ${callLog.retell_call_id}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Create a draft invoice
  await qbFetch(accessToken, realmId, "invoice", {
    method: "POST",
    body: {
      CustomerRef: { value: customer.Id },
      Line: [
        {
          Amount: rate,
          DetailType: "SalesItemLineDetail",
          Description: description,
          SalesItemLineDetail: {
            ItemRef: { name: serviceName },
            Qty: 1,
            UnitPrice: rate,
          },
        },
      ],
      TxnDate: callLog.started_at
        ? new Date(callLog.started_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      PrivateNote: `Auto-generated from call ${callLog.retell_call_id}`,
    },
  });
}
