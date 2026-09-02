# ADR-043: Provider-Agnostic Billing Package

## Status

**Proposed** - 2026-09-02

## Background

Billing in the monorepo is Polar, spelled out. `@pkg/polar` wraps `@polar-sh/sdk` behind one 948-line `PolarClient` class with 26 public methods, and it re-exports the vendor's own `Customer`, `Subscription`, `Product`, `Discount`, `Order`, `Checkout`, and `CustomerSession` models as the types five apps program against. Those apps also store the vendor's identifiers as column names (`polar_customer_id`, `polar_subscription_id`, `polar_product_id`), name their webhook routes after the vendor, and name their secrets after it.

Polar is the right merchant of record for the products sold today, and nothing here proposes leaving it. What it proposes is that leaving it, or adding a second provider for a product Polar cannot sell, should be a change to one package and a handful of construction sites rather than a rewrite of every billing surface in every app. The current shape makes the provider a load-bearing type: swapping it means touching every call site, every stored column, every test double, and every webhook handler at once.

## Context

### Current State

| Location                                                    | What it does                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/polar/src/index.ts`                               | `PolarClient`: 26 methods over customers, subscriptions, products, discounts, orders, checkouts, portal, usage, webhooks |
| `apps/auth-saas/app/models/subscription.ts`                 | Module-level lazy `PolarClient`, reads subscription state, catches `PolarError`                                          |
| `apps/auth-saas/app/jobs/report-mau.ts`                     | Daily `reportMAU` per tenant                                                                                             |
| `apps/auth-saas/app/http/controllers/api/webhooks/polar.ts` | Constructs a client per delivery to call `verifyWebhook`                                                                 |
| `apps/blog-saas/app/http/controllers/dashboard/billing.tsx` | Checkout and portal redirects, injected via the service container                                                        |
| `apps/blog-saas/app/jobs/report-usage.ts`                   | Daily `ingestPageViews` per account                                                                                      |
| `apps/books/app/http/controllers/checkout.ts`               | Discounted `createCheckout` for one-time product sales                                                                   |
| `apps/books/app/http/controllers/upgrade.tsx`               | `findCustomerByEmail` plus `listOrders` to gate an upgrade price                                                         |
| `apps/books/app/http/controllers/release.tsx`               | `getProduct` twice to render live prices                                                                                 |
| `apps/books/app/http/controllers/webhooks/polar.ts`         | `parseWebhook`, then branches on `order.paid`                                                                            |
| `apps/r3-auth/app/services/customer.ts`                     | Provisions a customer on first login, token read from Secrets Store                                                      |
| `apps/uptime/app/data/customer.ts`                          | `findOrCreate`, `checkout`, `portal` over the same client                                                                |
| `apps/uptime/database/migrations/*_subscriptions.sql`       | A D1 projection of Polar subscription state, written by the webhook                                                      |
| `apps/books/app/lib/test/polar.ts`                          | `FakePolarClient extends PolarClient`, overriding the methods the tests reach                                            |
| `apps/r3-auth/app/lib/test/http.ts`                         | A three-method object cast `as unknown as PolarClient`                                                                   |

Secrets are `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, and `POLAR_PRODUCT_ID`, as plain secrets in four apps and as a Secrets Store binding in `apps/r3-auth`.

### Issues Identified

| Issue                                                               | Impact                                                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The vendor's model types are the API                                | `Customer`, `Subscription`, `Order` flow into app services and views; a provider change is a type change everywhere                                                               |
| The class name is the vendor name                                   | `PolarClient` is the container token, the constructor, and the test double's base class in five apps                                                                              |
| App semantics live in the package                                   | `reportMAU` and `ingestPageViews` encode one app's meter name and metadata shape each, against the app-agnostic rule for `packages/*`                                             |
| Failure handling is three different conventions                     | Most methods throw `PolarError`, `ingestEventsSafe`/`ingestPageViews` return `boolean`, `parseWebhook` returns a `Result`                                                         |
| `customerId` and `externalCustomerId` are two optional fields       | An ingest event naming neither type-checks and throws at runtime                                                                                                                  |
| List methods drain every page                                       | `listOrders`, `listSubscriptions`, `listDiscounts` return unbounded arrays; a caller wanting one page cannot ask for one                                                          |
| Coverage stops at what the apps happened to need                    | `apps/uptime/app/http/controllers/app/team/checkout.tsx` documents a feature it cannot build because the package has no meter-quantities call                                     |
| Large parts of the provider's API have no representation            | Benefits, license keys, downloadable files, custom fields, refunds, payments, invoices, meters, customer balances, metrics, subscription changes, and webhook-endpoint management |
| Test doubles subclass or cast the real client                       | Two apps hand-roll a fake; one of them casts through `unknown` because the real class cannot be partially implemented                                                             |
| Vendor identifiers are stored under vendor column names             | `polar_customer_id` in two schemas and `polar_subscription_id` in three; the row cannot say which provider issued it                                                              |
| Webhook verification quirks are vendor-specific but the seam is not | Polar's secret is text that must be base64-encoded before Standard Webhooks verification; Stripe does not use Standard Webhooks at all                                            |

### What "Switchable" Has To Mean

A second provider is not a drop-in. The parts that genuinely port are the shapes and the call flow; the parts that do not are worth naming up front.

| Concept            | Polar                          | Stripe                                    |
| ------------------ | ------------------------------ | ----------------------------------------- |
| Customer           | `customers`                    | `customers`                               |
| Product / price    | `products`, prices embedded    | `products` plus separate `prices`         |
| Checkout session   | `checkouts`                    | `checkout.sessions`                       |
| Portal session     | `customerSessions`             | `billingPortal.sessions`                  |
| Subscription       | `subscriptions`                | `subscriptions`                           |
| Paid order         | `orders`                       | `invoices` plus `paymentIntents`          |
| Discount           | `discounts`                    | `coupons` plus `promotionCodes`           |
| Usage event        | `events.ingest`                | `billing.meterEvents`                     |
| Meter reading      | `meters.quantities`            | meter event summaries                     |
| Refund             | `refunds`                      | `refunds`                                 |
| License key        | `licenseKeys`                  | none                                      |
| File benefit       | `files`, downloadable benefits | none                                      |
| Webhook proof      | Standard Webhooks headers      | `Stripe-Signature` with `t=`/`v1=` parts  |
| Tax and remittance | merchant of record             | we remain the seller, Stripe Tax computes |

So the contract has to carry three things the current client does not: a normalized core every backend can honour, an explicit way to express what a given backend cannot do, and per-backend ownership of the webhook proof.

## Decision

Create `@pkg/billing`: vendor-neutral billing models plus an adapter contract, with Polar as the first adapter and an in-memory adapter for tests. `@pkg/polar` is deprecated on adoption and deleted once its last consumer moves.

The name is the domain, not the vendor, and matches the house pattern of `@pkg/mail` (ADR-018) and `@pkg/rate-limit` (ADR-019). `@pkg/commerce` was rejected as promising carts and catalogs; `@pkg/payments` as excluding subscriptions and entitlements, which are most of what the apps read.

### 1. The Adapter Is The Client

There is no wrapper class in front of the adapter. `Billing` is the interface apps program against, and each adapter implements it directly:

```ts
import type { Billing } from "@pkg/billing";

import { PolarAdapter } from "@pkg/billing/polar";

let billing: Billing = new PolarAdapter({
	accessToken: () => env.POLAR_ACCESS_TOKEN.get(),
	webhookSecret: env.POLAR_WEBHOOK_SECRET,
});
```

`accessToken` accepts a string or a function resolving one, preserving the Secrets Store case in `apps/r3-auth` where the token is only readable with an `await`.

Resources are grouped rather than flattened onto one class, because the surface being modelled is a dozen resources deep and a flat client is what produced a 948-line file:

```ts
export interface Billing {
	/** Which backend issued the ids this instance returns; stored beside them. */
	readonly provider: ProviderId;

	readonly customers: CustomerApi;
	readonly products: ProductApi;
	readonly checkouts: CheckoutApi;
	readonly portal: PortalApi;
	readonly subscriptions: SubscriptionApi;
	readonly orders: OrderApi;
	readonly discounts: DiscountApi;
	readonly usage: UsageApi;
	readonly webhooks: WebhookApi;

	readonly refunds?: RefundApi;
	readonly meters?: MeterApi;
	readonly entitlements?: EntitlementApi;
	readonly licenseKeys?: LicenseKeyApi;
	readonly files?: FileApi;
	readonly customFields?: CustomFieldApi;
	readonly metrics?: MetricsApi;
	readonly endpoints?: WebhookEndpointApi;
}
```

The nine required groups are the ones every payment backend has an answer for. The optional ones are the capability seam: an adapter declares support by having the property, so there is no parallel registry to keep in sync.

### 2. Capabilities Are Optional Properties

```ts
import { supports } from "@pkg/billing";

if (!supports(billing, "licenseKeys")) return notFound();
let key = await billing.licenseKeys.validate({ key, productId });
```

`supports()` narrows through `Required<Pick<Billing, K>>`, so the optional property is non-optional inside the branch. A call site that needs a capability the configured backend lacks fails at that branch rather than at a runtime `undefined`, and a capability nobody reaches costs nothing.

Where a required method has no backend equivalent for a specific argument, the adapter returns `failure` with the `unsupported` code rather than approximating. Silent approximation is how a billing bug becomes a refund.

### 3. Models Are Ours

Every model is defined in the package. Adapters map onto them; no vendor type is re-exported.

```ts
export interface Customer {
	id: string;
	/** Our own identifier for this customer, set at creation and the join key across providers. */
	externalId: string | null;
	email: string;
	name: string | null;
	metadata: Record<string, string>;
	createdAt: Date;
}

export interface Money {
	/** Minor units, always an integer: 500 is five dollars. */
	amount: number;
	currency: Currency;
}

export interface Price {
	id: string;
	kind: "one_time" | "recurring" | "metered" | "pay_what_you_want";
	interval?: "month" | "year";
	money?: Money;
	/** Present for `metered`: what the meter is called and what one unit costs. */
	meter?: { name: string; unit: Money };
}
```

Money is minor units because that is the only representation both backends agree on and the only one that survives arithmetic. Usage costs are the exception and stay a decimal string:

```ts
export interface Cost {
	/** Minor units as a plain decimal string, e.g. `"0.003476700"`. */
	amount: string;
	currency: Currency;
}
```

Per-unit infrastructure costs are routinely below `1e-6`, which JavaScript renders in exponential notation and Polar's parser rejects. The type carries that constraint instead of leaving each caller to rediscover it.

### 4. Every Method Returns A Result

```ts
export type BillingErrorCode =
	| "not_found"
	| "invalid_request"
	| "unauthenticated"
	| "forbidden"
	| "conflict"
	| "rate_limited"
	| "unavailable"
	| "unsupported";

export class BillingError extends Error {
	readonly code: BillingErrorCode;
	readonly provider: ProviderId;
	/** The backend's own code, for logs and support tickets. */
	readonly providerCode: string | null;
	/** Whether the same call is worth retrying unchanged. */
	readonly retryable: boolean;
}
```

One convention replaces the current three, matching `@pkg/mail`:

```ts
let result = await billing.customers.create({ email, externalId: userId });
if (isFailure(result)) {
	logger.error("billing.customer_create_failed", { code: result.error.code });
	return serverError();
}
```

`retryable` is what a reporting job branches on, so the boolean-returning `ingestEventsSafe` and `ingestPageViews` disappear: a job logs the failure and lets its next run resend, because every event carries an `externalId` and ingestion is idempotent.

### 5. Customers Are Referenced By Either Id, As A Union

```ts
export type CustomerRef = { id: string } | { externalId: string };
```

The current package takes two optional fields and throws when both are missing. As a union, "one of the two" is a type error rather than a production incident, and the `externalId` arm is the one that makes provider migration tractable: an app that always sets its own id at creation can re-resolve every customer on a new backend from rows it already owns.

### 6. Lists Return Pages

```ts
export interface Page<T> {
	items: T[];
	cursor: string | null;
}

let page = await billing.orders.list({ customer: { externalId: userId }, limit: 25 });

for await (let order of paginate((cursor) => billing.orders.list({ productId, cursor }))) {
	// walk every page, one request at a time
}
```

The drain-everything behaviour stays available through `paginate()`, but it is now the caller's explicit choice rather than the only option. `apps/books`, which lists orders to decide whether one exists, stops paying for the rest of them.

### 7. Webhooks: One Event Union, Adapter-Owned Proof

```ts
export type BillingEvent =
	| { type: "customer.created"; customer: Customer }
	| { type: "customer.updated"; customer: Customer }
	| { type: "checkout.completed"; checkout: Checkout }
	| { type: "subscription.activated"; subscription: Subscription }
	| { type: "subscription.updated"; subscription: Subscription }
	| { type: "subscription.canceled"; subscription: Subscription }
	| { type: "subscription.revoked"; subscription: Subscription }
	| { type: "order.paid"; order: Order }
	| { type: "order.refunded"; order: Order; refund: Refund }
	/** Authentic, but not something this version models; carried through so it can be logged, not dropped. */
	| { type: "unrecognized"; providerType: string; payload: unknown };
```

```ts
let raw = await request.text();
let event = await billing.webhooks.parse(request, raw);
if (isFailure(event)) return unauthorized();
if (event.value.type === "order.paid") await grantAccess(event.value.order);
```

Verification belongs to the adapter, not to a shared helper, because the schemes differ: Polar sends Standard Webhooks headers and the Polar adapter keeps the base64-encoding step that Polar's own senders apply to a text secret — handing that secret straight to a Standard Webhooks verifier keys on the wrong bytes and rejects every authentic delivery. A Stripe adapter would implement `Stripe-Signature` instead. Both go through `@pkg/webhooks` (ADR-026) for the HMAC primitives; neither delegates the decision to it.

The `unrecognized` arm preserves today's fail-open-on-shape, fail-closed-on-signature behaviour: an authentic delivery of a new event type is accepted and returned, never rejected as a security failure.

### 8. Usage Ingestion Is Generic

```ts
export interface UsageEvent {
	name: string;
	customer: CustomerRef;
	/** Idempotency key; a resent event with the same value is counted once. */
	externalId?: string;
	timestamp?: Date;
	metadata?: Record<string, string | number | boolean>;
	cost?: Cost;
}

await billing.usage.ingest([
	{ name: "mau", customer: { externalId: tenantId }, metadata: { month, count } },
]);
```

`reportMAU` and `ingestPageViews` do not come along. Each was one app's meter name and metadata shape living in a shared package; both become three lines at the call site that already knows the meter it bills on. Chunking at the provider's per-request limit stays inside the adapter, so a job still hands over one array for a whole day.

### 9. Adapters Load Their Vendor Code Lazily

Constructing an adapter does no work and imports no SDK. `@polar-sh/sdk` builds roughly 700 zod schemas at load, costing over a megabyte of Worker bundle and tens of milliseconds of startup CPU in every isolate, including the many that never bill anything. The Polar adapter keeps the memoized first-call `import()` the current client uses, with a rejected load discarded so a transient secret-store failure clears on the next call.

A Stripe adapter should be written over `fetch` for the same reason, unless its SDK proves cheap to load.

### 10. The Memory Adapter Ships With The Package

```ts
import { MemoryAdapter } from "@pkg/billing/memory";

let billing = new MemoryAdapter({
	products: [
		{ id: "prod_1", prices: [{ kind: "one_time", money: { amount: 4900, currency: "usd" } }] },
	],
});

await billing.customers.create({ email: "jane@example.com", externalId: "u_1" });
let event = billing.webhooks.emit({ type: "order.paid", order });
```

It holds state in memory, honours the same `Result` contract, and can emit a signed delivery so a webhook controller is testable end to end. `FakePolarClient` in `apps/books` and the `as unknown as PolarClient` cast in `apps/r3-auth` both delete.

### 11. Conformance Specs Are The Portability Guarantee

The package ships one executable spec suite (`packages/billing/spec/`, ADR suite for `@pkg/spec`) that every adapter must pass, parameterized by adapter. The memory adapter runs it in CI; the Polar adapter runs it against a sandbox organization. A future Stripe adapter is done when the suite is green, which is a definition the current arrangement cannot state at all. Optional capabilities have their own spec files, skipped for adapters that do not declare them.

Per the spec-first rule, these specs are written before each adapter method.

### 12. Stored Ids Say Which Provider Issued Them

Apps replace vendor-named columns with provider-tagged ones:

| Before                  | After                                         |
| ----------------------- | --------------------------------------------- |
| `polar_customer_id`     | `billing_provider` plus `billing_customer_id` |
| `polar_subscription_id` | `billing_subscription_id`                     |
| `polar_product_id`      | `billing_product_id`                          |

Every customer is created with `externalId` set to the app's own identifier, so the app can re-resolve its customers on a new backend without a mapping table. Column renames happen per app as it adopts the package, not as one migration.

## Consequences

### Positive

- **A provider change is a construction-site change** - one line per app plus secrets, instead of every call site, column, test double, and webhook handler.
- **App code stops naming a vendor** - services and views hold `Customer` and `Subscription` from `@pkg/billing`, so the vendor appears in exactly one import per app.
- **The gap that blocked a feature closes** - meter quantities are in the contract, so `apps/uptime` can build its team-usage view.
- **One failure convention** - `Result` everywhere, with a normalized error code and a `retryable` flag jobs can branch on, replacing throw/boolean/Result.
- **Two runtime footguns become type errors** - a customer reference with neither id, and a capability the backend lacks.
- **Test doubles come from the package** - no subclassing the real client, no casting through `unknown`, and no mocking a third-party module.
- **The package is app-agnostic again** - no meter names or metadata shapes from one product baked into shared code.
- **Portability is testable** - a conformance suite states what "an adapter" means instead of leaving it to a reviewer's judgment.
- **Coverage grows without a rewrite** - refunds, license keys, benefits, invoices, and metrics attach as capability groups.

### Negative

- **A second layer of models to maintain** - every provider field worth exposing must be mapped, and a mapping can lose nuance the raw SDK carried.
- **Five apps and three schemas to migrate** - a mechanical change, but a wide one, and each webhook handler must be re-verified against real deliveries.
- **The lowest common denominator is real** - concepts like Polar's benefits or Stripe's separate price objects only fit through capability groups, and a call site that uses one is no longer portable, by construction rather than by accident.
- **Normalizing orders is the weakest seam** - "a paid order" is one object in Polar and an invoice plus a payment intent in Stripe, so that mapping will need revision when a second adapter is written.
- **Switching providers is still not only code** - merchant-of-record status, tax remittance, existing subscriptions, and saved payment methods do not port; the package removes the code obstacle, not the commercial one.
- **A bug can now live in our mapping** - previously a wrong field was the vendor's; now it can be ours.

### Neutral

- **Polar stays the provider** - this changes where the dependency sits, not who processes payments.
- **`@pkg/polar` is deprecated, not rewritten in place** - it keeps working until its last consumer moves, then it is deleted.
- **No new service-container token** - apps construct the adapter in an app module and pass it where it is needed; the five existing `PolarClient` registrations point at the adapter until each app is touched.
- **Webhook route paths keep their current names** - renaming `/webhooks/polar` would mean re-registering endpoints with the provider, which is adoption risk for no gain.
- **Secret names stay `POLAR_*`** - they are the Polar adapter's inputs, and naming them after the adapter is accurate.

## Implementation Plan

### Phase 1: Models, Contract, And Specs

**Priority:** High
**Estimated Effort:** 1 day

1. Create `packages/billing` with models, `Billing`, the resource-group interfaces, `BillingError`, `supports()`, and `paginate()`.
2. Write the conformance spec suite covering the nine required groups.
3. Implement `MemoryAdapter` until the suite is green.

### Phase 2: Polar Adapter, Parity Surface

**Priority:** High
**Estimated Effort:** 1-2 days

1. Implement every group the current 26 methods cover, keeping lazy SDK loading and the text-secret webhook encoding.
2. Run the conformance suite against a Polar sandbox organization.
3. Port `@pkg/polar`'s existing tests onto the adapter.

### Phase 3: App Adoption

**Priority:** High
**Estimated Effort:** 1 day per app

Per app: construct the adapter, replace call sites, delete the local test double, rename the stored columns, and re-verify a real webhook delivery. Order by billing complexity, simplest first: `apps/r3-auth`, `apps/auth-saas`, `apps/blog-saas`, `apps/uptime`, `apps/books`.

### Phase 4: Capability Build-Out

**Priority:** Medium
**Estimated Effort:** 1-2 days

Meters and customer balances first, since a feature is waiting on them; then refunds, license keys, benefits and files, custom fields, metrics, and webhook-endpoint management, each with its own capability spec file.

### Phase 5: Remove `@pkg/polar`

**Priority:** Medium
**Estimated Effort:** 1 hour

Delete the package and its workspace dependencies once nothing imports it.

### Phase 6: Prove The Seam

**Priority:** Low
**Estimated Effort:** 1-2 days

Write `StripeAdapter` against the conformance suite, in test mode, with no app adopting it. Until an adapter other than the memory one passes, the claim that the contract is provider-agnostic is untested.

## Alternatives Considered

### 1. Keep `PolarClient`, Rename It

Rename the class to `BillingClient` and keep the Polar implementation inside it, adding a second implementation later if it is ever needed.

**Rejected because**: the vendor's model types are the actual coupling, and a rename leaves them in place. The apps would still hold Polar's `Subscription` and store `polar_customer_id`.

### 2. A Facade Class Over Adapters

A `Billing` class wrapping an adapter, as `Mailer` wraps a `Transport` (ADR-018).

**Rejected because**: a mailer's facade earns its place by normalizing a message and building MIME before any transport sees it. Here the facade would only forward, and every capability added would mean adding a forwarding member in two places. `Mailer` has one method; billing has a dozen resources.

### 3. A Capability Registry Or `capabilities: Set<string>`

Declare support with a separate list an adapter publishes, checked before use.

**Rejected because**: it can disagree with the implementation. Optional properties cannot: the property is both the declaration and the implementation, and `supports()` narrows the type from the same fact.

### 4. Normalize Everything, No Optional Capabilities

Require every adapter to implement the full surface, throwing `unsupported` where a backend cannot comply.

**Rejected because**: it moves a compile-time fact to runtime. A page rendering license keys should not typecheck against a backend that has none.

### 5. Wait Until A Second Provider Is Actually Needed

Leave `@pkg/polar` alone and do this work when a switch is on the table.

**Rejected because**: the cost is paid at migration time either way, and it is highest exactly when there is schedule pressure. Several of the fixes here — one failure convention, page-at-a-time lists, package-owned test doubles, no app semantics in shared code, the meter-quantities gap — are worth landing with no provider change in sight.

## References

- [Polar API reference](https://docs.polar.sh/api-reference)
- [Stripe API reference](https://docs.stripe.com/api)
- [Standard Webhooks](https://www.standardwebhooks.com)
- [ADR-018: Mail Package With Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [ADR-019: Adapter-Based Rate Limiting Package](./ADR-019-adapter-based-rate-limiting-package.md)
- [ADR-026: Standard Webhooks Parsing Package](./ADR-026-standard-webhooks-parsing-package.md)
- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-033: Wide Events As The Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md)

## Current Progress

- [ ] Phase 1: Models, contract, and specs
- [ ] Phase 2: Polar adapter, parity surface
- [ ] Phase 3: App adoption
- [ ] Phase 4: Capability build-out
- [ ] Phase 5: Remove `@pkg/polar`
- [ ] Phase 6: Prove the seam

## Notes

- Polar's webhook secret is an arbitrary string that its senders base64-encode before signing, so the HMAC key is the secret's UTF-8 bytes. The Polar adapter must keep that conversion; a Standard Webhooks verifier given the raw secret rejects every authentic delivery.
- Usage costs stay decimal strings, not numbers. Per-unit infrastructure costs fall below `1e-6`, where JavaScript switches to exponential notation and the provider's parser rejects the value.
- Only `apps/r3-auth` reads its token from Secrets Store, which is why `accessToken` accepts a resolver function; a rejected resolution must not be memoized, or one blip leaves a long-lived instance permanently unable to bill.
- `apps/uptime` keeps a D1 projection of subscription state written by the webhook, because asking the provider per request meant an outage stopped monitoring. That projection is unaffected here: it just stores normalized fields under provider-tagged column names.
- Products, prices, and discounts are read-only in the required contract. Creating them is a dashboard task, and a write path nobody uses is a write path nobody tests.
