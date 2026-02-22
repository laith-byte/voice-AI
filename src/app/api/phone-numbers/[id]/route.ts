import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getTwilioClient } from "@/lib/twilio";
import { getIntegrationKey } from "@/lib/integrations";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  // Look up the phone number record
  const { data: phoneRecord, error: lookupError } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("id", id)
    .single();

  if (lookupError || !phoneRecord) {
    return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
  }

  const warnings: string[] = [];

  // Release from Twilio if we have a twilio_sid
  if (phoneRecord.twilio_sid) {
    const client = getTwilioClient();
    if (client) {
      try {
        await client.incomingPhoneNumbers(phoneRecord.twilio_sid).remove();
      } catch (err) {
        console.error("Twilio release error:", err);
        warnings.push("Failed to release from Twilio");
      }
    }
  }

  // Delete from Retell if we have a retell_number_id
  if (phoneRecord.retell_number_id) {
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();

    if (userData) {
      const retellApiKey = await getIntegrationKey(userData.organization_id, "retell") || process.env.RETELL_API_KEY;
      if (retellApiKey) {
        try {
          const retellRes = await fetch(
            `https://api.retellai.com/delete-phone-number/${encodeURIComponent(phoneRecord.retell_number_id)}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${retellApiKey}` },
            }
          );
          if (!retellRes.ok) {
            const retellErr = await retellRes.text();
            console.error("Retell delete error:", retellErr);
            warnings.push("Failed to delete from Retell");
          }
        } catch (err) {
          console.error("Retell delete error:", err);
          warnings.push("Failed to delete from Retell");
        }
      }
    }
  }

  // Delete from local DB
  const { error: deleteError } = await supabase
    .from("phone_numbers")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("DB error:", deleteError.message);
    return NextResponse.json({ error: "Failed to delete phone number" }, { status: 500 });
  }

  return NextResponse.json({ success: true, warnings });
}
