# ADR-001: Auth SaaS on Per-Tenant Durable Objects

## Status

**Proposed** - 2026-09-17

## Background

`apps/auth-saas` is a multi-tenant identity platform. Each customer gets an isolated
OIDC/OAuth2 provider — its own subjects, clients, signing keys and sessions — reachable at
its own hostname under its own issuer. The platform also runs a dashboard where a customer
administers their tenant, and a control plane that knows which tenants exist and which
hostname belongs to which one.

It runs on Cloudflare Workers. That settles the runtime and leaves the question this ADR
answers: where a tenant's state lives, and what shape the boundary around it takes.

## Context

### Tenant isolation is the product

A tenant's subjects and signing keys are the thing being sold. Isolation implemented in
application code — one database with a `tenant_id` column on every table — is one missing
`WHERE` clause away from a cross-tenant leak, and that clause has to be right in every
query written from now on, including the ones written in a hurry.

A Durable Object per tenant makes the isolation structural instead. Each tenant is a
separate SQLite database addressed by name; a query cannot reach another tenant's rows
because it cannot reach another tenant's database. The same split bounds a noisy tenant's
load to its own object, and lets each tenant's object be placed near the customers it
serves.

### The protocol surface is HTTP; the state is not

`/authorize`, `/oauth/token`, `/userinfo` and `/.well-known/*` are the product's public
interface, served on each tenant's hostname under its issuer. They are HTTP and stay HTTP.

Serving them is the Worker's job. It is what receives the request, resolves the hostname
to a tenant, runs the router and middleware, and renders the sign-in pages. An object that
also spoke HTTP would mean two routers and two middleware stacks handling one request,
with an untyped seam between them and a shared secret to let the Worker authenticate to
itself.

### Round trips are a function of method granularity

The objection to treating the object as a store is that orchestration in the Worker
multiplies round trips. That holds only when the methods are queries:

| Operation       | As queries                                                                        | As one operation                             |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| Token exchange  | `getCode`, `getClient`, `verifySecret`, `createSession`, `deleteCode`, `sign` — 6 | `exchangeCode(input)` — 1                    |
| Authorization   | `getClient`, `validateRedirect`, `getSubject`, `createCode` — 4                   | `beginAuthorization(input)` — 1              |
| `/userinfo`     | 1                                                                                 | 0 — verify the signature against cached keys |
| `.well-known/*` | 1                                                                                 | 0 — cached in the Worker                     |

Methods shaped as whole operations hold the count at one round trip per request, and the
two read-only documents need none at all. The discipline that keeps it there is a rule
about how methods are designed, stated as one below.

### Durable Object limits that shape the design

An object is single-threaded per instance, but every `await` is an interleaving point, so
a read-modify-write spanning one is a race even though nothing runs in parallel. Storage is
finite per object, which makes retention a design concern rather than something to settle
later. And a tenant's signing keys live in its object's storage, which is the strongest
reason for minting tokens there rather than anywhere else.

### Two kinds of state, two lifecycles

Which tenants exist, which hostname maps to which tenant, who owns a tenant and what they
are billed is global, relational, and queried across tenants — a dashboard lists every
tenant a person can administer. A tenant's subjects, clients and keys are none of those
things: they are only ever read in the context of one tenant.

These are different problems and they get different stores rather than one store asked to
do both.

## Decision

The provider is built into `apps/auth-saas`. Each tenant is a Durable Object exposing typed
RPC over its own SqlStorage database, the control plane is D1, and the Worker owns HTTP and
rendering.

### Shape

```
apps/auth-saas/
  bootstrap/      worker.ts (fetch/scheduled), app.ts (router), logger.ts
  routes/         the route table
  app/
    auth/         protocol logic: authorization, token, discovery, webauthn
    http/         controllers, middleware, validators, view-models, responses
    models/       control-plane models over D1
    services/     hostname, billing, analytics
    jobs/         scheduled work
  database/
    tenant-do.ts  the per-tenant Durable Object
    migrations/   D1 control-plane migrations
  resources/      layouts and views
```

The Worker owns HTTP, routing, middleware, rendering and the control plane. The object owns
one tenant's state and the operations over it.

### The tenant object is a store, not an application

It exposes typed methods and no `fetch` handler. Two rules govern its surface:

**A method is a complete operation, never a query.** `exchangeCode`, `beginAuthorization`,
`enrolPasskey`, `revokeSession` — each takes the inputs of one domain action, performs the
whole thing, and returns a plain value. There is no `getClient`, because assembling an
operation out of parts is not something a caller outside the object should do. This is what
holds the round-trip count at one, and it is also what keeps a read-modify-write inside a
single method where its interleaving is visible and can be reasoned about.

**The object validates its own inputs.** It is the trust boundary for a tenant's state, not
a private helper whose caller has already checked things. A method given a `client_id`
resolves and authorizes it itself.

### What crosses the boundary

Values are structured-cloned between the Worker and the object, and the serialization is
lossy in ways that fail silently:

- **Never a `Result`.** An `Error` is serialized by name and message and the subclass is
  dropped, so an `instanceof` check is always false on the far side and a caller cannot tell
  a stale cursor from a broken query. Narrow inside the object and return a plain
  discriminated union.
- **Never a `Date`.** Timestamps cross as integers.
- **Both ordering columns stay in a projection**, because a pagination cursor is minted from
  the sort values on the row that came back.

Two more follow from this being an identity system:

- **Never key material.** Private keys stay in the object. The Worker receives signed
  output, never something to sign with.
- **Never a bearer value where a verified claim will do.** A method returns the subject and
  scopes it resolved, not the token it resolved them from.

### Where each concern lives

| Concern                                              | Home                           |
| ---------------------------------------------------- | ------------------------------ |
| Tenant registry, hostnames, billing, team membership | D1                             |
| Hostname → tenant resolution cache                   | KV                             |
| Subjects, clients, sessions, keys, consent, passkeys | The tenant object's SqlStorage |
| Protocol endpoints, rendering, routing, middleware   | The Worker                     |
| Token signing and key rotation                       | The tenant object              |

### Signing stays in the object

Minting a token is a method on the object, not a Worker concern with a key fetched over
RPC. Key rotation is likewise a method. The private key never crosses the boundary, so a
flaw on a Worker path costs a caller the operations that path can invoke rather than the
ability to mint tokens for the tenant at will.

### Migrations

A Durable Object has no filesystem, so a tenant's schema is a registry of SQL strings
applied on boot. The control plane keeps ordinary D1 migration files. Two schemas with two
lifecycles, deliberately not unified.

## Consequences

### Positive

- Cross-tenant isolation is a property of the topology rather than of every query, so it
  holds for code not yet written.
- Calls into tenant state are typechecked end to end: a mismatch is a build error rather
  than a runtime failure at an untyped boundary.
- `/userinfo` and the discovery documents are served from the Worker without touching the
  object.
- Key material is confined to one place, and the list of operations that can use it is the
  object's method list.
- A tenant's object can be placed near the customers it serves, and one tenant's load is
  bounded to its own object.

### Negative

- The provider is part of this app and cannot be run standalone or reused elsewhere without
  extracting it first.
- A coarse RPC surface is easy to erode. One convenient `getClient()` starts the drift back
  toward chatty orchestration, and nothing but review prevents it.
- A tenant's entire state is one object, which makes it a single unit of both failure and
  scale. A tenant larger than one object can hold needs a different answer than this one.
- Per-object storage is finite, so every table that grows without bound needs a retention
  rule before it ships.
- Tests exercise the object through a Durable Object state mock rather than against a plain
  database handle.

### Neutral

- Two schemas with two migration mechanisms is a permanent property of the design, not a
  transitional state.
- The dashboard reads the control plane and calls tenant objects; it is a client of both and
  privileged over neither.

## Alternatives Considered

**One shared database with a `tenant_id` column.** The conventional multi-tenant shape, and
the easiest to query across tenants. It puts isolation in application code, where a single
omitted predicate leaks one customer's subjects to another and the omission is invisible in
review. Rejected: for an identity platform the isolation boundary should be something a
query cannot cross by accident.

**The provider as a standalone reusable package.** Attractive if it is ever self-hosted or
embedded elsewhere. It charges every feature a coordinated edit on both sides of the
boundary — a capability injected, a route added, a controller written, a response schema
restated — for reuse that a single consumer never collects. Rejected for now; a second
consumer is the event that should trigger the extraction, and the logic is no harder to
extract later than to keep separate throughout.

**The object as an HTTP application.** Keeps the protocol handlers next to the state and
lets the object be addressed like a service. It also means two routers and two middleware
stacks per request, a shared secret so the Worker can authenticate to itself, and an untyped
boundary where every response has to be re-validated on arrival. Rejected: the object gains
a second application without gaining a second caller.

**Fine-grained RPC over a raw SQL store.** The simplest object, with all orchestration in
the Worker where it is easy to test. It multiplies round trips, and it spreads
read-modify-write sequences across a boundary where the interleaving stops being visible.
Rejected in favour of whole operations.

**Stateless Workers with everything in D1.** One store, no object lifecycle, no per-object
storage ceiling. It gives up per-tenant isolation and per-tenant locality, which are the two
properties the product is built on. Rejected.

## References

- [reader ADR-001: An RSS Reader on Per-User Durable Objects](../reader/ADR-001-rss-reader-on-per-user-durable-objects.md) — where the RPC boundary rules adopted here were established
- [ADR-057: Request Context Instead of a Service Container](../ADR-057-request-context-instead-of-a-service-container.md) — how dependencies reach a controller
