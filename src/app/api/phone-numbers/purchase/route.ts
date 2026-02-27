import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getTwilioClient } from "@/lib/twilio";
import { getIntegrationKey } from "@/lib/integrations";
import { RETELL_API_BASE } from "@/lib/retell";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const client = getTwilioClient();
  if (!client) {
    return NextResponse.json({ error: "Twilio is not configured" }, { status: 503 });
  }

  const body = await request.json();
  const { phoneNumber, clientId, agentId, businessName } = body;

  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();
  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const orgId = userData.organization_id;

  // Step 1: Buy via Twilio
  let twilioNumber;
  try {
    twilioNumber = await client.incomingPhoneNumbers.create({
      phoneNumber,
      friendlyName: businessName || phoneNumber,
    });
  } catch (err) {
    console.error("Twilio purchase error:", err);
    return NextResponse.json({ error: "Failed to purchase number from Twilio" }, { status: 500 });
  }

  const twilioSid = twilioNumber.sid;
  const warnings: string[] = [];

  // Step 2: Associate with SIP trunk
  const trunkSid = process.env.TWILIO_SIP_TRUNK_SID;
  if (trunkSid) {
    try {
      await client.trunking.v1
        .trunks(trunkSid)
        .phoneNumbers.create({ phoneNumberSid: twilioSid });
    } catch (err) {
      console.error("SIP trunk association error:", err);
      warnings.push("Failed to associate with SIP trunk");
    }
  }

  // Step 3: Import to Retell
  let retellNumberId: string | null = null;
  const retellApiKey = await getIntegrationKey(orgId, "retell") || process.env.RETELL_API_KEY;
  if (retellApiKey) {
    try {
      const retellBody: Record<string, unknown> = {
        phone_number: phoneNumber,
      };

      const terminationUri = process.env.TWILIO_SIP_TERMINATION_URI;
      const sipUsername = process.env.TWILIO_SIP_USERNAME;
      const sipPassword = process.env.TWILIO_SIP_PASSWORD;

      if (terminationUri) retellBody.termination_uri = terminationUri;
      if (sipUsername) retellBody.sip_trunk_auth_username = sipUsername;
      if (sipPassword) retellBody.sip_trunk_auth_password = sipPassword;

      // If agent specified, look up its retell_agent_id
      if (agentId) {
        const { data: agentData } = await supabase
          .from("agents")
          .select("retell_agent_id")
          .eq("id", agentId)
          .single();
        if (agentData?.retell_agent_id) {
          retellBody.inbound_agent_id = agentData.retell_agent_id;
          retellBody.outbound_agent_id = agentData.retell_agent_id;
        }
      }

      const retellRes = await fetch(`${RETELL_API_BASE}/import-phone-number`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(retellBody),
      });

      if (retellRes.ok) {
        const retellData = await retellRes.json();
        retellNumberId = retellData.phone_number || phoneNumber;
      } else {
        const retellErr = await retellRes.text();
        console.error("Retell import error:", retellErr);
        // Rollback: release the Twilio number since Retell import failed
        try {
          await client.incomingPhoneNumbers(twilioNumber.sid).remove();
          warnings.push("Failed to import to Retell — Twilio number was released");
        } catch (releaseError) {
          console.error("Failed to release Twilio number after Retell import failure:", releaseError);
          warnings.push("Failed to import to Retell — Twilio number could not be released (orphaned)");
        }
      }
    } catch (err) {
      console.error("Retell import error:", err);
      // Rollback: release the Twilio number since Retell import failed
      try {
        await client.incomingPhoneNumbers(twilioNumber.sid).remove();
        warnings.push("Failed to import to Retell — Twilio number was released");
      } catch (releaseError) {
        console.error("Failed to release Twilio number after Retell import failure:", releaseError);
        warnings.push("Failed to import to Retell — Twilio number could not be released (orphaned)");
      }
    }
  }

  // Step 4: Register with Hiya
  const hiyaAppId = process.env.HIYA_APP_ID;
  const hiyaAppSecret = process.env.HIYA_APP_SECRET;
  if (hiyaAppId && hiyaAppSecret && businessName) {
    try {
      const hiyaRes = await fetch("https://api.hiya.com/v1/numbers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Id": hiyaAppId,
          "X-App-Secret": hiyaAppSecret,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          display_name: businessName,
        }),
      });
      if (!hiyaRes.ok) {
        const hiyaErr = await hiyaRes.text();
        console.error("Hiya registration error:", hiyaErr);
        warnings.push("Failed to register with Hiya");
      }
    } catch (err) {
      console.error("Hiya registration error:", err);
      warnings.push("Failed to register with Hiya");
    }
  }

  // Step 5: Store locally
  const { data, error } = await supabase
    .from("phone_numbers")
    .insert({
      organization_id: orgId,
      number: phoneNumber,
      twilio_sid: twilioSid,
      retell_number_id: retellNumberId,
      client_id: clientId || null,
      agent_id: agentId || null,
      type: "standard",
      caller_id_name: businessName || null,
      caller_id_verified: false,
      cnam_status: "none",
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "Failed to save phone number" }, { status: 500 });
  }

  return NextResponse.json({ ...data, warnings }, { status: 201 });
}
