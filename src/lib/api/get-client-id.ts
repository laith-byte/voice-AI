import { NextRequest, NextResponse } from "next/server";

export async function getClientId(
  user: { id: string },
  supabase: any,
  request: NextRequest
): Promise<{ clientId: string | null; error?: NextResponse }> {
  const { data: userData } = await supabase
    .from("users")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return { clientId: null, error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (userData.role?.startsWith("client_")) {
    return { clientId: userData.client_id };
  }

  // Startup admin — client_id from query param
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  if (!clientId) {
    return { clientId: null, error: NextResponse.json({ error: "client_id required" }, { status: 400 }) };
  }
  return { clientId };
}
