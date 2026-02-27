import { encrypt, decrypt } from "@/lib/crypto";
import { randomBytes } from "crypto";

interface OAuthState {
  clientId: string;
  provider: string;
  redirectPath: string;
  timestamp: number;
  nonce: string;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// HIGH-09: Track consumed state nonces to prevent replay attacks
const consumedNonces = new Map<string, number>();

// Cleanup consumed nonces older than the max age
function cleanupConsumedNonces() {
  const cutoff = Date.now() - STATE_MAX_AGE_MS;
  for (const [nonce, timestamp] of consumedNonces) {
    if (timestamp < cutoff) consumedNonces.delete(nonce);
  }
}

export function createOAuthState(params: {
  clientId: string;
  provider: string;
  redirectPath: string;
}): string {
  const state: OAuthState = {
    ...params,
    timestamp: Date.now(),
    nonce: randomBytes(16).toString("hex"),
  };
  return encrypt(JSON.stringify(state));
}

export function parseOAuthState(encrypted: string): OAuthState {
  const json = decrypt(encrypted);
  const state: OAuthState = JSON.parse(json);

  if (!state.clientId || !state.provider || !state.redirectPath) {
    throw new Error("Invalid OAuth state: missing fields");
  }

  if (Date.now() - state.timestamp > STATE_MAX_AGE_MS) {
    throw new Error("OAuth state expired");
  }

  // HIGH-09: Check for replay — reject if nonce was already consumed
  if (state.nonce) {
    cleanupConsumedNonces();
    if (consumedNonces.has(state.nonce)) {
      throw new Error("OAuth state already consumed");
    }
    consumedNonces.set(state.nonce, state.timestamp);
  }

  return state;
}
