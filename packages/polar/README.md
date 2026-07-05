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

The client takes its configuration through the constructor (`{ accessToken }`)
rather than reading environment variables itself, so it composes with
[`@pkg/service-container`](/packages/service-container) (ADR-008) and is trivial to
test. Webhook signature verification uses the Standard Webhooks scheme via
`@polar-sh/sdk/webhooks.js`.

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
if (!polar.verifyWebhook(request, body, env.POLAR_WEBHOOK_SECRET)) {
	return new Response("invalid signature", { status: 401 });
}
```

## API

### `PolarClient`

The Polar billing client. Wraps `@polar-sh/sdk`.

#### `new PolarClient(options: PolarClientOptions)`

Creates a new client. The underlying SDK client is created once and reused.

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

#### `createPortalSession(customerId: string): Promise<SessionResult>`

Creates a customer-portal session for managing payment methods, invoices and
cancellation.

**Returns:**

- `{ url }` — the hosted customer-portal URL.

#### `ingestEvents(events: IngestEvent[]): Promise<void>`

Ingests one or more usage events for metered billing.

**Example:**

```ts
await polar.ingestEvents([
	{ customerId, name: "page_views", metadata: { views: 42, day: "2026-07-04" } },
]);
```

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

#### `verifyWebhook(request: Request, rawBody: string, secret: string): boolean`

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

### Re-exports

- `PolarError` — the SDK error thrown by API calls (re-exported from
  `@polar-sh/sdk/models/errors/polarerror.js`).
- `WebhookVerificationError` — thrown by `validateEvent` on a bad signature
  (re-exported from `@polar-sh/sdk/webhooks.js`).

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
	customerId: string;
	name: string;
	metadata?: Record<string, string | number | boolean>;
	timestamp?: Date;
}
```

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

The SDK model types `Customer`, `Subscription`, `Checkout` and `CustomerSession`
are re-exported for convenience.

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
if (!polar.verifyWebhook(request, body, env.POLAR_WEBHOOK_SECRET)) {
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

1. **Construct once** - Create a single `PolarClient` per app (a container singleton) rather than per request; the underlying SDK client is reused.
2. **Verify then validate** - `verifyWebhook` proves authenticity, not payload shape. Parse and validate the body afterwards before acting on it.
3. **Fails closed** - `verifyWebhook` returns `false` for an empty secret or bad signature; it returns `true` for an authentic-but-unmodeled event so new Polar event types are not rejected.
4. **`ingestPageViews` never throws** - It returns `false` on failure so a cron can retry; use `ingestEvents` directly when you want errors to propagate.
5. **Pass IDs explicitly** - The client is app-agnostic: pass `productId` (e.g. from `env.POLAR_PRODUCT_ID`) and metadata keys at the call site rather than baking them in.
