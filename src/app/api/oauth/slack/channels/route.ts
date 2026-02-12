import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { getValidToken } from "@/lib/oauth/token-manager";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  try {
    const accessToken = await getValidToken(clientId, "slack");
    const slack = new WebClient(accessToken);

    const res = await slack.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
    });

    const channels = (res.channels || []).map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private || false,
    }));

    return NextResponse.json({ channels });
  } catch (err) {
    console.error("Failed to list Slack channels:", err);
    return NextResponse.json(
      { error: "Failed to list channels" },
      { status: 500 }
    );
  }
}
