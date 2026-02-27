import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getIntegrationKey } from "@/lib/integrations";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("call_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;
  if (error) { logger.error("DB error", { error: error.message }); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = await publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  const body = await request.json();
  const { action } = body;

  if (action === "create_web_call") {
    try {
      // CRITICAL-01: Origin validation via widget_config allowed_origins
      const supabase = await createClient();
      if (body.agent_id) {
        const { data: agentRow } = await supabase
          .from("agents")
          .select("id")
          .eq("retell_agent_id", body.agent_id)
          .maybeSingle();

        if (agentRow) {
          const { data: wc } = await supabase
            .from("widget_config")
            .select("allowed_origins")
            .eq("agent_id", agentRow.id)
            .single();

          if (wc?.allowed_origins && wc.allowed_origins.length > 0) {
            const reqOrigin = request.headers.get("origin");
            if (!reqOrigin || !wc.allowed_origins.includes(reqOrigin)) {
              return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
            }
          }
        }
      }

      // Resolve per-org integration key if possible
      let orgApiKey: string | null = null;
      if (body.agent_id) {
        const { data: agent } = await supabase
          .from("agents")
          .select("organization_id")
          .eq("retell_agent_id", body.agent_id)
          .limit(1)
          .maybeSingle();
        if (agent?.organization_id) {
          orgApiKey = await getIntegrationKey(agent.organization_id, "retell");
        }
      }

      const apiKey = orgApiKey || process.env.RETELL_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "No API key configured. Please check your integrations settings." }, { status: 500 });
      }
      const retellRes = await fetch("https://api.retellai.com/v2/create-web-call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: body.agent_id,
          metadata: body.metadata,
        }),
      });
      if (!retellRes.ok) {
        return NextResponse.json({ error: "Failed to create web call" }, { status: retellRes.status });
      }
      const result = await retellRes.json();
      return NextResponse.json({ access_token: result.access_token, call_id: result.call_id });
    } catch {
      return NextResponse.json({ error: "Failed to create web call" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
