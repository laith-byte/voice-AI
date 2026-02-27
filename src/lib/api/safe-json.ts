import { NextRequest, NextResponse } from "next/server";

export async function safeJson<T = unknown>(request: NextRequest): Promise<{ body: T; error: null } | { body: null; error: NextResponse }> {
  try {
    const body = await request.json();
    return { body: body as T, error: null };
  } catch {
    return { body: null, error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}
