import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/objects/notes/models/AssociationSpec";
import { getValidToken } from "@/lib/oauth/token-manager";

interface CallLog {
  id: string;
  retell_call_id: string;
  from_number: string | null;
  to_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  post_call_analysis: unknown;
}

export async function executeHubSpot(
  callLog: CallLog,
  clientId: string,
  _config: Record<string, unknown>
): Promise<void> {
  if (!callLog.from_number) return;

  const accessToken = await getValidToken(clientId, "hubspot");
  const hubspot = new Client({ accessToken });

  // Search for existing contact by phone
  const searchRes = await hubspot.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "phone",
            operator: FilterOperatorEnum.Eq,
            value: callLog.from_number,
          },
        ],
      },
    ],
    properties: ["firstname", "lastname", "phone"],
    limit: 1,
  });

  let contactId: string;

  if (searchRes.total > 0) {
    // Update existing contact
    contactId = searchRes.results[0].id;
    await hubspot.crm.contacts.basicApi.update(contactId, {
      properties: {
        notes_last_updated: new Date().toISOString(),
      },
    });
  } else {
    // Create new contact
    const createRes = await hubspot.crm.contacts.basicApi.create({
      properties: {
        phone: callLog.from_number,
        lifecyclestage: "lead",
      },
      associations: [],
    });
    contactId = createRes.id;
  }

  // Log the call as an engagement note
  const noteBody = [
    `AI Phone Call — ${callLog.status}`,
    `Duration: ${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`,
    callLog.summary && `Summary: ${callLog.summary}`,
    `Call ID: ${callLog.retell_call_id}`,
  ]
    .filter(Boolean)
    .join("\n");

  await hubspot.crm.objects.notes.basicApi.create({
    properties: {
      hs_timestamp: callLog.started_at || new Date().toISOString(),
      hs_note_body: noteBody,
    },
    associations: [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined,
            associationTypeId: 202, // note_to_contact
          },
        ],
      },
    ],
  });
}
