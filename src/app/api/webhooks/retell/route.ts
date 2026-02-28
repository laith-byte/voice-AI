import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executePostCallActions } from "@/lib/post-call-actions";
import { executeRecipes } from "@/lib/integration-recipes";
import { redactTranscript, redactText } from "@/lib/pii-redaction";
import { dispatchZapierEvent } from "@/lib/zapier";
import { dispatchMakeEvent } from "@/lib/make";
import { dispatchN8nEvent } from "@/lib/n8n";
import { sendEmail } from "@/lib/resend";
import { scoreLeadFromCall } from "@/lib/lead-scoring";
import { isSafeWebhookUrl } from "@/lib/url-validation";
import Retell from "retell-sdk";
import { logger } from "@/lib/logger";
import { RETELL_API_BASE } from "@/lib/retell";
import { notificationFrom } from "@/lib/email";
import { retellWebhookSchema } from "@/lib/schemas/retell-webhook";
import { sanitizePhone } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // MEDIUM-20: Reject oversized payloads (> 1MB)
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > 1_048_576) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const rawBody = await request.text();

    // Verify webhook signature from Retell
    const signature = request.headers.get("x-retell-signature");
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey || !signature || !Retell.verify(rawBody, apiKey, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const parsed = retellWebhookSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn("Invalid webhook payload", { error: parsed.error.message });
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const event: string = body.event;
    const call = body.call || {};

    const supabase = await createServiceClient();

    // Look up our internal agent by Retell agent_id to get organization_id, client_id, agent UUID
    let organizationId: string | null = null;
    let internalAgentId: string | null = null;
    let clientId: string | null = null;

    if (call.agent_id) {
      const { data: agentRow } = await supabase
        .from("agents")
        .select("id, organization_id, client_id")
        .eq("retell_agent_id", call.agent_id)
        .single();

      if (agentRow) {
        organizationId = agentRow.organization_id;
        internalAgentId = agentRow.id;
        clientId = agentRow.client_id;
      }
    }

    // Log the webhook event
    const { error: logError } = await supabase.from("webhook_logs").insert({
      organization_id: organizationId,
      event,
      agent_id: internalAgentId,
      platform_call_id: call.call_id || null,
      raw_payload: body,
      import_result: "success",
      timestamp: new Date().toISOString(),
    });
    if (logError) {
      logger.error("Failed to insert webhook_log", { error: logError.message });
      return NextResponse.json({ error: "Logging failed" }, { status: 500 });
    }

    switch (event) {
      case "call_started": {
        if (!internalAgentId) {
          logger.warn("call_started: no matching agent for retell agent_id", { agentId: call.agent_id });
          break;
        }

        // Snapshot agent config for historical cost accuracy
        let costSnapshot: Record<string, unknown> | null = null;
        try {
          const snapshotApiKey = process.env.RETELL_API_KEY;
          if (snapshotApiKey && call.agent_id) {
            const agentConfigRes = await fetch(
              `${RETELL_API_BASE}/get-agent/${call.agent_id}`,
              {
                headers: {
                  Authorization: `Bearer ${snapshotApiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (agentConfigRes.ok) {
              const agentConfig = await agentConfigRes.json();
              costSnapshot = {
                llm_model:
                  agentConfig.response_engine?.llm?.model || null,
                voice_id: agentConfig.voice_id || null,
                denoising_mode: agentConfig.denoising_mode || null,
                has_pii_config: !!agentConfig.pii_config,
              };
            }
          }
        } catch (snapshotErr) {
          console.error("Cost snapshot error (non-blocking):", snapshotErr);
        }

        const callMetadata = {
          ...(call.metadata || {}),
          ...(costSnapshot ? { cost_snapshot: costSnapshot } : {}),
        };

        // C1: Idempotent insert — upsert with ignoreDuplicates so duplicate call_started does not create a second row or race
        const { error: insertError } = await supabase.from("call_logs").upsert(
          {
            organization_id: organizationId,
            client_id: clientId,
            agent_id: internalAgentId,
            retell_call_id: call.call_id,
            from_number: call.from_number || null,
            to_number: call.to_number || null,
            direction: call.direction || "inbound",
            status: "in_progress",
            duration_seconds: 0,
            started_at: call.start_timestamp
              ? new Date(call.start_timestamp).toISOString()
              : new Date().toISOString(),
            metadata: callMetadata,
          },
          { onConflict: "retell_call_id", ignoreDuplicates: true }
        );
        if (insertError) console.error("Failed to insert call_log:", insertError);
        break;
      }

      case "call_ended": {
        // CRITICAL-12: Idempotency check — skip if already processed
        const { data: existingEndedLog } = await supabase
          .from("call_logs")
          .select("status, metadata")
          .eq("retell_call_id", call.call_id)
          .single();
        if (existingEndedLog?.status === "completed") break;

        const durationMs =
          call.end_timestamp && call.start_timestamp
            ? call.end_timestamp - call.start_timestamp
            : 0;

        // HIGH-13: Merge metadata instead of overwriting to prevent race with call_analyzed
        const mergedMetadata = {
          ...(existingEndedLog?.metadata as Record<string, unknown> || {}),
          ...(call.metadata || {}),
          reason_call_ended: call.disconnection_reason,
          call_type: call.call_type,
        };

        // MEDIUM-15: Check for DB mutation errors
        const { error: callEndedError } = await supabase
          .from("call_logs")
          .update({
            status: "completed",
            duration_seconds: Math.round(durationMs / 1000),
            transcript: call.transcript_object || null,
            recording_url: call.recording_url || null,
            metadata: mergedMetadata,
            ended_at: call.end_timestamp
              ? new Date(call.end_timestamp).toISOString()
              : new Date().toISOString(),
          })
          .eq("retell_call_id", call.call_id);
        if (callEndedError) console.error("Failed to update call_log on call_ended:", callEndedError);

        // Handle callback call completion
        if (call.metadata?.source === "callback" && call.metadata?.pending_callback_id) {
          const pendingCallbackId = call.metadata.pending_callback_id as string;
          const durationSeconds = Math.round(durationMs / 1000);
          const failReasons = ["dial_no_answer", "dial_busy", "voicemail_reached", "machine_detected"];
          const callFailed = failReasons.includes(call.disconnection_reason) || durationSeconds < 10;

          if (!callFailed) {
            // Call was successfully connected — mark completed
            const { error: updateError } = await supabase
              .from("pending_callbacks")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", pendingCallbackId);
            if (updateError) {
              logger.error("Failed to update pending_callbacks (completed)", { error: updateError.message });
            }
          } else {
            // Call failed — check retry eligibility
            const { data: cb } = await supabase
              .from("pending_callbacks")
              .select("attempts, max_attempts, timezone")
              .eq("id", pendingCallbackId)
              .single();

            if (cb && cb.attempts < cb.max_attempts) {
              // Schedule retry for 9 AM next day in caller's timezone
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              let tomorrowHour: number;
              try {
                tomorrowHour = parseInt(
                  new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    hour12: false,
                    timeZone: cb.timezone,
                  }).format(tomorrow)
                );
              } catch {
                tomorrowHour = tomorrow.getUTCHours();
              }
              const hoursToAdd = (9 - tomorrowHour + 24) % 24;
              tomorrow.setTime(tomorrow.getTime() + hoursToAdd * 3600000);
              tomorrow.setMinutes(0, 0, 0);

              const { error: retryError } = await supabase
                .from("pending_callbacks")
                .update({
                  status: "answered",
                  next_attempt_at: tomorrow.toISOString(),
                  callback_retell_call_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", pendingCallbackId);
              if (retryError) {
                logger.error("Failed to update pending_callbacks (retry)", { error: retryError.message });
              }
            } else {
              // Max attempts reached — mark as failed
              const { error: failError } = await supabase
                .from("pending_callbacks")
                .update({
                  status: "failed",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", pendingCallbackId);
              if (failError) {
                logger.error("Failed to update pending_callbacks (failed)", { error: failError.message });
              }
            }
          }
        }

        break;
      }

      case "call_analyzed": {
        // CRITICAL-12: Idempotency check — skip if already analyzed
        const { data: existingAnalyzedLog } = await supabase
          .from("call_logs")
          .select("post_call_analysis, transcript")
          .eq("retell_call_id", call.call_id)
          .single();
        if (existingAnalyzedLog?.post_call_analysis) break;

        const updateData: Record<string, unknown> = {};
        if (call.call_summary) updateData.summary = call.call_summary;
        if (call.custom_analysis_data)
          updateData.post_call_analysis = call.custom_analysis_data;

        // HIGH-13: Only set transcript if not already stored by call_ended
        if (call.transcript_object && !existingAnalyzedLog?.transcript)
          updateData.transcript = call.transcript_object;

        if (Object.keys(updateData).length > 0) {
          // MEDIUM-15: Check for DB mutation errors
          const { error: analyzedError } = await supabase
            .from("call_logs")
            .update(updateData)
            .eq("retell_call_id", call.call_id);
          if (analyzedError) console.error("Failed to update call_log on call_analyzed:", analyzedError);
        }
        break;
      }

      default:
        break;
    }

    // Execute post-call actions (email summary, SMS, webhook, etc.)
    // Only trigger on call_analyzed to avoid double execution (call_ended + call_analyzed)
    // and to ensure summary/analysis data is available for actions
    if (clientId && event === "call_analyzed") {
      // Apply PII redaction if configured for this client
      try {
        let piiConfig = null;
        if (internalAgentId) {
          const { data } = await supabase
            .from("pii_redaction_configs")
            .select("*")
            .eq("client_id", clientId)
            .eq("agent_id", internalAgentId)
            .single();
          piiConfig = data;
        }
        if (!piiConfig) {
          const { data } = await supabase
            .from("pii_redaction_configs")
            .select("*")
            .eq("client_id", clientId)
            .is("agent_id", null)
            .single();
          piiConfig = data;
        }

        if (piiConfig?.enabled) {
          const redactedUpdate: Record<string, unknown> = {};

          // Fetch current call log to redact
          const { data: currentLog } = await supabase
            .from("call_logs")
            .select("transcript, summary")
            .eq("retell_call_id", call.call_id)
            .single();

          if (currentLog) {
            if (currentLog.transcript && Array.isArray(currentLog.transcript)) {
              redactedUpdate.transcript = redactTranscript(currentLog.transcript, piiConfig);
            }
            if (currentLog.summary) {
              redactedUpdate.summary = redactText(currentLog.summary, piiConfig);
            }
            if (Object.keys(redactedUpdate).length > 0) {
              await supabase
                .from("call_logs")
                .update(redactedUpdate)
                .eq("retell_call_id", call.call_id);
            }
          }
        }
      } catch (err) {
        console.error("PII redaction error:", err);
      }

      // Fetch the stored call log to pass to actions
      const { data: callLogRow } = await supabase
        .from("call_logs")
        .select("*")
        .eq("retell_call_id", call.call_id)
        .single();

      if (callLogRow) {
        // Run post-call actions, automation recipes, and Zapier dispatch in parallel
        await Promise.all([
          executePostCallActions(callLogRow, clientId, internalAgentId).catch((err) =>
            console.error("Post-call actions error:", err)
          ),
          executeRecipes(callLogRow, clientId).catch((err) =>
            console.error("Automation recipes error:", err)
          ),
          dispatchZapierEvent(clientId, "call.completed", callLogRow).catch((err) =>
            console.error("Zapier dispatch error:", err)
          ),
          dispatchMakeEvent(clientId, "call.completed", callLogRow).catch((err) =>
            console.error("Make dispatch error:", err)
          ),
          dispatchN8nEvent(clientId, "call.completed", callLogRow).catch((err) =>
            console.error("n8n dispatch error:", err)
          ),
        ]);

        // Score any matching lead after call log is saved
        try {
          const callerPhone = callLogRow.from_number || callLogRow.to_number;
          const sanitizedPhone = sanitizePhone(callerPhone);
          if (sanitizedPhone && callLogRow.agent_id) {
            // H3 normalization: match both +1XXXXXXXXXX and XXXXXXXXXX so stored format doesn't matter
            const withoutCountryCode =
              sanitizedPhone.startsWith("+1") && sanitizedPhone.length >= 12
                ? sanitizedPhone.slice(2)
                : "";
            const phoneFilter =
              withoutCountryCode && withoutCountryCode !== sanitizedPhone
                ? `phone.eq.${sanitizedPhone},phone.eq.${withoutCountryCode}`
                : `phone.eq.${sanitizedPhone}`;

            const { data: matchingLead } = await supabase
              .from("leads")
              .select("id")
              .eq("agent_id", callLogRow.agent_id)
              .or(phoneFilter)
              .limit(1)
              .single();

            if (matchingLead) {
              await scoreLeadFromCall(matchingLead.id, callLogRow, clientId);
            }
          }
        } catch (err) {
          console.error("Lead scoring error:", err);
        }
      }
    }

    // Post-go-live features: first-call notification + call counter
    if (clientId && event === "call_ended") {
      const isTestCall = call.call_type === "web_call" && call.metadata?.is_test_call;

      if (!isTestCall) {
        // Increment total calls since live
        const { error: rpcError } = await supabase.rpc("increment_total_calls", { p_client_id: clientId });
        if (rpcError) console.error("increment_total_calls error:", rpcError);

        // MEDIUM-08: Atomic claim to prevent duplicate first-call emails
        const { data: claimed } = await supabase
          .from("client_onboarding")
          .update({ first_call_notified_at: new Date().toISOString() })
          .eq("client_id", clientId)
          .not("go_live_at", "is", null)
          .is("first_call_notified_at", null)
          .select("contact_email, business_name")
          .maybeSingle();

        if (claimed?.contact_email) {
          const bizName = claimed.business_name || "Your Business";
          const safeBizName = bizName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const safeFromName = bizName.replace(/[<>"'\r\n]/g, "");
          await sendEmail({
            to: claimed.contact_email,
            subject: `Your first call just happened! - ${bizName}`,
            html: `<div style="font-family: sans-serif; max-width: 600px;">
              <h2 style="color: #1a1a2e;">Your AI agent just handled its first real call!</h2>
              <p>Congratulations! Your AI agent for <strong>${safeBizName}</strong> just completed its first real phone call since going live.</p>
              <p>You can view the call details, listen to the recording, and read the transcript in your dashboard.</p>
              <p style="margin-top: 24px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">View Dashboard</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Sent by ${safeBizName} via Invaria Labs</p>
            </div>`,
            from: notificationFrom(safeFromName),
          }).catch((err: unknown) => console.error("First-call email error:", err));
        }
      }
    }

    // Forward to n8n/workflow webhooks configured on this agent
    if (internalAgentId) {
      // Check agent-level webhook_url
      const { data: agentData } = await supabase
        .from("agents")
        .select("webhook_url")
        .eq("id", internalAgentId)
        .single();

      const urls: string[] = [];
      if (agentData?.webhook_url) urls.push(agentData.webhook_url);

      // Check active solutions (org-level workflows)
      if (organizationId) {
        const { data: solutions } = await supabase
          .from("solutions")
          .select("webhook_url")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .not("webhook_url", "is", null);

        if (solutions) {
          for (const s of solutions) {
            if (s.webhook_url) urls.push(s.webhook_url);
          }
        }
      }

      // Forward payload to all webhook URLs
      const forwardResults: string[] = [];
      for (const url of urls) {
        // CRITICAL-09: SSRF protection — validate URL before fetching
        if (!isSafeWebhookUrl(url)) {
          logger.warn("Skipping unsafe webhook URL", { url });
          forwardResults.push(`${url}: blocked (SSRF)`);
          continue;
        }
        try {
          const fwdRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
          });
          forwardResults.push(`${url}: ${fwdRes.status}`);
        } catch (err) {
          const isTimeout = err instanceof Error && err.name === "AbortError";
          forwardResults.push(`${url}: ${isTimeout ? "timeout" : "failed"}`);
        }
      }

      // Update webhook log with forwarding result
      // MEDIUM-15: Check for DB mutation errors
      if (forwardResults.length > 0) {
        const { error: fwdLogError } = await supabase
          .from("webhook_logs")
          .update({ forwarding_result: forwardResults.join(", ") })
          .eq("platform_call_id", call.call_id)
          .eq("event", event);
        if (fwdLogError) console.error("Failed to update webhook_logs forwarding_result:", fwdLogError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Retell webhook error:", error);

    // M11: Sanitize error before storing — message only, max 500 chars, no stack traces
    const sanitizedMessage =
      error instanceof Error ? error.message : "Unknown error";
    const truncated = sanitizedMessage.slice(0, 500);

    try {
      const supabase = await createServiceClient();
      const { error: errLogError } = await supabase.from("webhook_logs").insert({
        event: "error",
        raw_payload: { error: truncated },
        import_result: "failed",
        timestamp: new Date().toISOString(),
      });
      if (errLogError) {
        logger.error("Failed to insert webhook_log (error handler)", { error: errLogError.message });
      }
    } catch {
      // Ignore logging failure
    }

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
