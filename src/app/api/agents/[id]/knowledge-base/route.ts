import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  // Verify agent exists and user has access
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted, organization_id")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify user belongs to same organization as the agent
  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData || userData.organization_id !== agent.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Fetch KB sources from our database
  const { data: sources, error: sourcesError } = await supabase
    .from("knowledge_base_sources")
    .select("*")
    .eq("agent_id", id)
    .order("created_at", { ascending: false });

  if (sourcesError) {
    return NextResponse.json({ error: "Failed to fetch knowledge base" }, { status: 500 });
  }

  return NextResponse.json(sources || []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted, organization_id")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify user belongs to same organization as the agent
  const { data: postUserData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!postUserData || postUserData.organization_id !== agent.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey =
    (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!retellApiKey) {
    return NextResponse.json({ error: "No Retell API key configured" }, { status: 500 });
  }

  const contentType = request.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  let source_type: string;
  let name: string;
  let content: string | undefined;
  let url: string | undefined;
  let enable_auto_refresh: boolean | undefined;
  let file: File | null = null;

  if (isMultipart) {
    const formData = await request.formData();
    source_type = formData.get("source_type") as string;
    name = formData.get("name") as string;
    content = (formData.get("content") as string) || undefined;
    url = (formData.get("url") as string) || undefined;
    file = formData.get("file") as File | null;
    const autoRefresh = formData.get("enable_auto_refresh");
    enable_auto_refresh = autoRefresh ? autoRefresh === "true" : undefined;
  } else {
    const body = await request.json();
    source_type = body.source_type;
    name = body.name;
    content = body.content;
    url = body.url;
    enable_auto_refresh = body.enable_auto_refresh;
  }

  if (!source_type || !name) {
    return NextResponse.json({ error: "source_type and name are required" }, { status: 400 });
  }

  try {
    // Upload to Retell Knowledge Base API
    let retellKbId: string | null = null;

    let retellError: string | null = null;

    if (source_type === "file" && file) {
      const formData = new FormData();
      formData.append("knowledge_base_name", name);
      formData.append("knowledge_base_files", file, file.name);
      if (enable_auto_refresh !== undefined) {
        formData.append("enable_auto_refresh", String(enable_auto_refresh));
      }

      const res = await fetch("https://api.retellai.com/create-knowledge-base", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
        },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        retellKbId = data.knowledge_base_id || null;
      } else {
        retellError = await res.text().catch(() => `HTTP ${res.status}`);
        console.error("Retell KB file upload failed:", retellError);
      }
    } else if (source_type === "text" && content) {
      const res = await fetch("https://api.retellai.com/create-knowledge-base", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledge_base_name: name,
          knowledge_base_texts: [{ title: name, text: content }],
          ...(enable_auto_refresh !== undefined && { enable_auto_refresh }),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        retellKbId = data.knowledge_base_id || null;
      } else {
        retellError = await res.text().catch(() => `HTTP ${res.status}`);
        console.error("Retell KB creation failed:", retellError);
      }
    } else if (source_type === "url" && url) {
      const res = await fetch("https://api.retellai.com/create-knowledge-base", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledge_base_name: name,
          knowledge_base_urls: [url],
          ...(enable_auto_refresh !== undefined && { enable_auto_refresh }),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        retellKbId = data.knowledge_base_id || null;
      } else {
        retellError = await res.text().catch(() => `HTTP ${res.status}`);
        console.error("Retell KB creation failed:", retellError);
      }
    }

    // Save to our database
    const { data: source, error: insertError } = await supabase
      .from("knowledge_base_sources")
      .insert({
        agent_id: id,
        source_type,
        name,
        content: content || null,
        url: url || null,
        retell_kb_id: retellKbId,
        status: retellKbId ? "active" : "pending",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to save knowledge base source" }, { status: 500 });
    }

    // Surface Retell error so frontend can show a warning
    if (retellError) {
      return NextResponse.json({
        ...source,
        warning: "Knowledge base saved locally but Retell sync failed. You can retry later.",
      });
    }

    return NextResponse.json(source);
  } catch {
    return NextResponse.json({ error: "Failed to create knowledge base source" }, { status: 500 });
  }
}
