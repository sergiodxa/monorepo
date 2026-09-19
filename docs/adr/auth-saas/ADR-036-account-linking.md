# ADR-036: Account Linking

## Status

**Proposed** - 2026-09-18

## Background

[ADR-027](./ADR-027-social-identity-providers.md) and
[ADR-028](./ADR-028-enterprise-sso-connections.md) each end at the same point: a provider has
returned a subject identifier and a set of claims, and the platform has to decide which of the
tenant's subjects that describes. This ADR is that decision, and the record it writes.

Most of the time the person already exists: they signed up with a password last year, the tenant
turned on Google this quarter, and they press the new button expecting their account. Handing it
to them is the whole value of linking, and handing it to somebody else is the most damaging failure
this platform has, because a provider that will assert any address is a key to every account whose
address someone can guess.

[ADR-006](./ADR-006-subjects-and-identifiers.md) makes an email address belong to exactly one
subject, which is what makes the address a usable join and also what makes it worth attacking.
Linking is a base feature, available on Free and on every tier above it.

## Context

### An email claim is an assertion, not a proof

`email_verified` is a field in somebody else's document. Some providers set it because they own the
mailbox or proved control of it at sign-up; others set it because a person typed an address into a
profile form. A platform reading the field without asking which kind of provider sent it treats
those two as one, and the second kind is an account takeover with a sign-up form in front of it.

### A subject has to keep a way back in

Unlinking is an ordinary thing to do from an account screen, and it removes a credential, as do
removing a password and revoking a passkey. Three operations reducing one set have to agree about
when that set is empty, or an account that survives each of them alone is locked out by the three
together.

## Decision

### The identity record

```sql
subject_identities(id, subject_id, connection_id, provider_subject, provider_email,
                   provider_email_verified, linked_by, linked_at, last_sign_in_at,
                   granted_scopes, access_token_sealed, refresh_token_sealed,
                   access_expires_at, claims_json)
```

`provider_subject` is the value the connection's `subject_claim` names, and the SAML `NameID` for an
enterprise connection. A unique index on (`connection_id`, `provider_subject`) makes one external
account the property of one subject, and a second on (`subject_id`, `connection_id`) gives a subject
one identity per connection, so "which account at that provider is this subject's" has a single
answer for token refresh, the account screen and unlinking. `linked_by` is `automatic`, `subject`,
`admin` or `jit`, recorded because the question asked after an incident is how a link came to exist
rather than that it does, and `claims_json` is the last response, bounded, for a tenant to inspect
when a mapping looks wrong.

### What makes a provider's address trustworthy

Two sources, read from the response in hand rather than from anything cached:

- A catalog entry the platform marks as a per-response authority, because that provider proves
  mailbox control as part of account creation and states the result per sign-in. The property
  belongs to the catalog entry and the platform maintains it from what the provider documents.
- A connection holding a verified domain claim ([ADR-028](./ADR-028-enterprise-sso-connections.md)),
  for addresses inside those domains and no others. An IdP is the authority for what it proved
  control of, so an address outside its verified domains is an ordinary assertion however the IdP
  labelled it.

A generic OAuth2 or OIDC connection therefore earns authority one verified domain at a time, and a
tenant on any tier still gets linking on such a connection — the confirmed path below rather than
the automatic one.

### The automatic linking rule

An identity attaches to an existing subject with nothing further proved when **all six** hold:

1. The response carries an email address and asserts it verified **in that same response**.
2. The connection is an authoritative source for that address, by either clause above.
3. The folded address, by ADR-006's rule, matches exactly one `email` identifier in the tenant.
4. That identifier carries `verified_at` — the platform proved the mailbox too.
5. The subject is `active`.
6. The connection's `auto_link` is on.

Condition 4 carries most of the weight. A subject whose address was never verified here is exactly
the account somebody else may have registered under a stranger's address, so requiring both proofs
means a link happens where the platform and the provider independently established one mailbox.

Every other case takes the confirmed path: the operation answers `link_required` with a ticket, the
sign-in page asks for a credential the tenant already holds, and the link completes from that ticket
once one is presented. The screen is identical whether or not an account exists under the address,
so the path discloses nothing about who is registered.

### When the address belongs to another subject

A provider returning an address that is already somebody's is the ordinary case, and the rule above
resolves it: satisfied, the person signs in as that subject and the identity is written;
unsatisfied, the confirmed path runs and the subject stands untouched until somebody proves they
hold it. Just-in-time creation meets ADR-006's unique index in the same situation and answers
`link_required` rather than failing, so the two paths converge.

A user-initiated link is refused outright when the provider's address belongs to a different
subject: both accounts stay as they were, and the message names the conflict without naming the
other account. Merging two subjects moves sessions, grants, consent and audit history under a `sub`
that relying parties have already stored, so it is its own operation with its own confirmation and
is not something a sign-in performs.

### Linking from the account screen

The subject is authenticated already, so the route asks for a recent authentication first —
re-authenticating when the session's `auth_time` is older than the tenant's step-up window — then
runs ADR-027's connection flow with the transaction marked as a link and carrying the subject id,
and completion writes the row with `linked_by = subject`.

The provider's address stays on the identity row, and adopting it as a login identifier is its own
confirmed action, so linking an account leaves the addresses a subject can be found by exactly as
they were and trips ADR-006's uniqueness on nobody's behalf.

### Unlinking

`unlinkIdentity` is refused when it would leave the subject with no credential from the set the
tenant offers. The object counts what remains across passwords, passkeys, other identities on
enabled connections, and a verified email identifier where magic-link sign-in is offered. One
predicate, in one place, called by ADR-007's `removePassword` and ADR-008's `revokePasskey` too, so
the three agree on when the set is empty.

An unlink deletes the sealed provider tokens and spends the provider's revocation endpoint where
one is advertised, so ending the link at the tenant ends its access at the provider. A subject
unlinking their own identity keeps their sessions; an administrator's unlink revokes the sessions
whose `amr` names that connection, since the reason to remove an identity administratively is that
it should stop being a way in. Both write `identity.linked` and `identity.unlinked` audit rows in
the credentials category, carrying the actor and the link origin.

### RPC methods

- `linkIdentity({ subjectId, ticket, actor })` — spends the pending-link ticket once the subject
  has authenticated, writes the row, refusing an account already linked elsewhere.
- `unlinkIdentity({ subjectId, connectionSlug, actor })` — applies the remaining-credential rule,
  spends the provider's revocation endpoint, and revokes sessions for an administrator's unlink.
- `adoptIdentityAddress({ subjectId, connectionSlug })` — adds the provider's address as an
  identifier, subject to ADR-006's uniqueness, on the subject's confirmation.

`describeSubject` from ADR-006 gains the linked identities — connection, provider address, link
origin and last use — so one account screen is still one call. There is no method that resolves an
identity on its own: the rule runs inside `completeConnectionSignIn` and `signInWithSamlResponse`,
which is what makes a path that resolves an identity without applying the rule inexpressible.

## Consequences

### Positive

- An automatic link rests on two independent proofs of the same mailbox, so a provider that
  mislabels an address links nothing.
- One predicate answers "does this subject still have a way in" for three operations that each
  remove a credential.
- The unique indexes make one external account one subject and one subject one account per
  connection, with no check a new sign-in path has to remember.
- A person the rule declines is asked for a credential rather than turned away.

### Negative

- A tenant whose subjects arrived from an import without verified addresses meets the confirmed path
  on every first social sign-in until those addresses are verified.
- One identity per connection per subject rules out holding a personal and a work account at the
  same provider on one subject.
- Two subjects a person created separately stay two, and consolidating them is a support action
  rather than something the sign-in offers.
- A catalog entry's authority is a judgement the platform maintains, so a provider changing how it
  verifies addresses is an edit nobody is prompted to make.

### Neutral

- Provider tokens live on the identity row, which makes the unlink the natural place to revoke them,
  and a linked identity adds no login identifier by itself.

## Alternatives Considered

**Linking on a matching address alone.** The fewest prompts and the best conversion, and it is what
a person expects. It also means any provider that lets someone set an address without proving it
hands out that tenant's accounts. Rejected.

**Never linking automatically.** One rule, no judgement about providers, every returning person
proves a credential. It turns the ordinary case — one person, one mailbox, two ways in — into a
support conversation. Rejected: two independent proofs is a real bar, worth honouring when met.

**Merging subjects when a link collides.** It solves the duplicate account the person actually has,
in the moment they notice it. It also moves sessions, grants and audit history under a `sub` that
relying parties already store, on a path whose caller is an unauthenticated sign-in. Rejected;
merging is its own operation with its own confirmation.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — why the rule lives inside the sign-in operation
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — one address, one subject, and the folding the match uses
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md) — the sibling operation sharing the remaining-credential rule
- [ADR-008: Passkeys](./ADR-008-passkeys.md) — the other sibling sharing it
- [ADR-027: Social Identity Providers](./ADR-027-social-identity-providers.md) — the connection, the flow and the catalog's authority property
- [ADR-028: Enterprise SSO Connections](./ADR-028-enterprise-sso-connections.md) — the verified domain claim that confers authority
