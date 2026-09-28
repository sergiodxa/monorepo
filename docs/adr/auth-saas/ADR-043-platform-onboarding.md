# ADR-043: Platform Onboarding

## Status

**Implemented** - 2026-09-26, with a follow-up: the confirmation screen's sign-in link and the
platform tenant's own reachability are fixed by ADR-044.

## Background

The marketing landing page's "Start Free" and "Get Started" buttons point at `#`: nothing in
this codebase lets a visitor turn into a tenant. Every tenant that exists today was written
straight into the control plane by a test or a script. `provisionTenant` (the tenant-creation
service ADR-003/004/005 describe) has run in tests since it was built and never once from a real
request.

A platform whose own front door does not work is not a platform yet, so this ADR wires
self-service signup end to end: a visitor names an organization and an email, proves the email is
theirs, and lands owning a freshly provisioned tenant with a working credential.

## Context

### A signup is two accounts at once

Signing up creates a subject who can administer the platform's dashboard-facing surface — a
_subject inside the platform tenant's own object_, the same store `ADR-034`'s member invitations
already write into — and, as a side effect of that subject existing, a brand-new _tenant_, an
entirely separate OIDC/OAuth2 provider the subject now owns a membership on. These are different
things at different layers: one is a row in a Durable Object's SQLite, the other is a row (plus a
domain, plus a provisioned Durable Object) in the D1 control plane. Getting the two wired
together correctly, in the right order, is the whole of what this ADR decides.

### Nothing should be provisioned before an email is real

An open, unauthenticated form that provisions a Durable Object per submission is a denial-of-service
surface: rate limits slow an attacker down, they never make the cost zero. Provisioning has to sit
behind proof of an email address the submitter actually controls, the same gate `hosted/sign-up.tsx`
already uses inside a single tenant. So the flow is two steps: claim an email and an organization
name, verify the email, and only then spend the cost of a tenant.

### The gap in between needs its own row

Between "email claimed" and "email verified," the organization name submitted at signup has to
live somewhere durable enough to survive a resend, a slow inbox, or the worker recycling — the
subject row itself has no field for it, and stretching a subject attribute to carry transient
signup state would make every later reader of subject attributes carry this one flow's shape. A
dedicated table, keyed on the subject id the same way `magic_link_attempts` is keyed on its own
subject, is the smallest thing that survives every one of those cases and disappears the moment
its job is done.

### The first credential ships with what already exists

Passkey enrollment has no HTTP endpoint anywhere in this codebase yet — `beginPasskeyRegistration`
and `enrolPasskey` are tenant-DO RPC methods a test calls directly, and the platform web router has
no session-cookie-authenticated guard for a signed-in visitor to reach one through. Building both
is its own piece of work, independent of whether an account can be created at all. This ADR ships
password-with-magic-link-fallback: `setPassword` and the ADR-040 magic-link mechanism are both
already exercised in production paths, so a new owner has two ways back in the moment their tenant
exists, and neither needed a line of new authentication infrastructure. Passkey enrollment for a
signed-in owner is a later ADR's problem, once something reads the session cookie this flow
already sets.

## Decision

### The routes

Five routes join `routes/web.ts`, alongside the existing `index`/`billing` routes, all served on
the platform's own hostname:

```
GET  /signup                 signup.show     — the form
POST /signup                 signup.submit   — claims the email, mints the ticket, sends the mail
GET  /signup/verify           signup.verify   — spends the ticket, provisions, opens a session
POST /signup/resend           signup.resend   — re-sends the pending signup's own ticket
GET  /signup/verify/pending   signup.pending  — the "check your email" state signup.submit lands on
```

The shapes mirror `hosted/sign-up.tsx` and `hosted/verify.tsx` closely enough that reading those
two files first is the fastest way to understand these five. The difference is what success does:
a tenant's own sign-up ends at a verified identifier: this one provisions a tenant afterward.

### `pending_signups`

A new control-plane table, migration `0011`:

```sql
CREATE TABLE pending_signups (
  subject_id TEXT PRIMARY KEY,        -- the platform subject signup created, unverified
  organization_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

`signup.submit` creates the platform subject (`platform.createSubject`), mints its verification
ticket (`platform.addIdentifier`), and writes this row in the same request, keyed on the subject
the ticket belongs to. `signup.verify` reads it back by the subject id `verifyIdentifier` names,
uses `organization_name` to provision the tenant, and deletes the row — spent exactly once,
the same way every other single-use row in this app is. A ticket that is never verified leaves an
unverified subject and an orphaned row; a periodic sweep is a follow-up, not a blocker, the same
way `magic_link_attempts` accepted unswept rows before its own cron matured.

### `signup.submit`

Validates `{ email, password, organizationName }` against the platform tenant's own password
policy (`platform.describePasswordPolicy()`), behind the same unconditional Turnstile challenge
`hosted/sign-up.tsx` already runs (`passesUnconditionalTurnstileChallenge`, scoped to the platform
tenant's own id rather than a customer tenant's), then:

1. `platform.createSubject({ identifiers: [{ kind: "email", value: email }] })` — unverified.
2. `platform.addIdentifier(...)` — mints the ticket, the same call `hosted/sign-up.tsx` makes.
3. Writes the `pending_signups` row.
4. `platform.setPassword({ subjectId, password })` — written last, once the address is claimed,
   the same ordering `hosted/sign-up.tsx` already follows.
5. Sends the verification email and redirects to `signup.pending`.

A failed send carries forward the same way `hosted/sign-up.tsx` already carries one: the subject
still exists, and `signup.resend` is how a lost email recovers.

### `signup.verify`

Reads `?ticket=`, calls `platform.verifyIdentifier({ ticket })`. On failure, renders the same
"invalid or expired" state `hosted/verify.tsx` renders. On success:

1. Reads the `pending_signups` row by the verified `subjectId`; its absence (a ticket verified
   twice, somehow) refuses the same way an invalid ticket does rather than provisioning again.
2. `Customer.create(db, { name: organizationName })`.
3. `provisionTenant(db, { customerId, name: organizationName })` — the existing service, called
   from a real request for the first time.
4. `Membership.create(db, { tenantId, subjectId, role: "owner" })`.
5. Deletes the `pending_signups` row.
6. `platform.openSessionForSubject({ subjectId, amr: ["signup"], remembered: true, ...requestOrigin })`
   — the same no-metering RPC ADR-034's invitation-accept route already opens a session through —
   and sets the `__Host-session` cookie via `serializeSessionCookie`, exactly as that route does.
7. Renders a confirmation naming the new tenant's issuer and slug, with a link to sign back in
   later at the tenant's own hosted sign-in page, and a reminder that a magic link works the moment
   a password is forgotten.

Steps 2 through 6 run without an intervening `await` boundary a concurrent verify of the same
ticket could land inside, because `verifyIdentifier` itself already spends the ticket atomically —
a replayed verify finds no `pending_signups` row and refuses at step 1, never double-provisioning.

### `signup.resend`

Mirrors `hosted/verify.tsx`'s own `verifyResend`: looks the pending subject's unverified email up
server-side by the id in the URL, never trusts a client-supplied address, and answers the same
whether or not a fresh ticket actually went out.

### Mail

The platform web router has no mail capability today. `app/http/middleware/management-mail.ts`'s
`mail()` — a `ctx.mail` publisher built once per isolate over `CloudflareTransport(env.SEND_EMAIL)`
— is already router-agnostic; it moves to `app/http/middleware/mail.ts` and mounts on both
`bootstrap/app.ts`'s and `bootstrap/management-app.ts`'s global middleware, since a name that says
"management" once a second router depends on it no longer describes what it is.

## Consequences

### Positive

- The landing page's two buttons resolve to a real, working signup.
- `provisionTenant` finally runs from a request instead of only from a test.
- No new authentication surface: `setPassword` and magic-link are both already load-bearing in
  production paths.

### Negative

- An owner's only credential at first is a password; passkey enrollment waits on its own ADR.
- An unswept `pending_signups` row from a never-verified signup is a small, permanent leak until a
  cron sweeps it, the same accepted gap `magic_link_attempts` shipped with.

### Neutral

- `signup.submit` and the tenant's own `hosted/sign-up.tsx` stay two separate, unshared code paths
  despite their visible similarity: one claims an identifier inside an existing tenant, the other
  claims one inside the platform tenant on the way to creating a new tenant entirely, and forcing
  them through one abstraction would couple two different callers' futures together for a
  resemblance that is skin-deep.

## Alternatives Considered

**Provision the tenant before the email is verified, roll it back on a resend timeout.** Skips the
`pending_signups` table entirely. Rejected: an unauthenticated request would spend a Durable
Object provision on every submission, verified or not, and "roll back a tenant" is a harder
operation to get right than "delete a pending row."

**Carry the organization name as a signed query parameter through the verification link instead of
a table.** No new table, no sweep to eventually write. Rejected: it puts the organization name in
a link a mail client, a proxy, or a browser's own history can retain and replay, and a resend would
have to re-mint the same signed value rather than reading a row back.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the platform tenant object this flow creates a subject inside
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — `customers`/`tenants`/`memberships`, the rows this flow writes
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md) — the platform-domain issuer `provisionTenant` mints
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — `createSubject`/`addIdentifier`/`verifyIdentifier`, the ticket mechanism this flow spends
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md) — `setPassword`, the first credential this flow writes
- [ADR-034: Management API](./ADR-034-management-api.md) — the platform subject and `openSessionForSubject` this flow reuses unchanged
- [ADR-040: Magic Link Sign-In](./ADR-040-magic-link-sign-in.md) — the fallback credential a signed-up owner already has without enrolling anything
