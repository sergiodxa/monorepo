# ADR-006: Subjects and Identifiers

## Status

**Proposed** - 2026-09-18

## Background

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) puts a tenant's state in its own
Durable Object, and the tenant object schema gives that object somewhere to put a row. What the
schema does not yet describe is the record everything else hangs off: the account a token is
issued about.

A subject is the anchor of the `sub` claim, the owner of every credential and session, the actor
in every audit row, and the key a relying party stores against its own data. Its identity model —
what may be typed into a sign-in field, how two spellings of one address compare, what a tenant
may keep beside the standard claims — is settled once here, because every later ADR reads it and
none of them can change it cheaply afterwards.

This ADR describes the record and its identifiers; proving ownership of one is the subject of the
password and passkey ADRs. Subjects are the product, so they are available on every tier
including Free.

## Context

### The `sub` claim is a promise that outlives the account

A relying party keys its own rows to `sub` and keeps them long after the account is gone.
Reassigning a value, or deriving it from something a person can edit, hands one person another's
history. So `sub` is opaque, random, permanent for the life of the tenant, and retired rather
than reused when a subject is deleted.

That makes identifiers a separate concern from identity. An email address is how someone signs
in; it is not who they are.

### Two identifiers, and they are the only two

| Identifier | What it proves | Where it is used |
| --- | --- | --- |
| Email address | Control of a mailbox, once verified | Sign-in, verification, reset, notification |
| Username | Nothing on its own | Sign-in, display, `preferred_username` |

Phone numbers are not an identifier in this series, nor a delivery channel, nor a factor. A
verified mailbox is what proves ownership of an account, and it does so without a carrier in the
path and without a per-message cost.

### Comparison is one rule or it is a vulnerability

Two spellings that a person reads as the same address have to resolve to the same row, at sign-up
and at sign-in and at reset, or a lookalike registration becomes an account takeover. One folded
form, computed the same way everywhere, is what makes that true:

| Kind | Stored as entered | Compared as |
| --- | --- | --- |
| Email | The full address, for display and delivery | NFKC, domain lowercased and IDNA-encoded, local part case-folded |
| Username | The chosen casing | NFKC, case-folded, restricted to letters, digits, `.`, `-` and `_` |

Folding stops at the general rule. Provider-specific equivalences — dotted Gmail local parts,
plus-addressing — are treated as distinct addresses, because the platform does not know which
mail host applies which rule and a wrong guess merges two real mailboxes into one account.

### Verification belongs to the address, not to the subject

`email_verified` in OIDC describes the address in the `email` claim. A subject changing an address
holds two: the one that still works, and the one being proven. Collapsing them into a single
column means a typo removes the only mailbox that can recover the account.

## Decision

Three tables in the tenant object's SqlStorage.

`subjects` — `id` (`sub_` and 128 bits of randomness, base32), `status` (`active` or `blocked`),
`created_at`, `updated_at`, and the standard OIDC profile columns: `name`, `given_name`,
`family_name`, `nickname`, `preferred_username`, `picture`, `locale`, `zoneinfo`. These are
columns rather than a document because each is a claim with a defined name and type.

`subject_identifiers` — `subject_id`, `kind` (`email` or `username`), `value` as entered, `folded`
for comparison, `verified_at`, `is_primary`, `created_at`. A unique index on (`kind`, `folded`)
is what enforces every uniqueness rule below.

`subject_attributes` — `subject_id`, `key`, `value` as JSON, and a per-tenant
`attribute_definitions` table holding `key`, `type`, and `visibility`:

| Visibility | Read by the subject | Written by the subject | In a token or `/userinfo` |
| --- | --- | --- | --- |
| `internal` | No | No | No |
| `claim` | Yes | No | Yes, namespaced, when the client's granted scopes cover it |
| `self` | Yes | Yes | Yes, namespaced, when the client's granted scopes cover it |

A key with no definition is refused. That is what keeps an attribute a tenant meant as
authorization data — a plan, an entitlement, an internal flag — out of a token that a browser can
read, and it makes the set of custom claims a tenant ships something declared rather than
whatever a write happened to leave behind.

### One email address, one subject

Uniqueness on the folded value is unconditional, and it is not a tenant setting. An address is
the ownership credential for verification, reset and magic-link sign-in; two subjects sharing one
makes each of those flows a disambiguation screen, and leaves account linking nothing to link on.
A tenant that wants one person to hold separate accounts gets separate tenants, which is the unit
of isolation the product already sells.

### Changing an identifier leaves sessions alone

A session authenticates a subject, and the subject id does not move when an address does, so
sessions and refresh tokens survive an identifier change. The new address becomes a login
identifier and reaches the `email` claim when it is verified; until then the old one stands and
the change is announced to it. Already-issued ID tokens keep the value they were minted with and
the next issuance carries the new one.

Blocking or deleting a subject is the operation that ends sessions, and it does so for every
session at once.

### RPC methods

- `createSubject({ identifiers, profile, attributes })` — validates, folds, claims uniqueness and
  returns the subject id with the verification state of each identifier.
- `updateSubject({ subjectId, profile, attributes, actor })` — one write over the profile columns
  and the declared attributes the actor may set.
- `beginIdentifierChange({ subjectId, kind, value })` — records the pending identifier and returns
  the single-use verification ticket to deliver, plus the address to deliver it to.
- `confirmIdentifier({ ticket })` — spends the ticket, promotes the pending identifier, stamps
  `verified_at`, returns the subject id.
- `blockSubject({ subjectId, reason })` / `unblockSubject({ subjectId })` — block revokes every
  session in the same call.
- `deleteSubject({ subjectId })` — removes the subject, its identifiers, credentials and sessions,
  and retires the id.
- `defineAttribute({ key, type, visibility })` / `removeAttribute({ key })`.
- `describeSubject({ subjectId, audience })` — everything one account screen renders: profile,
  identifiers with verification state, attributes visible to that audience, and which credentials
  exist. One operation serving one view rather than parts a caller assembles.

## Consequences

### Positive

- A relying party's foreign key never changes meaning, because `sub` is random and retired rather
  than reused.
- Lookalike registration is closed by a unique index rather than by a check each new sign-up path
  has to remember to run.
- A tenant's custom data is declared before it is stored, so what reaches a token is a decision
  rather than an accident.
- A mistyped new address costs nothing: the old mailbox still works until the new one is proven.

### Negative

- One address per subject forbids a tenant modelling one person as several accounts, and that is
  a real pattern in staff tooling.
- Treating provider-specific equivalences as distinct addresses lets one mailbox hold several
  accounts at a tenant that would rather it did not.
- Attribute values are JSON, so a tenant cannot filter subjects on one without scanning.
- Unicode folding depends on the runtime's normalization tables, so the stored `folded` column
  stays authoritative for rows already written.

### Neutral

- Profile columns cover the standard claims and nothing else; anything richer is a declared
  attribute.
- Usernames are optional per tenant, so a tenant enabling them later has subjects without one.

## Alternatives Considered

**Email address as `sub`.** Removes a lookup and makes tokens readable in a log. It also makes
every claim about a person's history depend on an address they can change and an address someone
else can later be given. Rejected.

**A tenant switch allowing several subjects per address.** Buys the staff-tooling pattern above.
It costs a disambiguation step in reset, magic-link and account linking, and those are the flows
where ambiguity turns into a takeover. Rejected: tenants are the separation mechanism.

**Phone number as a third identifier.** Familiar to end users and common in the market. It puts a
carrier between the platform and the proof of ownership, adds per-message cost, and proves less
than a mailbox. Rejected here and everywhere in this series.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md)
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md)
- [ADR-008: Passkeys](./ADR-008-passkeys.md)
