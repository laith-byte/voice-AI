import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();
  const { phoneNumberId, callerIdName } = body;

  if (!phoneNumberId || !callerIdName) {
    return NextResponse.json(
      { error: "phoneNumberId and callerIdName are required" },
      { status: 400 }
    );
  }

  // Verify user owns the phone number
  const { data: phoneNumber, error: fetchErr } = await supabase
    .from("phone_numbers")
    .select("id, retell_number_id, organization_id")
    .eq("id", phoneNumberId)
    .single();

  if (fetchErr || !phoneNumber) {
    return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
  }

  // Update caller ID name and set status to pending
  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("phone_numbers")
    .update({
      caller_id_name: callerIdName,
      cnam_status: "pending",
    })
    .eq("id", phoneNumberId)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  // If Retell number, update the number's nickname via Retell API
  if (phoneNumber.retell_number_id) {
    const apiKey =
      (await getIntegrationKey(phoneNumber.organization_id, "retell")) ||
      process.env.RETELL_API_KEY;

    if (apiKey) {
      try {
        await fetch(
          `https://api.retellai.com/update-phone-number/${phoneNumber.retell_number_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ nickname: callerIdName }),
          }
        );
      } catch (err) {
        console.error("Failed to update Retell number nickname:", err);
      }
    }
  }

  return NextResponse.json(data);
}
