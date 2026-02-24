import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const { action } = body;

    // Look up the user's organization
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();

    if (userError || !dbUser?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const organizationId = dbUser.organization_id;

    switch (action) {
      case "upsert_connection": {
        const { stripe_account_id, is_connected } = body;
        if (!stripe_account_id || typeof is_connected !== "boolean") {
          return NextResponse.json(
            { error: "stripe_account_id and is_connected are required" },
            { status: 400 }
          );
        }

        const { error } = await supabase.from("stripe_connections").upsert(
          {
            organization_id: organizationId,
            stripe_account_id,
            is_connected,
          },
          { onConflict: "organization_id" }
        );

        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case "mark_connected": {
        const { error } = await supabase
          .from("stripe_connections")
          .update({
            is_connected: true,
            connected_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case "disconnect": {
        const { error } = await supabase
          .from("stripe_connections")
          .update({
            is_connected: false,
            stripe_account_id: null,
            connected_at: null,
          })
          .eq("organization_id", organizationId);

        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case "disconnect_keep_account": {
        const { error } = await supabase
          .from("stripe_connections")
          .update({ is_connected: false })
          .eq("organization_id", organizationId);

        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Stripe connections error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
