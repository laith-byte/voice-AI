import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { RETELL_API_BASE } from "@/lib/retell";

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Fetch answered callbacks that are ready to process
    const { data: callbacks, error: fetchError } = await supabase
      .from("pending_callbacks")
      .select("*, agents!inner(retell_agent_id, retell_api_key_encrypted)")
      .eq("status", "answered")
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at")
      .limit(10);

    if (fetchError) {
      logger.error("Process callbacks: fetch error", { error: String(fetchError) });
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    let processed = 0;
    let failed = 0;

    for (const cb of callbacks || []) {
      try {
        const agent = cb.agents;
        if (!agent?.retell_agent_id) {
          logger.warn("Process callbacks: no Retell agent", { callbackId: cb.id });
          continue;
        }

        // Resolve Retell API key
        const apiKey = agent.retell_api_key_encrypted
          ? decrypt(agent.retell_api_key_encrypted)
          : process.env.RETELL_API_KEY;

        if (!apiKey) {
          logger.error("Process callbacks: no API key", { callbackId: cb.id });
          continue;
        }

        // Get agent's assigned phone number
        const { data: phoneNumber } = await supabase
          .from("phone_numbers")
          .select("number")
          .eq("agent_id", cb.agent_id)
          .limit(1)
          .single();

        if (!phoneNumber?.number) {
          logger.error("Process callbacks: no phone number for agent", {
            callbackId: cb.id,
            agentId: cb.agent_id,
          });
          continue;
        }

        // Compose callback context as a single dynamic variable.
        // This fills the {{callback_context}} placeholder appended to the prompt.
        const callerLabel = cb.caller_name || "the caller";
        const callbackContext = [
          "IMPORTANT — CALLBACK CONTEXT:",
          `You are calling ${callerLabel} back because they previously asked: "${cb.question}"`,
          `The answer is: "${cb.business_owner_answer}"`,
          "Present this information naturally as if you researched it yourself.",
          "Do NOT mention that anyone else provided the answer. Keep the experience seamless.",
        ].join("\n");

        // Create outbound call via Retell
        const retellRes = await fetch(
          `${RETELL_API_BASE}/v2/create-phone-call`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from_number: toE164(phoneNumber.number),
              to_number: toE164(cb.caller_phone),
              agent_id: agent.retell_agent_id,
              metadata: {
                source: "callback",
                pending_callback_id: cb.id,
              },
              retell_llm_dynamic_variables: {
                callback_context: callbackContext,
              },
            }),
          }
        );

        if (!retellRes.ok) {
          const errText = await retellRes.text();
          logger.error("Process callbacks: Retell API error", {
            callbackId: cb.id,
            error: errText,
          });
          // Push next_attempt_at forward by 30 min to avoid infinite retry loop
          await supabase
            .from("pending_callbacks")
            .update({
              next_attempt_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", cb.id);
          failed++;
          continue;
        }

        const retellData = await retellRes.json();

        // Update callback status
        await supabase
          .from("pending_callbacks")
          .update({
            status: "calling_back",
            callback_retell_call_id: retellData.call_id,
            attempts: cb.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cb.id);

        processed++;
      } catch (err) {
        logger.error("Process callbacks: error processing callback", {
          callbackId: cb.id,
          error: String(err),
        });
        failed++;
      }
    }

    // Expire old pending callbacks (> 48 hours)
    const expiryCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { count: expiredCount } = await supabase
      .from("pending_callbacks")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "pending")
      .lt("created_at", expiryCutoff);

    return NextResponse.json({
      message: "Callbacks processed",
      processed,
      failed,
      expired: expiredCount || 0,
    });
  } catch (err) {
    logger.error("Process callbacks cron failed", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
