# ADR-181: Operator Free Pass on `api.sdxc.dev`

## Status

**Accepted** - 2026-10-28

## Background

[ADR-180](./ADR-180-package-backed-micro-apis.md) ships package-backed micro-APIs that charge
every `POST /v1/…` and MCP `tools/call` through x402. The operator still needs to call those
endpoints while developing, debugging and smoke-testing production — without settling a
payment to themselves on every request.

## Context

- Discovery (`GET /`, `GET /v1`, `GET /health`, MCP list methods) is already free.
- Leaving production on `MemoryFacilitator` would let anyone forge a settle.
- A public “free tier” or IP allowlist either opens the surface or breaks with shared egress.
- The operator already holds Worker secrets; a dedicated secret is the smallest credential.

## Decision

1. Declare `OWNER_ACCESS_TOKEN` as a Worker secret on `apps/apis`.
2. When a priced request carries `Authorization: Bearer <token>` that
   [`timingSafeEqual`](https://www.npmjs.com/package/@sdxc/crypto)-matches that secret,
   `requireOperationPayment` / `requireMcpToolPayment` call `next()` and skip x402.
3. A missing, empty or non-matching Bearer still runs the normal payment guard (answers
   `402`). Wrong tokens do not answer `401`, so probing does not reveal whether the secret
   is set.
4. Do not document the bypass on the public HTML landing; the app README is enough for the
   operator.

## Consequences

### Positive

- The operator can curl and wire MCP with one header and no wallet.
- Everyone else still pays; production can keep a real facilitator.

### Negative

- Anyone who steals `OWNER_ACCESS_TOKEN` gets unlimited free execution until rotation.
- Deploy fails until the secret exists remotely (`bindings.secret()`).

### Neutral

- `ctx.payment` stays unset on a bypassed call; responses already tolerate `null`.

## Alternatives Considered

### 1. Keep production on `MemoryFacilitator`

**Rejected.** Any client can settle.

### 2. Cloudflare Access / IP allowlist in front of the Worker

**Rejected** for this iteration — heavier ops, breaks agents behind shared egress, and still
needs an exception for public paid traffic on the same host.

### 3. Separate unpaid staging hostname

**Rejected** as the only answer — staging helps development, but production smoke tests and
operator MCP still need a free path on `api.sdxc.dev`.

## References

- [ADR-180: Package-Backed Micro-APIs](./ADR-180-package-backed-micro-apis.md)
- [`@sdxc/crypto` timingSafeEqual](https://www.npmjs.com/package/@sdxc/crypto)
