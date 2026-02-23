import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";

interface HCPCustomer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
}

interface HCPSearchResponse {
  customers: HCPCustomer[];
  total_items: number;
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
    const accessToken = await getValidToken(client_id, "housecallpro");

    const searchRes = await fetch(
      `https://api.housecallpro.com/pro/v1/customers?phone=${encodeURIComponent(caller_phone_number)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!searchRes.ok) {
      throw new Error(`Housecall Pro search failed: ${searchRes.status}`);
    }

    const searchData: HCPSearchResponse = await searchRes.json();

    if (searchData.customers.length > 0) {
      const customer = searchData.customers[0];

      return NextResponse.json({
        found: true,
        contact_id: customer.id,
        caller_name: [customer.first_name, customer.last_name]
          .filter(Boolean)
          .join(" ") || null,
        company: customer.company || null,
        email: customer.email || null,
      });
    }

    return NextResponse.json({ found: false });
  } catch (err) {
    console.error("Housecall Pro lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up caller" },
      { status: 500 }
    );
  }
}
