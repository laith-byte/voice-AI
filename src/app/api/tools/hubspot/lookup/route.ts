import { NextRequest, NextResponse } from "next/server";
import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { getValidToken } from "@/lib/oauth/token-manager";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { caller_phone_number } = body;

  if (!caller_phone_number) {
    return NextResponse.json(
      { error: "client_id and caller_phone_number are required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidToken(client_id, "hubspot");
    const hubspot = new Client({ accessToken });

    // Search for contact by phone number
    const searchRes = await hubspot.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "phone",
              operator: FilterOperatorEnum.Eq,
              value: caller_phone_number,
            },
          ],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "company",
        "email",
        "phone",
        "notes_last_updated",
      ],
      limit: 1,
    });

    if (searchRes.total > 0) {
      const contact = searchRes.results[0];
      const props = contact.properties;

      return NextResponse.json({
        found: true,
        contact_id: contact.id,
        caller_name: [props.firstname, props.lastname]
          .filter(Boolean)
          .join(" ") || null,
        company: props.company || null,
        email: props.email || null,
        last_interaction: props.notes_last_updated || null,
      });
    }

    return NextResponse.json({ found: false });
  } catch (err) {
    console.error("HubSpot lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up caller" },
      { status: 500 }
    );
  }
}
