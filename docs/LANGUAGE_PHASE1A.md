# HR/EN — phase 1A: personal language preference

Baseline: development 5bbbe76 (Grooming 6).

## Delivered
- Croatian default and explicit Hrvatski / English selection.
- Per-account browser preference, restored after refresh/sign-in in the same browser.
- Selectors in Welcome, initial onboarding, Settings and the Settings setup wizard.
- Translated Welcome shell (headings, account label, salon selection roles, refresh and sign-out), account-settings headings and language settings.
- Matching HR/EN catalogs with safe literal React rendering; no automatic translation of user content.
- HTML lang follows selected language; preference isolation, cross-tab sync and denied storage fallback.
- Language changes rerender context without remounting open forms, calling APIs or modifying wizard progress.
- No backend changes, migration, dependencies or salon-creation configuration changes.

## Deliberately staged coverage
This is a foundation, NOT a fully translated English application.
Invitation acceptance, salon creation forms, wizard body/validation and embedded Services/Employees remain Croatian in this phase. Their translation follows in phase 1B. Other pages, profile/theme/permissions UI, backend error presentation and date/number localization follow afterward. English selection displays a short notice explaining partial coverage.
Language does not change timezone, currency, measurements, database values, appointment snapshots, permissions, or Clerk authentication/hosted UI locale. No language auto-detection. Preference sync across browsers/devices is not included. Switching account resets to that account's preference. If storage is blocked, language works until the current entry surface is remounted; a visible notice explains it could not be saved.

## Implementation
LanguageProvider wraps each mutually exclusive entry surface (Welcome, onboarding, Layout) using the backend user ID already used by theme preferences. Its inner state key depends on account, never language. Selectors inside both wizard versions consume context. Catalog keys are semantic, with Croatian fallback for absent English keys; unknown keys remain literal. No DOM-wide text replacement or translation of API request bodies.

## Verification
- 7 new Node tests for preferences, isolation, storage failure, catalog parity, fallback and unrelated data preservation.
- Complete frontend suite: 222 tests passed locally.
- Full App JSX bundled successfully with existing local tooling (not a local production Vite build).
- Local React/jsdom checks: immediate text change, both selectors synchronized, draft DOM/state retained, separate accounts, cross-tab change/removal, blocked storage, document lang restoration.
- Actual onboarding and settings wizard checks: unsaved location preserved, no language-triggered API loads/saves; Welcome salon selection callback and user-entered salon name preserved.
- User verifier runs all frontend tests, installed Vite build and Git diff/status. No DB or migration commands.

## Apply
Stop frontend with Ctrl+C. Backend/PostgreSQL can remain running. Unzip all three package files. Run from backend folder with clean development branch.
node PATH/SalonAI_language_foundation_package.mjs --check
node PATH/SalonAI_language_foundation_package.mjs --apply
node PATH/SalonAI_language_foundation_verify.mjs
Installer checks original source hashes (BOM/CRLF tolerant), creates a temporary backup, and restores files if a write fails. Reapplying is rejected. If verification fails, send the report rather than repeating apply.

## Manual checks
1. Settings language section -> English: Settings headings translate; other pages remain Croatian by design.
2. Reload: selection remains English. Change theme: language remains English; dark-mode select stays readable.
3. Different account: independent preference. No salon data changes.
4. Existing Settings wizard: type an unsaved location, switch language, verify text/step retained, then cancel normally.
5. Initial onboarding (only if an eligible test account is already available): same draft preservation. Do not enable public salon creation for this test.
6. Welcome on an account without a salon: English heading, refresh/sign-out; invitation section remains functional in Croatian.
7. Return to Hrvatski. Keyboard focus and narrower viewport remain usable.

## Next
1B: translate invitation and controlled creation, both wizard bodies, validation and guidance.
1C+: shared shell, operational pages and locale-aware display with salon timezone unchanged.
Then WhatsApp/agreed AI, mobile/PWA and store preparation, production readiness, free pilot and billing.
