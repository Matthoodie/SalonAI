# HR/EN 1D-B — Employees, schedules, invitations and memberships

Baseline: development a6db864 (1D-A), user accepted 243/243 tests, manual scenarios and push.

## Scope
- Employees page, employee cards and form, including embedded onboarding usage.
- Service selection, required-name feedback, working days and hours, date overrides,
  absences and blocked periods. Schedule summaries, types and local validation messages.
- Invitation creation, available profiles, code presentation, revocation and invitation list.
- Salon member roles, activation, confirmations, success/errors and membership audit history.
- Known frontend/API messages translate at render; unknown failures use neutral uncertainty guidance.
- HR date-only presentation retained; EN uses DD/MM/YYYY without converting calendar days to UTC.
  Invitation/member dates retain their existing timezone behaviour. Audit history retains Europe/Zagreb.

## Preserved behaviour
- No translations of entered names, notes, service names/categories, email addresses or invitation tokens.
- Changing language does not remount forms, clear drafts, change selected services or submit requests.
- Schedule type/day keys, dates, times, IDs and payloads retain their original contract.
- Request-backed blocked periods retain original UTC instants and cannot be deleted through this form.
- Permission guards, active salon isolation, abort/stale response handling, pagination and actions unchanged.
- No backend changes, migrations, new dependencies, .env changes or creation enablement.
- This package does not translate the separate absence/request pages (phase 1G).

## Verification before delivery
- 251 Node frontend tests passed: 243 existing plus 8 new localization tests.
- Full App JSX compilation using available esbuild; installed Vite build is run by the user verifier.
- React/jsdom with mocked API: live validation, draft retention, service filtering, all four schedule
  sections, exact create/update payloads across language changes, protected UTC intervals, read-only card.
- Invitation email/profile draft and created code survive language changes; one request while in flight;
  owner-only administrator invitation option remains gated.
- Invitation revocation cancel, owner role change, administrator restrictions, success notice localization,
  history names/roles/Zagreb times, no fetch on language change and employee page permissions checked.
- Installer check-only/apply, BOM/CRLF tolerance, mismatch/reapply refusal and simulated rollback checked.
- No live database or real invitation operations used in these checks.

## Install
Extract all three files together. From SalonAI/backend on clean development:
node SalonAI_language_team_package.mjs --check
node SalonAI_language_team_package.mjs --apply
node SalonAI_language_team_verify.mjs
Use actual absolute script paths when extracted outside backend.
Report: TEMP/SalonAI_language_team_report.txt. Backup path printed by installer.
Do not run apply again after successful application. Send the verification report if any check fails.
No migration and no npm install needed.

## Manual acceptance
1. HR/EN employee headings, cards, empty/loading states, active count and My profile for employee role.
2. Open Edit, switch language with a draft; name, services and search remain unchanged. Repeated Edit scroll works.
3. Blank name feedback follows language. Existing user names/service names/notes remain original.
4. Open all four schedule sections; check day/type labels and dates. Save one test employee then reopen.
5. In a test invitation form select an email/profile, switch language; selections remain. Check a test code
   only if a new invitation is needed; do not revoke real invitations just to test localization.
6. Member role/activity controls match the account permissions. Cancel a confirmation and verify no change.
7. History uses translated labels and original names; existing timestamps remain Europe/Zagreb.
8. Both themes, narrow view, owner/admin/employee accounts and embedded wizard (if available).
9. Separate request pages may still contain Croatian until phase 1G.

## Next
1E Appointments/Calendar/Dashboard, 1F Clients/pets, 1G absence/blocked requests and full locale audit.
Seven functional phases / eight installation packages with 1D split into A and B.
Production bundle optimization remains separate (1C reported a main-chunk size warning).
