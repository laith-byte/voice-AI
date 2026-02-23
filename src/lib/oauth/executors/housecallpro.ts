import { getValidToken } from "@/lib/oauth/token-manager";
import { extractStructuredData } from "@/lib/transcript-extraction";
import { mapServiceToCategory } from "@/lib/service-mapper";
import { logIntegrationEvent } from "@/lib/integration-events";
import { enqueueRetry } from "@/lib/integration-retry";

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
  transcript?: string | null;
}

interface HCPCustomer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_numbers: { number: string; type: string }[];
  email: string | null;
  company: string | null;
}

interface HCPSearchResponse {
  customers: HCPCustomer[];
  total_items: number;
}

const HCP_API_BASE = "https://api.housecallpro.com";

async function hcpRequest(
  accessToken: string,
  path: string,
  options?: RequestInit
) {
  const res = await fetch(`${HCP_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res;
}

export async function executeHousecallPro(
  callLog: CallLog,
  clientId: string,
  _config: Record<string, unknown>
): Promise<void> {
  if (!callLog.from_number) return;

  // Extract structured data from transcript/analysis
  const extracted = extractStructuredData(
    callLog.transcript ?? null,
    callLog.summary,
    callLog.post_call_analysis
  );

  let accessToken: string;
  try {
    accessToken = await getValidToken(clientId, "housecallpro");
  } catch (err) {
    // Token failure — enqueue for retry
    await enqueueRetry({
      clientId,
      provider: "housecallpro",
      action: "post_call_sync",
      payload: callLog as unknown as Record<string, unknown>,
    });
    logIntegrationEvent({
      client_id: clientId,
      provider: "housecallpro",
      event_type: "token_error",
      status: "retrying",
      call_log_id: callLog.id,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  try {
    // Search for existing customer by phone
    const phone = callLog.from_number;
    const searchRes = await hcpRequest(
      accessToken,
      `/pro/v1/customers?phone=${encodeURIComponent(phone)}`
    );

    if (!searchRes.ok) {
      throw new Error(`Housecall Pro customer search failed: ${searchRes.status}`);
    }

    const searchData: HCPSearchResponse = await searchRes.json();

    let customerId: string;
    let isNewCustomer = false;

    if (searchData.customers.length > 0) {
      customerId = searchData.customers[0].id;
    } else {
      // Create new customer using extracted name or phone fallback
      const firstName = extracted.caller_name?.split(" ")[0] || "Caller";
      const lastName = extracted.caller_name?.split(" ").slice(1).join(" ") || phone;

      const createBody: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        phone_numbers: [{ number: phone, type: "mobile" }],
        notifications_enabled: false,
        tags: ["ai-call"],
      };
      if (extracted.email) createBody.email = extracted.email;
      if (extracted.address) createBody.street = extracted.address;

      const createRes = await hcpRequest(
        accessToken,
        "/pro/v1/customers",
        {
          method: "POST",
          body: JSON.stringify(createBody),
        }
      );

      if (!createRes.ok) {
        throw new Error(`Housecall Pro customer creation failed: ${createRes.status}`);
      }

      const createData = await createRes.json();
      customerId = createData.id;
      isNewCustomer = true;

      logIntegrationEvent({
        client_id: clientId,
        provider: "housecallpro",
        event_type: "customer_created",
        entity_type: "customer",
        entity_id: customerId,
        call_log_id: callLog.id,
      });
    }

    // Log the call as a note on the customer
    const noteLines = [
      `AI Phone Call - ${callLog.status}`,
      `Duration: ${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`,
      callLog.summary && `Summary: ${callLog.summary}`,
      extracted.service_requested && `Service Requested: ${extracted.service_requested}`,
      `Urgency: ${extracted.urgency}`,
      `Call ID: ${callLog.retell_call_id}`,
      `Direction: ${callLog.direction}`,
    ];
    const noteText = noteLines.filter(Boolean).join("\n");

    const noteRes = await hcpRequest(
      accessToken,
      `/pro/v1/customers/${customerId}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ body: noteText }),
      }
    );
    if (!noteRes.ok) {
      console.error(`Housecall Pro note creation failed: ${noteRes.status}`);
    }

    // Map service to CRM category for job line items
    const serviceMapping = await mapServiceToCategory(clientId, "housecallpro", extracted.service_requested);

    logIntegrationEvent({
      client_id: clientId,
      provider: "housecallpro",
      event_type: isNewCustomer ? "customer_created_and_note_logged" : "note_logged",
      entity_type: "customer",
      entity_id: customerId,
      call_log_id: callLog.id,
      metadata: {
        urgency: extracted.urgency,
        service_requested: extracted.service_requested,
        service_mapping: serviceMapping ? serviceMapping.external_category_name : null,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Log failure and enqueue for retry on transient errors
    logIntegrationEvent({
      client_id: clientId,
      provider: "housecallpro",
      event_type: "sync_failed",
      status: "failed",
      call_log_id: callLog.id,
      error_message: errorMsg,
    });

    if (errorMsg.includes("429") || errorMsg.includes("500") || errorMsg.includes("503")) {
      await enqueueRetry({
        clientId,
        provider: "housecallpro",
        action: "post_call_sync",
        payload: callLog as unknown as Record<string, unknown>,
      });
    }

    throw err;
  }
}
