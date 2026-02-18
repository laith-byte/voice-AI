import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data, error } = await supabase
    .from("phone_numbers")
    .select("*, agents(name), clients(name)")
    .order("created_at", { ascending: false });
  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase.from("phone_numbers").insert({
    organization_id: userData.organization_id,
    number: body.number,
    retell_number_id: body.retell_number_id || null,
    agent_id: body.agent_id || null,
    client_id: body.client_id || null,
    type: body.type || "standard",
    caller_id_name: body.caller_id_name || null,
    caller_id_verified: body.caller_id_verified ?? false,
    cnam_status: body.cnam_status || "none",
  }).select().single();

  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
