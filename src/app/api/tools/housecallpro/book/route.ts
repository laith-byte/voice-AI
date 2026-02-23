import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";

const HCP_API_BASE = "https://api.housecallpro.com";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { customer_name, customer_phone, service_type, preferred_date, preferred_time, notes } = body;

  if (!client_id || !customer_name || !customer_phone || !service_type || !preferred_date || !preferred_time) {
    return NextResponse.json(
      { error: "client_id, customer_name, customer_phone, service_type, preferred_date, and preferred_time are required" },
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

    // Create the job
    const jobRes = await fetch(`${HCP_API_BASE}/pro/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: customerId,
        schedule: {
          start_date: preferred_date,
          start_time: preferred_time,
        },
        line_items: [
          {
            name: service_type,
            description: `${service_type} - booked via AI phone call`,
          },
        ],
        note: notes || "",
      }),
    });

    if (!jobRes.ok) {
      const errText = await jobRes.text();
      console.error("Housecall Pro job creation failed:", errText);
      return NextResponse.json(
        { success: false, error: "Failed to book job" },
        { status: 500 }
      );
    }

    const jobData = await jobRes.json();

    return NextResponse.json({
      success: true,
      job_id: jobData.id,
      scheduled_time: `${preferred_date} ${preferred_time}`,
    });
  } catch (err) {
    console.error("Housecall Pro book error:", err);
    return NextResponse.json(
      { error: "Failed to book job" },
      { status: 500 }
    );
  }
}
