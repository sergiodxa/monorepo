# ADR-005: Hostname Resolution and Tenant Domains

## Status

**Proposed** - 2026-09-18

## Background

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) gives the Worker the job of
turning an inbound request into a tenant object stub, and assigns hostname to tenant resolution to
a KV cache over the D1 control plane. [ADR-003](./ADR-003-control-plane-schema.md) supplies what
that cache holds: a `domains` row per hostname, and the tenant's `issuer`, `region` and `store`.

The bindings for it are declared: `HOSTNAMES_KV` for the cache, `PLATFORM_DB` for the control
plane, the `TENANT` Durable Object namespace, and routes covering the platform apex, the wildcard
subdomain beneath it, and the platform's own same-zone hostnames.

This ADR settles what hostnames a tenant has, what its issuer is and why that answer is permanent,
what the cache holds and when it is dropped, what a miss and an unknown hostname cost, and how a
customer's own domain is verified and gets a certificate.

## Context

### Resolution happens on every request

`/authorize`, `/oauth/token`, `/userinfo` and `/.well-known/*` all arrive on a tenant's hostname,
and none of them can start until the hostname has a tenant. It is the first work of every request,
so the budget for it is one cached read, and one database read on the rare occasion the cache is
cold.

A hostname registered through Cloudflare for SaaS arrives with `request.cf.hostMetadata` already
carrying the `tenant_id` written when it was registered, so it resolves with no lookup at all. The
platform subdomains and the platform's own same-zone hostnames are served by the zone's route and
carry no metadata, and those are what the cache exists for.

### An issuer is a promise

The issuer appears in every token the tenant mints, in the discovery URL relying parties fetch,
and in the configuration of every application integrated against it — much of it in software the
tenant's customers control. OIDC puts the discovery document at the issuer plus
`/.well-known/openid-configuration`, so the hostname the issuer names has to keep answering for as
long as the tenant exists.

### Hostnames the platform does not serve reach it anyway

A wildcard DNS record, a CNAME a former customer left pointing here, a scanner walking the zone.
Each of those is a request whose hostname belongs to no tenant, and each would be a control-plane
query if the only thing cached were successes.

## Decision

### Every tenant gets a platform subdomain

Tenant creation writes a `kind = 'platform'` domain row for `{slug}.{PLATFORM_DOMAIN}`, active
immediately: the wildcard route and its certificate already cover it, so there is no DNS step and
no wait. The slug is fixed at creation, because the subdomain it forms is the issuer.

### The issuer

A tenant's issuer is `https://` plus its platform subdomain, written once into the tenant row and
copied into the object's settings by `provision` ([ADR-004](./ADR-004-tenant-object-schema-and-migrations.md)).
A tenant created on Pro or above may name a custom domain at creation and take its issuer from
that instead, and then begins serving once that domain's certificate issues. Either way the choice
is made once and holds for the life of the tenant, and the tombstone row a deleted tenant leaves
behind keeps the name spent.

A custom domain attached later serves the same tenant and advertises the same issuer, and the
platform subdomain keeps resolving for every tenant that has one, so the discovery document stays
reachable at the URL relying parties derive from the issuer they were configured with.

### Custom domains are Pro and above

Attaching one is gated on the tenant's entitlement, evaluated where the dashboard accepts the
domain. A tenant whose plan lapses keeps the domains already attached, because detaching one moves
a live issuer out from under working integrations; whether a tenant serves at all while its
subscription is unpaid is what suspension governs.

### Verification and certificate

Attaching a domain calls `HostnameClient.create(hostname, tenantId)` from `@sdxc/hostname`, which
registers a Cloudflare for SaaS custom hostname asking for a DV certificate validated over TXT,
tags it with `tenant_id` as custom metadata, and returns the TXT record to publish. The row is
written `pending` with `verification_name` and `verification_value`.

The customer publishes two records: that TXT, proving they own the name, and a CNAME from their
hostname to the tenant's platform subdomain, so requests arrive at the zone. An apex domain needs
its provider's CNAME flattening, so the dashboard suggests a subdomain such as
`auth.customer.example`.

Progress is read with `client.status(id)`: the dashboard refreshes the row when the page is
opened, and the daily cron walks the pending index. `HostnameClient.isActive` promotes the row to
`active` and records `certificate_status`; an attempt still pending after seven days becomes
`failed`, and the customer may attach the domain again. Removing a domain deletes the Cloudflare
hostname and the row, treating a 404 from the API as the domain already being gone.

### The cache

The key is `host:v1:{hostname}`, with the hostname lowercased, in its ASCII form, without a port.
The value is everything the request needs:

```json
{ "tenantId": "ten_01j…", "region": "wnam", "issuer": "https://acme.auth.example" }
```

One read yields the stub's name, its location hint, and the issuer absolute URLs are built
from. The version in the key prefix means a change to that shape
ships as a new prefix and the old entries expire unread.

Entries live 300 seconds. Every write that changes an answer deletes the key outright: a domain
activated or removed, a tenant suspended, resumed or deleted.
The short lifetime is what covers an invalidation that was missed.

### A miss, and a hostname with no tenant

A miss reads D1 once, joining `domains` to `tenants` for an active domain on a tenant that is not
deleted, writes the entry, and continues. Suspended tenants resolve: suspension is answered inside
the request, which keeps the management surface reachable and lets a reinstated tenant serve
immediately rather than waiting out a cache entry.

A hostname that matches nothing is cached too, as `{ "miss": true }` for 60 seconds, which holds a
flood of unknown hostnames to one database read per hostname per minute. Activating a domain
deletes any tombstone under its name, so a domain going live normally waits for nothing. The
request itself is answered `404` by the Worker, with no object woken.

### RPC surface

Resolution adds no method to the tenant object: it is the Worker, KV and D1 throughout. The only
call on this path is the `provision({ tenantId, issuer })` ADR-003 already makes, and the issuer it
records is what the object's tokens and discovery document carry.

## Consequences

### Positive

- The hot path is one KV read, and a custom hostname carrying its metadata needs none.
- Unknown traffic costs one control-plane read per hostname per minute however loudly it arrives.
- A relying party configured against a tenant's issuer keeps working for the life of that tenant.

### Negative

- A tenant that adopts a custom domain after creation keeps its platform issuer; aligning the two
  means a new tenant and a subject migration.
- A hostname's answer has two possible sources, metadata or the cache, so a resolution question
  starts by establishing which one served it.
- A missed invalidation serves a stale answer for up to five minutes, or one minute where the
  cache holds a tombstone.
- The slug is fixed, so a customer who renames their product keeps the old name in their issuer.

### Neutral

- Every tenant's platform subdomain keeps resolving whether or not a custom domain is attached.
- Certificate issuance and renewal belong to Cloudflare; the platform stores the status it reports
  and shows it to the customer.

## Alternatives Considered

**Reading D1 on every request.** No cache, no invalidation, and one place to look when a hostname
resolves oddly. It also puts a database query in front of every authorization and every token
exchange, making the control plane the availability floor of every tenant's provider. Rejected.

**A long TTL with expiry as the only invalidation.** Fewer writes and simpler model code. A
suspended tenant would keep serving, and a newly attached domain would stay dark, for as long as
the TTL runs. Rejected: the events that change an answer are few and all of them are writes the
platform already makes.

**Treating the subdomain label as the tenant id.** Resolution becomes string handling with no
lookup at all. It gives the subdomain authority over which object is addressed, which ADR-003
withholds from customer input, and it answers nothing for custom domains or suspension.
Rejected.

**Letting the issuer follow the tenant's current primary domain.** A tenant could adopt its own
domain as its issuer at any time. Every live token, every cached discovery document and every
client configuration breaks at the moment of the change. Rejected: an issuer that can move is not
an identifier.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — assigns this resolution to KV over D1
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md) — where this sits in the build order
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — the `domains` table and the tenant's issuer
- [ADR-004: Tenant Object Schema and Migrations](./ADR-004-tenant-object-schema-and-migrations.md) — where `provision` puts the issuer
- ADR-020: Entitlements as Feature Flags — the evaluation point the custom-domain gate reads
