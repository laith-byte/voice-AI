# Marketing Website Audit

## Summary

Audited every public-facing marketing page, shared layout components (navbar, footer), all homepage sections, auth pages (login, signup, forgot-password, reset-password, setup-account), the contact API endpoint, and referenced API routes. The marketing site is well-built overall with strong design, good responsive patterns (Tailwind utility classes, no hardcoded pixel widths), and solid internal linking. However, there are several launch blockers including missing API endpoints, placeholder content visible to users, an XSS vulnerability in the contact API, and dead links in the footer.

---

## BLOCKERS

- [BLOCKER] **Pricing & Signup pages** (`src/app/(marketing)/pricing/page.tsx:417`, `src/app/(auth)/signup/page.tsx:59`) — Both pages call `POST /api/marketing-checkout` to start Stripe checkout. **This API route does not exist.** No file exists at `src/app/api/marketing-checkout/route.ts`. Clicking "Get Started" on any paid plan will fail with a 404. This is the primary conversion path and is completely broken.

- [BLOCKER] **Live Demo section** (`src/components/marketing/sections/live-demo.tsx:79`) — The live demo calls `POST /api/demo-call` to trigger an outbound AI call. **This API route does not exist.** No file exists at `src/app/api/demo-call/route.ts`. The homepage's most prominent interactive feature will fail with a 404.

- [BLOCKER] **Forgot Password page** (`src/app/(auth)/forgot-password/page.tsx:22`) — Calls `POST /api/auth/reset-password` to send reset email. **This API route does not exist.** No file exists at `src/app/api/auth/reset-password/route.ts`. Users who forget their password will be unable to recover their accounts.

- [BLOCKER] **Contact API — XSS vulnerability** (`src/app/api/contact/route.ts:20-28`) — User-supplied `name`, `email`, `company`, `phone`, and `message` fields are interpolated directly into an HTML email body using string templates (`${name}`, `${message}`, etc.) with **zero sanitization**. A malicious user can inject arbitrary HTML/JavaScript into the notification email. This is a stored XSS vulnerability affecting whoever reads the contact form submissions. All user input must be HTML-escaped before embedding in the email body.

- [BLOCKER] **Contact API — Missing server-side validation** (`src/app/api/contact/route.ts:8`) — The API validates that `name`, `email`, and `message` are present but the contact form's required fields are `name`, `email`, `company`, and `industry` (message is optional on the frontend). The `industry` and `company` fields are required on the form but not validated server-side. Additionally, the `email` field is not validated for format — any truthy string passes. There is no rate limiting, allowing spam submissions.

- [BLOCKER] **Footer — Dead links** (`src/components/marketing/layout/footer.tsx:87-88`) — "Privacy Policy" and "Terms of Service" links both point to `href="#"`. These are placeholder anchors that do nothing when clicked. For a production launch, these must either link to real pages or be removed. Legal links pointing to `#` are a significant credibility issue.

- [BLOCKER] **Login post-auth redirect** (`src/app/(auth)/login/page.tsx:37`) — After successful login, users are redirected to `/dashboard`. There is no page at this route in the Next.js app. The startup admin panel is at `/(startup)/dashboard/page.tsx`, and the client portal is at `/(portal)/[clientSlug]/portal/page.tsx`. The `/dashboard` route will likely 404 or depend entirely on middleware redirect logic that is not visible in the page router. If the middleware does not handle this, users who log in will see a 404.

---

## WARNINGS

- [WARNING] **About page — Fake team members** (`src/app/(marketing)/about/page.tsx:29-32`) — The team section lists "Alex Rivera", "Jordan Patel", and "Sam Nakamura" with bios. Line 114 shows a small italic disclaimer: `* Placeholder team members for demonstration purposes`. This disclaimer is visible to the public. For a real launch, either replace with real team info or remove the section entirely. Shipping a fake team with a "placeholder" disclaimer undermines credibility.

- [WARNING] **Contact page — Placeholder phone number** (`src/app/(marketing)/contact/page.tsx:202-204`) — The contact page displays phone number `(888) 555-0199` with the text "Placeholder number" visible below it. The `tel:` link at line 221 also links to this fake number. 555 numbers are known fictional numbers. This must be replaced before launch or removed.

- [WARNING] **Contact page — "Coming soon" calendar widget** (`src/app/(marketing)/contact/page.tsx:179-182`) — The "Book a Demo" sidebar contains a placeholder box that says "Calendar booking widget" and "Calendly integration coming soon". This placeholder text is visible to end users on the contact page.

- [WARNING] **Footer — Placeholder social media links** (`src/components/marketing/layout/footer.tsx:41-43`) — The footer's social media section shows "Li" and "X" text badges that are not linked to any URL. These are `<span>` elements, not `<a>` links. They look like broken social media icons. Either link them to real social profiles or remove them.

- [WARNING] **Root layout — Minimal SEO metadata** (`src/app/layout.tsx:13-16`) — The root layout metadata is extremely sparse: `title: "Invaria Labs"`, `description: "Voice AI Platform"`. There is no `openGraph` metadata, no `twitter` card metadata, no `metadataBase`, no favicons configured beyond the default `favicon.ico`, and no `robots` or `sitemap` configuration. Social sharing will show a generic preview.

- [WARNING] **Marketing layout — No page-level metadata on homepage** (`src/app/(marketing)/page.tsx`) — The homepage does not export any `metadata` object. It inherits only the root layout's sparse metadata (`"Invaria Labs"` / `"Voice AI Platform"`). The home page should have rich, descriptive metadata for SEO and social sharing.

- [WARNING] **Features page — No metadata export** (`src/app/(marketing)/features/page.tsx`) — The features page is a `"use client"` component and does not export any metadata. It will inherit the root's minimal title/description. Client components cannot export metadata in Next.js App Router.

- [WARNING] **Pricing page — No metadata export** (`src/app/(marketing)/pricing/page.tsx`) — Same issue as features page. The pricing page is a `"use client"` component with no metadata export.

- [WARNING] **Features page — "Coming Soon" on CRM integrations** (`src/app/(marketing)/features/page.tsx:485,486`) — Salesforce and GoHighLevel integrations are labeled "Coming Soon" on the features page. This is acceptable if intentional, but verify these are not being advertised as live features elsewhere on the site.

- [WARNING] **Setup Account page — Redirect to `/dashboard`** (`src/app/(auth)/setup-account/page.tsx:123`) — Falls back to `router.push("/dashboard")` if `clientSlug` is not available. Same concern as the login page redirect — `/dashboard` may not resolve to a valid page.

- [WARNING] **No `target="_blank"` / `rel="noopener noreferrer"` audit needed** — All links across the marketing site are internal (`/features`, `/pricing`, `/contact`, `/industries/...`, `/login`, `/signup`). No external links were found in any marketing page or component, except for the `tel:` link and `mailto:` on the contact page (which don't need `target="_blank"`). The `acme.co/appt/8291` text in the SMS mockup on the features page is plain text inside a UI mockup, not an actual link. No external link violations found.

---

## COSMETIC

- [COSMETIC] **Navbar "Book a Demo" link** (`src/components/marketing/layout/navbar.tsx:108`) — The desktop navbar CTA "Book a Demo" uses `hidden lg:inline-flex` but the `inline-flex` is applied to a Next.js `<Link>` which renders as `<a>`. The classes work but the pattern `hidden lg:inline-flex` on an anchor tag may cause a brief layout flash during hydration. Minor, non-blocking.

- [COSMETIC] **Features page — Comment numbering mismatch** (`src/app/(marketing)/features/page.tsx:1032`) — A comment says `{/* FEATURE 12: Branded Caller ID */}` but this is actually the 14th feature section on the page (the 12th was already used for Usage Dashboard at line 906). Comment numbering diverged. Non-blocking but could confuse maintainers.

- [COSMETIC] **Homepage section ordering** — The homepage renders sections in this order: Hero, Comparison, IndustriesGrid, WhiteGlove, LiveDemo, Highlights (3 blocks), Omnichannel, TelephonyStack, EnterpriseSecurity, Integrations, FAQ, CTA. The page is very long. Consider whether the live demo should appear higher (before the industries grid) to increase engagement.

- [COSMETIC] **Pricing cards — `<div>` nesting within `<button>`** (`src/app/(marketing)/pricing/page.tsx:613-629`) — Starter and Professional plan CTAs are `<button>` elements while Enterprise is a `<Link>`. This is correct but the button's `block w-full text-center` styling makes it look identical to a link. The `handleCheckout` function is well-implemented with loading state.

- [COSMETIC] **About page — Generic "Alex Rivera" team avatars** — Team avatars are gradient circles with initials. While functional, consider adding real headshots or removing the section pre-launch, as combined with the "placeholder" disclaimer it significantly weakens the page.

- [COSMETIC] **Not-found page** (`src/app/not-found.tsx`) — Uses `text-muted-foreground` and `bg-primary` / `text-primary-foreground` classes which appear to come from a shadcn/ui theme. Verify these resolve correctly in the marketing pages context, which uses a different font setup (Inter/Manrope) than the app pages (DM Sans).

---

## Pages Audited

### Marketing Route Group `(marketing)/`
1. **Homepage** — `src/app/(marketing)/page.tsx`
2. **About** — `src/app/(marketing)/about/page.tsx`
3. **Contact** — `src/app/(marketing)/contact/page.tsx`
4. **Features** — `src/app/(marketing)/features/page.tsx`
5. **Pricing** — `src/app/(marketing)/pricing/page.tsx`
6. **Industries index** — `src/app/(marketing)/industries/page.tsx`
7. **Industry detail (dynamic)** — `src/app/(marketing)/industries/[slug]/page.tsx` (8 slugs: healthcare, legal, home-services, real-estate, insurance, financial-services, automotive, hospitality)
8. **Error boundary** — `src/app/(marketing)/error.tsx`
9. **Marketing layout** — `src/app/(marketing)/layout.tsx`

### Auth Route Group `(auth)/`
10. **Login** — `src/app/(auth)/login/page.tsx`
11. **Signup** — `src/app/(auth)/signup/page.tsx`
12. **Forgot Password** — `src/app/(auth)/forgot-password/page.tsx`
13. **Reset Password** — `src/app/(auth)/reset-password/page.tsx`
14. **Setup Account** — `src/app/(auth)/setup-account/page.tsx`

### Shared/Root
15. **Root layout** — `src/app/layout.tsx`
16. **Not Found (404)** — `src/app/not-found.tsx`
17. **Middleware** — `src/middleware.ts`

### Shared Components
18. **Navbar** — `src/components/marketing/layout/navbar.tsx`
19. **Footer** — `src/components/marketing/layout/footer.tsx`
20. **CTA Section** — `src/components/marketing/sections/cta-section.tsx`
21. **Hero** — `src/components/marketing/sections/hero.tsx`
22. **Comparison** — `src/components/marketing/sections/comparison.tsx`
23. **Industries Grid** — `src/components/marketing/sections/industries-grid.tsx`
24. **White Glove** — `src/components/marketing/sections/white-glove.tsx`
25. **Live Demo** — `src/components/marketing/sections/live-demo.tsx`
26. **Highlights** — `src/components/marketing/sections/highlights.tsx`
27. **Platform Features** (Omnichannel, TelephonyStack, EnterpriseSecurity, Integrations) — `src/components/marketing/sections/platform-features.tsx`
28. **FAQ Section** — `src/components/marketing/sections/faq-section.tsx`

### API Routes Checked
29. **Contact form** — `src/app/api/contact/route.ts` (exists, has issues)
30. **Marketing checkout** — `src/app/api/marketing-checkout/route.ts` (MISSING)
31. **Demo call** — `src/app/api/demo-call/route.ts` (MISSING)
32. **Auth reset password** — `src/app/api/auth/reset-password/route.ts` (MISSING)

### Data Files
33. **Industries data** — `src/lib/marketing/industries.ts`
