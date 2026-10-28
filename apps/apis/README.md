# apis

Package-backed micro-APIs for agents: each `POST /v1/<id>` runs one `@sdxc/*` capability
and charges through [x402](https://x402.org/). Humans keep installing packages from npm
and reading docs on [sdxc.dev](https://sdxc.dev) for free.

Production URL: https://apis.sdxc.dev (once deployed)

## Start

```sh
bun install
sdxc run typegen
bun dev
```

Copy `.env.example` to `.dev.vars` first. `bun dev` serves the Worker at
http://localhost:3010. With `X402_FACILITATOR_URL=memory` (the default when unset),
payments settle through an in-memory facilitator — use `@sdxc/x402/testing`'s
`withMemoryPayment` helpers in tests.

## Routes

| Route     | Method | Payment              | Purpose                                        |
| --------- | ------ | -------------------- | ---------------------------------------------- |
| `/`       | GET    | Free                 | Plain-text orientation                         |
| `/v1`     | GET    | Free                 | JSON catalog of operations                     |
| `/v1/*id` | POST   | x402                 | Run one catalog operation (dots allowed in id) |
| `/mcp`    | POST   | x402 on `tools/call` | Model Context Protocol                         |
| `/health` | GET    | Free                 | Health report                                  |

## Operations

See `config/catalog.ts`. First set: `qr.encode`, `highlight`, `markdown.plain`,
`semver.satisfies`, `zone-file.parse`, `json-patch.apply`, `json-patch.diff`.

## Pay with a test facilitator

```sh
# 1. Ask for the challenge
curl -i -X POST http://localhost:3010/v1/semver.satisfies \
  -H 'content-type: application/json' \
  -d '{"version":"1.2.3","comparison":"^","against":"1.0.0"}'

# 2. Retry with PAYMENT-SIGNATURE from @sdxc/x402/testing (memory facilitator)
```

## Scripts

| Script             | Purpose                 |
| ------------------ | ----------------------- |
| `bun run dev`      | Dev server on port 3010 |
| `bun run build`    | Production build        |
| `sdxc run typegen` | Cloudflare env types    |

## Architecture

[ADR-180](../../docs/adr/ADR-180-package-backed-micro-apis.md) and
[ADR-179](../../docs/adr/ADR-179-x402-agent-payments.md).
