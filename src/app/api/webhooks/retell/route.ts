import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executePostCallActions } from "@/lib/post-call-actions";
import { executeRecipes } from "@/lib/automation-recipes";
import { redactTranscript, redactText } from "@/lib/pii-redaction";
import { dispatchZapierEvent } from "@/lib/zapier";
import { dispatchMakeEvent } from "@/lib/make";
import { dispatchN8nEvent } from "@/lib/n8n";
import { sendEmail } from "@/lib/resend";
import { scoreLeadFromCall } from "@/lib/lead-scoring";
import Retell from "retell-sdk";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature from Retell
    const signature = request.headers.get("x-retell-signature");
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey || !signature || !Retell.verify(rawBody, apiKey, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
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
    await supabase.from("webhook_logs").insert({
      organization_id: organizationId,
      event,
      agent_id: internalAgentId,
      platform_call_id: call.call_id || null,
      raw_payload: body,
      import_result: "success",
      timestamp: new Date().toISOString(),
    });

    switch (event) {
      case "call_started": {
        if (!internalAgentId) {
          console.warn("call_started: no matching agent for retell agent_id:", call.agent_id);
          break;
        }

        // Snapshot agent config for historical cost accuracy
        let costSnapshot: Record<string, unknown> | null = null;
        try {
          const snapshotApiKey = process.env.RETELL_API_KEY;
          if (snapshotApiKey && call.agent_id) {
            const agentConfigRes = await fetch(
              `https://api.retellai.com/get-agent/${call.agent_id}`,
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

        const { error: insertError } = await supabase.from("call_logs").insert({
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
        });
        if (insertError) console.error("Failed to insert call_log:", insertError);
        break;
      }

      case "call_ended": {
        const durationMs =
          call.end_timestamp && call.start_timestamp
            ? call.end_timestamp - call.start_timestamp
            : 0;

        await supabase
          .from("call_logs")
          .update({
            status: "completed",
            duration_seconds: Math.round(durationMs / 1000),
            transcript: call.transcript_object || null,
            recording_url: call.recording_url || null,
            metadata: {
              ...(call.metadata || {}),
              reason_call_ended: call.disconnection_reason,
              call_type: call.call_type,
            },
            ended_at: call.end_timestamp
              ? new Date(call.end_timestamp).toISOString()
              : new Date().toISOString(),
          })
          .eq("retell_call_id", call.call_id);
        break;
      }

      case "call_analyzed": {
        const updateData: Record<string, unknown> = {};
        if (call.call_summary) updateData.summary = call.call_summary;
        if (call.custom_analysis_data)
          updateData.post_call_analysis = call.custom_analysis_data;

        // Also capture transcript if not already stored
        if (call.transcript_object) updateData.transcript = call.transcript_object;

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from("call_logs")
            .update(updateData)
            .eq("retell_call_id", call.call_id);
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
        const { data: piiConfig } = await supabase
          .from("pii_redaction_configs")
          .select("*")
          .eq("client_id", clientId)
          .single();

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
          executePostCallActions(callLogRow, clientId).catch((err) =>
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
          if (callerPhone && callLogRow.agent_id) {
            const { data: matchingLead } = await supabase
              .from("leads")
              .select("id")
              .eq("agent_id", callLogRow.agent_id)
              .or(`phone.eq.${callerPhone}`)
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

        // Check for first real call after go-live
        const { data: onboarding } = await supabase
          .from("client_onboarding")
          .select("go_live_at, first_call_notified_at, contact_email, business_name")
          .eq("client_id", clientId)
          .single();

        if (
          onboarding?.go_live_at &&
          !onboarding.first_call_notified_at &&
          onboarding.contact_email
        ) {
          const bizName = onboarding.business_name || "Your Business";
          const safeBizName = bizName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const safeFromName = bizName.replace(/[<>"'\r\n]/g, "");
          await sendEmail({
            to: onboarding.contact_email,
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
            from: `${safeFromName} <notifications@invarialabs.com>`,
          }).catch((err: unknown) => console.error("First-call email error:", err));

          await supabase
            .from("client_onboarding")
            .update({ first_call_notified_at: new Date().toISOString() })
            .eq("client_id", clientId);
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
        try {
          const fwdRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          forwardResults.push(`${url}: ${fwdRes.status}`);
        } catch {
          forwardResults.push(`${url}: failed`);
        }
      }

      // Update webhook log with forwarding result
      if (forwardResults.length > 0) {
        await supabase
          .from("webhook_logs")
          .update({ forwarding_result: forwardResults.join(", ") })
          .eq("platform_call_id", call.call_id)
          .eq("event", event);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Retell webhook error:", error);

    try {
      const supabase = await createServiceClient();
      await supabase.from("webhook_logs").insert({
        event: "error",
        raw_payload: { error: String(error) },
        import_result: "failed",
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore logging failure
    }

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
