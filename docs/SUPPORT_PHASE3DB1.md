# Support S3D-B1 — Resend transport

## Scope
Small independently tested foundation after successful manual provider test.
The transport is not imported by createApp, reply service or preview script.
No worker, database migration, environment edits, automatic emails or new dependencies.
A successful provider response means accepted, not delivered.

## Contract
createSupportResendTransport accepts enabled (boolean, false by default), apiKey,
one allowedRecipients entry, optional fetchImpl and timeoutMs (1..30000).
The returned function accepts to, subject, text, idempotencyKey. Other fields are not sent.
Recipient must match exactly; no rerouting other users' notifications to a tester.
Disabled calls do not need credentials and never call the provider.
Provider host and sender are fixed. Redirects are rejected. Each call makes at most one request.
Outcomes: disabled, blocked, accepted, rejected, rate_limited, unknown.
Provider error bodies and caught errors are not returned or logged.

## Important boundary
This low-level module does NOT provide durable exactly-once delivery. Its caller must
persist a unique event-scoped key and frozen payload before calling it. Resend retains
idempotency keys for 24 hours, so an uncertain event must not be automatically retried
after this window. HTTP 408/409/5xx, timeout and malformed success are treated as unknown.
The next package must implement database state, lease/concurrency, bounded retries,
verified contact resolution and explicit activation cutoff before connecting this module.
No production release or bulk held-event release is authorized by this package.

## Validation
node --test tests/supportResendTransport.test.js
19 isolated tests; all provider calls mocked; no key or database required.
Full PostgreSQL regression is not executed by this package; existing DB behavior is untouched.

## Installation
From backend: node <package>/install.mjs --check
Then: node <package>/install.mjs --apply
Requires development branch and clean git tree. Checks baseline files with normalized newlines.
Existing files backed up under OS temp; failed application rolls back written files.
No commit or push is performed by installer.

## Provider references
https://resend.com/docs/api-reference/emails/send-email
https://resend.com/docs/dashboard/emails/idempotency-keys
