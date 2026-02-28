import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Health check failed" },
      { status: 503 }
    );
  }
}
