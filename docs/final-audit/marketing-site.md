# Marketing Website Audit

**Auditor:** marketing-auditor
**Date:** 2026-02-22
**Scope:** All public/marketing pages under `src/app/(marketing)/`, global layout, navigation, footer, and supporting components.

---

## Pages Audited

| Page | Route | File |
|------|-------|------|
| Home | `/` | `src/app/(marketing)/page.tsx` |
| Features | `/features` | `src/app/(marketing)/features/page.tsx` + `_features-content.tsx` |
| Pricing | `/pricing` | `src/app/(marketing)/pricing/page.tsx` + `_pricing-content.tsx` |
| About | `/about` | `src/app/(marketing)/about/page.tsx` |
| Contact | `/contact` | `src/app/(marketing)/contact/page.tsx` + `_contact-content.tsx` |
| Industries Index | `/industries` | `src/app/(marketing)/industries/page.tsx` |
| Industry Detail (x8) | `/industries/[slug]` | `src/app/(marketing)/industries/[slug]/page.tsx` |
| Privacy Policy | `/privacy` | `src/app/(marketing)/privacy/page.tsx` |
| Terms of Service | `/terms` | `src/app/(marketing)/terms/page.tsx` |
| Marketing Layout | - | `src/app/(marketing)/layout.tsx` |
| Error Boundary | - | `src/app/(marketing)/error.tsx` |
| 404 Page | - | `src/app/not-found.tsx` |

**Components Audited:**
- `src/components/marketing/layout/navbar.tsx`
- `src/components/marketing/layout/footer.tsx`
- `src/components/marketing/sections/hero.tsx`
- `src/components/marketing/sections/comparison.tsx`
- `src/components/marketing/sections/industries-grid.tsx`
- `src/components/marketing/sections/white-glove.tsx`
- `src/components/marketing/sections/live-demo.tsx`
- `src/components/marketing/sections/highlights.tsx`
- `src/components/marketing/sections/platform-features.tsx`
- `src/components/marketing/sections/faq-section.tsx`
- `src/components/marketing/sections/cta-section.tsx`

**API Routes Audited:**
- `src/app/api/contact/route.ts`
- `src/app/api/demo-call/route.ts`

**Data Files Audited:**
- `src/lib/marketing/industries.ts`

---

## 1. Page Rendering & Structure

### PASS

- **Home page** (`/`): Renders all 10 sections in sequence: Hero, Comparison, IndustriesGrid, WhiteGlove, LiveDemo, Highlights (3 blocks), Omnichannel, TelephonyStack, EnterpriseSecurity, Integrations, FAQSection, CTASection. All imports resolve correctly.
- **Features page** (`/features`): Server component wrapper with client `_features-content.tsx`. Metadata properly set.
- **Pricing page** (`/pricing`): Server component wrapper with client `_pricing-content.tsx`. Metadata properly set (title only -- see finding below).
- **About page** (`/about`): Static server component. Renders Hero, Mission, Pillars, Technology, Team, and CTA sections.
- **Contact page** (`/contact`): Server wrapper with client `_contact-content.tsx`. Form submits to `/api/contact`.
- **Industries index** (`/industries`): Server component. Maps over `industries` data. All 8 industry cards render with proper links.
- **Industry detail** (`/industries/[slug]`): Uses `generateStaticParams()` for static generation. Properly calls `notFound()` for invalid slugs. Dynamic metadata via `generateMetadata()`.
- **Privacy Policy** (`/privacy`): Static server component. All 8 sections render. Proper legal content.
- **Terms of Service** (`/terms`): Static server component. All 12 sections render. Links to `/privacy` using Next.js `Link`.
- **Marketing Layout**: Wraps all pages with `<Navbar />` and `<Footer />`. Loads Inter and Manrope fonts.
- **Error Boundary**: Client component with retry button. Properly structured.
- **404 Page**: Global not-found with link back to `/`. Clean layout.

---

## 2. Navigation & Links

### Navbar (navbar.tsx)

**PASS:**
- Logo links to `/`
- Desktop nav links: Features (`/features`), Pricing (`/pricing`), About (`/about`), Contact (`/contact`) -- all valid routes
- Industries dropdown: 8 industry links -- all match slugs in `industries.ts` data
- "Book a Demo" CTA links to `/contact` -- valid
- "Log In" links to `/login` -- valid (auth route exists)
- "Sign Up" links to `/signup` -- valid (auth route exists)
- Mobile menu: Replicates all desktop links correctly
- Mobile menu: Has `aria-label` for open/close button
- Scroll effect: Properly adds shadow on scroll
- Click-outside handler for dropdown
- Body scroll lock when mobile menu is open

### Footer (footer.tsx)

**PASS:**
- Logo links to `/`
- Platform links: Features, Pricing, Industries -- all valid
- Industry links: All 8 industries with correct slugs
- Company links: About, Contact, Log In -- all valid
- Bottom bar: Privacy Policy (`/privacy`), Terms of Service (`/terms`) -- all valid
- Copyright year: Uses `new Date().getFullYear()` -- dynamically correct

### FINDING: Footer missing "Sign Up" link
- **Severity: LOW**
- Footer "Company" section has About, Contact, Log In but no Sign Up link. The navbar has Sign Up. Consider adding to footer for consistency.

---

## 3. CTA Buttons & Routing

### PASS:

| CTA | Location | Destination | Valid? |
|-----|----------|-------------|--------|
| "Try Our Live Demo" | Home Hero | `#live-demo` (anchor) | YES |
| "Book a Demo" / "View Pricing" | Home CTASection | `/contact`, `/pricing` | YES |
| "Book a Consultation" | Home WhiteGlove | `/contact` | YES |
| "View All Integrations" | Home Integrations | `/features` | YES |
| "Book a Demo" | About CTA | `/contact` | YES |
| "Book a Demo" | Industries Index CTA | `/contact` | YES |
| "Book a Demo" / "View Pricing" | Industry Detail CTA | `/contact`, `/pricing` | YES |
| "Send Message" | Contact form | `/api/contact` (POST) | YES |
| "Call Me Now" | Live Demo form | `/api/demo-call` (POST) | YES |
| Industry cards | Home IndustriesGrid | `/industries/[slug]` | YES |
| Industry cards | Industries Index | `/industries/[slug]` | YES |
| "Back" link | Industry Detail | `/industries` | YES |

All CTAs route to valid destinations.

---

## 4. Forms

### Contact Form (`/contact`)

**PASS:**
- Fields: Name (required), Email (required), Company (required), Phone (optional), Industry (required select), Message (required)
- All fields have proper `value` and `onChange` bindings
- Form has `onSubmit` handler with `e.preventDefault()`
- Loading state with "Sending..." text and `disabled` on button
- Error state displays red text
- Success state shows "Thank You!" confirmation with CheckCircle2 icon
- API route (`/api/contact`) validates required fields, escapes HTML (XSS prevention), and has rate limiting

### Live Demo Form (Home page)

**PASS:**
- Step 1: Industry selection (8 options) with visual feedback
- Step 2: Name (required), Phone (required), Email (required), Company (optional)
- Step 3: Success state showing phone number being called
- Loading spinner during API call
- Error display in red banner
- Reset function to start over
- API route (`/api/demo-call`) validates industry, has rate limiting, normalizes phone to E.164
- Privacy notice: "Not recorded or stored" and "Standard rates may apply" shown

### FINDING: Contact form sidebar styling mismatch on light background
- **Severity: LOW**
- The "Schedule a Demo" sidebar card at `_contact-content.tsx:175-178` has `border-gray-800` and `text-white`/`text-gray-400` styling, which is designed for a dark background. However, the containing section at line 68 has `bg-white`. This card will appear with dark text on a white background with a very dark border -- it should either be restyled for the white background or placed in a dark container.

---

## 5. SEO Metadata

### Root Layout (`src/app/layout.tsx`)

**PASS:**
- `title.default`: "Invaria Labs | Enterprise Voice AI Platform"
- `title.template`: "%s | Invaria Labs"
- `description`: Present and descriptive

### Per-Page Metadata

| Page | Title | Description | Status |
|------|-------|-------------|--------|
| Home | "Invaria Labs \| Enterprise Voice AI Platform" | Present | PASS |
| Features | "Features" | Present | PASS |
| Pricing | "Pricing" | **MISSING** | FAIL |
| About | "About \| Invaria Labs" | Present | PASS |
| Contact | "Contact Us" | Present | PASS |
| Industries | "Industries \| Invaria Labs" | Present | PASS |
| Industry Detail | Dynamic: "[Name] AI Voice Agents \| Invaria Labs" | Dynamic from data | PASS |
| Privacy | "Privacy Policy \| Invaria Labs" | Present | PASS |
| Terms | "Terms of Service \| Invaria Labs" | Present | PASS |

### FINDING: Pricing page missing meta description
- **Severity: MEDIUM**
- `src/app/(marketing)/pricing/page.tsx:5` only has `title: "Pricing"` but no `description` field. All other marketing pages have descriptions. This will result in no meta description tag on the pricing page, which hurts SEO and social sharing.

### FINDING: No Open Graph (og:) or Twitter card metadata on any page
- **Severity: MEDIUM**
- No `openGraph`, `twitter`, or `og:image` metadata is defined in any marketing page or the root layout. When the site is shared on social media (Twitter, LinkedIn, Slack, etc.), it will show no preview image, no og:title, and no og:description beyond basic fallbacks. This is a significant gap for a marketing site.

---

## 6. Images & Alt Text

### FINDING: No images used across any marketing page
- **Severity: INFO**
- The marketing site uses zero `<img>` tags or Next.js `<Image>` components. All visuals are created via:
  - Lucide React icons (SVG)
  - CSS gradients and animations
  - Inline SVG noise textures
  - Tailwind CSS utility styling
- This is a deliberate design choice (icon-driven, no-image approach). There are no broken images because there are no images to break. The approach is lightweight and fast.
- However, the site currently has no hero images, screenshots, or product visuals. For a marketing site, adding product screenshots or visual demos could improve conversion.

---

## 7. Responsive Design

### PASS:

All pages use proper Tailwind responsive breakpoints:

- **Mobile (< 640px):** Single column layouts, stacked grids, mobile menu with slide-out drawer
- **Tablet (640px-1023px):** `sm:grid-cols-2` grids for industries, features, pricing
- **Desktop (1024px+):** `lg:grid-cols-4` industry grids, `lg:grid-cols-5` contact layout, full desktop navbar

**Specific responsive patterns verified:**
- Navbar: Hidden on mobile (`hidden lg:flex`), hamburger menu on mobile (`lg:hidden`)
- Hero: Text scales from `text-4xl` to `text-8xl` across breakpoints
- Comparison table: `grid-cols-4` -- this may be tight on mobile (see finding below)
- IndustriesGrid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- WhiteGlove: `md:grid-cols-2 lg:grid-cols-3`
- Contact: `lg:grid-cols-5` (3+2 split)
- Footer: `grid-cols-2 lg:grid-cols-4`
- All sections use `px-4 sm:px-6 lg:px-8` for consistent padding

### FINDING: Comparison table may overflow on mobile
- **Severity: LOW**
- The comparison section (`comparison.tsx`) uses `grid-cols-4` without any mobile breakpoint override. On a 375px screen, each column would be approximately 85px wide, which is very tight for the text content. The "Capability" column text labels like "Real-time function calling (CRM, calendar)" will likely overflow or be cut off.

---

## 8. Privacy & Terms Pages

### Privacy Policy (`/privacy`)

**PASS:**
- All 8 sections render: Introduction, Information We Collect, How We Use, Data Sharing, Data Security, Data Retention, Your Rights, Contact Us
- Effective date: February 22, 2026 (current)
- Contact email: sales@invarialabs.com (working mailto link)
- Mentions HIPAA-relevant data practices (call recordings, transcriptions)
- Mentions AES-256-GCM encryption and TLS
- 30-day deletion policy documented

### Terms of Service (`/terms`)

**PASS:**
- All 12 sections render: Acceptance, Description, Account Registration, Acceptable Use, Billing, IP, Data & Privacy, Service Availability, Limitation of Liability, Termination, Changes, Contact
- Effective date: February 22, 2026 (current)
- Links to Privacy Policy via Next.js `<Link>` -- valid route
- Contact email: sales@invarialabs.com (working mailto link)
- Mentions 30-day data export window on termination
- Covers robocall/telemarketing compliance

---

## 9. HVAC & CRM Integration Marketing Copy

### HVAC References

- The only mention of "HVAC" is in `live-demo.tsx:27`: `description: "HVAC company receptionist"` for the Home Services industry demo option
- No dedicated HVAC marketing landing page or copy exists
- The Home Services industry page covers HVAC implicitly under "Emergency Call Triage Agent" with "Severity assessment for plumbing, HVAC, electrical"

### CRM Integration References

- CRM integrations are mentioned extensively across the Features page (dedicated CRM Integration section), Pricing page FAQ, WhiteGlove section, and Integrations section on the home page
- The Integrations section on the home page lists: HubSpot (live), Salesforce (coming soon), GoHighLevel (coming soon)
- Features page mentions CRM syncing throughout

### FINDING: No dedicated marketing copy for new CRM integrations (HubSpot, Salesforce, GHL)
- **Severity: LOW**
- If new CRM integrations (HubSpot, Salesforce, GoHighLevel) have been built in the platform, the marketing site acknowledges them in the Integrations grid and Features page but does not have dedicated landing pages or in-depth case studies. The integrations are listed with short descriptions but no deep-dive content. Salesforce and GoHighLevel are marked "Coming Soon" in the Integrations grid -- verify if these are still coming soon or already shipped.

---

## 10. Accessibility

### PASS:
- Navbar hamburger button has `aria-label` ("Open menu" / "Close menu")
- Form inputs have associated `<label>` elements
- Interactive elements (buttons, links) are keyboard-focusable (native HTML elements)
- Color contrast: Dark text on light backgrounds, light text on dark backgrounds (standard patterns)
- Language attribute: `<html lang="en">` set in root layout

### FINDING: Limited ARIA attributes across marketing components
- **Severity: LOW**
- Only one `aria-label` found across all marketing components (navbar hamburger button)
- FAQ accordion buttons lack `aria-expanded` and `aria-controls`
- Live Demo step indicator lacks `aria-current` or role attributes
- Industry dropdown in navbar lacks `aria-haspopup` and `aria-expanded`
- Mobile overlay lacks `role="dialog"` and `aria-modal`

---

## 11. Error Handling

### PASS:
- Marketing layout has an `error.tsx` error boundary that catches runtime errors
- Shows friendly "Something went wrong" message with retry button
- Error is logged to console via `useEffect`
- Global `not-found.tsx` provides a clean 404 page with link to home

---

## 12. Miscellaneous Checks

### PASS:
- No lorem ipsum or placeholder text found (only HTML `placeholder` attributes on form inputs, which is correct)
- No TODO/FIXME comments found in marketing code
- No broken internal links detected (all routes verified against file system)
- All Lucide icon imports resolve to valid icon names
- All `cn()` utility calls use valid Tailwind classes
- Font loading: DM Sans (root), Inter + Manrope (marketing) -- all using `next/font/google` with display swap

### FINDING: Duplicate font loading
- **Severity: INFO**
- Root layout loads DM Sans (`--font-dm-sans`). Marketing layout loads Inter (`--font-inter`) and Manrope (`--font-manrope`). Both use `font-display: swap`. Three fonts are loaded for marketing pages. This is by design (DM Sans for app, Inter/Manrope for marketing), but the DM Sans font loaded in the root layout is unused on marketing pages.

### FINDING: Contact email is sales@ not privacy@ or support@
- **Severity: INFO**
- Privacy Policy and Terms both direct users to `sales@invarialabs.com` for privacy/legal inquiries. Consider using a dedicated `privacy@` or `legal@` address for these sensitive requests.

---

## Summary of Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| 1 | Pricing page missing meta description | MEDIUM | `src/app/(marketing)/pricing/page.tsx` |
| 2 | No Open Graph / Twitter card metadata on any page | MEDIUM | All marketing pages + root layout |
| 3 | Contact page sidebar card styled for dark bg but on white bg | LOW | `src/app/(marketing)/contact/_contact-content.tsx:175-178` |
| 4 | Comparison table may overflow on mobile (no responsive breakpoint) | LOW | `src/components/marketing/sections/comparison.tsx` |
| 5 | Footer missing Sign Up link | LOW | `src/components/marketing/layout/footer.tsx` |
| 6 | No dedicated marketing copy for new CRM integrations; Salesforce/GHL still marked "Coming Soon" | LOW | `src/components/marketing/sections/platform-features.tsx:208-225` |
| 7 | Limited ARIA attributes (FAQ, dropdown, mobile menu, live demo) | LOW | Multiple components |
| 8 | No product images/screenshots on marketing site | INFO | N/A |
| 9 | Duplicate font loading (DM Sans unused on marketing pages) | INFO | `src/app/layout.tsx`, `src/app/(marketing)/layout.tsx` |
| 10 | Privacy/Terms contact email is sales@ not privacy@ | INFO | `src/app/(marketing)/privacy/page.tsx`, `src/app/(marketing)/terms/page.tsx` |

### Severity Legend
- **CRITICAL:** Blocks launch or causes data loss
- **HIGH:** Major functionality broken or significant user impact
- **MEDIUM:** Noticeable gap that should be fixed before launch
- **LOW:** Minor issue, fix when convenient
- **INFO:** Observation, no action required

---

## Overall Assessment

The marketing website is in **good shape for launch**. All pages render correctly, all internal links are valid, all forms submit to working API endpoints with proper validation and rate limiting, and the responsive layout works across breakpoints. The two MEDIUM findings (missing pricing meta description and missing OG tags) should be addressed before launch for SEO and social sharing. The LOW findings are minor and can be addressed post-launch. No critical or high-severity issues found.
