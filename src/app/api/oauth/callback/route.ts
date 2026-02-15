import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { getProviderConfig } from "@/lib/oauth/providers";
import { parseOAuthState } from "@/lib/oauth/state";
import { registerAgentTools } from "@/lib/oauth/register-agent-tools";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    console.error("OAuth error from provider:", errorParam);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/portal/automations?oauth_error=${errorParam}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/portal/automations?oauth_error=missing_params`
    );
  }

  let state;
  try {
    state = parseOAuthState(stateParam);
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/portal/automations?oauth_error=invalid_state`
    );
  }

  const { clientId, provider, redirectPath } = state;

  // Verify the authenticated user is authorized for this clientId
  try {
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (user) {
      const { data: userData } = await userSupabase
        .from("users")
        .select("client_id, organization_id, role")
        .eq("id", user.id)
        .single();

      if (userData) {
        // Client users must match the clientId
        if (userData.role?.startsWith("client_") && userData.client_id !== clientId) {
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?oauth_error=unauthorized`
          );
        }
        // Startup admins must own the client via their organization
        if (!userData.role?.startsWith("client_")) {
          const serviceCheck = await createServiceClient();
          const { data: clientRow } = await serviceCheck
            .from("clients")
            .select("id")
            .eq("id", clientId)
            .eq("organization_id", userData.organization_id)
            .single();
          if (!clientRow) {
            return NextResponse.redirect(
              `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?oauth_error=unauthorized`
            );
          }
        }
      }
    }
  } catch {
    // If session verification fails, continue with the encrypted state check
    // The encrypted state with 10-min expiry is the primary protection
  }

  const config = getProviderConfig(provider);
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`;

  try {
    // Exchange code for tokens
    const tokenBody: Record<string, string> = {
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    };

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenBody),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error(`OAuth token exchange failed for ${provider}:`, err);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?oauth_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenRes.json();

    // Extract token fields (different providers have different shapes)
    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;
    let providerEmail: string | null = null;
    let providerMetadata: Record<string, unknown> = {};

    if (provider === "slack") {
      // Slack returns tokens in authed_user or at top level for bot tokens
      accessToken = tokenData.access_token;
      providerMetadata = {
        team_id: tokenData.team?.id,
        team_name: tokenData.team?.name,
        bot_user_id: tokenData.bot_user_id,
      };
    } else {
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token || null;
      if (tokenData.expires_in) {
        expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      }
    }

    // For Google, fetch user email
    if (provider === "google") {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        providerEmail = userInfo.email;
      }
    }

    // For HubSpot, fetch user info
    if (provider === "hubspot") {
      const hubInfoRes = await fetch(
        "https://api.hubapi.com/oauth/v1/access-tokens/" + accessToken
      );
      if (hubInfoRes.ok) {
        const hubInfo = await hubInfoRes.json();
        providerEmail = hubInfo.user;
        providerMetadata = { hub_id: hubInfo.hub_id, hub_domain: hubInfo.hub_domain };
      }
    }

    // Upsert into oauth_connections
    const supabase = await createServiceClient();
    const { error: upsertError } = await supabase
      .from("oauth_connections")
      .upsert(
        {
          client_id: clientId,
          provider,
          access_token: encrypt(accessToken),
          refresh_token: refreshToken ? encrypt(refreshToken) : null,
          token_expires_at: expiresAt?.toISOString() || null,
          scopes: config.scopes,
          provider_email: providerEmail,
          provider_metadata: providerMetadata,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,provider" }
      );

    if (upsertError) {
      console.error("Failed to save OAuth connection:", upsertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?oauth_error=save_failed`
      );
    }

    // Register Retell tools if applicable (non-blocking)
    if (provider === "google" || provider === "hubspot") {
      registerAgentTools(clientId, provider).catch((err) =>
        console.error("Failed to register Retell tools:", err)
      );
    }

    // Redirect back to the automations page with success indicator
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?connected=${provider}`
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?oauth_error=unknown`
    );
  }
}
