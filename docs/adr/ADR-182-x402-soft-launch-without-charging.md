# ADR-182: Soft-Launch x402 Surfaces Without Charging

## Status

**Accepted** - 2026-10-28

## Background

[ADR-180](./ADR-180-package-backed-micro-apis.md) and [ADR-181](./ADR-181-apis-owner-access-bypass.md)
ship `api.sdxc.dev` and the uptime guest probe behind x402. Deploying before a
receive wallet and facilitator are ready still needs a way to exercise the Worker
in production without forging settlements or blocking every caller with 402.

## Context

- `bindings.secret()` requires every declared secret to exist before `cf deploy`.
- Leaving production on `MemoryFacilitator` lets anyone forge a settle (rejected in ADR-181).
- The operator Bearer covers only the operator, not a public smoke test of the ops themselves.
- Soft-launch should flip to real charging by changing secrets alone — no code redeploy required
  beyond secret updates.

## Decision

1. Treat `X402_FACILITATOR_URL` of `memory`, empty, or unset as **payments disabled**:
   priced guards call `next()` and never answer 402.
2. Keep Vitest's `test-*` stub values on the charge path with `MemoryFacilitator`, so
   settlement tests still see 402 and `PAYMENT-RESPONSE`.
3. A real `https://…` facilitator URL enables charging; set `X402_PAY_TO`, network, asset
   and optional auth alongside it when cutting over.
4. Document soft-launch secret values in each app's `.env.example` and README. Do not
   advertise "free forever" on the public landing — this is a temporary deploy mode.

## Consequences

### Positive

- Deploy and smoke-test without a wallet; flip secrets to start charging.
- No forgeable public settle while soft-launching.

### Negative

- Anyone who can reach the host gets free compute until the facilitator URL is real.
- Soft-launch and "forgot to set the secret" look the same — operators must treat
  `memory` as intentional.

### Neutral

- `OWNER_ACCESS_TOKEN` still works once charging is on; it is unused while payments are off.

## Alternatives Considered

### 1. Keep MemoryFacilitator in production for soft-launch

**Rejected** — forgeable settle (ADR-181).

### 2. Separate staging hostname that omits payment middleware

**Rejected** as the only answer — wants the same Worker and DNS the cutover will use.

## References

- [ADR-180: Package-Backed Micro-APIs](./ADR-180-package-backed-micro-apis.md)
- [ADR-181: Operator Free Pass](./ADR-181-apis-owner-access-bypass.md)
