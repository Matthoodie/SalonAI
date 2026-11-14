# HR/EN 1E-A — Calendar and Dashboard

Baseline: development 199b0e5, phase 1D-B accepted with 251/251 frontend tests and manual checks.

## Scope
- Calendar headings, month/weekday names, date navigation, loading/empty/error states,
  appointment counts, status labels and accessible button names.
- Dashboard periods, range validation, statistics, schedule and upcoming lists.
- English dates use en-GB and amounts remain EUR. Croatian uses existing hr-HR formatting.
- Pet/owner presentation translates species and UI labels only. User names, breeds,
  service names, employee names and other entered data remain literal.

## Preserved contracts
- Date keys, appointment IDs, status codes, filters, permissions and callbacks are unchanged.
- Switching language preserves selected calendar day/month and dashboard range drafts/results.
- It does not submit mutations or trigger the calendar month callback.
- Dashboard timestamps retain the salon timezone; all-day display retains calendar dates.
- Calendar's existing local-date navigation behaviour is unchanged by this language package.
- Completed service value uses existing saved-price calculations, not payment records.
- No backend, migration, API schema, dependencies, environment or salon-creation changes.

## Verification before delivery
- 259/259 frontend Node tests passed (8 new overview localization tests).
- Full App and page JSX compile checks passed with esbuild.
- Mocked React/jsdom checks: range drafts/DOM and totals survive language changes;
  invalid ranges and missing-price notices translate; salon timezone is retained;
  Calendar selection, month navigation, completed badges and action payloads are preserved;
  read-only guards and loading/error messages remain correct.
- Installer checks cover check-only, CRLF/BOM, application, repeat/modified-file refusal,
  prerequisite mismatch, and byte-exact rollback with new-file cleanup on simulated write failure.
- Installed Vite build and manual browser/theme/responsive checks remain user acceptance tasks.

## Local procedure
1. Extract package, verify and PROCITAJ.txt together outside the repository.
2. From backend on clean development, run package --check, then package --apply.
3. Run verify; it executes frontend tests/build and Git checks, writing the TEMP report.
4. Start frontend and check both languages with existing salons/accounts.
5. Check Calendar month/year/date navigation, selected date, completed badges and pet owner labels.
6. Check permitted create/edit navigation and restricted account controls.
7. Check Dashboard today/custom/range periods, reversed-range error, counts and EUR amounts.
8. Switch language with a range selected; values and selected dates must stay intact.
9. Check light/dark themes and a narrow window. Send report before commit/push.

No npm install or database migration is required. Do not reapply after a failed verifier;
inspect the report first. The installer prints a backup directory before writing.

## Next
1E was split to keep booking mutations separate from display localization:
1E-A Calendar/Dashboard -> 1E-B Appointments and booking forms -> 1F Clients/pets ->
1G absence/blocked requests and global HR/EN QA. Seven functional phases now use
nine planned installation packages, subject to findings in final QA.
The separate Appointments page/form is not fully translated by 1E-A, even when
opened from Calendar. Product roadmap after HR/EN remains unchanged.
