// Seed script — generates flow nodes + prompt templates for all agent_templates and stores them in Supabase.
// Run with: npx tsx scripts/seed-flow-templates.ts
//
// Idempotent: re-running overwrites default_flow_nodes, agent_name, and prompt_template with the latest values.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generateTemplateNodes, AGENT_NAMES } from "../src/lib/conversation-flow-templates";
import { generateFlowPromptTemplate, generateFirstMessageTemplate } from "../src/lib/prompt-templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Legacy templates that were created before the industry/use_case columns existed.
// Map them to the correct industry + use_case so they get prompt templates too.
const LEGACY_TEMPLATE_MAPPING: Record<string, { industry: string; use_case: string }> = {
  "Dental Office": { industry: "healthcare", use_case: "receptionist" },
  "Legal Practice": { industry: "legal", use_case: "receptionist" },
  "Real Estate Agency": { industry: "real_estate", use_case: "lead_qualification" },
  "General Business": { industry: "retail", use_case: "receptionist" },
  "HVAC Service": { industry: "home_services", use_case: "dispatch" },
};

// Node types that generate tools at deploy time
const TOOL_NODE_TYPES = new Set([
  "crm_lookup",
  "check_availability",
  "book_appointment",
  "transfer",
  "end",
  "webhook",
  "request_callback",
]);

async function seed() {
  console.log("Fetching all agent_templates...");

  const { data: templates, error } = await supabase
    .from("agent_templates")
    .select("id, industry, use_case, name");

  if (error) {
    console.error("Failed to fetch templates:", error.message);
    process.exit(1);
  }

  if (!templates || templates.length === 0) {
    console.log("No templates found in agent_templates table.");
    return;
  }

  console.log(`Found ${templates.length} templates. Generating flow nodes + prompt templates...\n`);

  let updated = 0;
  let skipped = 0;

  for (const tmpl of templates) {
    let { id, industry, use_case, name } = tmpl;

    // Handle legacy templates without industry/use_case
    if (!industry || !use_case) {
      const legacy = LEGACY_TEMPLATE_MAPPING[name];
      if (legacy) {
        industry = legacy.industry;
        use_case = legacy.use_case;
        console.log(`  LEGACY ${name} → mapped to ${industry}/${use_case}`);
      } else {
        console.log(`  SKIP ${name} — missing industry or use_case (no legacy mapping)`);
        skipped++;
        continue;
      }
    }

    const nodes = generateTemplateNodes(industry, use_case);
    const agentName = AGENT_NAMES[`${industry}_${use_case}`] || null;
    const promptTemplate = generateFlowPromptTemplate(industry, use_case);
    const firstMessageTemplate = generateFirstMessageTemplate(industry, use_case);

    if (nodes.length === 0) {
      console.log(`  SKIP ${name} — generateTemplateNodes returned empty (industry=${industry}, use_case=${use_case})`);
      skipped++;
      continue;
    }

    // Count tool-generating node types
    const toolCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (TOOL_NODE_TYPES.has(node.type)) {
        toolCounts[node.type] = (toolCounts[node.type] || 0) + 1;
      }
    }
    const toolSummary = Object.entries(toolCounts)
      .map(([t, c]) => `${t}:${c}`)
      .join(", ") || "none";

    const updatePayload: Record<string, unknown> = {
      default_flow_nodes: nodes,
      agent_name: agentName,
      prompt_template: promptTemplate,
      first_message_template: firstMessageTemplate,
    };

    // For legacy templates, try to backfill industry + use_case columns.
    // This may fail if a non-legacy template with the same combo already exists
    // (unique constraint on industry/use_case). In that case, we still update
    // the other fields without setting industry/use_case.
    const isLegacy = !tmpl.industry || !tmpl.use_case;
    if (isLegacy) {
      updatePayload.industry = industry;
      updatePayload.use_case = use_case;
    }

    let { error: updateErr } = await supabase
      .from("agent_templates")
      .update(updatePayload)
      .eq("id", id);

    // If legacy backfill hit a unique constraint, retry without industry/use_case
    if (updateErr && isLegacy && updateErr.message.includes("unique constraint")) {
      delete updatePayload.industry;
      delete updatePayload.use_case;
      const retry = await supabase
        .from("agent_templates")
        .update(updatePayload)
        .eq("id", id);
      updateErr = retry.error;
      if (!retry.error) {
        console.log(`    (industry/use_case not set — duplicate exists)`);
      }
    }

    if (updateErr) {
      console.error(`  ERROR ${name}:`, updateErr.message);
    } else {
      console.log(`  OK ${name} — ${nodes.length} nodes, agent=${agentName}, tools=[${toolSummary}], prompt=${promptTemplate.length} chars, firstMsg=${firstMessageTemplate.length} chars`);
      updated++;
    }
  }

  console.log(`\nUpdated: ${updated}, Skipped: ${skipped}, Total: ${templates.length}`);

  // ── Verification pass ──────────────────────────────────────────────────
  console.log("\n--- Verification ---\n");

  const { data: allTemplates, error: verifyErr } = await supabase
    .from("agent_templates")
    .select("id, name, industry, use_case, default_flow_nodes, prompt_template, first_message_template");

  if (verifyErr) {
    console.error("Verification fetch failed:", verifyErr.message);
    process.exit(1);
  }

  let warnings = 0;

  for (const t of allTemplates || []) {
    const issues: string[] = [];

    // Check flow nodes
    const nodes = t.default_flow_nodes as Array<{ type: string; data?: { text?: string } }> | null;
    if (!nodes || nodes.length === 0) {
      issues.push("no flow nodes");
    } else {
      const hasContent = nodes.some((n) => n.data?.text && n.data.text.length > 50);
      if (!hasContent) {
        issues.push("no node with data.text > 50 chars");
      }
    }

    // Check prompt template
    if (!t.prompt_template || t.prompt_template.length < 200) {
      issues.push(`prompt_template too short (${t.prompt_template?.length || 0} chars)`);
    }

    // Check first message template
    if (!t.first_message_template || t.first_message_template.length < 20) {
      issues.push(`first_message_template too short (${t.first_message_template?.length || 0} chars)`);
    }

    if (issues.length > 0) {
      console.warn(`  WARN ${t.name}: ${issues.join("; ")}`);
      warnings++;
    } else {
      console.log(`  PASS ${t.name}`);
    }
  }

  console.log(`\nVerification complete. ${(allTemplates || []).length} templates checked, ${warnings} warnings.`);

  if (warnings > 0) {
    console.error("\nSome templates have issues — check warnings above.");
    process.exit(1);
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
