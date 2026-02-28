import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { caller_phone, rating, comment, agent_id } = body;

  if (!caller_phone || !rating) {
    return NextResponse.json(
      { error: "client_id, caller_phone, and rating are required" },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    const { data: feedback, error } = await supabase
      .from("call_feedback")
      .insert({
        client_id,
        agent_id: agent_id || null,
        caller_phone,
        rating,
        comment: comment || null,
      })
      .select("id, rating")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      feedback_id: feedback?.id,
      message: "Thank you for your feedback",
    });
  } catch (err) {
    console.error("Feedback collect error:", err);
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    );
  }
}
