# Marketing Website Audit — Reaudit V2

## Summary

Audited all 10 marketing pages (home, about, features, pricing, contact, industries, industries/[slug], privacy, terms) plus the shared navbar, footer, and all section components. The site is overall well-built with proper SEO, working CTAs, real legal content, and good responsive patterns. Found **1 blocker**, **4 warnings**, and **3 cosmetic** issues.

---

## BLOCKERS

### B-1: Pricing FAQ says "automations" — should say "integrations"

**File:** `src/app/(marketing)/pricing/_pricing-content.tsx:142`

The FAQ answer for "What's included in all plans?" reads:

> "Every plan includes the full platform: analytics, AI evaluation, **automations**, CRM integrations, advanced agent configuration, HIPAA compliance, priority support, and more."

"Automations" was renamed to "Integrations" in the product. This is a pricing-page FAQ visible to prospects during purchase decisions. Must be corrected.

---

## WARNINGS

### W-1: Contact form industry list does not match actual industries

**File:** `src/app/(marketing)/contact/_contact-content.tsx:7-15`

The contact form industry dropdown offers: HVAC, Plumbing, Electrical, Landscaping, Roofing, General, Other.

The actual platform serves 8 verticals: Healthcare & Dental, Legal Services, Home Services, Real Estate, Insurance, Financial Services, Automotive, Hospitality.

The contact form list looks like a leftover from an earlier home-services-only version. Prospects from legal, healthcare, insurance, etc. have no matching option. The API route also validates against this exact allowlist (`src/app/api/contact/route.ts:29`), so submissions with other values would be rejected.

### W-2: Contact form has no server-side email validation

**File:** `src/app/api/contact/route.ts:20-23`

The API checks for presence of `name`, `email`, and `message` but does not validate that `email` is actually a valid email format. The frontend uses `type="email"` on the input, but server-side validation is missing. Malformed emails would be accepted and sent to the notification address.

### W-3: No individual OG tags on marketing sub-pages

**Files:** About, Contact, Features, Industries pages

The root layout defines global OpenGraph metadata (`og:title`, `og:description`, `og:image`). However, individual marketing pages (about, contact, features, industries, industries/[slug]) only export `title` and `description` via `metadata` — they do not override OpenGraph tags. When these pages are shared on social media, they will show the generic root OG description rather than the page-specific description.

The pricing page and homepage do not have this issue (homepage inherits root, pricing description is specific enough). The `/privacy` and `/terms` pages are less critical for social sharing.

### W-4: Pricing page "Get Started" buttons hit `/api/marketing-checkout` without auth

**File:** `src/app/(marketing)/pricing/_pricing-content.tsx:414-436`

The "Get Started" CTA for Starter and Professional plans calls `/api/marketing-checkout` which creates a Stripe checkout session. The success URL redirects to `/signup?success=true`. This flow works, but if the Stripe prices are not configured in the environment (missing `PLATFORM_PLAN_ID_STARTER` or `PLATFORM_PLAN_ID_PROFESSIONAL`), the button will silently fail with only a console error. No user-facing error is shown.

---

## COSMETIC

### C-1: Footer missing "Sign Up" link

**File:** `src/components/marketing/layout/footer.tsx:20-24`

The Company section in the footer links to About, Contact, and Log In. There is no "Sign Up" link. The navbar has Sign Up prominently, but the footer (which many users scroll to) lacks it.

### C-2: Privacy policy contact email uses `sales@` address

**File:** `src/app/(marketing)/privacy/page.tsx:90`

The privacy policy says to contact `sales@invarialabs.com` for data rights requests. Best practice is a dedicated `privacy@` or `support@` email for data subject requests.

### C-3: Features page CRM section shows Salesforce and GoHighLevel as "Coming Soon"

**File:** `src/app/(marketing)/features/_features-content.tsx:485-486`

The features page CRM integration section shows Salesforce and GoHighLevel labeled "Coming Soon." The pricing page feature comparison table lists "CRM integration (HubSpot, Salesforce, GoHighLevel & more)" with a checkmark on all plans — implying all are available. This is a minor inconsistency. Confirm whether these integrations are live; if not, update the pricing feature list.

---

## Section-by-Section

### 1. Links

**All internal links resolve to existing pages:**

| Link | Target | Exists? |
|------|--------|---------|
| `/` | Homepage | Yes |
| `/features` | Features page | Yes |
| `/pricing` | Pricing page | Yes |
| `/about` | About page | Yes |
| `/contact` | Contact page | Yes |
| `/industries` | Industries index | Yes |
| `/industries/[slug]` (x8) | Individual industry pages | Yes (all 8 slugs have data) |
| `/privacy` | Privacy policy | Yes |
| `/terms` | Terms of service | Yes |
| `/login` | Login page | Yes |
| `/signup` | Signup page | Yes |
| `#live-demo` | Homepage anchor | Yes (LiveDemo has `id="live-demo"`) |
| `mailto:sales@invarialabs.com` | Email link | Valid mailto |

**No external links found on marketing pages** (no broken external URLs to check).

**No dead links detected.**

### 2. CTAs

| CTA Label | Location | Routes To | Works? |
|-----------|----------|-----------|--------|
| "Book a Demo" | Navbar, homepage, about, features, pricing, industries | `/contact` | Yes |
| "View Pricing" | Homepage, features, industry pages | `/pricing` | Yes |
| "Get Started" | Pricing cards (Starter, Pro) | `/api/marketing-checkout` -> Stripe -> `/signup` | Yes (with env vars) |
| "Contact Sales" | Pricing (Enterprise card) | `/contact` | Yes |
| "Log In" | Navbar, footer | `/login` | Yes |
| "Sign Up" | Navbar | `/signup` | Yes |
| "Try Our Live Demo" | Homepage hero | `#live-demo` | Yes |
| "Call Me Now" | Live demo section | `/api/demo-call` | Yes (API exists) |
| "Book a Consultation" | White glove sections | `/contact` | Yes |
| "Add to Any Plan" | Pricing branded caller ID | `/contact` | Yes |

**No "Try Free" or "Start Free" buttons found** — previous audit issue has been resolved.

### 3. Contact Form

**Validation:**
- Required fields: Name, Email, Company, Industry, Message (all marked `required`)
- Phone is optional
- HTML5 `type="email"` on email field provides basic client-side validation
- Industry uses a `<select>` with `required` — cannot submit without selection

**XSS Protection:**
- Server-side `escapeHtml()` function sanitizes all user inputs before embedding in HTML email (`src/app/api/contact/route.ts:5-11`)
- Properly escapes `&`, `<`, `>`, `"`, `'`
- No raw user input is rendered as HTML in the response

**Rate Limiting:**
- Uses `publicEndpointLimiter` for rate limiting by IP

**Issues:**
- See W-1 (industry dropdown mismatch)
- See W-2 (no server-side email format validation)
- Form submission error handling works (try/catch with user-facing error message)

### 4. Legal Pages

**Privacy Policy** (`/privacy`):
- Real, substantive content (not placeholder)
- 8 sections: Introduction, Information We Collect, How We Use It, Data Sharing, Data Security, Data Retention, Your Rights, Contact
- Effective date: February 22, 2026
- Mentions AES-256-GCM encryption, TLS, RBAC
- Complete and professional

**Terms of Service** (`/terms`):
- Real, substantive content (not placeholder)
- 12 sections covering: Acceptance, Description of Service, Account Registration, Acceptable Use, Billing, IP, Data/Privacy, Availability, Liability, Termination, Changes, Contact
- Links to `/privacy` via Next.js Link component
- Effective date: February 22, 2026
- Complete and professional

### 5. Images

**No `<img>` or `<Image>` tags are used anywhere in marketing pages or components.** All visual elements are constructed with CSS, Lucide icons, and HTML/SVG — there are no raster images to break.

**`og-image.png`** exists at `/public/og-image.png` and is referenced in root layout OpenGraph metadata. This is the only image asset used by marketing pages.

### 6. Responsive

**Responsive patterns are properly implemented across all pages:**

- All sections use `max-w-7xl` or `max-w-5xl` containers with responsive padding (`px-4 sm:px-6 lg:px-8`)
- Grid layouts use responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Text sizes scale: `text-4xl sm:text-5xl lg:text-6xl`
- Mobile nav menu exists with slide-in panel, backdrop overlay, and body scroll lock
- No fixed pixel widths detected that would break at small screens
- Hero section uses `min-h-[85vh]` with flex layout — adapts to viewport
- Pricing cards use `md:grid-cols-3` — stack on mobile
- Feature comparison table on pricing page uses `grid-cols-4` which could be tight on 375px screens (columns will be narrow but functional)
- Contact form uses `lg:grid-cols-5` split — stacks on mobile

**Potential concern:** The pricing feature comparison table (`grid-cols-4` with feature names) may be cramped at 375px but no overflow/break detected.

### 7. SEO

| Page | Title | Description | OG Override? |
|------|-------|-------------|-------------|
| Root layout | "Invaria Labs \| Enterprise Voice AI Platform" | Yes | Yes (full OG + Twitter) |
| Homepage | "Invaria Labs \| Enterprise Voice AI Platform" | Yes | Inherits root |
| About | "About \| Invaria Labs" | Yes | No |
| Features | "Features" (template: "Features \| Invaria Labs") | Yes | No |
| Pricing | "Pricing" (template: "Pricing \| Invaria Labs") | Yes — "$499/month" mention | No |
| Contact | "Contact Us" | Yes | No |
| Industries | "Industries \| Invaria Labs" | Yes | No |
| Industry/[slug] | Dynamic: "{name} AI Voice Agents \| Invaria Labs" | Yes (from data) | No |
| Privacy | "Privacy Policy \| Invaria Labs" | Yes | No |
| Terms | "Terms of Service \| Invaria Labs" | Yes | No |

**Pricing meta description is accurate:** "Starter plan at $499/month" — matches actual plan price of $499/mo.

**Root layout OG image:** `/og-image.png` exists.

**Issue:** See W-3 — sub-pages don't override OG tags.

### 8. Content Accuracy

**"Automations" -> "Integrations" rename check:**
- Pricing FAQ at line 142: says "automations" **[BLOCKER B-1]**
- Other uses of "automations" in marketing copy refer to "SMS automations" or "no-code automations" which are feature descriptions (Zapier, Make, etc.), NOT the renamed product section. These are acceptable uses of the generic word.
- The Integrations section on the homepage (`platform-features.tsx`) and features page both correctly use "Integrations" as the section name.

**"Business Settings" -> "Knowledge Base" rename check:**
- No mention of "Business Settings" found anywhere in marketing pages or components. Clean.

**Feature accuracy:**
- 32 agent templates across 8 industries: Verified (4 agents x 8 industries in `industries.ts`)
- Knowledge Base: Correctly described on features page
- Conversation Flows: Referenced in industry templates (accurate — exists at `/portal/.../conversation-flows`)
- Phone number management: Referenced in pricing (phone numbers per plan)
- Branded Caller ID: Correctly described as $59/mo add-on
- Verified Caller ID: Correctly described as included free

**Pricing accuracy:**
- Starter: $499/mo ($399/mo annual) — matches plan data
- Professional: $899/mo ($719/mo annual) — matches plan data
- Enterprise: Custom — correct
- Overage rates: Starter $0.35/min, Professional $0.30/min — matches PLAN_DETAILS
- Annual discount: 20% — math checks out ($499 * 0.8 = $399.20, rounded to $399)
- Cost estimator: Uses real Retell pricing components (infra $0.055, telephony $0.015, etc.)

**CRM integration inconsistency:** See C-3. Salesforce and GoHighLevel shown as "Coming Soon" on features page but listed without caveats on pricing comparison table.
