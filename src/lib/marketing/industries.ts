export interface AgentTemplate {
  name: string;
  description: string;
  features: string[];
}

export interface IndustryData {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  painPoints: string[];
  metrics: { label: string; value: string }[];
  agents: AgentTemplate[];
}

export const industries: IndustryData[] = [
  {
    slug: "healthcare",
    name: "Healthcare & Dental",
    description: "AI voice agents that handle patient calls 24/7 — scheduling appointments, verifying insurance, routing urgent calls, and managing prescription refills without putting anyone on hold.",
    icon: "Stethoscope",
    color: "teal",
    painPoints: [
      "Front desk staff are overwhelmed during peak hours, leading to 30%+ of patient calls going unanswered.",
      "No-shows cost dental and medical practices an average of $200 per missed appointment.",
      "After-hours calls for prescription refills and lab results create a bottleneck every morning.",
      "Patient intake forms collected over the phone are error-prone and time-consuming.",
    ],
    metrics: [
      { label: "Fewer No-Shows", value: "35%" },
      { label: "Calls Answered Instantly", value: "100%" },
      { label: "Staff Hours Saved Weekly", value: "20+" },
    ],
    agents: [
      {
        name: "AI Receptionist",
        description: "Answers every call instantly, schedules appointments, verifies insurance eligibility, and handles patient intake — all without putting callers on hold.",
        features: ["Appointment scheduling with calendar sync", "Insurance verification and eligibility checks", "Conversation Flows for guided patient intake", "Warm transfer to staff for complex needs"],
      },
      {
        name: "Appointment Reminder & Follow-Up Agent",
        description: "Proactively calls patients to confirm upcoming appointments, reschedule no-shows, and follow up after visits to ensure satisfaction.",
        features: ["Automated reminder calls at 48h and 24h", "One-call rescheduling for cancellations", "Post-visit follow-up and satisfaction checks", "Waitlist backfill when cancellations occur"],
      },
      {
        name: "Patient Triage & Routing Agent",
        description: "Assesses incoming calls for urgency, provides guidance for common concerns, and routes emergency calls to the appropriate provider immediately.",
        features: ["Symptom-based urgency assessment", "After-hours emergency routing protocols", "Common question handling from knowledge base", "Escalation to on-call providers for urgent cases"],
      },
      {
        name: "Prescription Refill & Lab Results Agent",
        description: "Handles prescription refill requests and notifies patients when lab results are ready, reducing morning call volume by up to 60%.",
        features: ["Prescription refill request intake", "Lab result notification with plain-language summaries", "Pharmacy coordination and transfer", "Automatic escalation for abnormal results"],
      },
    ],
  },
  {
    slug: "legal",
    name: "Legal Services",
    description: "AI voice agents that capture every potential client, streamline intake, and keep existing clients informed — without consuming billable attorney hours.",
    icon: "Scale",
    color: "gold",
    painPoints: [
      "Up to 40% of prospective client calls go unanswered during business hours.",
      "Manual client intake processes delay case evaluation by days.",
      "Clients call repeatedly for status updates, consuming paralegal time.",
      "Document collection requires constant follow-up and missed deadlines.",
    ],
    metrics: [
      { label: "More Leads Captured", value: "42%" },
      { label: "Faster Client Intake", value: "3x" },
      { label: "Reduction in Status Calls", value: "60%" },
    ],
    agents: [
      {
        name: "Client Intake & Case Screening Agent",
        description: "Captures prospective client details 24/7, performs initial case screening, and qualifies leads before attorney review.",
        features: ["Practice-area-specific intake questionnaires", "Conflict-of-interest pre-screening", "Lead scoring based on case type and urgency", "Zapier integration for CRM and case management"],
      },
      {
        name: "Appointment Scheduling & Follow-Up Agent",
        description: "Books consultations into attorney calendars, sends preparation instructions, and follows up on missed appointments.",
        features: ["Attorney calendar integration", "Pre-consultation document checklist delivery", "Automated no-show follow-up", "Consultation fee collection"],
      },
      {
        name: "Case Status Update Agent",
        description: "Provides existing clients with real-time case status updates and next steps without requiring attorney involvement.",
        features: ["Secure client identity verification", "Case management system integration", "Proactive milestone notifications", "Escalation for complex inquiries"],
      },
      {
        name: "Document Request & Reminder Agent",
        description: "Automates document collection through outbound calls with persistent, professional follow-up.",
        features: ["Outbound campaigns for outstanding documents", "Step-by-step submission guidance", "Deadline tracking with escalating reminders", "Confirmation once documents are received"],
      },
    ],
  },
  {
    slug: "home-services",
    name: "Home Services",
    description: "AI voice agents that dispatch the right technician, capture every emergency call, and turn one-time jobs into recurring customers.",
    icon: "Wrench",
    color: "teal",
    painPoints: [
      "Missed calls during peak hours cost an estimated $1,200 per lost job.",
      "Emergency after-hours calls go to generic answering services that can't dispatch.",
      "50%+ of quoted jobs are never booked due to lack of follow-up.",
      "Collecting customer reviews requires manual effort that rarely happens.",
    ],
    metrics: [
      { label: "Increase in Booked Jobs", value: "28%" },
      { label: "Emergency Response Time", value: "<90s" },
      { label: "Estimate-to-Booking Lift", value: "45%" },
    ],
    agents: [
      {
        name: "Service Dispatch & Scheduling Agent",
        description: "Handles inbound service requests, matches the right technician, and books appointments with real-time calendar sync.",
        features: ["Skill-based technician matching", "Real-time availability calendar", "Conversation Flows for service triaging", "Customer history lookup via Zapier"],
      },
      {
        name: "Emergency Call Triage Agent",
        description: "Operates 24/7 to assess emergency severity, provide safety guidance, and dispatch on-call technicians.",
        features: ["Severity assessment for plumbing, HVAC, electrical", "Immediate safety instructions", "On-call technician notification", "Life-safety escalation protocols"],
      },
      {
        name: "Estimate Follow-Up & Booking Agent",
        description: "Contacts customers with pending estimates to answer questions and convert quotes into booked jobs.",
        features: ["Follow-up at 24h, 72h, and 7-day intervals", "Financing and payment plan options", "One-call booking with deposit", "Seasonal promotion delivery"],
      },
      {
        name: "Customer Satisfaction & Review Agent",
        description: "Contacts customers post-service to ensure satisfaction and request online reviews.",
        features: ["Post-service satisfaction surveys", "Issue escalation for unhappy customers", "Google and Yelp review requests", "Referral program promotion"],
      },
    ],
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    description: "AI voice agents that qualify leads instantly, schedule showings around the clock, and keep all parties informed throughout transactions.",
    icon: "Building2",
    color: "gold",
    painPoints: [
      "Leads have a 5-minute response window, but agents respond in 2+ hours on average.",
      "Scheduling showings involves endless phone tag between buyers and agents.",
      "Open house attendees rarely receive timely follow-up.",
      "Transaction updates require constant manual communication.",
    ],
    metrics: [
      { label: "Faster Lead Response", value: "10x" },
      { label: "More Showings Scheduled", value: "52%" },
      { label: "Lead-to-Client Conversion Lift", value: "33%" },
    ],
    agents: [
      {
        name: "Lead Qualification & Property Matching Agent",
        description: "Responds to new leads within seconds, qualifies buyers, and matches them with relevant listings.",
        features: ["Instant response to web leads", "Budget and pre-approval qualification", "Conversation Flows for lead qualification", "Zapier-powered CRM and MLS sync"],
      },
      {
        name: "Showing Scheduler Agent",
        description: "Coordinates showings by checking availability across agents, sellers, and buyers.",
        features: ["Multi-party availability coordination", "Showing confirmations and reminders", "Lockbox code delivery", "Rescheduling and waitlist backfill"],
      },
      {
        name: "Open House Follow-Up Agent",
        description: "Contacts every open house attendee within 24 hours to gauge interest and schedule private showings.",
        features: ["Automated 24-hour follow-up calls", "Interest assessment and feedback", "Private showing booking", "Long-term prospect nurturing"],
      },
      {
        name: "Transaction Update & Document Agent",
        description: "Keeps all parties informed with milestone updates, document requests, and closing timeline communications.",
        features: ["Proactive milestone updates", "Document deadline reminders", "Inspection and closing coordination", "Post-closing review requests"],
      },
    ],
  },
  {
    slug: "insurance",
    name: "Insurance",
    description: "AI voice agents that capture quote requests 24/7, prevent policy lapses, streamline claims intake, and identify cross-sell opportunities.",
    icon: "Shield",
    color: "teal",
    painPoints: [
      "Quote requests outside hours are lost to competitors, costing ~$450 per missed policy.",
      "Manual renewal outreach leads to 15-20% preventable lapse rates.",
      "First notice of loss calls often hit voicemail, delaying claims.",
      "Cross-sell opportunities are identified but never acted on.",
    ],
    metrics: [
      { label: "Reduction in Policy Lapses", value: "22%" },
      { label: "Faster Claims Intake", value: "4x" },
      { label: "Cross-Sell Revenue Increase", value: "18%" },
    ],
    agents: [
      {
        name: "Quote Request & Pre-Qualification Agent",
        description: "Captures quote requests 24/7, gathers underwriting info, and pre-qualifies prospects.",
        features: ["Conversation Flows for intake questionnaires", "Risk profile data collection", "Instant estimation for standard profiles", "Zapier integration for lead routing"],
      },
      {
        name: "Policy Renewal Reminder Agent",
        description: "Contacts policyholders before renewal deadlines to confirm coverage and prevent lapses.",
        features: ["Outbound reminders at 60, 30, and 7 days", "Coverage review and change discovery", "Payment arrangement setup", "Escalation for complex modifications"],
      },
      {
        name: "Claims Intake & Status Agent",
        description: "Handles first notice of loss with structured data collection and provides ongoing claims status updates.",
        features: ["Guided FNOL by claim type", "Photo/document upload instructions via SMS", "Real-time claims status inquiries", "Emergency service coordination"],
      },
      {
        name: "Cross-Sell & Coverage Review Agent",
        description: "Identifies coverage gaps and reaches out with personalized bundling recommendations.",
        features: ["Book-of-business gap analysis", "Personalized bundling offers", "Life event triggers", "Warm transfer to licensed agents"],
      },
    ],
  },
  {
    slug: "financial-services",
    name: "Financial Services",
    description: "AI voice agents that book qualified appointments, handle routine inquiries, manage payment reminders, and generate referrals.",
    icon: "Landmark",
    color: "gold",
    painPoints: [
      "Advisors spend 30% of their week on administrative calls instead of revenue activities.",
      "Routine balance inquiries flood call centers, increasing wait times.",
      "Payment delinquency outreach is manual and often too late.",
      "Referral programs lack systematic outreach.",
    ],
    metrics: [
      { label: "More Qualified Appointments", value: "40%" },
      { label: "Reduction in Call Center Volume", value: "55%" },
      { label: "Collection Rate Improvement", value: "31%" },
    ],
    agents: [
      {
        name: "Appointment Booking & Pre-Qualification Agent",
        description: "Books appointments with advisors and loan officers while pre-qualifying prospects.",
        features: ["Advisor calendar integration", "Financial goal pre-qualification", "Conversation Flows for compliance scripting", "Zapier-powered CRM updates"],
      },
      {
        name: "Account Status & Balance Inquiry Agent",
        description: "Provides authenticated clients with balances, transactions, and statement info.",
        features: ["Multi-factor voice authentication", "Real-time balance lookups", "Statement request scheduling", "Fraud inquiry escalation"],
      },
      {
        name: "Payment Reminder & Collections Agent",
        description: "Manages outbound payment reminder campaigns with compliant communication.",
        features: ["Tiered reminder cadence", "Payment arrangement negotiation", "PCI-compliant phone payments", "FDCPA regulatory compliance"],
      },
      {
        name: "Product Inquiry & Referral Agent",
        description: "Handles product inquiries, educates prospects, and generates client referrals.",
        features: ["Product education for loans and investments", "Needs-based recommendations", "Referral program outreach", "Warm transfer to licensed reps"],
      },
    ],
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "AI voice agents that fill service bays, qualify sales leads, schedule test drives, and build lasting customer relationships.",
    icon: "Car",
    color: "teal",
    painPoints: [
      "Service departments lose ~$300 per missed appointment from unfilled bay time.",
      "Sales teams respond to leads in 4+ hours; buyers expect minutes.",
      "30% of scheduled test drives result in no-shows.",
      "Post-purchase follow-up is inconsistent, hurting CSI scores.",
    ],
    metrics: [
      { label: "More Service Appointments", value: "34%" },
      { label: "Faster Sales Lead Response", value: "8x" },
      { label: "CSI Score Improvement", value: "19%" },
    ],
    agents: [
      {
        name: "Service Appointment & Recall Agent",
        description: "Schedules service, notifies about recalls, and manages bay calendar utilization.",
        features: ["Service menu with pricing transparency", "Recall notification and scheduling", "Conversation Flows for service booking", "Zapier sync with DMS systems"],
      },
      {
        name: "Sales Lead Qualification Agent",
        description: "Responds to internet leads within seconds, qualifies buyers, and routes hot leads to the floor.",
        features: ["Instant response to web leads", "Budget and trade-in qualification", "Vehicle availability confirmation", "Priority routing with full lead profile"],
      },
      {
        name: "Test Drive Scheduler Agent",
        description: "Coordinates test drives, confirms with reminders, and handles rescheduling to reduce no-shows.",
        features: ["Scheduling with vehicle availability", "Pre-visit document reminders", "Confirmation calls with directions", "No-show follow-up and rescheduling"],
      },
      {
        name: "Customer Follow-Up & Review Agent",
        description: "Contacts customers after visits to ensure satisfaction and collect reviews.",
        features: ["Satisfaction calls at 48h, 30d, 90d", "CSI survey administration", "Issue resolution before survey", "Google and DealerRater review requests"],
      },
    ],
  },
  {
    slug: "hospitality",
    name: "Hospitality & Restaurants",
    description: "AI voice agents that manage reservations, handle catering inquiries, deliver concierge service, and collect guest feedback.",
    icon: "UtensilsCrossed",
    color: "gold",
    painPoints: [
      "Restaurants miss 35% of reservation calls during peak hours.",
      "Catering inquiries require detailed back-and-forth that ties up managers for hours.",
      "Hotel desks are overwhelmed with routine requests that pull staff from in-person service.",
      "Post-stay feedback collection misses opportunities to prevent negative reviews.",
    ],
    metrics: [
      { label: "More Reservations Captured", value: "38%" },
      { label: "Faster Catering Response", value: "5x" },
      { label: "Increase in Positive Reviews", value: "27%" },
    ],
    agents: [
      {
        name: "Reservation & Waitlist Agent",
        description: "Handles reservation calls 24/7, manages waitlists, and fills cancellation slots.",
        features: ["Real-time table availability", "Waitlist with estimated wait times", "Conversation Flows for reservation handling", "Zapier integration for POS and booking systems"],
      },
      {
        name: "Catering & Event Inquiry Agent",
        description: "Captures event inquiries with requirements, provides preliminary pricing, and schedules tastings.",
        features: ["Event qualification and budget capture", "Menu package presentation", "Tasting and site visit scheduling", "Deposit and contract follow-up"],
      },
      {
        name: "Guest Services & Concierge Agent",
        description: "Provides concierge-level phone support for room requests, recommendations, and coordination.",
        features: ["Room service and housekeeping requests", "Local dining and entertainment recommendations", "Wake-up calls and checkout reminders", "VIP preference tracking"],
      },
      {
        name: "Feedback & Review Collection Agent",
        description: "Contacts guests post-visit to collect feedback, resolve issues, and encourage reviews.",
        features: ["Post-visit calls within 24 hours", "Issue detection with manager escalation", "TripAdvisor and Google review guidance", "Loyalty program enrollment"],
      },
    ],
  },
];

export function getIndustryBySlug(slug: string): IndustryData | undefined {
  return industries.find((ind) => ind.slug === slug);
}
