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
http://localhost:3010. Soft-launch default: `X402_FACILITATOR_URL=memory` (or
empty) skips charging so every caller gets the ops for free. To exercise 402
locally with the in-memory facilitator, set a non-http stub such as
`test-local`. Vitest stubs use `test-*` values and keep the charge path.

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

## Soft-launch secrets (no wallet yet)

`bindings.secret()` requires every declared secret before deploy. Ship placeholders
so priced routes stay free ([ADR-182](../../docs/adr/ADR-182-x402-soft-launch-without-charging.md)):

```sh
# Values to paste when prompted:
# X402_FACILITATOR_URL = memory
# X402_PAY_TO          = 0x00000000000000000000000000000000000000fe
# X402_FACILITATOR_AUTH = -          (placeholder; ignored while soft-launching)
# X402_NETWORK         = eip155:84532
# X402_ASSET           = 0x036CbD53842c5426634e7929541eC2318f3dCF7e
# OWNER_ACCESS_TOKEN   = owner_replace-me   (mint a real one before enabling charges)
cf workers secrets update X402_FACILITATOR_URL --name sdxc-api
cf workers secrets update X402_PAY_TO --name sdxc-api
cf workers secrets update X402_FACILITATOR_AUTH --name sdxc-api
cf workers secrets update X402_NETWORK --name sdxc-api
cf workers secrets update X402_ASSET --name sdxc-api
cf workers secrets update OWNER_ACCESS_TOKEN --name sdxc-api
```

Flip to charging later by updating the same secrets to mainnet values — no code
redeploy required beyond secret changes.

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

## Deploy

There is no D1 database, so every ship skips migrate:

```sh
sdxc deploy --skip migrate
```

From GitHub Actions: **Actions → Deploy app → Run workflow**, pick `sdxc-api` (or
`all`). Soft-launch secrets must already exist on the Worker before the first
upload — see above. A dry run is available from the same workflow form.

## Scripts

| Script                       | Purpose                        |
| ---------------------------- | ------------------------------ |
| `bun run dev`                | Dev server on port 3010        |
| `bun run build`              | Production build               |
| `sdxc run typegen`           | Cloudflare env types           |
| `sdxc deploy --skip migrate` | Build and upload to Cloudflare |

## Architecture

[ADR-180](../../docs/adr/ADR-180-package-backed-micro-apis.md),
[ADR-179](../../docs/adr/ADR-179-x402-agent-payments.md), and
[ADR-182](../../docs/adr/ADR-182-x402-soft-launch-without-charging.md).
