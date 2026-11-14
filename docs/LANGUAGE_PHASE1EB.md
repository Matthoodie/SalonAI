# HR/EN 1E-B — Appointments and booking forms

Baseline: development edebfe1, accepted 1E-A with 259/259 frontend tests and manual checks.

## Coverage
- Appointments page, tabs/search, counters, loading and empty states.
- Appointment cards: long dates, canonical status labels, EUR values, actions and pet/owner labels.
- New/edit booking forms: client lookup, pet selection, mixed-salon recipient choices,
  availability, validation, duration/end-time preview, saved selections and service changes.
- Shared ClientForm is translated now because it is embedded in quick client creation.
  This also translates that same form on Clients; the remaining Clients page and pet management
  remain in phase 1F.
- Known local/API failures and selected server error codes show localized guidance.
  Unknown errors use neutral confirmation/refresh guidance instead of raw server details.

## Preserved behaviour
- Names, breeds, categories, service snapshots, notes, phone numbers and identifiers stay literal.
- API modules, payload shapes, status codes, recipient revisions, timezone conversion,
  price/duration calculations, availability and permission rules are unchanged.
- Locale switches do not remount forms or restart lookup/context/availability effects.
- Dynamic validation stores its kind and literal name so an open error switches languages.
- Async page error alerts use the currently selected language when the request settles.
- Create/edit/cancel/complete and service mutation request timing remains unchanged;
  language changes do not retry writes.
- New quick clients remain pending until appointment creation, as before.
- Grooming requires the existing owner/pet selection; legacy saved recipients remain supported.
- No migrations, dependency installs, environment changes or public salon-creation enablement.

## Author checks
- 267/267 frontend Node tests passed, including 8 new booking localization cases.
- Full App and all affected components compiled with esbuild.
- Mocked React checks passed: grooming creation with in-flight availability and language change;
  exact client/pet/service/date payloads; quick client validation/duplicate phone/pending state;
  edit retains recipient revision; service selection/search and ordered IDs retained;
  one service save during language switch; card actions and read-only controls;
  page filters, cancellation confirmation, no retry, latest-language failure notice and
  canonical completed status/history filtering.
- Installer regression covers CRLF/BOM, check-only, apply, changed-source/prerequisite refusal,
  reapply refusal and rollback/new-file cleanup on simulated write failure.
- Installed Vite build, live backend and manual browser/theme/responsive checks remain user acceptance.

## Manual acceptance
1. Test HR/EN headings, tabs, search, empty/loading states and appointment cards.
2. Start a booking and switch language before saving; selections must remain unchanged.
3. Grooming: choose owner then pet. Names/breed remain literal; UI species labels translate.
4. Hair salon: quick-add a client. Check required name/phone and duplicate feedback in both languages.
5. Select multiple services, filter the list and switch language. Selection/order and totals remain.
6. Verify employee and time availability; create one test appointment and verify Calendar.
7. Edit date/time or recipient separately, as before. Check saved selections and cancellation.
8. Change services separately; retained snapshots and total duration/price remain correct.
9. Check complete/cancel with authorized account and absence of restricted controls for employee.
10. Check light/dark themes and narrow window. Send verifier report before commit/push.

## Local install
Extract all three ZIP files together outside the repository. From a clean development backend:
package --check, package --apply, then verify. Report is TEMP/SalonAI_language_booking_report.txt.
Expected: 267 tests, Vite build and Git diff check pass. Do not reapply after verifier failure.
The installer prints its backup path. No npm install or migrate command is needed.

Next: 1F Clients/pets/photos/history, then 1G absence/blocked-time requests and global HR/EN audit.
