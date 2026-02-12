import { encrypt, decrypt } from "@/lib/crypto";

interface OAuthState {
  clientId: string;
  provider: string;
  redirectPath: string;
  timestamp: number;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function createOAuthState(params: {
  clientId: string;
  provider: string;
  redirectPath: string;
}): string {
  const state: OAuthState = {
    ...params,
    timestamp: Date.now(),
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

  return state;
}
