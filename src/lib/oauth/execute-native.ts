import { executeGoogleSheets } from "@/lib/oauth/executors/google-sheets";
import { executeSlack } from "@/lib/oauth/executors/slack";
import { executeHubSpot } from "@/lib/oauth/executors/hubspot";

export async function executeNativeRecipe(
  provider: string,
  callLog: Record<string, unknown>,
  clientId: string,
  config: Record<string, unknown>
): Promise<void> {
  switch (provider) {
    case "google-sheets":
      return executeGoogleSheets(callLog as never, clientId, config);
    case "slack":
      return executeSlack(callLog as never, clientId, config);
    case "hubspot":
      return executeHubSpot(callLog as never, clientId, config);
    case "google-calendar":
      // Calendar is real-time only (mid-call), no post-call executor
      return;
    default:
      throw new Error(`Unknown native provider: ${provider}`);
  }
}
