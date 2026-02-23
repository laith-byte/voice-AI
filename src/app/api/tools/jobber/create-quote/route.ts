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
  const { customer_name, customer_phone, service_type, notes } = body;

  if (!client_id || !customer_name || !customer_phone || !service_type) {
    return NextResponse.json(
      { error: "client_id, customer_name, customer_phone, and service_type are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "jobber");

    // Look up or create client
    const searchResult = await jobberGraphQL(
      accessToken,
      `query($searchTerm: String!) { clients(searchTerm: $searchTerm) { nodes { id } } }`,
      { searchTerm: customer_phone }
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

    // Create quote
    const quoteResult = await jobberGraphQL(
      accessToken,
      `mutation($input: QuoteCreateInput!) { quoteCreate(input: $input) { quote { id } userErrors { message } } }`,
      {
        input: {
          clientId: clientNodeId,
          title: `${service_type} - Quote via AI`,
          message: notes || `Quote for ${service_type}`,
        },
      }
    );

    const quote = quoteResult.data?.quoteCreate as { quote: { id: string } } | undefined;
    if (!quote?.quote?.id) {
      const errors = quoteResult.errors || (quoteResult.data?.quoteCreate as { userErrors: { message: string }[] })?.userErrors;
      console.error("Jobber quote creation failed:", errors);
      return NextResponse.json({ success: false, error: "Failed to create quote" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      quote_id: quote.quote.id,
    });
  } catch (err) {
    console.error("Jobber create-quote error:", err);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
