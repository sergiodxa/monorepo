# ADR-180: Package-Backed Micro-APIs Charged with x402

## Status

**Accepted** - 2026-10-27

## Background

[ADR-179](./ADR-179-x402-agent-payments.md) mapped how x402 fits the monorepo and listed
chargeable surfaces. The clearest product to ship first is not a paywalled blog: it is a
**collection of micro-APIs**, each wrapping one `@sdxc/*` capability as HTTP + MCP, that an
agent can call individually and pay for per request. Humans keep reading docs and installing
packages from npm for free; agents pay for hosted execution.

Uptime's anonymous `/try` probe remains a strong second candidate and is out of scope here.

## Context

### Why this product

| Fact                                                                    | Implication                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `@sdxc/*` packages are pure libraries on npm                            | Hosting them as APIs is new value, not a lock on OSS |
| Agents already hit `sdxc.dev/mcp` and `sergiodxa.com/mcp` for free docs | They need _compute_ next (encode, parse, transform)  |
| Each package is small and Workers-friendly                              | One Worker can mount many endpoints cheaply          |
| ADR-179 forbids paywalling public HTML                                  | Micro-APIs never replace free docs; they run code    |

### What an agent gets

1. `GET /v1` — free catalog of operations, prices and schemas.
2. `POST /v1/<operation>` — unpaid → `402` + `PAYMENT-REQUIRED`; paid → result +
   `PAYMENT-RESPONSE`. The route is `/v1/*id` (named wildcard) so dotted ids such as
   `semver.satisfies` match; a `:id` variable stops at `.`.
3. `POST /mcp` — the same operations as tools, with the same payment guard.

## Decision

1. Ship app **`apps/apis`** (Worker `apis`, domain `apis.sdxc.dev`) as the collection.
2. Ship package **`@sdxc/x402`** as the Remix seller middleware and facilitator client used by
   that app (and later by others).
3. First operations wrap packages that are pure, bounded and useful alone:

| Operation          | Package            | Input (sketch)          | Output                 |
| ------------------ | ------------------ | ----------------------- | ---------------------- |
| `qr.encode`        | `@sdxc/qr`         | text / bytes, ECC level | SVG path + matrix size |
| `highlight`        | `@sdxc/highlight`  | source + language       | tokens                 |
| `markdown.plain`   | `@sdxc/markdown`   | Markdown source         | plain text             |
| `semver.satisfies` | `@sdxc/semver`     | version + range         | boolean + parse errors |
| `zone-file.parse`  | `@sdxc/zone-file`  | zone text               | records + errors       |
| `json-patch.apply` | `@sdxc/json-patch` | document + patch        | patched document       |
| `json-patch.diff`  | `@sdxc/json-patch` | before + after          | patch                  |

4. Prices are declared once in `config/catalog.ts` as USDC atomic amounts (6 decimals) on a
   configured network (Base Sepolia in development, Base mainnet in production).
5. Development and tests use an in-memory facilitator that settles any well-formed payload;
   production uses an HTTP facilitator URL from config/secrets.
6. The catalog, health check and MCP `tools/list` stay free. Only operation execution charges.

### `@sdxc/x402` surface

- Encode/decode V2 `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers.
- `Facilitator` interface with `HTTPFacilitator` and `MemoryFacilitator`.
- Remix middleware `x402({ facilitator, payTo, network, asset })` publishing `ctx.x402`.
- Guard `requirePayment({ amount, description, resource })` for routes and MCP tools.
- Every failure is a `Result` / typed error; settlement success publishes a receipt on context.

### App layout

Follows [ADR-129](./ADR-129-app-folder-layout.md): catalog in `config/`, one controller (or MCP
tool file) per operation under `app/http/controllers/v1/` and `app/mcp/tools/`, shared body
validation with `remix/data-schema` via `@sdxc/validate`, no D1 — compute only.

## Consequences

### Positive

- Monetizes agent demand without touching free docs, blog HTML or npm packages.
- Reuses existing package tests' contracts as API contracts.
- Gives `@sdxc/x402` a real consumer before blogging or uptime adopt it.

### Negative

- Another Worker to deploy, observe and price.
- Facilitator / wallet ops (receive address, mainnet cutover).
- Agents without an x402-aware client cannot call paid tools until they use a bridge.

### Neutral

- sdxc.dev and the blog MCP stay free.
- Uptime `/try` can adopt the same middleware later without redesign.

## Implementation Plan

### Phase 1 (this change)

Package `@sdxc/x402`, app `apis` with the seven operations above, HTTP + MCP, memory
facilitator in tests, catalog + health.

### Phase 2

Mainnet facilitator, Bazaar discovery metadata, rate limits per payer, more packages
(`@sdxc/pdf`, `@sdxc/epub`, `@sdxc/feed` normalize with outbound caps).

### Phase 3

Optional: Uptime anonymous probe behind the same middleware.

## Alternatives Considered

### 1. Charge sdxc.dev `get_package` / blog `get_post`

**Rejected** for the first product — same bodies are free as pages. See ADR-179.

### 2. One mega “run any package” RPC

**Rejected.** Agents discover and pay for named tools; a free-form eval surface is harder to
price, sandbox and document.

### 3. Put micro-APIs inside sdxc-site

**Rejected.** Docs site caching and long `Cache-Control` fight paid, uncacheable POSTs.
A dedicated Worker keeps the rails separate.

## References

- [ADR-179: x402 for Agent Payments](./ADR-179-x402-agent-payments.md)
- [x402 docs](https://docs.x402.org/)
- [ADR-129: App folder layout](./ADR-129-app-folder-layout.md)
