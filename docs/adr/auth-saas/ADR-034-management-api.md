# ADR-034: Management API

## Status

**Proposed** - 2026-09-18

## Background

A tenant's directory is administered from the dashboard: a member signs in, finds a subject, blocks
it, registers a client. That covers the work a person does by hand and none of the work a customer
wants automated — provisioning a subject when someone is hired, registering a client from a
pipeline, pulling the audit log into a warehouse nightly.

A platform whose directory cannot be driven programmatically is not usable, so the management API
is a base feature, available on every tier including Free, and it is the surface the dashboard
itself is built on. Its state lives in the two stores
[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) splits — the registry, memberships,
domains and subscription in D1, the directory in each tenant's object — and one API covers both.

## Context

### An administrative credential is not an end-user token

The tokens a tenant's provider mints describe a person to a relying party, and a relying party is
whatever the tenant registered — a mobile app, a partner's web app, a contractor's prototype. If
one of those tokens could also write the directory, compromising any registered client would be
compromising the tenant, and adding a scope to a client would be a privilege escalation across a
boundary every customer assumes exists. So an administrative credential is separate at every layer
that could be confused: a different issuer, a different key, a different audience, and a scope
vocabulary sharing no strings with the tenant's own. A token presented to the wrong one fails on
`aud` before anything reads its scopes.

### Two callers, one authorization model

A member on the dashboard and a management client calling from a pipeline want the same
operations. Modelling them separately means two route tables and two places a permission can be
wrong. Modelling them as two credentials that each resolve to a scope set means one route table,
one check, and a role that is a named bundle of the same scopes a client can hold.

### Paging crosses an RPC boundary

A list of subjects is rows the tenant object holds, and ADR-001 requires both ordering columns in
the projection so the cursor is minted from the row that came back. `Pagination.byKeyset` from
`@sdxc/pagination` produces exactly that, running inside the object over the `remix/data-table`
model, and its cursor is plain base64url, which crosses the boundary as a string.

## Decision

### Where it is served

`https://api.{PLATFORM_DOMAIN}/v1/tenants/{tenantId}/…`, on the platform's own origin rather than
the tenant's issuer hostname. The protocol surface and the administrative surface therefore share
no origin, no cookie and no token audience, and a tenant's custom domain moves without moving the
API its pipelines call.

### The surface

| Resource | Operations | State |
| --- | --- | --- |
| Tenants, branding and settings | read, update | Control plane |
| Members and invitations | list, invite, change role, remove | Control plane |
| Domains | list, attach, read verification, remove | Control plane |
| Subjects and identifiers | create, read, update, block, delete, list; add, verify, remove | Tenant object |
| Credentials | list metadata, remove a passkey, force a reset, reset a second factor | Tenant object |
| Sessions | list for a subject, revoke one, revoke all | Tenant object |
| Clients and secrets | register, update, rotate, revoke, disable, delete, list | Tenant object |
| Scopes, grants and roles | define, list, revoke a grant, assign a role | Tenant object |
| API keys and webhook endpoints | create, rotate, revoke; read the delivery log, replay | Tenant object |
| Audit events | read a page over a window with filters | Tenant object |
| Import and export runs | start, read progress, download the report | Both |

Each route is one call to one operation the owning ADR already defines, which is why this ADR adds
no tenant-object methods of its own: an endpoint that needed a new one would be assembling an
operation out of parts, which the boundary rules place inside the object.

### The credential

A management client is a control-plane record, scoped to exactly one tenant:

```sql
CREATE TABLE management_clients (
  id TEXT PRIMARY KEY,               -- mgmt_… TypeID
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name TEXT NOT NULL, hint TEXT NOT NULL,
  secret_hash TEXT NOT NULL,         -- the repo's single credential hash, via @sdxc/crypto
  scopes TEXT NOT NULL,              -- JSON array; the ceiling a token may be issued within
  created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
);
CREATE INDEX management_clients_tenant ON management_clients (tenant_id);
```

It obtains a token by client credentials at `https://api.{PLATFORM_DOMAIN}/oauth/token`, signed by
the platform's own key under the platform's issuer, carrying `aud` of the management API, the
tenant id it is bound to, and the scopes it was granted. The token lives fifteen minutes, since the
caller holds the credential that mints another. The secret is checked once per token request and is
stored under the repo's single credential hash, with `password.needsRehash` upgrading a stored
value on the request that accepted the plaintext.

A dashboard session is the other caller. A member's `memberships.role` resolves to a scope set —
`owner` to every scope, `admin` to every scope but member management and tenant deletion, `member`
to the read scopes — and the route checks the resolved set without caring which credential produced
it.

Scopes are spelled `<resource>:<read|write>`: `subjects:read`, `subjects:write`, `clients:write`,
`sessions:write`, `audit:read`, `keys:write`, `webhooks:write`, `tenant:write`, `members:write`,
`export:read`. A token is issued within its client's ceiling and a route names the one it requires.

### Rate limits

`@sdxc/rate-limit`'s `CloudflareAdapter` in the router middleware, keyed on the management client
id or the member id — an identity the request already authenticated, rather than the connecting
address a caller shares with everyone behind its egress.

| Tier | Reads / minute | Writes / minute | Import and export runs / hour |
| --- | --- | --- | --- |
| Free | 60 | 20 | 1 |
| Pro | 600 | 200 | 5 |
| Premium | 1,800 | 600 | 20 |

A denied request answers `429` with `RateLimit`, `RateLimit-Policy` and `Retry-After`, which the
package serializes, so a client backs off on numbers rather than on a guess.

### Pagination

Keyset only, through one `createPaging({ names: { perPage: "per_page", cursor: "cursor" },
perPage: 25, maxPerPage: 100 })` shared by every list route. The Worker parses the parameters, the
object pages and mints the cursor, and `paginate(headers, page, { url })` writes `Link` with
`rel="prev"` and `rel="next"`. There is no total and no page number, because a keyset read runs no
count and counting a tenant's subjects per list would be a scan inside the object.

### Errors

`application/problem+json` per RFC 9457: `type` a stable URI naming the failure, `title`, `status`,
`detail`, and `instance` carrying the request id that the platform's own logs are keyed by. A
validation failure adds `errors`, an array of `{ pointer, code, message }` built from the
`remix/data-schema` issues, so a caller fixes a field rather than re-reading a sentence.

### Versioning and deprecation

`/v1` is in the path and changes only when a response shape a client parses changes incompatibly.
Adding a field, a route, an enum value a client already tolerates, or a relaxed validation rule all
happen inside `v1`. A removal is announced with `Deprecation` and `Sunset` headers on every
affected response, in the changelog, and by email to the tenant's owners, twelve months ahead.

### Operations that live somewhere other than the API

| Capability | Where it lives instead |
| --- | --- |
| Reading a secret, an API key, a TOTP secret or a signing key back | Each is returned once by the operation that mints it; a replacement comes from rotation |
| Minting a session or a token for a chosen subject | The subject authenticates; impersonation is its own decision, with its own consent and audit story |
| Writing a credential hash outside an import run | Subject import, which validates the format and records the run |
| Editing or deleting an audit row | The log is append-only, and a correction is a new row describing the correcting action |
| Changing a tenant's id, issuer or slug | Fixed at creation, because relying parties are configured against the issuer |
| Reading across tenants | A token is bound to one tenant; a customer-wide view is the dashboard over the control plane |
| Sending a code to a phone number | Ownership is proved by a verified mailbox, which needs no carrier and costs nothing per message |

## Consequences

### Positive

- An administrative token and an end-user token share no issuer, key or audience, so a compromised
  relying party reaches exactly what its own scopes allow.
- The dashboard and a customer's pipeline run the same routes under the same checks, so a
  permission bug is one bug, and a dashboard capability is automatable by default.
- Every route is one RPC call to an operation that already exists, so the surface grows without
  eroding the coarse boundary ADR-001 depends on, and all of it is on Free.

### Negative

- Management clients are a second credential system to register, rotate and revoke, with its own
  issuer and key rotation, and keyset paging offers no result count and no jump to page seven.
- A twelve-month sunset means a shape regretted early is served for a year, and rate limits are
  per credential, so many pipelines against one tenant divide one budget.

### Neutral

- The API is versioned in its path while the packages behind it are versioned by date; only the
  path is a promise to a customer.

## Alternatives Considered

**Management tokens minted by the tenant's own provider.** One issuer, one key set, one token
format, and a customer's OAuth library works unchanged. It also makes the administrative audience
reachable from the endpoint every relying party already calls, so the separation would rest on a
claim check rather than a different credential. Rejected.

**Serving the API on each tenant's own hostname.** It keeps a customer's integration on one domain
and makes the issuer the only address to configure. It also puts an administrative audience on the
origin that serves sign-in pages and sets the session cookie, which is the boundary this design
most wants intact. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole operations, and the two stores this reads
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — the tenant, membership and domain rows this administers
- [ADR-023: Audit Log and Retention](./ADR-023-audit-log-and-retention.md) — the paging method the audit routes call
- [root ADR-029: Pagination Package](../ADR-029-pagination-package.md) — `createPaging`, `byKeyset` and the `Link` header
- [root ADR-040: PBKDF2 as the Only Credential Hash](../ADR-040-pbkdf2-as-the-only-credential-hash.md) — the single credential hash a management secret is stored under
