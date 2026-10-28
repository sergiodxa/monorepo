# @sdxc/x402

Seller-side [x402](https://x402.org/) for Remix: `402` challenges, facilitator
verify/settle, and payment receipts on the request context.

An unpaid request answers HTTP `402` with `PAYMENT-REQUIRED`. The client retries
with `PAYMENT-SIGNATURE`; the seller verifies and settles through a facilitator,
then returns the resource with `PAYMENT-RESPONSE`.

## Installation

```sh
npm add @sdxc/x402
```

Calls answer a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The `./middleware`
entry mounts on a [`remix`](https://www.npmjs.com/package/remix) v3 router.

## Usage

### Guard a priced route

Publish one seller on the router, then require payment on the routes that charge.
An unpaid request answers `402`; a settled retry continues with `ctx.payment` set
and `PAYMENT-RESPONSE` on the response.

```typescript
import { HTTPFacilitator } from "@sdxc/x402";
import { requirePayment, x402 } from "@sdxc/x402/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		x402({
			facilitator: new HTTPFacilitator({ url: "https://facilitator.example" }),
			payTo: "0xYourReceiveAddress",
			network: "eip155:8453",
			asset: "0xUsdcOnThatNetwork",
			serviceName: "shop",
		}),
	],
});

router.post(
	"/v1/encode",
	requirePayment({ amount: "1000", description: "Encode a QR symbol" }),
	async (ctx) => {
		let body = await ctx.request.json();
		return Response.json({ payment: ctx.payment, result: encode(body) });
	},
);
```

Amounts are atomic token units as decimal strings. With USDC (6 decimals),
`"1000"` is `$0.001`.

### Collect without middleware

`Seller` builds the challenge and settles a signature on its own when the route
is not Remix middleware.

```typescript
import { MemoryFacilitator, Seller } from "@sdxc/x402";
import { isFailure } from "@sdxc/result";

let seller = new Seller({
	facilitator: new MemoryFacilitator(),
	payTo: "0xYourReceiveAddress",
	network: "eip155:84532",
	asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
});

let price = {
	amount: "1000",
	resource: {
		url: "https://api.example/v1/encode",
		description: "Encode a QR symbol",
		mimeType: "application/json",
	},
};

let receipt = await seller.collect(request, price);
if (isFailure(receipt)) return seller.challenge(price, receipt.error.message);

return seller.withPaymentResponse(Response.json({ ok: true }), {
	success: true,
	payer: receipt.data.payer,
	transaction: receipt.data.transaction,
	network: receipt.data.network,
	amount: receipt.data.amount,
});
```

`MemoryFacilitator` settles any payload whose `accepted` matches the
requirements. Use it in tests and local development; production points
`HTTPFacilitator` at a real facilitator.

## API

### `new Seller(config: SellerConfig)`

One receive wallet, network and facilitator. Every priced resource on the
instance shares those defaults.

- `config.facilitator`: verifies and settles payloads
- `config.payTo`: destination wallet
- `config.network`: CAIP-2 network id (for example `eip155:8453`)
- `config.asset`: asset contract or id charged
- `config.scheme?`: payment scheme; defaults to `"exact"`
- `config.maxTimeoutSeconds?`: seconds advertised on each challenge; defaults to
  `60`
- `config.serviceName?`: stamped on every resource when the call omits one

#### `seller.requirements(amount, extra?): PaymentRequirements`

Builds the accept entry a challenge advertises and a signature must match.

#### `seller.paymentRequired(price: PriceRequest): PaymentRequired`

Builds the body encoded into `PAYMENT-REQUIRED`.

#### `seller.challenge(price, error?): Response`

Answers `402` with `PAYMENT-REQUIRED` and `Cache-Control: no-store`. Pass
`error` when re-challenging after a failed settle.

#### `seller.collect(request, price): Promise<Result<PaymentReceipt, X402Error>>`

Reads `PAYMENT-SIGNATURE`, verifies and settles. A missing or invalid signature
is a failure the caller turns into another challenge.

#### `seller.withPaymentResponse(response, settlement): Response`

Attaches `PAYMENT-RESPONSE` to a successful resource response.

### `new HTTPFacilitator(options: HTTPFacilitatorOptions)`

POSTs JSON to `{url}/verify` and `{url}/settle`.

- `options.url`: facilitator base URL
- `options.timeoutMs?`: request timeout; defaults to `30_000`

### `new MemoryFacilitator()`

Accepts any payload whose `accepted` matches amount, network, asset, payTo and
scheme. No chain. For tests and local development.

### `Facilitator`

The contract both backends implement: `verify(payload, requirements)` and
`settle(payload, requirements)`, each a `Result`.

### Header codecs

| Export                                            | Role                                                     |
| ------------------------------------------------- | -------------------------------------------------------- |
| `PAYMENT_SIGNATURE`                               | Request header name carrying the client's signed payment |
| `PAYMENT_REQUIRED`                                | Response header name advertising what to pay             |
| `PAYMENT_RESPONSE`                                | Response header name carrying settlement                 |
| `PAYMENT_REQUIRED_CACHE_CONTROL`                  | `"no-store"`, set on every challenge                     |
| `encodeHeader` / `decodeHeader`                   | Base64 JSON round-trip for any header body               |
| `encodePaymentRequired` / `encodePaymentResponse` | Typed encoders for the two response headers              |
| `decodePaymentSignature`                          | Parses `PAYMENT-SIGNATURE` into a `PaymentPayload`       |

### `X402Error`

Failure carried by codecs and `Seller.collect`. `code` is an `X402ErrorCode`:
`invalid_header`, `invalid_payload`, `facilitator_unreachable`,
`facilitator_rejected`, or `settlement_failed`.

### `@sdxc/x402/middleware`

#### `x402(config: SellerConfig): Middleware`

Builds one `Seller` and publishes it as `ctx.x402` (and under `X402Key`).

#### `requirePayment(options: RequirePaymentOptions): Middleware`

Collects payment before `next()`. On success sets `ctx.payment` and attaches
`PAYMENT-RESPONSE` to the handler's response. On failure answers `402`.

- `options.amount`: atomic amount as a decimal string
- `options.description`: stamped on the 402 resource
- `options.mimeType?`: response media type; defaults to `"application/json"`
- `options.resourceUrl?(ctx)?`: absolute resource URL; defaults to the request
  URL without query or hash
- `options.extra?`: scheme-specific fields forwarded into requirements

#### `X402Key` / `PaymentReceiptKey`

Context keys for `ctx.get(X402Key)` and `ctx.get(PaymentReceiptKey)` when the
property form is unavailable.

### `@sdxc/x402/testing`

Helpers for Vitest route tests. Re-exports `MemoryFacilitator`.

#### `testSeller(overrides?): Seller`

A seller on `MemoryFacilitator` with `TEST_PAY_TO`, `TEST_NETWORK` and
`TEST_ASSET`.

#### `memoryPaymentSignature(requirements, payer?): string`

A `PAYMENT-SIGNATURE` value the memory facilitator accepts for those
requirements.

#### `withMemoryPayment(requirements): HeadersInit`

`{ [PAYMENT_SIGNATURE]: memoryPaymentSignature(requirements) }` for `fetch` in
tests.

#### `TEST_PAY_TO` / `TEST_NETWORK` / `TEST_ASSET`

Defaults the memory seller uses (Base Sepolia USDC stand-ins).

### Types

#### `SellerConfig` / `PriceRequest` / `HTTPFacilitatorOptions`

Constructor and call shapes for `Seller` and `HTTPFacilitator`.

#### `PaymentRequirements`

One accept entry: `scheme`, `network`, `amount`, `asset`, `payTo`,
`maxTimeoutSeconds`, `extra`.

#### `PaymentRequired`

`x402Version: 2`, `resource`, `accepts`, optional `error` and `extensions`.

#### `PaymentPayload`

What the client puts in `PAYMENT-SIGNATURE`: `x402Version`, `accepted`,
`payload`, optional `resource` and `extensions`.

#### `PaymentReceipt`

Published on the request after settle: `transaction`, `network`, `amount`,
`asset`, `scheme`, optional `payer`.

#### `ResourceInfo`

`url`, optional `description`, `mimeType`, `serviceName`.

#### `VerifyResponse` / `SettleResponse`

Facilitator `/verify` and `/settle` bodies.

#### `X402ErrorCode`

Union of the failure codes `X402Error` carries.

## Pattern: Price From A Catalog

Look up the amount per request, then run `requirePayment` with that row so one
route sells many operations.

```typescript
import { requirePayment } from "@sdxc/x402/middleware";
import type { Middleware } from "remix/router";

let CATALOG = {
	"qr.encode": { amount: "1000", description: "Encode a QR symbol" },
	"semver.satisfies": {
		amount: "500",
		description: "Ask whether a version satisfies a range",
	},
} as const;

export let requireCatalogPayment: Middleware = async (ctx, next) => {
	let id = ctx.params.id;
	if (typeof id !== "string" || !(id in CATALOG)) {
		return Response.json({ error: "not_found" }, { status: 404 });
	}
	let operation = CATALOG[id as keyof typeof CATALOG];
	return requirePayment({
		amount: operation.amount,
		description: operation.description,
		resourceUrl: () => new URL(`/v1/${id}`, ctx.url).href,
	})(ctx, next);
};
```

## Pattern: Guard Before A Lazy Module Loads

Pass `requirePayment` as the second argument to
[`@sdxc/lazy-route`](https://www.npmjs.com/package/@sdxc/lazy-route)'s `lazy()`
so an unpaid call answers `402` without importing the handler.

```typescript
import { lazy } from "@sdxc/lazy-route";
import { requirePayment, x402 } from "@sdxc/x402/middleware";
import { HTTPFacilitator } from "@sdxc/x402";
import { createRouter } from "remix/router";
import { post, route } from "remix/routes";

let routes = route({ encode: post("/v1/encode") });
let router = createRouter({
	middleware: [
		x402({
			facilitator: new HTTPFacilitator({ url: "https://facilitator.example" }),
			payTo: "0xYourReceiveAddress",
			network: "eip155:8453",
			asset: "0xUsdcOnThatNetwork",
		}),
	],
});

router.map(
	routes.encode,
	lazy(
		() => import("./encode.js"),
		[requirePayment({ amount: "1000", description: "Encode a QR symbol" })],
	),
);
```

## Pattern: Charge An MCP Tool Call By Header

Streamable HTTP MCP names the method and tool in headers so the body stays
unread for the MCP handler. Guard `tools/call` and leave discovery free.

```typescript
import { requirePayment } from "@sdxc/x402/middleware";
import type { Middleware } from "remix/router";

let PRICES: Record<string, { amount: string; description: string }> = {
	"qr.encode": { amount: "1000", description: "Encode a QR symbol" },
};

export let requireToolPayment: Middleware = async (ctx, next) => {
	if (ctx.request.headers.get("mcp-method")?.toLowerCase() !== "tools/call") {
		return next();
	}
	let name = ctx.request.headers.get("mcp-name");
	if (name === null || !(name in PRICES)) return next();
	let price = PRICES[name]!;
	return requirePayment({
		amount: price.amount,
		description: price.description,
		resourceUrl: () => `mcp://tool/${name}`,
	})(ctx, next);
};
```

## Pattern: Production Facilitator From Config

Build the seller once per isolate. An empty or `memory` URL keeps local and test
runs on `MemoryFacilitator`; anything that looks like `http(s):` uses the HTTP
client.

```typescript
import { HTTPFacilitator, MemoryFacilitator, type SellerConfig } from "@sdxc/x402";

export function sellerConfig(env: {
	facilitatorUrl: string | null;
	payTo: string;
	network: string;
	asset: string;
}): SellerConfig {
	let url = env.facilitatorUrl?.trim() ?? null;
	let facilitator =
		url === null || url === "" || url === "memory" || !/^https?:\/\//i.test(url)
			? new MemoryFacilitator()
			: new HTTPFacilitator({ url });

	return {
		facilitator,
		payTo: env.payTo,
		network: env.network,
		asset: env.asset,
		serviceName: "shop",
	};
}
```

## Pattern: Assert A Paid Route In Vitest

Challenge once to learn the accept entry the seller advertised, then retry with
a memory signature built from it. That keeps the test aligned when env stubs
change payTo or network.

```typescript
import type { PaymentRequired } from "@sdxc/x402";

import { isFailure } from "@sdxc/result";
import { PAYMENT_REQUIRED, PAYMENT_RESPONSE, decodeHeader } from "@sdxc/x402";
import { withMemoryPayment } from "@sdxc/x402/testing";
import { expect, test } from "vitest";

test("runs after payment", async () => {
	let challenge = await router.fetch(
		new Request("https://api.example/v1/encode", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text: "hello" }),
		}),
	);
	expect(challenge.status).toBe(402);

	let decoded = decodeHeader(challenge.headers.get(PAYMENT_REQUIRED)!);
	if (isFailure(decoded)) throw decoded.error;
	let accepts = (decoded.data as PaymentRequired).accepts;

	let paid = await router.fetch(
		new Request("https://api.example/v1/encode", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...withMemoryPayment(accepts[0]!),
			},
			body: JSON.stringify({ text: "hello" }),
		}),
	);
	expect(paid.status).toBe(200);
	expect(paid.headers.get(PAYMENT_RESPONSE)).toBeTruthy();
});
```

Prefer the shorter form when the seller's wallet matches the test defaults:

```typescript
import { PAYMENT_SIGNATURE } from "@sdxc/x402";
import { memoryPaymentSignature, testSeller } from "@sdxc/x402/testing";

let seller = testSeller();
let signature = memoryPaymentSignature(seller.requirements("1000"));

let response = await router.fetch(
	new Request("https://api.example/v1/encode", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			[PAYMENT_SIGNATURE]: signature,
		},
		body: JSON.stringify({ text: "hello" }),
	}),
);
```

## Pattern: Read The Receipt By Key

Code that does not know the middleware chain still reads the settled payment
through `PaymentReceiptKey`.

```typescript
import type { RequestContext } from "remix/router";

import { PaymentReceiptKey } from "@sdxc/x402/middleware";

function transactionId(ctx: RequestContext) {
	return ctx.get(PaymentReceiptKey)?.transaction;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was
published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries
no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/x402": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts
every later release in the same year. An exact version keeps the upgrade yours
to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
