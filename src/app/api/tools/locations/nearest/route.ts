import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { zip_code, city } = body;

  if (!client_id) {
    return NextResponse.json(
      { error: "client_id is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    let query = supabase
      .from("business_locations")
      .select("name, address, phone, is_primary")
      .eq("client_id", client_id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("sort_order");

    const { data: locations } = await query;

    // If zip_code or city provided, filter by address text match
    let filtered = locations || [];
    if (zip_code) {
      const matching = filtered.filter((l) => l.address?.includes(zip_code));
      if (matching.length > 0) filtered = matching;
    } else if (city) {
      const cityLower = city.toLowerCase();
      const matching = filtered.filter((l) =>
        l.address?.toLowerCase().includes(cityLower)
      );
      if (matching.length > 0) filtered = matching;
    }

    return NextResponse.json({
      locations: filtered.slice(0, 5),
      count: filtered.length,
    });
  } catch (err) {
    console.error("Locations lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up locations" },
      { status: 500 }
    );
  }
}
