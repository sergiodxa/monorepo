# ADR-012: Token Endpoint and Refresh Rotation

## Status

**Proposed** - 2026-09-18

## Background

`/oauth/token` is the only place a token is minted, and the only protocol endpoint a client
reaches directly rather than through a browser. It turns the authorization code
[ADR-011](./ADR-011-authorization-endpoint-and-pkce.md) issued into an access token, an ID
token and a refresh token, and turns a refresh token into the next set. What is left to
settle is which grants it accepts, how a client proves who it is, what a refresh token's
lifetime is and how it relates to the session that created it, and what happens when a
refresh token is presented twice. The last is the interesting one: a refresh token is a
long-lived credential held by software, so the question is what the provider can tell when
one leaks. The endpoint belongs to the OIDC/OAuth2 core, so it is available on Free.

## Context

### Two grants at launch, two deferred

| `grant_type`                                    | Status                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| `authorization_code`                            | Served                                            |
| `refresh_token`                                 | Served                                            |
| `urn:ietf:params:oauth:grant-type:device_code`  | ADR-039: Device Authorization Grant, its own add-on |
| `client_credentials`                            | ADR-032: Machine-to-Machine Access and API Keys, its own add-on |

The deferred grants each carry their own storage, gate and failure modes, so each gets a
decision of its own and answers `unsupported_grant_type` until then. OAuth 2.1 specifies
neither the implicit nor the resource owner password credentials grant: the authorization
code grant with PKCE serves the clients that reached for the first, and a hosted sign-in
page serves the case that reached for the second.

### A client authenticates one way per request

| Method                | Used by                                          |
| --------------------- | ------------------------------------------------ |
| `none`                | Public clients — browser and native apps          |
| `client_secret_basic` | Confidential clients, credentials in `Authorization` |
| `client_secret_post`  | Confidential clients, credentials in the body     |

OAuth 2.1 requires a client to use no more than one method per request, so presenting both
header and body credentials is `invalid_request` rather than a fallback chain. Secrets are
stored under the single credential hash root ADR-040 fixes, and ADR-014: Clients and Client
Secrets owns their lifecycle.

### Rotation makes a stolen refresh token a detectable event

RFC 9700 gives two ways to protect a refresh token: bind it cryptographically to a client
instance, or rotate it. Sender-constraining needs mTLS or DPoP in every client, which a
general-purpose provider cannot require; rotation needs nothing from the client.

Under rotation, every refresh returns a new refresh token and invalidates the one
presented, while the relationship between them is retained. If both an attacker and the
legitimate client hold a copy, one presents an invalidated token and the provider learns of
the breach without being able to tell which party is which. That decides the response:
since the victim cannot be identified, anything that keeps either party working keeps the
attacker working. Reuse ends the whole family and the session behind it.

### A refresh token outlives an access token, not the authentication

| Value                  | Lifetime                                     |
| ---------------------- | -------------------------------------------- |
| Access token, ID token | 10 minutes                                   |
| Refresh token          | 30 days idle, 90 days absolute per family    |
| Refresh token family   | Ends when its session ends                   |

Binding the family to the session is what makes sign-out mean something: ending a session
invalidates the tokens minted from it rather than leaving a refresh token to mint new ones
for another 30 days. ADR-038: Session Policy Configuration makes these numbers
tenant-configurable on Pro and Premium; every tenant including Free gets these defaults.

## Decision

The endpoint accepts `application/x-www-form-urlencoded` and answers JSON with
`Cache-Control: no-store`, which OAuth 2.1 requires of any response carrying a token. Each
grant is one RPC call.

```ts
exchangeCode(input: {
  code: string; codeVerifier: string; redirectUri: string;
  clientId: string; clientSecret: string | null; authScheme: "basic" | "post" | "none";
  now: number;
}): TokenOutcome;

refreshTokens(input: {
  refreshToken: string; scope: string | null;
  clientId: string; clientSecret: string | null; authScheme: "basic" | "post" | "none";
  now: number;
}): TokenOutcome;

type TokenOutcome =
  | { kind: "tokens"; accessToken: string; idToken: string | null; refreshToken: string | null;
      tokenType: "Bearer"; expiresIn: number; scope: string }
  | { kind: "error"; status: 400 | 401; error: string; description: string };
```

`exchangeCode` performs the whole exchange — authenticate the client, redeem the code,
verify the challenge, mint and sign — in the single round trip ADR-001 describes. A token
is the one bearer value that crosses the boundary, because producing it is the operation;
everything else the Worker learns arrives as a resolved claim.

It redeems the code with the single statement ADR-011 specifies, then checks that the
authenticated `client_id` and the presented `redirect_uri` are the ones the code was minted
for, and that the Base64url SHA-256 of `code_verifier` equals the stored challenge.
`sha256` and `Base64Url` come from `@sdxc/crypto`; signing is ADR-010's minting method,
called inside the object so the key stays there. An unknown, expired or already-redeemed
code is `invalid_grant`, and a redeemed one also revokes the family named on its row.
`refreshTokens` accepts a narrower `scope` than the grant holds and never a wider one, per
RFC 6749 section 6, and issues a new `id_token` when the grant covers `openid`.

### Table

`refresh_tokens` holds `token_hash`, `family_id`, `parent_hash`, `client_id`, `subject_id`,
`session_id`, `scopes`, `created_at`, `expires_at`, `absolute_expires_at`, `redeemed_at`,
`revoked_at`, and stores only the digest. A refresh redeems its row with the same
`UPDATE … WHERE redeemed_at IS NULL … RETURNING *` shape the authorization code uses, so
two concurrent refreshes cannot both succeed.

A row found already redeemed runs `UPDATE refresh_tokens SET revoked_at = ? WHERE
family_id = ?`, ends the session on the family, and answers `invalid_grant` — the same
answer an expired token gets, so probing tells an attacker nothing. Rows are removed once
their family's absolute expiry has passed.

### Errors

| Code                     | Meaning here                                                |
| ------------------------ | ------------------------------------------------------------ |
| `invalid_request`        | Missing or repeated parameter, or two authentication methods  |
| `invalid_client`         | Unknown client, or a secret that fails to verify              |
| `invalid_grant`          | Code or refresh token unknown, expired, redeemed, or mismatched |
| `unauthorized_client`    | Client is not configured for the grant it asked for            |
| `unsupported_grant_type` | A grant this tenant does not serve                            |
| `invalid_scope`          | A refresh asking for scope the grant does not hold             |

Errors are HTTP 400, with the one exception OAuth 2.1 names: `invalid_client` from a client
that authenticated through the `Authorization` header is HTTP 401 carrying a
`WWW-Authenticate` header matching the scheme it used. Every successful call reports an
authentication to the meter ADR-022: Daily Active User Metering and Quotas owns, since a
token issued is one of the two events that define a DAU.

## Consequences

### Positive

- One round trip per grant, with client authentication, redemption, verification and
  signing inside the object, so no intermediate state crosses the boundary.
- A leaked refresh token is detected the first time both holders use it, and the response
  costs the attacker everything rather than a single token.

### Negative

- Reuse detection punishes the victim as well as the attacker, and a client with a buggy
  concurrent refresh will sign its users out until it is fixed.
- Rotation writes a row on every refresh, which makes refresh traffic the endpoint's
  dominant write cost, and binding a family to a session means clearing sessions broadly
  also ends background access in applications the person did not have in mind.

### Neutral

- Access tokens are JWTs signed by the tenant's key, so a resource server verifies one
  without calling the provider, and revocation before expiry is bounded by the 10-minute
  lifetime rather than immediate.

## Alternatives Considered

**Revoke only the presented token on reuse.** Gentler, and it keeps the legitimate client
working in the common case of a client-side race. Since the provider cannot tell the victim
from the attacker, it keeps the attacker working with equal probability. Rejected.

**Opaque access tokens with introspection.** Immediate revocation, at the price of a
network call from every resource server on every request and a hard dependency on this
provider's availability for someone else's API. Rejected in favour of short lifetimes.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — one round trip per operation, and what may cross the boundary
- [ADR-011: Authorization Endpoint and PKCE](./ADR-011-authorization-endpoint-and-pkce.md) — the code record and the bindings verified here
- [ADR-013: Discovery and UserInfo](./ADR-013-discovery-and-userinfo.md) — publishes the grant types and authentication methods this endpoint serves
- [ADR-015: Consent and Scopes](./ADR-015-consent-and-scopes.md) — decides which scopes a grant holds, including `offline_access`
- [ADR-010: Signing Keys and Token Minting](./ADR-010-signing-keys-and-token-minting.md) — the minting method called inside the object
- [ADR-014: Clients and Client Secrets](./ADR-014-clients-and-client-secrets.md) — owns client secrets and the methods each client may authenticate with
