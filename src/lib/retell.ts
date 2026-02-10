import Retell from "retell-sdk";

function getClient() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("RETELL_API_KEY is not set");
  return new Retell({ apiKey });
}

// Agent CRUD
export async function listAgents() {
  return getClient().agent.list();
}

export async function createAgent(params: Parameters<Retell["agent"]["create"]>[0]) {
  return getClient().agent.create(params);
}

export async function getAgent(agentId: string) {
  return getClient().agent.retrieve(agentId);
}

export async function updateAgent(agentId: string, params: Record<string, unknown>) {
  return getClient().agent.update(agentId, params as Parameters<Retell["agent"]["update"]>[1]);
}

export async function deleteAgent(agentId: string) {
  return getClient().agent.delete(agentId);
}

// Calls
export async function listCalls(params?: Parameters<Retell["call"]["list"]>[0]) {
  return getClient().call.list(params as Parameters<Retell["call"]["list"]>[0]);
}

export async function getCall(callId: string) {
  return getClient().call.retrieve(callId);
}

// Phone Numbers
export async function listPhoneNumbers() {
  return getClient().phoneNumber.list();
}

export async function purchasePhoneNumber(params: { area_code?: number }) {
  return getClient().phoneNumber.create(params);
}

export async function releasePhoneNumber(phoneNumberId: string) {
  return getClient().phoneNumber.delete(phoneNumberId);
}

// Web Call
export async function createWebCall(params: { agent_id: string; metadata?: Record<string, unknown> }) {
  return getClient().call.createWebCall(params);
}
