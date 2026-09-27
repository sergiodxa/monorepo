# ADR-042: RS256 ID Token Signing

## Status

**Accepted** - 2026-09-26

## Background

OpenID Connect Discovery 1.0 §3 requires `RS256` in `id_token_signing_alg_values_supported`, and
Core §15.1 makes RS256 the one algorithm every relying party library is expected to verify. Each
tenant's discovery document lists only `ES256`, so a strict client refuses the provider, and a
relying party built on a library without ECDSA support cannot use it at all.

Advertising RS256 is only honest if a tenant signs with it. OIDC Dynamic Client Registration §2
gives a client the switch: `id_token_signed_response_alg`, defaulting to RS256 in that spec.

## Context

[ADR-010](./ADR-010-signing-keys-and-token-minting.md) stores each key as a `signing_keys` row
with its own `alg` column and runs one rotation over the table: at most one row is signing at a
time, and every token (access, ID, client credentials) is signed with it. ADR-010 anticipated an
RS256 tenant as "a key change rather than a schema change", but its rotation assumes a single
signing key, so an RS256 key would replace the ES256 one instead of sitting beside it.

Access tokens are this platform's own format, verified by its own `/userinfo`, introspection and
management API, which all pin `ES256`. Only the ID token is read by code outside the platform.

## Decision

### One signing key per algorithm

A tenant holds a signing ES256 key and a signing RS256 key at the same time. The rotation from
ADR-010 (staged 24 hours, signing 90 days, retired 7 days) runs independently per algorithm:
"the signing key" becomes "the signing key for this `alg`", and staging a successor keeps the
incumbent's algorithm. Both keys appear in the JWKS under their own `kid`. No schema change is
needed for keys; the `alg` column already exists.

Provisioning generates both keys. An existing tenant gains its RS256 key from the daily
`advanceSigningKeys` run, or inline the first time an RS256 client needs an ID token, whichever
comes first; the JWKS is read from the object on every request, so a verifier that meets the new
`kid` finds it.

### The client chooses the ID token algorithm

`clients.id_token_signed_response_alg` (tenant migration `0036`) is `ES256` or `RS256`,
defaulting to `ES256` so every existing client keeps the tokens it verifies today. The management
API accepts `idTokenSignedResponseAlg` on register and update, and returns it on every client
record. Minting signs the ID token with the signing key for the client's algorithm.

Access tokens, client-credentials tokens and management tokens stay ES256.

### Discovery

`id_token_signing_alg_values_supported` lists `ES256` and `RS256`.

## Consequences

### Positive

- **Discovery conforms** - OIDC Discovery §3's RS256 requirement holds for every tenant
- **Any relying party library works** - a client registered for RS256 needs no ECDSA support
- **No behavior change for existing clients** - the default keeps ES256 ID tokens

### Negative

- **Two keys to rotate per tenant** - twice the rotation work, and RSA-2048 generation costs
  more CPU than P-256, paid once per 90 days per tenant (or once inline on first use)
- **Larger JWKS** - the RSA public key adds roughly 400 bytes to the document

### Neutral

- **The Dynamic Client Registration default differs** - DCR defaults the member to RS256; this
  platform defaults to ES256 because it has no dynamic registration and its existing clients
  expect ES256

## Alternatives Considered

### 1. Switch every tenant to RS256

**Rejected because**: every deployed relying party verifying ES256 would break at the switch,
and ES256 signatures keep tokens smaller.

### 2. Per-tenant algorithm choice

**Rejected because**: the relying parties of one tenant differ in what they verify; the choice
belongs to the client, which is where OIDC registration puts it.

## References

- [OpenID Connect Discovery 1.0 §3](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata)
- [OpenID Connect Dynamic Client Registration 1.0 §2](https://openid.net/specs/openid-connect-registration-1_0.html#ClientMetadata)
- [ADR-010: Signing Keys and Token Minting](./ADR-010-signing-keys-and-token-minting.md)
- [ADR-083: Well-known URIs Package](../ADR-083-well-known-package.md)

## Current Progress

- [ ] Per-algorithm rotation, RS256 key generated at provisioning and on first use
- [ ] `id_token_signed_response_alg` on clients, migration `0036`, management API fields
- [ ] ID tokens signed per client; discovery lists both algorithms
