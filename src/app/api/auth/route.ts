import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  const body = await request.json();
  const { action } = body;

  const supabase = await createClient();

  switch (action) {
    case "sign-in": {
      const { email, password } = body;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      return NextResponse.json({ user: data.user });
    }

    case "sign-up": {
      const { email, password, fullName } = body;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: "startup_admin" },
        },
      });
      if (error) return NextResponse.json({ error: "Failed to create account" }, { status: 400 });
      return NextResponse.json({ user: data.user });
    }

    case "sign-out": {
      await supabase.auth.signOut();
      return NextResponse.json({ success: true });
    }

    case "reset-password": {
      const { email } = body;
      const serviceClient = await createServiceClient();
      const origin = request.nextUrl.origin;

      const { data: linkData } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${origin}/reset-password` },
      });

      if (linkData?.properties?.action_link) {
        await sendResetEmail(email, linkData.properties.action_link);
      }
      // Always return success to prevent email enumeration
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
      const origin = request.nextUrl.origin;

      // Generate invite link without sending Supabase's default email
      const { data: inviteData, error: inviteError } =
        await serviceClient.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            data: { role },
            redirectTo: `${origin}/auth/callback`,
          },
        });

      if (inviteError) {
        console.error("Invite error:", inviteError.message);
        return NextResponse.json({ error: "Failed to invite member" }, { status: 400 });
      }

      // Send custom invite email via Resend
      const actionLink = inviteData.properties?.action_link;
      if (actionLink) {
        await sendInviteEmail(email, role, actionLink);
      }

      // Create the user row in the users table
      const { error: insertError } = await serviceClient
        .from("users")
        .upsert(
          {
            id: inviteData.user.id,
            email: email,
            name: email.split("@")[0] || "New Member",
            organization_id: organization_id,
            role: role,
          },
          { onConflict: "id" }
        );

      if (insertError) {
        console.error("User insert error:", insertError.message);
        return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendResetEmail(to: string, actionLink: string) {
  try {
    await sendEmail({
      to,
      subject: "Reset Your Password — Invaria Labs",
      from: "Invaria Labs <noreply@invarialabs.com>",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Invaria Labs</span>
        </td></tr>
        <tr><td style="background-color:#1e293b;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:48px 40px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;">Reset Your Password</h1>
          <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.7);text-align:center;line-height:1.6;">
            We received a request to reset your password. Click the button below to choose a new one.
          </p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${actionLink}" style="display:inline-block;padding:14px 40px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">Reset Password</a>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 24px;"></div>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.5;">
            This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding-top:32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Invaria Labs &mdash; AI-Powered Phone Agents</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  } catch (err) {
    console.error("Failed to send reset email:", err);
  }
}

async function sendInviteEmail(to: string, role: string, actionLink: string) {
  const roleName = role === "startup_admin" ? "Admin" : "Team Member";
  try {
    await sendEmail({
      to,
      subject: "You've Been Invited to Invaria Labs",
      from: "Invaria Labs <noreply@invarialabs.com>",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Invaria Labs</span>
        </td></tr>
        <tr><td style="background-color:#1e293b;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:48px 40px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;">You're Invited!</h1>
          <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.7);text-align:center;line-height:1.6;">
            You've been invited to join Invaria Labs as a <strong style="color:#ffffff;">${escapeHtml(roleName)}</strong>. Click below to accept the invitation and set up your account.
          </p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${actionLink}" style="display:inline-block;padding:14px 40px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">Accept Invitation</a>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 24px;"></div>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.5;">
            This link expires in 24 hours. If you weren't expecting this invite, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding-top:32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Invaria Labs &mdash; AI-Powered Phone Agents</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }
}
