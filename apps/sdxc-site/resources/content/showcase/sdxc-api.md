---
title: sdxc-api
headline: Selling package capabilities to agents one call at a time, paid in USDC over HTTP and MCP
summary: Package capabilities sold per call to agents over HTTP and MCP, each priced in USDC through x402, with a catalog humans read for free.
cover: home
shots:
  - id: home
    page: "https://api.sdxc.dev/"
    alt: The sdxc APIs landing page, with the pitch for pay-per-call package APIs and links to connect MCP, browse operations and the JSON catalog.
  - id: pay
    page: "https://api.sdxc.dev/"
    highlight: "section#pay"
    alt: The How charging works section, listing the four steps of an x402 charge and the routes that stay free.
  - id: mcp
    page: "https://api.sdxc.dev/"
    highlight: "section#mcp"
    alt: The Connect over MCP section, with the endpoint, a shell command and client configuration for npx and bunx.
  - id: catalog
    page: "https://api.sdxc.dev/"
    highlight: "section#catalog"
    alt: The operations table, each row an operation id, what it does, the package behind it and its price.
  - id: http
    page: "https://api.sdxc.dev/"
    highlight: "section#http"
    alt: The plain HTTP section, a curl call that answers 402 and the retry with a payment signature.
  - id: json
    page: "https://api.sdxc.dev/v1"
    alt: The JSON catalog at /v1, listing the service, the payment protocol, the MCP endpoint and every operation with its price.
  - id: og
    page: "https://api.sdxc.dev/og.png?v=1"
    alt: The landing's Open Graph card, drawn on paper with a teal accent, the brand, the pitch and the host.
  - id: phone
    page: "https://api.sdxc.dev/"
    viewport: phone
    alt: The sdxc APIs landing page on a phone, the pitch and its links stacked in one column.
---

sdxc-api runs `@sdxc/*` package capabilities as micro-APIs at [api.sdxc.dev](https://api.sdxc.dev). Each `POST /v1/<id>` runs one operation, such as encoding a QR code, highlighting source, parsing a zone file, diffing JSON or building a PDF or EPUB, and the same operations are tools on an MCP server at `/mcp`. A priced call is paid per request in USDC through the x402 protocol, with a wallet as the only credential.

It is the collection as a paid HTTP and MCP surface. People keep installing the packages from npm and reading their docs on sdxc.dev for free; an agent that wants hosted execution pays a fraction of a cent per call. The landing page, the JSON catalog at `/v1` and the health report stay free. Read it for x402 with [@sdxc/x402](/api/x402), for one catalog driving both HTTP and MCP, and for a Worker small enough to read in one sitting, with all of its state in the request.

## The brief

Charging an agent per call has its own requirements. There are no accounts to sign up for and no API keys to rotate, so payment has to ride on the request itself. Discovery must stay free, or an agent cannot learn what is for sale. The price must be stated before the work runs, and the work must not run until the payment settles. The HTTP and MCP surfaces must sell exactly the same operations at the same prices. A paid route still needs abuse protection. And the operator needs to switch charging on without redeploying code, and to use the service themselves without paying.

sdxc-api takes all of that on in a Worker with no database. The catalog is a config file, payment is middleware, each operation is a call into one package, and the soft-launch switch is a secret.

## One catalog, two surfaces

`config/catalog.ts` lists every operation the Worker sells: its id (which is also the MCP tool name), a title, a description, the npm package that implements it, the price in USDC atomic units with six decimals, a dollar label for people, and an example input and output for discovery. The landing's operations table, the JSON catalog and every MCP tool read from that one list.

![The operations table](/showcase/sdxc-api/catalog.webp "Each operation names the package behind it and its price, from one config file.")

Ten operations sell today, from `semver.satisfies` at $0.0005 to `pdf.build` and `epub.build` at $0.005. They run [@sdxc/qr](/api/qr), [@sdxc/highlight](/api/highlight), [@sdxc/markdown](/api/markdown), [@sdxc/semver](/api/semver), [@sdxc/zone-file](/api/zone-file), [@sdxc/json-patch](/api/json-patch), [@sdxc/pdf](/api/pdf), [@sdxc/epub](/api/epub) and [@sdxc/feed](/api/feed). `pdf.build` takes a client-supplied TrueType font up to 500 KiB, and `feed.normalize` reads source text or a URL with a 1 MiB cap on the outbound body.

`app/services/run.ts` dispatches an id to its package with one `switch`, and both the HTTP controller and the MCP tools call it, so the two surfaces cannot drift. A new operation is one catalog row and one runner.

```ts
export async function runOperation(
	id: string,
	input: unknown,
): Promise<Result<unknown, OperationError>> {
	switch (id as OperationId) {
		case "qr.encode":
			return runQrEncode(input);
		case "highlight":
			return runHighlight(input);
```

The same list is free to read as JSON at `/v1`, with the service name, the payment protocol, the MCP endpoint, and each operation's id, description, package, amount, dollar price and URL.

![The JSON catalog at /v1](/showcase/sdxc-api/json.webp "The catalog an agent reads before it pays, served free as JSON.")

## Payment on the request

The router's global middleware installs the x402 seller from `app/initializers/x402.ts`, and the two priced routes add their own guards through `lazy()`'s second argument: a rate limit and a payment requirement, which answer before the operation's module even loads. An unpaid call answers HTTP `402` with a `PAYMENT-REQUIRED` header naming the amount, the network and the destination. The client signs a payment and retries with `PAYMENT-SIGNATURE`; the Worker verifies and settles through a facilitator, then returns the result with `PAYMENT-RESPONSE`.

![The four steps of an x402 charge](/showcase/sdxc-api/pay.webp "Every priced call follows the same four steps, and discovery stays free.")

The landing shows that exchange as plain HTTP: a curl call against `semver.satisfies` that comes back `402`, then the retry with a signature that comes back `200` with the JSON result.

![A curl call that answers 402](/showcase/sdxc-api/http.webp "The whole protocol as two curl calls: the challenge, then the paid retry.")

Each operation also carries a Bazaar discovery extension built by `app/services/bazaar.ts` from the catalog's example input and output, so facilitators that index Bazaar can list the resource once a payment settles.

Priced routes are rate-limited to 60 requests a minute through [@sdxc/rate-limit](/api/rate-limit), keyed by payer when a payment signature is present and by connecting address otherwise.

## Agents over MCP

`/mcp` is a Streamable HTTP endpoint through [@sdxc/mcp](/api/mcp), with every catalog operation as a tool of the same name. Only `tools/call` is priced, so an agent can list tools and read their schemas for free. Agents that speak an older MCP revision connect through `mcp-bridge` from `@sdxc/mcp`, and the landing gives the shell command and the client configuration for npx and bunx.

![The Connect over MCP section](/showcase/sdxc-api/mcp.webp "The endpoint, the bridge command and ready-to-paste client configuration.")

## Charging as configuration

`app/services/payments.ts` decides whether priced routes collect. With the facilitator secret set to `memory` or left empty, the Worker serves every operation free; with a real facilitator URL, a network and a receive address, it charges, with no code change. `app/services/owner-access.ts` gives the operator a free pass: a bearer token matching the `OWNER_ACCESS_TOKEN` secret skips x402 on HTTP and MCP alike. Every secret is declared, so a deploy fails loudly when one is missing remotely.

## A landing for people and agents

The landing is server-rendered with SEO tags through [@sdxc/seo](/api/seo): a canonical URL, Open Graph and Twitter cards and schema.org JSON-LD for the publisher, the site, the page and the API. Its markup is an `h-entry` with the publisher's `h-card` and one `h-cite` per operation through [@sdxc/microformats](/api/microformats), and a request with `Accept: text/markdown` gets the page as Markdown.

The Open Graph card is drawn on the Worker with [@sdxc/raster](/api/raster) in the page's own paper, teal and code-chip colours. `app/http/caching.ts` stores the PNG in the colo's Workers Cache after the first draw, so later shares of the same revision are served from that copy, and bumping `?v=` draws a new one.

![The Open Graph card](/showcase/sdxc-api/og.webp "The share card, drawn on the Worker and kept in the edge cache after the first request.")

On a phone the landing keeps the same order, pitch first, then charging, MCP, the catalog and HTTP.

![The landing on a phone](/showcase/sdxc-api/phone.webp "The landing on a phone, in the same order as on a desktop.")

## Where to start reading

- [`config/catalog.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-api/config/catalog.ts) — every priced operation, the one list HTTP and MCP share.
- [`app/services/run.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-api/app/services/run.ts) — an id dispatched to the package that implements it.
- [`app/initializers/router.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-api/app/initializers/router.tsx) — the x402 seller in the global chain and the guards on the priced routes.
- [`app/initializers/x402.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-api/app/initializers/x402.ts) — the seller, with a memory or HTTP facilitator.
