# @sdxc/billing

Vendor-neutral billing providers and a webhook endpoint that verifies deliveries.

Code is written against one `Billing` contract and its models (`Customer`, `Subscription`,
`Order`, `Checkout`, `EntitlementState`), so a vendor's name appears in one import and one
construction site. Every method answers a `Result`, and purchases are hosted links: checkout and
portal answer a URL, so no card data passes through your code.

## Installation

```sh
npm add @sdxc/billing
```

Calls answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The
middleware and the webhook endpoint mount into a
[`remix`](https://www.npmjs.com/package/remix) router, and `./conformance` registers
[Vitest](https://vitest.dev) tests.

## Usage

### Construct a provider

Build a provider once at module scope; the constructor makes no network call. Products, meters
and features are your own slugs mapped to the platform's ids, so call sites say `"pro"` and reads
answer `productSlug: "pro"`.

```typescript
import type { Billing } from "@sdxc/billing";

import { PolarBilling } from "@sdxc/billing/providers/polar";

export let billing: Billing = new PolarBilling({
	accessToken: () => readSecret("POLAR_ACCESS_TOKEN"),
	webhookSecret: () => readSecret("POLAR_WEBHOOK_SECRET"),
	products: { pro: "019...", team: "019..." },
	meters: { pings: "019..." },
	features: { reports: "019..." },
});
```

Annotate the export as `Billing`: code stays written against the contract, and `supports()` can
narrow the optional groups.

### Open a hosted checkout

```typescript
import { isFailure } from "@sdxc/result";
import { redirect } from "remix/response/redirect";

let checkout = await billing.checkouts.create({
	product: "pro",
	customer: { externalId: userId },
	returnTo: "https://example.com/billing/thanks",
	idempotencyKey: `checkout_${attemptId}`,
});

if (isFailure(checkout) || checkout.data.url === null) {
	return new Response(null, { status: 502 });
}

return redirect(checkout.data.url, 303);
```

A checkout with no `url` is no longer payable. The return route calls
`billing.checkouts.finish(id)` to read what the session produced.

### Publish the provider on the router

```typescript
import billingMiddleware from "@sdxc/billing/middleware";
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [billingMiddleware({ provider: billing })] });

router.get("/billing/subscriptions", async (context) => {
	let page = await context.billing.subscriptions.list({
		customer: { externalId: userId },
		status: ["active", "trialing"],
	});
	if (isFailure(page)) return new Response(null, { status: 502 });
	return Response.json(page.data.items);
});
```

### Receive webhooks

```typescript
import { BillingWebhook } from "@sdxc/billing";

router.post(
	"/webhooks/billing",
	new BillingWebhook(
		billing,
		{
			async "order.paid"(event) {
				await fulfil(event.order.id, event.order.customerEmail);
			},
		},
		{ store: deliveries },
	),
);
```

The endpoint verifies the signature, skips a delivery the store already processed, and calls the
handler keyed by the event's type.

## API

| Entry                                  | Exports                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `@sdxc/billing`                        | `Billing`, the models, `BillingError`, `supports()`, `BillingWebhook`, helpers |
| `@sdxc/billing/middleware`             | `billing()` (default), `requireEntitlement()`, `readEntitlements()`            |
| `@sdxc/billing/providers/polar`        | `PolarBilling`                                                                 |
| `@sdxc/billing/providers/stripe`       | `StripeBilling`                                                                |
| `@sdxc/billing/providers/mercado-pago` | `MercadoPagoBilling`                                                           |
| `@sdxc/billing/providers/memory`       | `MemoryBilling`, an in-memory platform for tests                               |
| `@sdxc/billing/conformance`            | The Vitest suites every provider passes                                        |

### `Billing`

The provider contract: one object grouping every operation by resource, shared by routes and
jobs. `connection` names the configured account, the value to store beside every provider id you
keep; `native` is the underlying client (typed `unknown`) for endpoints the contract leaves out.
`portal`, `discounts`, `usage` and `meters` are optional groups, present only where the platform
has them.

Every method answers `Promise<Result<T, BillingError>>`, and a `find*` that matches nothing
answers a `not_found` failure:

```typescript
customers.create({ email, externalId, name?, metadata? })
customers.update(customer: CustomerRef, { email?, name?, externalId?, metadata? })
customers.find(customer: CustomerRef)
customers.findByEmail(email: string)
customers.list({ email?, limit?, cursor? }?)

catalog.find(slug: string)
catalog.list({ archived?, limit?, cursor? }?)

checkouts.create(input: CreateCheckoutInput)
checkouts.find(id: string)
checkouts.finish(id: string)

subscriptions.find(id: string)
subscriptions.list({ customer?, product?, status?, limit?, cursor? }?)
subscriptions.cancel(id: string, { atPeriodEnd? }?)

entitlements.of(customer: CustomerRef)

orders.find(id: string)
orders.list({ customer?, product?, subscription?, limit?, cursor? }?)

portal.create({ customer, returnTo? })

discounts.find(id: string)
discounts.findByCode(code: string)
discounts.list({ product?, limit?, cursor? }?)

usage.ingest(events: readonly UsageEvent[])
usage.list({ customer?, name?, from?, to?, limit?, cursor? }?)

meters.quantities({ meter, customer?, from, to, interval })
```

- `customers.create` requires `externalId`, your own subject id and the join key; a taken one
  answers `conflict`. `update` with `externalId` adopts a platform customer that has none.
- The catalog and discounts are read-only: products, prices and coupons are created in the
  platform's dashboard. `findByCode` turns a typed code into the id `checkouts.create` takes.
- `CreateCheckoutInput` takes `product` plus optional `customer`, `email`, `returnTo`,
  `discount`, `quantity`, `metadata`, `allowDiscountCodes` and `idempotencyKey`. Without
  `customer` the hosted page collects the buyer. `idempotencyKey` returns the same session on platforms with idempotency and is
  recorded on the session elsewhere.
- Subscriptions are created by a completed checkout. `cancel` ends one now, or at period end with
  `atPeriodEnd: true`, which a platform that can only cancel immediately answers `unsupported`.
- `entitlements.of` answers everything a customer holds now, the snapshot to write into your
  own tables.
- `usage.ingest` answers `{ accepted }`, counts a repeated `externalId` once and chunks to the
  platform's limit itself. A meter read names its whole window: `from`, `to` and `interval`.
- A list skips a row naming a product the provider was not configured with; only
  `cursor === null` ends a list.

`webhooks` holds the three questions the endpoint asks: `verify(request, rawBody)` answers a
`Promise<boolean>` (`false` while the signing secret is unset or unreadable),
`reference(request, rawBody)` answers the `WebhookReference` `{ deliveryId, object }` or `null`,
and `event(request, rawBody)` answers the normalized `BillingEvent`.

### `BillingError`

The failure inside every `Result`, with `code`, `connection`, the platform's `providerCode`,
`retryable` and `retryAfter` (seconds, or `null`). `new BillingError(message, options)` takes the
same fields, for a provider you write.

`BillingErrorCode` is `not_found`, `invalid_request`, `unauthenticated`, `forbidden`,
`conflict`, `rate_limited`, `invalid_response`, `unsupported`, `not_implemented` or `unknown`.
`rate_limited` is retryable by default. `unknown` is a timeout or 5xx that may have taken effect,
so it is never retryable and is resolved by a reconciliation read. `invalid_response` is a 2xx
the models cannot express, `unsupported` is something the platform cannot do, and
`not_implemented` is something this provider has not done.

### `supports(billing, capability): boolean`

Narrows an optional group to present, so `billing.meters` type-checks inside the branch.
`OPTIONAL_CAPABILITIES` lists the four: `"discounts"`, `"meters"`, `"portal"`, `"usage"`.

### `minorUnitDigits(currency: Currency): number`

Digits after the decimal separator for an ISO 4217 code in any case: `0` for JPY and CLP, `3`
for KWD, `2` by default. Every `Money` amount is in minor units, so divide by `10 ** digits`.

```typescript
let { amount, currency } = order.total;
let major = amount / 10 ** minorUnitDigits(currency); // ¥5,000 stays 5000
```

### `DEFAULT_PAGE_SIZE`

`20`, the page size of a list that names no `limit`, on every provider.

### `BillingWebhook`

`new BillingWebhook(provider, handlers, options?)` builds the endpoint; the instance mounts as a
route action, and `endpoint.handler` is its bound `RequestHandler`. `handlers` maps an event type
to `(event, context) => void | Promise<void>`, typed per event. With `options.store`, a delivery
already processed answers `200` without running anything, and every delivery is recorded with its
`valid` verdict before it is trusted.

An unverified delivery answers `401`. Everything else answers `200`, except a handler throwing an
error `options.retry(error, event)` accepts, which answers `503` so the platform redelivers;
`retry` defaults to a `BillingError` marked `retryable`. Only a delivery whose handler completed
(or that had no handler) is marked processed.

### `WebhookStore` and `MemoryWebhookStore`

The table deliveries are kept in, written by you: `find(id)`, `record(delivery)` and
`markProcessed(id)`. A `WebhookDelivery` is `{ id, type, payload, valid, processed }`, with
`payload` the exact body received. `MemoryWebhookStore` keeps them in process and exposes
`deliveries` in arrival order, for tests.

### `billing(options)` from `./middleware`

The default export; publishes the provider as `context.billing`, typed on `RequestContext` once
the module is imported. `options.provider` is a `Billing` or `(context) => Billing`, resolved once
per request. `options.entitlements` is an `EntitlementSource`: a function of the context
answering an `EntitlementSnapshot`, `null` or a promise of either, read from your own projection.

### `requireEntitlement(feature, options?)` from `./middleware`

Route middleware admitting a request only when the projection grants `feature`, then publishing
it as `context.entitlements` (or `context.get(Entitlements)`). `options.onDenied`, given
the context and the feature, builds the denial response, `403` by default. It throws when `billing()` ran without
`entitlements`.

### `readEntitlements(context)` from `./middleware`

Answers `Result<EntitlementSnapshot | null, Error>` from the `entitlements` source, read at most
once per request and shared with every guard. A missing source or a rejected read is a failure.

### `PolarBilling` from `./providers/polar`

[Polar](https://polar.sh), with every group including the four optional ones; `native` is the
API client.

- `accessToken`: the organization access token, a `Secret`
- `webhookSecret?`: the endpoint's signing secret as Polar issued it, a `Secret`
- `products?`, `meters?`, `features?`: Polar product, meter and benefit ids by your own slugs
- `connection?`: defaults to `"polar"`
- `sandbox?`: bill against Polar's sandbox

### `StripeBilling` from `./providers/stripe`

[Stripe](https://stripe.com), with `portal` and no other optional group. `customers.list`,
`orders.find` and `orders.list` answer `not_implemented`.

- `secretKey`: a `Secret`
- `catalog`: `{ product, price }` Stripe ids by your own slugs (`StripeCatalogEntry`)
- `webhookSecret?`: a `Secret`
- `meters?`: Stripe meter ids by your own slugs
- `portalConfiguration?`: the portal configuration sessions open against
- `externalIdKey?`: the customer metadata key holding your id, defaults to `"external_id"`
- `connection?`: defaults to `"stripe"`; `baseURL?`: a `URL`, defaults to Stripe's v1 API

### `MercadoPagoBilling` from `./providers/mercado-pago`

[Mercado Pago](https://www.mercadopago.com), a payment processor, with no optional group. Tax,
invoicing and disputes stay with you.

- `accessToken`: a `Secret`
- `products?`: by your own slugs, `{ kind: "recurring", plan }` naming a stored plan, or
  `{ kind: "one_time", name, price }` priced here; both take `features?`
- `webhookSecret?`: a `Secret`
- `notificationURL?`: where the platform posts deliveries for checkouts this instance opens
- `backURLs?`: `{ success?, failure?, pending? }` (`MercadoPagoBackURLs`)
- `connection?`: defaults to `"mercado-pago"`

`customers.find({ externalId })`, `cancel` with `atPeriodEnd: true`, and a checkout with
`discount` or `allowDiscountCodes: true` answer `unsupported`. `merchantOrder(id)` reads the
merchant order behind a hosted checkout, with every payment it collected.

### `MemoryBilling` from `./providers/memory`

A complete platform in memory, with every group, passing the conformance suites.

- `catalog?`: `MemoryProductSeed` by slug: `amount`, plus optional `currency` (`"usd"`), `name`,
  `description`, `interval` (recurring), `meter` (metered), `features`, `credits` (meter
  balances granted) and `archived`
- `discounts?`: `MemoryDiscountSeed[]`, each with optional `id`, `code`, `name`, `percentage` or
  `amount` and `currency`, `products`, `maxRedemptions`, `redemptions`, `startsAt`, `endsAt`
- `faults?`: `MemoryFaults`, failures armed from the start
- `webhookSecret?`: the base64 secret emitted deliveries are signed with
- `connection?`: defaults to `"memory"`

`checkouts.finish` completes an open session, creating the order and any subscription. Beyond
the contract it adds:

- `seed(catalog)`: adds products, replacing any with the same slug.
- `fail(target, code = "unknown")`: arms a failure on a group (`"customers"`) or a method
  (`"subscriptions.list"`, a `MemoryFaultTarget`); a method-level fault wins.
- `heal(target?)`: disarms one target, or all.
- `with(overrides)`: a `Billing` with the named groups replaced (`MemoryBillingOverrides`); an
  optional group set to `undefined` is absent.
- `webhooks.emit(event)`: signs a `MemoryEmitEvent` (a `BillingEventPayload` plus optional `id`)
  and answers a `MemoryDelivery` `{ request, body, headers, event }`; reusing an `id` models a
  redelivery.

### `./conformance`

`conformance(options)` registers the required core; `portalConformance`, `discountConformance`,
`usageConformance` and `meterConformance` cover each optional group, and
`capabilityConformance` checks that every declared group answers a real call and every
undeclared one is absent.

`ConformanceOptions`:

- `name`: labels the suites
- `create()`: builds the provider under test, once per test
- `subscription`: a recurring catalog product, as a `ConformanceProduct`
  (`{ slug, amount, currency, priceId? }`)
- `zeroDecimal`: a product priced in a currency with no minor units, such as JPY
- `meter?`: required when the provider declares `meters`
- `missing?`: well-formed ids holding no record (`ConformanceMissingIds`), a fresh UUID by
  default
- `email?()`: builds an unused address, unique per call by default

### Types

- Models: `Customer`, `Product`, `Price`, `Checkout`, `Subscription`, `Order`, `Discount`,
  `PortalSession`, `UsageRecord`, `MeterQuantity`, `UsageIngest`. Each carries `providerData`,
  the platform's own payload, worth storing beside your columns.
- `EntitlementState`: the customer's ids, `products` and `features` by your own slugs, `meters`,
  `subscriptions`, `readAt` and `providerData`, with `MeterBalance` `{ meter, credited, consumed, balance }` and
  `EntitlementSubscription` carrying the current period.
- `Money` is `{ amount, currency }` in integer minor units; `Cost` is the same with `amount` as a
  decimal string, for per-unit usage costs too small for a number. `Currency` is the ISO code.
- `CustomerRef` is `{ id }` or `{ externalId }`. `Page<T>` is `{ items, cursor }`.
- `UsageEvent` is `{ name, customer, externalId?, timestamp?, metadata?, cost? }`.
- `BillingEvent` is `{ id, raw }` plus a `BillingEventPayload`: `customer.created`,
  `customer.updated`, `checkout.completed`, `subscription.activated`, `subscription.updated`,
  `subscription.canceled`, `subscription.revoked`, `order.paid`, `order.refunded`, or
  `unrecognized` with the platform's `providerType`. `BillingEventType` and `BillingEventOf<T>`
  name them; `BillingWebhookHandler<T>`, `BillingWebhookHandlers` and `BillingWebhookOptions`
  type the endpoint.
- `Secret` is `string | (() => string | Promise<string>)`. The function is called on first use
  and its answer kept; a rejection is asked again next time.
- `EntitlementSnapshot` (`./middleware`) is `{ products, features }`; an `EntitlementState`
  satisfies it.
- Status and kind unions: `SubscriptionStatus`, `CheckoutStatus`, `PriceKind`, `DiscountKind`,
  `BillingInterval`. Input and query types: `CreateCustomerInput`, `UpdateCustomerInput`,
  `CreateCheckoutInput`, `CreatePortalInput`, `List*Query`, `MeterQuantityQuery`, and each group's
  `*Api` interface.

## Pattern: Keeping An Entitlement Projection In Sync

Each handler re-reads the customer's snapshot instead of applying the payload: deliveries arrive
out of order and get replayed, so the event is a hint and the snapshot is the state. Throwing a
retryable error answers `503`, and the platform delivers again.

```typescript
import { BillingWebhook } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

import { billing } from "./billing.js";

async function sync(customerId: string | null): Promise<void> {
	if (customerId === null) return;
	let state = await billing.entitlements.of({ id: customerId });
	if (isFailure(state)) throw state.error;
	await writeProjection(customerId, state.data);
}

export let billingWebhook = new BillingWebhook(
	billing,
	{
		"order.paid": (event) => sync(event.order.customerId),
		"subscription.activated": (event) => sync(event.subscription.customerId),
		"subscription.canceled": (event) => sync(event.subscription.customerId),
		"subscription.revoked": (event) => sync(event.subscription.customerId),
	},
	{ store: deliveries },
);
```

Deliveries get missed, and an `unknown` failure may or may not have taken effect, so a periodic
sweep re-reads everything. Follow the cursor until it is `null`, since a short page can still
have more behind it:

```typescript
import { isFailure } from "@sdxc/result";

let cursor: string | undefined;

for (let page = 0; page < 50; page++) {
	let result = await billing.subscriptions.list({ status: ["active"], limit: 100, cursor });
	if (isFailure(result)) break;

	for (let subscription of result.data.items) await sync(subscription.customerId);

	if (result.data.cursor === null) break;
	cursor = result.data.cursor;
}
```

## Pattern: Gating A Route On An Entitlement

The guard reads your own projection, so the platform stays off the request path. Configure the
reader once and guard each route:

```typescript
import billingMiddleware, { readEntitlements, requireEntitlement } from "@sdxc/billing/middleware";
import { isSuccess } from "@sdxc/result";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

import { billing } from "./billing.js";

let router = createRouter({
	middleware: [
		billingMiddleware({
			provider: billing,
			entitlements: (context) => readProjection(context.request),
		}),
	],
});

router.get(
	"/reports",
	[requireEntitlement("reports", { onDenied: () => redirect("/pricing", 303) })],
	(context) => Response.json({ products: context.entitlements.products }),
);

router.get("/", async (context) => {
	let read = await readEntitlements(context);
	let pro = isSuccess(read) && read.data?.products.includes("pro") === true;
	return Response.json({ showUpgrade: !pro });
});
```

The reader runs once per request however many guards and `readEntitlements` calls share it, and
answering `null` (no signed-in subject) denies every guard.

## Pattern: Discount Codes And The Billing Portal

A code typed into your own form becomes a discount id for the checkout, and an existing customer
manages their plan on the platform's hosted portal. Both groups are optional, so `supports()`
guards them.

```typescript
import { supports } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";
import { redirect } from "remix/response/redirect";

import { billing } from "./billing.js";

export async function upgrade(userId: string, code: string | null): Promise<Response> {
	let discount: string | undefined;

	if (code !== null && supports(billing, "discounts")) {
		let found = await billing.discounts.findByCode(code);
		if (isFailure(found)) return new Response("Unknown code", { status: 400 });
		discount = found.data.id;
	}

	let checkout = await billing.checkouts.create({
		product: "team",
		customer: { externalId: userId },
		discount,
		allowDiscountCodes: false,
	});
	if (isFailure(checkout) || checkout.data.url === null) return new Response(null, { status: 502 });
	return redirect(checkout.data.url, 303);
}

export async function manage(userId: string): Promise<Response> {
	if (!supports(billing, "portal")) return new Response(null, { status: 404 });

	let session = await billing.portal.create({
		customer: { externalId: userId },
		returnTo: "https://example.com/settings",
	});
	if (isFailure(session)) return new Response(null, { status: 502 });
	return redirect(session.data.url, 303);
}
```

## Pattern: Metered Usage From A Scheduled Job

A job imports the same module-scope provider, reports consumption, and branches on `retryable`.
An `externalId` derived from your own row makes a resend count once.

```typescript
import { supports } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

import { billing } from "./billing.js";

export async function reportUsage(rows: { teamId: string; hour: string; at: Date }[]) {
	if (!supports(billing, "usage")) return;

	let result = await billing.usage.ingest(
		rows.map((row) => ({
			name: "pings",
			customer: { externalId: row.teamId },
			externalId: `pings_${row.teamId}_${row.hour}`,
			timestamp: row.at,
		})),
	);

	if (isFailure(result) && result.error.retryable) throw result.error;
}

export async function monthToDate(teamId: string, from: Date) {
	if (!supports(billing, "meters")) return null;

	let reading = await billing.meters.quantities({
		meter: "pings",
		customer: { externalId: teamId },
		from,
		to: new Date(),
		interval: "day",
	});
	return isFailure(reading) ? null : reading.data.quantity;
}
```

## Pattern: A Provider Per Tenant

Each tenant bills against its own account: the middleware's factory builds the provider for the
request, `connection` names the account so stored ids stay attributable, and a `Secret` function
reads the tenant's credential on first use.

```typescript
import billingMiddleware from "@sdxc/billing/middleware";
import { MercadoPagoBilling } from "@sdxc/billing/providers/mercado-pago";
import { createRouter } from "remix/router";

let providers = new Map<string, MercadoPagoBilling>();

function providerFor(tenant: string): MercadoPagoBilling {
	let provider = providers.get(tenant);
	if (provider !== undefined) return provider;

	provider = new MercadoPagoBilling({
		connection: `mercado-pago:${tenant}`,
		accessToken: () => readSecret(`${tenant}/MERCADO_PAGO_ACCESS_TOKEN`),
		webhookSecret: () => readSecret(`${tenant}/MERCADO_PAGO_WEBHOOK_SECRET`),
		notificationURL: `https://${tenant}.example.com/webhooks/billing`,
		products: {
			pro: { kind: "recurring", plan: "2c93808..." },
			book: { kind: "one_time", name: "The book", price: { amount: 10_050, currency: "ars" } },
		},
	});
	providers.set(tenant, provider);
	return provider;
}

let router = createRouter({
	middleware: [billingMiddleware({ provider: (context) => providerFor(tenantOf(context.url)) })],
});
```

## Pattern: Testing A Billing Flow

`MemoryBilling` keeps real state, so a test buys a product, emits a signed delivery to a real
endpoint, and asserts on the outcome. `fail()` arms an outage on the same instance.

```typescript
import { BillingWebhook, MemoryWebhookStore } from "@sdxc/billing";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { isFailure, unwrap } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { expect, test } from "vitest";

test("a paid order grants its features once", async () => {
	let billing = new MemoryBilling({
		catalog: { pro: { amount: 4900, interval: "month", features: { reports: true } } },
	});

	let customer = await unwrap(
		billing.customers.create({ email: "pat@example.com", externalId: "u_1" }),
	);
	let opened = await unwrap(
		billing.checkouts.create({ product: "pro", customer: { id: customer.id } }),
	);
	let checkout = await unwrap(billing.checkouts.finish(opened.id));
	let order = await unwrap(billing.orders.find(checkout.orderId ?? ""));

	let granted: string[] = [];
	let store = new MemoryWebhookStore();
	let endpoint = new BillingWebhook(
		billing,
		{
			async "order.paid"(event) {
				let state = await unwrap(billing.entitlements.of({ id: event.order.customerId ?? "" }));
				granted.push(...state.products);
			},
		},
		{ store },
	);

	let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));
	await endpoint.handler(new RequestContext(delivery.request));
	let replay = await unwrap(
		billing.webhooks.emit({ id: delivery.event.id, type: "order.paid", order }),
	);
	await endpoint.handler(new RequestContext(replay.request));

	expect(granted).toEqual(["pro"]);
	expect(store.deliveries.at(0)?.processed).toBe(true);

	billing.fail("entitlements.of", "unknown");
	expect(isFailure(await billing.entitlements.of({ id: customer.id }))).toBe(true);
	billing.heal();

	let portalless = billing.with({ portal: undefined });
	expect(portalless.portal).toBeUndefined();
});
```

## Pattern: Writing A Provider

Implement `Billing`, report failures as `BillingError`, type credentials as `Secret`, and
register the core suite plus one suite per optional group the platform has.

```typescript
import { capabilityConformance, conformance, portalConformance } from "@sdxc/billing/conformance";
import { describe } from "vitest";

import { AcmeBilling } from "./acme.js";

let options = {
	name: "AcmeBilling",
	create: () =>
		new AcmeBilling({
			apiKey: () => readSecret("ACME_TEST_KEY"),
			catalog: { pro: "prod_pro", tokyo: "prod_tokyo" },
		}),
	subscription: { slug: "pro", amount: 4900, currency: "usd" },
	zeroDecimal: { slug: "tokyo", amount: 5000, currency: "jpy" },
};

describe("AcmeBilling against a sandbox account", () => {
	conformance(options);
	portalConformance(options);
	capabilityConformance(options);
});
```

`capabilityConformance` fails a provider that declares a group it cannot serve, so declare only
what the platform has.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/billing": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
