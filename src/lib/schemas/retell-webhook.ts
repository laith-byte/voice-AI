import { z } from "zod";

export const retellWebhookSchema = z.object({
  event: z.enum([
    "call_started",
    "call_ended",
    "call_analyzed",
  ]),
  call: z.object({
    call_id: z.string(),
    agent_id: z.string(),
    call_status: z.string(),
    start_timestamp: z.number().optional(),
    end_timestamp: z.number().optional(),
    transcript: z.string().optional(),
    recording_url: z.string().optional(),
    disconnection_reason: z.string().optional(),
    call_analysis: z.record(z.string(), z.unknown()).optional(),
  }).passthrough(),
  data: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type RetellWebhookPayload = z.infer<typeof retellWebhookSchema>;
