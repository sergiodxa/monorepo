# apis

Package-backed micro-APIs for agents: each `POST /v1/<id>` runs one `@sdxc/*` capability
and charges through [x402](https://x402.org/). Humans keep installing packages from npm
and reading docs on [sdxc.dev](https://sdxc.dev) for free.

Production URL: https://api.sdxc.dev (once deployed)

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

| Route     | Method | Payment              | Purpose                                                               |
| --------- | ------ | -------------------- | --------------------------------------------------------------------- |
| `/`       | GET    | Free                 | HTML landing (MCP, x402, catalog); `Accept: text/markdown` for agents |
| `/v1`     | GET    | Free                 | JSON catalog of operations                                            |
| `/v1/*id` | POST   | x402                 | Run one catalog operation (dots allowed in id)                        |
| `/mcp`    | POST   | x402 on `tools/call` | Model Context Protocol                                                |
| `/health` | GET    | Free                 | Health report                                                         |

## Connect MCP

```sh
claude mcp add --transport http sdxc-apis https://api.sdxc.dev/mcp
```

```json
{
	"mcpServers": {
		"sdxc-apis": {
			"type": "http",
			"url": "https://api.sdxc.dev/mcp"
		}
	}
}
```

Unpaid `tools/call` answers HTTP `402` with x402 `PAYMENT-REQUIRED`. Settle and retry with
`PAYMENT-SIGNATURE`.

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

## Operator free pass

Priced HTTP and MCP calls skip x402 when the request carries the operator secret:

```sh
curl -s -X POST https://api.sdxc.dev/v1/semver.satisfies \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN" \
  -d '{"version":"1.2.3","comparison":"^","against":"1.0.0"}'
```

Mint a value with `randomToken({ prefix: "owner" })` from `@sdxc/crypto`, put it in
`.dev.vars` locally, and set the production secret before deploy:

```sh
cf workers secrets update OWNER_ACCESS_TOKEN --name sdxc-api
```

For MCP, configure the same Bearer header on the client. Everyone else still pays;
a wrong Bearer answers `402` like an unpaid call.

## Scripts

| Script             | Purpose                 |
| ------------------ | ----------------------- |
| `bun run dev`      | Dev server on port 3010 |
| `bun run build`    | Production build        |
| `sdxc run typegen` | Cloudflare env types    |

## Architecture

[ADR-180](../../docs/adr/ADR-180-package-backed-micro-apis.md) and
[ADR-179](../../docs/adr/ADR-179-x402-agent-payments.md).
