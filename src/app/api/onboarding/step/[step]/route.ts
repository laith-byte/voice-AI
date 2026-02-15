import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ step: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { step: stepStr } = await params;
  const step = parseInt(stepStr, 10);

  if (isNaN(step) || step < 1 || step > 6) {
    return NextResponse.json({ error: "Step must be between 1 and 6" }, { status: 400 });
  }

  // Fetch the current onboarding record
  const { data: onboarding, error: fetchError } = await supabase
    .from("client_onboarding")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (fetchError) {
    console.error("DB error:", fetchError.message);
    return NextResponse.json(
      { error: "Onboarding record not found. Please start onboarding first." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  // Build the onboarding update payload based on the step
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onboardingUpdate: Record<string, any> = {
    updated_at: now,
  };

  switch (step) {
    case 1: {
      // Save template selection
      if (body.vertical_template_id) {
        onboardingUpdate.vertical_template_id = body.vertical_template_id;
      }
      break;
    }

    case 2: {
      // Save business info to onboarding record
      if (body.business_name !== undefined) onboardingUpdate.business_name = body.business_name;
      if (body.business_phone !== undefined) onboardingUpdate.business_phone = body.business_phone;
      if (body.business_website !== undefined) onboardingUpdate.business_website = body.business_website;
      if (body.business_address !== undefined) onboardingUpdate.business_address = body.business_address;
      if (body.contact_name !== undefined) onboardingUpdate.contact_name = body.contact_name;
      if (body.contact_email !== undefined) onboardingUpdate.contact_email = body.contact_email;
      if (body.language !== undefined) onboardingUpdate.language = body.language;

      // Also create or update business_settings row
      const settingsPayload = {
        client_id: clientId,
        business_name: body.business_name || null,
        business_phone: body.business_phone || null,
        business_website: body.business_website || null,
        business_address: body.business_address || null,
        updated_at: now,
      };

      const { error: settingsError } = await supabase
        .from("business_settings")
        .upsert(settingsPayload, { onConflict: "client_id" });

      if (settingsError) {
        console.error("DB error (business_settings):", settingsError.message);
        return NextResponse.json({ error: "Failed to save business settings" }, { status: 500 });
      }
      break;
    }

    case 3: {
      // Business settings are saved directly via /api/business-settings routes.
      // Nothing extra to save here — just advance the step.
      break;
    }

    case 4: {
      // Save call handling / chat settings preferences to onboarding record
      if (body.after_hours_behavior !== undefined) onboardingUpdate.after_hours_behavior = body.after_hours_behavior;
      if (body.unanswerable_behavior !== undefined) onboardingUpdate.unanswerable_behavior = body.unanswerable_behavior;
      if (body.escalation_phone !== undefined) onboardingUpdate.escalation_phone = body.escalation_phone;
      if (body.max_call_duration_minutes !== undefined) onboardingUpdate.max_call_duration_minutes = body.max_call_duration_minutes;
      if (body.post_call_email_summary !== undefined) onboardingUpdate.post_call_email_summary = body.post_call_email_summary;
      if (body.post_call_log !== undefined) onboardingUpdate.post_call_log = body.post_call_log;
      if (body.post_call_followup_text !== undefined) onboardingUpdate.post_call_followup_text = body.post_call_followup_text;

      // Chat/SMS-specific fields
      if (body.chat_welcome_message !== undefined) onboardingUpdate.chat_welcome_message = body.chat_welcome_message;
      if (body.chat_offline_behavior !== undefined) onboardingUpdate.chat_offline_behavior = body.chat_offline_behavior;
      if (body.sms_phone_number !== undefined) onboardingUpdate.sms_phone_number = body.sms_phone_number;

      // Also update business_settings with call handling / chat fields
      const callSettingsPayload: Record<string, unknown> = { updated_at: now };
      if (body.after_hours_behavior !== undefined) callSettingsPayload.after_hours_behavior = body.after_hours_behavior;
      if (body.unanswerable_behavior !== undefined) callSettingsPayload.unanswerable_behavior = body.unanswerable_behavior;
      if (body.escalation_phone !== undefined) callSettingsPayload.escalation_phone = body.escalation_phone;
      if (body.max_call_duration_minutes !== undefined) callSettingsPayload.max_call_duration_minutes = body.max_call_duration_minutes;
      if (body.post_call_email_summary !== undefined) callSettingsPayload.post_call_email_summary = body.post_call_email_summary;
      if (body.post_call_log !== undefined) callSettingsPayload.post_call_log = body.post_call_log;
      if (body.post_call_followup_text !== undefined) callSettingsPayload.post_call_followup_text = body.post_call_followup_text;
      if (body.chat_welcome_message !== undefined) callSettingsPayload.chat_welcome_message = body.chat_welcome_message;
      if (body.chat_offline_behavior !== undefined) callSettingsPayload.chat_offline_behavior = body.chat_offline_behavior;

      const { error: callSettingsError } = await supabase
        .from("business_settings")
        .update(callSettingsPayload)
        .eq("client_id", clientId);

      if (callSettingsError) {
        console.error("DB error (business_settings):", callSettingsError.message);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
      }
      break;
    }

    case 5: {
      // Mark test call as completed
      if (body.test_call_completed !== undefined) {
        onboardingUpdate.test_call_completed = body.test_call_completed;
      }
      break;
    }

    case 6: {
      // Save phone number choice or chat widget deployment
      if (body.phone_number_option !== undefined) {
        onboardingUpdate.phone_number_option = body.phone_number_option;
      }
      if (body.chat_widget_deployed !== undefined) {
        onboardingUpdate.chat_widget_deployed = body.chat_widget_deployed;
      }
      break;
    }
  }

  // Advance current_step: only move forward, never backward
  const nextStep = Math.min(step + 1, 7); // 7 means "all steps complete"
  onboardingUpdate.current_step = Math.max(onboarding.current_step ?? 1, nextStep);

  // Update the onboarding record
  const { data: updated, error: updateError } = await supabase
    .from("client_onboarding")
    .update(onboardingUpdate)
    .eq("client_id", clientId)
    .select()
    .single();

  if (updateError) {
    console.error("DB error:", updateError.message);
    return NextResponse.json({ error: "Failed to update onboarding" }, { status: 500 });
  }

  return NextResponse.json(updated);
}
