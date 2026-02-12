import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getProviderConfig } from "@/lib/oauth/providers";
import { unregisterAgentTools } from "@/lib/oauth/register-agent-tools";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const body = await request.json();
  const { provider } = body;

  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Fetch current connection
  const { data: connection } = await serviceClient
    .from("oauth_connections")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "No connection found" }, { status: 404 });
  }

  // Attempt to revoke token with the provider
  try {
    const config = getProviderConfig(provider);
    const accessToken = decrypt(connection.access_token);

    if (config.revokeUrl) {
      if (provider === "google") {
        await fetch(`${config.revokeUrl}?token=${accessToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      }
    }
  } catch {
    // Revocation is best-effort; continue even if it fails
  }

  // Unregister Retell tools if applicable
  if (provider === "google" || provider === "hubspot") {
    try {
      await unregisterAgentTools(clientId, provider);
    } catch (err) {
      console.error("Failed to unregister Retell tools:", err);
    }
  }

  // Delete the connection
  const { error: deleteError } = await serviceClient
    .from("oauth_connections")
    .delete()
    .eq("client_id", clientId)
    .eq("provider", provider);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
