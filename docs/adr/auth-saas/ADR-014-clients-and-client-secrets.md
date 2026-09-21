# ADR-014: Clients and Client Secrets

## Status

**Proposed** - 2026-09-18

## Background

A client is a relying party registered in a tenant: the web app, mobile app or service that sends
a subject to `/authorize` and exchanges the resulting code for tokens. Every protocol decision
downstream reads its record — where a code may be delivered, which grants the token endpoint
honours, whether a secret is demanded and how it is presented.

The record lives in the tenant object, which ADR-001 makes the place that resolves and authorizes
a `client_id` rather than a store a caller consults first. Clients and client secrets are a base
capability, on every tier including Free.

## Context

### A redirect URI is the only control over where a code goes

The authorization code is delivered by redirecting the browser, so the registered URI list is the
whole of the tenant's say in where a credential lands. Any rule looser than string equality — a
wildcard host, a path prefix, a tolerated trailing slash — turns one open redirector in the
customer's estate into code exfiltration.

### A public client has no secret to keep

A single-page app and a native app ship their code to the device running it, so a secret embedded
in either is public the moment it is distributed. What stands in for it is proof that the client
exchanging the code started the flow, which PKCE supplies.

### Secrets change while traffic is flowing

A customer rotating a secret updates it across fleets that do not restart together. Replacing the
value in one step fails every request between the write and the last deploy, which is what leaves
secrets in place for years; two live secrets with a window between them makes rotation routine.

## Decision

### The records

```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,                -- client_… TypeID; the `client_id` on the wire
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- "confidential" | "public"
  redirect_uris TEXT NOT NULL,        -- JSON array of exact URIs
  post_logout_redirect_uris TEXT NOT NULL,
  grant_types TEXT NOT NULL,          -- JSON array
  response_types TEXT NOT NULL,       -- JSON array
  scopes TEXT NOT NULL,               -- JSON array; the ceiling this client may ask within
  token_endpoint_auth_method TEXT NOT NULL,
  require_consent INTEGER NOT NULL,
  created_at INTEGER NOT NULL,        -- epoch milliseconds throughout
  updated_at INTEGER NOT NULL,
  disabled_at INTEGER
);

CREATE TABLE client_secrets (
  id TEXT PRIMARY KEY,                -- csec_… TypeID; what the audit log names
  client_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  hint TEXT NOT NULL,                 -- last four characters, so a dashboard can tell two apart
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER                  -- set on the incumbent when a rotation begins
);
CREATE INDEX client_secrets_by_client ON client_secrets (client_id);
CREATE INDEX client_secrets_by_expiry ON client_secrets (expires_at);
```

### Public and confidential

`kind` is set at registration and fixed after, because changing it changes what the token endpoint
demands of code already deployed. A confidential client holds secrets and authenticates with one;
a public client holds none, and the object refuses to mint one for it. PKCE is required of both:
a secret proves which application calls, PKCE proves the exchange belongs to its authorization.

### Redirect URIs, matched exactly

A registered URI is absolute and has no fragment, and the object validates it at write time:
`https` for a web client, `http` only for a loopback host, a custom scheme for a native one. At
authorization the requested value is compared by string equality against the list, with one
exception — a loopback URI matches while ignoring its port, since a native app takes the port the
system gives it.

### Grant and response types, per client

| Grant type           | Response type | Who carries it                                                  |
| -------------------- | ------------- | --------------------------------------------------------------- |
| `authorization_code` | `code`        | Every client                                                    |
| `refresh_token`      | —             | A client whose grants include it, refreshing within its scopes  |
| `client_credentials` | —             | A client acting for itself, under the machine-to-machine add-on |

The arrays are a ceiling: the authorization endpoint refuses a `response_type` the client does not
carry, and the token endpoint refuses a `grant_type` it does not. `client_credentials` is writable
only while the tenant holds the Machine-to-Machine Access and API Keys add-on, checked as an
entitlement flag when the grant list is set.

### Secrets

A secret is `randomToken({ bytes: 32, prefix: "csec" })` from `@sdxc/crypto`, returned once by the
operation that mints it and never readable again. Storage keeps the hash `password.hash` writes —
the repo's single credential hash, per root ADR-040 — verified with `password.verify`, and
`password.needsRehash` replaces a hash trailing current policy on the request that accepted the
plaintext. A secret is found by way of its client rather than by its own value and checked once
per token request, so it carries the work factor a stored credential deserves; `hint` is what a
dashboard shows, and `last_used_at` tells a customer whether the old secret is still in use.

`rotateClientSecret` mints a second live secret and stamps `expires_at` on the incumbent, seven
days out by default and thirty at most. Both verify until the window closes and at most two live
secrets exist at a time. A customer who finishes early calls `revokeClientSecret` and closes the
window immediately.

`client_secrets` grows with every rotation, so it carries the retention rule ADR-004 asks of a
growing table. A row is deletable once `expires_at` is past — the overlap has closed and the
client is on its successor — while a row with no `expires_at`, or one still ahead, is never a
candidate, so a window closes before a row goes. The scheduled handler sweeps daily over
`client_secrets_by_expiry`, and each removal writes a `client.secret.deleted` audit row.

### Authentication at the token endpoint

| Method                | Presented as                     | Who uses it                                                 |
| --------------------- | -------------------------------- | ----------------------------------------------------------- |
| `client_secret_basic` | The `Authorization` header       | Confidential clients, the registration default              |
| `client_secret_post`  | Form parameters                  | Confidential clients whose HTTP stack cannot set the header |
| `none`                | The `client_id` alone, with PKCE | Public clients                                              |

A client's `token_endpoint_auth_method` is the one method it may use, and discovery advertises
these three. A presented secret is checked against every live secret, so a rotation is invisible.

### RPC methods

- `registerClient(input)` — validates the whole record, writes it, mints the first secret for a
  confidential client, and returns the record plus that one-time value.
- `updateClient(input)` — replaces the editable fields as one set, so a redirect list is never
  half-written, and refuses a change to `kind`.
- `rotateClientSecret(input)` — mints the successor and opens the overlap on the incumbent in one
  call, returning the new secret and when the old one expires.
- `revokeClientSecret(input)` — closes a secret's window at once and keeps one live for the client.
- `sweepExpiredClientSecrets(input)` — bounded deletes of rows past their window.
- `disableClient(input)` / `deleteClient(input)` — stop a client authorizing, or remove it with its
  secrets, consents and tokens.
- `listClients(input)` — a page for the dashboard, `created_at` and `id` in the projection so the
  cursor is minted from the row that came back.

Authenticating a client is not among them: `exchangeCode` and the refresh exchange resolve the
client and check its secret inside the call they already make.

### Dynamic client registration is deferred

Registration stays an authenticated operation, reached from the dashboard or the management API.
Open registration is a different decision — an initial access token policy, a position on software
statements, a rate-limit story for an endpoint that writes to a tenant — worth taking on its own.

## Consequences

### Positive

- The registered URI list is the exact set of places a code can go, and no rule can widen it.
- A rotation is two calls a week apart with both secrets live between, which customers follow.
- What a client may do is data on its record, so the endpoints refuse a capability never granted.

### Negative

- A lost secret is replaced, never recovered; every deployment holding it is updated.
- Exact matching means a new environment registers its URI before it works, and `kind` fixed after
  registration means an app moving from a server to a browser is registered again.

### Neutral

- Two live secrets is the ceiling; a customer wanting three staggered windows has a deployment
  problem that a second registration answers better.

## Alternatives Considered

**Wildcard or prefix redirect URI matching.** The convenience customers ask for, particularly for
preview deployments. It makes "a code goes where the tenant said" as strong as the customer's
weakest subdomain, and fails silently until a code lands elsewhere. Rejected; preview environments
register their URIs.

**One secret, replaced in place.** The simplest record and the simplest dashboard, and it makes
every rotation an outage as long as the customer's deployment takes. Rejected.

**Storing secrets reversibly so they can be shown again.** It removes the "copy it now" moment
customers dislike, and makes one read of tenant state a compromise of every relying party.
Rejected.

**`private_key_jwt` or mTLS client authentication.** Stronger than a shared secret, and what a
regulated integration eventually asks for. Each adds a key distribution and rotation story of its
own, worth deciding when a customer needs it. Rejected for now.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole operations, and the object as the trust boundary
- ADR-004: Tenant Object Schema and Migrations — the retention rule a growing table carries
- [ADR-040: PBKDF2 as the Only Credential Hash](../ADR-040-pbkdf2-as-the-only-credential-hash.md) — one credential hash, with upgrade on verify
- ADR-011: Authorization Endpoint and PKCE — reads the redirect list and the response types
- ADR-012: Token Endpoint and Refresh Rotation — authenticates the client inside the exchange
