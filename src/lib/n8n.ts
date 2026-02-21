import { createServiceClient } from "@/lib/supabase/server";

export async function dispatchN8nEvent(
  clientId: string,
  event: string,
  payload: Record<string, unknown>
) {
  const supabase = await createServiceClient();

  // Fetch active subscriptions matching event
  const { data: subs } = await supabase
    .from("n8n_subscriptions")
    .select("id, hook_url")
    .eq("client_id", clientId)
    .eq("event", event)
    .eq("is_active", true);

  if (!subs?.length) return;

  for (const sub of subs) {
    try {
      const res = await fetch(sub.hook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, ...payload }),
      });

      // Deactivate on 410 Gone (n8n unsubscribed)
      if (res.status === 410) {
        await supabase
          .from("n8n_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      }
    } catch (err) {
      console.error(`n8n dispatch failed for sub ${sub.id}:`, err);
    }
  }
}
