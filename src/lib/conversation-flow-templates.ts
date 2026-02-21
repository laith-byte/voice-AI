// ---------------------------------------------------------------------------
// Shared conversation flow template types & generators
// Used by both the Conversation Flows page and the Onboarding wizard
// ---------------------------------------------------------------------------

export interface FlowNode {
  id: string;
  type:
    | "message"
    | "question"
    | "condition"
    | "transfer"
    | "end"
    | "check_availability"
    | "book_appointment"
    | "crm_lookup"
    | "webhook";
  data: {
    text?: string;
    nextNodeId?: string;
    options?: { label: string; nextNodeId: string }[];
    condition?: string;
    trueNodeId?: string;
    falseNodeId?: string;
    transferNumber?: string;
    provider?: "google" | "calendly";
    webhookUrl?: string;
    webhookMethod?: "POST" | "GET";
  };
}

export interface IndustryConfig {
  label: string;
  specialist: string;
  servicePlural: string;
  customer: string;
  appointmentTerm: string;
  leadOptions: string[];
  supportOptions: string[];
  receptionistOptions: string[];
  dispatchItem: string;
  dispatchTimeframe: string;
}

export const INDUSTRIES: Record<string, IndustryConfig> = {
  healthcare: {
    label: "Healthcare",
    specialist: "care coordinator",
    servicePlural: "medical services",
    customer: "patient",
    appointmentTerm: "appointment",
    leadOptions: ["Primary care", "Specialist referral", "Dental/Vision", "Mental health"],
    supportOptions: ["Appointment scheduling", "Prescription refills", "Billing questions", "Medical records"],
    receptionistOptions: ["Book an appointment", "Speak with a nurse", "Insurance verification", "General information"],
    dispatchItem: "medical team",
    dispatchTimeframe: "30 minutes",
  },
  financial_services: {
    label: "Financial Services",
    specialist: "financial advisor",
    servicePlural: "financial services",
    customer: "client",
    appointmentTerm: "consultation",
    leadOptions: ["Investment planning", "Retirement accounts", "Loans & mortgages", "Business banking"],
    supportOptions: ["Account access issues", "Transaction disputes", "Investment questions", "Loan inquiries"],
    receptionistOptions: ["Schedule a consultation", "Account inquiry", "Speak with an advisor", "General information"],
    dispatchItem: "advisor",
    dispatchTimeframe: "1 business day",
  },
  insurance: {
    label: "Insurance",
    specialist: "insurance agent",
    servicePlural: "insurance coverage",
    customer: "policyholder",
    appointmentTerm: "policy review",
    leadOptions: ["Auto insurance", "Home insurance", "Life insurance", "Business insurance"],
    supportOptions: ["File a claim", "Policy questions", "Coverage changes", "Billing and payments"],
    receptionistOptions: ["Get a quote", "File a claim", "Speak with an agent", "Policy information"],
    dispatchItem: "claims adjuster",
    dispatchTimeframe: "24 hours",
  },
  logistics: {
    label: "Logistics",
    specialist: "logistics coordinator",
    servicePlural: "shipping and logistics",
    customer: "shipper",
    appointmentTerm: "pickup",
    leadOptions: ["Domestic shipping", "International freight", "Warehousing", "Last-mile delivery"],
    supportOptions: ["Shipment tracking", "Delivery issues", "Pickup scheduling", "Customs questions"],
    receptionistOptions: ["Track a shipment", "Schedule a pickup", "Get a shipping quote", "Speak with dispatch"],
    dispatchItem: "driver",
    dispatchTimeframe: "2 hours",
  },
  home_services: {
    label: "Home Services",
    specialist: "service coordinator",
    servicePlural: "home services",
    customer: "homeowner",
    appointmentTerm: "service appointment",
    leadOptions: ["Plumbing", "Electrical", "HVAC", "General maintenance"],
    supportOptions: ["Repair status", "Warranty questions", "Reschedule service", "Billing issues"],
    receptionistOptions: ["Schedule a service call", "Get an estimate", "Emergency repair", "Speak with a technician"],
    dispatchItem: "technician",
    dispatchTimeframe: "45 minutes",
  },
  retail: {
    label: "Retail & Consumer",
    specialist: "customer service representative",
    servicePlural: "products and services",
    customer: "customer",
    appointmentTerm: "appointment",
    leadOptions: ["Product information", "Bulk orders", "Custom solutions", "Loyalty program"],
    supportOptions: ["Order status", "Returns & exchanges", "Product defects", "Billing questions"],
    receptionistOptions: ["Check order status", "Start a return", "Product availability", "Speak with a manager"],
    dispatchItem: "delivery team",
    dispatchTimeframe: "the scheduled window",
  },
  travel_hospitality: {
    label: "Travel & Hospitality",
    specialist: "travel concierge",
    servicePlural: "travel and hospitality services",
    customer: "guest",
    appointmentTerm: "reservation",
    leadOptions: ["Room reservations", "Event booking", "Group travel", "Vacation packages"],
    supportOptions: ["Reservation changes", "Room service requests", "Facility information", "Special accommodations"],
    receptionistOptions: ["Make a reservation", "Modify a booking", "Concierge services", "Speak with management"],
    dispatchItem: "concierge team",
    dispatchTimeframe: "15 minutes",
  },
  debt_collection: {
    label: "Debt Collection",
    specialist: "account specialist",
    servicePlural: "account resolution services",
    customer: "account holder",
    appointmentTerm: "payment consultation",
    leadOptions: ["Payment arrangement", "Account settlement", "Dispute resolution", "Financial counseling"],
    supportOptions: ["Account balance", "Payment methods", "Dispute a charge", "Payment plan options"],
    receptionistOptions: ["Make a payment", "Discuss payment options", "Dispute an account", "Speak with a supervisor"],
    dispatchItem: "field representative",
    dispatchTimeframe: "2 business days",
  },
};

export function makeFlowId() {
  return crypto.randomUUID();
}

export function generateTemplateNodes(industryKey: string, useCaseKey: string): FlowNode[] {
  const ind = INDUSTRIES[industryKey];
  if (!ind) return [];

  switch (useCaseKey) {
    case "lead_qualification":
      return [
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `Thank you for calling [Company Name]! I'm really glad you reached out. My name is [Agent Name], and I specialize in helping people explore our ${ind.servicePlural}. Before we dive in, let me quickly pull up your information so I can give you the most personalized experience possible.

**Tone:** Warm, enthusiastic, and genuinely interested. You want the caller to feel like they've reached someone who actually wants to help — not a generic answering service. Smile through your voice.

**If the caller seems rushed or impatient:** Acknowledge it immediately: "I can tell you're on a tight schedule — let me make this quick and efficient for you."
**If the caller seems hesitant or unsure:** Be encouraging: "No worries at all — there are no dumb questions here. I'm happy to walk you through everything."`,
          },
        },
        {
          id: makeFlowId(),
          type: "crm_lookup",
          data: {
            text: `Look up the caller's phone number in the CRM to determine if they're an existing ${ind.customer} or a new prospect.

**If found (returning ${ind.customer}):**
- Greet them warmly by name: "Oh wonderful, [Name]! I see you've worked with us before. Great to reconnect with you!"
- Reference their history if relevant: "I can see you previously [last interaction/service]. Has everything been going well with that?"
- This builds trust and shows you value the relationship.

**If NOT found (new prospect):**
- Don't make it awkward. Simply say: "Looks like this might be your first time reaching out to us — that's exciting! Let me get to know you a bit better."
- Collect their name naturally: "And who do I have the pleasure of speaking with today?"

**Important:** Never reveal internal system details. Don't say "I'm checking our database" — instead say "Let me pull up your information."`,
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `Now I'd love to understand what brought you to us today. Which of our ${ind.servicePlural} are you most interested in exploring?

**How to present options:**
- Don't just list them robotically. Introduce them naturally: "We help people with a few different things — [Option 1], [Option 2], [Option 3], and [Option 4]. Any of those resonate with what you're looking for?"
- If they mention something that doesn't fit neatly into a category, that's fine — acknowledge it: "Interesting! That sounds like it could fall under [closest option]. Let me ask you a few more questions to make sure I point you in the right direction."

**If they say "I'm not sure" or "all of them":**
- Don't push. Instead, ask a lifestyle/situation question: "No problem! Can you tell me a bit about your current situation? That'll help me figure out the best fit for you."`,
            options: ind.leadOptions.map((o) => ({ label: o, nextNodeId: "" })),
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `That's a great area to focus on. Now, to make sure we match you with the right resources and availability, I'd love to know — what's your timeline looking like? When are you hoping to get started?

**How to handle each response:**
- "As soon as possible" → Express urgency match: "Perfect, I'll prioritize getting you set up quickly. Let's see what we have available."
- "This week / this month" → "Great timing — we have some excellent availability coming up."
- "Just exploring" → Don't pressure. "Absolutely, no rush at all. Let me give you all the information you need so you can make the best decision on your own timeline."

**Key qualification signals to note internally:**
- ASAP = hot lead, prioritize scheduling
- This week = warm lead, schedule if possible
- This month = warm lead, nurture
- Exploring = cool lead, provide value and follow up later`,
            options: [
              { label: "As soon as possible", nextNodeId: "" },
              { label: "This week", nextNodeId: "" },
              { label: "This month", nextNodeId: "" },
              { label: "Just exploring options", nextNodeId: "" },
            ],
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `This is all really helpful — thank you for sharing! I want to make sure our ${ind.specialist} team can follow up with the best possible information for you. Could I grab your full name and the best email address to reach you at?

**How to ask naturally:**
- Don't say "I need to collect your information." Instead: "So our team can send you some tailored resources and follow up properly, what's the best email for you?"
- If they hesitate about giving email: "Totally understand — we'll only use it to send you relevant information about what we discussed today. No spam, I promise."
- Confirm spelling: "Let me make sure I have that right — that's [spell it back]?"

**Also collect (if not already known):**
- Phone number (if calling from a different number than their main)
- Company name (if B2B)
- Any other qualifying details specific to their expressed interest`,
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The ${ind.customer} has expressed interest in scheduling a ${ind.appointmentTerm} with a ${ind.specialist}, or their timeline suggests they want to take action soon (ASAP or this week). They seem engaged and ready to take a next step rather than just gathering information.`,
          },
        },
        {
          id: makeFlowId(),
          type: "check_availability",
          data: {
            text: `Wonderful! Let me check our ${ind.specialist}'s calendar to find a time that works perfectly for you.

**How to present availability:**
- Offer 2-3 specific time slots: "I've got openings on [Day] at [Time], [Day] at [Time], or [Day] at [Time]. Which of those works best for your schedule?"
- If none work: "No worries — I have more availability next week. What days generally work best for you?"
- Be flexible: "If mornings aren't your thing, I also have some afternoon slots."

**Time zone awareness:** Always confirm: "And just to make sure — you're in [timezone], correct?"`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "book_appointment",
          data: {
            text: `Let me lock that ${ind.appointmentTerm} in for you right now.

**Confirmation details to provide:**
- Date and time (with timezone)
- Who they'll be meeting with (if known): "You'll be speaking with [Specialist Name], who's one of our best."
- What to expect: "The ${ind.appointmentTerm} typically takes about [duration]. [Specialist] will [brief description of what happens]."
- What to prepare: "If you have any [relevant documents/information], it's helpful to have those handy, but not required."

**Send confirmation:** "You'll get a confirmation email at [their email] with all the details and a calendar invite."`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "webhook",
          data: {
            text: `Submit the complete lead information to the CRM/webhook. Include ALL of the following:
- Full name
- Email address
- Phone number
- Service interest (which of the ${ind.leadOptions.join(", ")} they selected)
- Timeline (ASAP / this week / this month / exploring)
- Qualification score (hot/warm/cool based on timeline and engagement level)
- ${ind.appointmentTerm} details (if scheduled: date, time, specialist)
- Call summary: brief 2-3 sentence summary of what was discussed
- Any specific questions or concerns they raised
- Source: inbound phone call`,
            webhookUrl: "",
            webhookMethod: "POST",
          },
        },
        {
          id: makeFlowId(),
          type: "end",
          data: {
            text: `Wrap up the call with genuine warmth and clear next steps.

**If an ${ind.appointmentTerm} was scheduled:**
"You're all set, [Name]! Your ${ind.appointmentTerm} is confirmed for [date/time]. Keep an eye out for that confirmation email. If anything changes or you have questions before then, don't hesitate to call us back. We're really looking forward to helping you with [their specific interest]!"

**If no ${ind.appointmentTerm} was scheduled (just exploring):**
"Thank you so much for calling, [Name]! I'll make sure our ${ind.specialist} team sends you some great resources about [their interest area]. Take your time looking things over, and when you're ready to take the next step, we're just a phone call away. Have a wonderful [day/evening]!"

**Always end with:** Make the caller feel valued and confident they made the right choice by reaching out.`,
          },
        },
      ];

    case "customer_support":
      return [
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `Hello, and thank you for reaching our ${ind.servicePlural} support team! I'm [Agent Name], and I'm here to help resolve whatever brought you in today. Let me quickly pull up your account so I can assist you as efficiently as possible.

**Tone:** Empathetic, patient, and solution-oriented. Support callers may be frustrated — your job is to make them feel heard and confident that their issue will be resolved.

**Key mindset:** Every support call is an opportunity to turn a potentially negative experience into a positive one. The caller should hang up thinking "Wow, they really took care of me."

**If they sound frustrated from the start:** Acknowledge it immediately before anything else: "I can hear this has been a frustrating experience, and I'm sorry about that. Let's get this sorted out for you right now."`,
          },
        },
        {
          id: makeFlowId(),
          type: "crm_lookup",
          data: {
            text: `Search for the caller in the CRM using their phone number to pull up their complete account profile, service history, and any open tickets or recent interactions.

**If found:**
- Greet by name: "Hi [Name], thanks for being a valued ${ind.customer} with us!"
- Reference relevant account details: "I can see your account here. Let me take a quick look at your recent activity..."
- Check for open tickets: If they have an existing support ticket, ask: "I see you recently contacted us about [issue]. Is this related to that, or is this something new?"

**If NOT found:**
- Don't make it awkward: "I'd love to pull up your account. Could you help me with the name or email address on the account?"
- If they're not in the system, they may be calling about a general question — proceed accordingly.

**Privacy note:** Verify identity before sharing sensitive account details. Ask for the account holder's name or last 4 of account number if needed.`,
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `Alright [Name], I'm ready to help! What can I assist you with today?

**How to handle the response:**
- Let them explain fully without interrupting. Even if you think you know the issue, let them finish.
- Take mental notes of key details: what happened, when it happened, what they've already tried.
- After they finish, summarize: "Okay, so let me make sure I have this right — [restate the issue]. Is that accurate?"

**If they're emotional or venting:** Let them. Don't try to jump to solutions immediately. Validate first: "I completely understand why that would be [frustrating/concerning/inconvenient]. That shouldn't have happened, and I want to make it right."`,
            options: ind.supportOptions.map((o) => ({ label: o, nextNodeId: "" })),
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `Thank you for explaining that. I want to make sure I fully understand the situation so I can get this resolved properly. Could you walk me through a few more details?

**Targeted follow-up questions (ask as relevant):**
- "When did you first notice this issue?"
- "Have you tried anything to resolve it on your end?"
- "Is this affecting your ability to [use the service/access your account/etc.]?"
- "Are there any error messages or specific details you can share?"

**Important:** Only ask follow-up questions that are genuinely needed. Don't interrogate the caller with a checklist of questions if the issue is already clear.

**Demonstrate active listening:** Reference specific things they said: "You mentioned [detail] — can you tell me a bit more about that part?"`,
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The issue can be fully resolved during this call without needing a live agent, specialized team, or escalation. You have enough information and authority to provide a direct solution, answer, or workaround.`,
          },
        },
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `I've got a clear picture of the situation now, and the good news is I can help you with this right away. Here's what I'm going to do...

**Resolution approach:**
- Explain what you're doing in plain language: "I'm going to [specific action] on your account. This should [expected result]."
- If there are steps for the caller: Walk them through one at a time. Don't dump all instructions at once.
- Confirm the fix: "Can you check on your end and let me know if that's looking better now?"

**If the fix doesn't work immediately:**
- Don't panic: "Hmm, sometimes these changes take a few minutes to take effect. Let's try [alternative approach]."
- Set expectations: "If it's not resolved within [timeframe], call us back and reference ticket number [#] so we can pick up right where we left off."

**Prevention advice (when appropriate):** "To help prevent this from happening again, you might want to [proactive tip]. Just a suggestion!"`,
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The ${ind.customer} needs to schedule a follow-up ${ind.appointmentTerm} — either because the resolution requires an in-person visit, a specialist consultation, or a scheduled callback for a complex issue that can't be resolved in one call.`,
          },
        },
        {
          id: makeFlowId(),
          type: "check_availability",
          data: {
            text: `I'd like to get you scheduled for a follow-up to make sure everything is completely taken care of. Let me check our availability.

**Present options:** "I have openings on [Day] at [Time] and [Day] at [Time]. What works best for your schedule?"
**Be accommodating:** If those don't work, offer more options. "I understand — let me look at [alternative days]."
**Set expectations:** "During the follow-up, [specialist] will [what will happen]. It typically takes about [duration]."`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "book_appointment",
          data: {
            text: `Let me confirm that follow-up ${ind.appointmentTerm} for you.

**Confirm all details clearly:**
- "Your follow-up is set for [Day], [Date] at [Time]."
- "You'll be working with [specialist/team name]."
- "Please have [any preparation items] ready if possible."
- "You'll receive a confirmation at [email/phone]."

**Link it to their issue:** "This follow-up is specifically to address the [issue they called about], so [specialist] will already have all the context from today's call."`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "webhook",
          data: {
            text: `Create a detailed support ticket with all relevant information:
- ${ind.customer} name and account ID
- Issue category (from the support options selected)
- Detailed description of the problem as described by the caller
- Steps already taken to troubleshoot (by the caller and by you)
- Resolution provided (if resolved) or escalation reason (if not)
- Follow-up ${ind.appointmentTerm} details (if scheduled)
- Priority level: Low / Medium / High / Critical
- Caller sentiment: Satisfied / Neutral / Frustrated
- Any promises or commitments made to the caller
- Internal notes for the team`,
            webhookUrl: "",
            webhookMethod: "POST",
          },
        },
        {
          id: makeFlowId(),
          type: "transfer",
          data: {
            transferNumber: "",
            text: `I want to make sure you get the absolute best help for this. I'm going to connect you with one of our ${ind.specialist}s who has deep expertise in exactly this area.

**Before transferring:**
- Explain why: "They'll be able to [specific capability you can't provide]."
- Set expectations: "I'm going to transfer you now. There might be a brief moment of hold music. [Specialist/Team] will already have all the details from our conversation, so you won't need to repeat yourself."
- Offer alternative: "If you'd prefer, I can also have them call you back within [timeframe]. Which would you prefer?"

**Warm handoff (if possible):** Brief the receiving agent with the caller's name, issue summary, and what's already been tried.`,
          },
        },
        {
          id: makeFlowId(),
          type: "end",
          data: {
            text: `Close the call by confirming everything that was accomplished and setting clear expectations.

**Summary:** "Just to recap what we covered today: [brief summary of issue + resolution/next steps]."

**If resolved:** "I'm glad we could get that sorted out for you, [Name]! If anything else comes up, don't hesitate to call — we're here for you."

**If follow-up is scheduled:** "Your follow-up is confirmed for [date/time]. In the meantime, if the issue gets worse or anything changes, please call us back immediately."

**If transferred:** This step won't be reached as the call was transferred.

**Always:** "Thank you for your patience today, [Name]. Is there anything else at all before we wrap up? ... Great, have a wonderful [day/evening]!"`,
          },
        },
      ];

    case "receptionist":
      return [
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `Good [morning/afternoon/evening]! Thank you for calling [Company Name]. I'm [Agent Name], your virtual receptionist, and I'm happy to help you with whatever you need today. Let me quickly check if we have your information on file.

**Tone:** Professional yet warm — like the best front-desk person you've ever encountered. Welcoming, organized, and capable.

**Time awareness:** Use appropriate time-of-day greeting. If the caller is calling outside business hours, acknowledge it: "Thanks for calling! Our office is currently closed, but I can absolutely help you with scheduling, general questions, or I can make sure the right person gets back to you first thing tomorrow."

**Speed:** Receptionist calls should be efficient. Callers typically know what they want — help them get there quickly without being rushed.`,
          },
        },
        {
          id: makeFlowId(),
          type: "crm_lookup",
          data: {
            text: `Look up the caller by phone number to identify them and pull up any relevant history.

**If found (returning ${ind.customer}):**
- Warm recognition: "Oh hi, [Name]! Welcome back. I see you were last in on [date] for [service]. How has everything been since then?"
- This personal touch makes a huge difference in caller satisfaction.

**If NOT found:**
- Friendly introduction: "I don't see your number in our system yet — are you a new ${ind.customer} with us, or might you be calling from a different number?"
- Collect basics: "Could I get your name? Perfect, thanks [Name]!"

**Always:** Be efficient with the lookup. Don't leave the caller in silence. If it takes a moment: "Just pulling up your file — one quick second..."`,
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `Wonderful! How can I help you today, [Name]?

**How to handle responses:**
- If they clearly state what they want: "Absolutely, I can help with that right away!"
- If they're unsure: Gently guide: "No worries — I can help you schedule a ${ind.appointmentTerm}, look up information, connect you with a specific person or department, or answer general questions. Which sounds closest to what you need?"
- If they ask for a specific person: "Let me check if [person] is available. One moment please..."

**Handling multiple requests:** If they mention several things: "I'd love to help with all of that! Let's start with [most time-sensitive item] and then we'll knock out the rest."`,
            options: ind.receptionistOptions.map((o) => ({ label: o, nextNodeId: "" })),
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The ${ind.customer} wants to schedule, reschedule, or cancel a ${ind.appointmentTerm}. This includes direct requests like "I need to book an appointment" as well as indirect signals like "I need to come in" or "When are you available?"`,
          },
        },
        {
          id: makeFlowId(),
          type: "check_availability",
          data: {
            text: `I'd be happy to help you get a ${ind.appointmentTerm} on the calendar! Let me check what we have available.

**Scheduling approach:**
- Ask for preferences first: "Do you have any preferred days or times? Mornings, afternoons?"
- Offer 2-3 options: "I've got [Day at Time], [Day at Time], or [Day at Time]. Any of those work?"
- If rescheduling: "I see your current ${ind.appointmentTerm} is on [date]. Would you like to move it earlier or later?"
- If canceling: "I can take care of that cancellation. Before I do, would you like to reschedule instead? We have some great availability coming up."

**Gathering needed info:**
- Type of ${ind.appointmentTerm}: "And what's the ${ind.appointmentTerm} for? [Service type options]"
- Duration: If relevant, confirm expected duration.
- Special requirements: "Is there anything special we should prepare or note for your visit?"`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "book_appointment",
          data: {
            text: `Let me confirm that ${ind.appointmentTerm} for you right now.

**Confirmation script:**
- "Alright, you're all set! Your ${ind.appointmentTerm} is booked for [Day], [Date] at [Time]."
- If with a specific person: "You'll be seeing [Name]."
- Location details: "That'll be at our [location/address]. There's [parking/directions info] if you need it."
- Preparation: "Please arrive about [X] minutes early. If you can bring [relevant items], that would be great."
- Confirmation delivery: "I'm sending a confirmation to [email/phone] with all the details."

**Cancellation policy (if applicable):** "Just a heads up — if you need to reschedule or cancel, we just ask for [X hours/days] notice. But we totally understand that things come up!"`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `Your ${ind.appointmentTerm} is confirmed! You'll receive a confirmation message shortly with all the details.

**Additional value:**
- "Is there anything you'd like to know ahead of your visit? Common questions include [relevant FAQs]."
- "If anything changes or you need to adjust, just give us a call and I'll take care of it."

**For new ${ind.customer}s:** "Since this is your first time with us, I just want to say — you're going to love it. Our team is fantastic and they'll take great care of you."`,
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The ${ind.customer} wants to speak with a specific person, department, or team member. This includes requests like "Can I talk to [Name]?", "I need to speak with someone about [topic]", or "Transfer me to [department]."`,
          },
        },
        {
          id: makeFlowId(),
          type: "webhook",
          data: {
            text: `Log complete call details to the CRM/system:
- Caller name and phone number
- Reason for call (scheduling / transfer / general inquiry / other)
- Actions taken: ${ind.appointmentTerm} scheduled (with details), information provided, transfer initiated
- If ${ind.appointmentTerm} was booked: date, time, type, special notes
- If transfer was requested: who they asked for, reason, whether transfer was completed
- If general inquiry: what question was asked and the answer provided
- Caller sentiment: positive / neutral / needs follow-up
- Any follow-up actions needed by the team
- Call duration and timestamp`,
            webhookUrl: "",
            webhookMethod: "POST",
          },
        },
        {
          id: makeFlowId(),
          type: "transfer",
          data: {
            transferNumber: "",
            text: `Absolutely, let me connect you with the right person. One moment, please.

**Before transferring:**
- Confirm who they need: "You'd like to speak with [Name/Department] about [reason], correct?"
- Set expectations: "I'm transferring you now. You might hear a brief moment of hold music."
- If the person is unavailable: "It looks like [Name] isn't available at the moment. I can take a message and have them call you back, or would you like to schedule a time to speak with them?"
- Leave a positive impression: "It was great talking with you, [Name]! [Person/Team] will take great care of you."`,
          },
        },
        {
          id: makeFlowId(),
          type: "end",
          data: {
            text: `Wrap up with a warm, professional close that confirms everything was handled.

**If ${ind.appointmentTerm} was scheduled:** "You're all confirmed for [date/time]. We'll see you then! If you have any questions before your visit, don't hesitate to call back."

**If call was transferred:** This step won't typically be reached.

**If general inquiry was answered:** "I'm glad I could help with that! Is there anything else at all? ... Great. Thank you for calling [Company Name], [Name]. Have a wonderful [day/evening]!"

**Always:** Leave the caller with a positive last impression. The close is what they'll remember most.`,
          },
        },
      ];

    case "dispatch":
      return [
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `Thank you for calling [Company Name] dispatch. I'm [Agent Name], and I'm here to get you the help you need as quickly as possible. Let me pull up your account while you tell me what's going on.

**Tone:** Calm, competent, and reassuring. Dispatch callers are often in stressful situations (emergencies, broken equipment, urgent needs). Your calm demeanor helps de-escalate their anxiety.

**Priority:** Speed matters on dispatch calls. Be efficient while still being thorough. Don't skip safety-critical information gathering.

**If the caller sounds panicked:** Lower your voice slightly and speak slowly: "I hear you, and I'm going to help. Take a breath — I'm on it. Let's start with the most important thing: is anyone in immediate danger?"`,
          },
        },
        {
          id: makeFlowId(),
          type: "crm_lookup",
          data: {
            text: `Look up the caller to check if they're an existing ${ind.customer} and pull up their account details, service history, and location on file.

**If found:**
- "Hi [Name], I have your account pulled up. I see your service address is [address on file] — is that where you need the ${ind.dispatchItem} today?"
- Check service history: Recent ${ind.dispatchItem} visits may be relevant (recurring issue, warranty, etc.)
- Check service agreements: Are they covered? What's their priority level?

**If NOT found:**
- Collect essentials quickly: "I'll need a few details to get you set up. What's your name and the address where you need service?"
- Don't let data collection slow down emergency response.

**For emergencies:** Skip pleasantries and go straight to the issue: "I have your account. Tell me what's happening right now."`,
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `First, help me understand the urgency. Is this an emergency or urgent situation that needs immediate attention, or is this something we can schedule at a convenient time for you?

**How to assess urgency:**
- **Emergency / Urgent:** Active safety hazard, complete service failure, significant property risk, time-critical situation. Examples: burst pipe flooding a home, no heat in freezing weather, electrical fire risk.
- **Schedulable:** Issue exists but isn't worsening rapidly, quality-of-life inconvenience, preventive maintenance, routine service. Examples: slow drain, A/C not cooling optimally, quarterly maintenance.
- **Not sure:** Caller isn't sure of severity. Help them assess: "Can you describe exactly what's happening right now? Is [relevant safety question]?"

**NEVER dismiss urgency claims.** If the caller says it's urgent, treat it as urgent. You can triage later, but always take the caller's assessment seriously initially.`,
            options: [
              { label: "Emergency / Urgent", nextNodeId: "" },
              { label: "Can be scheduled", nextNodeId: "" },
              { label: "Not sure", nextNodeId: "" },
            ],
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `Please describe what's happening in as much detail as you can. Also, can you confirm the exact address or location where the ${ind.dispatchItem} needs to go?

**Information to collect:**
1. **What's the problem?** Get a clear description. Ask targeted follow-ups: "When did it start? Has this happened before? Is it getting worse?"
2. **Exact location:** Full street address, unit/suite/floor number, gate codes, access instructions. "Is there a gate code or any special instructions for getting to you?"
3. **Scope:** How big is the issue? "Is it affecting the whole [building/system] or just one area?"
4. **Safety considerations:** "Is anyone at risk? Are there any hazards our ${ind.dispatchItem} should know about before arriving?"
5. **What's been tried:** "Have you tried anything to address it so far?"

**Keep the caller calm during this:** "You're doing great giving me all these details — this is exactly what our ${ind.dispatchItem} needs to know to help you quickly."`,
          },
        },
        {
          id: makeFlowId(),
          type: "question",
          data: {
            text: `And what's the best phone number to reach you or someone at the location? I want to make sure our ${ind.dispatchItem} can contact you directly when they're en route and upon arrival.

**Also collect:**
- Contact person's name (if different from caller): "Will you be at the location, or should our ${ind.dispatchItem} ask for someone else when they arrive?"
- Alternative contact: "Is there a backup number in case we can't reach you at this one?"
- Special access instructions: "Any parking instructions, building access codes, or landmarks to help find the location?"
- Preferred communication: "Would you like updates via text or phone call?"`,
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The request is genuinely urgent or an emergency that requires immediate dispatch. The caller has described a situation involving: active safety hazards, complete service failure affecting livability or operations, rapid worsening conditions, or significant property/asset risk. OR the caller explicitly stated it's an emergency and the description doesn't contradict that assessment.`,
          },
        },
        {
          id: makeFlowId(),
          type: "webhook",
          data: {
            text: `PRIORITY DISPATCH — Send immediate dispatch request with ALL collected information:
- **Priority level:** Emergency / Urgent
- **${ind.customer} name and account ID** (if existing customer)
- **Contact phone number** (primary + backup if provided)
- **Service address:** Full address with unit number, gate codes, access instructions
- **Problem description:** Detailed description of the issue, when it started, severity, scope
- **Safety notes:** Any hazards, risks, or safety considerations for the ${ind.dispatchItem}
- **What's been tried:** Any troubleshooting the caller has already attempted
- **Special instructions:** Parking, access, who to ask for on site
- **Estimated response time:** within ${ind.dispatchTimeframe}
- **Dispatch timestamp:** Current date and time
- **Communication preference:** Text or phone call updates`,
            webhookUrl: "",
            webhookMethod: "POST",
          },
        },
        {
          id: makeFlowId(),
          type: "message",
          data: {
            text: `I've dispatched a ${ind.dispatchItem} to your location right now. Here's what to expect:

**Set clear expectations:**
- "Our ${ind.dispatchItem} is being notified as we speak. You should expect them to arrive within **${ind.dispatchTimeframe}**."
- "You'll receive a [text/call] when they're on their way with their estimated arrival time."
- "The ${ind.dispatchItem}'s name will be included in that notification so you know who to expect."

**Safety instructions (if applicable):**
- "While you're waiting, if possible, [relevant safety advice — e.g., shut off water main, avoid the affected area, keep windows open, etc.]."
- "If the situation changes or gets worse before they arrive, call us back immediately."

**Reassurance:** "You're in good hands. Our ${ind.dispatchItem} team handles situations like this all the time. They'll get this taken care of for you."`,
          },
        },
        {
          id: makeFlowId(),
          type: "condition",
          data: {
            condition: `The request is NOT urgent — it's a routine service need, preventive maintenance, or a non-emergency issue that can wait to be scheduled at a convenient time. The caller has confirmed that scheduling works for them.`,
          },
        },
        {
          id: makeFlowId(),
          type: "check_availability",
          data: {
            text: `Since this can be scheduled, let me find a convenient time for you. When works best?

**Scheduling approach for dispatch:**
- Ask for time preferences: "Do you have a day and time that works best? We typically have [morning/afternoon] windows available."
- Offer specific windows: "I have a window on [Day] between [Time-Time], or [Day] between [Time-Time]. Which would you prefer?"
- Service window transparency: "Our service windows are typically [X hours]. The ${ind.dispatchItem} will call you [30 minutes] before arrival with a more exact time."
- Access requirements: "Will someone be available at the location during that window, or do we have a way to access the property?"`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "book_appointment",
          data: {
            text: `Let me confirm that service visit for you.

**Confirmation details:**
- "Your ${ind.dispatchItem} visit is confirmed for [Day], [Date] between [Time window]."
- "Please make sure someone is available at [address] during that window."
- "Our ${ind.dispatchItem} will call approximately 30 minutes before arrival."
- "You'll receive a confirmation with all the details at [email/phone]."

**Preparation instructions:**
- "If possible, please [clear access to the area / have the affected equipment accessible / etc.]."
- "If you need to reschedule, just call us with at least [X hours] notice and we'll find a new time."`,
            provider: "google",
          },
        },
        {
          id: makeFlowId(),
          type: "end",
          data: {
            text: `Close the dispatch call with clear confirmation and reassurance.

**For emergency dispatches:**
"Alright, [Name], your ${ind.dispatchItem} is on the way and should be there within ${ind.dispatchTimeframe}. Remember — if anything changes or gets worse, call us back immediately at this number. You'll get a notification when they're close. Hang tight, and we'll get this taken care of."

**For scheduled visits:**
"You're all set for [date/time]. Our ${ind.dispatchItem} will be in touch before they arrive. If you think of any other details about the issue before the visit, feel free to call back and we'll add notes to the work order. Thanks for calling, [Name], and don't worry — we'll get this handled!"

**Emergency reminder:** "For emergencies outside of business hours, you can always call this number and we'll dispatch someone right away."`,
          },
        },
      ];

    default:
      return [];
  }
}
