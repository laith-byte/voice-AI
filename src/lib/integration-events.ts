import { createServiceClient } from "@/lib/supabase/server";

interface IntegrationEventInput {
  client_id: string;
  provider: string;
  event_type: string;
  direction?: "outbound" | "inbound";
  entity_type?: string;
  entity_id?: string;
  call_log_id?: string;
  status?: "success" | "failed" | "retrying";
  error_message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget logger for CRM integration events.
 * Inserts into the integration_events table.
 */
export function logIntegrationEvent(input: IntegrationEventInput): void {
  // Fire-and-forget — don't await
  _insertEvent(input).catch((err) =>
    console.error("Failed to log integration event:", err)
  );
}

async function _insertEvent(input: IntegrationEventInput): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("integration_events").insert({
    client_id: input.client_id,
    provider: input.provider,
    event_type: input.event_type,
    direction: input.direction || "outbound",
    entity_type: input.entity_type || null,
    entity_id: input.entity_id || null,
    call_log_id: input.call_log_id || null,
    status: input.status || "success",
    error_message: input.error_message || null,
    metadata: input.metadata || {},
  });

  if (error) {
    console.error("integration_events insert error:", error);
  }
}
