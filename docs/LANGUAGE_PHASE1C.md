# HR/EN phase 1C — navigation, header and Settings

Baseline: development ac15975. Phase 1B manual checks and push confirmed by the user.

## Included

- Sidebar navigation, mobile menu accessible names, profile role/edit labels and sign-out confirmation.
- Salon selector labels; salon names and current selection remain unchanged.
- Appearance settings including saved/storage-failure notices.
- Permission settings: role rules, individual overrides, delegation, confirmations, notices and known API errors.
- Permission history: labels, role/value descriptions, pagination states and localized timestamps in the salon timezone.
- Profile fallback can be localized without translating a real account name, username or email.

Settings account sections and invitation/setup flows retain their phase 1A/1B translations.
Clerk-hosted profile dialog is outside this package. Embedded employee/service forms in the wizard
and operational page contents remain for later packages; the partial-language notice stays visible.

## Behaviour preserved

Translation occurs only at explicit UI sites. No DOM translation, remote translation or user-content rewriting.
Language changes do not change permissions, API enum values, request bodies, currency, salon timezone,
active salon, theme, open mobile menu or unsaved permission drafts. Existing mutation confirmations remain.
The new WorkspaceSelector consumes context below Layout's existing LanguageProvider; App does not read
that context above its provider. Layout and onboarding guards are unchanged.
Stored errors and notices translate at render time. Unknown failures do not imply that a write rolled back.
Permission history keeps original instants and the supplied salon timezone, using en-GB/hr-HR presentation.
No backend changes, migrations, dependencies, environment edits or enabling of salon creation.

## Author verification

- 236 frontend Node tests passed (229 existing plus 7 new).
- Full App JSX compilation using available esbuild toolchain.
- React/jsdom mocked-transport checks: draft retention across language switches, no extra requests on switch,
  cancelled confirmation produces no write, exact permission PATCH body, live success messages,
  history keeps salon timezone, restricted editor stays disabled, owner-only delegation visibility,
  user/salon names preserved, workspace callback, theme independence, open mobile menu and sign-out cancellation.
- Installer checked with CRLF/BOM inputs, mismatched sources/prerequisites, repeat refusal and write-failure rollback.
- Installed Vite production build and visual/manual acceptance must be run on the user's machine with verify.

## Local steps

From SalonAI/backend on clean development: package --check, package --apply, verify.
Use SalonAI_language_shell_package.mjs and SalonAI_language_shell_verify.mjs.
Report: TEMP/SalonAI_language_shell_report.txt. Backup path printed by installer.
Do not repeat apply after a failed verifier; run verify alone after addressing the reported failure.

## Manual acceptance

1. Settings: HR -> EN -> HR. Sidebar, profile role, appearance, permission controls/history translate.
2. Names, emails, selected salon and theme stay unchanged. Refresh preserves saved language.
3. In a test salon, change an editable permission selection without saving, switch language and verify retention.
   Click Save and cancel the confirmation. No permission should change. Discard the test draft afterwards.
4. Confirm existing admin/employee restrictions remain; language must not unlock controls or CRM access.
5. Open history: actor/target names unchanged; dates stay in the displayed salon timezone.
6. Narrow screen, open mobile navigation, both themes. All controls readable and accessible.
7. Welcome without salon remains without sidebar; disabled creation remains hidden.

## Planned seven-package rollout

1A foundation and preferences — complete a1ae2e7.
1B invitations/creation/wizard frames — complete ac15975.
1C shared shell and Settings — this package, pending user acceptance.
1D Employees, Services/import and their embedded forms.
1E Appointments, Calendar and Dashboard.
1F Clients, pets, photos and history.
1G absence/blocked-time requests, remaining messages and cross-app locale regression.
Large packages may be split after source review; seven is the current plan, not a fixed delivery count.
Then WhatsApp/agreed AI -> mobile/PWA/store and production preparation -> free pilot -> billing.
