# HR/EN 1F — Clients and pets

Baseline: e6ae5d9, accepted appointments/booking translation package (267 tests).
This package translates client lists, cards, details, metrics, appointment history,
pets, pet measurements, private photos and per-pet appointment history.

## Contracts retained

- Client/pet IDs, species and size codes, revisions, statuses and request bodies stay unchanged.
- Names, breeds, notes and stored service/employee names remain literal user content.
- Language changes do not remount forms, discard drafts, reload history/photos or retry mutations.
- Draft weight retains the typed comma/dot; payload conversion to grams is unchanged.
- Read-only weight display uses the chosen locale, with up to three decimals.
- Client metrics display EUR using the chosen locale; their existing inclusion rules remain unchanged.
- Pet history timestamps still use the salon timezone, regardless of display language.
- Cursor pagination, deduplication, aborts and stale response checks are retained.
- Archived owner/pet guards, confirmation dialogs and uncertain-write handling stay in place.
- Photo limits remain JPEG/PNG, 8 MB and 24 megapixels. Preview URL lifecycle is unchanged.
- Unknown errors use the existing neutral error fallback instead of raw server details.
- ClientForm was translated in 1E-B; this package completes the surrounding client screens.

## Verification before delivery

- 275 frontend Node tests passed, including eight new language tests.
- App and components compile using esbuild in the preparation environment.
- React/jsdom tests with mocked transport cover pet create/edit, validation, draft retention,
  one pending write, archive confirmations, photo File/preview retention, file rejection,
  photo removal, timezone/history pagination, client search/sort/details, archived owner guards,
  unsupported business types and uncertain-write messages.
- Installer tested with check-only, BOM/CRLF inputs, mismatched sources/prerequisites,
  repeated application and simulated write failure with exact rollback.
- Actual installed Vite build, live API and manual browser acceptance are performed locally.

## Apply

Extract package/verify/PROCITAJ together outside the repository. Stop frontend.
From SalonAI/backend on clean development:

1. node <package> --check
2. node <package> --apply
3. node <verify>
4. Restart frontend; verify both languages, themes and a narrow viewport.

Report: TEMP/SalonAI_language_clients_report.txt.
No migration, dependency installation, environment changes or salon creation enablement.

## Manual acceptance

- Client search/sort and details retain their state across language changes.
- Client create/edit uses the existing localized form; archive/reactivate and confirmations work.
- Names/phone/notes stay literal. Dates, counts and EUR follow HR/EN.
- Pet name/species/breed/notes/size/weight remain entered after language changes.
- Empty required name and invalid weight show translated validation without a request.
- Successful mutations show messages in the currently selected language.
- Photo selection/preview survives switching; upload/remove require existing checks/confirmation.
- History statuses and captions translate; snapshot names and salon timezone remain correct.
- Archived owners and restricted accounts retain existing permissions.
- Grooming/mixed salons show pets; unsupported business types retain existing hidden section behavior.

Next: 1G absence and blocked-time requests, followed by the global HR/EN audit.
Brand, wider roadmap and public salon creation configuration are unchanged.
