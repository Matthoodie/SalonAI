# Shared HR/EN file picker — package A

Baseline: 29033f4, accepted HR/EN phase 1G (283/283 tests and manual acceptance).

## Delivered

One shared FilePicker control for pricelist recognition and pet photo editing.
HR: Odaberi datoteku / Promijeni datoteku / Nije odabrana datoteka.
EN: Choose file / Change file / No file selected.
The original filename is displayed as escaped text and wraps on narrow screens.
Both surfaces use the same theme colours, button and field styles.
Native operating-system file-dialog language remains controlled by the OS/browser.

The semantic button is keyboard accessible, has visible focus and an accessible
name including the field label. The selected filename is announced as status.
Opening/cancelling the dialog does not upload, recognise or clear the accepted file.
The native input resets after selection so the same file may be selected again.
HR/EN changes preserve File identity and photo preview. Busy controls remain disabled.
Photo type/size/dimension checks and explicit save/remove confirmation are retained.
Pricelist size limits and explicit recognition/append workflow are retained.
No backend, database, auth, permissions, dependency or .env changes.

## Verification

283 existing frontend tests passed. Full App JSX compiled with esbuild;
installed Vite build is run by the supplied verifier on the developer machine.
Mocked React DOM scenarios passed: HR/EN, original filename/escaping, cancel,
same-file reselection, exact File/salon forwarded only on explicit recognition,
busy guards, zero/oversized file rejection, photo preview and URL cleanup,
photo MIME/dimensions, focus and inactive-owner guard.
Installer checked for read-only validation, CRLF/BOM compatibility, exact application,
refusal on source/prerequisite mismatch or reapplication, rollback on simulated failure.
No real OpenAI or upload calls were made in these checks.

## Local acceptance

Run package --check then --apply from backend, then the supplied verify script.
No migration or npm install is needed. Start the existing frontend dev server.
Check only the two changed controls in HR/EN and light/dark themes:
- Empty selection, selected filename, cancel retains selection, choose same file again.
- Keyboard focus and button activation; long filename on a narrow screen.
- Pet photo preview is retained when changing language; save remains explicit.
- Pricelist selection alone does not start recognition.
The full HR/EN manual audit has already been accepted and need not be repeated.

## Planned next work

B: visible ZRIHTAN branding. C: dashboard values, comparisons, trends, top services.
D: capacity and heatmap after confirming source/history requirements.
E: rule-based business insights. Then WhatsApp and the existing main roadmap.

Later metrics can use earlier stored records when required historical fields exist.
Appointment price/duration snapshots support retrospective service value and averages.
Recorded service items support top services without multiplying appointment counts.
Actual payments cannot be inferred from completed status. Historical capacity requires
historical working hours, absences and blocks; today's schedule is not proof of past
availability. Missing historical data must be indicated, not silently treated as zero.
Preserve snapshots and relevant history as part of dashboard design.
