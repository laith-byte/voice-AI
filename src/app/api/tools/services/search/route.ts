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
  const { query } = body;

  if (!client_id || !query) {
    return NextResponse.json(
      { error: "client_id and query are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    const { data: services } = await supabase
      .from("business_services")
      .select("name, description, price_text, duration_text")
      .eq("client_id", client_id)
      .eq("is_active", true)
      .order("sort_order");

    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t: string) => t.length > 2);

    const results = (services || [])
      .map((svc) => {
        const text = `${svc.name} ${svc.description || ""}`.toLowerCase();
        const score = terms.reduce(
          (s: number, term: string) => s + (text.includes(term) ? 1 : 0),
          0
        );
        return { ...svc, score };
      })
      .filter((svc) => svc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ name, description, price_text, duration_text }) => ({
        name,
        description,
        price: price_text,
        duration: duration_text,
      }));

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (err) {
    console.error("Services search error:", err);
    return NextResponse.json(
      { error: "Failed to search services" },
      { status: 500 }
    );
  }
}
