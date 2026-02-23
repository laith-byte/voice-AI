import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// GET — Make authentication test endpoint
// Make calls this to verify the API key is valid
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
  const keyHash = hashApiKey(apiKey);
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

  // Verify the full API key hash exists in subscriptions
  const { data: sub } = await supabase
    .from("make_subscriptions")
    .select("id")
    .eq("client_id", clientId)
    .eq("api_key_hash", keyHash)
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    client_id: client.id,
    client_name: client.name,
  });
}
