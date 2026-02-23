import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/oauth/token-manager";
import { jobberGraphQL } from "@/lib/oauth/executors/jobber";

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
    const accessToken = await getValidToken(client_id, "jobber");

    // Look up or create client
    const searchResult = await jobberGraphQL(
      accessToken,
      `{ clients(searchTerm: "${customer_phone}") { nodes { id } } }`
    );

    const existingClients = (searchResult.data?.clients as { nodes: { id: string }[] })?.nodes || [];
    let clientNodeId: string;

    if (existingClients.length > 0) {
      clientNodeId = existingClients[0].id;
    } else {
      const nameParts = customer_name.trim().split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "Customer";

      const createResult = await jobberGraphQL(
        accessToken,
        `mutation($input: ClientCreateInput!) { clientCreate(input: $input) { client { id } userErrors { message } } }`,
        {
          input: {
            firstName,
            lastName,
            phones: [{ number: customer_phone, description: "Mobile" }],
          },
        }
      );

      const created = createResult.data?.clientCreate as { client: { id: string } } | undefined;
      if (!created?.client?.id) {
        throw new Error("Failed to create Jobber client");
      }
      clientNodeId = created.client.id;
    }

    // Create job
    const startAt = `${preferred_date}T${preferred_time}:00Z`;
    const [hours, minutes] = preferred_time.split(":").map(Number);
    const endHour = hours + 1;
    const endAt = `${preferred_date}T${String(endHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`;

    const jobResult = await jobberGraphQL(
      accessToken,
      `mutation($input: JobCreateInput!) { jobCreate(input: $input) { job { id } userErrors { message } } }`,
      {
        input: {
          clientId: clientNodeId,
          title: `${service_type} - Booked by AI`,
          startAt,
          endAt,
          instructions: notes || `Service: ${service_type}`,
        },
      }
    );

    const job = jobResult.data?.jobCreate as { job: { id: string } } | undefined;
    if (!job?.job?.id) {
      const errors = jobResult.errors || (jobResult.data?.jobCreate as { userErrors: { message: string }[] })?.userErrors;
      console.error("Jobber job creation failed:", errors);
      return NextResponse.json({ success: false, error: "Failed to create job" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job_id: job.job.id,
    });
  } catch (err) {
    console.error("Jobber book error:", err);
    return NextResponse.json(
      { error: "Failed to book job" },
      { status: 500 }
    );
  }
}
