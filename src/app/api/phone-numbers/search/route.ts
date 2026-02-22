import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getTwilioClient } from "@/lib/twilio";

export async function GET(request: NextRequest) {
  const { response } = await requireAuth();
  if (response) return response;

  const client = getTwilioClient();
  if (!client) {
    return NextResponse.json(
      { error: "Twilio is not configured" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const areaCode = url.searchParams.get("areaCode") || undefined;
  const tollFree = url.searchParams.get("tollFree") === "true";

  try {
    let results;
    if (tollFree) {
      results = await client
        .availablePhoneNumbers("US")
        .tollFree.list({ limit: 20 });
    } else {
      results = await client
        .availablePhoneNumbers("US")
        .local.list({ areaCode: areaCode ? Number(areaCode) : undefined, limit: 20 });
    }

    const numbers = results.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      capabilities: n.capabilities,
    }));

    return NextResponse.json(numbers);
  } catch (err) {
    console.error("Twilio search error:", err);
    return NextResponse.json(
      { error: "Failed to search phone numbers" },
      { status: 500 }
    );
  }
}
