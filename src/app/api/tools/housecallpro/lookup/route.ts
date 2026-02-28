import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

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
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { caller_phone_number } = body;

  if (!caller_phone_number) {
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
