---
title: Charge for your app
description: Sell through a hosted checkout, keep your own copy of what each customer holds, and gate features on it without calling the platform.
section:
    title: Data & background work
    order: 7
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "How to link accounts to customers and open a hosted checkout with `@sdxc/billing`"
    - "How to sync subscriptions and receive the platform's webhooks"
    - "How to gate a feature on your own copy and repair what webhooks missed"
---

Charging for an app is mostly bookkeeping around a payment platform: linking your accounts to its
customers, sending buyers to its checkout, learning when a subscription starts or lapses, and
deciding on every request what the account may use. [`@sdxc/billing`](/api/billing) puts one
contract in front of the platform, so the rest of your code reads `Customer`, `Subscription` and
`EntitlementState` and the vendor's name appears in a single module.

This guide sells a `pro` plan through a hosted checkout, keeps a local projection of what each
customer holds in sync from webhooks and a nightly [`@sdxc/jobs`](/api/jobs) job, and gates a
feature on that projection.

```bash
npm add @sdxc/billing @sdxc/http @sdxc/jobs @sdxc/result remix
```

## Configure the provider

A provider is a class built once at module scope, shared by routes and jobs. Its constructor
makes no request:

```typescript {% title="app/initializers/billing.ts" %}
import type { Billing } from "@sdxc/billing";

import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

export const billing: Billing = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET,
	products: { pro: "prod_7f3c…" },
	features: { reports: "benefit_91ab…" },
});
```

Products and features are your own slugs mapped to the platform's ids, so no platform id leaks
into a controller or a column. Annotating the export as `Billing` keeps every caller on the
contract, so moving to `StripeBilling` or another provider changes only this file.

## Publish it on the request

The billing middleware publishes the provider as `ctx.billing`, and its `entitlements` option is
the reader the feature gate calls:

```typescript {% title="app/initializers/router.ts" %}
import billingMiddleware from "@sdxc/billing/middleware";
import { createRouter } from "remix/router";

import { billing } from "~/app/initializers/billing";
import { Entitlements } from "~/app/models/entitlements";

export function createWebRouter() {
	return createRouter({
		middleware: [
			billingMiddleware({
				provider: billing,
				entitlements: (ctx) => Entitlements.snapshot(ctx.db, ctx.account.id),
			}),
		],
	});
}
```

`Entitlements` is your own table holding one snapshot per account, written by the sync below.

> [!NOTE]
> Put the billing middleware after the middleware that publishes `ctx.db` and `ctx.account`, the
> signed-in account your auth middleware resolves, since the `entitlements` reader reads both.

## Link each account to a customer

Every platform customer carries your own account id as its `externalId`, which is what lets a
checkout, a snapshot and a webhook name the same person. Resolve it when an account signs up,
creating the customer only when the platform holds none:

```typescript {% title="app/services/billing-customer.ts" %}
import type { Billing, BillingError, Customer } from "@sdxc/billing";
import type { Result } from "@sdxc/result";

import { isSuccess } from "@sdxc/result";

import type { Account } from "~/app/models/accounts";

export async function linkCustomer(
	billing: Billing,
	account: Account,
): Promise<Result<Customer, BillingError>> {
	let linked = await billing.customers.find({ externalId: account.id });
	if (isSuccess(linked) || linked.error.code !== "not_found") return linked;

	return await billing.customers.create({
		email: account.email,
		externalId: account.id,
		name: account.name,
	});
}
```

Every call answers a `Result<T, BillingError>`, and a lookup that matches nothing is a
`not_found` failure.

## Open a hosted checkout

A purchase is a link. `checkouts.create` answers a session whose `url` is the platform's own
payment page, and the route owns the redirect:

```typescript {% title="app/http/controllers/billing/checkout.ts" %}
import { redirect } from "@sdxc/http/response";
import { badGateway } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import routes from "~/routes/web";

export default createAction(routes.billing.checkout, async (ctx) => {
	let checkout = await ctx.billing.checkouts.create({
		product: "pro",
		customer: { externalId: ctx.account.id },
		returnTo: new URL(routes.billing.index.href(), ctx.url).toString(),
	});

	if (isFailure(checkout) || checkout.data.url === null) {
		ctx.log.warn("billing.checkout_failed");
		return badGateway("Checkout is unavailable right now. Please try again.");
	}

	return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
});
```

A session with no `url` is no longer payable, so it is checked before redirecting. The
subscription comes into being when the checkout completes, and your app learns of it from a
webhook.

## Sync what the customer holds

`entitlements.of` answers everything a customer holds right now, in one call. Write that
snapshot into your own table, and have every request read the table, so the platform stays off
the request path:

```typescript {% title="app/services/entitlements.ts" %}
import type { Billing, BillingError, CustomerRef } from "@sdxc/billing";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { isFailure, success } from "@sdxc/result";

import { Entitlements } from "~/app/models/entitlements";

export async function syncEntitlements(
	db: Database,
	billing: Billing,
	customer: CustomerRef,
): Promise<Result<boolean, BillingError>> {
	let state = await billing.entitlements.of(customer);
	if (isFailure(state)) return state;
	if (state.data.externalId === null) return success(false);

	await Entitlements.save(db, state.data.externalId, state.data);
	return success(true);
}
```

Store `readAt` beside the snapshot: deliveries arrive out of order, and `Entitlements.save`
skipping a snapshot older than the stored one stops a late event from rolling an account back.

## Receive the platform's webhooks

`BillingWebhook` is the whole receiver: the provider verifies the signature, a store records the
delivery, and a handler per event type re-reads the customer's snapshot, since only a fresh
snapshot says what is true now:

```typescript {% title="app/http/controllers/webhooks/billing.ts" %}
import { BillingWebhook } from "@sdxc/billing";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";

import { billing } from "~/app/initializers/billing";
import { openDatabase } from "~/app/initializers/database";
import { WebhookDeliveries } from "~/app/models/webhook-deliveries";
import { syncEntitlements } from "~/app/services/entitlements";
import routes from "~/routes/web";

async function resync(ctx: AppContext, customerId: string | null) {
	if (customerId === null) return;
	return await syncEntitlements(ctx.db, billing, { id: customerId });
}

const ENDPOINT = new BillingWebhook<AppContext>(
	billing,
	{
		"subscription.activated": (event, ctx) =>
			resync(ctx, event.subscription.customerId),
		"subscription.updated": (event, ctx) =>
			resync(ctx, event.subscription.customerId),
		"subscription.canceled": (event, ctx) =>
			resync(ctx, event.subscription.customerId),
		"subscription.revoked": (event, ctx) =>
			resync(ctx, event.subscription.customerId),
		"order.paid": (event, ctx) => resync(ctx, event.order.customerId),
	},
	{ store: new WebhookDeliveries(openDatabase) },
);

export default createAction(routes.webhooks.billing, (ctx) => ENDPOINT.handler(ctx));
```

An unproven delivery answers `401`, and an event type with no handler is logged and
acknowledged. A handler that returns a failed `Result` answers `503` when the error is
retryable, so the platform delivers again, and `200` otherwise.

> [!WARNING]
> A platform sends its webhooks with no session and no `Origin` header. If your app runs
> `cop()`, exempt the webhook path from it the way
> [Receive and send webhooks](/docs/identity-and-security/webhooks) explains: the signature is
> the endpoint's authentication.

## Keep a delivery store

The store recognizes a redelivery after the request that first saw it has ended. It implements
`WebhookStore` over a table of your own:

```typescript {% title="app/models/webhook-deliveries.ts" %}
import type { WebhookDelivery, WebhookStore } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { webhookDeliveries } from "~/database/schema";

export class WebhookDeliveries implements WebhookStore {
	#db: () => Database;

	constructor(db: () => Database) {
		this.#db = db;
	}

	async find(id: string): Promise<WebhookDelivery | null> {
		return await this.#db().find(webhookDeliveries, id);
	}

	async record(delivery: WebhookDelivery): Promise<void> {
		await this.#db().query(webhookDeliveries).upsert(delivery);
	}

	async markProcessed(id: string): Promise<void> {
		await this.#db().update(webhookDeliveries, id, { processed: true });
	}
}
```

`webhookDeliveries` holds the fields of `WebhookDelivery`, keyed by id. The endpoint is built at
module scope, before any request has a database, so the store opens one per call.

> [!NOTE]
> The order matters. The endpoint records every delivery with its signature verdict before any
> handler trusts it, so a forged one is kept as evidence. It marks a delivery processed only after
> its handler finishes, so a redelivery of a processed id answers `200` without running the
> handler twice, and one whose handler failed runs again.

## Gate a feature

`requireEntitlement` admits a request only when the projection the middleware's `entitlements`
option reads grants the feature, so the decision comes from your table:

```tsx {% title="app/http/controllers/reports.tsx" %}
import { requireEntitlement } from "@sdxc/billing/middleware";
import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { ReportsPage } from "~/resources/views/reports";
import routes from "~/routes/web";

function toPricing(): Response {
	return redirect(routes.pricing.href(), { status: redirect.Status.SeeOther });
}

export default createAction(routes.reports, {
	middleware: [requireEntitlement("reports", { onDenied: toPricing })],
	handler: (ctx) => {
		let products = ctx.entitlements.products;
		return ctx.render(<ReportsPage products={products} />);
	},
});
```

The guard publishes the snapshot it decided on as `ctx.entitlements`. Without `onDenied` a
denied request answers `403`. To combine the plan with roles and ownership,
[Decide who can do what](/docs/identity-and-security/authorization) covers policies.

## Repair what webhooks missed

Deliveries get lost: a deploy mid-delivery, a rotated secret, an outage longer than the
platform's retries. A nightly job walks the platform's live subscriptions and syncs each
customer:

```typescript {% title="app/jobs/reconcile-billing.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import { billing } from "~/app/initializers/billing";
import jobs from "~/app/jobs";
import { syncEntitlements } from "~/app/services/entitlements";

const MAX_PAGES = 50;

export default createJobHandler(jobs.reconcileBilling, async (ctx) => {
	let cursor: string | undefined;

	for (let page = 0; page < MAX_PAGES; page++) {
		let listed = await billing.subscriptions.list({
			product: "pro",
			status: ["active", "trialing"],
			limit: 100,
			cursor,
		});
		if (isFailure(listed)) {
			return ctx.retry({ delay: "1 hour", cause: listed.error });
		}

		for (let subscription of listed.data.items) {
			let id = subscription.customerId;
			if (id === null) continue;

			let synced = await syncEntitlements(ctx.db, billing, { id });
			if (isFailure(synced)) {
				ctx.log.warn("billing.sync_failed", { customer: id });
			}
		}

		if (listed.data.cursor === null) break;
		cursor = listed.data.cursor;
	}
});
```

Declare `jobs.reconcileBilling` with a `cron` such as `"0 4 * * *"`. Only a `null` cursor ends a
list, since a provider can hand back a short page with more behind it. A failed list retries the
whole run, which is safe because every sync writes a full snapshot.

## Test the sync against an in-memory platform

`MemoryBilling` is a whole platform in memory: a test seeds a catalog, buys a product through a
checkout, and asserts on what the sync wrote to your table:

```typescript {% title="app/services/entitlements.test.ts" %}
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { isFailure, unwrap } from "@sdxc/result";
import { beforeAll, expect, test } from "vitest";

import { openDatabase } from "~/app/initializers/database";
import { Entitlements } from "~/app/models/entitlements";
import { syncEntitlements } from "~/app/services/entitlements";
import { migrate } from "~/app/test/database";

beforeAll(migrate);

test("a finished checkout grants the account its features", async () => {
	let db = openDatabase();
	let billing = new MemoryBilling({
		catalog: {
			pro: { amount: 4900, interval: "month", features: { reports: true } },
		},
	});
	let customer = await unwrap(
		billing.customers.create({ email: "ada@example.com", externalId: "acct_1" }),
	);
	let opened = await unwrap(
		billing.checkouts.create({ product: "pro", customer: { id: customer.id } }),
	);
	await unwrap(billing.checkouts.finish(opened.id));

	expect(await unwrap(syncEntitlements(db, billing, { id: customer.id }))).toBe(
		true,
	);

	let snapshot = await Entitlements.snapshot(db, "acct_1");
	expect(snapshot?.features.reports).toBe(true);
});

test("a platform outage answers a failure the caller can retry", async () => {
	let db = openDatabase();
	let billing = new MemoryBilling();
	billing.fail("entitlements.of", "unknown");

	let synced = await syncEntitlements(db, billing, { id: "cus_1" });

	expect(isFailure(synced)).toBe(true);
});
```

## Where to go next

- [Receive and send webhooks](/docs/identity-and-security/webhooks) — signature checks,
  replay stores and fail-closed receivers in general.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — declaring the
  nightly job and its trigger.
- [`@sdxc/billing`](/api/billing) — every resource group, the error codes, and the conformance
  suite for writing a provider of your own.
