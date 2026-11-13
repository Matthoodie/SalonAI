# HR/EN 1D-A — Services and pricelist import

Baseline: development 5998dfd, phase 1C committed/pushed and accepted by user.
Phase 1D is split into two installable packages: 1D-A Services/import and 1D-B Employees/schedules/memberships.
The plan remains seven functional phases, now eight installation packages.

## Included

- Services page: headings, status/actions, search/filter labels, empty states and EUR price presentation.
- Service form, including when embedded in onboarding: labels, required-field errors, business-specific examples.
- Import draft: selection, bulk duration, row review issues, duplicate acknowledgement, confirmations,
  uncertain save, exact-request retry, success/replay and refresh failures.
- Recognition UI: file chooser, explicit processing action, loading/result/error and append states.
- Explicit frontend dictionary; known messages translated at render time, unknown failures use neutral local guidance.

## Data and behaviour boundaries

User-entered service names, categories, file names, recognized content and recognition notes/warnings remain original text.
The UI explains that recognition notes retain the document/response language. No automatic content translation.
A blank service category is still stored as Ostalo, as in the existing API contract; English help states this explicitly.
EUR formatting uses en-GB/hr-HR, without changing values or currency. Input parsing is unchanged.
No new recognition call is triggered by switching language. Recognition still requires its explicit button and uses API credits.
Language does not change active salon/account, permission guards, filters, form state, row IDs, selected rows,
duplicate acknowledgements, review fingerprints, session-storage records or pending request UUID/body.
Import operations, idempotency and uncertain-result handling retain existing behaviour.
No backend/API contract changes, migrations, new dependencies, .env edits or salon creation enablement.
No changes to Employees or scheduling in this package; these follow in 1D-B.

## Verification before packaging

- 243 frontend Node tests passed (236 existing plus 7 new).
- Full App JSX compilation with available esbuild toolchain.
- React/jsdom checks with mocked responses: required-field messages and grooming examples;
  original service/category values, draft retention, filters, EUR formatting, exact create/update payloads;
  read-only guards; import duplicate review and acknowledgement retention; no requests on language switch;
  uncertain confirm/retry sends identical UUID/body; replay success; recognition in progress survives switch,
  source warnings/items preserved and explicit append works.
- No actual OpenAI request or production database access used in these checks.
- Installer check/apply, CRLF/BOM tolerance, mismatched-source/prerequisite refusal, repeat refusal,
  byte-exact restoration after simulated write failure.
- User verifier runs installed Vite build, frontend suite and Git checks.

## Installation and acceptance

Extract all three ZIP files into one folder. From clean development in SalonAI/backend:
node PACKAGE --check; only after success node PACKAGE --apply; then node VERIFY.
Report: TEMP/SalonAI_language_services_report.txt. Installer prints backup directory.
If verify fails, do not repeat apply. Send the report. No migration or npm install is needed.

Manual checks in a test salon:
1. Services HR/EN: headings, filter choices, empty states, actions and EUR presentation.
2. Change language with search/category/status filters active; retain selections and original service names.
3. Open New service and submit blank; errors translate. Enter a draft and switch language; values remain.
4. Save/edit one test service; verify original name/category, price and duration. Grooming uses pet examples.
5. Open import, enter a manual row, switch language; draft remains. Review, inspect issues/duplicates,
   complete required fields and confirm one test import if desired. Do not reimport real duplicates for testing.
6. Recognition is optional: use an existing suitable test file only if willing to use API credits.
   The request remains explicit; notes from recognition remain source text.
7. Check an existing read-only account, both themes, narrow screen and Services embedded in wizard.

## Next

1D-B: Employees, employee form and schedule dialogs, invitations and salon memberships/history.
Then 1E Appointments/Calendar/Dashboard, 1F Clients/pets, 1G requests and final HR/EN audit.
The phase 1C build had a 501.68 kB main chunk warning; retain production bundle optimization as a separate task.
After language: WhatsApp/agreed AI -> mobile/PWA/store and production preparation -> free pilot -> billing.
