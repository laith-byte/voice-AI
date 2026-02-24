import { createServiceClient } from "@/lib/supabase/server";
import { executeNativeRecipe } from "@/lib/oauth/execute-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CallLog {
  id: string;
  retell_call_id: string;
  client_id: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  summary: string | null;
  transcript: unknown;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  post_call_analysis: unknown;
  metadata: Record<string, unknown> | null;
  tags?: string[] | null;
}

interface ClientAutomation {
  id: string;
  client_id: string;
  recipe_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  trigger_count: number;
  error_count: number;
  automation_recipes: {
    id: string;
    name: string;
    n8n_webhook_url: string | null;
    execution_type: string | null;
    provider: string | null;
  };
}

// ---------------------------------------------------------------------------
// Main executor — called from the Retell webhook handler
// ---------------------------------------------------------------------------

export async function executeRecipes(
  callLog: CallLog,
  clientId: string
) {
  const supabase = await createServiceClient();

  // 1. Fetch all enabled automations for this client with recipe details
  const { data: automations } = await supabase
    .from("client_automations")
    .select("*, automation_recipes(id, name, n8n_webhook_url, execution_type, provider)")
    .eq("client_id", clientId)
    .eq("is_enabled", true);

  if (!automations?.length) return;

  // 2. For each enabled automation, execute based on type
  for (const automation of automations as ClientAutomation[]) {
    const recipe = automation.automation_recipes;
    const config = automation.config;
    const executionType = recipe.execution_type || "webhook";

    // Check trigger filter if present in config
    if (config.trigger) {
      const triggerStr = config.trigger as string;
      if (triggerStr === "Completed only" && callLog.status !== "completed") continue;
      if (triggerStr === "Missed only" && callLog.status !== "missed") continue;
      if (triggerStr === "Missed calls only" && callLog.status !== "missed") continue;
      if (triggerStr === "Completed calls only" && callLog.status !== "completed") continue;
    }

    try {
      if (executionType === "native" && recipe.provider) {
        // Native OAuth execution
        await executeNativeRecipe(
          recipe.provider,
          callLog as unknown as Record<string, unknown>,
          clientId,
          config
        );

        await logSuccess(supabase, automation);
      } else if (executionType === "webhook") {
        // Webhook execution — POST to configured URL
        const webhookUrl =
          (config.webhook_url as string) || recipe.n8n_webhook_url;
        if (!webhookUrl) continue;

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildWebhookPayload(callLog, config, recipe, clientId)),
        });

        if (response.ok) {
          await logSuccess(supabase, automation, response.status);
        } else {
          await logFailure(
            supabase,
            automation,
            `HTTP ${response.status}`,
            response.status
          );
        }
      } else if (executionType === "email") {
        // Email execution — handled by existing n8n webhook or future native email
        const webhookUrl = recipe.n8n_webhook_url;
        if (!webhookUrl) continue;

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildWebhookPayload(callLog, config, recipe, clientId)),
        });

        if (response.ok) {
          await logSuccess(supabase, automation, response.status);
        } else {
          await logFailure(
            supabase,
            automation,
            `HTTP ${response.status}`,
            response.status
          );
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await logFailure(supabase, automation, errorMessage);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWebhookPayload(
  callLog: CallLog,
  config: Record<string, unknown>,
  recipe: { id: string; name: string },
  clientId: string
) {
  return {
    call_id: callLog.retell_call_id,
    call_status: callLog.status,
    caller_number: callLog.from_number,
    called_number: callLog.to_number,
    direction: callLog.direction,
    duration_seconds: callLog.duration_seconds,
    summary: callLog.summary,
    transcript: callLog.transcript,
    recording_url: callLog.recording_url,
    started_at: callLog.started_at,
    ended_at: callLog.ended_at,
    post_call_analysis: callLog.post_call_analysis,
    tags: callLog.tags,
    metadata: callLog.metadata,
    client_config: config,
    client_id: clientId,
    recipe_id: recipe.id,
    recipe_name: recipe.name,
  };
}

async function logSuccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  automation: ClientAutomation,
  responseCode?: number
) {
  await supabase.from("automation_logs").insert({
    client_automation_id: automation.id,
    status: "success",
    response_code: responseCode ?? null,
  });

  await supabase
    .from("client_automations")
    .update({
      last_triggered_at: new Date().toISOString(),
      trigger_count: automation.trigger_count + 1,
    })
    .eq("id", automation.id);
}

async function logFailure(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  automation: ClientAutomation,
  errorMessage: string,
  responseCode?: number
) {
  await supabase.from("automation_logs").insert({
    client_automation_id: automation.id,
    status: "failed",
    error_message: errorMessage,
    response_code: responseCode ?? null,
  });

  await supabase
    .from("client_automations")
    .update({
      error_count: automation.error_count + 1,
      last_error: errorMessage,
    })
    .eq("id", automation.id);
}
