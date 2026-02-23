# Marketing Site Audit Report

**Auditor:** marketing-auditor
**Date:** 2026-02-22
**Scope:** All marketing pages (`src/app/(marketing)/`) and components (`src/components/marketing/`)

---

## 1. Home Page (`/`)

**File:** `src/app/(marketing)/page.tsx`

- **SEO:** Has `title` ("Invaria Labs | Enterprise Voice AI Platform") and `description`. No per-page OG overrides -- inherits root layout OG which has title, description, siteName, type. **No OG image defined anywhere** (root layout or per-page).
- **Links:** CTASection links to `/contact` and `/pricing` -- both valid routes.
- **Components:** Renders Hero, Comparison, IndustriesGrid, WhiteGlove, LiveDemo, Highlights, Omnichannel, TelephonyStack, EnterpriseSecurity, Integrations, FAQSection, CTASection -- all resolve.

**Findings:**
- **REGRESSION** [OG-IMAGE] No Open Graph `image` property set in root layout metadata or any marketing page. Social shares will have no preview image. (W5/W6 regression target)

---

## 2. About Page (`/about`)

**File:** `src/app/(marketing)/about/page.tsx`

- **SEO:** Has unique `title` ("About | Invaria Labs") and `description`. Inherits root OG (no per-page OG override).
- **Links:** CTASection links to `/contact` -- valid.
- **Content:** Real, substantive copy (mission statement, pillars, technology, team). Not placeholder.
- **Images:** No `<img>` tags; uses Lucide icons only.
- **Responsive:** Uses `sm:`, `md:`, `lg:` breakpoints throughout with Tailwind classes.

**Findings:** No issues.

---

## 3. Contact Page (`/contact`)

**Files:** `src/app/(marketing)/contact/page.tsx`, `src/app/(marketing)/contact/_contact-content.tsx`

- **SEO:** Has unique `title` ("Contact Us") and `description`.
- **Form Validation:** Uses HTML5 `required` on name, email, company, industry, message fields. Email field uses `type="email"`. Phone is optional.
- **XSS Sanitization:** Client-side sends JSON to `/api/contact`. Server-side route (`src/app/api/contact/route.ts`) uses `escapeHtml()` on all user inputs before embedding in email HTML. Rate limiting is applied via `publicEndpointLimiter`.
- **Links:** mailto links to `sales@invarialabs.com` -- valid format.
- **Responsive:** Uses `sm:`, `lg:` breakpoints. Form grid switches from 1-col to 2-col.

**Findings:**
- **WARNING** [CONTACT-INDUSTRY-VALIDATION] Server-side validation only checks `name`, `email`, `message` -- does not validate `industry` is required even though it's `required` on the client. An API call without `industry` would succeed.
- **COSMETIC** [CONTACT-SIDEBAR-CONTRAST] The "Schedule a Demo" sidebar card (line 175-178) uses `border-gray-800` and `text-white` / `text-gray-400` classes but sits inside a `bg-white` section, creating invisible/unreadable text against the white background.

---

## 4. Features Page (`/features`)

**Files:** `src/app/(marketing)/features/page.tsx`, `src/app/(marketing)/features/_features-content.tsx`

- **SEO:** Has unique `title` ("Features") and `description`.
- **Links:** CTAs link to `/contact` and `/pricing` -- both valid.
- **Content:** Extensive real content across 14 feature sections with detailed descriptions.
- **Responsive:** Uses `sm:`, `lg:` breakpoints. Grids adapt from 1-col to 2-col. Hero padding is responsive.

**Findings:** No issues.

---

## 5. Industries Index (`/industries`)

**File:** `src/app/(marketing)/industries/page.tsx`

- **SEO:** Has unique `title` ("Industries | Invaria Labs") and `description`.
- **Links:** Links to `/industries/[slug]` for each industry. CTA links to `/contact`.
- **Data:** Imports from `@/lib/marketing/industries` -- file exists at `src/lib/marketing/industries.ts`.
- **Responsive:** Uses `sm:grid-cols-2 lg:grid-cols-4`.

**Findings:** No issues.

---

## 6. Industry Detail Page (`/industries/[slug]`)

**File:** `src/app/(marketing)/industries/[slug]/page.tsx`

- **SEO:** Dynamic metadata via `generateMetadata` -- title is `${industry.name} AI Voice Agents | Invaria Labs`, description is the industry's description. Unique per slug.
- **Links:** Back link to `/industries`, CTAs to `/contact` and `/pricing` -- all valid.
- **Static generation:** Uses `generateStaticParams` from the industries array.
- **404:** Calls `notFound()` for unknown slugs.

**Findings:** No issues.

---

## 7. Pricing Page (`/pricing`)

**Files:** `src/app/(marketing)/pricing/page.tsx`, `src/app/(marketing)/pricing/_pricing-content.tsx`

- **SEO:** Has unique `title` ("Pricing") and `description` ("Simple, transparent pricing for Invaria Labs voice AI agents. Start free and scale as you grow.").
- **Links:** Enterprise CTA links to `/contact`. All other CTAs link to `/contact`. "Book a Consultation" and "Book a Call" link to `/contact`.
- **Checkout:** Starter/Professional plans call `/api/marketing-checkout` via fetch. Enterprise links to `/contact`.
- **Responsive:** Uses `md:grid-cols-2`, `md:grid-cols-3`, `lg:grid-cols-2` etc.
- **Content:** Real pricing data, detailed FAQ, cost estimator component.

**Findings:**
- **WARNING** [PRICING-META-DESCRIPTION] The meta description says "Start free" but there is no free tier. The plans start at $499/mo (Starter). This is misleading.

---

## 8. Privacy Policy (`/privacy`)

**File:** `src/app/(marketing)/privacy/page.tsx`

- **SEO:** Has unique `title` ("Privacy Policy | Invaria Labs") and `description`.
- **Content:** Real, substantive legal content across 8 sections (Introduction, Information We Collect, How We Use Your Information, Data Sharing, Data Security, Data Retention, Your Rights, Contact Us). Not placeholder.
- **Links:** mailto link to `sales@invarialabs.com` -- valid.
- **Date:** Effective date February 22, 2026 -- current.

**Findings:** No issues.

---

## 9. Terms of Service (`/terms`)

**File:** `src/app/(marketing)/terms/page.tsx`

- **SEO:** Has unique `title` ("Terms of Service | Invaria Labs") and `description`.
- **Content:** Real, substantive legal content across 12 sections (Acceptance, Description of Service, Account Registration, Acceptable Use, Billing, IP, Data & Privacy, Availability, Liability, Termination, Changes, Contact). Not placeholder.
- **Links:** Link to `/privacy` using Next.js `<Link>` -- valid. mailto link to `sales@invarialabs.com` -- valid.
- **Date:** Effective date February 22, 2026 -- current.

**Findings:** No issues.

---

## 10. Error Page

**File:** `src/app/(marketing)/error.tsx`

- **Content:** Client component with error display and "Try Again" button. Clean and functional.

**Findings:** No issues.

---

## 11. Marketing Layout

**File:** `src/app/(marketing)/layout.tsx`

- Wraps all marketing pages with `<Navbar />` and `<Footer />`.
- Loads Inter and Manrope fonts with display: "swap" (good for performance).

**Findings:** No issues.

---

## Component Audit

### Navbar (`src/components/marketing/layout/navbar.tsx`)

- **Links:** Home (`/`), Features (`/features`), Pricing (`/pricing`), About (`/about`), Contact (`/contact`), Industries dropdown to all 8 slugs, Login (`/login`), Signup (`/signup`), "Book a Demo" (`/contact`).
- **Mobile menu:** Has all the same links. Body overflow locked when open. Click-outside closes dropdown.
- **No `#` placeholders:** All hrefs are real routes.
- **Auth routes:** `/login` and `/signup` resolve to `src/app/(auth)/login` and `src/app/(auth)/signup` (confirmed existing).
- **No `target="_blank"`** links present.

**Findings:** No issues.

### Footer (`src/components/marketing/layout/footer.tsx`)

- **Platform links:** `/features`, `/pricing`, `/industries` -- all valid.
- **Industry links:** All 8 industry slugs -- valid (match `generateStaticParams`).
- **Company links:** `/about`, `/contact`, `/login` -- all valid.
- **Bottom bar:** `/privacy`, `/terms` -- both valid.
- **Copyright:** Dynamic year via `new Date().getFullYear()`.
- **No dead links, no `#` placeholders.**

**Findings:** No issues.

### Hero (`src/components/marketing/sections/hero.tsx`)

- **Links:** `href="#live-demo"` -- this is an anchor link to the LiveDemo section which has `id="live-demo"`. Valid.
- **No images** (uses CSS gradients and SVG noise).

**Findings:** No issues.

### Comparison (`src/components/marketing/sections/comparison.tsx`)

- No external links. Data-only display component.

**Findings:** No issues.

### Live Demo (`src/components/marketing/sections/live-demo.tsx`)

- **Form validation:** Requires `callerName`, `phoneNumber`, `email` (checked in `handleSubmit`). Uses HTML input types for tel/email.
- **API:** Posts to `/api/demo-call`.
- **No XSS risk:** Inputs are sent as JSON, displayed back as text content (React auto-escapes).

**Findings:** No issues.

### Highlights (`src/components/marketing/sections/highlights.tsx`)

- No external links. Interactive tabbed display component.

**Findings:** No issues.

### Platform Features (`src/components/marketing/sections/platform-features.tsx`)

- **Links:** Integrations section has a "View All Integrations" link to `/features` -- valid.
- No images; uses Lucide icons and styled divs.

**Findings:** No issues.

### Industries Grid (`src/components/marketing/sections/industries-grid.tsx`)

- **Links:** All 8 industry cards link to `/industries/[slug]` -- valid.

**Findings:** No issues.

### White Glove (`src/components/marketing/sections/white-glove.tsx`)

- **Links:** "Book a Consultation" links to `/contact` -- valid.

**Findings:** No issues.

### FAQ Section (`src/components/marketing/sections/faq-section.tsx`)

- No external links. Accordion display only.

**Findings:** No issues.

### CTA Section (`src/components/marketing/sections/cta-section.tsx`)

- **Links:** Dynamic `primaryCta.href` and `secondaryCta.href` -- all callers pass `/contact` and `/pricing`. Valid.
- Uses Next.js `<Link>` component.

**Findings:** No issues.

---

## Cross-Cutting Checks

### Links Audit
- **No `href="#"` placeholder links** found anywhere in marketing pages or components.
- **No `target="_blank"` links** without `rel="noopener"` -- no external `target="_blank"` links exist at all.
- All internal routes verified: `/`, `/about`, `/contact`, `/features`, `/pricing`, `/privacy`, `/terms`, `/industries`, `/industries/[slug]`, `/login`, `/signup`.
- All CTAs route to `/contact` or `/pricing` -- both are valid marketing pages.

### Images Audit
- **No `<img>` or `<Image>` tags** are used anywhere in marketing pages or components. All visuals are CSS-based (gradients, SVG noise patterns) and Lucide icon components.
- No broken image references possible.

### Responsive Design
- All pages and components use Tailwind responsive prefixes: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px).
- Grid layouts switch between 1/2/3/4 columns at appropriate breakpoints.
- Font sizes scale: `text-4xl sm:text-5xl lg:text-6xl` patterns used consistently.
- Padding/margins adjust: `px-4 sm:px-6 lg:px-8` pattern used consistently.
- Mobile menu in navbar with slide-in panel for `< lg` screens.
- **375px:** Content uses `px-4` minimum padding and `max-w-7xl` containers. Forms stack to single column. Grid items go to 1-col.
- **768px (md):** 2-col grids activate. Pricing cards go to 3-col.
- **1024px (lg):** Full desktop layout. Navbar shows full navigation.
- **1440px:** Content capped at `max-w-7xl` (1280px) with auto margins.

### SEO Audit
| Page | Title | Meta Description | OG (inherited) |
|------|-------|-----------------|----------------|
| `/` | "Invaria Labs \| Enterprise Voice AI Platform" | Yes, unique | Root OG (no image) |
| `/about` | "About \| Invaria Labs" | Yes, unique | Root OG (no image) |
| `/contact` | "Contact Us \| Invaria Labs" | Yes, unique | Root OG (no image) |
| `/features` | "Features \| Invaria Labs" | Yes, unique | Root OG (no image) |
| `/industries` | "Industries \| Invaria Labs" | Yes, unique | Root OG (no image) |
| `/industries/[slug]` | "${name} AI Voice Agents \| Invaria Labs" | Yes, unique per slug | Root OG (no image) |
| `/pricing` | "Pricing \| Invaria Labs" | Yes, unique | Root OG (no image) |
| `/privacy` | "Privacy Policy \| Invaria Labs" | Yes, unique | Root OG (no image) |
| `/terms` | "Terms of Service \| Invaria Labs" | Yes, unique | Root OG (no image) |

All pages have unique titles and meta descriptions. Root layout uses `template: "%s | Invaria Labs"` for consistent title formatting.

### Contact Form Security
- Client-side: HTML5 validation (`required`, `type="email"`, `type="tel"`).
- Server-side: Validates `name`, `email`, `message` presence. Uses `escapeHtml()` on all fields before HTML email rendering. Rate-limited via `publicEndpointLimiter`.
- XSS mitigation: Proper HTML entity escaping on all user inputs.

### Privacy & Terms Content
- `/privacy`: 8 sections of real legal content. Not placeholder or lorem ipsum.
- `/terms`: 12 sections of real legal content. Not placeholder or lorem ipsum.
- Both have current effective dates (2026-02-22).

### Footer Links
All footer links verified:
- Platform: `/features`, `/pricing`, `/industries` -- all valid
- Industries: all 8 `/industries/[slug]` routes -- all valid
- Company: `/about`, `/contact`, `/login` -- all valid
- Legal: `/privacy`, `/terms` -- all valid

---

## Summary

| Category | Count | Details |
|----------|-------|---------|
| **BLOCKER** | 0 | -- |
| **WARNING** | 2 | Pricing meta says "Start free" (no free tier); Contact server-side doesn't validate industry field |
| **COSMETIC** | 1 | Contact sidebar card has white text on white background |
| **REGRESSION** | 1 | No OG image defined in root layout or any marketing page (W5/W6 target) |
| **Total** | 4 | |

### REGRESSION Details
1. **[OG-IMAGE]** The root layout `openGraph` metadata has `title`, `description`, `siteName`, and `type` but **no `image` property**. No `opengraph-image.png` file exists in the project. No per-page OG image overrides exist. Social media shares (Facebook, Twitter, LinkedIn, Slack) will render without a preview image.

### WARNING Details
1. **[PRICING-META-DESCRIPTION]** `/pricing` meta description states "Start free and scale as you grow" but the cheapest plan is $499/mo. This could be considered misleading.
2. **[CONTACT-INDUSTRY-VALIDATION]** The contact form marks industry as `required` on the client but the API route (`/api/contact/route.ts`) only validates `name`, `email`, `message`. A direct API call could skip the industry field.

### COSMETIC Details
1. **[CONTACT-SIDEBAR-CONTRAST]** In `_contact-content.tsx` line 175, the "Schedule a Demo" card uses `border-gray-800` (dark border), `text-white` and `text-gray-400` (light text) but is inside a section with `bg-white`. The text is invisible/near-invisible against the white background.
