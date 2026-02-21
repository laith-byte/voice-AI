import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { createServiceClient } from "@/lib/supabase/server";

interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

interface SalesforceContact {
  Id: string;
  FirstName: string | null;
  LastName: string | null;
  Phone: string | null;
  Email: string | null;
  Account?: { Name: string } | null;
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
    const accessToken = await getValidToken(client_id, "salesforce");

    // Get instance URL from stored connection metadata
    const supabase = await createServiceClient();
    const { data: connection } = await supabase
      .from("oauth_connections")
      .select("provider_metadata")
      .eq("client_id", client_id)
      .eq("provider", "salesforce")
      .single();

    const instanceUrl = (connection?.provider_metadata as Record<string, string>)?.instance_url;
    if (!instanceUrl) {
      return NextResponse.json(
        { error: "Salesforce instance URL not found" },
        { status: 500 }
      );
    }

    // Search for contact by phone number (SOQL query)
    const safePhone = String(caller_phone_number).replace(/'/g, "\\'");
    const soql = `SELECT Id, FirstName, LastName, Phone, Email, Account.Name FROM Contact WHERE Phone = '${safePhone}' LIMIT 1`;
    const searchRes = await fetch(
      `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!searchRes.ok) {
      throw new Error(`Salesforce query failed: ${searchRes.status}`);
    }

    const searchData: SalesforceQueryResult<SalesforceContact> = await searchRes.json();

    if (searchData.totalSize > 0) {
      const contact = searchData.records[0];

      return NextResponse.json({
        found: true,
        contact_id: contact.Id,
        caller_name: [contact.FirstName, contact.LastName]
          .filter(Boolean)
          .join(" ") || null,
        company: contact.Account?.Name || null,
        email: contact.Email || null,
        last_interaction: null,
      });
    }

    return NextResponse.json({ found: false });
  } catch (err) {
    console.error("Salesforce lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up caller" },
      { status: 500 }
    );
  }
}
