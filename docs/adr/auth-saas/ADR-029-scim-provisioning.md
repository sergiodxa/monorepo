# ADR-029: SCIM Provisioning

## Status

**Proposed** - 2026-09-18

## Background

An enterprise connection lets a customer's workforce sign in with the directory their employer already
runs. It says nothing about the day someone leaves, which is the half that matters: an employee
removed from that directory keeps their subject row, their sessions and their refresh tokens until
something here is told, and an administrator who has to be told is one who forgets. SCIM 2.0 is what
every workforce provider speaks for this, so the directory that made the decision is what delivers it.

Inbound, an identity provider creates, updates, deactivates and deletes subjects in one tenant over an
authenticated connection. This is the **SCIM provisioning** add-on at $29 per tenant per month,
feature slug `scim`, sold on top of any tier including Free.

## Context

### The deployed clients use a small part of the specification

RFC 7644 describes bulk envelopes, an entity-tag concurrency model, a filter expression grammar,
sorting, attribute projection and a self-service `/Me` alias. The providers that connect here send a
narrow, well-known slice: create, replace, patch and delete one user, list users filtered by
`userName`, and the same four for groups with membership changes as patches. Serving that slice
completely and describing the rest truthfully in `/ServiceProviderConfig` is what a conformant client
needs, since a surface claiming more than it serves fails when a client believes it.

### A full sync is a burst against one single-threaded object

An import of ten thousand employees is ten thousand requests landing on the one object that also
serves that tenant's sign-ins. Four pressures, each with a bound:

| Pressure | Source | Bound |
| --- | --- | --- |
| Turn time | One operation per request | Each method is one whole operation and one write, with no await between the read and the write |
| Request rate | The provider's sync worker | 20 writes per second sustained per connection, bursting to 100; above it, `429` with `Retry-After` |
| Repeat writes | The periodic re-sync of an unchanged directory | A digest of the mapped attributes, so a replace that changes nothing writes nothing |
| Storage | One subject row and one link row per employee | The plan's subject cap |

At twenty writes a second of sub-millisecond work the sync takes a small share of the object's time
and an authentication queued behind it waits one turn. Back-pressure is the protocol's own mechanism
and every deployed client implements it, so the ceiling is enforced where the client already knows how
to respond. Those writes cost cents against $29: the ceiling keeps sign-in latency bounded and makes a
runaway sync visible, rather than protecting a margin.

## Decision

### Surface, connection and token

`/scim/v2/Users`, `/scim/v2/Users/{id}`, `/scim/v2/Groups` and `/scim/v2/Groups/{id}` on the tenant's
own hostname, content type `application/scim+json`, plus static `/ServiceProviderConfig`,
`/ResourceTypes` and `/Schemas` documents served from the Worker with no call to the object. The
resource paths run behind `requireEntitlement("scim")`, whose `onDenied` renders a SCIM error document
rather than an HTML page, because the caller parses JSON.

The caller is a sync worker with no browser, no session and no person behind it, so a connection
authorizes it: a row holding a name, the `sha256` of its bearer token, the digest and expiry of the
one previous token, the delete policy, whether groups sync, and the time of its last request. The
token is `randomToken({ bytes: 32 })` from `@sdxc/crypto` behind an `scim_` prefix, returned once and
stored as a lookup digest — the row is found by the value, so a plain digest over 256 bits of the
object's own randomness is what the lookup needs. Every method takes the presented token and resolves
the connection inside the object in the same turn as the operation, so authorization lives where the
data does and a request costs one round trip. `rotateScimToken` mints a successor and keeps the
incumbent valid for up to 72 hours, the window an administrator has to paste the new value in, and the
connection records which token each request used so a dashboard shows the change landed. Admission
control runs in the Worker keyed on the `sha256` of the presented token, so a throttled request never
wakes the object.

### Users, groups and attribute mapping

| SCIM attribute | Subject model |
| --- | --- |
| `id` | The subject id, the same value as the `sub` claim |
| `externalId` | The link row for this connection |
| `userName` | The primary email identifier when it parses as an address, the username identifier otherwise |
| `emails[primary].value` | The primary email identifier, stamped verified |
| `name.givenName`, `name.familyName`, `name.formatted` | `given_name`, `family_name`, `name` |
| `displayName`, `preferredLanguage`, `timezone` | `nickname`, `locale`, `zoneinfo` |
| `photos[type eq "photo"].value` | `picture` |
| `active` | `status`: `active` or `blocked` |
| The enterprise extension's members | Declared subject attributes at `internal` visibility unless the tenant raises it |

An address arriving over an authenticated connection is stamped verified, because the connection is
the enterprise's own directory asserting its own mailboxes. A create whose folded address matches a
subject carrying no link for this connection adopts that subject and writes the link, answering `201`
with its id, so a rollout meets the people who signed themselves up first; a match against a subject
already linked to a different `externalId` answers `409` with `scimType: "uniqueness"`.

`phoneNumbers` is accepted and stored nowhere: a phone number is not an identifier, a factor or a
delivery channel in this series, the verified mailbox being the ownership credential that a carrier
only adds cost and attack surface to. Discarding rather than refusing it keeps a sync working at a
provider that sends the whole core schema.

A group is a directory object — an id, a `displayName`, an `externalId` and a member list — granting
nothing on its own. A tenant maps a group to a role, or to an organization when that add-on is present,
and the mapping is what gives membership a meaning, so groups synced for reporting stay reporting.

### Deactivation, filtering and paging

Most providers express removal as `active: false` rather than `DELETE`, so `active: false` performs
the block operation: the subject's status changes and every session and refresh token goes in the same
call, which is the whole point of buying this. `active: true` restores the subject and leaves sessions
ended. `DELETE` follows the connection's policy, which defaults to blocking, because a deleted subject
retires its id and a relying party's rows lose their anchor.

`filter` supports `eq` on `userName`, `externalId` and `emails.value` for users, and `displayName` and
`externalId` for groups. `startIndex` is one-based, `count` defaults to 100 with a ceiling of 200,
listing is ordered by creation from an index, and `totalResults` is exact because a directory is
bounded by its plan's subject cap.

| Request | Answer | Why that is the answer |
| --- | --- | --- |
| `PATCH` outside `replace`/`add` on a named attribute, `add` on `members` with a value array, and `remove` on `members[value eq "…"]` | `400`, `scimType: "invalidPath"` | Those four forms are what the deployed clients send, and each maps to one whole operation |
| A `filter` beyond the `eq` attributes above | `400`, `scimType: "invalidFilter"` | The grammar's remainder has no caller, and a half-implemented parser answers wrong rather than refusing |
| `POST /Bulk` | `501`, with `bulk.supported: false` advertised | An envelope moves a burst rather than reducing it; each operation inside is still one write in one turn |
| `If-Match`, `meta.version` | `etag.supported: false`, and the header is ignored | Requests to one tenant are serialized by the object, so the ordering a tag detects conflicts against is the ordering that already happened |
| `/Me` | `501` | The token names a connection, so there is no person for the alias to resolve to |
| `sortBy`, `sortOrder` | `sort.supported: false`, and creation order is returned | Creation order is what a full sync walks |
| `attributes`, `excludedAttributes` | The full representation | Over-returning leaves a client working; refusing stops the sync |
| `password` on a user | Accepted and stored nowhere | An enterprise connection authenticates these subjects, and a credential set over a provisioning channel is a shared secret with an extra holder |

### Tables, RPC methods and the gate

`scim_connections`, `scim_groups`, `scim_group_members`, `scim_group_mappings`, and `scim_links`
unique on `(connection_id, external_id)` and on `(connection_id, subject_id)`, as `remix/data-table`
models over `@sdxc/data-table-sqlstorage`, validated by `remix/data-schema` in the object.
Each writes its own audit row with `actor_type` of `client` and the connection id as the actor, so a
directory change and the record of it land together.

- `scimProvisionUser({ token, resource, at })` — resolves the connection, folds and claims the
  identifiers, adopts or creates the subject, writes the link, answers the representation and whether
  it created.
- `scimReplaceUser({ token, id, resource, at })` — answers the current representation, flagged
  unchanged, when the mapped digest matches.
- `scimPatchUser({ token, id, operations, at })` — the supported forms, where `active: false` revokes
  every session in the same call.
- `scimDeleteUser({ token, id, at })` — blocks or deletes per the connection's policy, with
  `scimReadUser`, `scimReadUserPage`, and the six matching group operations.
- `createScimConnection({ name, onDelete, groupSync, actor, at })` and `rotateScimToken`, each
  returning the new token once — the one bearer value that crosses the boundary, because its purpose
  is to be pasted into another system — with `deleteScimConnection`, `describeScimConnections` and
  `mapScimGroup`.

Provisioning — create, replace, an attribute-changing patch, a new connection — requires the
entitlement, and a tenant without it gets a `403` SCIM error the provider surfaces to the
administrator who can settle it. `active: false` and `DELETE` on an existing connection are admitted
whatever the billing state, because a lapsed invoice is a poor reason to leave an ex-employee's
account open.

## Consequences

### Positive

- A departure reaches the tenant when it happens and ends every session in the same call, so the gap
  between an employer's decision and its effect is one request.
- `/ServiceProviderConfig` describes what is served, so a client's capability negotiation is correct
  rather than optimistic, and a rollout adopts the subjects that already exist.

### Negative

- The supported subset is a promise a future provider may not fit, and widening it means new endpoint
  behaviour rather than a configuration change.
- Requests to one tenant are serialized, so a sync at its ceiling adds queueing delay to that tenant's
  sign-ins, and the ceiling is a number chosen ahead of any customer's traffic.
- Adopting an existing subject lets a connection take over an account created by self-signup — the
  intended behaviour, and also the blast radius of a connection configured against the wrong app.

### Neutral

- Connection rows are tenant state, so they travel with the tenant object and appear in its export.

## Alternatives Considered

**Polling each provider's directory API.** No inbound endpoint and no bearer token to rotate. It needs
a credential *into* every customer's directory, a client per vendor, and a poll interval that delays
every deactivation. Rejected: a push arrives when the decision does.

**Full RFC 7644 conformance.** Every box on a procurement sheet, and no capability question answered
with a refusal. It is a large surface whose unexercised parts still have to be correct, and `/Bulk`
concentrates a burst into one request against a single-threaded object. Rejected for a named subset
served completely and advertised truthfully.

**A queue between the endpoint and the object.** The burst is absorbed and drained at a rate this side
chooses. It makes `POST /Users` a `202` with no body, so a client needing the new `id` cannot proceed,
and its failures are invisible to the provider. Rejected: `429` with `Retry-After` is the same
back-pressure through a mechanism the client already has.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the boundary these methods are shaped by
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — the model attributes map onto, and the folding rule
- [ADR-009: Sessions](./ADR-009-sessions.md) — what deactivation revokes
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the `scim` slug and its price
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how the gate is evaluated
- [ADR-030: Organizations](./ADR-030-organizations.md) — the other target a group mapping can name
- [ADR-031: Roles and Permissions](./ADR-031-roles-and-permissions.md) — what a mapped group grants
- [ADR-028: Enterprise SSO Connections](./ADR-028-enterprise-sso-connections.md) — the sign-in half of the same customer relationship
