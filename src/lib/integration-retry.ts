import { createServiceClient } from "@/lib/supabase/server";

// Backoff intervals in minutes: 1m, 5m, 15m, 60m, 240m
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

interface EnqueueRetryInput {
  clientId: string;
  provider: string;
  action: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * Enqueue a failed API call for retry with exponential backoff.
 */
export async function enqueueRetry(input: EnqueueRetryInput): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("integration_retry_queue").insert({
    client_id: input.clientId,
    provider: input.provider,
    action: input.action,
    payload: input.payload,
    max_attempts: input.maxAttempts || 5,
    attempt_count: 0,
    status: "pending",
    next_attempt_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to enqueue retry:", error);
  }
}

/**
 * Process pending items in the retry queue.
 * Called by the cron endpoint /api/cron/retry-queue.
 * Returns the number of items processed.
 */
export async function processRetryQueue(): Promise<number> {
  const supabase = await createServiceClient();

  // Fetch pending items whose next_attempt_at has passed
  const { data: items, error } = await supabase
    .from("integration_retry_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(50);

  if (error || !items?.length) return 0;

  let processed = 0;

  for (const item of items) {
    try {
      // Mark as processing
      await supabase
        .from("integration_retry_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", item.id);

      // Dynamic import of the executor based on provider
      const { executeNativeRecipe } = await import("@/lib/oauth/execute-native");

      await executeNativeRecipe(
        item.provider,
        item.payload as Record<string, unknown>,
        item.client_id,
        {}
      );

      // Mark as completed
      await supabase
        .from("integration_retry_queue")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      processed++;
    } catch (err) {
      const newAttempt = item.attempt_count + 1;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (newAttempt >= item.max_attempts) {
        // Move to dead letter
        await supabase
          .from("integration_retry_queue")
          .update({
            status: "dead_letter",
            attempt_count: newAttempt,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      } else {
        // Schedule next attempt with backoff
        const backoffMin = BACKOFF_MINUTES[Math.min(newAttempt - 1, BACKOFF_MINUTES.length - 1)];
        const nextAttempt = new Date(Date.now() + backoffMin * 60 * 1000);

        await supabase
          .from("integration_retry_queue")
          .update({
            status: "pending",
            attempt_count: newAttempt,
            last_error: errorMsg,
            next_attempt_at: nextAttempt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }

      processed++;
    }
  }

  return processed;
}
