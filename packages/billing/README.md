# @sdxc/billing

Vendor-neutral billing: one provider contract every payment platform is reached through, plus a
webhook endpoint that verifies and deduplicates deliveries.

Code is written against `Customer`, `Subscription`, `Order`, `Checkout` and
`EntitlementState`, and a platform is reached through the `Billing` contract, so a vendor's
name appears in one import and one construction site rather than in every service, column and
handler.

Nothing here throws: every method answers a `Result`, and a `find*` that matches nothing
answers a `not_found` failure rather than `null`. Purchases are hosted links only — checkout
and portal hand back a URL, so no card data passes through this package.

## Installation

```bash
npm add @sdxc/billing
```

Every call reports through a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure`,
`isSuccess` and `unwrap` come from; it installs alongside this package. The middleware and the
webhook endpoint mount into a [`remix`](https://www.npmjs.com/package/remix) fetch router, and
the conformance entry registers [Vitest](https://vitest.dev) tests.

## Usage

### Construct A Provider

A provider is a class, built once at module scope. Nothing reaches the network in the
constructor, so an instance costs no startup work and can be imported anywhere:

```typescript
import type { Billing } from "@sdxc/billing";

import { PolarBilling } from "@sdxc/billing/providers/polar";

export let polar: Billing = new PolarBilling({
	accessToken: () => readSecret("POLAR_ACCESS_TOKEN"),
	webhookSecret: () => readSecret("POLAR_WEBHOOK_SECRET"),
	products: { pro: "019...", team: "019..." },
	meters: { pings: "019..." },
	features: { reports: "019..." },
});
```

Products, meters and features are configured as your own slugs mapped to the platform's ids,
which is what keeps a vendor identifier out of every call site: a checkout is opened for
`"pro"`, and a subscription read answers `productSlug: "pro"`.

Annotate the export as `Billing` rather than letting it infer the concrete class. It keeps the
rest of the code written against the contract, and it is what makes `supports()` usable: a
concrete `PolarBilling` statically has `usage`, so a guard against it narrows its own false
branch away. A job outside a request imports this same module-scope instance, so there is no
second construction and no second configuration.

### Open A Hosted Checkout

The package answers a link; the route owns the redirect. A session with no `url` is no longer
payable, so that is checked before redirecting:

```typescript
import { isFailure } from "@sdxc/result";
import { redirect } from "remix/response/redirect";

let checkout = await polar.checkouts.create({
	product: "pro",
	customer: { id: customerId },
	returnTo: "https://example.com/billing/thanks",
	allowDiscountCodes: false,
	idempotencyKey: `checkout_${attemptId}`,
});

if (isFailure(checkout) || checkout.data.url === null) {
	return new Response(null, { status: 502 });
}

return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
```

### Bill Through The Router Middleware

The middleware is a default export, so the importing module names it. It publishes the
configured provider as `context.billing`, typed by an augmentation the module itself declares:

```typescript
import billing from "@sdxc/billing/middleware";
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [billing({ provider: polar })] });

router.get("/billing/subscription", async (context) => {
	let state = await context.billing.entitlements.of({ id: customerId });

	if (isFailure(state)) return new Response(null, { status: 502 });

	return Response.json({ products: state.data.products });
});
```

### Test Without A Platform

`MemoryBilling` is a full implementation of the contract, not a mock: it passes the same
conformance suite the network-backed providers do, so state a call writes is state the next
call reads.

```typescript
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { unwrap } from "@sdxc/result";

let billing = new MemoryBilling({
	catalog: {
		pro: { amount: 4900, currency: "usd", interval: "month", features: { reports: true } },
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

Providers live behind their own subpaths and are never re-exported from the root, so a bundle
resolves only the provider that is imported. The conformance suite imports `vitest`, so it
stays out of the root entry too.

| Entry                                  | Contents                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `@sdxc/billing`                        | The models, the `Billing` contract, `BillingError`, `supports()`, `BillingWebhook` |
| `@sdxc/billing/middleware`             | The router middleware publishing `context.billing`, plus `requireEntitlement()`    |
| `@sdxc/billing/providers/polar`        | `PolarBilling`, which answers every group                                          |
| `@sdxc/billing/providers/stripe`       | `StripeBilling`, a deliberately narrow provider                                    |
| `@sdxc/billing/providers/mercado-pago` | `MercadoPagoBilling`, a payment processor rather than a merchant of record         |
| `@sdxc/billing/providers/memory`       | `MemoryBilling`, a full in-memory platform for tests                               |
| `@sdxc/billing/conformance`            | The shared suite every provider passes, plus one suite per optional capability     |

### `Billing`

The provider contract: one instance carrying every operation, grouped by resource, so a job and
a route use the same object.

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

	/** Present only on a platform that hosts a payer-facing management page. */
	readonly portal?: PortalApi;
	/** Present only on a platform whose API exposes its coupons. */
	readonly discounts?: DiscountApi;
	/** Present only on a platform that accepts usage. */
	readonly usage?: UsageApi;
	/** Present only on a platform that meters. */
	readonly meters?: MeterApi;

	readonly native: unknown;
}
```

`connection` names a configured credential set rather than a vendor, since one vendor holds
several accounts, and it is the value to store beside every provider id you keep. `native` is
the underlying client, for the endpoints the contract does not model; it is `unknown`, so
reaching it is a deliberate cast.

### The resource groups

Every method answers a `Result<T, BillingError>`.

```typescript
customers.create(input: CreateCustomerInput)
customers.update(customer: CustomerRef, input: UpdateCustomerInput)
customers.find(customer: CustomerRef)
customers.findByEmail(email: string)
customers.list(query?: { email?, limit?, cursor? })

catalog.find(slug: string)
catalog.list(query?: { archived?, limit?, cursor? })

checkouts.create(input: CreateCheckoutInput)
checkouts.find(checkout: string)
checkouts.finish(checkout: string)

subscriptions.find(subscription: string)
subscriptions.list(query?: { customer?, product?, status?, limit?, cursor? })
subscriptions.cancel(subscription: string, options?: { atPeriodEnd?: boolean })

entitlements.of(customer: CustomerRef)

orders.find(order: string)
orders.list(query?: { customer?, product?, subscription?, limit?, cursor? })

portal.create(input: { customer: CustomerRef; returnTo?: string })

discounts.find(discount: string)
discounts.findByCode(code: string)
discounts.list(query?: { product?, limit?, cursor? })

usage.ingest(events: readonly UsageEvent[])
usage.list(query?: { customer?, name?, from?, to?, limit?, cursor? })

meters.quantities(query: { meter, customer?, from, to, interval })

webhooks.verify(request: Request, rawBody: string): Promise<boolean>
webhooks.reference(request: Request, rawBody: string): WebhookReference | null
webhooks.event(request: Request, rawBody: string)
```

**Customers are joined on your own id.** `CreateCustomerInput` is
`{ email, externalId, name?, metadata? }`, and `externalId` is required because it is the key
that makes a customer re-resolvable; platforms treat it as immutable once set, so a taken one
answers `conflict`. `UpdateCustomerInput` is `{ email?, name?, externalId?, metadata? }`,
where naming `externalId` adopts a platform customer that carries none.

**The catalog and the discounts are read-only, addressed by your own slugs.** Products, prices
and coupons are created in the platform's dashboard; archived products stay readable because
old orders point at them, and `findByCode` turns a code typed into your own form into the id
`checkouts.create({ discount })` accepts.

**A purchase is a hosted link.** `CreateCheckoutInput` is
`{ product, customer?, email?, returnTo?, discount?, quantity?, metadata?, allowDiscountCodes?, idempotencyKey? }`.
Omitting `customer` lets the hosted page collect the buyer's identity, which is what a sale to
someone with no account yet needs, and `allowDiscountCodes: false` closes the code field on
that page. `finish` is the call a return route makes for a customer who has just come back from
it — separate from `find` because a delivery from the platform and a customer standing in front
of you differ in trust and in who is waiting.

**`idempotencyKey` correlates a retried open with the first attempt.** A platform with an
idempotency header answers the same session for it, so a double-submitted form bills once; a
platform with none records it on the session, which makes the second session attributable
without preventing it, so a caller wanting one session per attempt keys its own store on the
same value.

**Nothing creates a subscription.** One comes into existence when a checkout completes and is
announced by an event. `cancel` is the one write every platform in scope offers, and
`atPeriodEnd: true` on a platform that can only cancel immediately answers `unsupported`.

**`entitlements.of` is the sync primitive.** One call answers everything a customer holds right
now: write that snapshot into your own tables and have requests read those, so the platform
stays off the request path. An `Order` likewise names the buyer three ways — `customerId`,
`customerEmail` and `customerExternalId` — so an `order.paid` handler fulfilling a sale needs
no second read to learn an address it was already sent.

**A row naming an unconfigured product costs that row, not the page.** A list skips it and logs
`billing.skipped_row`, so one plan sold elsewhere in the organization does not take down the
read; `find` reports it as a failure, because a caller asking for one record by id is asking
about exactly that record.

**`usage.ingest` answers `{ accepted }`,** counting a resent `externalId` once, and chunks to
the platform's per-request limit inside the provider, so a caller hands over the whole array.
`usage.list` reads back what the platform actually counted. A meter read states its own window:
`from`, `to` and `interval` are all required, because a default chosen inside a provider would
make the same query mean different things on two platforms.

**`webhooks` asks three narrow questions.** Verification stays per-platform because signing
schemes differ; deduplication, persistence and dispatch live in `BillingWebhook`.
`WebhookReference` is `{ deliveryId, object: { id, type } | null }`: the delivery id and the
object are separate because a platform sends several distinct deliveries about one object, and
deduplicating on the object would drop all but the first.

### `BillingError`

The single failure type inside every billing `Result`. It carries `code`, the `connection` the
failing call was made against, the platform's own `providerCode` (or `null`), whether a repeat
is `retryable`, and the `retryAfter` seconds the platform asked for (or `null`).

`BillingErrorCode` is `not_found`, `invalid_request`, `unauthenticated`, `forbidden`,
`conflict`, `rate_limited`, `invalid_response`, `unsupported`, `not_implemented` or `unknown`.
Only `rate_limited` is retryable by default, and a provider may override `retryable` when it
knows better. Four codes are worth reading closely:

- `unknown` is a timeout or a 5xx: the operation may or may not have taken effect, so recovery
  is a reconciliation read against the platform. `retryable` is never `true` for it.
- `invalid_response` is a 2xx in a shape these models cannot express — the platform is fine and
  the mapping is not, so it must not send a caller into reconciliation.
- `unsupported` means the platform cannot do this at all.
- `not_implemented` means this provider has not done it yet.

### `supports(billing: Billing, capability: OptionalCapability): boolean`

Narrows an optional resource group to present, so code reading that group typechecks only
against a platform that has it. `OptionalCapability` is derived from which contract properties
are optional, and `OPTIONAL_CAPABILITIES` is the array of all four — `"discounts"`,
`"meters"`, `"portal"`, `"usage"` — which the conformance run iterates.

```typescript
import { supports } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

if (!supports(polar, "meters")) return new Response(null, { status: 404 });

let reading = await polar.meters.quantities({
	meter: "pings",
	customer: { id: customerId },
	from: startOfMonth,
	to: now,
	interval: "day",
});

if (isFailure(reading)) return new Response(null, { status: 502 });

return Response.json({ quantity: reading.data.quantity });
```

### `minorUnitDigits(currency: Currency): number`

Digits after the decimal separator for an ISO 4217 code in any letter case: `0` for JPY and
CLP, `3` for BHD and KWD, `2` for everything outside the exception table. Dividing every
`Money` by 100 instead turns ¥5,000 into ¥50 and 5.000 KWD into 500 KWD.

### `DEFAULT_PAGE_SIZE`

The `20` items a list answers when a caller names no `limit`, shared by every provider so one
call returns the same amount of work whichever platform is configured.

### `BillingWebhook`

The webhook endpoint as a class, constructed at module scope with
`new BillingWebhook(provider, handlers, options?)`. `options.store` is where deliveries are
recorded — omitting it dispatches every delivery, replays included — and `options.retry` is
`(error, event) => boolean`, defaulting to retrying a `BillingError` the platform marked
retryable. `endpoint.handler` is a `RequestHandler` bound to the instance, so the instance
itself satisfies the router's action object form and mounts directly.

One request, in order: read the body once, ask the provider for the delivery reference and the
signature verdict, and — with a store configured — answer `200` at once for a delivery already
recorded as processed, otherwise record it with its `valid` verdict before anything trusts it.
An unproven delivery then answers `401` and stops. An authentic delivery whose body cannot be
normalized is logged and acknowledged. Otherwise the event goes to the handler keyed by its
type; a name with no handler is logged and acknowledged, and a handler that throws answers
`503` when `retry` says the delivery can usefully arrive again and `200` when it cannot. Only a
delivery whose handler ran to completion is marked processed, so the trail shows which handler
was wrong.

`401` is the only closed door. Everything else is acknowledged, because an error response is
how a platform decides an endpoint is broken and stops calling it.

```typescript
type BillingWebhookHandlers = {
	[Type in BillingEventType]?: (
		event: BillingEventOf<Type>,
		context: RequestContext,
	) => void | Promise<void>;
};
```

The map is derived from the event union, so a misspelled key is a type error and a handler
keyed `"order.paid"` reaches `event.order` and nothing else.

### `WebhookStore` and `MemoryWebhookStore`

Where deliveries are kept, so idempotency has a durable key while the table stays yours.

```typescript
interface WebhookStore {
	find(id: string): Promise<WebhookDelivery | null>;
	record(delivery: WebhookDelivery): Promise<void>;
	markProcessed(id: string): Promise<void>;
}

interface WebhookDelivery {
	id: string;
	type: string;
	/** The body exactly as received, so a replay runs against the same bytes. */
	payload: string;
	valid: boolean;
	processed: boolean;
}
```

`valid` and `processed` are separate fields because a forged delivery is worth keeping as
evidence and an unprocessed one is worth retrying. `MemoryWebhookStore` is an in-process
implementation with a `deliveries` getter answering every recorded row in arrival order, so a
test drives a redelivery without standing up a table.

### `@sdxc/billing/middleware`

`billing(options)` is the default export. It publishes the configured provider as
`context.billing`, augmenting `RequestContext` from the imported module so the property is
typed wherever the middleware is used. `options.provider` is a `Billing` or a
`(context) => Billing` factory for a connection that varies by tenant, resolved once per
request. `options.entitlements` is `(context) => EntitlementSnapshot | null | Promise<…>`,
supplying the projection `requireEntitlement()` gates on; it is called only on a route that
guards, and only once per request.

`requireEntitlement(feature, options?)` admits a request only when that projection grants
`feature`, so the decision comes from your own tables. `options.onDenied` is
`(context, feature) => Response | Promise<Response>`, which is where an upgrade prompt or a
redirect to a pricing page belongs; omitting it answers `403`. It throws when the billing
middleware ran without an `entitlements` option, and it publishes the snapshot it decided on as
`context.entitlements`, so the handler behind it reads the same projection rather than loading
it twice. `Entitlements` is exported as the context key for code preferring
`context.get(Entitlements)`.

`EntitlementSnapshot` is `{ products: readonly string[]; features: Readonly<Record<string, boolean>> }`,
which an `EntitlementState` read back from a platform satisfies as-is.

### `@sdxc/billing/providers/polar`

`PolarBilling` is a configured [Polar](https://polar.sh) organization, answering every group in
the contract — `portal`, `discounts`, `usage` and `meters` included — over Polar's REST API.
`native` is the client itself, so its verb methods reach any endpoint the contract omits.

`new PolarBilling(options)` takes `accessToken` (a `Secret`; the organization access token),
`webhookSecret?` (a `Secret`, exactly as Polar issued it), `products?` and `meters?` and
`features?` (Polar ids keyed by your own slugs), `connection?` (default `"polar"`) and
`sandbox?` (Polar's sandbox, which shares no token and no identifier with production).
Configuring no products suits an instance that only mirrors customers; every read addressing a
product then reports the slug as unknown.

### `@sdxc/billing/providers/stripe`

`StripeBilling` reaches [Stripe](https://stripe.com) over its REST API and answers `customers`,
`catalog`, `checkouts`, `portal`, `subscriptions`, `entitlements`, `orders` and `webhooks`,
declaring none of the optional groups. It is deliberately narrow — it exists to prove the
contract is a shape a second platform fits rather than one platform's API — and `orders.find`,
`orders.list` and `customers.list` answer `not_implemented`.

`new StripeBilling(options)` takes `secretKey` (a `Secret`), `catalog`
(`Record<string, { product, price }>` keyed by your own slugs), `webhookSecret?` (a `Secret`),
`meters?` (Stripe meter ids per your own meter slugs), `portalConfiguration?`, `connection?`
(default `"stripe"`), `externalIdKey?` (the metadata key your own customer identifier is stored
under, default `"external_id"`) and `baseURL?` (default `https://api.stripe.com/v1/`).

### `@sdxc/billing/providers/mercado-pago`

`MercadoPagoBilling` is one configured [Mercado Pago](https://www.mercadopago.com) account,
answering `customers`, `catalog`, `checkouts`, `subscriptions`, `entitlements`, `orders` and
`webhooks`, and declaring no optional group at all. Mercado Pago is a payment processor rather
than a merchant of record, so tax registration, invoicing, remittance and disputes stay yours
and are handled outside this package.

`new MercadoPagoBilling(options)` takes `accessToken` (a `Secret`), `products?`,
`webhookSecret?` (a `Secret`), `notificationURL?` (where the platform posts deliveries for the
checkouts this instance opens), `backURLs?` (`{ success?, failure?, pending? }`) and
`connection?` (default `"mercado-pago"`). A configured product takes one of two shapes, because
the platform stores no product object for a one-time sale:

```typescript
import { MercadoPagoBilling } from "@sdxc/billing/providers/mercado-pago";

let mercadoPago = new MercadoPagoBilling({
	accessToken: () => readSecret("MERCADO_PAGO_ACCESS_TOKEN"),
	products: {
		pro: { kind: "recurring", plan: "2c93808..." },
		book: { kind: "one_time", name: "The book", price: { amount: 10_050, currency: "ars" } },
	},
});
```

A recurring sale names a stored plan and reads its price back, so a price change in the
dashboard needs no deployment; a one-time sale is priced in configuration, since a hosted
checkout carries its line items inline. Two answers are specific to this platform:
`customers.find({ externalId })` reports `unsupported`, because the stored payer carries your
reference in metadata but exposes no filter for it, and
`subscriptions.cancel(id, { atPeriodEnd: true })` reports `unsupported` because the platform
ends an authorization at once.

### `@sdxc/billing/providers/memory`

`MemoryBilling` is a billing platform held in memory, implementing every group including all
four optional ones, and passing the conformance suite. `new MemoryBilling(options?)` takes
`catalog?` (`Record<string, MemoryProductSeed>`), `discounts?` (`MemoryDiscountSeed[]`),
`faults?` (failures armed from the first call), `webhookSecret?` (a base64 secret emitted
deliveries are signed with) and `connection?` (default `"memory"`).

`MemoryProductSeed` is
`{ amount, currency?, name?, description?, interval?, meter?, features?, credits?, archived? }`:
naming a `meter` prices it as metered, an `interval` as recurring, and neither as a one-time
sale, while `credits` grants meter balances to a customer holding the product.
`MemoryDiscountSeed` is
`{ id?, code?, name?, percentage?, amount?, currency?, products?, maxRedemptions?, redemptions?, startsAt?, endsAt? }`,
so a seeded campaign can start part-way through its window and its redemptions.

Beyond the contract it adds five calls:

- `seed(catalog)` adds products, replacing any sharing a slug.
- `fail(target, code?)` arms a failure on a group, such as `"customers"`, or on one method,
  such as `"subscriptions.list"`, checked on every call from then on; `code` defaults to
  `"unknown"`, a method-level fault wins over one armed on its group, and the target type is
  derived from the contract's own groups so a misspelled one is a compile error.
- `heal(target?)` takes an armed failure away; omitting the target disarms everything.
- `with(overrides)` answers the platform a call site sees with the named groups answered by
  something else. It is a plain object rather than the instance, so every group it does not
  name still answers from memory, and naming an optional group as `undefined` leaves it absent,
  which is how a `supports()` guard's false branch gets exercised.
- `webhooks.emit(payload)` signs and answers `{ request, body, headers, event }` for an event
  without sending it anywhere, so a test drives a real endpoint through a real signature check.
  `payload` is a `BillingEventPayload` plus an optional `id`; omitting the id issues one, and
  reusing one models a redelivery.

`checkouts.finish` settles an open session here, because a customer coming back from this
provider's hosted page is a customer who paid: it provisions the customer, the order, and any
subscription the price implies, which is how a test gets a real order to assert on.

### `@sdxc/billing/conformance`

The suite that says what a provider is, registered as Vitest tests against whatever the caller
constructs.

`conformance(options)` registers the required core: the connection and `native` are stated, a
customer round-trips by both identifiers, a missing customer is `not_found`, the catalog reads
by your own slugs, a zero-decimal currency survives without being scaled, a hosted checkout
opens and reads back, the entitlement snapshot answers, lists page one at a time and a cursor
walk reaches every record, orders and subscriptions report as pages of these models, cancelling
a subscription nobody holds is `not_found`, and an unproven delivery fails closed while an
unreadable payload reports `invalid_request`.

`portalConformance`, `discountConformance`, `usageConformance` and `meterConformance` are one
suite per optional group; register only the ones the provider declares.
`capabilityConformance(options)` asks the capability question in both directions: a declared
group must answer a real call without reporting `unsupported` or `not_implemented`, and an
undeclared one must actually be absent, which is what stops a provider from declaring a
capability it stubs.

`ConformanceOptions` is `name` (which labels the registered suites), `create()` (builds the
provider under test, called for every test so mutable state starts clean), `subscription` (a
recurring product in the catalog, as `{ slug, amount, currency, priceId? }`), `zeroDecimal` (a
product priced in a currency with no minor units, so a provider that assumes cents fails here),
`meter?` (required of a provider declaring the `meters` group), `missing?` (ids the platform
accepts the shape of and holds no record for; defaults to a fresh UUID per call) and `email?()`
(builds an unused address; defaults to a unique one per call).

### Types

```typescript
/** An amount a customer is charged. `amount` is integer minor units. */
interface Money {
	amount: number;
	currency: Currency;
}

/** A usage cost. `amount` is minor units as a plain decimal string, e.g. `"0.003476700"`. */
interface Cost {
	amount: string;
	currency: Currency;
}

type CustomerRef = { id: string } | { externalId: string };

interface Page<T> {
	items: T[];
	cursor: string | null;
}

type BillingEvent = { id: string; raw: unknown } & BillingEventPayload;

type Secret = string | (() => string | Promise<string>);
```

**Minor units are not always cents.** `500` is five dollars and also five hundred yen, so ask
`minorUnitDigits()` rather than assuming two decimals. A usage cost is a decimal string
instead, because per-unit infrastructure costs fall below `1e-6`, where a JavaScript number
formats as exponential notation and a platform's parser rejects it.

**`CustomerRef` is a union,** so a call naming neither identifier is a compile error. A provider
whose platform stores no reference field of its own answers `unsupported` for the `externalId`
arm; on such a platform, keep the subject-to-provider-id mapping in your own table and name the
customer by `id`.

**A short page is not the last page.** A provider filtering a platform page client-side hands
back a page holding fewer than `limit` items with more behind it, so only `cursor === null`
ends a list.

**`EntitlementState` is what a projection stores:**
`{ customerId, externalId, products, features, meters, subscriptions, readAt, providerData }`.
`products` and the keys of `features` are your own slugs, `readAt` is when the platform
answered, `MeterBalance` is `{ meter, credited, consumed, balance }` where `balance` is what a
limit check compares against, and `EntitlementSubscription` is
`{ subscriptionId, productSlug, status, currentPeriodStart?, currentPeriodEnd, cancelAtPeriodEnd }`
with both period dates filled, so storing the period needs no second `subscriptions.find()`.

**`BillingEventPayload` names** `customer.created`, `customer.updated`, `checkout.completed`,
`subscription.activated`, `subscription.updated`, `subscription.canceled`,
`subscription.revoked`, `order.paid`, `order.refunded`, and `unrecognized`. An authentic
delivery outside that vocabulary arrives as `{ type: "unrecognized", providerType }`, which is
what makes an event type the platform adds a no-op here rather than a failing endpoint the
platform disables. `raw` travels on every event, so a platform-specific handler and a
normalized one can coexist.

**`Secret` is the type of every credential option.** The function form is what lets a credential
live in a store only readable with an `await`, since a constructor at module scope can await
nothing; it is called on the first use that needs the credential and its answer is remembered
for the life of the instance, while a read that fails is not remembered, so a store that was
briefly unavailable is asked again. While a signing secret is unset, empty or unreadable,
verification answers `false` rather than throwing, so an endpoint keeps answering a status the
platform accepts instead of the `500` it disables an endpoint over.

**Every model carries `providerData`,** the provider's own payload for that object. Nothing in
this package interprets it. Where you keep a projection of provider state, storing this beside
the normalized columns is what makes a later mapping change re-derivable.

## Pattern: Syncing Entitlements From Webhooks

The endpoint is built at module scope and mounted like any other action, since its bound
`handler` satisfies the router's action object form:

```typescript
import { BillingWebhook } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

/** Re-reads what a customer holds and writes it into our own tables. */
async function syncEntitlements(customerId: string | null): Promise<void> {
	if (customerId === null) return;

	let state = await polar.entitlements.of({ id: customerId });
	if (isFailure(state)) throw state.error;

	await writeProjection(customerId, state.data);
}

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

Every handler does the same thing, and that is the point: it re-reads the snapshot for the
customer the event named instead of applying the payload as a diff. Deliveries arrive out of
order, are replayed, and carry whatever API version the platform sent them under, so the
payload is a hint that something changed and the snapshot is the state. Throwing reports a
failure: the endpoint logs it, answers `503` when the error is retryable so the platform
delivers again, and leaves the delivery unprocessed either way.

Deliveries get missed, so a periodic reconciliation is part of adopting this package. The same
sweep is what resolves an operation that answered `unknown`, where it may or may not have taken
effect:

```typescript
import { isFailure } from "@sdxc/result";

for (let row of await readStaleProjections()) {
	let state = await polar.entitlements.of({ id: row.providerCustomerId });
	if (isFailure(state)) continue;

	await writeProjection(row.providerCustomerId, state.data);
}
```

## Pattern: Gating A Route On An Entitlement

The gate reads your own projection, never the platform mid-request. Configure the reader once
on the middleware and apply the guard per route:

```typescript
import billing from "@sdxc/billing/middleware";
import { createRouter } from "remix/router";

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
import { requireEntitlement } from "@sdxc/billing/middleware";
import { redirect } from "remix/response/redirect";

router.get("/app/reports", [requireEntitlement("reports", { onDenied })], (context) => {
	return Response.json({ products: context.entitlements.products });
});

function onDenied(): Response {
	return redirect("/pricing", { status: redirect.Status.SeeOther });
}
```

`onDenied` receives the request context, so a denied request can equally render an upgrade
prompt in place, keeping the visitor at the URL they asked for. Without it a denied request
answers `403`.

## Pattern: Reporting Usage From A Scheduled Job

Some billing happens with no request in sight. The job imports the module-scope provider,
checks the capability, and branches on `retryable` rather than catching:

```typescript
import { supports } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

/** Hourly: reports the pings each team consumed since the last run. */
export async function reportUsage(): Promise<void> {
	if (!supports(polar, "usage")) return;

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

	if (isFailure(result) && result.error.retryable) throw result.error;
}
```

Chunking to the platform's per-request limit happens inside the provider, so the whole array
goes in one call. Every event carries an `externalId` derived from your own row, which is what
makes a resend free: a repeated key is counted once, and `accepted` excludes it.

## Pattern: Walking A List To The End

A short page is not the last page. Follow the cursor until it is `null`, and cap the walk so a
populated account cannot hang a job:

```typescript
import type { Subscription } from "@sdxc/billing";

import { isFailure } from "@sdxc/result";

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

## Pattern: Testing A Billing Flow

Drive `MemoryBilling` through the flow and assert on what it produced. Nothing is mocked, so a
change to the contract shows up here rather than in a stale double:

```typescript
import { BillingWebhook, MemoryWebhookStore } from "@sdxc/billing";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { unwrap } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { expect, test } from "vitest";

test("a paid order grants the feature it sells", async () => {
	let billing = new MemoryBilling({
		catalog: {
			pro: { amount: 4900, currency: "usd", interval: "month", features: { reports: true } },
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

A platform that is unreachable, rate-limited or refusing one group is a path worth a test, and
`MemoryBilling` arms it on the instance the test already holds:

```typescript
billing.fail("entitlements.of", "unknown");

expect(isFailure(await billing.entitlements.of({ id: customer.id }))).toBe(true);

billing.heal("entitlements.of");
```

Arm a whole group when the test is about an outage, and one method when it is about a single
read, since a method-level fault wins over its group's. A test that needs a group to answer
something else, or to be absent entirely, asks for `billing.with({ … })` instead.

## Pattern: Writing A Provider

Implement `Billing`, then register the conformance suites for the required core plus every
group the platform actually has:

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

Type every credential option as `Secret`, so a new provider is configurable from a secret store
the way the others are, and answer `false` from `webhooks.verify` when that secret is
unreadable, so an unproven delivery leaves the endpoint answering a status the platform
accepts. Declare an optional group only where the platform genuinely has it:
`capabilityConformance` asserts a declared group against a real call and an undeclared one
against its own absence.

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
