import { createServiceClient } from "@/lib/supabase/server";

export async function dispatchZapierEvent(
  clientId: string,
  event: string,
  payload: Record<string, unknown>
) {
  const supabase = await createServiceClient();

  // Fetch active subscriptions matching event
  const { data: subs } = await supabase
    .from("zapier_subscriptions")
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

      // Deactivate on 410 Gone (Zapier unsubscribed)
      if (res.status === 410) {
        await supabase
          .from("zapier_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      }
    } catch (err) {
      console.error(`Zapier dispatch failed for sub ${sub.id}:`, err);
    }
  }
}
