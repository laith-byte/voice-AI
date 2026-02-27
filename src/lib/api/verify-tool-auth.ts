import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * HIGH-05: Shared tool auth helper — validates API key AND verifies client_id exists.
 * All tool endpoints should use this instead of inline API key checks.
 */
export async function verifyToolAuth(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return { client_id: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;

  if (!client_id) {
    return { client_id: null, body, error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  }

  // Validate that the client_id actually exists
  const supabase = await createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", client_id)
    .single();

  if (!client) {
    return { client_id: null, body, error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  }

  return { client_id, body, error: null };
}
