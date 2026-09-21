# ADR-031: Roles and Permissions

## Status

**Proposed** - 2026-09-18

## Background

Three things already assume a role exists: the control plane records whether a person is an owner, an
admin or a member of a tenant, an organization membership carries a role key, and the management API
needs something to check before it lets a caller write. What none of them has is a definition — what
the three names mean, where an assignment is written, how it reaches a token, and what a tenant does
when three names are not enough.

The three basic roles are a base feature on every tier including Free. Defining roles beyond them, and
permissions at all, is the **custom roles and permissions** add-on at $19 per tenant per month, slug
`custom_roles`.

## Context

### A role is always held at a scope, and there are three of them

| Scope                      | Who holds a role there                              | Where the assignment lives                       | Extensible               |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| A tenant, administratively | A person administering that tenant in the dashboard | `memberships` in the control plane               | Fixed at the three names |
| A tenant's directory       | A subject, across the whole tenant                  | `role_assignments` in the tenant object          | With the add-on          |
| One organization           | A subject, within that organization                 | `organization_members.role` in the tenant object | With the add-on          |

The first is about the platform's customer and never reaches a token; the other two are about a
tenant's own subjects and do. Keeping them separate stops an organization admin inheriting the ability
to administer the tenant that hosts them.

### The token is the cheap place for an answer, and it has a ceiling

A relying party reading authorization from the token it already verified spends nothing; one that asks
pays a round trip per cache miss. The ceiling decides how much fits: a tenant's tokens carry at most
sixteen claims and four kilobytes of payload, and an access token travels in an `Authorization` header
through proxies that reject large ones. A role key is short and there is one per scope, so roles
always fit; a permission set has no natural bound, so whether it fits is answered before a token is
minted rather than while one is.

### Fine-grained authorization is the tenant's data, not the tenant's directory

"May this subject edit _this document_" is answered from tuples about documents, whose count scales
with the tenant's content rather than with its people, against a per-tenant storage ceiling sized for
a directory. The check also sits on the request path of the tenant's own product, a latency budget
this platform neither owns nor can promise.

## Decision

### Where the paid line falls

| Capability                                                          | Every tier, including Free | Needs `custom_roles` |
| ------------------------------------------------------------------- | -------------------------- | -------------------- |
| The three system roles at every scope above                         | yes                        | yes                  |
| Assigning, changing and removing a system role                      | yes                        | yes                  |
| A `roles` claim naming the role held at the token's scopes          | yes                        | yes                  |
| System-role checks at the management API and the dashboard          | yes                        | yes                  |
| Defining a role beyond the three                                    |                            | yes                  |
| Defining a permission, and granting permissions to a role           |                            | yes                  |
| A `permissions` claim, and a resolved permission set at `/userinfo` |                            | yes                  |

A tenant on Free tells an owner from a member wherever it matters, so the management API is safe
without a purchase, and what $19 buys is a tenant's own vocabulary.

### The system roles

`owner`, `admin` and `member` exist in every tenant, at every scope, undeletable and unrenameable,
with fixed meanings:

| Role     | Holds                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `owner`  | Every administrative operation on the scope, including deleting it and transferring ownership                  |
| `admin`  | Every administrative operation except deleting the scope, transferring ownership, and changing an owner's role |
| `member` | Membership of the scope, and nothing more                                                                      |

Removing the last owner of a scope is refused, so no scope reaches a state only support can leave, and
the three keys are reserved, so a check against `owner` means the same thing in every tenant.

### The model

Tables in the tenant object, as `remix/data-table` models over `@sdxc/data-table-sqlstorage`:

| Table              | Columns                                                                                                 | The rule it carries                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `roles`            | `id` (`rol_…`), `scope` (`tenant` or an `org_…` id), `key`, `name`, `description`, `system`, timestamps | Unique on `(scope, key)`, so a role name means one thing within its scope                                          |
| `permissions`      | `key`, `name`, `description`, `created_at`                                                              | The key is the primary key; keys beginning `auth:` are reserved for this platform's own management-API permissions |
| `role_permissions` | `role_id`, `permission_key`                                                                             | Primary key over both; an explicit set, resolved by one indexed read                                               |
| `role_assignments` | `subject_id`, `role_id`, `scope`, `assigned_by`, `created_at`                                           | Primary key `(subject_id, scope)` — one role per subject per scope                                                 |

One role per subject per scope is the simplifying decision the rest rests on. Several roles at one
scope makes every read a union, raises a precedence question the moment two disagree, and leaves an
interface with no single answer to what a person is; a permission set is what composes, so a union is
a role. An organization membership is that scope's assignment, stored on the membership row because a
membership and its role share one lifecycle, while `role_assignments` holds the tenant scope — the
scope decides the table, so the fact is written once.

### Permissions in a token, and the cap enforced at the write

A `roles` claim always travels: a JSON array of the role keys the session's scopes resolve — one at
the tenant, one more at the active organization — so it is bounded by construction. It joins the
claims the minting design issues, alongside `permissions`, so a tenant's own declared claim cannot
take either name.

A client carries an `include_permissions` switch. With it on, minting resolves the granted set for the
session's scopes in the same turn as the exchange and writes a `permissions` claim. The size question
is settled where the set is written rather than where a token is: `setRolePermissions` refuses a set
whose serialized form exceeds one kilobyte, naming the size and the cap, so no role exceeds what a
token carries and an administrator meets the limit in a form instead of a user meeting it at sign-in.
With the switch off, a relying party reads the resolved set from `/userinfo` under a granted scope or
from introspection, and caches it for the access token's remaining lifetime, which the response's
`Cache-Control` states.

### Checks at the API surface

Every management API operation names the permission it requires, and the Worker admits the request
against the set resolved for the caller's scope. The tenant object separately authorizes the actor
each of its operations names, because it is the trust boundary for a tenant's state rather than a
helper whose caller has checked already, so a route that forgets its check is refused at the store.

### RPC methods

- `defineRole({ scope, key, name, description, actor, at })` and `updateRole`, with
  `deleteRole({ scope, roleId, reassignTo, actor, at })`, which reassigns every holder in the same
  call so no subject points at a role that is gone.
- `definePermission({ key, name, description, actor, at })` and `removePermission`, which drops the
  grants in the same call.
- `setRolePermissions({ roleId, permissionKeys, actor, at })` — replaces the set and enforces the
  claim cap.
- `assignRole({ subjectId, scope, roleKey, actor, at })` — one role per scope, so it replaces, and it
  refuses the removal of a scope's last owner.
- `describeSubjectAccess({ subjectId, scope })` — the roles and resolved permissions one screen or one
  `/userinfo` response renders — with `authorizeSubject({ subjectId, scope, permission, at })` for a
  single decision and `setClientPermissionClaim({ clientId, include, actor, at })`.

Defining roles and permissions runs behind `requireEntitlement("custom_roles")`. Assigning a system
role never consults it, and neither does resolving a role at sign-in, since nothing on the protocol
surface consults a flag.

### What is out of scope, and what a tenant needing it does

Relationship-based and other fine-grained authorization is not built here and is not a planned add-on.
A tenant needing it keeps the relationships in its own store, keyed to what this platform issues — the
`sub`, the `org` claim, and the roles and permissions above — or runs a dedicated authorization
service seeded from the same claims: this platform issues the facts, and something closer to the data
decides on them. Role inheritance is likewise out, because an explicit permission set is what an
auditor reads, and a policy over attributes is written where the request is served, over a claim the
subject's declared attributes already ship.

## Consequences

### Positive

- Every tenant has an authorization model on day one, so the management API and the dashboard are safe
  without a purchase and the add-on sells vocabulary rather than safety.
- The token-size limit is enforced when a role is edited, and a route that forgets its permission
  check is still refused by the object, because authorization lives next to the rows.

### Negative

- A tenant wanting the union of two roles defines a third, and such roles grow with the combinations
  it needs; permissions in a token are a snapshot, so revoking one lands at the next exchange.
- Refusing fine-grained authorization sends the tenants who need it to a second system, which they
  keep in step themselves.
- The one-kilobyte cap is chosen against header limits rather than measured against a customer's role,
  and raising it later is easier than lowering it.

### Neutral

- Role and permission definitions are tenant state, so they travel with the tenant object, and the
  three system keys are reserved permanently, so a tenant with its own `admin` concept renames it.

## Alternatives Considered

**Permissions always in the token, uncapped.** The simplest relying party: it never calls back. It
puts an unbounded array in a header that proxies truncate or reject, and the failure surfaces as an
opaque error at infrastructure nobody here operates. Rejected for a cap enforced where the set is
written.

**Relationship-based authorization as a further add-on.** The honest answer to "may this person edit
_this_ document", and the direction the market moves. Its tuples are the tenant's application data and
scale with that data against a storage ceiling sized for a directory, and the check sits in a latency
budget this platform does not own. Rejected: this platform issues the claims and a system closer to
the data decides on them.

**Charging for the three system roles.** More revenue per tenant, and Free would still be a working
provider. It sells a weaker product in the same way a paywalled second factor does: a tenant that
cannot distinguish an owner from a member has an administrative surface anyone can use. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — why the object authorizes the actor itself
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — the administrative memberships that are fixed at the three names
- [ADR-010: Signing Keys and Token Minting](./ADR-010-signing-keys-and-token-minting.md) — the claim set and the payload cap this works inside
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the `custom_roles` slug, and why security is not a tier
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how the gate is evaluated
- [ADR-030: Organizations](./ADR-030-organizations.md) — the scope a membership role is held at
- [ADR-034: Management API](./ADR-034-management-api.md) — the surface these permission checks admit
