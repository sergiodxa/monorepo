# ADR-037: Subject Import and Export

## Status

**Proposed** - 2026-09-18

## Background

A customer adopting this platform already has a directory somewhere else, and the first question
they ask is how their accounts get in. The second, asked less loudly but weighing more, is how
they get out again. The ability to leave is what makes a platform safe to adopt, so import and
export are a base feature, available on every tier including Free.

Both are the same problem from two ends: a tenant's directory is rows inside one single-threaded
Durable Object, and moving a million accounts through it has to be paced against the sign-ins that
object is serving at the same time.

The credential question is settled elsewhere and constrains this one.
[ADR-007](./ADR-007-password-credentials.md) stores one hash per subject through the `password`
module of `@sdxc/crypto`, under the single credential hash
[root ADR-040](../ADR-040-pbkdf2-as-the-only-credential-hash.md) fixes, upgrading a stored value on
the request that accepted the plaintext. A directory arriving from elsewhere brings hashes that
module does not recognize.

## Context

### One credential hash means one importable format

The `password` module is self-describing: a stored value carries the parameters it was made with,
`password.verify` reports `MalformedHashError` for a value written by another scheme and
`UnsupportedAlgorithmError` for a well-formed value carrying another algorithm tag, and
`password.needsRehash` reports a value this package parses as foreign. So the platform already has
an exact, algorithm-agnostic test for whether an imported hash is one it can hold, and that test
stays correct when the hash policy moves.

Accepting a foreign hash and verifying it on first use is permanent rather than temporary: a
directory always contains accounts that never sign in again, so the second implementation is never
removed. One hash means one format in, and the accounts whose hashes cannot come with them arrive
as subjects who set a password.

### An import is a write burst against a live object

Each imported subject is a subject row, its identifiers, its password when one came, and its
declared attributes — around five row writes. A million subjects is therefore around five million
row writes, and while they run the same object is answering that tenant's sign-ins. Pacing is part
of the design rather than an operational setting, and so is refusing an import that would not fit
in the object's storage before it has written half of it.

### A partial failure is the normal outcome

A real export from another system has addresses that collide, attributes the tenant never
declared, and fields this platform has no column for. An import that stops at the first is one a
customer runs twenty times, so a failing row is recorded and skipped, the run continues, and what
failed comes back as a file to fix and resubmit.

## Decision

### The file

NDJSON in R2, one subject per line: `identifiers`, `profile`, `attributes`, `roles`, an optional
`password` holding a hash, and an optional `externalId` the report echoes so a customer can match
a failure to their own record. A field the platform has no home for is reported per row and left
out — including `phone_number` and `phone_verified`, since a phone is not an identifier, a factor
or a delivery channel here and the verified mailbox is what proves ownership of an account.

`verified_at` on an identifier is taken from the file. The tenant is asserting the history of its
own directory, and the alternative is mailing every account at once on the day of a migration,
which trains people to click the link in an unexpected message. The run records that verification
came from the import, and the audit row names the actor who started it.

### Hashes, accepted and refused

A `password` value is accepted when the `password` module parses it as its own, in which case it
is written to the subject's row and verifies at the next sign-in like any other, with
`password.needsRehash` upgrading it if it trails current policy. That covers an export from this
platform and any system already writing the same format.

Every other value — a bcrypt, argon2 or MD5 hash, or one carrying another algorithm tag — is
refused at validation, and the subject imports with no password credential and `must_change` set.
At the next sign-in the identifier resolves, nothing verifies, and the hosted flow offers a reset
to the address the import brought. A customer who would rather not ask everyone to reset runs a
dual migration instead: their old system keeps verifying through a cutover window and calls
`setPassword` on each success, so credentials move as people sign in and nobody is mailed.

Passkeys and TOTP secrets do not travel in either direction. A passkey is bound to the relying
party it was created for, and a shared secret handed between platforms is a shared secret.

### The run

`@sdxc/jobs` carries it. `subjects.import` walks the file in batches and the run's counters live in
the control plane, where the dashboard and the management API read them:

```sql
CREATE TABLE tenant_import_runs (
  id TEXT PRIMARY KEY,               -- imp_… TypeID
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  mode TEXT NOT NULL,                -- "validate" | "apply"
  source_key TEXT NOT NULL, report_key TEXT,
  status TEXT NOT NULL,              -- "queued" | "running" | "completed" | "failed"
  total INTEGER, processed INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER, finished_at INTEGER, created_at INTEGER NOT NULL
);
```

Per-row failures go to an NDJSON report in R2 rather than to rows, so an import that fails
wholesale costs the object nothing and the customer downloads exactly the lines to fix.

`mode: "validate"` is the dry run: every check, nothing written. It parses each line, folds each
identifier, finds duplicates within the file and collisions against the tenant, checks each
attribute key is declared, tests each hash, and projects the storage the import would add against
the object's ceiling, so a run that would not fit is refused before it starts.

### Pacing

A batch is 200 rows in one `importSubjects` call, applied as a synchronous statement sequence with
no `await` inside it, so the batch lands as one transaction and no interleaving point opens in the
middle of it. The job holds to one batch a second per tenant and halves that when the object's
response time crosses a threshold, which puts a steady state around 200 subjects a second — a
million-subject directory in a bit over an hour, while the tenant keeps signing people in. Those
five million row writes are a one-off cost of a few dollars, which is why an import carries no
charge and why the rate that matters is the object's rather than the price.

### Export

`subjects.export` writes NDJSON to R2 by paging `exportSubjectPage`, downloaded from a signed URL
valid for 24 hours. It carries subjects, identifiers with their verification state, profile
columns, declared attributes, role assignments, and credentials metadata: that a password exists
and when it changed, each passkey's label and enrolment date, whether a second factor is enrolled,
and the ids of live API keys.

Password hashes are carried too, under a scope of their own. Emitting them is what makes the
export a migration rather than a list of names, and withholding them would be lock-in wearing the
clothes of security. The cost is that one request can carry every credential in the tenant, so the
`export:credentials` scope is separate from `export:read`, the member who asks presents a second
factor, the run writes an audit row, and the tenant's owners are mailed when it starts.

### RPC methods

- `beginImportRun({ runId, mode, estimatedRows })` — reserves the run, projects the storage it
  would add against the object's ceiling, and refuses upfront rather than partway.
- `importSubjects({ runId, mode, rows })` — validates and applies one batch, answering a per-row
  outcome for each and the run's running counts.
- `completeImportRun({ runId })` — closes the run and answers its totals.
- `exportSubjectPage({ cursor, limit, includeCredentials })` — one page of the directory, with both
  ordering columns in the projection so the cursor is minted from the row that came back.

## Consequences

### Positive

- A customer can leave with everything the platform can hand over, credential hashes included, so
  adopting it is reversible.
- The importable-hash test is the `password` module's own parser, so a change to the hash policy
  needs no edit here.
- A dry run answers every question an import raises — collisions, undeclared attributes, unusable
  hashes, storage — before a row is written, and failures come back as a file rather than as rows.

### Negative

- A directory whose hashes this platform cannot hold arrives as accounts that must reset, a real
  cost paid by a customer's users on the day of the migration.
- An import competes with live traffic for one single-threaded object, so the pacing is a ceiling a
  customer cannot raise by paying.
- Taking `verified_at` from the file trusts the exporting system about mailbox ownership, so a
  directory that was wrong stays wrong here.
- A credential export is one request yielding every password hash in the tenant; the scope, the
  second factor, the audit row and the notice bound that rather than remove it.

### Neutral

- Passkeys and second factors stay behind on both sides, so a migration either way is a
  re-enrolment for the subjects who use them; runs are rate limited per tier like every other
  management route.

## Alternatives Considered

**Accepting foreign hashes and verifying them on first use.** It is what most platforms do, and it
migrates a directory with no reset at all. It requires a second hashing implementation kept
forever, because the accounts that never sign in keep their foreign hashes indefinitely, which is
exactly the permanent second algorithm the repo decided against. Rejected.

**A synchronous import endpoint for small directories.** Under a few thousand subjects it would
answer in one request and save a customer the job machinery. It gives the same feature two code
paths with two failure models, and the small case is the one where waiting costs least. Rejected.

**Refusing to export password hashes.** It removes the single most dangerous response the API can
produce, and it is easy to defend as a security decision. It also means a customer cannot leave
without a mass reset, which makes every word about portability untrue. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the single-threaded object and its storage ceiling
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — the folding and uniqueness rules an imported row is validated against
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md) — where the hash is stored and how it is upgraded
- [ADR-034: Management API](./ADR-034-management-api.md) — the routes that start a run and read its progress
- [root ADR-040: PBKDF2 as the Only Credential Hash](../ADR-040-pbkdf2-as-the-only-credential-hash.md) — one credential hash, reached through `@sdxc/crypto`
- [root ADR-054: Jobs Package with Queue Adapters](../ADR-054-jobs-package-with-queue-adapters.md) — the dispatcher that runs both jobs
