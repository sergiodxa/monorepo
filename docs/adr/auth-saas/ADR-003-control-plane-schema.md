# ADR-003: Control Plane Schema

## Status

**Proposed** - 2026-09-18

## Background

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) splits state in two. A tenant's
subjects, clients, sessions and keys live inside that tenant's Durable Object; everything global —
which tenants exist, who administers each, which hostname reaches which object, what each is
billed — lives in D1, because it is relational and queried across tenants.

[ADR-002](./ADR-002-rebuild-path-and-implementation-order.md) puts this schema first: nothing is
scoped to a tenant until a tenant exists.

Nothing is deployed and no tenant has ever been provisioned, so this schema is written once
rather than migrated toward. It settles what a customer is, what a tenant is, how they relate,
and the columns billing reads — against the `PLATFORM_DB` binding and the numbered SQL files in
`database/migrations/`.

## Context

### A customer buys, a tenant is served

A customer is a billing account and a tenant is an isolated provider. One customer may own many
tenants, and each carries its own subscription, because a tenant is its own object, its own keys
and its own load, and none of that gets cheaper when one person owns five. That splits the billing
identity from the subscription: the payment method and the provider's customer record belong to the
customer, while the plan, the period and the subscription record belong to the tenant.

### A tenant id names a Durable Object

A tenant's id is what `env.TENANT.getByName(id)` is called with, so it addresses storage rather
than only identifying a row. It is therefore opaque, so nothing a customer typed decides where state
lives; immutable, because a changed id is an empty database; and never reused, because reuse hands
one tenant another's storage. Deleting the row deletes none of the object behind it, so whatever
the schema says about a removed tenant holds for storage that outlives the row.

## Decision

### Identifiers and timestamps

Ids are TypeIDs over UUIDv7 from `@sdxc/typeid` and `@sdxc/uuid`, stored as the prefixed string in a
`TEXT` column: `cus_`, `ten_`, `mem_`, `dom_`. They sort by creation because the UUID behind them
does, and the prefix turns a domain id handed where a tenant id belongs into a parse error at the
edge rather than a lookup that finds nothing layers deeper. Timestamps are epoch milliseconds in
`INTEGER` columns, matching how one crosses the RPC boundary in ADR-001, so a single representation
covers both stores.

### Tables

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_connection TEXT NOT NULL DEFAULT 'polar',
  billing_customer_id TEXT,
  internal INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX customers_billing ON customers (billing_connection, billing_customer_id);
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  issuer TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'wnam',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  subscription_status TEXT NOT NULL DEFAULT 'active',
  billing_subscription_id TEXT UNIQUE,
  current_period_end INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX tenants_customer ON tenants (customer_id);
CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX memberships_tenant_subject ON memberships (tenant_id, subject_id);
CREATE INDEX memberships_subject ON memberships (subject_id);
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('platform','custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','failed')),
  certificate_status TEXT,
  verification_name TEXT, verification_value TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX domains_platform ON domains (tenant_id) WHERE kind = 'platform';
CREATE INDEX domains_tenant ON domains (tenant_id);
CREATE INDEX domains_pending ON domains (id) WHERE status = 'pending';
```

`customers.internal` marks the platform's own billing account, so billing exemption is decided in
one row. Administration is a membership row including the owner's, so "every tenant this person may
administer" is one indexed read; `subject_id` names a subject inside the platform tenant's own
object, which is why it carries no foreign key.

### Subscription state lives on the tenant

`plan`, `subscription_status`, `billing_subscription_id` and `current_period_end` are columns on
`tenants`, read on paths that already hold the tenant row, so a tier gate costs no join. The
provider's customer record stays on `customers`, so one payment identity funds every tenant that
customer owns. Add-ons are a different shape, belonging to the ADRs that introduce them.

### A deleted tenant keeps its row

Deletion sets `status = 'deleted'` and `deleted_at`; a purge after the grace window calls
`erase()` on the object to destroy its storage. The row survives that, permanently holding its
`slug` and `issuer` against reuse — relying parties are configured against an issuer and cannot be
told to forget one, so the name a tenant answered to stays spent, and one tombstone row is the
cheapest durable way to hold it. A customer row is removable once it owns no tenants; the foreign
key covers the rest.

### What the control plane calls on an object

Two whole operations, per the ADR-001 boundary rules: `provision({ tenantId, issuer })` when the
tenant row is created, applying the object's schema registry and recording the issuer, and
`erase()` from the purge job. Everything else here is a D1 read or write in the Worker.

## Consequences

### Positive

- One tenant row answers which object serves a request, under which issuer, on which store, so
  resolution is a single read whose result caches as one value.
- Ownership and membership are one table, so a dashboard listing is one indexed query, and a
  tenant id names one tenant for the lifetime of the platform.

### Negative

- Tombstone rows accumulate for as long as the platform runs, and appear in any query that omits
  the status filter.
- The issuer is written in D1 and again in the object; the two agree because it is written once at
  provision and stays fixed.
- The columns hold current subscription state, so last quarter's plan comes from the billing
  provider, and moving a tenant to another customer leaves no record that it happened.

### Neutral

- D1 enforces the foreign keys, so referential integrity is the database's job and the models above
  it make no second check; metering and cost records live in tables their own ADRs add.

## Alternatives Considered

**A `subscriptions` table keyed by tenant.** Room for history and for more than one subscription
per tenant, at the price of a join on every gate and a missing row every caller handles first.
Rejected: one subscription per tenant is the product, so it is a property of the tenant.

**The subscription on the customer.** One invoice per customer and fewer rows. It bills once for
five providers, which contradicts the pricing the platform sells. Rejected.
**Human-readable tenant ids, using the slug.** Readable logs and URLs. It derives an object name
from customer input and makes a typo at creation a permanently wrong database. Rejected: the slug
labels the row, the id addresses the storage.

**Hard-deleting a tenant row after purge.** No tombstones and a smaller schema. It frees the slug
and the issuer for a later tenant, so a relying party still configured against that issuer reaches
storage belonging to someone else. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the two stores this one is half of
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md) — why this schema is built first
- [ADR-004: Tenant Object Schema and Migrations](./ADR-004-tenant-object-schema-and-migrations.md) — the schema `provision` applies
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md) — what reads `domains`
