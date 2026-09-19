# ADR-030: Organizations

## Status

**Proposed** - 2026-09-18

## Background

A tenant selling software to businesses has customers that are companies. Its subjects join those
companies, see different data depending on which one they are acting for, and an administrator at one
company invites colleagues without asking the tenant to do it. Without a model for that, every such
tenant builds one in its own database and keeps a second copy of membership that has to agree with
what the identity provider believes — and the two disagree the first time someone is removed from one
and not the other, which is an access control bug.

This ADR puts the model where membership already lives: a tenant's own customers, their members, their
invitations and their domains, inside that tenant's object. It is the **Organizations** add-on at $29
per tenant per month, feature slug `organizations`, sold on top of any tier including Free.

## Context

### Two levels of multi-tenancy, and one word for each

The platform has customers; a tenant has customers. Conflating them is the single way this design goes
wrong, so the vocabulary is fixed here and the series holds to it:

| | Tenant | Organization |
| --- | --- | --- |
| Whose customer it is | The platform's | One tenant's |
| Where it lives | A Durable Object of its own | Rows inside one tenant's object |
| Identity boundary | Its own issuer, signing keys and subjects | Shares the tenant's issuer, keys and subjects |
| Billed by the platform | Yes, one subscription each | No; the tenant bills it, if at all |
| Id | `ten_…` in the control plane | `org_…` in the tenant object |
| Reaches a token as | The `iss` claim | The `org` claim |

"Tenant" never names an organization and "organization" never names a tenant — including in the
dashboard, where a platform customer administering their tenant is never told it is an organization.

### A person is one subject, whatever they join

One verified address is one subject per tenant, unconditionally, and organizations change nothing
about that: a person working with two of a tenant's customers is one subject holding two memberships.
That is what lets an invitation add a membership to an account that already exists.

### A token names one context, so one membership is active

Authorization at a relying party is decided per request against one company's data. A claim carrying
every membership pushes that selection onto the relying party, grows with the person's membership
count against the four-kilobyte payload cap, and leaves a removed membership live in tokens already
issued. So a session carries one active organization and switching is a re-issue, not a new sign-in.

## Decision

### The tables

In the tenant object, as `remix/data-table` models over `@sdxc/data-table-sqlstorage`, with inputs
parsed by `remix/data-schema` inside the object.

| Table | Columns | The constraint that carries the design |
| --- | --- | --- |
| `organizations` | `id` (`org_…` TypeID), `slug`, `name`, `logo_url`, `status`, `metadata` as JSON over declared keys, timestamps | `slug` is unique within the tenant |
| `organization_members` | `organization_id`, `subject_id`, `role`, `joined_via` (`creator`, `invitation`, `domain`, `connection`, `admin`), timestamps | Primary key `(organization_id, subject_id)`, with an index on `(subject_id, created_at)` for the switcher |
| `organization_invitations` | `id`, `organization_id`, `folded_email`, `role`, `invited_by`, `token_hash`, `expires_at`, `accepted_at`, `revoked_at`, `created_at` | A partial unique index on `(organization_id, folded_email)` over rows neither accepted nor revoked, so one address has one open invitation |
| `organization_domains` | `domain` lowercased and IDNA-encoded, `organization_id`, `mode`, `verification_value`, `verified_at`, `created_at` | `domain` is the primary key, so two organizations in one tenant cannot both claim `acme.com` |

`sessions` gains a nullable `active_organization_id`. `organization_members.role` holds one role key,
because a membership and its role are created, changed and removed together and splitting them buys a
join and a way for the two rows to disagree; the role vocabulary belongs to *Roles and Permissions*.

Organizations, memberships and domains are customer-action rows bounded by the plan's subject cap;
invitations grow with traffic, so the object's alarm deletes rows a week past `expires_at`.

### Invitations

An administrator invites by email address, the only channel: the mailbox is the ownership credential
this platform recognises, and a phone number is not an identifier, a factor or a delivery channel
anywhere in this series. The ticket is `randomToken({ bytes: 32 })` from `@sdxc/crypto` stored as a
lookup digest, single-use, and expiring after a tenant-configured window defaulting to seven days
within bounds of an hour and thirty days, because it is a bearer capability to join a company.

Acceptance is bound to the invited address. Signed in as a subject holding that address verified, the
membership is written; signed in as anyone else the acceptance is refused and the invitation stays
open, so a forwarded message still adds the person it named. With no account yet, acceptance runs
sign-up first and the address arrives verified, because the ticket proved the mailbox.

### Email domains and automatic membership

A domain grants membership once it is verified by a DNS TXT record the tenant publishes. That
requirement is also what makes a public mailbox domain unclaimable — nobody here can publish a record
on `gmail.com` — so no organization absorbs everyone who uses one, with no blocklist to maintain. The
lookup is network I/O and belongs in the Worker, which calls `confirmOrganizationDomain` once it has
observed the record.

`auto_join` writes the membership the first time a subject with a verified address at that domain
signs in; `suggest` offers the organization and lets the person choose. Both read a verified address,
so an unproven one joins nothing.

### The active organization and the `org` claim

`setActiveOrganization` authorizes the membership and writes the session row; the next ID token and
access token carry `org` with the organization id when the client's granted scopes include
`organization`. `org` joins the claims the minting design issues, so a tenant's own declared claim
cannot take that name, and a session with no active organization mints none.

Removing a membership clears `active_organization_id` on that subject's sessions naming it and revokes
the grants issued under it, so the next exchange reflects the removal. An access token already issued
lives out its hour, so a relying party needing removal to be instant checks membership rather than
trusting the claim for the token's whole life.

### Organization-scoped connections

An enterprise connection carries an optional owning organization, and the connections design resolves
at most one connection for a verified email domain. The sign-in page takes an address, matches its
domain against verified organization domains, and routes to that connection, so Acme's directory signs
in Acme's people and nobody else's. An assertion arriving through an organization-scoped connection
writes the membership with `joined_via = 'connection'`, because the directory that asserted it is that
organization's own. The connection needs the enterprise SSO entitlement; scoping it needs this one.

### RPC methods

- `createOrganization({ name, slug, creatorSubjectId, actor, at })` — the row and the creator's owner
  membership in one call — with `updateOrganization` and `deleteOrganization`, which removes
  memberships, invitations, domains and connection scoping and clears the active organization from
  every session naming it.
- `inviteToOrganization({ organizationId, email, role, invitedBy, at })` — authorizes the inviter,
  folds the address, claims the open-invitation uniqueness, and returns the ticket with the address
  and locale to deliver it to — with `revokeOrganizationInvitation`.
- `acceptOrganizationInvitation({ token, subjectId, at })` — spends the ticket against the subject's
  verified identifier and writes the membership.
- `setMembershipRole` and `removeMembership({ organizationId, subjectId, actor, at })`, which performs
  the session and grant cleanup above.
- `addOrganizationDomain({ organizationId, domain, mode, actor, at })`, returning the TXT name and
  value to publish, and `confirmOrganizationDomain({ organizationId, domain, at })`.
- `applyDomainMembership({ subjectId, at })` — run at sign-in: writes the memberships every verified
  address earns and answers those plus the organizations to suggest.
- `setActiveOrganization({ sessionId, subjectId, organizationId, at })`, answering the organization
  the next token will name, with `describeSubjectOrganizations({ subjectId })` for the switcher and
  `readOrganizationMemberPage`, whose projection keeps both ordering columns so its cursor exists.

Each writes its own audit row in the tenant administration category. Administrative writes run behind
`requireEntitlement("organizations")`, while resolving a membership at sign-in and minting the `org`
claim consult no flag, because nothing on the protocol surface does: a tenant whose add-on lapses
keeps the organizations it has, serving its end users, and adds no more until it resumes.

## Consequences

### Positive

- A person holds one account across every organization they belong to, so an invitation adds a
  membership rather than a second identity to reconcile.
- The two levels have separate words, separate id prefixes and separate stores, so mistaking one for
  the other is a type error or a review comment rather than a silent cross-level read.
- Automatic membership rests on a DNS proof, so a public mailbox domain is unclaimable with no
  blocklist to maintain, and an invitation expires and is single-use.

### Negative

- The `org` claim is a snapshot, so a relying party trusting it without re-checking gives a removed
  member up to the access token's remaining hour.
- `auto_join` turns a verified address into a membership, so an organization that verifies a domain
  shared with contractors admits the contractors.
- Every organization a tenant has lives in the same object, so the largest and the smallest share one
  storage ceiling and one request queue.
- The vocabulary is a discipline rather than a mechanism: a dashboard string calling a platform
  customer's tenant "your organization" reintroduces the confusion this ADR exists to stop.

### Neutral

- Organizations are one flat level, so a tenant wanting departments inside a customer models them in
  its own product, and a membership carries one role whose vocabulary is decided elsewhere.

## Alternatives Considered

**An organization as its own tenant object.** Perfect isolation between a tenant's customers, with the
existing provisioning machinery for free. It also gives each its own issuer and key set, so a person
working with two signs in twice and the tenant's relying party federates against hundreds of issuers.
Rejected: the isolation being sold is between the platform's customers.

**Every membership in the token as an array.** The relying party sees the whole picture in one token
and needs no switcher. It grows with the person's membership count against the payload cap, and it
moves the choice of acting context to the relying party, where it stops being the identity provider's
decision. Rejected for an active organization.

**Organizations in the base tiers.** It is the shape a business-facing tenant needs, and giving it
away would widen adoption. It is also the clearest case of the line the plan catalog draws: bought by
a business for how the business runs, carrying operating surface — invitations, domain verification,
per-organization connections — that scales with the tenant's customer count rather than with sign-ins,
and load-bearing for nobody's security. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the object these rows live in
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — the tenant, which is the other level
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — one subject per verified address, and the folding rule
- [ADR-009: Sessions](./ADR-009-sessions.md) — the row the active organization is written on
- [ADR-010: Signing Keys and Token Minting](./ADR-010-signing-keys-and-token-minting.md) — the claim set `org` joins and the payload cap
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the `organizations` slug and its price
- [ADR-031: Roles and Permissions](./ADR-031-roles-and-permissions.md) — the role keys a membership carries
- [ADR-028: Enterprise SSO Connections](./ADR-028-enterprise-sso-connections.md) — the connection an organization scopes
