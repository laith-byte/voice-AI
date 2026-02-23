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

export async function jobberGraphQL(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: Record<string, unknown>; errors?: { message: string }[] }> {
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": "2024-12-17",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Jobber GraphQL request failed: ${res.status}`);
  return res.json();
}

export async function executeJobber(
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
    accessToken = await getValidToken(clientId, "jobber");
  } catch (err) {
    await enqueueRetry({
      clientId,
      provider: "jobber",
      action: "post_call_sync",
      payload: callLog as unknown as Record<string, unknown>,
    });
    logIntegrationEvent({
      client_id: clientId,
      provider: "jobber",
      event_type: "token_error",
      status: "retrying",
      call_log_id: callLog.id,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  try {
    const phone = callLog.from_number;

    // Search for existing client by phone
    const searchResult = await jobberGraphQL(
      accessToken,
      `query($searchTerm: String!) { clients(searchTerm: $searchTerm) { nodes { id name { full } phones { number } emails { address } } } }`,
      { searchTerm: phone }
    );

    const clients = (searchResult.data?.clients as { nodes: { id: string; name: { full: string }; phones: { number: string }[]; emails: { address: string }[] }[] })?.nodes || [];
    let clientNodeId: string;
    let isNewClient = false;

    if (clients.length > 0) {
      clientNodeId = clients[0].id;
    } else {
      // Create new client using extracted name or fallback
      const firstName = extracted.caller_name?.split(" ")[0] || "Unknown";
      const lastName = extracted.caller_name?.split(" ").slice(1).join(" ") || "Caller";

      const createInput: Record<string, unknown> = {
        firstName,
        lastName,
        phones: [{ number: phone, description: "Mobile" }],
      };
      if (extracted.email) {
        createInput.emails = [{ address: extracted.email, description: "Primary" }];
      }

      const createResult = await jobberGraphQL(
        accessToken,
        `mutation($input: ClientCreateInput!) { clientCreate(input: $input) { client { id } userErrors { message } } }`,
        { input: createInput }
      );

      const created = createResult.data?.clientCreate as { client: { id: string } } | undefined;
      if (!created?.client?.id) {
        throw new Error("Failed to create Jobber client");
      }
      clientNodeId = created.client.id;
      isNewClient = true;

      logIntegrationEvent({
        client_id: clientId,
        provider: "jobber",
        event_type: "client_created",
        entity_type: "client",
        entity_id: clientNodeId,
        call_log_id: callLog.id,
      });
    }

    // Map service to CRM category
    const serviceMapping = await mapServiceToCategory(clientId, "jobber", extracted.service_requested);

    // Create a request with call details
    const detailLines = [
      `AI Phone Call - ${callLog.status}`,
      `Duration: ${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`,
      callLog.summary && `Summary: ${callLog.summary}`,
      extracted.service_requested && `Service Requested: ${extracted.service_requested}`,
      serviceMapping?.external_category_name && `Category: ${serviceMapping.external_category_name}`,
      `Urgency: ${extracted.urgency}`,
      `Call ID: ${callLog.retell_call_id}`,
      `Direction: ${callLog.direction}`,
    ];
    const details = detailLines.filter(Boolean).join("\n");

    const requestResult = await jobberGraphQL(
      accessToken,
      `mutation($input: RequestCreateInput!) { requestCreate(input: $input) { request { id } userErrors { message } } }`,
      {
        input: {
          clientId: clientNodeId,
          title: extracted.service_requested
            ? `AI Call: ${extracted.service_requested}`
            : "AI Phone Call",
          details,
        },
      }
    );

    const requestCreated = requestResult.data?.requestCreate as { request: { id: string } } | undefined;

    logIntegrationEvent({
      client_id: clientId,
      provider: "jobber",
      event_type: isNewClient ? "client_created_and_request_logged" : "request_created",
      entity_type: "request",
      entity_id: requestCreated?.request?.id || undefined,
      call_log_id: callLog.id,
      metadata: {
        urgency: extracted.urgency,
        service_requested: extracted.service_requested,
        service_mapping: serviceMapping ? serviceMapping.external_category_name : null,
      },
    });

    if (requestResult.errors?.length) {
      console.error("Jobber request creation errors:", requestResult.errors);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    logIntegrationEvent({
      client_id: clientId,
      provider: "jobber",
      event_type: "sync_failed",
      status: "failed",
      call_log_id: callLog.id,
      error_message: errorMsg,
    });

    if (errorMsg.includes("429") || errorMsg.includes("500") || errorMsg.includes("503")) {
      await enqueueRetry({
        clientId,
        provider: "jobber",
        action: "post_call_sync",
        payload: callLog as unknown as Record<string, unknown>,
      });
    }

    throw err;
  }
}
