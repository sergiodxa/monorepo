# @pkg/billing

Vendor-neutral billing: our own models, one provider contract every platform is reached through, a middleware that publishes `context.billing`, and a webhook endpoint that verifies, deduplicates and dispatches deliveries.

## Overview

Billing spelled out per app means re-deciding the same things at every call site: which client to resolve, what a failure looks like, which vendor identifier a column holds, and what a webhook handler is allowed to trust. This package makes each of those one decision. Apps program against the models in this package — `Customer`, `Subscription`, `Order`, `Checkout`, `EntitlementState` — and reach a platform through the `Billing` contract, so a vendor's name appears in one import and one construction site per app rather than in every service, column, and handler.

Every operation hangs off the instance, grouped by resource: `billing.customers.create()`, `billing.checkouts.create()`, `billing.entitlements.of()`. That shape is deliberate — some billing call sites are cron jobs rather than routes, so the API cannot depend on a request context. A provider is constructed once at module scope; a route reads that same object from `context.billing` and a job imports it directly.

Nothing here throws. Every method returns a [`Result`](/packages/result) carrying a `BillingError` on the failure side, and a `find*` that matches nothing answers a `not_found` failure rather than `null`, so a missing record is a branch the compiler makes you take. Purchases are hosted links only: checkout and portal hand back a URL and the route performs the redirect, so no card data passes through this package or the app around it.

Capability groups vary by platform. `portal`, `discounts`, `usage` and `meters` are optional properties on the contract, checked with `supports()`, which narrows the group inside the branch. A platform that lacks one leaves the property absent rather than stubbing it — Mercado Pago has none of the first three.

### Entry points

| Entry                                 | Contents                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `@pkg/billing`                        | The models, the `Billing` contract, `BillingError`, `supports()`, `BillingWebhook` |
| `@pkg/billing/middleware`             | The router middleware publishing `context.billing`, plus `requireEntitlement()`    |
| `@pkg/billing/providers/polar`        | `PolarBilling`, which answers every group                                          |
| `@pkg/billing/providers/stripe`       | `StripeBilling`, a deliberately narrow provider                                    |
| `@pkg/billing/providers/mercado-pago` | `MercadoPagoBilling`, a payment processor rather than a merchant of record         |
| `@pkg/billing/providers/memory`       | `MemoryBilling`, a full in-memory platform for tests                               |
| `@pkg/billing/conformance`            | The shared suite every provider must pass, plus one suite per optional capability  |

Providers live behind their own subpaths and are never re-exported from the root, so a bundle resolves only the provider an app imports. The conformance suite imports `vitest`, so it stays out of the root entry too.

## Usage

### Constructing a provider

A provider is a class, built once at module scope. Nothing reaches the network in the constructor, so an instance costs no startup work and can be imported anywhere:

```typescript
import { PolarBilling } from "@pkg/billing/providers/polar";
import { env } from "cloudflare:workers";

export let polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: env.POLAR_WEBHOOK_SECRET,
	products: { pro: "019...", team: "019..." },
	meters: { pings: "019..." },
	features: { flow_monitors: "019..." },
});
```

Products, meters, and features are configured as our own slugs mapped to the platform's ids, which is what keeps a vendor identifier out of every call site: a checkout is opened for `"pro"`, and a subscription read reports `productSlug: "pro"`.

### Configuring a credential

Every credential option — an access token, an API key, a signing secret — is a `Secret`, which is the value itself or a function resolving it:

```typescript
export type Secret = string | (() => string | Promise<string>);
```

The function form is what lets a credential live in a store that is only readable with an `await`, since the constructor runs at module scope where nothing can be awaited:

```typescript
import { PolarBilling } from "@pkg/billing/providers/polar";
import { env } from "cloudflare:workers";

export let polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN.get(),
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET.get(),
	products: { pro: "019..." },
});
```

The function is called on the first use that needs the credential and the answer is remembered, so reading it costs one await for the life of the instance however many calls follow. A read that fails is not remembered, so a store that was briefly unavailable is asked again and the instance can still bill later.

While a signing secret is unset, empty, or unreadable, verification answers `false` rather than throwing, so an endpoint keeps returning a status the platform accepts instead of the `500` it disables an endpoint over.

### Registering the middleware

The middleware is a default export, so the importing app names it. The convention is to name the middleware for the capability and the instance for the backend, which reads as the sentence it is:

```typescript
import billing from "@pkg/billing/middleware";
import { createRouter } from "remix/router";

import { polar } from "~/app/services/billing";

let router = createRouter({
	middleware: [billing({ provider: polar })],
});
```

Handlers then bill without knowing which platform is configured:

```typescript
import { isFailure } from "@pkg/result";

router.get("/billing/subscription", async (context) => {
	let state = await context.billing.entitlements.of({ id: customerId });

	if (isFailure(state)) return new Response(null, { status: 502 });

	return Response.json({ products: state.data.products });
});
```

### Billing from a job

A job has no request context, so it imports the same instance the middleware publishes. There is no second construction and no second configuration:

```typescript
import { supports } from "@pkg/billing";
import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";

import { polar } from "~/app/services/billing";

export class IngestUsageJob extends Job {
	async perform(): Promise<void> {
		if (!supports(polar, "usage")) return;

		let result = await polar.usage.ingest([
			{ name: "pings", customer: { externalId: "u_1" }, externalId: "ping_2026_09_02" },
		]);

		if (isFailure(result)) throw new Job.RetryError(result.error.message);

		this.logger.info("billing.usage.ingested", { accepted: result.data.accepted });
	}
}
```

### Asking whether a platform has a capability

`portal`, `discounts`, `usage` and `meters` may be absent. `supports()` is a type guard, so the group is non-optional inside the branch:

```typescript
import { supports } from "@pkg/billing";
import { isFailure } from "@pkg/result";

if (!supports(context.billing, "meters")) return new Response(null, { status: 404 });

let reading = await context.billing.meters.quantities({
	meter: "pings",
	customer: { id: customerId },
	from: startOfMonth,
	to: now,
	interval: "day",
});

if (isFailure(reading)) return new Response(null, { status: 502 });

return Response.json({ quantity: reading.data.quantity });
```

### Opening a hosted checkout

The package returns a link; the route redirects to it:

```typescript
import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";

let checkout = await context.billing.checkouts.create({
	product: "pro",
	customer: { id: customerId },
	returnTo: "https://example.com/billing/thanks",
	idempotencyKey: `checkout_${orderAttemptId}`,
});

if (isFailure(checkout) || checkout.data.url === null) {
	return new Response(null, { status: 502 });
}

return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
```

### The webhook endpoint

`BillingWebhook` is constructed at module scope and mounted as a route. It reads the body once, verifies the signature, records the delivery with the verdict, skips a replay that already ran, and hands a narrowed event to the handler keyed by its type:

```typescript
import { BillingWebhook } from "@pkg/billing";

import { polar } from "~/app/services/billing";
import { syncEntitlements } from "~/app/services/entitlements";
import { deliveries } from "~/app/services/webhook-store";

export default new BillingWebhook(
	polar,
	{
		async "order.paid"(event) {
			await syncEntitlements(event.order.customerId);
		},
		async "subscription.canceled"(event) {
			await syncEntitlements(event.subscription.customerId);
		},
	},
	{ store: deliveries },
);
```

An event names what changed, not what the new state is. A handler re-reads the entitlement snapshot rather than applying the payload as a diff, because deliveries arrive out of order, are replayed, and carry whatever API version the platform sent them under.

### Testing without a platform

`MemoryBilling` is a full implementation of the contract, not a mock: it passes the same conformance suite the real providers do, so state a call writes is state the next call reads.

```typescript
import { MemoryBilling } from "@pkg/billing/providers/memory";
import { unwrap } from "@pkg/result";

let billing = new MemoryBilling({
	catalog: {
		pro: { amount: 4900, currency: "usd", interval: "month", features: { flow_monitors: true } },
	},
});

let customer = await unwrap(
	billing.customers.create({ email: "jane@example.com", externalId: "u_1" }),
);
let opened = await unwrap(
	billing.checkouts.create({ product: "pro", customer: { id: customer.id } }),
);
let checkout = await unwrap(billing.checkouts.finish(opened.id));

expect(checkout.status).toBe("completed");
expect(checkout.orderId).not.toBeNull();
```

## API

### `@pkg/billing`

#### `Billing`

The provider contract. One instance carries every operation, grouped by resource, so a job and a route use the same object.

```typescript
interface Billing {
	readonly connection: string;

	readonly customers: CustomerApi;
	readonly catalog: CatalogApi;
	readonly checkouts: CheckoutApi;
	readonly subscriptions: SubscriptionApi;
	readonly entitlements: EntitlementApi;
	readonly orders: OrderApi;
	readonly webhooks: WebhookApi;

	readonly portal?: PortalApi;
	readonly discounts?: DiscountApi;
	readonly usage?: UsageApi;
	readonly meters?: MeterApi;

	readonly native: unknown;
}
```

`connection` names a configured credential set rather than a vendor, since one vendor can hold several accounts, and it is the value stored beside every provider id an app keeps. `native` is the underlying HTTP client, for the endpoints the contract does not model; it is `unknown`, so reaching it is a deliberate cast.

#### `CustomerApi`

```typescript
customers.create(input: CreateCustomerInput): Promise<Result<Customer, BillingError>>
customers.update(customer: CustomerRef, input: UpdateCustomerInput): Promise<Result<Customer, BillingError>>
customers.find(customer: CustomerRef): Promise<Result<Customer, BillingError>>
customers.findByEmail(email: string): Promise<Result<Customer, BillingError>>
customers.list(query?: ListCustomersQuery): Promise<Result<Page<Customer>, BillingError>>
```

`create` takes `{ email, externalId, name?, metadata? }`. `externalId` is required: it is our own subject id, the join key that makes a customer re-resolvable, and platforms treat it as immutable once set. A taken `externalId` reports `conflict`.

`ListCustomersQuery` is `{ email?, limit?, cursor? }`.

#### `CatalogApi`

```typescript
catalog.find(slug: string): Promise<Result<Product, BillingError>>
catalog.list(query?: ListProductsQuery): Promise<Result<Page<Product>, BillingError>>
```

Read-only, and addressed by our own slugs. Products and prices are created in the platform's dashboard, so nothing here writes one. `ListProductsQuery` is `{ archived?, limit?, cursor? }`; archived products stay readable because old orders point at them.

#### `CheckoutApi`

```typescript
checkouts.create(input: CreateCheckoutInput): Promise<Result<Checkout, BillingError>>
checkouts.find(checkout: string): Promise<Result<Checkout, BillingError>>
checkouts.finish(checkout: string): Promise<Result<Checkout, BillingError>>
```

`CreateCheckoutInput` is `{ product, customer?, email?, returnTo?, discount?, quantity?, metadata?, idempotencyKey? }`. Omitting `customer` lets the hosted page collect the buyer's identity, which is what a sale to someone with no account yet needs. `idempotencyKey` makes a retried request open the same session rather than a second one.

`finish` is the call a return route makes for a customer who has just come back from the hosted page. It is separate from `find` because a delivery from the platform and a customer standing in front of you differ in trust and in who is waiting.

#### `PortalApi` (optional)

```typescript
portal.create(input: CreatePortalInput): Promise<Result<PortalSession, BillingError>>
```

`CreatePortalInput` is `{ customer, returnTo? }`. Upgrades, downgrades, cancellations and payment-method changes all happen on the hosted page, which is what keeps proration the platform's problem. Present only on a platform that hosts a payer-facing page.

#### `SubscriptionApi`

```typescript
subscriptions.find(subscription: string): Promise<Result<Subscription, BillingError>>
subscriptions.list(query?: ListSubscriptionsQuery): Promise<Result<Page<Subscription>, BillingError>>
subscriptions.cancel(subscription: string, options?: { atPeriodEnd?: boolean }): Promise<Result<Subscription, BillingError>>
```

There is no `create`: a subscription comes into existence when a checkout completes, and an app learns of it from an event. `ListSubscriptionsQuery` is `{ customer?, product?, status?, limit?, cursor? }`.

`cancel` is the one write every platform in scope offers, which is why it is a contract method rather than something only the hosted portal can do. `atPeriodEnd: true` on a platform that can only cancel immediately answers `unsupported` instead of pretending the paid period will be honoured.

#### `EntitlementApi`

```typescript
entitlements.of(customer: CustomerRef): Promise<Result<EntitlementState, BillingError>>
```

The sync primitive: one call answering everything a customer holds right now. An app writes the snapshot into its own tables and requests read those, so the platform stays off the request path.

#### `OrderApi`

```typescript
orders.find(order: string): Promise<Result<Order, BillingError>>
orders.list(query?: ListOrdersQuery): Promise<Result<Page<Order>, BillingError>>
```

`ListOrdersQuery` is `{ customer?, product?, subscription?, limit?, cursor? }`.

#### `DiscountApi` (optional)

```typescript
discounts.find(discount: string): Promise<Result<Discount, BillingError>>
discounts.findByCode(code: string): Promise<Result<Discount, BillingError>>
discounts.list(query?: ListDiscountsQuery): Promise<Result<Page<Discount>, BillingError>>
```

Discounts are created in the platform's dashboard. `findByCode` turns a code typed into our own form into the id `checkouts.create({ discount })` accepts. `ListDiscountsQuery` is `{ product?, limit?, cursor? }`. Present only on a platform whose API exposes its coupons.

#### `UsageApi` (optional)

```typescript
usage.ingest(events: readonly UsageEvent[]): Promise<Result<UsageIngest, BillingError>>
usage.list(query?: ListUsageQuery): Promise<Result<Page<UsageRecord>, BillingError>>
```

`ingest` answers `{ accepted }`, counting a resent `externalId` once. Chunking to the platform's per-request limit happens inside the provider, so a caller hands over the whole array. `list` is the read-back a reconciliation uses to see what the platform actually counted; `ListUsageQuery` is `{ customer?, name?, from?, to?, limit?, cursor? }`.

#### `MeterApi` (optional)

```typescript
meters.quantities(query: MeterQuantityQuery): Promise<Result<MeterQuantity, BillingError>>
```

`MeterQuantityQuery` is `{ meter, customer?, from, to, interval }`. The window and the bucket width are all required rather than defaulted, because a default chosen inside a provider would make the same query mean different things on two platforms.

#### `WebhookApi`

The three narrow questions an endpoint asks its provider. Verification stays per-platform because signing schemes differ; deduplication, persistence and dispatch are the same everywhere and live in `BillingWebhook`.

```typescript
webhooks.verify(request: Request, rawBody: string): Promise<boolean>
webhooks.reference(request: Request, rawBody: string): WebhookReference | null
webhooks.event(request: Request, rawBody: string): Promise<Result<BillingEvent, BillingError>>
```

`WebhookReference` is `{ deliveryId, object: { id, type } | null }`. The delivery id and the object are separate because a platform sends several distinct deliveries about one object, and deduplicating on the object would drop all but the first. `event` is asynchronous because a platform whose delivery carries only an identifier has to read the object back before it can say what happened.

#### `BillingError`

The single failure type inside every billing `Result`.

**Properties:**

- `code`: `BillingErrorCode` — the normalized reason a caller branches on
- `connection`: the configured credential set the failing call was made against
- `providerCode`: the platform's own code, or `null`, for logs and support tickets
- `retryable`: whether repeating the call is safe; always `false` for `unknown`
- `retryAfter`: seconds the platform asked the caller to wait, or `null`

`BillingErrorCode` is `not_found`, `invalid_request`, `unauthenticated`, `forbidden`, `conflict`, `rate_limited`, `invalid_response`, `unsupported`, `not_implemented`, or `unknown`. Three of those are worth reading closely:

- **`unknown`** is a timeout or a 5xx: the operation may or may not have taken effect, so recovery is a reconciliation against the platform rather than a retry. `retryable` is never `true` for it.
- **`invalid_response`** is a 2xx in a shape these models cannot express. The platform is fine and our mapping is not, so it must not send a caller into reconciliation.
- **`unsupported`** means the platform cannot do this at all; **`not_implemented`** means this provider has not done it yet.

Only `rate_limited` is retryable by default. A provider may override `retryable` when it knows better.

```typescript
import { isFailure } from "@pkg/result";

let result = await billing.customers.create({ email, externalId });

if (isFailure(result)) {
	if (result.error.code === "conflict") return existing(externalId);
	context.logger.error("billing.customer_create_failed", {
		code: result.error.code,
		providerCode: result.error.providerCode,
		connection: result.error.connection,
	});
}
```

#### `supports(billing: Billing, capability: OptionalCapability): boolean`

Narrows an optional resource group to present, so code that reads a group typechecks only against a platform that has it.

**Parameters:**

- `billing`: The configured provider to ask
- `capability`: One of `"discounts"`, `"meters"`, `"portal"`, `"usage"`

**Returns:**

- Whether the provider implements it, narrowing the group when it does

**Example:**

```typescript
if (supports(billing, "portal")) {
	let session = await billing.portal.create({ customer: { id } });
}
```

`OPTIONAL_CAPABILITIES` is the array of all four, which is what the conformance run iterates. `OptionalCapability` is derived from which contract properties are optional, so the list follows the contract rather than a hand-maintained copy of it.

#### `minorUnitDigits(currency: Currency): number`

How many decimal places one unit of a currency divides into.

**Parameters:**

- `currency`: ISO 4217 alphabetic code, in any letter case

**Returns:**

- Digits after the decimal separator: `0` for JPY and CLP, `3` for BHD and KWD, `2` for everything outside the exception table

**Example:**

```typescript
minorUnitDigits("jpy"); // 0
minorUnitDigits("kwd"); // 3
```

Formatting an amount without asking this is the bug: dividing every `Money` by 100 turns ¥5,000 into ¥50 and 5.000 KWD into 500 KWD.

#### `BillingWebhook`

The webhook endpoint as a class. It answers `200` to everything it can account for, because an error response is how a platform decides an endpoint is broken and stops calling it.

##### `new BillingWebhook(provider: Billing, handlers: BillingWebhookHandlers, options?: BillingWebhookOptions)`

**Parameters:**

- `provider`: The configured platform, which answers whether a delivery is authentic
- `handlers`: What to do per delivery name, keyed by `BillingEventType`
- `options.store?`: Where deliveries are recorded; omitting it dispatches every delivery, replays included
- `options.logger?`: `(context) => WebhookLogger | undefined`; defaults to reading `context.logger`
- `options.retry?`: `(error, event) => boolean`; defaults to retrying a `BillingError` the platform marked retryable

##### `endpoint.handler: RequestHandler`

Answers one delivery. It is bound to the instance, so the instance itself satisfies the router's action object form and mounts directly.

What one request does, in order: read the body once, ask the provider for the delivery reference and the signature verdict, and — when a store is configured and the delivery names an id — return `200` immediately if that id is already recorded as processed, otherwise record it with its `valid` verdict before anything trusts it. An unproven delivery then answers `401` and stops. An authentic delivery whose body cannot be normalized is logged and acknowledged with `200`. Otherwise the event goes to the handler keyed by its type; a name with no handler is logged and acknowledged, and a handler that throws answers `503` when `retry` says the delivery can usefully arrive again and `200` when it cannot. Only a delivery whose handler ran to completion is marked processed, so the trail shows which handler was wrong.

`401` is the only closed door. Everything else is acknowledged, which is why an unrecognized event type is neither dropped nor failed.

##### Handler types

```typescript
type BillingEventType = BillingEvent["type"];
type BillingEventOf<Type extends BillingEventType> = /* the event narrowed to that name */;

type BillingWebhookHandlers = {
	[Type in BillingEventType]?: (event: BillingEventOf<Type>, context: RequestContext) => void | Promise<void>;
};
```

The handler map is derived from the event union, so a misspelled key is a type error and a handler keyed `"order.paid"` reaches `event.order` and nothing else.

#### `WebhookStore`

Where deliveries are kept, so idempotency has a durable key while the table stays the app's own.

```typescript
interface WebhookStore {
	find(id: string): Promise<WebhookDelivery | null>;
	record(delivery: WebhookDelivery): Promise<void>;
	markProcessed(id: string): Promise<void>;
}

interface WebhookDelivery {
	id: string;
	type: string;
	payload: string;
	valid: boolean;
	processed: boolean;
}
```

`payload` is the body exactly as received, so a replay runs against the same bytes the signature covered. `valid` and `processed` are separate fields because a forged delivery is worth keeping as evidence and an unprocessed one is worth retrying.

#### `MemoryWebhookStore`

An in-process `WebhookStore` for tests, plus a `deliveries` getter returning every recorded row in arrival order, so a test drives a redelivery without standing up a table.

### Types

#### `Money` and `Cost`

```typescript
interface Money {
	/** Minor units, always an integer. */
	amount: number;
	currency: Currency;
}

interface Cost {
	/** Minor units as a plain decimal string, e.g. `"0.003476700"`. */
	amount: string;
	currency: Currency;
}
```

Amounts a customer is charged are integer minor units, so no rounding happens in transit — but minor units are not always cents. `500` is five dollars and also five hundred yen; ask `minorUnitDigits()` rather than assuming two decimals.

Usage costs are a decimal string instead of a number, because per-unit infrastructure costs fall below `1e-6`, where a JavaScript number formats as exponential notation and a platform's parser rejects it.

#### `CustomerRef`

```typescript
type CustomerRef = { id: string } | { externalId: string };
```

A union, so a call naming neither identifier is a compile error. A provider whose platform stores no reference field of its own answers `unsupported` for the `externalId` arm — Mercado Pago does, because resolving our subject id there would mean scanning the merchant's whole payer list. An app on such a platform keeps the subject-to-provider-id mapping in its own table and names the customer by `id`.

#### `Page<T>`

```typescript
interface Page<T> {
	items: T[];
	cursor: string | null;
}
```

A page holding fewer than `limit` items is **not** necessarily the last one: a provider that filters a platform page client-side hands back a short page with more behind it. Only `cursor === null` ends a list. Lists answer 20 items when a caller names no `limit`, the same on every provider, so one call returns the same amount of work whichever platform is configured.

#### `EntitlementState`

```typescript
interface EntitlementState {
	customerId: string | null;
	externalId: string | null;
	products: string[];
	features: Readonly<Record<string, boolean>>;
	meters: MeterBalance[];
	subscriptions: EntitlementSubscription[];
	readAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}
```

`products` and the keys of `features` are our own slugs. `readAt` is when the platform answered, so a projection can record how fresh it is. `MeterBalance` is `{ meter, credited, consumed, balance }`, and `balance` is what a limit check compares against.

#### `BillingEvent`

```typescript
type BillingEvent = { id: string; raw: unknown } & BillingEventPayload;
```

`BillingEventPayload` names `customer.created`, `customer.updated`, `checkout.completed`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.revoked`, `order.paid`, `order.refunded`, and `unrecognized`. An authentic delivery outside that vocabulary arrives as `{ type: "unrecognized", providerType }`, which is what makes an event type the platform adds a no-op here rather than a failing endpoint the platform disables. `raw` travels on every event, so a platform-specific handler and a normalized one can coexist.

#### `providerData`

Every model carries the provider's own payload for that object as `providerData`. Nothing in this package interprets it. Where an app keeps a projection of provider state, keeping this beside the normalized columns is what makes a later mapping change re-derivable.

#### `Secret`

```typescript
type Secret = string | (() => string | Promise<string>);
```

The type of every credential option on every provider: the value, or a function resolving it on first use. The function is called once and its answer remembered for the life of the instance, and a failed read is not remembered. See [Configuring a credential](#configuring-a-credential).

### `@pkg/billing/middleware`

#### `billing(options: BillingMiddlewareOptions): Middleware` (default export)

Publishes the configured provider as `context.billing`. The module augments `RequestContext`, so `context.billing` is typed in every app that imports the middleware.

**Parameters:**

- `options.provider`: A `Billing`, or a `(context) => Billing` factory when the connection varies by tenant
- `options.entitlements?`: `(context) => EntitlementSnapshot | null | Promise<...>`, supplying the projection `requireEntitlement()` gates on

**Example:**

```typescript
import billing from "@pkg/billing/middleware";

let router = createRouter({ middleware: [billing({ provider: polar })] });
```

It is a default export, so the importing app names it and never needs an alias. The factory form is resolved once per request; a provider built from a module-level binding needs no factory at all.

`entitlements` is called only on a route that guards, and only once per request, so an app pays for the read where it gates.

#### `requireEntitlement(feature: string, options?: RequireEntitlementOptions): Middleware`

Admits a request only when the projection grants `feature`. The decision comes from the app's own tables, so the platform stays off the request path.

**Parameters:**

- `feature`: Our own feature slug, as a product's `features` flags name it
- `options.onDenied?`: `(context, feature) => Response | Promise<Response>`, which is where a redirect to a pricing page belongs; omitting it answers `403`

**Returns:**

- A middleware that admits entitled requests and publishes the snapshot it read as `context.entitlements`

**Throws:**

- When the billing middleware ran without an `entitlements` option

**Example:**

```typescript
import { requireEntitlement } from "@pkg/billing/middleware";

let flowsAction = createAction(routes.flows, {
	middleware: [requireEntitlement("flow_monitors")],
	handler(context) {
		return Response.json({ products: context.entitlements.products });
	},
});
```

A handler behind the guard reads `context.entitlements` rather than loading the projection a second time. `Entitlements` is exported as the context key for code that prefers `context.get(Entitlements)`.

#### `EntitlementSnapshot`

```typescript
interface EntitlementSnapshot {
	products: readonly string[];
	features: Readonly<Record<string, boolean>>;
}
```

An `EntitlementState` read back from a platform satisfies this as-is, which is what lets an app project the snapshot into its own tables and feed either shape to the guard.

### `@pkg/billing/providers/polar`

#### `PolarBilling`

A configured Polar organization, answering every group in the contract — `portal`, `discounts`, `usage` and `meters` included — over Polar's REST API, pinned to a dated API version.

##### `new PolarBilling(options: PolarBillingOptions)`

**Parameters:**

- `options.accessToken`: `Secret` — organization access token, or a function resolving one
- `options.webhookSecret`: `Secret` — signing secret for this endpoint's deliveries, exactly as Polar issued it
- `options.products`: Polar product id per our own slug, which is how a call site names a product
- `options.meters?`: Polar meter id per our own meter slug
- `options.features?`: Polar benefit id per our own feature slug
- `options.connection?`: Code stored beside every id this instance issues; defaults to `"polar"`
- `options.sandbox?`: Bill against Polar's sandbox, which shares no token and no identifier with production

`native` is the client itself, so its verb methods reach any Polar endpoint the contract omits.

### `@pkg/billing/providers/stripe`

#### `StripeBilling`

Stripe over its REST API, pinned to a Stripe API version. It answers `customers`, `catalog`, `checkouts`, `portal`, `subscriptions`, `entitlements`, `orders` and `webhooks`, and declares none of the optional groups.

##### `new StripeBilling(options: StripeBillingOptions)`

**Parameters:**

- `options.secretKey`: `Secret` — secret API key every request is authenticated with
- `options.catalog`: `Record<string, { product, price }>` keyed by our own slugs
- `options.webhookSecret?`: `Secret` — endpoint signing secret; verification fails closed without it
- `options.meters?`: Stripe meter ids per our own meter slugs, for resolving a metered price back to a slug
- `options.portalConfiguration?`: Portal configuration a session is opened against
- `options.connection?`: Defaults to `"stripe"`
- `options.externalIdKey?`: Metadata key our own customer identifier is stored under; defaults to `"external_id"`
- `options.baseURL?`: Defaults to `https://api.stripe.com/v1/`

This provider is deliberately narrow. It exists to prove the contract is a shape a second platform fits rather than one platform's API, and `orders.find`, `orders.list` and `customers.list` answer `not_implemented` on purpose.

### `@pkg/billing/providers/mercado-pago`

#### `MercadoPagoBilling`

One configured Mercado Pago account. It answers `customers`, `catalog`, `checkouts`, `subscriptions`, `entitlements`, `orders` and `webhooks`, and declares no optional group at all — no hosted portal, no discount reads, no usage, no meters.

##### `new MercadoPagoBilling(options: MercadoPagoBillingOptions)`

**Parameters:**

- `options.accessToken`: `Secret` — the account's access token, or a function resolving it
- `options.products?`: What each of our slugs sells, as a one-time or a recurring entry
- `options.webhookSecret?`: `Secret` — the application's webhook signing secret; deliveries fail closed while it is unset
- `options.notificationURL?`: Where the platform posts deliveries for the checkouts this instance opens
- `options.backURLs?`: `{ success?, failure?, pending? }`, where a hosted page returns a buyer when a call names no destination
- `options.connection?`: Defaults to `"mercado-pago"`

A configured product is one of two shapes, because the platform stores no product object for a one-time sale:

```typescript
import { MercadoPagoBilling } from "@pkg/billing/providers/mercado-pago";

let mercadoPago = new MercadoPagoBilling({
	accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
	products: {
		pro: { kind: "recurring", plan: "2c93808..." },
		book: { kind: "one_time", name: "The book", price: { amount: 10_050, currency: "ars" } },
	},
});
```

A recurring sale names a stored plan and reads its price back, so a price change in the dashboard needs no deployment. A one-time sale is priced in configuration, since a hosted checkout carries its line items inline.

Two contract answers are specific to this platform: `customers.find({ externalId })` reports `unsupported`, and `subscriptions.cancel(id, { atPeriodEnd: true })` reports `unsupported` because the platform ends an authorization at once.

### `@pkg/billing/providers/memory`

#### `MemoryBilling`

A billing platform held in memory, implementing every group including all four optional ones. It is a full implementation that passes the conformance suite, so a test asserts on the outcome of a flow it drove rather than on a mocked SDK module.

##### `new MemoryBilling(options?: MemoryBillingOptions)`

**Parameters:**

- `options.catalog?`: `Record<string, MemoryProductSeed>` — products to start with, keyed by slug
- `options.discounts?`: `MemoryDiscountSeed[]` — discounts a checkout can apply
- `options.webhookSecret?`: Base64 secret emitted deliveries are signed with, so a test can point an endpoint at the same value it configures for a real provider
- `options.connection?`: Defaults to `"memory"`

`MemoryProductSeed` is `{ amount, currency?, name?, description?, interval?, meter?, features?, credits?, archived? }`. Naming a `meter` prices it as metered, an `interval` as recurring, and neither as a one-time sale. `credits` grants meter balances to a customer holding the product.

##### `billing.seed(catalog: Record<string, MemoryProductSeed>): void`

Adds products, replacing any sharing a slug, so a test can price what it is about to sell without constructing another provider.

##### `billing.checkouts.finish(id)`

Settles an open session, because a customer coming back from this provider's hosted page is a customer who paid: it provisions the customer, the order, and any subscription the price implies. This is how a test gets a real order and subscription to assert on.

##### `billing.webhooks.emit(payload: MemoryEmitEvent): Promise<Result<MemoryDelivery, BillingError>>`

Signs and returns a delivery for an event without sending it anywhere, so a test drives a real endpoint through a real signature check.

**Parameters:**

- `payload`: A `BillingEventPayload` plus an optional `id`; omitting the id issues one, and reusing one models a redelivery

**Returns:**

- `{ request, body, headers, event }`, where `request` is the inbound request an endpoint receives

**Example:**

```typescript
let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));
let response = await endpoint.handler(new RequestContext(delivery.request));
```

`native` on this provider is the maps it keeps its state in, for an assertion no contract method covers.

### `@pkg/billing/conformance`

The suite that says what a provider is, registered as Vitest tests against whatever the caller constructs. The required core asserts only what every platform genuinely has — including in its fixtures, so nothing in it arranges state through an optional capability — and each optional group has its own function.

#### `conformance(options: ConformanceOptions): void`

The required core: the connection and `native` are stated, a customer round-trips by both identifiers, a missing customer is `not_found`, the catalog reads by our own slugs, a zero-decimal currency survives without being scaled, a hosted checkout opens and reads back, the entitlement snapshot answers, lists page one at a time and a cursor walk reaches every record, orders and subscriptions report as pages of our models, cancelling a subscription nobody holds is `not_found`, and an unproven delivery fails closed while an unreadable payload reports `invalid_request`.

#### `portalConformance`, `discountConformance`, `usageConformance`, `meterConformance`

One suite per optional group. Register only the ones the provider declares.

#### `capabilityConformance(options: ConformanceOptions): void`

Asks the capability question in both directions: a declared group must answer a real call without reporting `unsupported` or `not_implemented`, and an undeclared one must actually be absent. That is what stops a provider from declaring a capability it stubs — the compiler covers the call site, and only this covers the provider.

#### `ConformanceOptions`

**Parameters:**

- `name`: Provider name, which labels the registered suites
- `create()`: Builds the provider under test; called for every test, so mutable state starts clean
- `subscription`: A recurring product in the catalog, as `{ slug, amount, currency, priceId? }`
- `zeroDecimal`: A product priced in a currency with no minor units, so a provider that assumes cents fails here
- `meter?`: Meter to ask about; required of a provider declaring the `meters` group
- `missing?`: Ids the platform accepts the shape of and holds no record for; defaults to a fresh UUID per call
- `email?()`: Builds an unused address; defaults to a unique one per call

**Example:**

```typescript
import { capabilityConformance, conformance, portalConformance } from "@pkg/billing/conformance";
import { MemoryBilling } from "@pkg/billing/providers/memory";

let options = {
	name: "MemoryBilling",
	create: () => new MemoryBilling({ catalog: CATALOG }),
	subscription: { slug: "pro", amount: 4900, currency: "usd" },
	zeroDecimal: { slug: "tokyo", amount: 5000, currency: "jpy" },
	meter: "pings",
};

conformance(options);
portalConformance(options);
capabilityConformance(options);
```

## Pattern: One provider, two call sites

The instance is a module-scope export. A route reads it from the context and a job imports it, so both bill against the same configuration and the same connection code:

```typescript
// app/services/billing.ts
import { PolarBilling } from "@pkg/billing/providers/polar";
import { env } from "cloudflare:workers";

export let polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: env.POLAR_WEBHOOK_SECRET,
	products: { pro: "019..." },
	meters: { pings: "019..." },
});
```

```typescript
// bootstrap/app.ts
import billing from "@pkg/billing/middleware";
import { createRouter } from "remix/router";

import checkout from "~/app/http/controllers/billing/checkout";
import webhook from "~/app/http/controllers/billing/webhook";
import { polar } from "~/app/services/billing";
import routes from "~/routes/web";

let router = createRouter({
	middleware: [billing({ provider: polar })],
});

router.map(routes.billing.checkout, checkout);
router.map(routes.billing.webhook, webhook);
```

The middleware is named for the capability and the instance for the backend, which is what makes `billing({ provider: polar })` read as a sentence and keeps the vendor's name to one import.

## Pattern: A checkout controller that redirects

The package hands back a link and the route owns the redirect. A session with no `url` is no longer payable, so that is checked before redirecting rather than after:

```typescript
import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { requireCustomer } from "~/app/services/billing-customer";
import routes from "~/routes/web";

let CheckoutSchema = s.object({ product: s.string() });

/** POST /billing/checkout — opens a hosted session and sends the customer to it. */
export default createAction(routes.billing.checkout, async (context) => {
	let input = s.parse(CheckoutSchema, await context.request.formData());
	let customer = await requireCustomer(context);

	let checkout = await context.billing.checkouts.create({
		product: input.product,
		customer: { id: customer.providerCustomerId },
		returnTo: new URL(routes.billing.thanks.href(), context.url).toString(),
		idempotencyKey: `checkout_${customer.subjectId}_${input.product}`,
	});

	if (isFailure(checkout)) {
		context.logger.error("billing.checkout_failed", {
			code: checkout.error.code,
			providerCode: checkout.error.providerCode,
		});

		return redirect(routes.billing.index.href(), { status: redirect.Status.SeeOther });
	}

	if (checkout.data.url === null) {
		return redirect(routes.billing.index.href(), { status: redirect.Status.SeeOther });
	}

	return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
});
```

The same shape covers the portal, behind a `supports()` check because not every platform has one:

```typescript
if (!supports(context.billing, "portal")) return notFound();

let session = await context.billing.portal.create({ customer: { id: customerId } });
if (isFailure(session)) return serverError();

return redirect(session.data.url, { status: redirect.Status.SeeOther });
```

## Pattern: The webhook route

The endpoint is built at module scope and mounted like any other action. It satisfies the router's action object form through its bound `handler`, so the instance itself is what gets mapped:

```typescript
// routes/web.ts
import { get, post, route } from "remix/routes";

export default route({
	billing: {
		index: get("/billing"),
		thanks: get("/billing/thanks"),
		checkout: post("/billing/checkout"),
		webhook: post("/webhooks/billing"),
	},
});
```

```typescript
// app/http/controllers/billing/webhook.ts
import { BillingWebhook } from "@pkg/billing";

import { polar } from "~/app/services/billing";
import { syncEntitlements } from "~/app/services/entitlements";
import { deliveries } from "~/app/services/webhook-store";

/** POST /webhooks/billing — verifies, records and dispatches one delivery. */
export default new BillingWebhook(
	polar,
	{
		async "order.paid"(event) {
			await syncEntitlements(event.order.customerId);
		},

		async "subscription.activated"(event) {
			await syncEntitlements(event.subscription.customerId);
		},

		async "subscription.canceled"(event) {
			await syncEntitlements(event.subscription.customerId);
		},

		async "subscription.revoked"(event) {
			await syncEntitlements(event.subscription.customerId);
		},
	},
	{ store: deliveries },
);
```

Every handler here does the same thing, and that is the point: it re-reads the entitlement snapshot for the customer the event named instead of applying the payload as a diff. Deliveries arrive out of order, are replayed, and carry whatever API version the platform sent them under, so the payload is a hint that something changed and the snapshot is the state.

```typescript
// app/services/entitlements.ts
import { isFailure } from "@pkg/result";

import { polar } from "~/app/services/billing";

/** Re-reads what a customer holds and writes it into our own tables. */
export async function syncEntitlements(customerId: string | null): Promise<void> {
	if (customerId === null) return;

	let state = await polar.entitlements.of({ id: customerId });
	if (isFailure(state)) throw state.error;

	await writeProjection(customerId, state.data);
}
```

Throwing from a handler is how a failure is reported: the endpoint logs it, answers `503` when the error is retryable so the platform delivers again, and leaves the delivery unprocessed either way.

Registering handlers for only some event names is normal. An unhandled name and an `unrecognized` type are both logged and acknowledged with `200`, so the platform keeps the endpoint enabled and an event type the vendor adds is a no-op here rather than an outage.

## Pattern: A cron job that ingests usage

Some billing happens with no request in sight. The job imports the provider, checks the capability, and branches on `retryable` rather than catching:

```typescript
import { supports } from "@pkg/billing";
import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";

import { polar } from "~/app/services/billing";

/** Hourly: reports the pings each team consumed since the last run. */
export class ReportUsageJob extends Job {
	static override monitorId = "…";

	async perform(): Promise<void> {
		if (!supports(polar, "usage")) {
			return this.logger.info("billing.usage.unsupported", { connection: polar.connection });
		}

		let consumption = await readConsumptionSinceLastRun();

		let result = await polar.usage.ingest(
			consumption.map((row) => ({
				name: "pings",
				customer: { externalId: row.teamId },
				externalId: `pings_${row.teamId}_${row.hour}`,
				timestamp: row.at,
				cost: { amount: row.cost, currency: "usd" },
			})),
		);

		if (isFailure(result)) {
			if (result.error.retryable) throw new Job.RetryError(result.error.message);
			throw new Job.NonRetriableError(result.error.message);
		}

		this.logger.info("billing.usage.ingested", { accepted: result.data.accepted });
	}
}
```

Chunking to the platform's per-request limit happens inside the provider, so the whole array goes in one call. Every event carries an `externalId` derived from our own row, which is what makes a resend free: a repeated key is counted once, and `accepted` excludes it.

## Pattern: Reconciling what the webhooks missed

Deliveries get missed, so a periodic reconciliation is expected rather than optional. It is also the only recovery from an `unknown` failure, where an operation may or may not have taken effect:

```typescript
import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";

import { polar } from "~/app/services/billing";

/** Nightly: re-reads every entitlement projection older than the sweep window. */
export class ReconcileBillingJob extends Job {
	async perform(): Promise<void> {
		let stale = await readStaleProjections();

		for (let row of stale) {
			let state = await polar.entitlements.of({ id: row.providerCustomerId });

			if (isFailure(state)) {
				this.logger.error("billing.reconcile_failed", {
					code: state.error.code,
					customer: row.providerCustomerId,
				});
				continue;
			}

			await writeProjection(row.providerCustomerId, state.data);
		}
	}
}
```

The same loop is what resolves a `usage.ingest` that answered `unknown`: `usage.list({ customer, name, from, to })` reads back what the platform actually counted, and the event's own `externalId` is what identifies our attempt in it.

## Pattern: Walking a list to the end

A short page is not the last page. Follow the cursor until it is `null`, and cap the walk so a populated account cannot hang a job:

```typescript
import type { Subscription } from "@pkg/billing";

import { isFailure } from "@pkg/result";

import { polar } from "~/app/services/billing";

/** Pages a walk follows before it gives up, so a large account cannot hang the job. */
let MAX_PAGES = 50;

let cursor: string | undefined;
let subscriptions: Subscription[] = [];

for (let page = 0; page < MAX_PAGES; page++) {
	let result = await polar.subscriptions.list({ status: ["active"], limit: 100, cursor });
	if (isFailure(result)) break;

	subscriptions.push(...result.data.items);

	if (result.data.cursor === null) break;
	cursor = result.data.cursor;
}
```

## Pattern: Gating a route on an entitlement

The gate reads the app's own projection, never the platform mid-request. Configure the reader once on the middleware and apply the guard per action:

```typescript
// bootstrap/app.ts
let router = createRouter({
	middleware: [
		billing({
			provider: polar,
			entitlements: async (context) => {
				let team = context.session.get("teamId");
				if (team === undefined) return null;

				return readProjection(team);
			},
		}),
	],
});
```

```typescript
// app/http/controllers/flows.tsx
import { requireEntitlement } from "@pkg/billing/middleware";
import { redirect } from "@pkg/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** GET /app/flows — the flow monitor list, behind the feature that sells it. */
export default createAction(routes.app.flows, {
	middleware: [
		requireEntitlement("flow_monitors", {
			onDenied: () => redirect(routes.pricing.href(), { status: redirect.Status.SeeOther }),
		}),
	],

	handler(context) {
		return context.render(<FlowList products={context.entitlements.products} />);
	},
});
```

`onDenied` is where an upgrade page belongs; without it a denied request answers `403`. The guard publishes the snapshot it decided on as `context.entitlements`, so the handler behind it reads the same projection rather than loading it twice.

## Pattern: Testing a billing flow

Drive `MemoryBilling` through the flow and assert on what it produced. Nothing is mocked, so a change to the contract shows up here rather than in a stale double:

```typescript
import { BillingWebhook, MemoryWebhookStore } from "@pkg/billing";
import { MemoryBilling } from "@pkg/billing/providers/memory";
import { unwrap } from "@pkg/result";
import { RequestContext } from "remix/router";
import { expect, test } from "vitest";

test("a paid order grants the feature it sells", async () => {
	let billing = new MemoryBilling({
		catalog: {
			pro: { amount: 4900, currency: "usd", interval: "month", features: { flow_monitors: true } },
		},
	});

	let customer = await unwrap(
		billing.customers.create({ email: "jane@example.com", externalId: "u_1" }),
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

	expect((await endpoint.handler(new RequestContext(delivery.request))).status).toBe(200);
	expect(granted).toEqual(["pro"]);

	// A redelivery of the same id is acknowledged without running the handler again.
	expect((await endpoint.handler(new RequestContext(delivery.request))).status).toBe(200);
	expect(granted).toEqual(["pro"]);
	expect(store.deliveries.at(0)?.processed).toBe(true);
});
```

## Pattern: Writing a new provider

Implement `Billing`, then register the conformance suites for the required core plus every group the platform actually has:

```typescript
import { capabilityConformance, conformance, portalConformance } from "@pkg/billing/conformance";

import { AcmeBilling } from "./index";

let options = {
	name: "AcmeBilling",
	create: () =>
		new AcmeBilling({
			apiKey: process.env["ACME_TEST_KEY"] ?? "",
			catalog: { pro: "prod_pro", tokyo: "prod_tokyo" },
		}),
	subscription: { slug: "pro", amount: 4900, currency: "usd" },
	zeroDecimal: { slug: "tokyo", amount: 5000, currency: "jpy" },
};

describe.skip("AcmeBilling against a sandbox account", () => {
	conformance(options);
	portalConformance(options);
	capabilityConformance(options);
});
```

Type every credential option as `Secret` and read it through `secretReader` from `src/core/secret.ts`, so a new provider is configurable from a secret store the way the others are, and read a signing secret with `verificationSecret` so an unreadable one leaves a delivery unproven instead of failing the endpoint.

`MemoryBilling` is the template to read while writing one: it implements every group, and it is the provider the suite runs against in CI, which is what keeps the suite itself honest.

## Related Packages

- [`@pkg/result`](/packages/result) — the `Result` every billing call reports through
- [`@pkg/api-client`](/packages/api-client) — the HTTP client base class the network-backed providers extend
- [`@pkg/webhooks`](/packages/webhooks) — Standard Webhooks signing and verification, used by the providers whose platform follows it
- [`@pkg/crypto`](/packages/crypto) — the HMAC primitives behind a provider's own signature scheme
- [`@pkg/validate`](/packages/validate) — validates a platform's response before any mapping runs
- [`@pkg/jobs`](/packages/jobs) — the base class for the ingestion and reconciliation jobs that bill outside a request
- [`@pkg/logger`](/packages/logger) — the request logger the webhook endpoint reports through when an app installs one

## Tips

1. **Branch on the `Result`, never on a thrown error** — nothing here throws, so a `try`/`catch` around a billing call catches only your own bugs.
2. **Read `not_found` as an answer** — a `find*` reports a missing record as a failure rather than `null`, which is what stops a missing customer from becoming a null dereference three lines later.
3. **Never retry an `unknown`** — the operation may already have taken effect, so recovery is a reconciliation read against the platform, and `retryable` is never `true` for it.
4. **Construct the provider once, at module scope** — the constructor touches no network, and one instance is what lets a route and a job bill against the same configuration.
5. **Hand a credential in as a function when it lives in a secret store** — the constructor cannot await, so the function form is what defers that read to the first call and keeps it to one await for the life of the instance.
6. **Ask `supports()` before reaching an optional group** — `portal`, `discounts`, `usage` and `meters` may be absent, and the guard is what makes the code typecheck as well as run.
7. **Store the connection beside every provider id** — one vendor can hold several accounts, and `connection` is what says which credential set issued the id you are looking at.
8. **Ask `minorUnitDigits()` before formatting money** — dividing by 100 unconditionally is wrong for JPY and CLP, which have no minor units, and for BHD and KWD, which have three.
9. **Keep a usage cost a string** — `Cost.amount` is a decimal string because per-unit costs fall below `1e-6`, where a number formats as exponential notation and a platform rejects it.
10. **Follow the cursor, not the item count** — a page shorter than `limit` is not necessarily the last, so only `cursor === null` ends a list.
11. **Re-read state in a webhook handler** — the payload says something changed, and `entitlements.of()` says what is true now; applying a payload as a diff is how out-of-order deliveries corrupt a projection.
12. **Run a reconciliation job** — deliveries get missed, so a periodic sweep re-reading the snapshot is part of adopting this package rather than an optimization.
13. **Give a store to the webhook endpoint** — without one, every delivery dispatches, replays included, so the handlers themselves have to be idempotent.
14. **Send an `externalId` with every usage event** — it is the idempotency key, so a resent batch is counted once and a failed ingest can be retried safely.
15. **Use `MemoryBilling` rather than mocking an SDK** — it is a full implementation that passes the same conformance suite, so it fails when the contract changes instead of quietly drifting.
16. **The Stripe provider is not adopted by anything** — it exists to prove the contract fits a second platform, and its `orders` group answers `not_implemented` on purpose, so treat it as a starting point rather than a supported backend.
17. **No conformance suite has run against a real sandbox yet** — every remote suite is written and skipped pending credentials, so a provider's mapping of live payloads is unverified until that run happens.
18. **Mercado Pago leaves the app as the seller of record** — it is a payment processor rather than a merchant of record, so tax registration, invoicing obligations, remittance, and disputes belong to the app and are handled outside this package.
