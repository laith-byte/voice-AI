import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

/**
 * Sanitize custom CSS to prevent stored XSS.
 * Strips dangerous patterns: expression(), javascript: URLs, -moz-binding,
 * behavior, and @import with external URLs.
 */
function sanitizeCustomCss(css: string): string {
  let sanitized = css;

  // Remove expression() — IE CSS expression injection
  sanitized = sanitized.replace(/expression\s*\(/gi, "/* blocked */");

  // Remove javascript: URLs inside url()
  sanitized = sanitized.replace(/url\s*\(\s*(['"]?\s*)javascript\s*:/gi, "url($1/* blocked */");

  // Remove -moz-binding (XBL-based XSS in older Firefox)
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, "/* blocked */:");

  // Remove behavior (IE .htc component injection)
  sanitized = sanitized.replace(/behavior\s*:/gi, "/* blocked */:");

  // Remove @import with external URLs (prevents loading external stylesheets)
  // Allow @import with relative paths but block http://, https://, //, data:
  sanitized = sanitized.replace(
    /@import\s+(?:url\s*\()?\s*['"]?\s*(?:https?:|\/\/|data:)/gi,
    "/* blocked @import */"
  );

  // Remove any remaining data: URLs inside url()
  sanitized = sanitized.replace(/url\s*\(\s*(['"]?\s*)data\s*:/gi, "url($1/* blocked */");

  // Remove </style> tags that could break out of style context
  sanitized = sanitized.replace(/<\/?\s*style/gi, "/* blocked */");

  // Remove event handlers that could sneak in via CSS parsing
  sanitized = sanitized.replace(/<\s*script/gi, "/* blocked */");

  return sanitized;
}

function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const ALLOWED_FIELDS = new Set([
  "description",
  "widget_layout",
  "agent_image_url",
  "background_image_url",
  "launcher_image_url",
  "google_font_name",
  "color_preset",
  "custom_css",
  "autolaunch_popup",
  "launch_message",
  "launch_message_enabled",
  "popup_message",
  "popup_message_enabled",
  "terms_of_service_url",
  "privacy_policy_url",
]);

const URL_FIELDS = new Set([
  "agent_image_url",
  "background_image_url",
  "launcher_image_url",
  "terms_of_service_url",
  "privacy_policy_url",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", agentId).single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("widget_config")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data || null);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", agentId).single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();

  // Only allow safe fields
  const safeBody: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      safeBody[key] = body[key];
    }
  }

  // Validate URL fields
  for (const field of URL_FIELDS) {
    if (safeBody[field] && typeof safeBody[field] === "string" && !isValidUrl(safeBody[field] as string)) {
      return NextResponse.json({ error: `Invalid URL for ${field}` }, { status: 400 });
    }
  }

  // Sanitize custom_css to prevent stored XSS
  if (typeof safeBody.custom_css === "string" && safeBody.custom_css) {
    safeBody.custom_css = sanitizeCustomCss(safeBody.custom_css as string);
  }

  // Upsert the widget config
  const upsertData = {
    ...safeBody,
    agent_id: agentId,
    ...(body.id ? { id: body.id } : {}),
  };

  const { data, error } = await supabase
    .from("widget_config")
    .upsert(upsertData)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
