import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { createServiceClient } from "@/lib/supabase/server";

interface GHLContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
}

interface GHLSearchResponse {
  contacts: GHLContact[];
  total: number;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { caller_phone_number } = body;

  if (!client_id || !caller_phone_number) {
    return NextResponse.json(
      { error: "client_id and caller_phone_number are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "gohighlevel");

    // Get location ID from stored connection metadata
    const supabase = await createServiceClient();
    const { data: connection } = await supabase
      .from("oauth_connections")
      .select("provider_metadata")
      .eq("client_id", client_id)
      .eq("provider", "gohighlevel")
      .single();

    const locationId = (connection?.provider_metadata as Record<string, string>)?.location_id;
    if (!locationId) {
      return NextResponse.json(
        { error: "GoHighLevel location_id not found" },
        { status: 500 }
      );
    }

    // Search for contact by phone number
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(caller_phone_number)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      }
    );

    if (!searchRes.ok) {
      throw new Error(`GoHighLevel search failed: ${searchRes.status}`);
    }

    const searchData: GHLSearchResponse = await searchRes.json();

    if (searchData.contacts.length > 0) {
      const contact = searchData.contacts[0];

      return NextResponse.json({
        found: true,
        contact_id: contact.id,
        caller_name: [contact.firstName, contact.lastName]
          .filter(Boolean)
          .join(" ") || null,
        company: contact.companyName || null,
        email: contact.email || null,
        last_interaction: null,
      });
    }

    return NextResponse.json({ found: false });
  } catch (err) {
    console.error("GoHighLevel lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up caller" },
      { status: 500 }
    );
  }
}
