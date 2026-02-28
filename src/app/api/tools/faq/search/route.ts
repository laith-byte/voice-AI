import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { query } = body;

  if (!query) {
    return NextResponse.json(
      { error: "client_id and query are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    const { data: faqs } = await supabase
      .from("business_faqs")
      .select("question, answer")
      .eq("client_id", client_id)
      .eq("is_active", true)
      .order("sort_order");

    // Simple text search - match query terms against question and answer
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t: string) => t.length > 2);

    const results = (faqs || [])
      .map((faq) => {
        const text = `${faq.question} ${faq.answer}`.toLowerCase();
        const score = terms.reduce(
          (s: number, term: string) => s + (text.includes(term) ? 1 : 0),
          0
        );
        return { ...faq, score };
      })
      .filter((faq) => faq.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ question, answer }) => ({ question, answer }));

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (err) {
    console.error("FAQ search error:", err);
    return NextResponse.json(
      { error: "Failed to search FAQs" },
      { status: 500 }
    );
  }
}
