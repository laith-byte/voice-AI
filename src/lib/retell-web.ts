"use client";

import { RetellWebClient } from "retell-client-js-sdk";

let retellWebClient: RetellWebClient | null = null;

export function getRetellWebClient() {
  if (!retellWebClient) {
    retellWebClient = new RetellWebClient();
  }
  return retellWebClient;
}

export async function startWebCall(accessToken: string) {
  const client = getRetellWebClient();
  await client.startCall({ accessToken });
  return client;
}

export function stopWebCall() {
  const client = getRetellWebClient();
  client.stopCall();
}

export type RetellEvent =
  | "call_started"
  | "call_ended"
  | "agent_start_talking"
  | "agent_stop_talking"
  | "update"
  | "error";

export { RetellWebClient };
