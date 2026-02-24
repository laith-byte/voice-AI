import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

const MAX_LEADS_PER_REQUEST = 500;
const BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();

  if (!body.agent_id || typeof body.agent_id !== "string") {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", body.agent_id).single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: "leads array is required and must not be empty" }, { status: 400 });
  }

  if (body.leads.length > MAX_LEADS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many leads. Maximum ${MAX_LEADS_PER_REQUEST} leads per request.` },
      { status: 400 }
    );
  }

  // Validate each lead
  const validatedLeads = [];
  for (let i = 0; i < body.leads.length; i++) {
    const lead = body.leads[i];
    if (!lead.phone || typeof lead.phone !== "string" || !lead.phone.trim()) {
      return NextResponse.json(
        { error: `Lead at index ${i} is missing a valid phone number` },
        { status: 400 }
      );
    }
    validatedLeads.push({
      organization_id: userData.organization_id,
      agent_id: body.agent_id,
      phone: lead.phone.trim(),
      name: typeof lead.name === "string" ? lead.name.trim() || null : null,
      tags: Array.isArray(lead.tags) ? lead.tags.filter((t: unknown) => typeof t === "string") : [],
      dynamic_vars:
        lead.dynamic_vars && typeof lead.dynamic_vars === "object" && !Array.isArray(lead.dynamic_vars)
          ? lead.dynamic_vars
          : null,
    });
  }

  // Insert in batches
  let successCount = 0;
  let errorCount = 0;
  const allResults: unknown[] = [];

  for (let i = 0; i < validatedLeads.length; i += BATCH_SIZE) {
    const batch = validatedLeads.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from("leads")
      .upsert(batch, { onConflict: "phone,agent_id" })
      .select();

    if (error) {
      console.error("DB error (leads import batch):", error.message);
      errorCount += batch.length;
    } else if (data) {
      successCount += data.length;
      allResults.push(...data);
    }
  }

  if (successCount === 0 && errorCount > 0) {
    return NextResponse.json({ error: "Failed to import leads" }, { status: 500 });
  }

  return NextResponse.json(
    { imported: successCount, errors: errorCount, data: allResults },
    { status: 201 }
  );
}
