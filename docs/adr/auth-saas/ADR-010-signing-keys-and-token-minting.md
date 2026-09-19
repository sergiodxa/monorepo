# ADR-010: Signing Keys and Token Minting

## Status

**Proposed** - 2026-09-18

## Background

A tenant is its own issuer. Every ID token and access token it hands a relying party is worth
exactly what its signing key is worth, and a relying party's only way to check either is to fetch
the tenant's published key set and verify against it.

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) settles custody in one line:
private keys stay in the tenant object, and minting is a method on it. It leaves the mechanism
open — what a key record holds, how the first comes into being, how one is replaced without
breaking a token in flight, how the public half reaches the Worker, and what a minted token says.
This is a base capability, on every tier including Free.

## Context

### The private half has one home, and one list of things that can use it

Keeping the key inside the object is worth something only if nothing returns it. No method's
return type mentions the private column, so a compromised Worker path reaches the operations that
path invokes and gains no ability to mint. The one key-shaped value that crosses is a
`jose.JSONWebKeySet`, which `JWK.toJSON` from `@sdxc/jwt` builds from public parameters alone.

### A verifier has to know a key before a token names it

A relying party fetches the key set and holds it. A key that signs the moment it is generated gets
named by tokens reaching verifiers that still hold the older document, and those tokens fail for
reasons nobody can reproduce. So a key is published before it signs and stays published after it
stops, with each window wider than the caching it has to outlive.

### Generation runs inline, under a request-shaped CPU limit

The first key is minted while a tenant is created, every later one while a scheduled job runs.

| Algorithm | Generation | Signature | Notes |
| --- | --- | --- | --- |
| ES256 | Milliseconds | 64 bytes | P-256 is available everywhere Web Crypto is |
| RS256 | Seconds at 2048 bits | 256 bytes | The most widely implemented in relying-party libraries |

### An access token is either a claim or a question

ADR-001 budgets zero round trips for `/userinfo` and discovery, on the strength of verifying a
signature against cached keys. An opaque token withdraws that: every protected call becomes an
introspection request into the tenant object. A self-contained token keeps the budget and pays in
revocation latency, a number that can be chosen.

## Decision

### The key record

```sql
CREATE TABLE signing_keys (
  id TEXT PRIMARY KEY,          -- the UUID `JWK.generateKeyPair` mints; published as the `kid`
  alg TEXT NOT NULL,            -- "ES256"
  public_key TEXT NOT NULL,     -- SPKI PEM
  private_key TEXT NOT NULL,    -- PKCS#8 PEM; no method returns this column
  created_at INTEGER NOT NULL,  -- epoch milliseconds throughout
  signing_from INTEGER,         -- null while staged
  retired_at INTEGER,           -- when it stopped signing
  publish_until INTEGER         -- when it leaves the published set
);
```

Those timestamps carry the state: **staged** (published, not signing), **signing** (one row at a
time), **retired** (published, no longer signing); a row past `publish_until` is deleted.
`JWK.generateKeyPair` returns exactly these values, so a pair stores as plain columns, and
`JWK.importKeyPair` turns the rows back into the `JWK.KeyPair[]` that signing and publication take
— cached per object instance, since each call imports two keys.

### ES256, generated at tenant creation

A tenant signs with ES256, advertised as the sole entry in
`id_token_signing_alg_values_supported` so a relying party negotiates from the discovery document
rather than from an assumption. P-256 generates fast enough to sit inside tenant creation, and a
64-byte signature keeps an ID token small enough to travel in a form post. The algorithm is a
column rather than a constant, so a tenant whose relying parties need RS256 is issued one through
the same rotation: a key change rather than a schema change.

The provisioning operation generates the first pair inside the object, in the call that applies the
schema and before the hostname resolves to anything, so a tenant is never in a state where
`/authorize` answers and nothing can sign. That first key is staged and signing at once, since no
verifier holds a document for a tenant that has issued nothing.

### Rotation

| Phase | Default | What the key is |
| --- | --- | --- |
| Staged | 24 hours | Published, not yet signing |
| Signing | 90 days | The one key `sign` picks |
| Retired | 7 days | Published so its tokens keep verifying |

Staging is a day against a published cache lifetime of an hour; retirement is a week against an
access token that lives an hour. Both are wide deliberately: a key published too long lengthens the
use of one already stolen, one published too briefly fails tokens at a relying party nobody here
controls.

`advanceSigningKeys(input)` performs every transition due at the given time — stage a successor,
promote a staged key and retire the incumbent, delete rows past `publish_until` — and returns the
resulting key set. It is idempotent and safe to call when nothing is due, which lets a daily job
page tenants and call it on each without tracking where the run stopped.

### Publication

`advanceSigningKeys` and provisioning both return the tenant's `jose.JSONWebKeySet`, and the
Worker writes it to KV beside the hostname resolution cache. `/.well-known/jwks.json` and the
discovery document are then served from KV with no call to the object, under a `max-age` of one
hour — the cache lifetime the staging window is sized against. `publishKeySet(input)` re-renders
the set for a KV entry that is missing or being repaired.

### Minting

Tokens are built with `@sdxc/jwt`: a `JWT` subclass per kind, signed with
`sign(JWK.Algorithm.ES256, keys)`, which writes the signing key's `kid` into the header beside
`alg` and `typ`. The methods that mint — `exchangeCode` and the refresh exchange, owned by the
token endpoint — return compact serialized strings, so the object returns signed output and never
the means to sign.

The ID token, `exp` ten minutes out because it is consumed at the exchange and accepted as an
`id_token_hint` afterwards:

| Claim | Value |
| --- | --- |
| `iss` | The tenant's issuer |
| `sub` | The subject id |
| `aud`, `azp` | The client id; `azp` appears when `aud` names more than one |
| `auth_time` | The session's last full authentication |
| `nonce` | Echoed when the authorization request carried one |
| `amr` | The authentication methods the session records |
| `sid` | The session record id, which is not the session's cookie token |
| Profile and email claims | Those the granted scopes carry |

The access token is a JWT with `exp` an hour out, `aud` naming the tenant's own userinfo endpoint
unless the request asked for another resource, and `jti`, `client_id`, `scope` and `sid` beside the
registered claims. `jti` is what the audit log records and what makes a replayed token
identifiable. Shortening either lifetime is a *Session Policy Configuration* setting.

### Tenant-scoped custom claims

A tenant declares extra claims in a `custom_claims` table: the name, the subject attribute it
reads, whether it lands in the ID token, the access token or both, and the scope that has to be
granted for it to appear. The object refuses a name colliding with a registered claim or one this
design mints and requires the rest to be namespaced as a URI, so configuration cannot redefine
`sub` or `scope`. Sixteen claims and four kilobytes of payload is the cap, which keeps a token
inside the header limits of the servers it passes through.

### RPC methods

- `advanceSigningKeys(input)` — every transition due at the given time, plus the resulting keys.
- `publishKeySet(input)` — the current public key set, for refilling the KV entry discovery reads.
- `setCustomClaims(input)` — replaces a tenant's claim declarations as one set, names and caps
  validated inside the object.

## Consequences

### Positive

- The operations that can use a tenant's private key are this object's method list, and none of
  them hands it back, so a flaw on a Worker path costs the operations that path reaches.
- Discovery and `/userinfo` cost no round trip: verification runs against keys cached in the Worker.
- A rotation is one idempotent call, and a relying party holding a stale key set verifies through
  it because the key it knows stays published.

### Negative

- A self-contained access token stays valid until it expires, so revoking a session reaches a
  resource server only after that hour; the refresh token is revoked at once, which bounds it.
- A tenant whose relying parties implement only RS256 needs a key change before onboarding, a
  conversation rather than a setting.
- Every tenant object holds key material, so the number of places a private key exists grows with
  the customer count, and the rotation job touches each on a schedule whether it is in use or not.

### Neutral

- Private keys are stored as PEM in the object's SQLite, whose encryption at rest is the platform's.
- Key lifetimes are fixed for every tier: a security property rather than something sold.

## Alternatives Considered

**RS256 as the tenant algorithm.** The widest relying-party support, and the safest default for
an unknown integration. It costs seconds of CPU inside a request to generate and a signature four
times the size on every token. Rejected as the default, kept reachable through the `alg` column.

**Opaque access tokens with an introspection endpoint.** Immediate revocation and no claims on
the wire. Every protected API call becomes a round trip into the tenant object, making it a
dependency of a customer's own request path. Rejected in favour of a short lifetime.

**Envelope-encrypting the private key with a secret from the environment.** A stolen storage
snapshot would then be insufficient alone. The object holding the ciphertext also holds the binding
that decrypts it, so whoever reaches one reaches the other. Rejected as work removing no attacker.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — private keys stay in the object; minting is a method on it
- [ADR-009: Sessions](./ADR-009-sessions.md) — the session id published as `sid`, and `auth_time`
- ADR-012: Token Endpoint and Refresh Rotation — the methods that call the signer
- ADR-013: Discovery and Userinfo — serves the published key set from KV
