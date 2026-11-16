# ZRIHTAN — dashboard business overview, package C

Baseline: 2c4358b (accepted rebrand), with 283 existing frontend tests.

## Scope and definitions

Owner/admin dashboard gains four primary metrics:
1. Completed service value for the selected range, from saved appointment prices.
2. Upcoming booking value, pending/confirmed starts at or after now, through the end
   of the 30th salon calendar date including today (today + 29). Independent of the filter.
3. Average completed appointment value, including free appointments and counting a
   multi-service appointment once. No completed rows or any missing prices => unavailable.
4. Completed appointment count, with equal-length previous-period comparison.

Existing total/active/cancelled/no-show counts remain in a compact strip. Today's
schedule and the next five active appointments remain unchanged. Employees keep the
existing scoped dashboard; the new business component is mounted only for canManage.
No permissions, data-fetching, auth, API, database or dependency changes.

Ranges are inclusive calendar dates in the salon timezone and use appointment START,
not the date when its status changed to completed. Previous range immediately precedes
the selected range and contains the same number of calendar days. A current or future
range is explicitly marked unfinished; comparisons are not adjusted to elapsed hours.
An empty recorded range has zero count/value but no average. A zero-to-positive baseline
has no percentage; zero-to-zero is 0%. Missing prices suppress total/average comparisons.
A known subtotal and missing count are shown separately, never presented as complete.
Unsafe sums, duplicate appointment IDs or invalid dates fail closed in the new overview.

## Charts and ranking

Trend is period value, NOT cumulative value. Up to 12 equal-width groups of days (last
may be shorter), with previous range aligned by relative day order. Missing prices
produce gaps. Both-empty ranges show an empty state. Free appointments are valid zeros.
A keyboard-accessible details/table contains exact group dates and amounts; chart axis
amounts are compact formatted. Solid/dashed series distinguish periods beyond colour.
Narrow screens can horizontally scroll the chart/table within their container.

Top five services can be sorted by total saved value or item delivery count. Group by
service ID, never by display name. Each item in a multi-service appointment contributes
its own saved price once. Identical names with different IDs remain distinct; displayed
name comes from the latest included item, with ID shown. Invalid/duplicate/mismatched
items exclude the whole appointment from ranking and are counted in a visible notice.
Legacy single-service mapped rows use their parent saved price; old display names may
come from the existing mapper/catalogue fallback, not a historical name snapshot.
User-provided names are not translated. HR/EN and both themes supported.

## Data scope and operational limit

The inspected findAllAppointments implementation returns the full authorised salon or
employee appointment list without pagination; the UI uses that already loaded list.
It does not call calendar visible-month data or fetch additional data. Metrics reflect
loaded data; time windows update with the existing 30-second clock/focus mechanism,
but this does not fetch mutations made by another browser. Reload to retrieve those.
Before introducing appointment pagination or supporting large datasets, move analytics
to a server aggregate endpoint with explicit completeness, scope and range guarantees.
Never compute salon totals from a paginated/partial list while implying completeness.

Saved completed service value is not payments, profit, tax reporting or revenue recognition.
Upcoming booking value is planned value and may change through cancellations/edits.
No fabricated demo data, AI insights, capacity claims or historical schedule assumptions.

## Validation and local acceptance

300/300 frontend tests passed (17 new analytics tests). Full main/App compilation passed.
React DOM checks passed: manager guard, four cards, live HR/EN with retained sorting,
literal names, chart accessible labels, missing/empty states and range draft clearing.
Installer checked: no-write preflight, source/hash mismatch refusal, CRLF/BOM support,
apply/reapply behaviour and byte-exact rollback after simulated write failure.
Real Vite build runs in the user's verifier. Browser visual acceptance remains local.

After apply/verify, check an existing owner/admin salon:
- Today and 30 days; one chosen range with completed appointments.
- Completed value/count against known records; one multi-service appointment if available.
- Future card stays independent of the history filter (today plus 29 calendar dates).
- Trend table shows exact dates; top services toggle by value/count.
- HR/EN, light/dark, narrow viewport; employee overview remains scoped as before.
No test data creation, migration, npm install or .env change is needed.

## Next

D: capacity/utilisation and heatmap, after reviewing historical schedule availability.
E: deterministic business insights. Then WhatsApp and existing production roadmap.
