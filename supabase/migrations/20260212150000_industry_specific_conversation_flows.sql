-- ============================================================
-- Fix systematic cross-industry contamination in conversation flows
-- Root cause: Addendum applied shared per-use-case flows without industry customization
-- Affects: 8 LQ flows + 8 LQ closings + 8 CS identity lines + 8 Dispatch emergency blocks
-- Plus: Home Services LQ missing Handlebars skeleton
-- ============================================================


-- ============================================================
-- FIX 1: HOME SERVICES LQ — Restore missing Handlebars skeleton
-- The addendum migration failed to preserve the skeleton for this template
-- ============================================================

UPDATE agent_templates
SET prompt_template = prompt_template || E'\nBUSINESS HOURS:\n{{#each business_hours}}\n{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}\n{{/each}}\n\nSERVICES WE OFFER:\n{{#each services}}\n- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price_text}} ({{price_text}}){{/if}}\n{{/each}}\n\nFREQUENTLY ASKED QUESTIONS:\n{{#each faqs}}\nQ: {{question}}\nA: {{answer}}\n{{/each}}\n\nPOLICIES:\n{{#each policies}}\n{{name}}: {{description}}\n{{/each}}\n\nCALL HANDLING RULES:\n- If the caller asks about something not covered above, {{unanswerable_behavior}}\n- If calling outside business hours, {{after_hours_behavior}}\n- Keep calls concise and under {{max_call_duration}} minutes\n- Always be warm, helpful, and professional\n- Never make up information — if unsure, {{unanswerable_behavior}}\n'
WHERE industry = 'home_services'
  AND use_case = 'lead_qualification'
  AND wizard_enabled = true
  AND prompt_template NOT LIKE '%BUSINESS HOURS:%';


-- ============================================================
-- FIX 2: LEAD QUALIFICATION — Industry-specific conversation flows (Steps 1-4)
-- Old: Generic "What type of service?" / "insurance type, property address, shipping volume"
-- New: Industry-customized questions, qualifiers, and expectations
-- ============================================================

DO $lq_flow_fix$
DECLARE
  old_flow TEXT := 'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"What type of service are you looking for?"
"Is this for yourself, your business, or someone else?"
"How soon are you looking to get started?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so we can match you with the right specialist."
- Name
- Phone number (confirm by repeating it back)
- Email (if appropriate)
- Any vertical-specific qualifier (insurance type, property address, shipping volume, etc.)

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — a specialist will review your information and reach out to you by [timeframe]. They will prepare a quote and discuss your options."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We look forward to helping you!"';

BEGIN

-- Healthcare LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"Are you a new patient or an existing patient?"
"What type of care are you looking for?"
"How soon do you need to be seen?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so we can get you scheduled."
- Name
- Phone number (confirm by repeating it back)
- Insurance provider and member ID (if applicable)
- Reason for visit (brief — do not ask for detailed medical history over the phone)

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — our scheduling team will review your information and call you back by [timeframe] to get you booked."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We look forward to seeing you!"')
WHERE industry = 'healthcare' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Financial Services LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}. How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"What brought you to {{business_name}} today — a referral, our website, or something else?"
"What area are you looking for help with — investing, retirement planning, tax strategy, or something else?"
"Is this for personal finances or a business?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so we can match you with the right advisor."
- Name
- Phone number (confirm by repeating it back)
- Email address
- General nature of what they are looking to accomplish (do NOT ask for account numbers, SSN, or specific dollar amounts)

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — an advisor will review your information and reach out within one business day to schedule a consultation."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We look forward to speaking with you!"')
WHERE industry = 'financial_services' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Insurance LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"Are you looking for a new policy, or do you have questions about an existing one?"
"What type of coverage are you interested in — auto, home, life, health, or business?"
"Is this for yourself, your family, or your business?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so we can match you with the right agent."
- Name
- Phone number (confirm by repeating it back)
- Type of coverage they are looking for
- Current coverage status (insured and switching, uninsured, or adding coverage)

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — a licensed agent will review your needs and reach out by [timeframe] with personalized options and rates."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We look forward to helping you find the right coverage!"')
WHERE industry = 'insurance' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Logistics LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"What type of shipment are you looking to move — freight, parcels, or specialized cargo?"
"Where is it shipping from and to?"
"What is your timeline — is this urgent or can it be scheduled?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so our logistics team can put together options for you."
- Name and company name
- Phone number (confirm by repeating it back)
- Shipment type and approximate volume or dimensions
- Origin, destination, and preferred timeline

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — a logistics coordinator will review your shipment details and reach out by [timeframe] with routing options and pricing."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We look forward to moving your shipment!"')
WHERE industry = 'logistics' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Home Services LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"What kind of work do you need done — is this a repair, installation, or maintenance?"
"Can you describe what is going on? The details help us send the right person."
"How urgent is this — is it an emergency, or can it wait a few days?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so we can get a specialist out to you."
- Name
- Phone number (confirm by repeating it back)
- Service address (may differ from their phone number area code)
- Whether they are the homeowner or a renter

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — a specialist will review your request and reach out by [timeframe] to schedule a free estimate."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We will get this taken care of for you!"')
WHERE industry = 'home_services' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Retail LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"Are you looking for a specific product, or do you need help finding the right one?"
"Is this for yourself or are you shopping for someone else?"
"Do you need this right away, or are you just browsing options?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Great, let me get a few details so our team can help you find exactly what you need."
- Name
- Phone number (confirm by repeating it back)
- Product or category they are interested in
- Any specific requirements (size, color, brand, budget range)

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — a product specialist will review your request and reach out by [timeframe] with availability and options."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We look forward to helping you find what you need!"')
WHERE industry = 'retail' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Travel & Hospitality LQ Flow
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — WARM OPEN (first 10 seconds):
"Thank you for calling {{business_name}}! How can I help you today?"
Let the caller explain what they need. Listen fully before responding.

STEP 2 — QUALIFY THE NEED (next 30-60 seconds):
Based on what they said, ask ONE clarifying question at a time:
"What kind of trip are you planning — leisure, business, or a special occasion?"
"Do you have a destination in mind, or are you open to suggestions?"
"When are you looking to travel?"
Do NOT rapid-fire questions. Have a conversation.

STEP 3 — CAPTURE INFORMATION (next 60-90 seconds):
Transition naturally: "Wonderful, let me get a few details so our travel specialist can put together personalized options for you."
- Name
- Phone number (confirm by repeating it back)
- Number of travelers (adults and children)
- Any special requirements (accessibility, dietary needs, celebrations, activities)

STEP 4 — SET EXPECTATIONS + CLOSE (final 30 seconds):
"Perfect. Here is what happens next — a travel specialist will review your preferences and reach out by [timeframe] with curated options based on exactly what you described."
- Confirm their phone number is the best number to reach them
- Ask: "Is there a best time for them to call?"
- "Is there anything else I can help you with before we wrap up?"
- "Thank you for calling {{business_name}}. We are excited to help plan your trip!"')
WHERE industry = 'travel_hospitality' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Debt Collection LQ Flow (completely different — compliance-driven, not sales-driven)
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_flow,
'STEP 1 — GREETING + MINI-MIRANDA (first 10 seconds):
"Thank you for calling {{business_name}}. This is an attempt to collect a debt and any information obtained will be used for that purpose. How can I help you?"
Let the caller explain why they are calling. Listen fully before responding.

STEP 2 — IDENTIFY THE CALLER (next 30-60 seconds):
Based on what they said, determine their purpose:
"Do you have a reference number from the notice you received?"
"For security, can I verify your identity with your date of birth or the last four digits of your Social Security number?"
Do NOT rapid-fire questions. Be patient and respectful.

STEP 3 — DETERMINE INTENT (next 60-90 seconds):
Once identity is verified, ask what they are calling about:
- Payment: "Are you looking to make a payment or set up a payment plan?"
- Dispute: "Are you disputing this debt? I will note that and explain your rights."
- Information: "Would you like more details about the account?"
Note their intent and any relevant details.

STEP 4 — ROUTE + SET EXPECTATIONS (final 30 seconds):
"Thank you for that information. Here is what happens next — I am going to connect your details with a licensed specialist who can [discuss payment options / process your dispute / review your account]. They will reach out by [timeframe]."
- Confirm their callback number
- Ask: "Is there a best time for them to reach you?"
- "Thank you for calling {{business_name}}."')
WHERE industry = 'debt_collection' AND use_case = 'lead_qualification' AND wizard_enabled = true;

END $lq_flow_fix$;


-- ============================================================
-- FIX 3: LEAD QUALIFICATION — Industry-specific closing blocks
-- Old: Generic "prepare a quote" / "exact pricing" language
-- New: Industry-appropriate follow-up language
-- ============================================================

DO $lq_close_fix$
DECLARE
  old_close TEXT := 'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you are looking for [service], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "A specialist will reach out to you by [specific timeframe]. They will prepare a quote and discuss your options."
3. CREATE VALUE: "They will be able to give you exact pricing and walk you through your options — much better than what I can do over the phone."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We are looking forward to helping you. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include';

BEGIN

-- Healthcare LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you are looking for [type of care], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "Our scheduling team will reach out by [specific timeframe] to get you booked."
3. CREATE VALUE: "They will confirm your insurance coverage and find the best available time for you."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We look forward to seeing you. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'healthcare' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Financial Services LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you are interested in [service area], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "An advisor will reach out within one business day to schedule a consultation."
3. CREATE VALUE: "They will be able to review your situation in detail and walk you through your options — much more helpful than what I can cover over the phone."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We look forward to speaking with you. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'financial_services' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Insurance LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you are looking for [coverage type] coverage, and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "A licensed agent will reach out by [specific timeframe] with personalized quotes."
3. CREATE VALUE: "They will compare options from multiple carriers and find the best rates for your situation."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We look forward to finding you the right coverage. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'insurance' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Logistics LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you need to ship [cargo type] from [origin] to [destination], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "A logistics coordinator will reach out by [specific timeframe] with routing options and pricing."
3. CREATE VALUE: "They will put together the most efficient options based on your timeline and budget."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We look forward to getting your shipment moving. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'logistics' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Home Services LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you need [service type] at [address], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "A specialist will reach out by [specific timeframe] to schedule a free estimate."
3. CREATE VALUE: "They will assess the job in person and give you an accurate price — no surprises."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We will get this taken care of. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'home_services' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Retail LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you are interested in [product or category], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "A product specialist will follow up by [specific timeframe] with availability and options."
3. CREATE VALUE: "They can check stock across all our locations and find exactly what you need."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We look forward to helping you find what you are looking for. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'retail' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Travel & Hospitality LQ Closing
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL — CRITICAL FOR CONVERSION:

After collecting all information, deliver the close:

1. SUMMARIZE: "So just to confirm — you are planning a [trip type] to [destination], and the best number to reach you is [number]. Is that correct?"
2. SET EXPECTATIONS: "A travel specialist will reach out by [specific timeframe] with curated options based on your preferences."
3. CREATE VALUE: "They will have access to exclusive rates and insider recommendations that you will not find online."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a time that works better than others?"
5. WARM CLOSE: "Excellent. Thank you for calling {{business_name}}. We are excited to help make your trip unforgettable. Have a great day!"

NEVER end a lead qualification call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'travel_hospitality' AND use_case = 'lead_qualification' AND wizard_enabled = true;

-- Debt Collection LQ Closing (compliance-driven, not conversion-driven)
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_close,
'CLOSING THE CALL:

After collecting all caller information, deliver the close:

1. SUMMARIZE: "Let me confirm — your name is [name], your reference number is [number], and the best callback number is [phone]. Is that correct?"
2. SET EXPECTATIONS: "A licensed specialist will reach out by [specific timeframe] to [discuss your payment options / process your dispute / review your account]."
3. CREATE VALUE: "They will have your full account details and can walk you through all available options."
4. CONFIRM AVAILABILITY: "Is that the best way to reach you? And is there a preferred time?"
5. CLOSE: "Thank you for calling {{business_name}}. We will be in touch."

NEVER end a call without:
- Confirming the callback number
- Setting a specific timeframe for follow-up
- Telling them WHAT the follow-up will include')
WHERE industry = 'debt_collection' AND use_case = 'lead_qualification' AND wizard_enabled = true;

END $lq_close_fix$;


-- ============================================================
-- FIX 4: CUSTOMER SUPPORT — Industry-specific identity determination
-- Old: "existing client, patient, customer, or policyholder" (cross-industry)
-- New: Industry-appropriate term only
-- ============================================================

UPDATE agent_templates
SET prompt_template = replace(
  prompt_template,
  '- Determine if they are an existing client, patient, customer, or policyholder',
  CASE industry
    WHEN 'healthcare' THEN '- Determine if they are a new or existing patient'
    WHEN 'financial_services' THEN '- Determine if they are an existing client'
    WHEN 'insurance' THEN '- Determine if they are an existing policyholder'
    WHEN 'logistics' THEN '- Determine if they are an existing customer or shipper'
    WHEN 'home_services' THEN '- Determine if they are an existing customer'
    WHEN 'retail' THEN '- Determine if they are an existing customer'
    WHEN 'travel_hospitality' THEN '- Determine if they are a current or returning guest'
    WHEN 'debt_collection' THEN '- Determine if they are an existing account holder and verify their identity'
    ELSE '- Determine if they are an existing customer'
  END
)
WHERE use_case = 'customer_support'
  AND wizard_enabled = true
  AND industry IS NOT NULL;


-- ============================================================
-- FIX 5: DISPATCH — Industry-specific urgency keywords and emergency handling
-- Old: Generic "bleeding, broken, accident" / "Is everyone safe?" for ALL industries
-- New: Industry-appropriate urgency cues and emergency protocols
-- ============================================================

DO $dispatch_fix$
DECLARE
  old_dispatch TEXT := '- Listen for urgency cues: voice tone, keywords (emergency, broken, bleeding, accident, urgent)
- If ANY emergency indicator: skip to STEP 2-EMERGENCY immediately

STEP 2-EMERGENCY — SAFETY FIRST:
"Is everyone safe right now?"
- If NO or unclear: provide the industry-specific safety instructions immediately
- If YES: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as EMERGENCY / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.';

BEGIN

-- Healthcare Dispatch
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (emergency, pain, difficulty breathing, bleeding, fall, collapse, allergic reaction, urgent)
- If ANY emergency indicator: skip to STEP 2-EMERGENCY immediately

STEP 2-EMERGENCY — SAFETY FIRST:
"Is the patient in immediate danger or experiencing a medical emergency?"
- If YES: "If this is a life-threatening emergency, please hang up and call 911. I am also dispatching our on-call team right now."
- If NO: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as EMERGENCY / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'healthcare' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Financial Services Dispatch (security-focused, not physical safety)
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (fraud, unauthorized transaction, account breach, suspicious activity, locked out, system down, urgent)
- If ANY security indicator: skip to STEP 2-CRITICAL immediately

STEP 2-CRITICAL — SECURE THE ACCOUNT:
"Has there been an unauthorized transaction or potential security breach?"
- If YES: "I recommend contacting your bank or custodian directly to freeze the account if needed. I am also dispatching our team to assist you immediately."
- If NO: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as CRITICAL / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'financial_services' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Insurance Dispatch
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (accident, damage, theft, injury, fire, flood, claim, urgent)
- If ANY emergency indicator: skip to STEP 2-EMERGENCY immediately

STEP 2-EMERGENCY — SAFETY FIRST:
"Is anyone injured or in immediate danger?"
- If YES: "Please call 911 first if anyone needs medical attention. Once everyone is safe, call us back and we will get your claim started right away."
- If NO: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as EMERGENCY / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'insurance' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Logistics Dispatch
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (accident, spill, hazmat, cargo damage, driver emergency, delay, lost shipment, urgent)
- If ANY emergency indicator: skip to STEP 2-EMERGENCY immediately

STEP 2-EMERGENCY — SAFETY FIRST:
"Is anyone injured or is there a safety hazard at the scene?"
- If YES: "If there are injuries or a hazmat situation, please call 911 immediately. I am dispatching our team to coordinate on our end."
- If NO: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as EMERGENCY / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'logistics' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Home Services Dispatch
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (emergency, flooding, gas leak, fire, electrical sparking, no heat, no AC, sewage backup, urgent)
- If ANY emergency indicator: skip to STEP 2-EMERGENCY immediately

STEP 2-EMERGENCY — SAFETY FIRST:
"Is everyone safe? Is there a gas leak, flooding, or fire?"
- If GAS LEAK: "Please leave the property immediately and call your gas company or 911. Do not use any electrical switches. I am dispatching emergency service now."
- If FLOODING: "If you can safely do so, shut off the main water valve. I am dispatching our emergency team now."
- If FIRE: "Please evacuate and call 911. I am notifying our emergency team."
- If safe: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as EMERGENCY / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'home_services' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Retail Dispatch (delivery/fulfillment — no physical emergencies)
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (urgent delivery, damaged shipment, missing order, wrong item, time-sensitive, customer waiting)
- If URGENT: proceed directly to collect details with priority handling

STEP 2-STANDARD — ASSESS URGENCY:
Classify as URGENT (customer waiting, same-day delivery issue, damaged delivery in progress) / ROUTINE (scheduling, status check, general inquiry).
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'retail' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Travel & Hospitality Dispatch
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (emergency, locked out, fire alarm, medical, safety concern, stranded, flooding, urgent)
- If ANY emergency indicator: skip to STEP 2-EMERGENCY immediately

STEP 2-EMERGENCY — SAFETY FIRST:
"Is everyone safe right now?"
- If FIRE ALARM: "Please follow the evacuation procedures posted in your room. Do not use the elevators. I am notifying the on-duty manager immediately."
- If MEDICAL: "Please call 911 for medical emergencies. I am dispatching on-duty staff to your location right now."
- If LOCKOUT: "I can help with that right away. Can I verify your name and room number?"
- If safe: proceed to collect details

STEP 2-STANDARD — ASSESS URGENCY:
Classify as EMERGENCY / URGENT / ROUTINE based on the caller''s description.
Do not ask the caller to classify — YOU determine urgency from what they describe.')
WHERE industry = 'travel_hospitality' AND use_case = 'dispatch' AND wizard_enabled = true;

-- Debt Collection Dispatch (compliance-driven — no physical emergencies)
UPDATE agent_templates SET prompt_template = replace(prompt_template, old_dispatch,
'- Listen for urgency cues: voice tone, keywords (urgent, legal deadline, court date, payment due today, cease request, creditor escalation)
- If CRITICAL: proceed directly to collect details with priority handling

STEP 2-STANDARD — ASSESS PRIORITY:
Classify as CRITICAL (legal deadline, court date, compliance issue) / URGENT (payment commitment due today, creditor rush request) / ROUTINE (callback, status inquiry).
Do not ask the caller to classify — YOU determine priority from what they describe.')
WHERE industry = 'debt_collection' AND use_case = 'dispatch' AND wizard_enabled = true;

END $dispatch_fix$;
