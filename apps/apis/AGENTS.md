# apis Agent Guidelines

Package-backed micro-APIs charged with x402. Every priced operation wraps one `@sdxc/*`
capability; HTML docs and npm packages stay free.

## Rules

- MUST keep operations declared in `config/catalog.ts` and implemented in `app/services/run.ts`
- MUST collect payment through `@sdxc/x402` (`requireOperationPayment` / `requireMcpToolPayment`)
- MUST NOT add D1, KV or other durable state without an ADR — this Worker is compute-only
- MUST map routes through `lazy()` from `@sdxc/lazy-route`
- MUST use `MemoryFacilitator` in tests via `@sdxc/x402/testing`
- MUST keep `/`, `/v1` and `/health` free
- MUST keep the HTML landing at `/` as the human-facing pitch (MCP setup, x402, catalog); agents may take `Accept: text/markdown`

## Reference

- Catalog: `config/catalog.ts`
- Runner: `app/services/run.ts`
- Seller: `app/initializers/x402.ts`
- ADR: `docs/adr/ADR-180-package-backed-micro-apis.md`
