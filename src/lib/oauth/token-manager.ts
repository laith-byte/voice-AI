import { createServiceClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { getProviderConfig } from "@/lib/oauth/providers";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if < 5 min remaining

// In-memory lock to prevent concurrent token refreshes for the same client+provider
const refreshLocks = new Map<string, Promise<string>>();

export async function getValidToken(
  clientId: string,
  provider: string
): Promise<string> {
  const supabase = await createServiceClient();

  const { data: connection, error } = await supabase
    .from("oauth_connections")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .single();

  if (error || !connection) {
    throw new Error(`No ${provider} connection found for client ${clientId}`);
  }

  const now = Date.now();
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : null;

  // If token is still valid (more than 5 min remaining), return it
  if (!expiresAt || expiresAt - now > REFRESH_BUFFER_MS) {
    return decrypt(connection.access_token);
  }

  // Token expired or about to expire — refresh it (with lock to prevent concurrent refreshes)
  const lockKey = `${clientId}:${provider}`;
  const existingRefresh = refreshLocks.get(lockKey);
  if (existingRefresh) {
    return existingRefresh;
  }

  const refreshPromise = (async () => {
    try {
      return await doRefresh(connection, clientId, provider);
    } finally {
      refreshLocks.delete(lockKey);
    }
  })();
  refreshLocks.set(lockKey, refreshPromise);
  return refreshPromise;
}

async function doRefresh(
  connection: { refresh_token: string | null; id: string },
  clientId: string,
  provider: string,
): Promise<string> {
  if (!connection.refresh_token) {
    throw new Error(
      `${provider} token expired and no refresh token available for client ${clientId}`
    );
  }

  const config = getProviderConfig(provider);
  const refreshToken = decrypt(connection.refresh_token);

  const refreshBody: Record<string, string> = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(refreshBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Token refresh failed for ${provider}:`, errText);
    throw new Error(`Failed to refresh ${provider} token: ${res.status}`);
  }

  const tokenData = await res.json();
  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token || refreshToken;
  const newExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Update stored tokens
  const supabase = await createServiceClient();
  await supabase
    .from("oauth_connections")
    .update({
      access_token: encrypt(newAccessToken),
      refresh_token: encrypt(newRefreshToken),
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return newAccessToken;
}
