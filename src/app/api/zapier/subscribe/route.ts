import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function authenticateZapier(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  const supabase = await createServiceClient();
  const keyHash = hashApiKey(apiKey);

  // Find a subscription with this API key hash to identify the client
  const { data } = await supabase
    .from("zapier_subscriptions")
    .select("client_id")
    .eq("api_key_hash", keyHash)
    .limit(1)
    .single();

  if (data) return { clientId: data.client_id, apiKeyHash: keyHash, supabase };

  // If no existing subscription, check if it's a new key format: client_id:random_key
  const parts = apiKey.split(":");
  if (parts.length === 2) {
    return { clientId: parts[0], apiKeyHash: keyHash, supabase };
  }

  return null;
}

// POST — Zapier REST Hook subscribe
export async function POST(request: NextRequest) {
  const auth = await authenticateZapier(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { hookUrl, event = "call.completed" } = body;

  if (!hookUrl) {
    return NextResponse.json({ error: "hookUrl is required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("zapier_subscriptions")
    .insert({
      client_id: auth.clientId,
      hook_url: hookUrl,
      event,
      api_key_hash: auth.apiKeyHash,
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE — Zapier REST Hook unsubscribe
export async function DELETE(request: NextRequest) {
  const auth = await authenticateZapier(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("id");

  if (!subscriptionId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("zapier_subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("client_id", auth.clientId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
