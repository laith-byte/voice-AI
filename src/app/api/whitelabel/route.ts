import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

/** PATCH /api/whitelabel — upsert branding & domain settings */
export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const orgId = userData.organization_id;

  // Branding upsert
  if (body.branding) {
    const { error } = await supabase
      .from("whitelabel_settings")
      .upsert(
        {
          organization_id: orgId,
          color_theme: body.branding.color_theme,
          loading_icon: body.branding.loading_icon,
          loading_icon_size: body.branding.loading_icon_size,
          website_title: body.branding.website_title,
          domain: body.branding.domain,
          backend_domain: body.branding.backend_domain,
          sending_domain: body.branding.sending_domain,
          sender_address: body.branding.sender_address,
          sender_name: body.branding.sender_name,
        },
        { onConflict: "organization_id" }
      );
    if (error) {
      console.error("DB error:", error.message);
      return NextResponse.json({ error: "Failed to save branding settings" }, { status: 500 });
    }
  }

  // Email template upsert
  if (body.email_template) {
    const { template_type, subject, greeting, body: templateBody } = body.email_template;

    // Check if template exists
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("template_type", template_type)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject,
          greeting,
          body: templateBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) {
        console.error("DB error:", error.message);
        return NextResponse.json({ error: "Failed to save email template" }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("email_templates")
        .insert({
          organization_id: orgId,
          template_type,
          subject,
          greeting,
          body: templateBody,
        });
      if (error) {
        console.error("DB error:", error.message);
        return NextResponse.json({ error: "Failed to save email template" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
