# ADR-034: Management API

## Status

**Proposed** - 2026-09-18

## Background

A tenant's directory is administered from the dashboard: a member signs in, finds a subject, blocks
it, registers a client. That covers the work a person does by hand and none of what a customer
automates — provisioning a subject at hire, registering a client from a pipeline, pulling the audit
log into a warehouse nightly.

A platform whose directory cannot be driven programmatically is not usable, so the management API
is a base feature on every tier including Free, and it is the surface the dashboard itself is built
on. Its state lives in the two stores *Auth SaaS on Per-Tenant Durable Objects* splits — the
registry, memberships, domains and subscription in D1, the directory in each tenant's object.

## Context

### An administrative credential is not an end-user token

The tokens a tenant's provider mints describe a person to a relying party, and a relying party is
whatever the tenant registered — a mobile app, a partner's web app, a contractor's prototype. If
one of those tokens could also write the directory, compromising any registered client would be
compromising the tenant, and adding a scope to a client would be a privilege escalation across a
boundary every customer assumes exists. So an administrative credential is separate at every layer
that could be confused: a different issuer, key and audience, and a scope vocabulary sharing no
strings with the tenant's own. A token presented to the wrong one fails on `aud` before its scopes.

### One authorization model behind two front doors

A member on the dashboard and a management client calling from a pipeline want the same operations.
Modelling them separately means two route tables and two places a permission can be wrong. Two
credentials that each resolve to a scope set means one route table, one check, and a role that is a
named bundle of the same scopes a client can hold. The dashboard is the platform's own browser
surface; every caller outside a browser holds a client id and a secret.

## Decision

### Where it is served

`https://api.{PLATFORM_DOMAIN}/tenants/{tenantId}/…`, on the platform's own origin. A tenant's
issuer stays the tenant's own hostname, what relying parties are configured against and what its
tokens carry as `iss`, so the two surfaces share no origin, no cookie and no token audience, and a
custom domain moves without moving this API.

A caller holds both addresses, which is the split `@sdxc/auth` is built for: its OpenID Connect
roles take an `Issuer` for the tenant, and its administrative role is
`new ManagementClient(service, { baseUrl, resources: [baseUrl] })`, where `baseUrl` is the prefix
above — the option the package provides for a provider serving its management API apart from its
OpenID Connect endpoints.

### The surface

| Resource | Operations | State |
| --- | --- | --- |
| Tenants, members and domains | read and update settings and branding; invite a member, change a role, remove; attach a domain, read its verification | Control plane |
| Subjects and identifiers | create, read, update, block, delete, list; add, verify, remove | Tenant object |
| Credentials and sessions | list metadata, remove a passkey, force a reset, reset a second factor; revoke one session or all | Tenant object |
| Clients and secrets | register, update, rotate, revoke, disable, delete, list | Tenant object |
| Scopes, grants and roles | define, list, revoke a grant, assign a role | Tenant object |
| API keys and webhook endpoints | create, rotate, revoke; read the delivery log, replay | Tenant object |
| Audit events, import and export runs | read a page over a window with filters; start a run, read its progress, download the report | Both |

Each route is one call to one operation the owning ADR already defines, which is why this ADR adds
no tenant-object methods: an endpoint needing a new one would assemble an operation out of parts.

### The credential, and the only way to obtain one

Programmatic access runs on OAuth 2.0 client credentials and nothing else: a management client
presents its id and secret at `https://api.{PLATFORM_DOMAIN}/oauth/token` for a temporary access
token, signed by the platform's own key under its own issuer, and every call from outside a browser
carries one. The client is a control-plane record, scoped to one tenant:

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

The token lives fifteen minutes, since the caller holds the credential that mints another, and
carries the tenant id it is bound to and the scopes it was granted. The secret is checked once per
token request, stored under the repo's single credential hash and upgraded in place where
`password.needsRehash` says so.

Its audience is asked for as a resource indicator: `ServiceClient.token({ resources })` sends each
value as its own `resource` field per RFC 8707, naming `https://api.{PLATFORM_DOMAIN}/tenants/…`,
the `aud` every route requires. A token minted for a relying party names that relying party under
the tenant's own issuer, so adding scopes to that client widens what it reaches among the tenant's
own resources and never into a directory write: it fails here on `aud` before a scope is read.

A dashboard session is the platform's own browser surface over these routes, where a member's
`memberships.role` resolves to a scope set — `owner` to every scope, `admin` to all but member
management and tenant deletion, `member` to the read scopes — and the route checks the resolved set
without caring which credential produced it.

Scopes are spelled `<resource>:<read|write>`: `subjects:read`, `subjects:write`, `clients:write`,
`sessions:write`, `audit:read`, `keys:write`, `webhooks:write`, `tenant:write`, `members:write`,
`export:read`. A token is issued within its client's ceiling and a route names the one it requires.

### Rate limits

`@sdxc/rate-limit`'s `CloudflareAdapter` in the router middleware, keyed on the management client
id or the member id — an identity the request already authenticated, rather than an address a
caller shares with everyone behind its egress. A denied request answers `429` with `RateLimit` and
`Retry-After`, so a client backs off on numbers.

| Tier | Reads / minute | Writes / minute | Import and export runs / hour |
| --- | --- | --- | --- |
| Free | 60 | 20 | 1 |
| Pro | 600 | 200 | 5 |
| Premium | 1,800 | 600 | 20 |

### Pagination and errors

Keyset only, through one `createPaging({ names: { perPage: "per_page", cursor: "cursor" },
perPage: 25, maxPerPage: 100 })` shared by every list route: the object runs `Pagination.byKeyset`
with both ordering columns in the projection, mints the cursor from the row that came back, and
`paginate(headers, page, { url })` writes `Link` with `rel="prev"` and `rel="next"`, with no total.

Failures are `application/problem+json` per RFC 9457: `type` a stable URI naming the failure,
`title`, `status`, `detail`, and `instance` carrying the request id the logs are keyed by. A
validation failure adds `errors`, one `{ pointer, code, message }` per `remix/data-schema` issue.

### Versioning and deprecation

A version is a date, named in the `X-API-Version` request header — `X-API-Version: 2026-09-18` — and
echoed on every response, so a caller reads back what it was served. A request naming none is
served the oldest version still supported, so an integration keeps its shape until its author moves
it, and a date the platform does not publish is answered `400` beside the dates it does.

Within a version a response gains fields, a route is added, an enum gains a value and validation
relaxes, so a client reads the fields it names and tolerates the rest. A new version is minted when
a field is removed or renamed, its type or default changes, a parameter becomes required, or a
route's meaning changes. A version is served twelve months past its successor, through which its
responses carry `Deprecation` and `Sunset` naming that successor, the changelog records the change,
and the tenant's owners hear it by email.

### Operations that live somewhere other than the API

| Capability | Where it lives instead |
| --- | --- |
| Reading a secret, an API key, a TOTP secret or a signing key back | Each is returned once by the operation that mints it; a replacement comes from rotation |
| Minting a session or a token for a chosen subject | The subject authenticates; impersonation is its own decision, with its own consent and audit story |

## Consequences

### Positive

- An administrative token and an end-user token share no issuer, key or audience, so a compromised
  relying party reaches exactly what its own scopes allow.
- The dashboard and a customer's pipeline run the same routes under the same checks, each route
  one RPC call to an operation that already exists, so a permission bug is one bug — and on Free.

### Negative

- Management clients are a second credential system to register, rotate and revoke, with its own
  issuer and key rotation, and every caller runs a token exchange before its first call.
- A twelve-month window means a shape regretted early is served for a year, rate limits are per
  credential, and keyset paging offers no result count and no jump to page seven.

### Neutral

- The API and its packages are both versioned by date; only the header is a promise to a customer.

## Alternatives Considered

**Management tokens minted by the tenant's own provider.** One issuer, one key set, and a
customer's OAuth library works unchanged. It also makes the administrative audience reachable from
the endpoint every relying party calls, so the separation would rest on a claim check. Rejected.

**Serving the API on each tenant's own hostname.** It keeps a customer's integration on one domain
and makes the issuer the only address to configure. It also puts an administrative audience on the
origin that serves sign-in pages and sets the session cookie. Rejected.

**A version in the path.** `/v1/…` is visible in a log and in the URL a reader copies. It also
versions every route at once, so a caller moving forward rewrites every URL it calls. Rejected in
favour of a header a client sets in one place.

**A long-lived key in a header.** One secret, no token exchange, and a script works in one line. It
also leaves directory write access in every caller's environment until someone rotates it. Rejected:
the exchange is what keeps the credential reaching this API short-lived.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole operations, and the two stores this reads
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — the tenant, membership and domain rows this administers
- [ADR-023: Audit Log and Retention](./ADR-023-audit-log-and-retention.md) — the paging method the audit routes call
- [ADR-032: Machine-to-Machine Access and API Keys](./ADR-032-machine-to-machine-access-and-api-keys.md) — the client credentials grant a tenant's own services use, and the API keys these routes mint
- [root ADR-029: Pagination Package](../ADR-029-pagination-package.md) — `createPaging`, `byKeyset` and the `Link` header
- [root ADR-040: PBKDF2 as the Only Credential Hash](../ADR-040-pbkdf2-as-the-only-credential-hash.md) — the single credential hash a management secret is stored under
