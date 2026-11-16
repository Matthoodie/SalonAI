# ZRIHTAN — product rebrand, package B

Baseline: 9d7a6c2, accepted shared HR/EN file picker (283/283 and manual checks).
Canonical visible name: ZRIHTAN. Product formerly called SalonAI.

## Delivered

Shared Brand component with the supplied purple/white comb mark and ZRIHTAN wordmark.
Used in desktop sidebar, mobile topbar, no-salon welcome, onboarding and above login.
The brand is language-independent; existing HR/EN and theme preferences are preserved.
The decorative mark has empty alt text; the adjacent wordmark provides its readable name.
The supplied source named "svg logo zrihtan.png" is PNG, not vector SVG. The installer
contains resized PNG derivatives (256px UI mark, 64px favicon); no external image host.
Original artwork is retained; assets do not require a new dependency.

The installer changes the existing frontend/index.html title to ZRIHTAN and points its
favicon to %BASE_URL%brand/zrihtan-favicon.png. Scripts, language attributes, metadata,
other links and body contents are preserved. It accepts one known starter title
(frontend, SalonAI or Vite + React) and zero/one known starter favicon. Unexpected
custom titles/icons or multiple icons are refused before any source write.
No guessed replacement index.html is shipped.

## Intentionally preserved

- Existing salon names and all client/pet/service/appointment data. A salon called
  "SalonAI Development Salon" is user data and must be renamed deliberately if desired.
- DB schema, migrations, IDs, API paths, Clerk identity, keys, redirects and permissions.
- Internal salonai:* storage keys (language, theme, selected salon, creation receipt,
  pending pricelist drafts), internal CSS class names and auth component identifiers.
- Local SalonAI folder, Git remote/repository, package names and lockfiles.
- Historical documents and commits. New current branding docs use ZRIHTAN.
- Controlled creation setting; this package does not enable public salon creation.

## Verification

283 existing frontend tests passed. Full main/App compiled with esbuild and PNG imports.
Index transformation tested for recognised titles, CRLF preservation, custom metadata
and script preservation, absent/known favicon and refusal of unexpected variants.
Installer checked for read-only --check, exact application including binary files,
BOM/CRLF compatibility, mismatch/reapplication refusal, and rollback on write failure.
The sandbox browser could not start; no claim of completed browser visual acceptance.
Run the supplied verifier for the real installed Vite build, then check the short list:
- Brand and favicon load after hard refresh, desktop sidebar and mobile menu.
- Mobile close/menu buttons remain accessible; no horizontal overflow at phone width.
- Light/dark themes and HR/EN changes retain their saved preference.
- No-salon welcome and existing onboarding show ZRIHTAN when those states are available.
  Do not enable public creation or delete users solely for this visual check.
- Login shows ZRIHTAN above the existing authentication component.
- Existing salon name remains unchanged, including the word SalonAI if originally named so.

## External branding checklist — separate from this code package

1. Clerk: review the displayed application name, logo and any authentication/email
   template branding in the existing application. Rename visible branding only.
   Do not create a replacement Clerk application or change keys/subjects during rebrand.
2. Production domain: choose/obtain the domain before configuring hostnames, allowed
   origins, redirect URLs and email sender verification. No domain is assumed here.
3. Public website/social preview/support email: prepare coherent ZRIHTAN assets/copy
   after deciding the public domain. Do not invent a support address.
4. Future WhatsApp business identity, notification templates and billing receipts must
   use ZRIHTAN. These integrations are not implemented/configured by this package.
5. Future PWA/store manifests and app icons will use the same brand. This package does
   not add a service worker or assert that the app is installable or store-ready.

## Next sequence

C: dashboard service values, upcoming booking value, period comparisons and top services.
D: capacity/utilisation and heatmap after establishing historical data requirements.
E: rule-based insights; then WhatsApp and the main production roadmap.
Business analytics use saved facts; completed value is not proof of payment or profit.
