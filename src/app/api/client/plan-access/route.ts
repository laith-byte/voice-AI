import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { getClientPlanAccess } from "@/lib/plan-access";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user, supabase, request);
  if (error || !clientId) return error || NextResponse.json({ error: "No client" }, { status: 400 });

  const planAccess = await getClientPlanAccess(clientId);
  return NextResponse.json(planAccess);
}
