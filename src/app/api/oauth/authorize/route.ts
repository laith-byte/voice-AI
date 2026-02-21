import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { getProviderConfig, SUPPORTED_PROVIDERS } from "@/lib/oauth/providers";
import { createOAuthState } from "@/lib/oauth/state";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const redirectPath = url.searchParams.get("redirect") || "/portal/automations";

  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const config = getProviderConfig(provider);
  const state = createOAuthState({ clientId, provider, redirectPath });
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    state,
    response_type: "code",
  });

  if (provider === "slack") {
    // Slack uses 'scope' for bot scopes (space-separated)
    params.set("scope", config.scopes.join(","));
  } else {
    params.set("scope", config.scopes.join(" "));
  }

  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  if (provider === "salesforce") {
    params.set("prompt", "login consent");
  }

  const authUrl = `${config.authUrl}?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
