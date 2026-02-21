import { executeGoogleSheets } from "@/lib/oauth/executors/google-sheets";
import { executeSlack } from "@/lib/oauth/executors/slack";
import { executeHubSpot } from "@/lib/oauth/executors/hubspot";
import { executeNotion } from "@/lib/oauth/executors/notion";
import { executeTwilioSms } from "@/lib/oauth/executors/twilio-sms";
import { executeQuickBooks } from "@/lib/oauth/executors/quickbooks";
import { executeSalesforce } from "@/lib/oauth/executors/salesforce";
import { executeGoHighLevel } from "@/lib/oauth/executors/gohighlevel";

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
    case "calendly":
      // Calendly is real-time only (mid-call), no post-call executor
      return;
    case "notion":
      return executeNotion(callLog as never, clientId, config);
    case "twilio-sms":
      return executeTwilioSms(callLog as never, clientId, config);
    case "quickbooks":
      return executeQuickBooks(callLog as never, clientId, config);
    case "salesforce":
      return executeSalesforce(callLog as never, clientId, config);
    case "gohighlevel":
      return executeGoHighLevel(callLog as never, clientId, config);
    default:
      throw new Error(`Unknown native provider: ${provider}`);
  }
}
