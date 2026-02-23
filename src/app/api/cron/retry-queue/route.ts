import { NextRequest, NextResponse } from "next/server";
import { processRetryQueue } from "@/lib/integration-retry";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processed = await processRetryQueue();
    return NextResponse.json({
      message: "Retry queue processed",
      processed,
    });
  } catch (err) {
    console.error("Retry queue processing failed:", err);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
