import { NextRequest, NextResponse } from "next/server";

const PLAN_ID_MAP: Record<string, string | undefined> = {
  starter: process.env.PLATFORM_PLAN_ID_STARTER,
  professional: process.env.PLATFORM_PLAN_ID_PROFESSIONAL,
};

export async function POST(request: NextRequest) {
  try {
    const { plan, billing_period } = await request.json();

    const planId = PLAN_ID_MAP[plan];
    if (!planId) {
      return NextResponse.json(
        { error: `Unknown plan: ${plan}` },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // Forward to the existing checkout endpoint internally
    const checkoutRes = await fetch(`${appUrl}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        billing_period,
        return_url: `${appUrl}/pricing`,
      }),
    });

    const data = await checkoutRes.json();

    if (!checkoutRes.ok) {
      return NextResponse.json(data, { status: checkoutRes.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Marketing checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
