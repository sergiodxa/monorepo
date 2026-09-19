# ADR-007: Password Credentials

## Status

**Proposed** - 2026-09-18

## Background

A subject exists and can be found by an identifier. Nothing yet proves that the person typing the
identifier owns it. A password is the first proof the platform accepts, and it is the one every
customer arrives expecting.

The hashing question is already answered for the repo:
[root ADR-040](../ADR-040-pbkdf2-as-the-only-credential-hash.md) fixes a single credential hash,
reached through `@sdxc/crypto`'s `password` module, with no second hashing library kept alongside
it. What that leaves open is everything around the hash: where verification runs, what a tenant
may require of a password, how a reset proves anything, and what a change does to sessions that
are already open.

Password credentials are a base feature, available on every tier including Free.

## Context

### The hash is decided; the cost and its upgrade path are the design

`password.hash` writes a self-describing string that carries its own cost parameters, so raising
policy is a change in `@sdxc/crypto` rather than a schema change here. `password.verify` derives
with the parameters found in the stored value, and `password.needsRehash` reports a value written
below current policy. This app names no parameters of its own; it consumes the module's.

That leaves one rule for this ADR to state: the only moment the plaintext exists is the request
that verified it, so that is the request that writes the replacement.

### Verification is CPU inside a single-threaded object

The hash lives in the tenant object, so verification runs there. An object is single-threaded per
instance, which makes a deliberate key-derivation cost the one thing an anonymous caller can
schedule on a tenant's object at will. Sign-in cost is therefore an availability property as much
as a security one, and the rate limiting an attack-protection ADR adds later is what keeps it
bounded.

### A password is optional

Passkeys are a primary credential, not a convenience layered over a password. A subject may have
a passkey and no password, and sign-up may never ask for one. So the credential row is optional,
and removing it is an ordinary operation rather than an account deletion in disguise.

### Policy that changes guessing odds, and policy that only changes typing

| Rule | Effect on an attacker | Effect on a person |
| --- | --- | --- |
| Minimum length | Raises the search space directly | One requirement to meet |
| Breached and common deny-list | Removes the passwords guessed first | Rejects a choice already public |
| Composition classes | Narrows the search space to predictable shapes | `Password1!` |
| Scheduled expiry | Buys nothing against a hash already stolen | Predictable mutation, reuse elsewhere |

The first two are implemented. The platform's answer to a suspected compromise is a targeted
forced reset, which is an operation someone invokes with a reason, rather than a date that treats
every account as compromised on the same morning.

## Decision

### Storage and policy

One `passwords` table in the tenant object: `subject_id` (primary key), `hash`, `updated_at`,
`must_change`. One row at most per subject, and a subject with no row simply has no password.

A password is NFKC-normalized before hashing, so the same characters typed on two keyboards derive
the same key, and accepted at any length from the tenant's minimum up to 256 characters, with
every code point allowed.

Policy is per tenant, held on the tenant's settings row, and consists of a minimum length —
defaulting to 8, raisable to 64 — and a list of tenant-supplied denied terms such as the product
name. Three checks always run, and none of them can be switched off:

- The top 100,000 breached and common passwords, shipped as truncated SHA-256 prefixes in a sorted
  binary asset and searched inside the object. The structure is decoded on first use rather than
  at module scope, so a tenant that never sets a password never pays for it.
- Similarity to the subject's own identifiers: the email local part, the domain label and the
  username.
- The tenant's denied terms.

A deny-list that a tenant can switch off is a deny-list that gets switched off during a migration
and stays off, and the passwords it removes are exactly the ones guessed first. Length is the
knob; the list is the floor.

### RPC methods

- `setPassword({ subjectId, password, actor })` — enforces policy, writes the hash, returns the
  policy failures as a plain discriminated union rather than an error.
- `signInWithPassword({ identifier, password, agent })` — folds the identifier, verifies, rehashes
  when `password.needsRehash` reports the stored value is behind policy, and opens the session in
  the same call. Returns the subject, the authentication methods used, and whether a second factor
  is still owed. A subject with no password, a blocked subject and an unknown identifier all
  derive a hash against a fixed dummy value before answering, so the time taken says nothing about
  who exists.
- `changePassword({ subjectId, currentPassword, newPassword, keepSessionId })` — verifies the
  current password, writes the new one, and revokes every session and refresh token except the one
  named.
- `beginPasswordReset({ identifier })` — mints a single-use ticket valid for 30 minutes, stores
  only its hash, and returns the plaintext ticket once with the address to deliver it to. The
  ticket crosses the boundary because delivering it is the point of the operation; nothing else
  does. The return shape is identical whether or not the identifier resolves.
- `completePasswordReset({ ticket, newPassword })` — spends the ticket, writes the password,
  marks the address verified, and revokes every session and refresh token for the subject.
- `forcePasswordReset({ subjectId, reason })` — sets `must_change`, revokes every session, and
  records the reason for the audit log.
- `removePassword({ subjectId })` — refuses unless the subject keeps a passkey, so the operation
  cannot leave an account with no way in.
- `describePasswordPolicy({})` — the minimum length and denied terms the hosted sign-up page states
  before anyone types, cached in the Worker like the tenant's other read-only documents.

### What a password change does to sessions

A change revokes every session except the one performing it, because the person doing the changing
is present and the sessions they are not holding may be an attacker's. A reset revokes all of
them, including the one that completed it, because a reset is what someone locked out does and the
browser holding a session may not be theirs. The session and refresh-token revocation the two
operations call is the tenant object's own, stated by the sessions and token ADRs; both are one
round trip because the revocation happens inside the same method.

## Consequences

### Positive

- One hashing implementation across the repo, and one place a cost increase is made, which reaches
  every tenant through rehash-on-verify without a migration.
- A stored value that cannot be parsed denies access rather than reaching a caller as a failure to
  interpret, because `@sdxc/crypto` reports it as a malformed hash and the object treats that as a
  mismatch.
- Sign-in answers in the same time for an account that exists and one that does not.
- An account with only a passkey is an ordinary account, so a tenant can ship passwordless sign-up
  without a second subject model.

### Negative

- Verification is deliberate CPU on a single-threaded object, so a burst of sign-in attempts for
  one tenant delays that tenant's other operations until rate limiting refuses them.
- The deny-list is a bundled asset, so it is only as current as the build that shipped it and a
  newly published breach corpus reaches tenants on the next deploy.
- Refusing to remove the last credential means a subject who deletes their only passkey has to set
  a password first, which reads as an extra step in a passwordless product.
- Per-tenant minimum length lets a tenant sit at 8 characters when 12 would serve their users
  better.

### Neutral

- `must_change` is enforced at sign-in by the hosted UI, so a client using the API directly sees
  the flag in the sign-in result and decides what to do with it.
- Reset tickets are rows with an expiry, which makes them one more table with a retention rule.

## Alternatives Considered

**A second hashing algorithm for imported credentials.** Import from another provider is the case
that wants it, and it would let a migrated hash verify in place. It also reintroduces the library
the repo removed, permanently, for a path that a forced reset covers. Rejected: an import ADR can
require a reset on first sign-in.

**A live breach-corpus lookup on every password set.** Always current, and larger than anything
bundled. It puts a third-party request on the sign-up path, tells that third party the prefix of
every password chosen on the platform, and fails in a way that has to either block sign-ups or
silently skip the check. Rejected.

**Composition rules and expiry as tenant options.** Some buyers ask for them by name, usually to
satisfy a checklist. Offering them means the platform ships a control it believes makes accounts
weaker. Rejected; length and the deny-list are the surface.

**Verification in the Worker with the hash fetched over RPC.** Moves the CPU off the object.
It also moves a credential hash across the boundary for every sign-in, which contradicts the rule
that the object is the trust boundary for its own state. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md)
- [ADR-008: Passkeys](./ADR-008-passkeys.md)
- [root ADR-040: PBKDF2 as the Only Credential Hash](../ADR-040-pbkdf2-as-the-only-credential-hash.md)
- [root ADR-023: Web Crypto Primitives Package](../ADR-023-web-crypto-primitives-package.md)
