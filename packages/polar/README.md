# @pkg/polar

Instance-based [Polar](https://polar.sh) billing client shared across the SaaS apps.

## Overview

This package wraps the official [`@polar-sh/sdk`](https://docs.polar.sh/api) behind
a small, stable, dependency-injectable client. It replaces two divergent
per-app implementations (one static wrapper over the SDK, one hand-rolled `fetch`
client) with a single `PolarClient` class that covers both billing models used in
the monorepo:

- **Seat / MAU billing** (auth-saas): customers, subscriptions and a daily
  `reportMAU` usage event.
- **Metered page-view billing** (blog-saas): hosted checkout/portal sessions and a
  best-effort `ingestPageViews` usage event.
- **One-time product sales**: products, discounts and orders, plus discounted
  checkouts and parsed `order.paid` webhooks.

The client takes its configuration through the constructor (`{ accessToken }`)
rather than reading environment variables itself, so it composes with
[`@pkg/service-container`](/packages/service-container) (ADR-008) and is trivial to
test. Webhook signature verification uses the Standard Webhooks scheme via
`@polar-sh/sdk/webhooks.js`.

The vendor SDK is **never imported at module scope**. It builds ~700 zod schemas when
it loads, which costs over a megabyte of Worker bundle and tens of milliseconds of
startup CPU in every isolate — including the many that never bill anything. Importing
`PolarClient` (as a service-container token, say) therefore costs nothing; the SDK is
loaded once, on the first method call. The visible consequence is that
`verifyWebhook` and `parseWebhook` are `async`, since they have to load the verifier
before they can use it.

## Usage

### Basic Example

```ts
import { PolarClient } from "@pkg/polar";
import { env } from "cloudflare:workers";

let polar = new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN });

let customer = await polar.createCustomer("jane@example.com", "Jane Doe", {
	tenant_id: "t_123",
});

let { url } = await polar.createCheckoutSession(
	env.POLAR_PRODUCT_ID,
	customer.id,
	"https://app.example.com/dashboard",
	{ tenant_id: "t_123" },
);
```

### Verifying a webhook

```ts
let body = await request.text();
if (!(await polar.verifyWebhook(request, body, env.POLAR_WEBHOOK_SECRET))) {
	return new Response("invalid signature", { status: 401 });
}
```

## API

### `PolarClient`

The Polar billing client. Wraps `@polar-sh/sdk`.

#### `new PolarClient(options: PolarClientOptions)`

Creates a new client. Does no work and loads no vendor code: the SDK is imported and
the underlying client constructed on the first method call, then reused for the
lifetime of this instance.

**Parameters:**

- `options.accessToken`: The Polar API access token (sent as a Bearer token).

**Example:**

```ts
let polar = new PolarClient({ accessToken: "polar_at_..." });
```

#### `createCustomer(email: string, name?: string | null, metadata?: Record<string, string>): Promise<Customer>`

Creates a new customer in Polar.

**Parameters:**

- `email`: The customer's email address.
- `name`: The customer's display name, or `null` when unknown.
- `metadata`: Additional key-value pairs to store on the customer.

**Returns:**

- The created customer object.

**Example:**

```ts
let customer = await polar.createCustomer("jane@example.com", "Jane Doe", {
	tenant_id: "t_123",
});
```

#### `getCustomer(customerId: string): Promise<Customer>`

Gets a customer by ID.

#### `updateCustomer(customerId: string, updates: CustomerUpdate): Promise<Customer>`

Updates a customer's `name` and/or `metadata`.

#### `getSubscription(subscriptionId: string): Promise<Subscription>`

Gets a subscription by ID.

#### `listSubscriptions(customerId: string): Promise<Subscription[]>`

Lists every subscription for a customer, following pagination to completion.

**Returns:**

- An array with all of the customer's subscriptions.

#### `revokeSubscription(subscriptionId: string): Promise<Subscription>`

Revokes a subscription immediately (ends entitlement now, not at period end).

#### `getProduct(productId: string): Promise<Product>`

Gets a product by ID, including its prices and benefits — for rendering a price from
Polar instead of hardcoding it.

**Returns:**

- The product object.

**Example:**

```ts
let product = await polar.getProduct(env.POLAR_PRODUCT_ID);
let [price] = product.prices;
```

#### `listDiscounts(limit?: number): Promise<Discount[]>`

Lists the organization's discounts, following pagination to completion. The client
does not filter: deciding which discount applies (date window, redemption limits,
product scope) is app business logic and stays at the call site.

**Parameters:**

- `limit`: Polar page size (1-100), defaults to `12`.

**Returns:**

- An array with every discount, in the order Polar returns them.

**Example:**

```ts
let discounts = await polar.listDiscounts();
let applicable = discounts.find((discount) => isApplicable(discount, new Date()));
```

#### `listOrders(options: { customerId?: string; productId?: string }): Promise<Order[]>`

Lists orders, optionally filtered by customer and/or product, following pagination to
completion. Use it to check whether a customer already bought a product before
offering them an upgrade.

**Parameters:**

- `options.customerId`: Only orders belonging to this Polar customer.
- `options.productId`: Only orders for this Polar product.

**Returns:**

- An array with every matching order (empty when there are none).

**Example:**

```ts
let orders = await polar.listOrders({ customerId: customer.id, productId });
if (orders.length === 0) return redirectDocument(fullPriceCheckoutUrl);
```

#### `createCheckoutSession(productId: string, customerId: string, successUrl: string, metadata?: Record<string, string>): Promise<SessionResult>`

Creates a hosted checkout session for a subscription.

**Parameters:**

- `productId`: The Polar product ID to sell.
- `customerId`: The Polar customer ID the checkout is for.
- `successUrl`: Absolute URL to redirect to after a successful checkout.
- `metadata`: Additional key-value pairs stored on the checkout and later surfaced
  on the resulting webhook events.

**Returns:**

- `{ url }` — the hosted checkout URL.

**Example:**

```ts
let { url } = await polar.createCheckoutSession(productId, customerId, successUrl, {
	account_id: accountId,
});
return redirect(url);
```

#### `createCheckout(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>`

Options-object form of `createCheckoutSession`, for the checkout fields the positional
form cannot express. It is a sibling method rather than an overload so the positional
signature stays exactly as existing callers (and their test doubles) already see it.

**Parameters:**

- `options.productId`: The Polar product ID to sell (sent as a single-product checkout).
- `options.customerId`: The Polar customer ID; omit to let Polar create one.
- `options.customerEmail`: Email to pre-fill on the hosted checkout; `null` is accepted
  and sent as omitted, so an optional query param can be forwarded as-is.
- `options.discountId`: A Polar discount ID applied automatically.
- `options.allowDiscountCodes`: Whether the customer may type a discount code.
- `options.successUrl`: Absolute URL to redirect to after a successful checkout;
  omit to use Polar's own confirmation page.
- `options.metadata`: Additional key-value pairs stored on the checkout.

**Returns:**

- `{ url, id }` — the hosted checkout URL plus the checkout ID (useful for logging
  and correlating with the webhook events the checkout produces).

**Example:**

```ts
let { url, id } = await polar.createCheckout({
	productId: env.POLAR_PRODUCT_ID,
	customerEmail: url.searchParams.get("email"),
	discountId: discount?.id,
	allowDiscountCodes: false,
});
log.info("checkout_started", { checkoutId: id });
return redirectDocument(url);
```

#### `createPortalSession(customerId: string): Promise<SessionResult>`

Creates a customer-portal session for managing payment methods, invoices and
cancellation.

**Returns:**

- `{ url }` — the hosted customer-portal URL.

#### `ingestEvents(events: IngestEvent[]): Promise<void>`

Ingests one or more usage events for metered billing, or for Polar Cost Insights when the
events carry a `cost`. Sent in chunks of 100 events per request, so a caller reporting a
whole day hands over one array.

Identify the customer with either `customerId` or `externalCustomerId`; an event naming
neither throws.

**Example:**

```ts
await polar.ingestEvents([
	{ customerId, name: "page_views", metadata: { views: 42, day: "2026-07-04" } },
	{
		externalCustomerId: ownerId,
		name: "infra.cost.daily",
		externalId: `infra_cost:${teamId}:${day}`,
		cost: { amount: (0.0034767).toFixed(9), currency: "usd" },
		metadata: { team_id: teamId, day },
	},
]);
```

#### `ingestEventsSafe(events: IngestEvent[]): Promise<boolean>`

`ingestEvents`, best-effort: returns `false` instead of throwing, so a reporting cron can
log the failure and let its next run resend the same events. Idempotent when every event
carries an `externalId`.

#### `reportMAU(customerId: string, mau: number, entityId: string, month: string): Promise<void>`

Reports a Monthly Active Users (MAU) count for an entity. Thin wrapper over
`ingestEvents` that emits a single `"mau"` event with `{ tenant_id, month, count }`
metadata.

**Parameters:**

- `customerId`: The Polar customer ID to bill.
- `mau`: The monthly active user count.
- `entityId`: The entity (tenant) the count is for; stored as `tenant_id`.
- `month`: The reported month in `YYYY-MM` format.

#### `ingestPageViews(customerId: string, views: number, day: string): Promise<boolean>`

Ingests a page-view meter event. Best-effort: returns `false` instead of throwing
on API failure so a reporting cron can retry on the next run.

**Returns:**

- `true` when the event was accepted, `false` when ingestion failed.

#### `verifyWebhook(request: Request, rawBody: string, secret: string): Promise<boolean>`

Verifies a Polar webhook signature using the Standard Webhooks scheme
(`webhook-id` / `webhook-timestamp` / `webhook-signature` headers).

Fails **closed**: a missing/empty secret or an invalid signature returns `false`.
When the signature is valid but the SDK cannot model the event type, the security
boundary has still passed, so the webhook is accepted and `true` is returned — the
caller is expected to validate the payload shape itself.

**Parameters:**

- `request`: The incoming webhook request, used for its headers.
- `rawBody`: The exact raw request body used to compute the signature.
- `secret`: The Polar webhook signing secret; when empty, verification fails.

**Returns:**

- `true` when the request is authentic, `false` otherwise.

#### `parseWebhook(request: Request, rawBody: string, secret: string | undefined): Promise<Result<PolarWebhookEvent, Error>>`

Verifies the signature **and** returns the parsed event, so callers can branch on
`event.type` with full types instead of re-parsing the raw body themselves.

Fails **closed**: a missing/empty secret is a failure and the verifier is never
called. The failure message distinguishes a rejected signature (`"Invalid Polar
webhook signature"`) from an authentic body the SDK could not model (`"Invalid Polar
webhook payload: …"`), so the two can be logged apart.

**Parameters:**

- `request`: The incoming webhook request, used for its headers.
- `rawBody`: The exact raw request body used to compute the signature.
- `secret`: The Polar webhook signing secret; when empty or `undefined`, parsing fails.

**Returns:**

- `success(event)` with the validated event, or `failure(error)`.

**Example:**

```ts
let result = await polar.parseWebhook(request, await request.text(), env.POLAR_WEBHOOK_SECRET);
if (isFailure(result)) return badRequest({ error: result.error.message });
if (result.data.type === "order.paid") {
	await tagCustomer(result.data.data.customer.email);
}
```

### Re-exports

- `PolarError` — the SDK error thrown by API calls (re-exported as a value from
  `@polar-sh/sdk/models/errors/polarerror.js`, whose module is a bare `Error` subclass
  and so costs nothing to load), so `catch (error) { if (error instanceof PolarError) … }`
  works.
- `WebhookVerificationError` — **type-only**. The module that defines it is the
  schema-heavy webhook parser, so re-exporting the class would pull the whole vendor
  model layer into every importer's startup path. `verifyWebhook` and `parseWebhook`
  already turn it into `false` and a `"Invalid Polar webhook signature"` failure,
  which is what a caller branches on.

### Types

#### `PolarClientOptions`

```ts
interface PolarClientOptions {
	accessToken: string;
}
```

#### `IngestEvent`

```ts
interface IngestEvent {
	/** Mutually exclusive with `externalCustomerId`; one of the two is required. */
	customerId?: string;
	externalCustomerId?: string;
	name: string;
	metadata?: Record<string, string | number | boolean>;
	/** Sent as `metadata._cost` for Polar Cost Insights. */
	cost?: EventCost;
	timestamp?: Date;
	externalId?: string;
}
```

#### `EventCost`

```ts
interface EventCost {
	/** The amount in **cents**, as a plain decimal string (e.g. `"0.003476700"`). */
	amount: string;
	currency: "usd";
}
```

`amount` is a string because JS renders floats below `1e-6` in exponential notation, which
Polar's parser rejects — and per-unit infrastructure costs are routinely that small.

#### `CustomerUpdate`

```ts
interface CustomerUpdate {
	name?: string;
	metadata?: Record<string, string>;
}
```

#### `SessionResult`

```ts
interface SessionResult {
	url: string;
}
```

#### `CheckoutSessionResult`

Returned by `createCheckout`.

```ts
interface CheckoutSessionResult extends SessionResult {
	id: string;
}
```

#### `CheckoutSessionOptions`

```ts
interface CheckoutSessionOptions {
	productId: string;
	customerId?: string;
	customerEmail?: string | null;
	discountId?: string;
	allowDiscountCodes?: boolean;
	successUrl?: string;
	metadata?: Record<string, string>;
}
```

#### `PolarWebhookEvent`

Every webhook event the SDK can model, as returned by `validateEvent`. It is a
discriminated union on `type`, so `event.type === "order.paid"` narrows the payload.

```ts
type PolarWebhookEvent = ReturnType<typeof validateEvent>;
```

The SDK model types `Customer`, `Subscription`, `Checkout`, `CustomerSession`,
`Product`, `Discount` and `Order` are re-exported for convenience.

> `Product` is Polar's product model. Apps that already have their own `Product`
> symbol (e.g. an enum of product IDs) should alias the import:
> `import type { Product as PolarProduct } from "@pkg/polar";`

## Pattern: Service-container singleton (DI)

Register the client once per app so controllers and jobs can inject it (ADR-008):

```ts
// app/lib/container.ts
import { PolarClient } from "@pkg/polar";
import { env } from "cloudflare:workers";

container.singleton(PolarClient, () => new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }));
```

```ts
// a controller or job
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";

export default inject([PolarClient] as const, async (polar) => {
	let { url } = await polar.createPortalSession(customerId);
	// ...
});
```

## Pattern: Webhook verification with payload validation

`verifyWebhook` only checks the signature. Always validate the payload shape after
it passes — an authentic request can still carry an event type or fields you must
not trust blindly:

```ts
let body = await request.text();
if (!(await polar.verifyWebhook(request, body, env.POLAR_WEBHOOK_SECRET))) {
	return json({ error: "Invalid signature" }, { status: 401 });
}

let result = await validate(JSON.parse(body), WebhookPayloadSchema);
if (isFailure(result)) return json({ error: "Invalid payload" }, { status: 400 });
// ...act on result.data
```

## Related Packages

- [`@pkg/service-container`](/packages/service-container) - Dependency injection container the client is registered in.
- [`@pkg/validate`](/packages/validate) - Validate webhook payloads after signature verification.
- [`@pkg/result`](/packages/result) - Result type used alongside payload validation.

## Tips

1. **Construct once** - Create a single `PolarClient` per app (a container singleton) rather than per request; the SDK is imported and the underlying client constructed on the instance's first method call, then reused.
2. **Verify then validate** - `verifyWebhook` proves authenticity, not payload shape. Parse and validate the body afterwards before acting on it.
3. **Fails closed** - `verifyWebhook` returns `false` for an empty secret or bad signature; it returns `true` for an authentic-but-unmodeled event so new Polar event types are not rejected.
4. **`ingestPageViews` never throws** - It returns `false` on failure so a cron can retry; use `ingestEvents` directly when you want errors to propagate.
5. **`parseWebhook` when you need the event** - Use `verifyWebhook` when a boolean is enough; use `parseWebhook` when you want to act on the typed event (`event.type === "order.paid"`) without re-parsing the body. Both fail closed on a missing secret.
6. **Pass IDs explicitly** - The client is app-agnostic: pass `productId` (e.g. from `env.POLAR_PRODUCT_ID`) and metadata keys at the call site rather than baking them in.
