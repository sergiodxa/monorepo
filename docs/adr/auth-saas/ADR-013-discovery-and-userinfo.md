# ADR-013: Discovery and UserInfo

## Status

**Proposed** - 2026-09-18

## Background

Four public read-only surfaces describe a tenant to the clients that use it:
`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, the JWKS
document the first two point at, and `/userinfo`. Every SDK fetches the first on startup
and the third on every unknown key, and `/userinfo` is called once per sign-in by most
clients and once per page by the careless ones.

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) budgets zero object round
trips for all four. That is a constraint to be earned rather than an observation: it holds
only if what is cached, how it is keyed, and what invalidates it are decided, and only
under conditions this ADR has to state honestly. These endpoints belong to the OIDC/OAuth2
core, so they are available on Free.

## Context

### Two metadata documents describe one server

| Document                     | Required fields                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `openid-configuration`       | `issuer`, `authorization_endpoint`, `jwks_uri`, `response_types_supported`, `subject_types_supported`, `id_token_signing_alg_values_supported` |
| `oauth-authorization-server` | `issuer`, `authorization_endpoint`, `token_endpoint`, `response_types_supported`                                                               |

Both are served, because an OAuth client that has never heard of OIDC looks for the second
and an OIDC client for the first, and both are built from one set of tenant facts, so they
agree by construction.

Both specifications require the `issuer` in the document to equal the issuer used to build
the request URL, and OIDC requires it to equal the `iss` claim in issued tokens. A tenant's
issuer is `https://<its hostname>` with no path component, so both documents sit at the
root well-known path and RFC 8414's rule for inserting the well-known segment ahead of an
issuer's path never comes into play.

Beyond the required fields each advertises what the tenant serves: `grant_types_supported`,
`token_endpoint_auth_methods_supported`, `code_challenge_methods_supported` as `["S256"]`,
`scopes_supported` from the tenant's catalog, `claims_supported`, `userinfo_endpoint`.

### The documents change on events, not on a clock

| Document                | Changes when                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| Both metadata documents | A hostname changes, the scope catalog changes, an add-on activates a grant |
| JWKS                    | A signing key is published, retired, or rotated                            |

Each of those is an operation somebody performs, so each purges what it invalidated; a
time-to-live is the weaker second mechanism, bounding how long a missed purge stays wrong
rather than being how correctness is achieved.

Key rotation has to be ordered rather than merely purged. A new key appears in the JWKS
document and the caches are purged before the first token it signs exists, so no relying
party meets a `kid` it cannot resolve, and a retired key stays in the document until every
token it signed has expired.

### `/userinfo` is a signature check and a claims lookup

The signature half genuinely costs nothing: an access token is a JWT signed by the tenant's
key, and the Worker verifies it against a cached public key.

The claims half is the honest part: the claims live in the object, they change when a
person edits their profile, and a signature proves nothing about how current they are. So
claims are cached too — written by the object, read by the Worker — and zero round trips
holds under four conditions:

| Condition                                                    | What forces a call when it fails         |
| ------------------------------------------------------------ | ---------------------------------------- |
| The token's `kid` is in the Worker's cached key set          | A fetch of the tenant's public documents |
| A claims snapshot exists for the subject                     | `resolveUserInfo`                        |
| The granted scopes map to claims the snapshot carries        | `resolveUserInfo`                        |
| No `sid` on the token appears in the revoked-session markers | The request is rejected, not resolved    |

## Decision

### What the object publishes

```ts
publishMetadata(input: { now: number }): {
  openidConfiguration: Record<string, unknown>;
  oauthMetadata: Record<string, unknown>;
  jwks: { keys: Array<Record<string, unknown>> };
  version: string;
  maxAge: number;
};

resolveUserInfo(input: { subjectId: string; scopes: string[]; now: number }):
  | { kind: "claims"; claims: Record<string, unknown> }
  | { kind: "unknown" };
```

`publishMetadata` renders all three documents in one call, so a cold cache costs one round
trip rather than three, and returns public key material only — the private half stays in
the object as ADR-001 requires. `resolveUserInfo` takes a subject id the Worker read from a
verified token, never the token itself, and refreshes the snapshot as it answers.

### What the Worker caches

| Entry                    | Key                                    | Tag                | Purged by                                        |
| ------------------------ | -------------------------------------- | ------------------ | ------------------------------------------------ |
| The three documents      | The request URL on the tenant hostname | `tenant:<id>:meta` | Key rotation, hostname or catalog change         |
| Parsed verification keys | Tenant id and `kid`, in-isolate        | —                  | Isolate lifetime and the tag above               |
| Claims snapshot          | `uinfo:<tenantId>:<subjectId>` in KV   | —                  | Written on every claim change                    |
| Revoked session markers  | `sid` in KV                            | —                  | Written on revocation, expiring with the session |

Cache entries and their tags come from `@sdxc/workers-cache`, whose `Cache-Tag` vocabulary
and purge call are what makes an event-driven invalidation expressible. Documents are
served with `Cache-Control: public, max-age=300` and an `ETag`, so intermediaries and SDKs
hold them too.

The KV entries are eventually consistent, which is the real cost: a profile edit reaches
every region within seconds, and a revoked session can be honoured at `/userinfo` for the
same window. The 10-minute access token lifetime bounds revocation to a similar scale, so
this adds no new class of staleness. ADR-009: Sessions writes the revocation marker.

### What `/userinfo` returns

It accepts GET and POST with the access token as a Bearer token in the `Authorization`
header, and answers `application/json`. The `sub` claim is always present, which OIDC
requires so a client can confirm the response describes the subject its ID token named.

| Scope            | Claims returned                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openid`         | `sub`                                                                                                                                                                            |
| `profile`        | `name`, `family_name`, `given_name`, `middle_name`, `nickname`, `preferred_username`, `profile`, `picture`, `website`, `gender`, `birthdate`, `zoneinfo`, `locale`, `updated_at` |
| `email`          | `email`, `email_verified`                                                                                                                                                        |
| `address`        | `address`                                                                                                                                                                        |
| `offline_access` | None; it governs refresh token issuance                                                                                                                                          |

The OIDC `phone` scope is not offered, and `phone_number` is not a claim a subject can
hold. A phone number is not an identifier here, not a factor and not a delivery channel:
the verified mailbox is the ownership credential, and carrying numbers would add a carrier
attack surface and a per-message cost that buy nothing.

A missing or invalid token is 401 with a `WWW-Authenticate: Bearer` challenge; a valid
token whose grant lacks `openid` is 403 with `insufficient_scope`.

## Consequences

### Positive

- Discovery, JWKS and `/userinfo` are served from the Worker in the steady state, so the
  highest-traffic endpoints add no load to a tenant's object.
- One call renders all three documents, and invalidation is tied to the operation that
  caused it, so a document is stale for as long as a purge takes rather than for a TTL.
- Publishing a key before signing with it means no client meets an unresolvable `kid`.

### Negative

- Correctness now depends on every mutation purging or rewriting what it invalidated, and a
  new mutation path that forgets produces a stale document with nothing failing.
- The claims snapshot duplicates subject data outside the tenant object, which widens the
  blast radius of a KV misconfiguration beyond the isolation ADR-001 is built on, and
  `/userinfo` can answer from a snapshot seconds behind a profile edit or a revocation.

### Neutral

- Tenant-defined scopes appear in `scopes_supported` and resolve through `resolveUserInfo`
  rather than from the snapshot, so they cost a round trip by design, and dynamic client
  registration is absent, so `registration_endpoint` is omitted.

## Alternatives Considered

**Carry the claims inside the access token.** `/userinfo` becomes a pure signature check
with no second cache. It also puts profile data in a bearer token that every resource
server sees and logs, and freezes the claims for the token's lifetime. Rejected.

**Call the object on every `/userinfo` request.** Always current, and one less cache to
invalidate. It also makes the busiest endpoint a per-request write to a single-threaded
object, which is the load pattern the caching exists to avoid. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the round-trip budget these endpoints are held to
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md) — issues the access tokens `/userinfo` verifies
- [ADR-015: Consent and Scopes](./ADR-015-consent-and-scopes.md) — owns the scope catalog `scopes_supported` publishes
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md) — settles the issuer value and purges on a hostname change
- [ADR-010: Signing Keys and Token Minting](./ADR-010-signing-keys-and-token-minting.md) — publishes and retires the keys in the JWKS document
