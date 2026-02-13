-- ============================================================
-- ADDENDUM #2 — RETELL PROMPT RESTRUCTURE
-- Restructures all 32 templates into ## sections,
-- adds Response Guidelines, updates Handlebars skeleton with
-- timezone + ai_notes, and populates test_scenarios.
-- ============================================================

DO $body$
DECLARE
  -- Response Guidelines (universal for all 32 templates)
  response_guidelines TEXT;

  -- Updated Handlebars skeleton with timezone + ai_notes
  new_skeleton TEXT;

  -- Test scenarios by industry + use case (3 per template = 96 total)
  ts_healthcare_lq JSONB;
  ts_healthcare_cs JSONB;
  ts_healthcare_rec JSONB;
  ts_healthcare_disp JSONB;
  ts_financial_lq JSONB;
  ts_financial_cs JSONB;
  ts_financial_rec JSONB;
  ts_financial_disp JSONB;
  ts_insurance_lq JSONB;
  ts_insurance_cs JSONB;
  ts_insurance_rec JSONB;
  ts_insurance_disp JSONB;
  ts_logistics_lq JSONB;
  ts_logistics_cs JSONB;
  ts_logistics_rec JSONB;
  ts_logistics_disp JSONB;
  ts_home_lq JSONB;
  ts_home_cs JSONB;
  ts_home_rec JSONB;
  ts_home_disp JSONB;
  ts_retail_lq JSONB;
  ts_retail_cs JSONB;
  ts_retail_rec JSONB;
  ts_retail_disp JSONB;
  ts_travel_lq JSONB;
  ts_travel_cs JSONB;
  ts_travel_rec JSONB;
  ts_travel_disp JSONB;
  ts_debt_lq JSONB;
  ts_debt_cs JSONB;
  ts_debt_rec JSONB;
  ts_debt_disp JSONB;

  -- Loop variables
  rec RECORD;
  old_prompt TEXT;
  identity_block TEXT;
  style_block TEXT;
  task_block TEXT;
  objection_block TEXT;
  closing_block TEXT;
  new_prompt TEXT;
  scenarios JSONB;

  -- Parsing helpers
  pos_business_hours INT;
  pos_conv_flow INT;
  pos_objections INT;
  pos_closing INT;
  pos_conv_tips INT;
  pos_conv_pacing INT;
  preamble_text TEXT;
  between_text TEXT;

BEGIN

-- ============================================================
-- RESPONSE GUIDELINES (new content for all 32 templates)
-- ============================================================

response_guidelines := '## Response Guidelines

VOICE SPEECH RULES — Follow these when speaking on the phone:

Speaking Phone Numbers:
- Always say phone numbers digit by digit with brief pauses between groups
- Example: "5 5 5... 1 2 3... 4 5 6 7" (NOT "five fifty-five, twelve thirty-four sixty-seven")
- After stating a number, always confirm: "Let me repeat that — 5 5 5, 1 2 3, 4 5 6 7. Did I get that right?"

Speaking Dates and Times:
- Use natural language: "Tuesday, March fourth at two thirty in the afternoon"
- Never say "03/04" or "14:30" — always use spoken English
- For time ranges: "between nine AM and five PM"

Speaking Prices:
- Say dollar amounts in words: "one hundred and fifty dollars" not "$150"
- For cents: "twenty-nine ninety-nine" or "twenty-nine dollars and ninety-nine cents"
- Never say "dollar sign" or "point"

Speaking URLs and Emails:
- Spell out URLs slowly: "w w w dot our business dot com"
- For emails: "jane at our business dot com"
- Always offer to repeat: "Would you like me to spell that again?"

Speaking Addresses:
- Say addresses slowly with natural pauses: "1 2 3 Main Street... Suite 2 0 0... Austin, Texas, 7 8 7 0 1"
- Always confirm the full address by reading it back

Confirming Information (Read-Back Protocol):
- After collecting any critical information (name, phone, email, address), read it back
- "Just to make sure I have that right — your name is Jane Smith, and your number is 5 5 5, 1 2 3, 4 5 6 7. Is that correct?"
- If the caller corrects you, acknowledge and re-confirm: "Got it — let me update that."

REAL-TIME CONVERSATION HANDLING:

Interruption Handling:
- If the caller interrupts you, stop speaking immediately and listen
- Do not restart your previous sentence — address what they said instead
- If they interrupted with a question, answer it before resuming your flow

Backchannel Acknowledgment:
- Use brief acknowledgments while the caller is speaking: "Mm-hmm," "I see," "Got it," "Right"
- This signals you are actively listening without interrupting their train of thought
- Do not overdo it — one acknowledgment every 2-3 sentences is natural

Silence Handling:
- If the caller is silent for 3-5 seconds: "Are you still there?" or "Take your time, I am here"
- If silent for 8+ seconds: "It sounds like we may have gotten disconnected. I am still here if you can hear me."
- If no response after 12 seconds: "I am not hearing anything on your end. If you can hear me, please say something. Otherwise, feel free to call back anytime."

Transfer and Hold Protocol:
- Before transferring: "I am going to connect you with [person/department]. If we get disconnected, you can call back at [number] and ask for [name]."
- If placing on hold: "I need to check on something — do you mind holding for about [X] seconds?" Wait for confirmation.
- When returning from hold: "Thank you for holding. I have [information/update]."

End-of-Call Detection:
- If the caller says goodbye, thanks you, or signals they are done, wrap up promptly
- Do not ask additional questions after the caller has signaled they want to end
- Match their closing energy — if they are brief, be brief; if they are warm, be warm';

-- ============================================================
-- UPDATED HANDLEBARS SKELETON (with timezone + ai_notes)
-- ============================================================

new_skeleton := '
BUSINESS HOURS ({{timezone}}):
{{#each business_hours}}
{{day}}: {{#if closed}}Closed{{else}}{{open}} - {{close}}{{/if}}
{{/each}}

{{#if services.length}}
SERVICES WE OFFER:
{{#each services}}
- {{name}}{{#if description}}: {{description}}{{/if}}{{#if price}} ({{price}}){{/if}}{{#if ai_notes}}
  [Agent Note: {{ai_notes}}]{{/if}}
{{/each}}
{{/if}}

{{#if faqs.length}}
FREQUENTLY ASKED QUESTIONS:
{{#each faqs}}
Q: {{question}}
A: {{answer}}
{{/each}}
{{/if}}

{{#if policies.length}}
POLICIES:
{{#each policies}}
{{name}}: {{description}}
{{/each}}
{{/if}}

{{#if locations.length}}
LOCATIONS:
{{#each locations}}
- {{name}}: {{address}}{{#if phone}} ({{phone}}){{/if}}
{{/each}}
{{/if}}

CALL HANDLING RULES:
- If the caller asks about something not covered above, {{unanswerable_behavior}}
- If calling outside business hours, {{after_hours_behavior}}
- Keep calls concise and under {{max_call_duration}} minutes
- Always be warm, helpful, and professional
- Never make up information — if unsure, {{unanswerable_behavior}}';

-- ============================================================
-- TEST SCENARIOS (3 per industry/use_case combination)
-- ============================================================

-- Healthcare
ts_healthcare_lq := '[
  {"title":"New Patient Inquiry","description":"A potential patient calls asking about dental cleaning costs and availability. They do not have insurance.","opening":"Hi, I am looking to schedule a dental cleaning. How much does it cost without insurance?"},
  {"title":"Insurance Question","description":"A caller wants to know if you accept their specific insurance plan before making an appointment.","opening":"Do you accept Blue Cross Blue Shield PPO? I need to find a new dentist."},
  {"title":"Urgent Care Need","description":"Someone calls with a toothache wanting to be seen as soon as possible.","opening":"I have a really bad toothache and I need to see someone today if possible."}
]';

ts_healthcare_cs := '[
  {"title":"Billing Dispute","description":"An existing patient calls about an unexpected charge on their statement.","opening":"I got a bill for $350 that I was not expecting. I thought my insurance covered my last visit."},
  {"title":"Prescription Refill","description":"A patient needs to request a medication refill and is unsure of the process.","opening":"I need to get my prescription refilled but I am not sure how to do that. Can you help?"},
  {"title":"Appointment Reschedule","description":"A patient needs to reschedule their upcoming appointment to a different day.","opening":"I have an appointment next Tuesday but something came up. Can I move it to later in the week?"}
]';

ts_healthcare_rec := '[
  {"title":"General Information","description":"A first-time caller asks about office hours and location.","opening":"Hi, what are your office hours? And where exactly are you located?"},
  {"title":"Transfer Request","description":"A caller asks to speak directly with the doctor about test results.","opening":"Can I speak with Dr. Johnson? I am calling about my lab results."},
  {"title":"New Patient Scheduling","description":"Someone wants to schedule their first appointment as a new patient.","opening":"I would like to become a new patient. How do I schedule my first appointment?"}
]';

ts_healthcare_disp := '[
  {"title":"After-Hours Emergency","description":"A patient calls after hours with a dental emergency — a knocked-out tooth.","opening":"My son just knocked out his front tooth playing basketball. What should I do? It is 8 PM."},
  {"title":"Severe Pain","description":"A caller reports severe pain that started suddenly and needs immediate guidance.","opening":"I am in really bad pain, it came on suddenly about an hour ago. I do not know what to do."},
  {"title":"Post-Procedure Concern","description":"A patient who had a procedure earlier today is experiencing unexpected bleeding.","opening":"I had a tooth pulled this morning and the bleeding will not stop. Is this normal?"}
]';

-- Financial Services
ts_financial_lq := '[
  {"title":"Retirement Planning","description":"A caller in their 40s wants to start planning for retirement and does not know where to begin.","opening":"I am 45 and I have not really planned for retirement. Is it too late to start?"},
  {"title":"Investment Inquiry","description":"A potential client wants to learn about investment options with a moderate budget.","opening":"I have about $50,000 I want to invest. What kind of options do you offer?"},
  {"title":"Tax Planning","description":"Someone calls before tax season asking about tax planning services.","opening":"I am looking for someone to help me with tax planning. I own a small business."}
]';

ts_financial_cs := '[
  {"title":"Account Access Issue","description":"An existing client cannot log into their investment portal.","opening":"I have been locked out of my account and I cannot reset my password. Can you help?"},
  {"title":"Statement Question","description":"A client has a question about a transaction on their latest statement.","opening":"I see a transaction on my statement I do not recognize. Can someone look into it?"},
  {"title":"Fee Inquiry","description":"A client wants to understand the fees being charged on their account.","opening":"I noticed some fees on my account I was not aware of. Can you explain what these are for?"}
]';

ts_financial_rec := '[
  {"title":"Appointment Request","description":"A caller wants to schedule a meeting with their financial advisor.","opening":"I would like to schedule a meeting with my advisor, Mark Thompson. Is he available this week?"},
  {"title":"Office Information","description":"Someone calls to ask about the office location and parking availability.","opening":"I have a meeting at your office tomorrow. Where exactly are you located and is there parking?"},
  {"title":"Document Submission","description":"A client needs to know how to submit documents for an account opening.","opening":"I was told I need to send some documents to open my account. How do I do that?"}
]';

ts_financial_disp := '[
  {"title":"Fraud Alert","description":"A client suspects unauthorized activity on their account and needs immediate help.","opening":"I think someone has been making unauthorized transactions on my account. I need help right now."},
  {"title":"Market Emergency","description":"A client is panicking about a significant market drop and wants to talk to someone immediately.","opening":"The market just dropped 500 points and I am watching my portfolio tank. I need to talk to my advisor NOW."},
  {"title":"Wire Transfer Urgent","description":"A client needs to complete an urgent wire transfer before end of business today.","opening":"I need to send a wire transfer today before 3 PM. It is urgent — it is for a property closing."}
]';

-- Insurance
ts_insurance_lq := '[
  {"title":"Auto Insurance Quote","description":"A driver wants to compare auto insurance rates after a recent rate increase.","opening":"My car insurance just went up by $100 a month. Can I get a quote to compare?"},
  {"title":"Home Insurance Shopping","description":"A first-time homebuyer needs homeowners insurance for their closing.","opening":"I am buying my first home and I need homeowners insurance before closing. How does that work?"},
  {"title":"Life Insurance Inquiry","description":"A new parent wants to learn about life insurance options.","opening":"I just had a baby and I think I should get life insurance. What do you recommend?"}
]';

ts_insurance_cs := '[
  {"title":"Claim Status Check","description":"A policyholder calls to check on the status of a claim they filed two weeks ago.","opening":"I filed a claim about two weeks ago and I have not heard anything back. Can you check on it?"},
  {"title":"Coverage Question","description":"A customer wants to know if a specific situation is covered under their policy.","opening":"My basement flooded from a burst pipe. Is that covered under my homeowners policy?"},
  {"title":"Policy Cancellation","description":"A customer wants to cancel their policy and switch to a different provider.","opening":"I want to cancel my policy. I found a better rate somewhere else."}
]';

ts_insurance_rec := '[
  {"title":"Payment Question","description":"A customer calls about making a payment or setting up autopay.","opening":"I need to make a payment on my policy. Can I do that over the phone?"},
  {"title":"Agent Request","description":"A customer wants to speak with their specific insurance agent.","opening":"Can I speak with Sarah Miller? She is my agent and I have a question about my policy."},
  {"title":"Certificate of Insurance","description":"A client needs a certificate of insurance for a contract they are working on.","opening":"I need a certificate of insurance sent to a contractor. How do I get that done?"}
]';

ts_insurance_disp := '[
  {"title":"Car Accident","description":"A policyholder was just in a car accident and needs to file a claim immediately.","opening":"I was just in a car accident. Nobody is hurt but both cars are damaged. What do I do?"},
  {"title":"Property Damage","description":"A homeowner calls about a tree that fell on their house during a storm.","opening":"A tree just fell on my roof during the storm. There is a huge hole and it is still raining. I need help."},
  {"title":"Theft Report","description":"A policyholder''s car was stolen and they need to file a claim right away.","opening":"I just came out and my car is gone. I think it was stolen. I need to file a claim."}
]';

-- Logistics
ts_logistics_lq := '[
  {"title":"Shipping Quote","description":"A business owner wants a quote for regular freight shipments across the region.","opening":"I ship about 20 pallets a week from Dallas to the East Coast. Can I get a rate quote?"},
  {"title":"International Shipping","description":"A company needs help with international shipping logistics.","opening":"We are starting to ship products to Europe and we need a logistics partner. Can you help with international?"},
  {"title":"Warehouse Services","description":"A business is looking for warehousing and fulfillment services.","opening":"We need warehouse space and someone to handle our fulfillment. Do you offer those services?"}
]';

ts_logistics_cs := '[
  {"title":"Late Shipment","description":"A customer''s shipment is overdue and they need a status update.","opening":"My shipment was supposed to arrive yesterday and it still has not showed up. Where is it?"},
  {"title":"Damaged Goods","description":"A customer received damaged goods and wants to file a claim.","opening":"The shipment we received today has significant damage. Three pallets are crushed. I need to file a claim."},
  {"title":"Invoice Discrepancy","description":"A customer notices a billing error on their latest invoice.","opening":"The invoice I just received does not match what we agreed on. The fuel surcharge is way higher than quoted."}
]';

ts_logistics_rec := '[
  {"title":"Tracking Inquiry","description":"A caller wants to track a specific shipment by reference number.","opening":"Can I get a status update on shipment number LX dash 4 5 7 8 9?"},
  {"title":"Pickup Schedule","description":"A shipper needs to schedule a pickup for tomorrow morning.","opening":"I need to schedule a pickup for tomorrow morning. We have 10 pallets ready to go."},
  {"title":"Contact Request","description":"A caller wants to speak with their account manager about contract terms.","opening":"Can I speak with my account rep, David? We need to discuss our contract renewal."}
]';

ts_logistics_disp := '[
  {"title":"Driver Breakdown","description":"A driver calls in reporting a truck breakdown on the highway with a perishable load.","opening":"This is driver 247. My truck broke down on I-35 southbound near mile marker 180. I have a refrigerated load."},
  {"title":"Delivery Emergency","description":"A customer needs an emergency reroute of a shipment due to a changed delivery address.","opening":"I need to change the delivery address on shipment 9 8 7 6 5 immediately. The warehouse they were going to is flooded."},
  {"title":"Customs Hold","description":"A shipment is being held at customs and needs immediate attention.","opening":"Our container is being held at the port and we need it released today or we miss our production deadline."}
]';

-- Home Services
ts_home_lq := '[
  {"title":"Plumbing Estimate","description":"A homeowner has a leaking faucet and wants to know the cost to fix it.","opening":"My kitchen faucet has been dripping nonstop. How much would it cost to fix or replace it?"},
  {"title":"HVAC Service","description":"A homeowner''s AC is not cooling properly and wants someone to look at it.","opening":"My AC is running but it is not cooling the house. It is 90 degrees outside and getting hot in here."},
  {"title":"New Construction","description":"A homeowner wants a quote for a bathroom renovation.","opening":"I am thinking about remodeling my master bathroom. Can you give me a rough idea of what that costs?"}
]';

ts_home_cs := '[
  {"title":"Warranty Concern","description":"A customer''s recent repair is having the same issue again and they want it fixed under warranty.","opening":"You guys fixed my water heater last month and it is doing the same thing again. Is this covered under warranty?"},
  {"title":"Scheduling Complaint","description":"A customer is upset that a technician did not show up for their scheduled appointment.","opening":"I took the day off work and nobody showed up for my appointment. This is the second time this has happened."},
  {"title":"Follow-Up Needed","description":"A customer was told someone would call them back with a quote and never received it.","opening":"Someone came out last week to look at my roof and said they would send me a quote. I never got it."}
]';

ts_home_rec := '[
  {"title":"Service Availability","description":"A caller wants to know if you offer a specific service in their area.","opening":"Do you guys do electrical work? I need some outlets installed in my garage."},
  {"title":"Emergency Hours","description":"A caller wants to know if you offer emergency service on weekends.","opening":"It is Saturday and my pipe just burst. Do you have someone who can come out today?"},
  {"title":"General Pricing","description":"A caller wants to understand your pricing structure before booking.","opening":"How do you charge? Is it hourly or by the job? Do you charge for estimates?"}
]';

ts_home_disp := '[
  {"title":"Burst Pipe","description":"A homeowner has a burst pipe flooding their basement and needs immediate help.","opening":"Water is pouring into my basement from a burst pipe! I need a plumber right now!"},
  {"title":"No Heat Emergency","description":"A family has no heat in the middle of winter with young children at home.","opening":"Our furnace just stopped working and it is 20 degrees outside. We have two small kids. We need someone now."},
  {"title":"Gas Smell","description":"A homeowner smells gas in their home and is not sure what to do.","opening":"I smell gas in my house. I do not know where it is coming from. Should I be worried?"}
]';

-- Retail & Consumer
ts_retail_lq := '[
  {"title":"Product Availability","description":"A customer wants to know if a specific product is in stock before driving to the store.","opening":"Do you have the Samsung 65-inch OLED TV in stock? I do not want to drive over if you do not have it."},
  {"title":"Price Match Request","description":"A customer found a lower price online and wants to know if you will match it.","opening":"I found this same product on Amazon for $50 less. Do you guys price match?"},
  {"title":"Gift Recommendation","description":"A customer needs help choosing a gift and wants suggestions.","opening":"I am looking for a birthday gift for my mom. She likes cooking. What would you recommend under $100?"}
]';

ts_retail_cs := '[
  {"title":"Return Request","description":"A customer wants to return a product they purchased last week.","opening":"I bought a blender last week and it is not working right. I want to return it."},
  {"title":"Order Status","description":"A customer placed an online order and wants to know when it will arrive.","opening":"I ordered something online three days ago and I still have not gotten a shipping confirmation. What is going on?"},
  {"title":"Product Complaint","description":"A customer is unhappy with a product they purchased and wants a resolution.","opening":"The shoes I bought from you are falling apart after only two weeks. This is unacceptable for the price I paid."}
]';

ts_retail_rec := '[
  {"title":"Store Hours","description":"A caller wants to know the store hours for the upcoming holiday weekend.","opening":"What are your hours this Saturday? Are you open on Memorial Day?"},
  {"title":"Department Transfer","description":"A caller wants to speak with a specific department about a special order.","opening":"Can you transfer me to your furniture department? I want to check on a special order."},
  {"title":"Event Inquiry","description":"A caller wants to know about upcoming sales or events.","opening":"Do you have any sales coming up this month? I am looking to buy a new mattress."}
]';

ts_retail_disp := '[
  {"title":"Delivery Issue","description":"A customer''s delivery was supposed to arrive today but the tracking shows it is stuck.","opening":"My delivery was supposed to be here by noon and the tracking has not updated since yesterday. I took the day off for this."},
  {"title":"Wrong Item Received","description":"A customer received the wrong item in their order and needs it corrected immediately.","opening":"I just opened my package and this is completely wrong. I ordered a blue couch and you sent me a brown one."},
  {"title":"Installation Emergency","description":"A customer had an appliance installed and it is now causing a problem.","opening":"The dishwasher your team installed yesterday is leaking all over my kitchen floor. I need someone out here now."}
]';

-- Travel & Hospitality
ts_travel_lq := '[
  {"title":"Vacation Package","description":"A couple is planning a honeymoon and wants recommendations.","opening":"We are planning our honeymoon for June. We are thinking about the Caribbean. What do you recommend?"},
  {"title":"Group Booking","description":"A caller wants to organize a group trip for a corporate retreat.","opening":"I need to book a corporate retreat for about 30 people. Do you handle group bookings?"},
  {"title":"Budget Travel","description":"A family is looking for an affordable vacation option with kids.","opening":"We are a family of four and we are trying to plan a vacation on a budget. What are our options?"}
]';

ts_travel_cs := '[
  {"title":"Room Complaint","description":"A guest currently at the hotel has an issue with their room.","opening":"I just checked into my room and the AC is not working. It is extremely hot in here. Can you send someone?"},
  {"title":"Reservation Change","description":"A guest needs to modify their existing reservation dates.","opening":"I need to change my reservation from this weekend to next weekend. Is that possible?"},
  {"title":"Refund Request","description":"A guest is requesting a refund for a stay they were not satisfied with.","opening":"We stayed at your hotel last week and it was terrible. I would like a refund."}
]';

ts_travel_rec := '[
  {"title":"Reservation Lookup","description":"A guest calls to confirm their upcoming reservation details.","opening":"I have a reservation for next Friday. Can you confirm the details? My name is Johnson."},
  {"title":"Amenity Question","description":"A potential guest wants to know about hotel amenities before booking.","opening":"Does your hotel have a pool? And is the gym open 24 hours?"},
  {"title":"Local Recommendations","description":"A guest wants recommendations for restaurants and activities nearby.","opening":"We are staying at your hotel this weekend. Can you recommend some good restaurants in the area?"}
]';

ts_travel_disp := '[
  {"title":"Guest Emergency","description":"A guest reports a safety issue in their room that needs immediate attention.","opening":"There is water coming through the ceiling in our room. It looks like a pipe burst upstairs."},
  {"title":"Lost Property","description":"A guest left something valuable behind and needs it located urgently.","opening":"I just checked out an hour ago and I left my laptop in the room. I need someone to check right away before housekeeping throws it away."},
  {"title":"Medical Emergency","description":"A guest is reporting a medical situation at the property.","opening":"Someone collapsed in the lobby. They are breathing but not conscious. We need help right now."}
]';

-- Debt Collection
ts_debt_lq := '[
  {"title":"Account Verification","description":"A debtor calls in response to a letter they received and wants to verify the debt.","opening":"I got a letter from you about a debt. I do not recognize this. Can you tell me what it is for?"},
  {"title":"Payment Arrangement","description":"A debtor wants to set up a payment plan because they cannot pay the full amount.","opening":"I know I owe this money but I cannot pay it all at once. Can we set up some kind of payment plan?"},
  {"title":"Dispute Intent","description":"A debtor is calling to dispute the debt entirely.","opening":"I am calling to dispute this debt. I already paid the original company. This is wrong."}
]';

ts_debt_cs := '[
  {"title":"Payment Confirmation","description":"A debtor made a payment and wants to confirm it was received and applied.","opening":"I made a payment last week and I want to make sure it was received. My balance should be lower now."},
  {"title":"Account Statement","description":"A debtor wants a detailed statement of their account showing all charges and payments.","opening":"Can you send me a complete statement of my account? I need it for my records."},
  {"title":"Cease Communication","description":"A debtor is requesting that you stop all communication with them.","opening":"I want you to stop calling me. I do not want any more phone calls or letters."}
]';

ts_debt_rec := '[
  {"title":"Transferred Call","description":"A debtor was transferred and needs to be routed to the right person.","opening":"I was on the phone with someone about my account and we got disconnected. Can you help me?"},
  {"title":"Payment Method","description":"A caller wants to know what payment methods are accepted.","opening":"What are my options for making a payment? Can I pay online or does it have to be over the phone?"},
  {"title":"General Inquiry","description":"A caller wants general information about their account status.","opening":"I want to check my balance and see what I still owe. My account number is DC dash 1 2 3 4 5."}
]';

ts_debt_disp := '[
  {"title":"Legal Threat","description":"A debtor calls saying they have hired a lawyer and demands all communication go through their attorney.","opening":"I have hired an attorney. His name is John Davis. All future communication needs to go through him. Stop calling me."},
  {"title":"Hardship Situation","description":"A debtor calls in distress explaining a severe financial hardship.","opening":"I just lost my job and I have no way to pay anything right now. I do not know what to do."},
  {"title":"Compliance Complaint","description":"A debtor calls to complain about contact frequency or timing.","opening":"You people have called me five times this week. This is harassment. I know my rights under the FDCPA."}
]';

-- ============================================================
-- RESTRUCTURE ALL 32 TEMPLATES
-- ============================================================

FOR rec IN
  SELECT id, industry, use_case, prompt_template
  FROM agent_templates
  WHERE wizard_enabled = true
    AND industry IS NOT NULL
    AND use_case IS NOT NULL
LOOP

  old_prompt := rec.prompt_template;

  -- --------------------------------------------------------
  -- PARSE: Extract existing content blocks from the prompt
  -- The current structure from the addendum migration is:
  -- [Personality DNA] [Role/Rules] [Conversation Flow]
  -- [Objection Handling] [Closing Instructions]
  -- [Escalation Chain (dispatch only)] [Conversation Tips]
  -- [Global Conversation Pacing]
  -- [BUSINESS HOURS skeleton]
  -- --------------------------------------------------------

  -- Find key section boundaries
  pos_business_hours := position(E'\nBUSINESS HOURS:' IN old_prompt);
  pos_conv_flow := position(E'\nCONVERSATION FLOW' IN old_prompt);
  pos_objections := position(E'\nCOMMON OBJECTIONS:' IN old_prompt);
  pos_closing := position(E'\nCLOSING THE CALL' IN old_prompt);
  pos_conv_tips := GREATEST(
    position(E'\nHEALTHCARE CONVERSATION TIPS:' IN old_prompt),
    position(E'\nFINANCIAL CONVERSATION TIPS:' IN old_prompt),
    position(E'\nINSURANCE CONVERSATION TIPS:' IN old_prompt),
    position(E'\nLOGISTICS CONVERSATION TIPS:' IN old_prompt),
    position(E'\nHOME SERVICES CONVERSATION TIPS:' IN old_prompt),
    position(E'\nRETAIL CONVERSATION TIPS:' IN old_prompt),
    position(E'\nHOSPITALITY CONVERSATION TIPS:' IN old_prompt),
    position(E'\nDEBT COLLECTION CONVERSATION TIPS:' IN old_prompt)
  );
  pos_conv_pacing := position(E'\nCONVERSATION PACING:' IN old_prompt);

  -- --------------------------------------------------------
  -- EXTRACT: Identity block = everything before CONVERSATION FLOW
  -- This contains Personality DNA + Role + Rules
  -- --------------------------------------------------------
  IF pos_conv_flow > 0 THEN
    identity_block := trim(substring(old_prompt FROM 1 FOR pos_conv_flow - 1));
  ELSIF pos_business_hours > 0 THEN
    identity_block := trim(substring(old_prompt FROM 1 FOR pos_business_hours - 1));
  ELSE
    identity_block := trim(old_prompt);
  END IF;

  -- --------------------------------------------------------
  -- EXTRACT: Style block (Conversation Tips)
  -- --------------------------------------------------------
  IF pos_conv_tips > 0 THEN
    IF pos_conv_pacing > 0 AND pos_conv_pacing > pos_conv_tips THEN
      style_block := trim(substring(old_prompt FROM pos_conv_tips + 1 FOR pos_conv_pacing - pos_conv_tips - 1));
    ELSIF pos_business_hours > 0 AND pos_business_hours > pos_conv_tips THEN
      style_block := trim(substring(old_prompt FROM pos_conv_tips + 1 FOR pos_business_hours - pos_conv_tips - 1));
    ELSE
      style_block := '';
    END IF;
  ELSE
    style_block := '';
  END IF;

  -- --------------------------------------------------------
  -- EXTRACT: Task block = Conversation Flow + Conversation Pacing
  -- (Role/Rules are already in identity_block)
  -- --------------------------------------------------------
  task_block := '';
  IF pos_conv_flow > 0 THEN
    IF pos_objections > 0 AND pos_objections > pos_conv_flow THEN
      task_block := trim(substring(old_prompt FROM pos_conv_flow + 1 FOR pos_objections - pos_conv_flow - 1));
    ELSIF pos_closing > 0 AND pos_closing > pos_conv_flow THEN
      task_block := trim(substring(old_prompt FROM pos_conv_flow + 1 FOR pos_closing - pos_conv_flow - 1));
    ELSIF pos_conv_tips > 0 AND pos_conv_tips > pos_conv_flow THEN
      task_block := trim(substring(old_prompt FROM pos_conv_flow + 1 FOR pos_conv_tips - pos_conv_flow - 1));
    ELSIF pos_conv_pacing > 0 AND pos_conv_pacing > pos_conv_flow THEN
      task_block := trim(substring(old_prompt FROM pos_conv_flow + 1 FOR pos_conv_pacing - pos_conv_flow - 1));
    ELSIF pos_business_hours > 0 AND pos_business_hours > pos_conv_flow THEN
      task_block := trim(substring(old_prompt FROM pos_conv_flow + 1 FOR pos_business_hours - pos_conv_flow - 1));
    END IF;
  END IF;

  -- Append conversation pacing to task block
  IF pos_conv_pacing > 0 THEN
    IF pos_conv_tips > pos_conv_pacing THEN
      -- pacing before tips (unlikely but handle)
      between_text := trim(substring(old_prompt FROM pos_conv_pacing + 1 FOR pos_conv_tips - pos_conv_pacing - 1));
    ELSIF pos_business_hours > 0 AND pos_business_hours > pos_conv_pacing THEN
      between_text := trim(substring(old_prompt FROM pos_conv_pacing + 1 FOR pos_business_hours - pos_conv_pacing - 1));
    ELSE
      between_text := trim(substring(old_prompt FROM pos_conv_pacing + 1));
    END IF;
    IF between_text <> '' THEN
      IF task_block <> '' THEN
        task_block := task_block || E'\n\n' || between_text;
      ELSE
        task_block := between_text;
      END IF;
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- EXTRACT: Objection block
  -- --------------------------------------------------------
  objection_block := '';
  IF pos_objections > 0 THEN
    IF pos_closing > 0 AND pos_closing > pos_objections THEN
      objection_block := trim(substring(old_prompt FROM pos_objections + 1 FOR pos_closing - pos_objections - 1));
    ELSIF pos_conv_tips > 0 AND pos_conv_tips > pos_objections THEN
      objection_block := trim(substring(old_prompt FROM pos_objections + 1 FOR pos_conv_tips - pos_objections - 1));
    ELSIF pos_conv_pacing > 0 AND pos_conv_pacing > pos_objections THEN
      objection_block := trim(substring(old_prompt FROM pos_objections + 1 FOR pos_conv_pacing - pos_objections - 1));
    ELSIF pos_business_hours > 0 AND pos_business_hours > pos_objections THEN
      objection_block := trim(substring(old_prompt FROM pos_objections + 1 FOR pos_business_hours - pos_objections - 1));
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- EXTRACT: Closing block (includes escalation chain for dispatch)
  -- --------------------------------------------------------
  closing_block := '';
  IF pos_closing > 0 THEN
    IF pos_conv_tips > 0 AND pos_conv_tips > pos_closing THEN
      closing_block := trim(substring(old_prompt FROM pos_closing + 1 FOR pos_conv_tips - pos_closing - 1));
    ELSIF pos_conv_pacing > 0 AND pos_conv_pacing > pos_closing THEN
      closing_block := trim(substring(old_prompt FROM pos_closing + 1 FOR pos_conv_pacing - pos_closing - 1));
    ELSIF pos_business_hours > 0 AND pos_business_hours > pos_closing THEN
      closing_block := trim(substring(old_prompt FROM pos_closing + 1 FOR pos_business_hours - pos_closing - 1));
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- BUILD: New prompt in ## section format
  -- --------------------------------------------------------

  new_prompt := '## Identity' || E'\n\n' || identity_block;

  IF style_block <> '' THEN
    new_prompt := new_prompt || E'\n\n' || '## Style Guardrails' || E'\n\n' || style_block;
  END IF;

  new_prompt := new_prompt || E'\n\n' || response_guidelines;

  new_prompt := new_prompt || E'\n\n' || '## Task Instructions';
  IF task_block <> '' THEN
    new_prompt := new_prompt || E'\n\n' || task_block;
  END IF;

  IF objection_block <> '' THEN
    new_prompt := new_prompt || E'\n\n' || '## Objection Handling' || E'\n\n' || objection_block;
  END IF;

  IF closing_block <> '' THEN
    new_prompt := new_prompt || E'\n\n' || '## Closing Instructions' || E'\n\n' || closing_block;
  END IF;

  -- Append new skeleton
  new_prompt := new_prompt || E'\n' || new_skeleton;

  -- --------------------------------------------------------
  -- SELECT: Test scenarios for this industry + use_case
  -- --------------------------------------------------------
  scenarios := CASE
    WHEN rec.industry = 'healthcare' AND rec.use_case = 'lead_qualification' THEN ts_healthcare_lq
    WHEN rec.industry = 'healthcare' AND rec.use_case = 'customer_support' THEN ts_healthcare_cs
    WHEN rec.industry = 'healthcare' AND rec.use_case = 'receptionist' THEN ts_healthcare_rec
    WHEN rec.industry = 'healthcare' AND rec.use_case = 'dispatch' THEN ts_healthcare_disp
    WHEN rec.industry = 'financial_services' AND rec.use_case = 'lead_qualification' THEN ts_financial_lq
    WHEN rec.industry = 'financial_services' AND rec.use_case = 'customer_support' THEN ts_financial_cs
    WHEN rec.industry = 'financial_services' AND rec.use_case = 'receptionist' THEN ts_financial_rec
    WHEN rec.industry = 'financial_services' AND rec.use_case = 'dispatch' THEN ts_financial_disp
    WHEN rec.industry = 'insurance' AND rec.use_case = 'lead_qualification' THEN ts_insurance_lq
    WHEN rec.industry = 'insurance' AND rec.use_case = 'customer_support' THEN ts_insurance_cs
    WHEN rec.industry = 'insurance' AND rec.use_case = 'receptionist' THEN ts_insurance_rec
    WHEN rec.industry = 'insurance' AND rec.use_case = 'dispatch' THEN ts_insurance_disp
    WHEN rec.industry = 'logistics' AND rec.use_case = 'lead_qualification' THEN ts_logistics_lq
    WHEN rec.industry = 'logistics' AND rec.use_case = 'customer_support' THEN ts_logistics_cs
    WHEN rec.industry = 'logistics' AND rec.use_case = 'receptionist' THEN ts_logistics_rec
    WHEN rec.industry = 'logistics' AND rec.use_case = 'dispatch' THEN ts_logistics_disp
    WHEN rec.industry = 'home_services' AND rec.use_case = 'lead_qualification' THEN ts_home_lq
    WHEN rec.industry = 'home_services' AND rec.use_case = 'customer_support' THEN ts_home_cs
    WHEN rec.industry = 'home_services' AND rec.use_case = 'receptionist' THEN ts_home_rec
    WHEN rec.industry = 'home_services' AND rec.use_case = 'dispatch' THEN ts_home_disp
    WHEN rec.industry = 'retail' AND rec.use_case = 'lead_qualification' THEN ts_retail_lq
    WHEN rec.industry = 'retail' AND rec.use_case = 'customer_support' THEN ts_retail_cs
    WHEN rec.industry = 'retail' AND rec.use_case = 'receptionist' THEN ts_retail_rec
    WHEN rec.industry = 'retail' AND rec.use_case = 'dispatch' THEN ts_retail_disp
    WHEN rec.industry = 'travel_hospitality' AND rec.use_case = 'lead_qualification' THEN ts_travel_lq
    WHEN rec.industry = 'travel_hospitality' AND rec.use_case = 'customer_support' THEN ts_travel_cs
    WHEN rec.industry = 'travel_hospitality' AND rec.use_case = 'receptionist' THEN ts_travel_rec
    WHEN rec.industry = 'travel_hospitality' AND rec.use_case = 'dispatch' THEN ts_travel_disp
    WHEN rec.industry = 'debt_collection' AND rec.use_case = 'lead_qualification' THEN ts_debt_lq
    WHEN rec.industry = 'debt_collection' AND rec.use_case = 'customer_support' THEN ts_debt_cs
    WHEN rec.industry = 'debt_collection' AND rec.use_case = 'receptionist' THEN ts_debt_rec
    WHEN rec.industry = 'debt_collection' AND rec.use_case = 'dispatch' THEN ts_debt_disp
    ELSE '[]'::jsonb
  END;

  -- --------------------------------------------------------
  -- UPDATE: Apply restructured prompt + test scenarios
  -- --------------------------------------------------------
  UPDATE agent_templates
  SET prompt_template = new_prompt,
      test_scenarios = scenarios
  WHERE id = rec.id;

END LOOP;

END;
$body$;
