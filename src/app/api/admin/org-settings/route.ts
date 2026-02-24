import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function PUT(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();

  const { error } = await supabase
    .from("organization_settings")
    .upsert(
      {
        organization_id: userData.organization_id,
        payment_success_redirect_url:
          typeof body.payment_success_redirect_url === "string"
            ? body.payment_success_redirect_url.trim() || null
            : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
