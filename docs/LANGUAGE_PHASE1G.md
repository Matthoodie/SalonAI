# HR/EN 1G — requests and final application-message audit

Baseline: development 63d3cfb (accepted clients/pets language package 1F).

## Included

- Time off and blocked time requests: headings, forms, type/status labels, review,
  withdrawal, approved cancellation, mandatory reasons, audit metadata and pagination.
- Localised validation, known API conflicts, permissions, stale state and uncertain
  transport outcomes. Unknown server messages use the existing neutral fallback.
- Explicit salon-zone timestamp formatting; all-day dates retain their calendar day.
- Confirmations preserve literal employee names and explain cancellation consequences.
- Salon loading/retry/access and salon-switch confirmation; page loading/error boundary.
- Before account identity is resolved, account-loading text is bilingual. No other
  account's preference is read. The Clerk sign-in widget remains provider-owned.
- Removed obsolete onboarding notice about untranslated employee/service forms.
  Language-selector help now explains that user-entered names/notes stay original.

## Behaviour preserved

No migration, dependency, API payload, permissions, .env, public salon creation or
business-rule changes. Status/type codes, employee IDs, page cursors, UTC conversion,
DST rejection, cancellation checks and request revision behaviour are unchanged.
Language changes do not reload request lists, close forms or retry mutations.
Successful approval remains successful when a subsequent employee refresh fails.

## Verification before delivery

- 283/283 frontend Node tests passed (275 existing plus eight request-language tests).
- Full App/provider JSX bundled with esbuild. Router/Clerk are external in this check.
- React/jsdom scenarios with mocked API transport for BOTH request pages:
  date/time/note retention, pending single write, uncertain result blocking, explicit
  refresh, exact canonical payload, translated success, reviewer draft, confirmation,
  cancellation reason, own-withdrawal/no-self-review and pagination deduplication.
- Error boundary changes language without retrying the failing child; navigation
  still resets it. Technical exception details are not rendered.
- Installer check/apply, CRLF/BOM handling, prerequisite mismatch, reapply refusal and
  simulated write-failure rollback verified.
- Source audit found and addressed application-level loading/error text and stale
  translation-progress notices. No claim is made that every runtime backend failure
  or third-party UI string has been exercised.

The installed Vite build and live-backend visual/manual tests run on the user's machine.
Native date/file/validation dialogs follow the browser/OS language. Clerk authentication
localisation is separate from SalonAI's per-account interface setting. User names,
service names, imported pricelists and free-text notes are intentionally not translated.

## Installation

1. Extract ZIP outside repository. Stop frontend; backend may remain running.
2. From backend on clean development: package --check, then package --apply.
3. Run SalonAI_language_requests_verify.mjs. It runs all frontend tests, installed
   Vite build and git diff/status checks. It does not access the database.
4. Report: TEMP/SalonAI_language_requests_report.txt. If a check fails, do not
   repeat --apply; send the report. Backup path is printed by the installer.
5. Restart frontend and run manual checks below. Commit only after acceptance.

## Manual acceptance

Use test requests only; approvals/cancellations change employee availability.

- HR -> EN -> HR on both request pages: headings, types, statuses, cards, dates,
  notes, decisions and historical cancellation metadata.
- Employee with active linked profile: fill dates/times/note, change language,
  confirm values remain; submit once, then withdraw a pending own request.
- Other authorised reviewer: open request, type decision note, change language,
  approve/reject; verify confirmation and resulting schedule using existing flow.
- Approved request from another employee: cancellation requires reason; changing
  language retains reason; confirmation explains schedule removal/history retention.
- Existing appointment overlap: conflict stays readable, no duplicate write.
- Filters and older-page load: language alone must not reload or reset selection.
- Restricted account: no self-review/cancellation; no unauthorised salon-wide data.
- Blocked time: salon zone and existing gap/repeated-hour validation remain correct.
- Both themes/narrow window; long English labels remain usable.
- Welcome, wizard, settings, services, employees, clients/pets, booking, calendar,
  dashboard: switch language once, inspect open forms and common error/empty states.

## Next

After live acceptance and commit, perform final cross-page HR/EN regression and
record any missed text as a targeted fix. Then resume the main roadmap; do not enable
public signup, introduce billing or rename SalonAI as part of this package.
