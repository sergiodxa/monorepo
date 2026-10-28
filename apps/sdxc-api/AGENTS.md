# sdxc-api Agent Guidelines

Package-backed micro-APIs charged with x402. Every priced operation wraps one `@sdxc/*`
capability; HTML docs and npm packages stay free.

## Rules

- MUST keep operations declared in `config/catalog.ts` and implemented in `app/services/run.ts`
- MUST collect payment through `@sdxc/x402` (`requireOperationPayment` / `requireMcpToolPayment`) when `paymentsEnabled()` is true
- MUST treat `X402_FACILITATOR_URL` of `memory`, empty, or unset as soft-launch: skip charging for every caller (`app/services/payments.ts`, ADR-182)
- MUST keep Vitest `test-*` facilitator stubs on the charge path so settlement tests still see 402
- MUST allow the operator to skip payment once charging is on, via `Authorization: Bearer` matching `OWNER_ACCESS_TOKEN` (`isOwnerRequest`); a wrong or missing Bearer still charges
- MUST NOT advertise the owner bypass or soft-launch free mode on the public HTML landing
- MUST NOT add D1, KV or other durable state without an ADR — this Worker is compute-only
- MUST map routes through `lazy()` from `@sdxc/lazy-route`
- MUST use `MemoryFacilitator` in tests via `@sdxc/x402/testing`
- MUST keep `/`, `/v1` and `/health` free
- MUST keep the HTML landing at `/` as the human-facing pitch (MCP setup, x402, catalog); agents may take `Accept: text/markdown`

## Reference

- Catalog: `config/catalog.ts`
- Runner: `app/services/run.ts`
- Seller: `app/initializers/x402.ts`
- Payments gate: `app/services/payments.ts`
- ADR: `docs/adr/ADR-180-package-backed-micro-apis.md`, `docs/adr/ADR-182-x402-soft-launch-without-charging.md`
