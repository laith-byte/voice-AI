import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const agentId = request.nextUrl.searchParams.get("agent_id");

  let data = null;
  let error = null;

  if (agentId) {
    const result = await supabase
      .from("pii_redaction_configs")
      .select("*")
      .eq("client_id", clientId)
      .eq("agent_id", agentId)
      .single();
    data = result.data;
    error = result.error;
  }

  if (!data) {
    const result = await supabase
      .from("pii_redaction_configs")
      .select("*")
      .eq("client_id", clientId)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error && error.code !== "PGRST116") {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data || { enabled: false });
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body = await request.json();

  const upsertPayload: Record<string, unknown> = {
    client_id: clientId,
    enabled: body.enabled ?? false,
    redact_phone_numbers: body.redact_phone_numbers ?? true,
    redact_emails: body.redact_emails ?? true,
    redact_ssn: body.redact_ssn ?? true,
    redact_credit_cards: body.redact_credit_cards ?? true,
    redact_names: body.redact_names ?? false,
    custom_patterns: body.custom_patterns || [],
    updated_at: new Date().toISOString(),
  };

  if (body.agent_id) {
    upsertPayload.agent_id = body.agent_id;
  }

  const { data, error } = await supabase
    .from("pii_redaction_configs")
    .upsert(upsertPayload, { onConflict: "client_id,agent_id" })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
