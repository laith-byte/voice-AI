import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

const HCP_API_BASE = "https://api.housecallpro.com";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { customer_name, customer_phone, service_type, notes } = body;

  if (!customer_name || !customer_phone || !service_type) {
    return NextResponse.json(
      { error: "client_id, customer_name, customer_phone, and service_type are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "housecallpro");

    // Look up or create customer
    const searchRes = await fetch(
      `${HCP_API_BASE}/pro/v1/customers?phone=${encodeURIComponent(customer_phone)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    let customerId: string;

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.customers && searchData.customers.length > 0) {
        customerId = searchData.customers[0].id;
      } else {
        // Create new customer
        const nameParts = customer_name.split(" ");
        const firstName = nameParts[0] || customer_name;
        const lastName = nameParts.slice(1).join(" ") || "";

        const createRes = await fetch(`${HCP_API_BASE}/pro/v1/customers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            phone_numbers: [{ number: customer_phone, type: "mobile" }],
            notifications_enabled: false,
            tags: ["ai-call"],
          }),
        });

        if (!createRes.ok) {
          throw new Error(`Housecall Pro customer creation failed: ${createRes.status}`);
        }

        const createData = await createRes.json();
        customerId = createData.id;
      }
    } else {
      throw new Error(`Housecall Pro customer search failed: ${searchRes.status}`);
    }

    // Create the estimate
    const estimateRes = await fetch(`${HCP_API_BASE}/pro/v1/estimates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: customerId,
        line_items: [
          {
            name: service_type,
            description: `${service_type} - estimate created via AI phone call`,
            unit_price: 0,
          },
        ],
        note: notes || "",
      }),
    });

    if (!estimateRes.ok) {
      const errText = await estimateRes.text();
      console.error("Housecall Pro estimate creation failed:", errText);
      return NextResponse.json(
        { success: false, error: "Failed to create estimate" },
        { status: 500 }
      );
    }

    const estimateData = await estimateRes.json();

    return NextResponse.json({
      success: true,
      estimate_id: estimateData.id,
    });
  } catch (err) {
    console.error("Housecall Pro create-estimate error:", err);
    return NextResponse.json(
      { error: "Failed to create estimate" },
      { status: 500 }
    );
  }
}
