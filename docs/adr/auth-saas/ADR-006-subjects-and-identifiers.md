# ADR-006: Subjects and Identifiers

## Status

**Proposed** - 2026-09-18

## Background

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) puts a tenant's state in its own
Durable Object, and the tenant object schema gives that object somewhere to put a row. What it does
not yet describe is the record everything else hangs off: the account a token is issued about.

A subject is the anchor of the `sub` claim, the owner of every credential and session, the actor in
every audit row, and the key a relying party stores against its own data. Its identity model — what
may be typed into a sign-in field, how two spellings of one address compare, what a tenant may keep
beside the standard claims — is settled once here, because every later ADR reads it and none can
change it cheaply afterwards. Proving ownership of an identifier is the subject of the password and
passkey ADRs. Subjects are the product, so they are available on every tier including Free.

## Context

### The `sub` claim is a promise that outlives the account

A relying party keys its own rows to `sub` and keeps them long after the account is gone. Reassigning
a value, or deriving it from something a person can edit, hands one person another's history. So
`sub` is opaque, random, permanent for the life of the tenant, and retired rather than reused when a
subject is deleted. Identifiers are a separate concern: an address is how someone signs in, not who
they are.

### Two identifiers, and they are the only two

| Identifier | What it proves | Where it is used |
| --- | --- | --- |
| Email address | Control of a mailbox, once verified | Sign-in, verification, reset, notification |
| Username | Nothing on its own | Sign-in, display, `preferred_username` |

Phone numbers are not an identifier in this series, nor a delivery channel, nor a factor. A verified
mailbox proves ownership of an account without a carrier in the path and without a per-message cost.

### Comparison is one rule or it is a vulnerability

Two spellings a person reads as the same address have to resolve to the same row, at sign-up and at
sign-in and at reset, or a lookalike registration becomes a takeover. One folded form, computed the
same way everywhere, is what makes that true:

| Kind | Stored as entered | Compared as |
| --- | --- | --- |
| Email | The full address, for display and delivery | NFKC, domain lowercased and IDNA-encoded, local part case-folded |
| Username | The chosen casing | NFKC, case-folded, restricted to letters, digits, `.`, `-` and `_` |

Folding stops at the general rule. Provider-specific equivalences — dotted Gmail local parts,
plus-addressing — are distinct addresses, because the platform does not know which mail host applies
which rule and a wrong guess merges two real mailboxes into one account.

### A person holds several mailboxes, and each is proven on its own

People arrive with a work address beside a personal one and change employers holding both.
`email_verified` in OIDC describes the address in the `email` claim rather than the person, which is
the shape the data already has: verification is a fact about a row. So a subject holds as many
addresses as it has claimed, each with its own `verified_at`; proving one says nothing about another.

## Decision

Three tables in the tenant object's SqlStorage.

`subjects` — `id` (`sub_` and 128 bits of randomness, base32), `status` (`active` or `blocked`),
`created_at`, `updated_at`, and the standard OIDC profile columns: `name`, `given_name`,
`family_name`, `nickname`, `preferred_username`, `picture`, `locale`, `zoneinfo` — columns rather
than a document because each is a claim with a defined name and type.

`subject_identifiers` — `subject_id`, `kind` (`email` or `username`), `value` as entered, `folded`
for comparison, `verified_at`, `is_primary`, `created_at`. A subject holds a row per address it has
claimed and at most one `username`. A unique index on (`kind`, `folded`) enforces every uniqueness
rule below, and `verified_at` sits on the row, so verification is stated about one address.

`subject_attributes` — `subject_id`, `key`, `value` as JSON, and a per-tenant
`attribute_definitions` table holding `key`, `type`, and `visibility`:

| Visibility | Read by the subject | Written by the subject | In a token or `/userinfo` |
| --- | --- | --- | --- |
| `internal` | No | No | No |
| `claim` | Yes | No | Yes, namespaced, when the client's granted scopes cover it |
| `self` | Yes | Yes | Yes, namespaced, when the client's granted scopes cover it |

A key with no definition is refused, which keeps an attribute a tenant meant as authorization data —
a plan, an entitlement, an internal flag — out of a token a browser can read.

### One email address, one subject

Uniqueness on the folded value is unconditional, and it is not a tenant setting. An address is the
ownership credential for verification, reset and magic-link sign-in; two subjects sharing one makes
each of those a disambiguation screen and leaves account linking nothing to link on. A tenant that
wants one person to hold separate accounts gets separate tenants.

### Any verified address signs in, and one of them is primary

Sign-in folds what was typed and looks for a row carrying `verified_at`, so a subject reaches one
account from whichever proven mailbox it types. Exactly one email row carries `is_primary`, and only
a verified address may hold it. Primary is what the rest of the system reads: the `email` claim and
`email_verified` in an ID token and at `/userinfo` are that row and its state, and an account notice
— a credential added, a factor enrolled, an administrator action — goes there. A flow about one
address uses that address, so a reset or a magic link reaches the mailbox that was typed, and a
change to the identifier set is announced to every verified address the subject holds.

Sessions are untouched by all of it. A session authenticates a subject and the subject id does not
move when the address set does, so sessions and refresh tokens survive an add, a verification, a
promotion or a removal. A newly verified address is a login identifier immediately, the `email` claim
moves only when primary moves, and blocking or deleting the subject is what ends every session.

### Adding, verifying and removing an address

An address is added unverified and proven by its own single-use ticket. Until it carries `verified_at`
it signs nobody in, cannot be primary, and counts toward no credential set; what it does hold is the
uniqueness claim, so two sign-ups cannot both be told an address is theirs. A row with no live ticket
is swept after seven days, releasing the address.

Removing an address deletes the row and releases its folded value, bounded by two refusals. A subject
cannot remove its last verified address, because a verified mailbox is what recovery, reset and
magic-link sign-in run through. Where the tenant offers magic-link sign-in a verified address is also
a credential, so removal runs the remaining-credential predicate the credential ADRs share — one count
across passwords, passkeys, linked identities and verified addresses, called by `removePassword`,
`revokePasskey` and `unlinkIdentity` too. Removing the primary promotes the oldest remaining verified
address in the same operation, so the `email` claim is never unverified. Account linking matches a
provider's asserted address against these rows and requires the matched row to carry `verified_at`;
adopting that address is an ordinary add, unverified until the platform proves the mailbox itself.

### RPC methods

- `createSubject({ identifiers, profile, attributes })` — validates, folds, claims uniqueness and returns
  the subject id with the verification state of each identifier.
- `updateSubject({ subjectId, profile, attributes, actor })` — one write over the profile columns and the
  declared attributes the actor may set.
- `addIdentifier({ subjectId, kind, value, actor })` — folds, claims uniqueness against the index, writes
  the row unverified, and for an address mints the verification ticket and returns it with the address
  to deliver it to. Called again it replaces the outstanding ticket, which is a resend.
- `verifyIdentifier({ ticket })` — spends the ticket, stamps `verified_at`, makes the address primary
  when the subject holds none yet, and returns the subject id.
- `setPrimaryIdentifier({ subjectId, value, actor })` — moves `is_primary` to the named address,
  refusing an unverified one.
- `removeIdentifier({ subjectId, value, actor })` — applies both refusals above, promotes the oldest
  remaining verified address when the removed row held primary, reports where to announce it.
- `blockSubject({ subjectId, reason })` / `unblockSubject({ subjectId })` — block revokes every
  session in the same call; `deleteSubject({ subjectId })` removes the subject, its identifiers,
  credentials and sessions, and retires the id.
- `defineAttribute({ key, type, visibility })` / `removeAttribute({ key })`.
- `describeSubject({ subjectId, audience })` — everything one account screen renders: profile, every
  identifier with its state and which is primary, the attributes that audience may see, and which
  credentials exist. One operation serving one view.

## Consequences

### Positive

- A relying party's foreign key never changes meaning, because `sub` is random and retired rather
  than reused, and lookalike registration is closed by a unique index rather than by a check each
  sign-up path has to remember to run.
- A tenant's custom data is declared before it is stored, so what reaches a token is a decision rather
  than an accident.
- A mistyped address costs nothing, every proven address still signs in and still recovers the account,
  and changing employer is two ordinary operations with no window where neither works.

### Negative

- An address still belongs to exactly one subject, so a tenant cannot model one person as several
  accounts sharing a mailbox, and that is a real pattern in staff tooling.
- Several verified addresses are several mailboxes that can recover the account, so a subject's security
  is that of the weakest one it keeps.
- An unverified row holds its address against everyone else until it is proven or swept, so a hostile
  sign-up can park a rival's address for a week.
- Treating provider-specific equivalences as distinct addresses lets one mailbox hold several accounts
  at a tenant that would rather it did not, and attribute values are JSON, so a tenant cannot filter
  subjects on one without scanning.

### Neutral

- Profile columns cover the standard claims and nothing else; anything richer is a declared attribute,
  usernames stay optional per tenant, and a subject holds one of them beside many addresses.

## Alternatives Considered

**Email address as `sub`.** Removes a lookup and makes tokens readable in a log. It also makes every
claim about a person's history depend on an address they can change and someone else can later be
given. Rejected.

**One address per subject with a change operation.** One row, one `email` claim, nothing to choose
between. It turns every real multi-address situation into a destructive edit with a window where the
address that works is the one being replaced. Rejected: holding both is the same flow, no window.

**Phone number as a third identifier.** Familiar to end users and common in the market. It puts a
carrier between the platform and the proof of ownership, adds per-message cost, and proves less than
a mailbox. Rejected here and everywhere in this series.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md)
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md)
- [ADR-008: Passkeys](./ADR-008-passkeys.md)
- [ADR-036: Account Linking](./ADR-036-account-linking.md) — the remaining-credential predicate and the provider-address match
- [ADR-040: Magic Link Sign-In](./ADR-040-magic-link-sign-in.md)
