# ADR-032: Machine-to-Machine Access and API Keys

## Status

**Proposed** - 2026-09-18

## Background

Every capability so far serves a person: a subject signs in, a session is created, a token is
minted about them. A tenant's estate also contains callers that are not people — a nightly job
reconciling invoices, a service calling a sibling service, a partner's backend pulling records.

Two different things answer that, and a tenant needs both. The OAuth2 client credentials grant
gives a service registered in the tenant a short-lived access token it obtains for itself. An API
key is a long-lived opaque credential a tenant issues to *its own* end users, so a customer of the
tenant can script against the tenant's API without driving a browser flow.

This is the **Machine-to-Machine Access and API Keys** add-on at $29 per tenant per month, on top
of any tier including Free. Its feature slug is `machine_access`, evaluated as
`entitlement.machine-access` through `ctx.flags` in the Worker.

## Context

### A client credentials token is about a client, not a person

There is no subject, so there is no session, no consent screen, no `auth_time` and no ID token.
The access token's `sub` is the client id, which is what a resource server keys its own
authorization on. The grant belongs to a confidential client, because the whole of its security is
the secret.

### An API key is verified on every request, inside a single-threaded object

A client secret is checked once per token request, so it carries a deliberate key-derivation cost.
An API key is presented on every call the tenant's API serves, and verifying it runs in the
tenant's Durable Object, which is single-threaded. A work factor there is paid by every request
the tenant serves and by everything queued behind it.

The way out is the structure of the value rather than a cheaper hash. The key carries the id of
its own row, so the row is *found* rather than searched, and the secret half is 256 bits the
platform generated. That is the reasoning the session token and the recovery code are stored
under: a search that cannot be walked gains nothing from being slowed, so storage keeps a SHA-256
digest compared in constant time.

### One object instance makes an in-memory cache coherent

A tenant's object is one instance, and every write to `api_keys` goes through it. A map from key
id to the verification facts therefore lives on the instance and is updated by the same call that
revokes a key, so a warm object verifies with no storage read and a revocation takes effect at
once.

### What machine traffic costs to serve

A client credentials issuance is one Worker request, one object request and one signature, with no
row written — under a sixth of a modelled active-user day. A million issuances in a month sit at a
few dollars against the add-on's $29. Metering here exists to make that legible and to make an
abusive tenant visible, not to protect a margin.

## Decision

### Client credentials at the token endpoint

`grant_type=client_credentials` is one RPC call, answering the `TokenOutcome` shape *Token
Endpoint and Refresh Rotation* defines.

```ts
issueClientCredentialsToken(input: {
  scope: string | null; resource: string | null;
  clientId: string; clientSecret: string; authScheme: "basic" | "post";
  now: number;
}): TokenOutcome;
```

The object authenticates the client against every live secret, requires `client_credentials` on
its grant list, intersects the requested scope with the client's registered ceiling, and mints an
access token whose `sub` and `client_id` are the client id, whose `aud` is the named resource or
the tenant's own userinfo endpoint, and whose `scope` is the intersection. Scope outside the
ceiling is `invalid_scope` rather than a quiet narrowing, so a misconfiguration is visible at the
caller.

The token lives an hour and no refresh token is issued, because the client holds the credential
that mints another; the documented practice is to cache it until shortly before expiry.
`client_secrets.last_used_at` is stamped at most once a minute, so a busy client writes a row an hour.

### The API key record

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,             -- akey_… TypeID; the segment carried in the presented value
  subject_id TEXT NOT NULL,        -- the end user the key acts as
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,       -- SHA-256 of the secret segment, hex
  hint TEXT NOT NULL,              -- last four characters, so a dashboard tells two apart
  scopes TEXT NOT NULL,            -- JSON array, bounded by what the subject holds
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  last_used_at INTEGER, revoked_at INTEGER, revoked_reason TEXT
);
CREATE INDEX api_keys_by_subject ON api_keys (subject_id, created_at DESC);
CREATE INDEX api_keys_by_expiry ON api_keys (expires_at);
```

A key is presented as `{prefix}_{id}_{secret}`. The prefix is chosen once per tenant from two to
twelve lowercase characters and fixed after, so it is a literal a secret scanner matches and a
reader recognizes in a log; `id` is the record's TypeID suffix, which locates the row; and
`secret` is `randomToken({ bytes: 32 })` from `@sdxc/crypto`, returned once by the operation that
mints it. Every key carries an expiry, defaulting to 90 days and capped at 365, because a
credential with no end date is one nobody revisits.

Scopes are per key and bounded by the scopes the issuing subject holds, so a key narrows an
existing authorization rather than creating a new one.

### Verification, rotation and revocation

The tenant's backend verifies a presented key at a client-authenticated endpoint on the tenant's
hostname, which answers the resolved subject, scopes and expiry — a verified claim rather than the
credential it was resolved from. `rotateApiKey` mints the successor and stamps `expires_at` on the
incumbent, seven days out by default and thirty at most, so a fleet updates over a window with
both keys live. `revokeApiKey` closes a key at once and updates the instance map in the same call,
and blocking or deleting a subject revokes every key it holds inside the operation that does it.

### RPC methods

- `createApiKey({ subjectId, name, scopes, expiresAt, actor })` — validates the scopes against the
  subject, mints, writes, returns the record and the one-time value.
- `authenticateApiKey({ presented, now })` — parses the value, resolves the row by its id segment,
  compares the digest in constant time, enforces expiry, revocation and subject status, stamps
  last use at most once a minute, and answers the subject and scopes it resolved.
- `rotateApiKey({ keyId, overlap, actor })` / `revokeApiKey({ keyId, reason, actor })`.
- `listApiKeys({ subjectId, cursor, limit })` — a page for the account screen and the management
  API, with `created_at` and `id` in the projection so the cursor is minted from the returned row.
- `sweepExpiredApiKeys({ before, limit })` — bounded deletes from the scheduled handler.

### Where the gate lands

Paid capabilities lapse at the administrative write, so `entitlement.machine-access` is evaluated
where a key is created or rotated, where a tenant's prefix is registered, and where
`client_credentials` is written onto a client's grant list. Issuing a token to a client that
already carries the grant and verifying a key already issued are protocol surface and keep serving
a lapsed tenant, alongside every other authentication *Per-Tenant Subscriptions* keeps running.

### Metering

An API key authentication counts its subject toward the day's active users, because it is that
person authenticating by another means. A client credentials token counts nothing, because no
subject exists to count. The add-on's $29 is the whole charge for machine traffic.

## Consequences

### Positive

- One flat price covers machine traffic, so a tenant automating heavily is not billed by the
  token, which is where this pricing differs most visibly from the market.
- Verification is a row lookup and a constant-time compare, so a key on the hot path costs about
  what a session lookup does.

### Negative

- An API key is a bearer credential with a long life, which is weaker than an authorization code
  exchange, and it is offered because scripting against a browser flow is worse.
- The instance map is per object instance, so a cold object pays one storage read per key, and the
  map grows with the number of distinct keys used in that instance's lifetime.
- Client credentials tokens are unmetered, so that traffic is bounded by rate limiting alone, and
  a tenant's key prefix is fixed once chosen.

### Neutral

- A client credentials token carries no `sid` and no `amr`, so a resource server telling machine
  traffic from human traffic reads the absence of a subject claim.
- Two credential kinds is two revocation stories a customer learns, which is why the dashboard
  lists both on one screen.

## Alternatives Considered

**One credential kind, with API keys as non-expiring access tokens.** Fewer concepts and one
verification path. A JWT cannot be revoked before its expiry without a lookup on every request,
which is the lookup an API key already is, and a long-lived JWT leaks its claims to whoever reads
it. Rejected: the two have different lifetimes and different owners.

**Hashing API keys with the repo's credential hash.** Consistent with client secrets and password
credentials, and it needs no argument about entropy. It puts a deliberate key derivation on every
request the tenant's API serves, inside a single-threaded object, for a secret no search can walk.
Rejected in favour of a digest over a value the platform generated.

**Metering machine tokens per issuance.** It is what the market does, and it turns automation into
revenue. It also prices the cheapest operation the platform performs as though it were the most
expensive, and makes a tenant's integration cost unpredictable. Rejected: the add-on is flat.

**API keys scoped to the tenant rather than to a subject.** Simpler to issue, and right for a
service acting for nobody — which is the client credentials grant, and already exists. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole operations, and verified claims over bearer values
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md) — the `TokenOutcome` shape and the endpoint this grant joins
- [ADR-014: Clients and Client Secrets](./ADR-014-clients-and-client-secrets.md) — the client record, its grant list, and the rotation window this follows
- [ADR-018: Per-Tenant Subscriptions](./ADR-018-per-tenant-subscriptions.md) — what a lapsed subscription keeps serving
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the `machine_access` slug and its price
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how the gate is evaluated
- [ADR-022: Daily Active User Metering and Quotas](./ADR-022-daily-active-user-metering-and-quotas.md) — what counts as an active user
