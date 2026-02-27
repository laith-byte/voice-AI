import { NextResponse } from "next/server";

interface ErrorBody {
  error: string;
  details?: string;
}

export function badRequest(message: string, details?: string) {
  const body: ErrorBody = { error: message };
  if (details) body.details = details;
  return NextResponse.json(body, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message } satisfies ErrorBody, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message } satisfies ErrorBody, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message } satisfies ErrorBody, { status: 404 });
}

export function serverError(message = "Internal server error", details?: string) {
  const body: ErrorBody = { error: message };
  if (details) body.details = details;
  return NextResponse.json(body, { status: 500 });
}
