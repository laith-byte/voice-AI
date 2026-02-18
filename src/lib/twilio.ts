import Twilio from "twilio";

let _client: ReturnType<typeof Twilio> | null = null;

export function getTwilioClient() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  _client = Twilio(sid, token);
  return _client;
}

export async function sendSms(to: string, body: string) {
  const client = getTwilioClient();
  if (!client) {
    console.log("[SMS] Twilio not configured:", body);
    return;
  }
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return;
  return client.messages.create({ body, from, to });
}
