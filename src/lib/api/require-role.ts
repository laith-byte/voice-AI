import { requireAuth } from "@/lib/api/auth";
import { NextResponse } from "next/server";

export async function requireRole(allowedRoles: string[]) {
  const { user, supabase, response } = await requireAuth();
  if (response) return { user, supabase, response };

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (!data || !allowedRoles.includes(data.role)) {
    return {
      user,
      supabase,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, supabase, response: null };
}
