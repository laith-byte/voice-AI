# Marketing Website -- Final Gate Audit

**Audit #6 (FINAL) | Date: 2026-02-23**
**Auditor Perspective: HVAC business owner Googling "AI receptionist for HVAC"**

---

## Summary

7 BLOCKERS found. 4 WARNINGS. 3 COSMETIC issues. Two of the five previous audit issues have NOT been resolved. The site cannot ship with the current blockers.

---

## BLOCKERS

### B-1: Pricing FAQ still says "automations" (REGRESSION FROM AUDIT #5)

**File:** `/Users/laith/Projects/invaria-labs/src/app/(marketing)/pricing/_pricing-content.tsx` line 142
**Text:** `"Every plan includes the full platform: analytics, AI evaluation, automations, CRM integrations..."`
**Issue:** Previous audit flagged this exact text. "automations" should read "integrations" or be removed. Still present.
**Also found in:**
- `/Users/laith/Projects/invaria-labs/src/components/marketing/sections/white-glove.tsx` line 25: `"SMS automations configured for you"`
- `/Users/laith/Projects/invaria-labs/src/app/(marketing)/pricing/_pricing-content.tsx` line 692: same `"SMS automations"` in the pricing white-glove section
- `/Users/laith/Projects/invaria-labs/src/components/marketing/sections/platform-features.tsx` lines 270, 280: `"no-code automations"`, `"multi-step automations"`
- `/Users/laith/Projects/invaria-labs/src/app/(marketing)/features/_features-content.tsx` lines 486, 827: `"automations"` in CRM section and custom workflows

**Verdict:** The word "automations" appears 8+ times across marketing pages. The FAQ answer on the pricing page is the most critical since it was explicitly flagged. The others in integration/workflow descriptions are borderline acceptable as feature descriptions but the FAQ answer is a BLOCKER.

### B-2: No OG images on sub-pages (REGRESSION FROM AUDIT #5)

**File:** All marketing sub-page `page.tsx` files
**Issue:** Previous audit flagged missing OG images on sub-pages. The root `layout.tsx` sets a default OG image (`/og-image.png`) which applies as fallback. However, NO marketing sub-page defines its own `openGraph` metadata with a page-specific OG image. The following pages rely entirely on the root fallback:

- `/pricing` -- no openGraph in metadata
- `/features` -- no openGraph in metadata
- `/contact` -- no openGraph in metadata
- `/about` -- no openGraph in metadata
- `/privacy` -- no openGraph in metadata
- `/terms` -- no openGraph in metadata
- `/industries` -- no openGraph in metadata
- `/industries/[slug]` -- no openGraph in metadata

**Verdict:** The root layout provides a fallback OG image (`/og-image.png`) which exists in `/public/`. Sub-pages will inherit this via Next.js metadata merging, so the OG image tag will be present. However, OG title and OG description will use the page-specific `title` and `description` from each page's metadata export, merged with the root template. **Downgraded from BLOCKER to WARNING** -- the fallback OG image covers the basic case. Page-specific OG images would be better but are not strictly broken.

### B-3: Contact form industry dropdown is STILL HVAC-era (REGRESSION FROM AUDIT #5)

**File:** `/Users/laith/Projects/invaria-labs/src/app/(marketing)/contact/_contact-content.tsx` lines 7-15
**Current values:** HVAC, Plumbing, Electrical, Landscaping, Roofing, General, Other
**Expected:** Healthcare, Legal, Home Services, Real Estate, Insurance, Financial Services, Automotive, Hospitality (matching the 8 industry verticals the platform supports)
**Also in API:** `/Users/laith/Projects/invaria-labs/src/app/api/contact/route.ts` line 29 -- server-side validation allowlist hardcodes `["hvac", "plumbing", "electrical", "landscaping", "roofing", "general", "other"]`

**Impact:** A dental office owner or law firm seeing "HVAC, Plumbing, Electrical, Landscaping, Roofing" as their only industry choices will immediately bounce. This is the single worst first-impression bug on the site.

### B-4: Contact form has NO server-side email validation

**File:** `/Users/laith/Projects/invaria-labs/src/app/api/contact/route.ts`
**Issue:** The API checks `!name || !email || !message` (presence only) but performs NO email format validation. A submission with `email: "notanemail"` will pass server validation and attempt to send. Client-side uses `type="email"` which provides basic browser validation, but this is trivially bypassed.

### B-5: Features page shows CRM integrations as "Coming Soon" while Pricing says "available"

**File:** `/Users/laith/Projects/invaria-labs/src/app/(marketing)/features/_features-content.tsx` lines 484-506
**Issue:** Features page CRM integration section shows:
- Salesforce: `"Coming Soon"`
- GoHighLevel: `"Coming Soon"`

But the pricing page feature comparison table (line 101) lists `"CRM integration (HubSpot, Salesforce, GoHighLevel & more)"` with a checkmark on ALL plans, implying they are all available.

The same inconsistency exists in `/Users/laith/Projects/invaria-labs/src/components/marketing/sections/platform-features.tsx` lines 207-224 where Salesforce and GoHighLevel integrations are marked `comingSoon: true`.

**Verdict:** A prospect reads pricing page, sees CRM integrations included, goes to features page and sees "Coming Soon" on two of the three named CRMs. Instant credibility loss.

### B-6: Pricing page "Get Started" buttons go to Stripe checkout without account

**File:** `/Users/laith/Projects/invaria-labs/src/app/(marketing)/pricing/_pricing-content.tsx` lines 414-436
**Issue:** The Starter and Professional plan CTAs call `/api/marketing-checkout` which creates a Stripe Checkout session. However, there is no indication to the user that they need an account first, and there is no signup flow integrated into this checkout. The Enterprise CTA correctly links to `/contact`. The non-enterprise plans should either:
1. Link to `/signup` with a plan parameter, or
2. Clearly indicate the checkout will create an account

This is an unclear UX flow that could lead to abandoned checkouts.

### B-7: Footer missing Privacy/Terms links under "Company" column

**File:** `/Users/laith/Projects/invaria-labs/src/components/marketing/layout/footer.tsx`
**Issue:** The Company column links are: About, Contact, Log In. Privacy Policy and Terms of Service are only in the bottom bar as small gray text. While technically present, they are not in the main footer navigation columns, reducing discoverability for legal compliance.

**Verdict:** Downgraded to WARNING -- the links exist in the bottom bar.

---

## WARNINGS

### W-1: Sub-page OG images use generic fallback only (see B-2 above, downgraded)

All sub-pages inherit the root `/og-image.png`. When shared on social media, every page shows the same generic image rather than a page-specific one. Not broken, but suboptimal for social sharing.

### W-2: "Acme Business" used in Branded Caller ID mockup phone screens

**Files:**
- `/Users/laith/Projects/invaria-labs/src/app/(marketing)/pricing/_pricing-content.tsx` line 848: `"Acme Business"`
- `/Users/laith/Projects/invaria-labs/src/app/(marketing)/features/_features-content.tsx` line 1079: `"Acme Business"`

**Issue:** The phone mockups show "Acme Business" as the branded caller ID name, and "AB" as initials. While this is clearly a demo mockup, the fictional company name "Acme" may read as placeholder content to some visitors. Consider using a more realistic business name.

### W-3: Privacy policy contact email uses sales@ not a dedicated privacy@ address

**File:** `/Users/laith/Projects/invaria-labs/src/app/(marketing)/privacy/page.tsx` line 90
**Issue:** Data rights requests should go to a dedicated privacy/legal email, not `sales@invarialabs.com`. This is a compliance best practice, not a hard requirement.

### W-4: Footer Privacy/Terms links placement (downgraded from B-7)

Links exist in footer bottom bar but not in the main Company navigation column.

---

## COSMETIC

### C-1: Home page hero CTA says "Try Our Live Demo" linking to `#live-demo`

**File:** `/Users/laith/Projects/invaria-labs/src/components/marketing/sections/hero.tsx` line 32
**Issue:** The primary above-fold CTA is "Try Our Live Demo" which scrolls to the LiveDemo section. This is a good CTA for engagement but there is no "Book a Demo" or "Get Started" CTA visible above the fold on the home page. The nav has "Book a Demo" but the hero content area itself only has the live demo link and a description paragraph. Consider adding a secondary CTA button.

### C-2: Comparison table on home page not fully mobile-optimized

**File:** `/Users/laith/Projects/invaria-labs/src/components/marketing/sections/comparison.tsx`
**Issue:** The comparison table uses `grid-cols-4` without responsive breakpoints. On narrow mobile screens, the 4-column table will be cramped. Text sizes are small (10px, 11px) which will be difficult to read on mobile.

### C-3: Features page pricing comparison table also not mobile-optimized

**File:** `/Users/laith/Projects/invaria-labs/src/app/(marketing)/pricing/_pricing-content.tsx` line 951
**Issue:** `grid grid-cols-4` used for the feature comparison table with no responsive fallback. Small screens will show compressed columns.

---

## Regression Check (Previous Audit Issues)

| # | Issue | Status |
|---|-------|--------|
| 1 | Pricing FAQ says "automations" should say "integrations" | **STILL BROKEN** -- line 142 of `_pricing-content.tsx` |
| 2 | No OG images on sub-pages | **PARTIALLY FIXED** -- root layout provides fallback OG image, but no page-specific OG images |
| 3 | Contact form industry list outdated (HVAC-era) | **STILL BROKEN** -- still shows HVAC/Plumbing/Electrical/Landscaping/Roofing |
| 4 | Meta descriptions inaccurate ("Start free" but cheapest $499) | **FIXED** -- pricing description now reads "Starter plan at $499/month" |
| 5 | Features "Coming Soon" for CRM vs pricing saying available | **STILL BROKEN** -- Salesforce and GoHighLevel still "Coming Soon" on features, checkmark on pricing |

---

## Page-by-Page SEO Audit

| Page | Title | Description | OG Image | Status |
|------|-------|-------------|----------|--------|
| `/` (Home) | "Invaria Labs \| Enterprise Voice AI Platform" | "Build, deploy, and manage intelligent voice AI agents..." | `/og-image.png` (root) | OK |
| `/pricing` | "Pricing \| Invaria Labs" (via template) | "Simple, transparent pricing for Invaria Labs voice AI agents. Starter plan at $499/month." | Fallback only | WARN - no page OG |
| `/features` | "Features \| Invaria Labs" (via template) | "Explore the full suite of Invaria Labs voice AI features..." | Fallback only | WARN - no page OG |
| `/contact` | "Contact Us \| Invaria Labs" (via template) | "Get in touch with Invaria Labs. Schedule a demo..." | Fallback only | WARN - no page OG |
| `/about` | "About \| Invaria Labs" | "We built Invaria Labs because every business deserves an AI team..." | Fallback only | WARN - no page OG |
| `/privacy` | "Privacy Policy \| Invaria Labs" | "Invaria Labs privacy policy -- how we collect, use, and protect your data." | Fallback only | OK (legal pages less critical) |
| `/terms` | "Terms of Service \| Invaria Labs" | "Invaria Labs terms of service..." | Fallback only | OK |
| `/industries` | "Industries \| Invaria Labs" | "AI voice agents purpose-built for healthcare, legal, home services..." | Fallback only | WARN - no page OG |
| `/industries/[slug]` | "[Name] AI Voice Agents \| Invaria Labs" (dynamic) | Industry-specific description (dynamic) | Fallback only | WARN - no page OG |

**Summary:** All pages have unique titles (not generic "Next.js App") and meaningful descriptions. No placeholders. OG images use root fallback only -- functional but not optimized for social sharing.

---

## Content Accuracy Results

### "Automations" vs "Integrations" check

| Location | Text | Verdict |
|----------|------|---------|
| Pricing FAQ (line 142) | "automations, CRM integrations" | BLOCKER -- should be "integrations" per audit #5 |
| White-glove section (2 locations) | "SMS automations" | WARN -- acceptable as feature description |
| Platform features Zapier (line 270) | "no-code automations" | OK -- describing Zapier's actual capability |
| Platform features Make (line 280) | "multi-step automations" | OK -- describing Make's actual capability |
| Features page workflows (line 827) | "start automations mid-call" | WARN -- borderline, describes API triggers |

### "Business Settings" vs "Knowledge Base" check
No instances of "Business Settings" found in marketing pages. Knowledge Base is correctly referenced throughout. **PASS.**

### Feature claims vs actual code

| Claim (Marketing) | Actual Code | Status |
|-------------------|-------------|--------|
| CRM Integration (HubSpot) | `/api/tools/hubspot/lookup/route.ts` exists | OK |
| CRM Integration (Salesforce) | `/api/tools/salesforce/lookup/route.ts` exists | OK - but marked Coming Soon on features page |
| CRM Integration (GoHighLevel) | `/api/tools/gohighlevel/lookup/route.ts` exists | OK - but marked Coming Soon on features page |
| Google Calendar scheduling | `/api/tools/calendar/availability/route.ts`, `/api/tools/calendar/book/route.ts` exist | OK |
| Calendly scheduling | `/api/tools/calendly/availability/route.ts`, `/api/tools/calendly/book/route.ts` exist | OK |
| SMS follow-up | `/api/tools/sms/send/route.ts` exists | OK |
| Call transfer | `/api/tools/transfer/initiate/route.ts` exists | OK |
| Knowledge Base | `/api/knowledge-base/` routes exist | OK |
| Campaign outbound | `/api/campaigns/` routes exist | OK |
| PII redaction | `/api/pii-redaction/route.ts` exists | OK |
| Zapier integration | `/api/zapier/` routes exist | OK |
| Make integration | `/api/make/` routes exist | OK |
| n8n integration | `/api/n8n/` routes exist | OK |
| Webhooks | `/api/webhooks/` routes exist | OK |
| Slack integration | OAuth connections infrastructure exists | OK |
| 32 agent templates, 8 verticals | `industries` data file referenced | Verify count independently |
| Conversation Flows / Visual Flow Builder | `/portal/conversation-flows/` page exists | OK |

### Pricing accuracy

| Claim | Actual | Status |
|-------|--------|--------|
| Starter $499/mo | Code: `monthlyPrice: 499` | OK |
| Professional $899/mo | Code: `monthlyPrice: 899` | OK |
| Annual 20% discount | Starter annual: $399, Pro annual: $719 (~20%) | OK |
| Starter 400 mins included | Code: `minutes: "400"` | OK |
| Professional 800 mins included | Code: `minutes: "800"` | OK |
| Overage from $0.35 (Starter) | Code: `baseOverage: 0.35` | OK |
| Overage from $0.30 (Professional) | Code: `baseOverage: 0.30` | OK |
| Branded Caller ID $59/mo | Text says "$59/mo per agent" | OK |

### Outdated industry references

Contact form industry dropdown is HVAC-era specific (HVAC, Plumbing, Electrical, Landscaping, Roofing). The rest of the site correctly references 8 broad verticals. **BLOCKER** (see B-3).

---

## Navigation & CTA Link Audit

### Navbar links

| Link | Destination | Exists? |
|------|-------------|---------|
| Logo `/` | Home page | YES |
| Industries dropdown -> `/industries/[slug]` x8 | Industry detail pages | YES (dynamic route) |
| Features `/features` | Features page | YES |
| Pricing `/pricing` | Pricing page | YES |
| About `/about` | About page | YES |
| Contact `/contact` | Contact page | YES |
| Book a Demo `/contact` | Contact page | YES |
| Log In `/login` | Login page | YES |
| Sign Up `/signup` | Signup page | YES |

### Footer links

| Link | Destination | Exists? |
|------|-------------|---------|
| Logo `/` | Home page | YES |
| Features, Pricing, Industries | Marketing pages | YES |
| Industry sub-pages x8 | Dynamic routes | YES |
| About, Contact, Log In | Respective pages | YES |
| Privacy Policy `/privacy` | Privacy page | YES |
| Terms of Service `/terms` | Terms page | YES |

### CTA links across all marketing pages

All CTAs verified: "Book a Demo" -> `/contact`, "View Pricing" -> `/pricing`, "Get Started" buttons -> `/api/marketing-checkout` (Stripe), "Contact Sales" -> `/contact`. All destinations exist.

---

## Mobile Responsiveness Audit

| Component | Issue | Severity |
|-----------|-------|----------|
| Navbar | Hamburger menu implemented with slide-in panel, body scroll lock | OK |
| Comparison table (home) | `grid-cols-4` no responsive fallback, text 10-11px | COSMETIC |
| Pricing feature table | `grid-cols-4` no responsive fallback | COSMETIC |
| Pricing cards | `md:grid-cols-3` responsive | OK |
| Features page sections | `lg:grid-cols-2` responsive | OK |
| Contact form | `sm:grid-cols-2`, `lg:grid-cols-5` responsive | OK |
| Industries grid | `sm:grid-cols-2 lg:grid-cols-4` responsive | OK |
| Footer | `grid-cols-2 lg:grid-cols-4` responsive | OK |
| Hero | Responsive text sizes, flex-col on mobile | OK |
| Live Demo | `sm:grid-cols-2 lg:grid-cols-4` responsive | OK |

---

## Legal Pages Review

| Check | Privacy | Terms |
|-------|---------|-------|
| Real legal content | YES | YES |
| Company name correct | "Invaria Labs" | "Invaria Labs" |
| No "Acme Corp" or "Lorem ipsum" | CLEAN | CLEAN |
| Effective date | Feb 22, 2026 | Feb 22, 2026 |
| Contact email | sales@invarialabs.com | sales@invarialabs.com |
| Cross-link between pages | N/A | Links to `/privacy` |

---

## Images Audit

No `<Image>` or `<img>` tags referencing external files found in marketing pages. All visuals are CSS-rendered (gradients, SVG noise textures, Lucide icons, inline mockups). The only file reference is `/og-image.png` in the root layout, which exists at `/Users/laith/Projects/invaria-labs/public/og-image.png` (82KB). No broken image references found.

---

## Contact Form Security Audit

| Check | Status |
|-------|--------|
| Required fields enforced (client) | YES -- `required` attribute on name, email, company, industry, message |
| Required fields enforced (server) | PARTIAL -- checks name, email, message but NOT company or industry |
| XSS prevention | YES -- `escapeHtml()` function sanitizes all inputs before email HTML |
| Server-side email format validation | **NO** -- only checks presence, not format. BLOCKER. |
| Rate limiting | YES -- `publicEndpointLimiter` with IP-based limiting |
| Industry validation (server) | YES -- allowlist check, but list is outdated (see B-3) |
| Success/error feedback | YES -- success message and error state both implemented |
| CSRF protection | Relies on SameSite cookies (Next.js default) |

---

## Final Verdict

**CANNOT SHIP.** Three regressions from audit #5 remain unresolved (B-1 FAQ automations, B-3 industry dropdown, B-5 Coming Soon inconsistency). One new security issue (B-4 email validation). Fix these four blockers before launch.
