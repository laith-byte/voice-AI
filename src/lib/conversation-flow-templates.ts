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
        { id: makeFlowId(), type: "message", data: { text: `Thank you for calling! I'm here to help you explore our ${ind.servicePlural}. Let me pull up your information real quick.` } },
        { id: makeFlowId(), type: "crm_lookup", data: { text: `Look up the caller's phone number to check if they're an existing ${ind.customer}. If found, greet them by name.` } },
        { id: makeFlowId(), type: "question", data: { text: `What type of ${ind.servicePlural} are you interested in?`, options: ind.leadOptions.map((o) => ({ label: o, nextNodeId: "" })) } },
        { id: makeFlowId(), type: "question", data: { text: "What's your timeline for getting started?", options: [{ label: "As soon as possible", nextNodeId: "" }, { label: "This week", nextNodeId: "" }, { label: "This month", nextNodeId: "" }, { label: "Just exploring options", nextNodeId: "" }] } },
        { id: makeFlowId(), type: "question", data: { text: `Great — can I get your full name and the best email to reach you?` } },
        { id: makeFlowId(), type: "condition", data: { condition: `the ${ind.customer} wants to schedule a ${ind.appointmentTerm} with a ${ind.specialist}` } },
        { id: makeFlowId(), type: "check_availability", data: { text: `Let me check our ${ind.specialist}'s availability for you. What date works best?`, provider: "google" } },
        { id: makeFlowId(), type: "book_appointment", data: { text: `Let me book that ${ind.appointmentTerm} for you now.`, provider: "google" } },
        { id: makeFlowId(), type: "webhook", data: { text: "Submit the lead information including their name, contact details, service interest, and timeline.", webhookUrl: "", webhookMethod: "POST" } },
        { id: makeFlowId(), type: "end", data: { text: `Thank you! A ${ind.specialist} will follow up with you shortly. Have a great day!` } },
      ];

    case "customer_support":
      return [
        { id: makeFlowId(), type: "message", data: { text: `Hello! Thank you for contacting our ${ind.servicePlural} support line. Let me look you up so I can assist you better.` } },
        { id: makeFlowId(), type: "crm_lookup", data: { text: `Look up the caller by phone number to identify them and pull up their account details. If found, greet them by name and reference their account.` } },
        { id: makeFlowId(), type: "question", data: { text: "What can I help you with today?", options: ind.supportOptions.map((o) => ({ label: o, nextNodeId: "" })) } },
        { id: makeFlowId(), type: "question", data: { text: "Could you provide more details about your issue so I can assist you better?" } },
        { id: makeFlowId(), type: "condition", data: { condition: "the issue can be resolved without transferring to a live agent" } },
        { id: makeFlowId(), type: "message", data: { text: "I've noted all the details. Let me get that resolved for you right away." } },
        { id: makeFlowId(), type: "condition", data: { condition: `the ${ind.customer} needs to schedule a follow-up ${ind.appointmentTerm}` } },
        { id: makeFlowId(), type: "check_availability", data: { text: `Let me check when we have availability for a follow-up. What date works for you?`, provider: "google" } },
        { id: makeFlowId(), type: "book_appointment", data: { text: `I'll book that follow-up ${ind.appointmentTerm} for you now.`, provider: "google" } },
        { id: makeFlowId(), type: "webhook", data: { text: "Create a support ticket with the caller's issue details, resolution status, and any follow-up appointments scheduled.", webhookUrl: "", webhookMethod: "POST" } },
        { id: makeFlowId(), type: "transfer", data: { transferNumber: "", text: `Let me connect you with a ${ind.specialist} who can help further with this.` } },
        { id: makeFlowId(), type: "end", data: { text: "Thank the caller and confirm the issue has been addressed, the ticket has been created, and any appointments have been scheduled." } },
      ];

    case "receptionist":
      return [
        { id: makeFlowId(), type: "message", data: { text: `Good day! Thank you for calling. I'm your virtual receptionist and I'm happy to help you.` } },
        { id: makeFlowId(), type: "crm_lookup", data: { text: `Look up the caller's phone number to identify them. If they're a returning ${ind.customer}, greet them by name and reference their history.` } },
        { id: makeFlowId(), type: "question", data: { text: "How can I help you today?", options: ind.receptionistOptions.map((o) => ({ label: o, nextNodeId: "" })) } },
        { id: makeFlowId(), type: "condition", data: { condition: `the ${ind.customer} wants to schedule or book a ${ind.appointmentTerm}` } },
        { id: makeFlowId(), type: "check_availability", data: { text: `I'd be happy to help you schedule a ${ind.appointmentTerm}! What date works best for you?`, provider: "google" } },
        { id: makeFlowId(), type: "book_appointment", data: { text: `Let me book that ${ind.appointmentTerm} for you. I'll need your name and contact info.`, provider: "google" } },
        { id: makeFlowId(), type: "message", data: { text: `Your ${ind.appointmentTerm} is confirmed! You'll receive a confirmation shortly.` } },
        { id: makeFlowId(), type: "condition", data: { condition: `the ${ind.customer} wants to speak with someone or needs to be transferred` } },
        { id: makeFlowId(), type: "webhook", data: { text: "Log the call details including the caller's name, reason for calling, and any actions taken.", webhookUrl: "", webhookMethod: "POST" } },
        { id: makeFlowId(), type: "transfer", data: { transferNumber: "", text: `Let me transfer you to the right department now. One moment please.` } },
        { id: makeFlowId(), type: "end", data: { text: "Thank the caller, confirm any scheduled appointments or actions taken, and end politely." } },
      ];

    case "dispatch":
      return [
        { id: makeFlowId(), type: "message", data: { text: `Thank you for calling our dispatch line. I'll help get a ${ind.dispatchItem} to you as quickly as possible.` } },
        { id: makeFlowId(), type: "crm_lookup", data: { text: `Look up the caller to check if they're an existing ${ind.customer}. If found, pull up their account and service history.` } },
        { id: makeFlowId(), type: "question", data: { text: "Is this an emergency or urgent situation, or can it be scheduled?", options: [{ label: "Emergency / Urgent", nextNodeId: "" }, { label: "Can be scheduled", nextNodeId: "" }, { label: "Not sure", nextNodeId: "" }] } },
        { id: makeFlowId(), type: "question", data: { text: "Can you describe what you need and provide your location or service address?" } },
        { id: makeFlowId(), type: "question", data: { text: "What's the best contact number to reach you at that location?" } },
        { id: makeFlowId(), type: "condition", data: { condition: "the request is urgent or an emergency" } },
        { id: makeFlowId(), type: "webhook", data: { text: `Dispatch a ${ind.dispatchItem} immediately. Send the caller's name, phone, location, issue description, and urgency level.`, webhookUrl: "", webhookMethod: "POST" } },
        { id: makeFlowId(), type: "message", data: { text: `I've dispatched a ${ind.dispatchItem} to your location. You should expect them within ${ind.dispatchTimeframe}. Please stay available at the number you provided.` } },
        { id: makeFlowId(), type: "condition", data: { condition: "the request can be scheduled (non-urgent)" } },
        { id: makeFlowId(), type: "check_availability", data: { text: `Since this isn't urgent, let me check when we can schedule a ${ind.dispatchItem}. What date works for you?`, provider: "google" } },
        { id: makeFlowId(), type: "book_appointment", data: { text: `Let me book that service visit for you now.`, provider: "google" } },
        { id: makeFlowId(), type: "end", data: { text: `Confirm all dispatch or scheduling details with the caller and end the call.` } },
      ];

    default:
      return [];
  }
}
