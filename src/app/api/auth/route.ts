import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  const supabase = await createClient();

  switch (action) {
    case "sign-in": {
      const { email, password } = body;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return NextResponse.json({ error: error.message }, { status: 401 });
      return NextResponse.json({ user: data.user });
    }

    case "sign-up": {
      const { email, password, fullName, role } = body;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: role || "startup_admin" },
        },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ user: data.user });
    }

    case "sign-out": {
      await supabase.auth.signOut();
      return NextResponse.json({ success: true });
    }

    case "reset-password": {
      const { email } = body;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    case "invite-member": {
      const { email, role, organization_id } = body;

      if (!email || !role || !organization_id) {
        return NextResponse.json(
          { error: "Email, role, and organization_id are required" },
          { status: 400 }
        );
      }

      if (!["startup_admin", "startup_member"].includes(role)) {
        return NextResponse.json(
          { error: "Role must be startup_admin or startup_member" },
          { status: 400 }
        );
      }

      // Verify the requesting user is authenticated and belongs to the org
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: requestingUser, error: userError } = await supabase
        .from("users")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (userError || !requestingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (requestingUser.organization_id !== organization_id) {
        return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
      }

      if (requestingUser.role !== "startup_admin") {
        return NextResponse.json(
          { error: "Only admins can invite members" },
          { status: 403 }
        );
      }

      // Use service client for admin operations
      const serviceClient = await createServiceClient();

      // Invite user via Supabase Auth admin API
      const { data: inviteData, error: inviteError } =
        await serviceClient.auth.admin.inviteUserByEmail(email, {
          data: { role },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        });

      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 });
      }

      // Create the user row in the users table
      const { error: insertError } = await serviceClient
        .from("users")
        .upsert(
          {
            id: inviteData.user.id,
            email: email,
            organization_id: organization_id,
            role: role,
          },
          { onConflict: "id" }
        );

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        user: { id: inviteData.user.id, email },
      });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
