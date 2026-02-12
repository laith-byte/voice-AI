import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executePostCallActions } from "@/lib/post-call-actions";
import { executeRecipes } from "@/lib/automation-recipes";
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
        await supabase.from("call_logs").insert({
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
          metadata: call.metadata || null,
        });
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
    if (clientId && (event === "call_ended" || event === "call_analyzed")) {
      // Fetch the stored call log to pass to actions
      const { data: callLogRow } = await supabase
        .from("call_logs")
        .select("*")
        .eq("retell_call_id", call.call_id)
        .single();

      if (callLogRow) {
        // Run both post-call actions and automation recipes in parallel
        // Don't block the webhook response
        Promise.all([
          executePostCallActions(callLogRow, clientId).catch((err) =>
            console.error("Post-call actions error:", err)
          ),
          executeRecipes(callLogRow, clientId).catch((err) =>
            console.error("Automation recipes error:", err)
          ),
        ]);
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
