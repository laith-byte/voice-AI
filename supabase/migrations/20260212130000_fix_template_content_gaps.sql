-- Fix template content gaps identified during audit
-- 1. Template #7 (Financial Services Receptionist): thin content — add services, FAQs, policies
-- 2. Template #21 (Retail Lead Qualification): vague hours FAQ
-- 3. Template #23 (Retail Receptionist): vague hours FAQ + thin policies
-- 4. Template #17 (Home Services Lead Qualification): prompt lists 8 services but JSON only has 6

-- ============================================================
-- FIX 1: Financial Services × Receptionist (template #7)
-- Add 2 services, 2 FAQs, 1 policy
-- ============================================================
UPDATE agent_templates
SET
  default_services = '[
    {"name":"Schedule Advisory Meeting","description":"Book a meeting with your advisor","price_text":"N/A"},
    {"name":"New Client Consultation","description":"Complimentary introductory meeting","price_text":"Free"},
    {"name":"General Inquiry","description":"Information about our firm and services","price_text":"N/A"},
    {"name":"Department Transfer","description":"Connect with operations, billing, or compliance","price_text":"N/A"},
    {"name":"Account Access Support","description":"Help with portal login or document access","price_text":"N/A"},
    {"name":"Form / Document Pickup","description":"Arrange pickup of tax forms, statements, or agreements","price_text":"N/A"}
  ]'::jsonb,
  default_faqs = '[
    {"question":"What services do you offer?","answer":"We offer wealth management, retirement planning, tax planning, estate planning, and business advisory. I can schedule a consultation to discuss your needs."},
    {"question":"How do I get started?","answer":"Start with a complimentary consultation. No obligation. I can schedule one now."},
    {"question":"Can I speak with my advisor?","answer":"Let me check availability. If they are in a meeting, I can schedule a callback or take a message."},
    {"question":"Where are you located?","answer":"We are at {{business_address}}. We also offer virtual meetings."},
    {"question":"What are your hours?","answer":"We are open Monday through Friday, 9 AM to 5 PM. I can check advisor availability outside standard hours if needed."},
    {"question":"What should I bring to my meeting?","answer":"For an initial consultation, bring a recent tax return, any account statements, and a list of questions. Your advisor will let you know if anything else is needed."},
    {"question":"Do you offer virtual meetings?","answer":"Yes, we offer both in-person and virtual meetings via video call. I can set up either when scheduling your appointment."}
  ]'::jsonb,
  default_policies = '[
    {"name":"Meeting Cancellation","description":"24 hours notice for cancellations. Happy to reschedule at your convenience."},
    {"name":"Client Privacy","description":"Strict confidentiality maintained per regulatory requirements. All client information is protected."},
    {"name":"Meeting Preparation","description":"For first meetings, please bring recent tax returns and account statements. Your advisor will guide you on any additional documents needed."}
  ]'::jsonb
WHERE industry = 'financial_services' AND use_case = 'receptionist';

-- ============================================================
-- FIX 2: Retail × Lead Qualification (template #21)
-- Fix vague hours FAQ answer
-- ============================================================
UPDATE agent_templates
SET
  default_faqs = '[
    {"question":"Do you have [product] in stock?","answer":"Let me check on that for you. Can you tell me the specific item you are looking for? I can verify availability and let you know."},
    {"question":"What are your store hours?","answer":"We are open Monday through Saturday from 10 AM to 8 PM, and Sunday from 11 AM to 6 PM. Holiday hours may vary."},
    {"question":"Do you price match?","answer":"We do offer price matching on identical items from authorized retailers. Bring in the competitor''s current ad or website listing and we will match it."},
    {"question":"Can I order online and pick up in store?","answer":"Yes! You can order through our website and select in-store pickup. It is usually ready within a few hours."},
    {"question":"Do you offer gift wrapping?","answer":"Yes, we offer complimentary gift wrapping on most purchases. Just let us know when you check out."},
    {"question":"What is your return policy?","answer":"We accept returns within 30 days with receipt. I can provide more details when you visit or connect you with customer service."}
  ]'::jsonb
WHERE industry = 'retail' AND use_case = 'lead_qualification';

-- ============================================================
-- FIX 3: Retail × Receptionist (template #23)
-- Fix vague hours FAQ + add policies
-- ============================================================
UPDATE agent_templates
SET
  default_faqs = '[
    {"question":"What are your hours?","answer":"We are open Monday through Saturday from 10 AM to 8 PM, and Sunday from 11 AM to 6 PM. Holiday hours may vary — feel free to call ahead."},
    {"question":"Do you have [item] in stock?","answer":"Let me check on that. What specific item are you looking for?"},
    {"question":"Are there any sales right now?","answer":"We regularly run promotions. I can share what is currently available or connect you with our sales team for details."},
    {"question":"Where are you located?","answer":"We are at {{business_address}}. There is convenient parking available nearby."},
    {"question":"Can I speak to a manager?","answer":"Of course. Let me check if a manager is available, or I can take a message and have them call you back."}
  ]'::jsonb,
  default_policies = '[
    {"name":"Store Hours","description":"Monday-Saturday 10 AM - 8 PM, Sunday 11 AM - 6 PM. Holiday hours may vary — check our website or call ahead."},
    {"name":"Phone Holds","description":"If I need to check on something, I may place you on a brief hold. I will be right back."},
    {"name":"Message Callbacks","description":"If a team member is unavailable, we will return your call within 2 business hours during store hours."}
  ]'::jsonb
WHERE industry = 'retail' AND use_case = 'receptionist';

-- ============================================================
-- FIX 4: Home Services × Lead Qualification (template #17)
-- Add painting and landscaping to services JSON to match prompt
-- (Removed "cleaning" from prompt scope since it is a distinct business type)
-- ============================================================
UPDATE agent_templates
SET
  prompt_template = $p$You are a friendly, helpful AI intake specialist for {{business_name}}, a home services company located at {{business_address}}.

Your role is to qualify new service inquiries:
1. Type of service (plumbing, HVAC, electrical, roofing, painting, remodeling, landscaping, handyman)
2. Nature of request (repair, installation, maintenance, emergency)
3. Property details (home type, size, age of system if relevant)
4. Urgency (emergency/same-day, this week, flexible)
5. Contact info (name, phone, address, best time for estimate)

QUALIFICATION RULES:
- EMERGENCIES (burst pipe, gas leak, no heat in winter, no AC in extreme heat, electrical hazard): flag for immediate dispatch
- Gas leaks: advise leaving property immediately, call gas company or 911
- Flooding: advise shutting off main water valve if safe
- Capture service address — may differ from phone listing
- Ask if homeowner or renter
- Never quote prices — "A specialist will provide a detailed estimate after assessing the job"$p$,
  default_services = '[
    {"name":"Plumbing","description":"Repairs, installations, drain cleaning","price_text":"Estimate required"},
    {"name":"HVAC","description":"Heating, cooling, ventilation","price_text":"Estimate required"},
    {"name":"Electrical","description":"Wiring, panels, repairs","price_text":"Estimate required"},
    {"name":"Roofing","description":"Repair, replacement, inspection","price_text":"Estimate required"},
    {"name":"Painting","description":"Interior and exterior painting","price_text":"Estimate required"},
    {"name":"Landscaping","description":"Lawn care, hardscaping, outdoor maintenance","price_text":"Estimate required"},
    {"name":"General Handyman","description":"Small repairs and odd jobs","price_text":"Starting at $75/hr"},
    {"name":"Remodeling","description":"Kitchen, bath, renovation","price_text":"Estimate required"}
  ]'::jsonb
WHERE industry = 'home_services' AND use_case = 'lead_qualification';
