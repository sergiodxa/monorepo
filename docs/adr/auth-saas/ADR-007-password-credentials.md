# ADR-007: Password Credentials

## Status

**Proposed** - 2026-09-18

## Background

A subject exists and can be found by an identifier. Nothing yet proves that the person typing the
identifier owns it. A password is the first proof the platform accepts, and it is the one every
customer arrives expecting.

The hashing question is already answered for the repo:
[root ADR-040](../ADR-040-pbkdf2-as-the-only-credential-hash.md) fixes a single credential hash,
reached through `@sdxc/crypto`'s `password` module, with no second hashing library kept alongside it.
What that leaves open is everything around the hash: where verification runs, what a tenant may
require of a password, how long one stays good for, how a reset proves anything, and what a change does
to sessions already open. Password credentials are a base feature, available on every tier including
Free.

## Context

### The hash is decided; the cost and its upgrade path are the design

`password.hash` writes a self-describing string that carries its own cost parameters, so raising
policy is a change in `@sdxc/crypto` rather than a schema change here. `password.verify` derives with
the parameters found in the stored value, and `password.needsRehash` reports a value written below
current policy. This app names no parameters of its own; it consumes the module's. That leaves one
rule for this ADR: the only moment the plaintext exists is the request that verified it, so that is
the request that writes the replacement.

### Verification is CPU inside a single-threaded object

The hash lives in the tenant object, so verification runs there. An object is single-threaded per
instance, which makes a deliberate key-derivation cost the one thing an anonymous caller can schedule
on a tenant's object at will. Sign-in cost is therefore an availability property as much as a
security one, and the rate limiting an attack-protection ADR adds later is what keeps it bounded.

The same cost bounds what comparing a candidate against old passwords can be. Every stored hash carries
its own salt, so two hashes of one password are unrelated strings: checking a candidate against N stored
values is N slow derivations, one after another on that thread. That bounds N rather than detailing it.

### A password is optional

Passkeys are a primary credential, not a convenience layered over a password. A subject may have a
passkey and no password, and sign-up may never ask for one. So the credential row is optional, and
removing it is an ordinary operation rather than an account deletion in disguise.

### Policy that changes guessing odds, and policy that only changes typing

| Rule | Effect on an attacker | Effect on a person |
| --- | --- | --- |
| Minimum length | Raises the search space directly | One requirement to meet |
| Breached and common deny-list | Removes the passwords guessed first | Rejects a choice already public |
| Composition classes | Narrows the search space to predictable shapes | `Password1!` |
| Scheduled expiry | Buys nothing against a hash already stolen | Predictable mutation, reuse elsewhere |

The first two are always on and composition classes are not offered at all. Expiry is a tenant setting
defaulting to never, and the last row is why: a date does nothing to a hash already stolen, and what a
calendar reliably produces is a counted mutation of the password before it. The platform's answer to a
suspected compromise stays a targeted forced reset; the setting exists for the tenant whose auditor
requires an interval over defaults that stay strong.

## Decision

### Storage and policy

One `passwords` table in the tenant object: `id`, `subject_id`, `hash`, `created_at`, `expires_at` and
`must_change`, indexed on (`subject_id`, `created_at`). A subject holds several rows and only the newest
authenticates; the older ones exist to be compared against, and a subject with no row has no password.

A password is NFKC-normalized before hashing, so the same characters typed on two keyboards derive
the same key, and accepted at any length from the tenant's minimum up to 256 characters, with every
code point allowed.

Policy is per tenant, held on the tenant's settings row: a minimum length defaulting to 8 and raisable
to 64, a list of tenant-supplied denied terms such as the product name, an expiry interval defaulting
to never, and a history depth `N` defaulting to 1 and raisable to 5. Three checks always run, and
none of them can be switched off:

- The top 100,000 breached and common passwords, shipped as truncated SHA-256 prefixes in a sorted
  binary asset and searched inside the object. The structure is decoded on first use rather than at
  module scope, so a tenant that never sets a password never pays for it.
- Similarity to the subject's own identifiers: the email local part, the domain label and the username.
- The tenant's denied terms.

A deny-list a tenant can switch off is one that gets switched off during a migration and stays off,
and the passwords it removes are exactly the ones guessed first. Length is the knob, the list the floor.

### Expiry, and setting a password after one

`expires_at` is stamped when the row is written, from the tenant's interval, and is null when that
interval is never. Past that moment the row stops authenticating: `signInWithPassword` answers
`password_expired` and opens no session, with no warning window, because a credential that still works
after its stated life has not expired.

Replacing it needs a proof that is not the expired password, and the platform has one. The subject
completes [magic-link sign-in](./ADR-040-magic-link-sign-in.md) against any verified address; that
proves a mailbox, and the session it opens reports a password change is owed, so the next screen sets
one. A ticket kind of its own — another mail, expiry, rate limit and single-use statement to get right
— buys nothing the magic link already delivers.

### Reuse, and what is kept

Setting a password derives the candidate against every row the subject still holds and refuses a
match, so what comes back is never a password used inside the window. Every path that writes one runs
the check — set, change, reset completion — because a rule one path skips is not a rule.

`N` is that window, counted in rows: a set performs at most `N` derivations, inserts the new row, and
deletes anything beyond the newest `N`, so at `N` of 5 the sixth row goes in the same write. A hash
that can no longer be compared against is not worth keeping, and per-object storage is finite.

The derivations are the feature's real price. At `N` of 5 a set costs about five sign-ins of CPU on a
single thread while that tenant's other operations wait, which is why 5 is the maximum and why the work
sits in `setPassword` — authenticated, rate-limited, invoked a handful of times in an account's life and
never on the anonymous path. Those derivations, the insert and the trim are one method, so what would
otherwise be a read-modify-write across an interleaving point is one complete operation.

### RPC methods

- `setPassword({ subjectId, password, actor })` — enforces policy, derives the candidate against each
  retained row and refuses a reuse, writes the new row with its `expires_at`, trims the history to
  `N`, and returns the policy failures as a plain discriminated union rather than an error.
- `signInWithPassword({ identifier, password, agent })` — folds the identifier, verifies against the
  subject's newest row, rehashes when `password.needsRehash` reports it behind policy, and opens the
  session in the same call, returning the subject, the methods used and whether a second factor or a
  password change is owed. A row past `expires_at` opens nothing and answers `password_expired`. A
  subject with no password, a blocked subject and an unknown identifier all derive against a fixed
  dummy value first, so the time taken says nothing about who exists.
- `changePassword({ subjectId, currentPassword, newPassword, keepSessionId })` — verifies the current
  password, writes the new one, and revokes every session and refresh token except the one named.
- `beginPasswordReset({ identifier })` — mints a single-use ticket valid for 30 minutes, stores only its
  hash, and returns the plaintext once with the address to deliver it to. The ticket crosses the boundary
  because delivering it is the operation's point, and the return shape is identical whether or not the
  identifier resolves.
- `completePasswordReset({ ticket, newPassword })` — spends the ticket, writes the password, marks the
  address verified, and revokes every session and refresh token for the subject.
- `forcePasswordReset({ subjectId, reason })` — sets `must_change`, revokes every session, and records
  the reason for the audit log.
- `removePassword({ subjectId })` — deletes every row for the subject, refusing unless a credential
  remains, so the operation cannot leave an account with no way in.
- `describePasswordPolicy({})` — the minimum length, denied terms, expiry interval and history depth
  the hosted pages state before anyone types, cached in the Worker like the other read-only documents.

### What a password change does to sessions

A change revokes every session except the one performing it, because the person changing it is present
and the sessions they are not holding may be an attacker's. A reset revokes all of them, including the
one that completed it, because a reset is what someone locked out does and the browser holding a session
may not be theirs. Both call the tenant object's own revocation, stated by the sessions and token ADRs,
in the same method, so each is one round trip.

## Consequences

### Positive

- One hashing implementation repo-wide, and one place a cost increase is made, reaching every tenant
  through rehash-on-verify without a migration.
- A stored value that cannot be parsed denies access rather than surfacing as an interpretation failure.
- Sign-in answers in the same time whether or not an account exists, and a passkey-only account is
  ordinary, so passwordless sign-up ships with one subject model.
- Expiry is a fact on the row, so switching it on needs no migration and no sweep, and a subject locked
  out by it recovers through a flow the product already runs.

### Negative

- Verification is deliberate CPU on a single-threaded object, so a burst of attempts delays that
  tenant's other operations until rate limiting refuses them; a reuse check at `N` of 5 spends about
  five times that on one set.
- Password history keeps hashes a subject has stopped using, so a stolen backup carries more material.
- Switching the interval on ages passwords from the next set rather than retroactively, so rotating an
  existing population needs `forcePasswordReset`.
- The deny-list is bundled, so it is only as current as the build that shipped it.
- Refusing to remove the last credential means deleting an only passkey requires setting a password
  first, an extra step in a passwordless product.

### Neutral

- `must_change` is enforced at sign-in by the hosted UI, so a client using the API directly reads the
  flag from the sign-in result and decides what to do with it.
- Reset tickets are rows with an expiry, so they are one more table with a retention rule.
- Expiry and history are policy settings rather than plan features, so a tenant on Free has both.

## Alternatives Considered

**A second hashing algorithm for imported credentials.** It would let a migrated hash verify in place.
It also permanently reintroduces the library the repo removed, for a path a forced reset covers. Rejected.

**A live breach-corpus lookup on every password set.** Always current, and larger than anything bundled.
It puts a third-party request on the sign-up path, tells that party the prefix of every password chosen
here, and fails in a way that must block sign-ups or skip the check. Rejected.

**Comparing hashes instead of deriving.** A per-subject salt, or a second unsalted digest, turns the
reuse check into `N` string comparisons and costs nothing. It also builds a store where one password's
hash tells an attacker about another, and an unsalted digest of a real password is what breach corpora
are made of. Rejected: the check is worth its CPU or it is not worth running.

**Composition rules as a tenant option.** Buyers ask for them by name to satisfy a checklist. Classes
narrow the search space to predictable shapes and produce `Password1!`, so offering them ships a control
that makes accounts weaker. Rejected; length and the deny-list are the surface. Expiry is the other case
on that list and is offered, because a tenant leaving it at never sits where the guidance puts them.

**Verification in the Worker with the hash fetched over RPC.** Moves the CPU off the object, and moves
a credential hash across the boundary on every sign-in, contradicting the rule that the object is the
trust boundary for its own state. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md)
- [ADR-008: Passkeys](./ADR-008-passkeys.md)
- [ADR-040: Magic Link Sign-In](./ADR-040-magic-link-sign-in.md) — the proof a subject offers once its password has expired
- [root ADR-040: PBKDF2 as the Only Credential Hash](../ADR-040-pbkdf2-as-the-only-credential-hash.md)
- [root ADR-023: Web Crypto Primitives Package](../ADR-023-web-crypto-primitives-package.md)
