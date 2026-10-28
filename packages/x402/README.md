# @sdxc/x402

x402 seller middleware for Remix: `402` challenges, facilitator verify/settle and payment
receipts on the request context.

An agent requests a priced resource; without payment the server answers HTTP `402` with a
`PAYMENT-REQUIRED` header. The agent signs a payload, retries with `PAYMENT-SIGNATURE`, and
the server verifies and settles through a facilitator before returning the resource with
`PAYMENT-RESPONSE`. This package is the Remix-shaped seller side of that exchange.

## Installation

```sh
npm add @sdxc/x402
```

Calls answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The
middleware mounts into a [`remix`](https://www.npmjs.com/package/remix) router.

## Usage

### Publish a seller on the router

```typescript
import { MemoryFacilitator } from "@sdxc/x402";
import { requirePayment, x402 } from "@sdxc/x402/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		x402({
			facilitator: new MemoryFacilitator(), // HTTPFacilitator in production
			payTo: "0xYourAddress",
			network: "eip155:84532",
			asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			serviceName: "apis",
		}),
	],
});

router.post("/v1/qr", {
	middleware: [requirePayment({ amount: "1000", description: "Encode text as a QR symbol" })],
	handler: async (ctx) => {
		// ctx.payment holds the settlement receipt
		return Response.json({ ok: true });
	},
});
```

`MemoryFacilitator` settles any well-formed payload and is for tests and local development.
Production uses `HTTPFacilitator` pointed at a facilitator URL.

### Challenge and collect without middleware

```typescript
import { Seller, MemoryFacilitator } from "@sdxc/x402";
import { isFailure } from "@sdxc/result";

let seller = new Seller({
	facilitator: new MemoryFacilitator(),
	payTo: "0xYourAddress",
	network: "eip155:84532",
	asset: "0xUsdc",
});

let price = {
	amount: "1000",
	resource: { url: "https://apis.example/v1/qr", description: "Encode a QR" },
};

let receipt = await seller.collect(request, price);
if (isFailure(receipt)) return seller.challenge(price, receipt.error.message);
```

## API

### `Seller`

Builds `402` challenges and collects `PAYMENT-SIGNATURE` through a {@link Facilitator}.

### `HTTPFacilitator` / `MemoryFacilitator`

`HTTPFacilitator` POSTs to a facilitator's `/verify` and `/settle`. `MemoryFacilitator`
accepts matching payloads without a chain.

### `@sdxc/x402/middleware`

`x402(config)` publishes `ctx.x402`. `requirePayment({ amount, description })` answers
`402` until a payment settles, then sets `ctx.payment` and attaches `PAYMENT-RESPONSE`.

### `@sdxc/x402/testing`

`testSeller()`, `memoryPaymentSignature(requirements)` and `withMemoryPayment(requirements)`
for Vitest route tests.

## Versioning

Packages are released daily under a `YYYY.M.D` version. There is no compatibility promise
between dates — pin an exact version.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
