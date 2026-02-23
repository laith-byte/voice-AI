import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

// GET — List integration requests
// Clients see their own; admins see all for their org (filterable by ?status=)
export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("role, client_id, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  const isAdmin = userData.role?.startsWith("startup_");

  let query = supabase
    .from("integration_requests")
    .select("*, clients(name), automation_recipes(name, icon)")
    .order("created_at", { ascending: false });

  if (isAdmin) {
    query = query.eq("organization_id", userData.organization_id);
  } else {
    query = query.eq("client_id", userData.client_id);
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: requests, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: requests || [] });
}

// POST — Create a new integration request
export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("role, client_id")
    .eq("id", user!.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const clientId = userData.client_id;
  if (!clientId) {
    return NextResponse.json({ error: "No client associated" }, { status: 400 });
  }

  // Look up organization_id from clients table
  const { data: client } = await supabase
    .from("clients")
    .select("organization_id, name")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const { request_type, recipe_id, metadata } = body;

  if (!request_type || !["integration", "phone_number"].includes(request_type)) {
    return NextResponse.json({ error: "Invalid request_type" }, { status: 400 });
  }

  if (request_type === "integration" && !recipe_id) {
    return NextResponse.json({ error: "recipe_id required for integration requests" }, { status: 400 });
  }

  const { data: newRequest, error: insertError } = await supabase
    .from("integration_requests")
    .insert({
      client_id: clientId,
      organization_id: client.organization_id,
      request_type,
      recipe_id: recipe_id || null,
      metadata: metadata || {},
      requested_by: user!.id,
    })
    .select("*, automation_recipes(name, icon)")
    .single();

  if (insertError) {
    // Check for duplicate pending request
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "A pending request already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Send email notification to all startup_admin users in the org
  // Use service client to bypass RLS (client users can't read other users)
  try {
    const serviceClient = await createServiceClient();
    const { data: admins } = await serviceClient
      .from("users")
      .select("email")
      .eq("organization_id", client.organization_id)
      .like("role", "startup_%");

    if (admins && admins.length > 0) {
      const recipeName = newRequest.automation_recipes?.name;
      const requestLabel =
        request_type === "phone_number"
          ? "Phone Number Setup"
          : recipeName || "Integration";

      for (const admin of admins) {
        if (admin.email) {
          await sendEmail({
            to: admin.email,
            subject: `New Integration Request: ${requestLabel}`,
            html: `
              <h2>New Integration Request</h2>
              <p><strong>Client:</strong> ${client.name}</p>
              <p><strong>Request:</strong> ${requestLabel}</p>
              <p><strong>Type:</strong> ${request_type === "phone_number" ? "Phone Number" : "Integration"}</p>
              <p>Please log in to your admin dashboard to complete the setup.</p>
            `,
          });
        }
      }
    }
  } catch {
    // Email failure shouldn't block the request creation
    console.error("Failed to send notification email for integration request");
  }

  return NextResponse.json({ request: newRequest }, { status: 201 });
}
