import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { data, error } = await supabase
    .from("conversation_flows")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body = await request.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Flow name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversation_flows")
    .insert({
      client_id: clientId,
      agent_id: body.agent_id || null,
      name,
      nodes: body.nodes || [],
      edges: body.edges || [],
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
