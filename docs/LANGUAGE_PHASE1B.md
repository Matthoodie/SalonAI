# HR/EN phase 1B — invitation and setup flows

Baseline: development a1ae2e7 (phase 1A confirmed by the user).

## Included

- Invitation acceptance: labels, guidance, submitting/success states, local validation and known API errors.
- Controlled salon creation: fields, business options, grooming placeholder, eligibility and uncertain-request guidance.
- Initial onboarding: five steps, guidance, validation, review issues, completion and navigation.
- Settings wizard: six steps, summaries, unsaved-change confirmations, save notices and error states.
- Welcome and initial-onboarding headers keep a compact selector. The partial-translation note sits in main content.
- Corrected obsolete Settings help: grooming profiles/photos already exist and initial onboarding already checks readiness.
- Distinct create/invitation React keys avoid duplicate-key reconciliation warnings on Welcome.

## Boundaries

Embedded Employees/Services pages, their forms/import flows and the remaining operational UI are not fully translated yet.
This package translates the wizard frame and instructions surrounding those components. In English, a note states that coverage is partial.
User-entered names, locations, notes, service names, timezone identifiers and API enum values are not translated.
The selected language never changes salon timezone, currency, permissions, setup completion, eligibility or request data.
No backend changes, migration, environment edits, dependency changes or public salon creation enablement.

## Implementation

An explicit HR/EN catalogue is applied at known UI render sites only. Source-text keys bridge existing Croatian validation/API messages without changing those APIs.
No DOM scanning, automatic translation, user-content rewriting, or remote translation calls.
Existing validation messages are retained as raw state; known messages are translated at render time. Unrecognised failures use a neutral local message that does not assert rollback.
Error status/code objects remain intact. Uncertain creation retains the same stored request and UUID; language changes cannot retry it.
The language provider is still keyed by account, not by language. Setup operations/effects are not dependent on language.
Invitation form uses existing explicit token validation rather than browser-language validation popups, with aria-invalid/aria-describedby.

## Verification performed before packaging

- 229/229 frontend Node tests (222 existing plus 7 new).
- Full App JSX bundle compiles with the available esbuild toolchain.
- React/jsdom tests with mocked transport: invitation validation/acceptance, language-switch alerts,
  preserved token/draft/step, no new eligibility/load/save request on switch, creation retry exact request/UUID,
  disabled creation hidden, all six Settings steps and onboarding service/schedule/review screens.
- Installer check/apply, BOM/CRLF inputs, mismatched source/prerequisite refusal, repeat refusal and rollback.
- User must run the supplied verifier for their installed Vite production build and local Git checks.
- No production database was contacted for these checks.

## User acceptance

1. Welcome without salon: no sidebar; HR/EN invitation form; disabled creation stays hidden.
2. Enter an invalid invitation code: message follows HR/EN and the input remains intact. No valid invitation is required for this check.
3. Settings wizard: translate each step, enter an unsaved location, switch language and verify same step/value.
4. Check save/close and reopening once with valid existing data; verify saved values are unchanged.
5. Where an unfinished test salon already exists, verify initial wizard labels and field validation.
   Do not re-enable salon creation only for this language package.
6. Light/dark theme and narrow window: controls remain readable and header wraps.

Run from backend: package --check, package --apply, verify. Do not repeat apply.
Verifier report: TEMP/SalonAI_language_flow_report.txt.
Backup: TEMP/SalonAI-language-flow-backup-* (path printed by installer).
After successful checks, review Git diff/stat and commit the exact package paths.

## Next

Translate shared navigation/header and full Settings, then Employees/Services/import flows and
appointments/calendar/clients/pets/requests with locale-aware presentation. Dates must keep salon timezone.
Continue roadmap: WhatsApp/agreed AI -> mobile/PWA and store preparation/production -> free pilot -> billing.
