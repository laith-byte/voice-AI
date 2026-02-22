# Marketing Website Audit -- Second Pass
**Date:** 2026-02-22
**Scope:** All marketing and auth pages, shared components, root layout, API routes

---

## BLOCKERS

1. **Homepage missing metadata export** (`src/app/(marketing)/page.tsx`)
   - The homepage has NO `metadata` export. No `<title>` or `<meta description>` will be set for the most important page on the site. Every other marketing page exports metadata except this one and the features page.

2. **Features page missing metadata export** (`src/app/(marketing)/features/page.tsx`)
   - No `metadata` export. This is a "use client" component so it cannot export metadata at all from this file. Either needs a separate `metadata` export from a layout/page wrapper or the page needs to be restructured.

3. **Contact page missing metadata export** (`src/app/(marketing)/contact/page.tsx`)
   - No `metadata` export. Also "use client" so metadata cannot be exported from this file.

4. **Contact page placeholder content visible to users** (`src/app/(marketing)/contact/page.tsx:181-182`)
   - "Calendar booking widget" and "Calendly integration coming soon" are visible placeholder text. These should be removed or replaced before launch.

5. **Contact page placeholder phone number** (`src/app/(marketing)/contact/page.tsx:203`)
   - "(888) 555-0199" with explicit text "Placeholder number" is visible to users. This is a fake 555 number that will not work.

6. **Root layout metadata is too generic** (`src/app/layout.tsx:13-16`)
   - Title is just "Invaria Labs", description is just "Voice AI Platform". Should be more descriptive for SEO as this serves as default/fallback.

7. **Contact form validation mismatch** (`src/app/api/contact/route.ts:16` vs `src/app/(marketing)/contact/page.tsx`)
   - API requires `name`, `email`, and `message`. But the contact form makes `message` optional (no `required` attribute on textarea at line 149). A user could submit without a message and get a 400 error with no client-side indication of why.

---

## WARNINGS

1. **About page fake team members** (`src/app/(marketing)/about/page.tsx:113-114`)
   - Placeholder disclaimer is visible: "* Placeholder team members for demonstration purposes". The team section contains fictional names (Alex Rivera, Jordan Patel, Sam Nakamura). This needs real team data or removal before launch.

2. **Footer social links are non-functional** (`src/components/marketing/layout/footer.tsx:41-43`)
   - LinkedIn and X (Twitter) social icons in the footer are plain `<span>` elements, not links. They display "Li" and "X" text but are not clickable and do not link to any social profiles. They should either link to real profiles or be removed.

3. **Login page has no metadata export** (`src/app/(auth)/login/page.tsx`)
   - "use client" component with no metadata. Same for all auth pages (signup, forgot-password, reset-password, setup-account). These pages won't have proper titles in browser tabs.

4. **Signup page has no metadata export** (`src/app/(auth)/signup/page.tsx`)
   - Same as login -- no metadata possible from "use client".

5. **Forgot-password page has no metadata export** (`src/app/(auth)/forgot-password/page.tsx`)
   - Same issue.

6. **Reset-password page has no metadata export** (`src/app/(auth)/reset-password/page.tsx`)
   - Same issue.

7. **Setup-account page has no metadata export** (`src/app/(auth)/setup-account/page.tsx`)
   - Same issue.

8. **Pricing page "use client" prevents metadata export** (`src/app/(marketing)/pricing/page.tsx`)
   - Entire page is "use client" so no metadata can be exported. Browser tab will show fallback "Invaria Labs" only.

9. **Contact form `industry` field mismatch** (`src/app/(marketing)/contact/page.tsx:131-136`)
   - The form requires selecting an industry (HTML `required`), but the API route (`/api/contact`) does not use the `industry` field at all -- it is silently discarded. Not a blocker but could confuse users or lose data.

10. **Navbar does not highlight active page** (`src/components/marketing/layout/navbar.tsx`)
    - No active state styling on nav links. Users cannot tell which page they are currently on.

11. **Features page comment numbering error** (`src/app/(marketing)/features/page.tsx:1032`)
    - Comment says "FEATURE 12: Branded Caller ID" but it should be "FEATURE 14" based on the sequence. Minor code quality issue, not user-facing.

12. **escapeHtml missing single-quote escaping** (`src/app/api/contact/route.ts:4-10`)
    - The `escapeHtml` function does not escape single quotes (`'`). While `&quot;` handles double quotes, single quotes in HTML attribute contexts could still be an XSS vector. Should add `.replace(/'/g, "&#39;")`.

---

## COSMETIC

1. **Privacy and Terms pages use `<a>` tag for internal link** (`src/app/(marketing)/terms/page.tsx:77`)
   - The Terms page links to `/privacy` using a raw `<a href="/privacy">` instead of Next.js `<Link>`. This causes a full page reload instead of client-side navigation. Same for email links (`mailto:`) which are fine as `<a>`.

2. **Privacy page email uses `sales@invarialabs.com`** (`src/app/(marketing)/privacy/page.tsx:90`)
   - Contact email in privacy policy is `sales@invarialabs.com`. Might want a dedicated privacy/legal email instead.

3. **Terms page email uses `sales@invarialabs.com`** (`src/app/(marketing)/terms/page.tsx:126`)
   - Same as above.

4. **Contact page uses `hello@invarialabs.com`** (`src/app/(marketing)/contact/page.tsx:193`)
   - Different email than privacy/terms pages. Ensure consistency.

5. **Pricing page has hardcoded date "February 2026"** in the cost estimator calendar visual -- this will become stale.

6. **Features page appointment calendar shows "February 2026"** (`src/app/(marketing)/features/page.tsx:291`) -- same staleness concern.

7. **Not-found page uses shadcn theme variables** (`src/app/not-found.tsx:7-12`)
   - Uses `text-muted-foreground` and `bg-primary` which depend on the design system context. When accessed from marketing routes, these may not match the marketing design language (navy/gold palette).

---

## API ROUTE VERIFICATION

| Route | Status | Path |
|-------|--------|------|
| `/api/marketing-checkout` | EXISTS | `src/app/api/marketing-checkout/route.ts` |
| `/api/demo-call` | EXISTS | `src/app/api/demo-call/route.ts` |
| `/api/auth/reset-password` | EXISTS | `src/app/api/auth/reset-password/route.ts` |
| `/api/contact` | EXISTS | `src/app/api/contact/route.ts` |

All 4 required API routes exist. The contact route has the `escapeHtml` fix applied to all fields (name, email, company, phone, message). The fix does NOT break normal form submission -- it only sanitizes HTML special characters in the email output.

---

## SPECIAL CHECKS

### Privacy Page (`/privacy`)
- **Metadata:** Has proper export: `title: "Privacy Policy | Invaria Labs"`, `description` present.
- **Content:** Real legal content with 8 substantive sections (Introduction, Information We Collect, How We Use, Data Sharing, Data Security, Data Retention, Your Rights, Contact Us). NOT placeholder.
- **Effective date:** February 22, 2026 -- current.
- **Footer link:** Footer links to `/privacy` using Next.js `<Link>`. WORKS.

### Terms Page (`/terms`)
- **Metadata:** Has proper export: `title: "Terms of Service | Invaria Labs"`, `description` present.
- **Content:** Real legal content with 12 substantive sections. NOT placeholder.
- **Effective date:** February 22, 2026 -- current.
- **Internal link:** Links to `/privacy` from section 7 (but uses `<a>` not `<Link>`).
- **Footer link:** Footer links to `/terms` using Next.js `<Link>`. WORKS.

### Login Page Role-Aware Redirect
- **Verified:** After sign-in, the login page checks `user.user_metadata.role` (line 38-43).
  - `client_admin` or `client_member` -> redirects to `/portal`
  - All other roles -> redirects to `/dashboard`
- This is correctly implemented.

### Footer Links
- **Platform:** `/features`, `/pricing`, `/industries` -- all resolve to real pages.
- **Industries:** All 8 industry slugs link to `/industries/{slug}` -- all resolve via `generateStaticParams`.
- **Company:** `/about`, `/contact`, `/login` -- all resolve to real pages.
- **Bottom bar:** `/privacy`, `/terms` -- both resolve to real pages.
- **Social links:** NOT real links (just `<span>` elements). See Warning #2.
- **No `href="#"` links found in footer.** All links have real destinations.

### Contact Form escapeHtml Fix
- All 5 user-provided fields are escaped before being inserted into HTML email: `name`, `email`, `company`, `phone`, `message`.
- The escapeHtml function replaces `&`, `<`, `>`, `"` characters.
- Normal form submissions (without special HTML characters) will pass through unchanged.
- The fix does NOT interfere with email delivery or form functionality.

### About Page Fake Team Members
- Still present with disclaimer: "* Placeholder team members for demonstration purposes" (line 114).
- Three fictional team members with generic bios.
- Flagged as Warning -- should be replaced with real team or removed before launch.

---

## PAGES AUDITED

1. `src/app/(marketing)/page.tsx` -- Homepage
2. `src/app/(marketing)/about/page.tsx` -- About page
3. `src/app/(marketing)/contact/page.tsx` -- Contact page
4. `src/app/(marketing)/features/page.tsx` -- Features page
5. `src/app/(marketing)/pricing/page.tsx` -- Pricing page
6. `src/app/(marketing)/industries/page.tsx` -- Industries index
7. `src/app/(marketing)/industries/[slug]/page.tsx` -- Dynamic industry page
8. `src/app/(marketing)/privacy/page.tsx` -- Privacy policy (NEW)
9. `src/app/(marketing)/terms/page.tsx` -- Terms of service (NEW)
10. `src/app/(marketing)/layout.tsx` -- Marketing layout
11. `src/app/(marketing)/error.tsx` -- Error boundary
12. `src/app/(auth)/login/page.tsx` -- Login page (MODIFIED)
13. `src/app/(auth)/signup/page.tsx` -- Signup page
14. `src/app/(auth)/forgot-password/page.tsx` -- Forgot password
15. `src/app/(auth)/reset-password/page.tsx` -- Reset password
16. `src/app/(auth)/setup-account/page.tsx` -- Account setup
17. `src/components/marketing/layout/navbar.tsx` -- Navbar
18. `src/components/marketing/layout/footer.tsx` -- Footer (MODIFIED)
19. `src/components/marketing/sections/hero.tsx` -- Hero section
20. `src/components/marketing/sections/comparison.tsx` -- Comparison table
21. `src/components/marketing/sections/live-demo.tsx` -- Live demo
22. `src/components/marketing/sections/white-glove.tsx` -- White glove section
23. `src/components/marketing/sections/highlights.tsx` -- Highlights tabs
24. `src/components/marketing/sections/platform-features.tsx` -- Platform features (4 exports)
25. `src/components/marketing/sections/industries-grid.tsx` -- Industries grid
26. `src/components/marketing/sections/faq-section.tsx` -- FAQ section
27. `src/components/marketing/sections/cta-section.tsx` -- CTA section
28. `src/app/layout.tsx` -- Root layout
29. `src/app/not-found.tsx` -- 404 page
30. `src/app/api/contact/route.ts` -- Contact API
31. `src/app/api/marketing-checkout/route.ts` -- Checkout API (existence verified)
32. `src/app/api/demo-call/route.ts` -- Demo call API (existence verified)
33. `src/app/api/auth/reset-password/route.ts` -- Reset password API (existence verified)

---

## SUMMARY

| Category | Count |
|----------|-------|
| Blockers | 7 |
| Warnings | 12 |
| Cosmetic | 7 |
| Pages/Components Audited | 33 |
| API Routes Verified | 4 |

### Key Findings:
- **Privacy and Terms pages** are properly implemented with real legal content, correct metadata, and working footer links. PASS.
- **Login role-aware redirect** is correctly implemented. PASS.
- **Footer links** all resolve to real pages (no `href="#"` remaining). PASS.
- **Contact form escapeHtml** fix is properly applied to all fields. PASS.
- **Missing metadata** on 6 pages (homepage, features, pricing, contact, all auth pages) is the most widespread issue. All "use client" pages cannot export metadata.
- **Placeholder content** on the contact page (fake phone, "coming soon" widget) and about page (fake team) should be addressed before launch.
- **No lorem ipsum, no dead `href="#"` links, no broken image references found.**
- **All internal links verified to point to real pages.**
- **Responsive patterns** use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) throughout. No hardcoded pixel widths found on layout elements.
- **Accessibility:** Form labels present on all form fields. Alt text not needed (no `<img>` tags -- all icons are Lucide SVG components). Aria labels present on mobile menu toggle. Could benefit from more aria labels on interactive elements but not a blocker.
