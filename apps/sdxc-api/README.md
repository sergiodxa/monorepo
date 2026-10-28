# sdxc-api

Package-backed micro-APIs for agents: each `POST /v1/<id>` runs one `@sdxc/*` capability
and charges through [x402](https://x402.org/). Humans keep installing packages from npm
and reading docs on [sdxc.dev](https://sdxc.dev) for free.

Production URL: https://api.sdxc.dev

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
claude mcp add --transport http sdxc-api https://api.sdxc.dev/mcp
```

```json
{
	"mcpServers": {
		"sdxc-api": {
			"type": "http",
			"url": "https://api.sdxc.dev/mcp"
		}
	}
}
```

Unpaid `tools/call` answers HTTP `402` with x402 `PAYMENT-REQUIRED` (including Bazaar
discovery metadata). Settle and retry with `PAYMENT-SIGNATURE`.

## Operations

See `config/catalog.ts`. Current set:

| Id                 | Package            | Notes                                      |
| ------------------ | ------------------ | ------------------------------------------ |
| `qr.encode`        | `@sdxc/qr`         | SVG path                                   |
| `highlight`        | `@sdxc/highlight`  | Tokens                                     |
| `markdown.plain`   | `@sdxc/markdown`   | Plain text                                 |
| `semver.satisfies` | `@sdxc/semver`     | Boolean                                    |
| `zone-file.parse`  | `@sdxc/zone-file`  | Records                                    |
| `json-patch.apply` | `@sdxc/json-patch` | Patched document                           |
| `json-patch.diff`  | `@sdxc/json-patch` | Patch                                      |
| `pdf.build`        | `@sdxc/pdf`        | Client-supplied `.ttf` ≤ 500 KiB → base64  |
| `epub.build`       | `@sdxc/epub`       | Metadata + XHTML chapters → base64         |
| `feed.normalize`   | `@sdxc/feed`       | Source text or URL (≤ 1 MiB outbound body) |

Priced routes are rate-limited to 60 requests/minute per payer (when
`PAYMENT-SIGNATURE` is present) or per connecting address.

## Production secrets (Base mainnet)

```sh
cf workers secrets update X402_PAY_TO --name sdxc-api
cf workers secrets update X402_FACILITATOR_URL --name sdxc-api
cf workers secrets update X402_FACILITATOR_AUTH --name sdxc-api   # e.g. Bearer <cdp-jwt>
cf workers secrets update X402_NETWORK --name sdxc-api            # eip155:8453
cf workers secrets update X402_ASSET --name sdxc-api              # Base USDC
cf workers secrets update OWNER_ACCESS_TOKEN --name sdxc-api
```

Suggested mainnet values:

- `X402_NETWORK=eip155:8453`
- `X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base)
- `X402_PAY_TO=<your Base USDC receive address>`
- Facilitator: CDP x402 URL + `X402_FACILITATOR_AUTH=Bearer …`, or another HTTP facilitator

Settled USDC lands in `X402_PAY_TO`. That is any EVM address that can hold USDC on Base
(Coinbase Wallet, MetaMask, Rabby, a hardware wallet, a CDP-managed wallet). Facilitator
API keys and `OWNER_ACCESS_TOKEN` are separate secrets — wallets do not mint those.

## Operator free pass

Priced HTTP and MCP calls skip x402 when the request carries the operator secret:

```sh
curl -s -X POST https://api.sdxc.dev/v1/semver.satisfies \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN" \
  -d '{"version":"1.2.3","comparison":"^","against":"1.0.0"}'
```

Mint a value with `randomToken({ prefix: "owner" })` from `@sdxc/crypto`.

## Scripts

| Script             | Purpose                 |
| ------------------ | ----------------------- |
| `bun run dev`      | Dev server on port 3010 |
| `bun run build`    | Production build        |
| `sdxc run typegen` | Cloudflare env types    |

## Architecture

[ADR-180](../../docs/adr/ADR-180-package-backed-micro-apis.md) and
[ADR-179](../../docs/adr/ADR-179-x402-agent-payments.md).
