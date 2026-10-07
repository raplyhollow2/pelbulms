# Cursor prompt — add Rigbu Brand Kit v2 to the LMS

Unzip this kit into `design/rigbu-brand-kit-v2/` at the root of the project, start a new git branch (e.g. `brand-v2`),
then paste everything below the line into Cursor (Agent mode).

---

# Apply the Rigbu Brand Kit v2 (owl logo, app icons, page icons, mascot)

## Context
This is the Next.js LMS live at https://www.rigbu.app. The brand kit is in `design/rigbu-brand-kit-v2/`.
Read `design/rigbu-brand-kit-v2/README.md` first: it explains every file. It replaces any earlier Rigbu logo
(including `design/rigbu-logo-kit/` if present).

Brand colours:
- Gold #F5B82E
- Ember #E8743B
- Pine #2F6B4F
- Mint #6FC79A
- Ink #1B2433
- Night #34446A
- Paper #FAF7F2

UI font: Plus Jakarta Sans. The logo wordmark is an image, so don't render "rigbu" as live text inside logos.

## Hard constraints
- Branding and UI only. Do NOT change auth, Google sign-in, KYC logic, video delivery, progress tracking, enrolment
  approval, certificate generation logic or certificate verification.
- Existing certificate codes and verification URLs must keep working.
- No new dependencies unless one is truly required. If it is, ask me first.
- Don't edit anything inside `design/rigbu-brand-kit-v2/`; copy files out of it.

## Step 1 — Audit (report back, then wait for my "go")
1. List every place a logo, favicon, app icon, brand name or icon library is used:
   - header, footer, loading screen, sign-in, KYC, dashboard, course pages, lesson player, teach pages, admin
   - verification page, certificate PDF, emails, metadata, manifest, `app/icon.*`, `app/favicon.ico`, `public/`
2. Say which icon library the app currently uses (e.g. lucide-react, heroicons), and list each navigation item and
   page heading that shows an icon.
3. List the actual routes, so the page-icon map in `code/brand.ts` and the manifest shortcuts can be corrected.

## Step 2 — Assets
- `web/*` → `public/` (favicon.ico, favicon.svg, PNG icons, site.webmanifest, og-image, loader, email logos)
- `logo/*` → `public/brand/logo/`
- `mascot/*` → `public/brand/mascot/`
- `icons/badges/png/*` → `public/icons/badges/png/` (the manifest shortcuts use these)
- `icons/rigbu-icons-sprite.svg` → `public/icons/`
- `code/RigbuIcon.tsx` and `code/brand.ts` → `src/components/brand/` (or the project's components folder)
- Remove old brand icons (`app/favicon.ico`, `app/icon.*`, `app/apple-icon.*`, old logo files). File-based icons in
  `app/` override metadata, so old ones must not remain.
- Fix the routes in `brand.ts` and `site.webmanifest` shortcuts to match the audit.

## Step 3 — Metadata
In `app/layout.tsx`:
- `metadataBase: new URL('https://www.rigbu.app')`
- `title`: default "Rigbu — Learn anywhere. Light the way.", template "%s · Rigbu"
- `icons`: `/favicon.ico`, `/favicon.svg` (type image/svg+xml), `/favicon-32x32.png`, `/favicon-16x16.png`,
  apple `/apple-touch-icon.png`
- `manifest: '/site.webmanifest'`
- `openGraph` and `twitter` image: `/og-image-1200x630.png` (1200×630, alt "Rigbu — Learn anywhere. Light the way.")
- In the `viewport` export: `themeColor` #1B2433

## Step 4 — Logo component
Create `<BrandLogo variant="horizontal" | "stacked" | "mark" theme="light" | "dark" | "auto" height={32} />`.
- Uses the SVGs in `/brand/logo/`, with explicit width/height to avoid layout shift.
- alt="Rigbu"; when used as a home link, wrap it in `<Link href="/" aria-label="Rigbu home">`.
- Header: horizontal at 32px tall on desktop and mark-only at 32px on screens under 400px. Footer: horizontal at 28px.
- If the app has dark mode, use the `-dark` files in dark mode.

## Step 5 — Page & navigation icons
- Replace navigation and page-heading icons with `<RigbuIcon name="…" />` using the map in `brand.ts`.
- Active nav item: `<RigbuIcon name="…" active />`, plus a soft gold pill behind it (`rgba(245,184,46,.16)`).
- Mobile bottom tab bar (if there is a mobile nav), max 5 items: Home, Explore, My learning, Certificates, Profile.
  - Touch targets at least 44×44px.
  - Labels always visible.
  - `aria-current="page"` on the active tab.
- Page headers: show the page's colour badge (`/icons/badges/png/{name}-128.png` at 48px) next to the H1 on dashboard,
  certificates, teach, KYC and settings pages.
- Keep any other icon library only for tiny UI glyphs (chevrons, close, menu).

## Step 6 — Mascot moments (one per screen, at most 240px wide, lazy-loaded)
- Landing hero: `mascot/rigbu-owl-default`
- Sign-in / welcome / KYC start: `hello`
- Loading & empty states (no courses, no results): `thinking`
  - For loading spinners, use `/rigbu-loader.svg` (animated) at 64–96px.
- Lesson/course complete, certificate issued, KYC approved: `celebrate`
  - Add a short scale-in, and disable it under prefers-reduced-motion.
- 404 and error pages: `oops`. Create `app/not-found.tsx` with a friendly message and a link home if it doesn't exist.
- Offline / maintenance / no notifications: `sleepy`

## Step 7 — Certificates & emails
- Certificate PDF:
  - Put `logo/rigbu-logo-stacked-light-h512.png` in the existing header area.
  - Optionally add `logo/rigbu-mark-mono-ink-512.png` as a faint seal or watermark at 8–12% opacity.
  - Do not change layout logic, codes, QR codes or verification.
- Emails: `https://www.rigbu.app/email-logo-400.png` shown at 200px wide, alt "Rigbu". Never SVG in email.

## Step 8 — Checks (all must pass)
- `npm run lint` and `npm run build` pass, with no TypeScript errors in `RigbuIcon.tsx`.
- No references remain to old logo or icon files (search the repo).
- Header, nav (active state), loading, empty state, 404, sign-in, dashboard and verification pages look right at
  360px, 768px and 1280px, in light and dark mode if the app has dark mode.
- Chrome DevTools › Application › Manifest:
  - icons and shortcuts load with no errors
  - the maskable icon isn't cropped
- Generate one test certificate, and confirm an EXISTING certificate code still verifies.
- Lighthouse mobile: Accessibility ≥ 90. Best Practices shows no image-aspect or missing-icon warnings.

## Deliverable
Small commits on this branch, in this order:
1. assets
2. metadata/manifest
3. BrandLogo
4. icons/nav
5. mascot moments
6. certificates/emails

Then send a summary covering:
- the files changed
- the routes you mapped
- anything you couldn't do
- anything I must do in Vercel or elsewhere
