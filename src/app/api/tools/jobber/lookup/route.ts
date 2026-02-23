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
  const { caller_phone_number } = body;

  if (!client_id || !caller_phone_number) {
    return NextResponse.json(
      { error: "client_id and caller_phone_number are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "jobber");

    const result = await jobberGraphQL(
      accessToken,
      `query($searchTerm: String!) { clients(searchTerm: $searchTerm) { nodes { id name { full } phones { number } emails { address } companyName } } }`,
      { searchTerm: caller_phone_number }
    );

    const nodes = (result.data?.clients as { nodes: { id: string; name: { full: string }; phones: { number: string }[]; emails: { address: string }[]; companyName: string | null }[] })?.nodes || [];

    if (nodes.length > 0) {
      const client = nodes[0];
      return NextResponse.json({
        found: true,
        contact_id: client.id,
        caller_name: client.name?.full || null,
        company: client.companyName || null,
        email: client.emails?.[0]?.address || null,
      });
    }

    return NextResponse.json({ found: false });
  } catch (err) {
    console.error("Jobber lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up caller" },
      { status: 500 }
    );
  }
}
