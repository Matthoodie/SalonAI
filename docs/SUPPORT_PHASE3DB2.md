# Support S3D-B2 — durable delivery lifecycle

## Status and scope
Prepared after user confirmed ae3ed5b, 19 transport tests, verified Resend domain
and receipt of a synthetic email in Gmail Inbox. This package adds persistence and
an internal processing service. No HTTP endpoint, startup worker, CLI send command,
API credentials or environment changes. Installing/migrating cannot send email.

## Data
Existing support_notification_outbox rows remain held. The state constraint expands
to held, ready, sending, accepted, rejected, uncertain, suppressed.
New support_notification_delivery rows hold the single selected recipient, minimal
HR/EN notification, unique UUID idempotency key, activation boundary, attempts and
lease metadata. A trigger rejects changes to the frozen snapshot. New
support_notification_attempts records each attempt with a separate token. Both
cascade when the original ticket/message/event is deleted.
No reply body, ticket description or API key is copied into these tables.
The email address is personal data; access/retention must follow support data policy.

## Internal service
createSupportDeliveryService defaults enabled=false. It requires an explicitly
injected pool, verified-contact resolver and transport to process anything.
prepare and runOne require exact eventId, authorId, allowedRecipient and UTC
activationAfter. Contact must match the current active Clerk identity, verified=true
and the exact allowed email. A caller cannot redirect someone else's notification
to a test inbox. Local account is rechecked under a lock before preparation/claim.
The resolver is an integration seam, NOT an implemented Clerk lookup in this package.
No public/user-controlled API may supply the verified flag.

Preparation locks the author then event, checks ownership and activation, and saves
one immutable payload. The next run claims one exact event and commits its attempt
before invoking the transport. Completion is a second transaction, guarded by the
attempt token. Concurrent callers cannot claim the same event simultaneously.
Changing the verified address suppresses the frozen old recipient; it is not overwritten.

## Outcomes and conservative recovery
- accepted means provider accepted, not delivered/read.
- rejected, blocked, disabled do not automatically retry.
- timeout, network failure, malformed response, HTTP 408/409/5xx -> uncertain.
- expired 2-minute lease -> uncertain, never automatically reclaimed.
- only explicit rate_limited schedules another eligible attempt after 5 minutes.
- maximum 3 attempts, same frozen payload/key, within 23 hours of first claim,
  with 2-minute request margin. Deadline never extends.
- persistence failure after network call leaves sending; the expired lease is then
  uncertain. Do NOT reset state or create a new key just to try again.
- a late/stale completion cannot overwrite the state after lease recovery.
- no scheduler scans rows; a trusted caller must invoke runOne for the selected event.

This favors avoiding duplicate mail over automatic eventual delivery. Uncertain
records require provider inspection and an audited reconciliation flow in a later
package. They must not be manually reset using ad-hoc SQL.
Resend's idempotency retention is 24 hours:
https://resend.com/docs/dashboard/emails/idempotency-keys

## Verification
166 isolated support tests passed in the preparation environment (includes 20 new
service tests and 19 existing transport tests). No real email is sent by tests.
17 new PostgreSQL cases cover historical cutoff, concurrent prepare/claim, immutable
snapshot, token fencing, rate limits/deadline, rollback, identity and deletion.
PostgreSQL was not available in the preparation environment. Run the supplied verifier
against salonai_regression before applying the migration to salonai_dev.
Database verifier checks configured and actual TEST name, applies TEST migrations,
runs 17 new cases plus 10 existing outbox cases, then full backend regression.
No exact full-suite total is promised; test discovery is repository-dependent.

## Install and release
Package installer requires clean development branch and checks baseline hashes.
Use --check then --apply; changed file backups are outside the repository in OS temp.
Run verify.mjs --unit then --database from backend. Only after successful TEST checks,
apply DEV migration separately and commit the package. Do not enable a real sender yet.
Rollback: application is not wired into this service. Leave delivery schema/evidence
in place; migration down deliberately refuses destructive removal.

## Next: S3D-B3
Guarded one-event CLI: explicit DEV database, current verified primary Clerk email,
allowed test recipient, activation boundary, preview then explicit prepare/send.
Key via server environment only. Verify one notification end-to-end, including
provider receipt and delivery evidence. No old held backlog activation and no broad
production delivery. Webhooks/reconciliation and operational activation follow.
