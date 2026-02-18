import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

// GET — Zapier authentication test endpoint
// Zapier calls this to verify the API key is valid
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  // API key format: client_id:random_key
  const parts = apiKey.split(":");
  if (parts.length !== 2) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  const [clientId] = parts;
  const supabase = await createServiceClient();

  // Verify the client exists
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    client_id: client.id,
    client_name: client.name,
  });
}
