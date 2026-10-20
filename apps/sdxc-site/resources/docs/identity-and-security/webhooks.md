---
title: Receive and send webhooks
description: Verify Standard Webhooks deliveries, reject replays, hand the work to a queue, and sign the deliveries you send.
section:
    title: Identity & security
    order: 6
order: 3
lastUpdated: 2026-10-19
outcomes:
    - "How to verify Standard Webhooks deliveries and reject replays"
    - "How to answer fast by handing each delivery to a background job"
    - "How to sign the webhooks your own app sends"
---

A webhook endpoint is a public URL that accepts `POST`s from anyone, so its signature check is
its whole authentication: get it wrong and anyone can post an event. This guide builds a
receiver that verifies each delivery, rejects replays and answers fast by handing the work to a
background job, then turns around and signs deliveries of its own.

[`@sdxc/webhooks`](/api/webhooks) implements [Standard Webhooks](https://www.standardwebhooks.com/)
on WebCrypto, [`@sdxc/jobs`](/api/jobs) runs the work off the request, and
[`@sdxc/billing`](/api/billing) shows the same shape for a billing platform's deliveries.
Sending your own, [`@sdxc/outbound`](/api/outbound) keeps each delivery on the public internet
and [`@sdxc/backoff`](/api/backoff) spaces out the retries.

```bash
npm add @sdxc/backoff @sdxc/billing @sdxc/http @sdxc/jobs @sdxc/logger @sdxc/outbound \
	@sdxc/result @sdxc/webhooks remix
```

## Declare the job a delivery becomes

The endpoint's only job is to decide whether a delivery is authentic. Everything it means for
your app runs in a job, so a slow database or a third-party call never makes the sender time
out and retry.

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	orders: {
		fulfil: job({ input: s.object({ orderId: s.string() }) }),
	},
	webhooks: {
		deliver: job({
			input: s.object({ endpointId: s.string(), eventId: s.string() }),
		}),
	},
});
```

The second job is for sending, further down. Build the queue once, in a module both the
dispatcher and the router import, so the router writes to the same backend the dispatcher
delivers from:

```typescript {% title="app/initializers/queue.ts" %}
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

export const queue = cloudflare.queue(() => env.QUEUE);
```

`jobEnqueuer(queue)` from `@sdxc/jobs/router` goes in the router's middleware and publishes
`ctx.jobs`, which is how a route handler enqueues. Only the queue enters the request path; the
dispatcher and every job handler stay out of it:

```typescript {% title="app/initializers/router.ts" %}
import { jobEnqueuer } from "@sdxc/jobs/router";
import { createRouter } from "remix/router";

import { queue } from "~/app/initializers/queue";

export function createWebRouter() {
	return createRouter({ middleware: [jobEnqueuer(queue)] });
}
```

Put it alongside the middleware your app already runs, after `trace()` if you use it, so each
message carries the request's trace. How the dispatcher is built over the same `queue` is in
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron).

## Verify, then enqueue

`Webhooks.verify` reads the body once, as text, checks the timestamp is inside the tolerance,
compares the signature in constant time, consults the replay store, and only then parses the
payload with your schema.

```typescript {% title="app/http/controllers/webhooks/orders.ts" %}
import { accepted } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { refuse } from "~/app/http/controllers/webhooks/refuse";
import jobs from "~/app/jobs";
import routes from "~/routes/web";

const ORDER_PAID = s.object({
	type: s.literal("order.paid"),
	data: s.object({ orderId: s.string() }),
});

export default createAction(routes.webhooks.orders, async (ctx) => {
	let result = await Webhooks.verify(ctx.request, {
		secret: env.ORDERS_WEBHOOK_SECRET,
		schema: ORDER_PAID,
		store: new Webhooks.KVReplayStore(env.WEBHOOKS, { prefix: "orders:" }),
	});
	if (isFailure(result)) return refuse(ctx.log, result.error);

	let { orderId } = result.data.payload.data;
	await ctx.jobs.enqueue(jobs.orders.fulfil, { orderId });
	return accepted({ received: true });
});
```

The route is a `post("/webhooks/orders")`. A sender has no session and no `Origin` header, so
if your app runs Remix's
[`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware), exempt the
webhook paths from it: the signature is the stronger claim.

The payload comes back typed from the schema, and the exact text the signature covered is on
`result.data.body` if you want to store the raw delivery.

<note>
Verify before anything else reads the request: the body is a stream, and one consumed upstream
fails with `UnreadableBodyError`.
</note>

The replay store remembers each accepted delivery id for twice the tolerance.

<warning>
KV reads are eventually consistent, so a duplicate arriving within seconds in another location
can slip past the replay store. The store narrows the replay window; an idempotent job is what
makes a repeat harmless.
</warning>

## Fail closed, and answer each failure honestly

A secret that is not configured must mean "refuse everything", and here it does:
`env.ORDERS_WEBHOOK_SECRET` being unset, empty or not base64 fails the call with
`InvalidSecretError`, so every delivery is refused until the secret exists. What remains is
choosing the status for each failure, because the status is what tells the sender whether to
retry. That is the `refuse` helper the endpoint imports:

```typescript {% title="app/http/controllers/webhooks/refuse.ts" %}
import type { Log } from "@sdxc/logger";

import {
	accepted,
	ok,
	serviceUnavailable,
	unauthorized,
} from "@sdxc/http/response/json";
import * as Webhooks from "@sdxc/webhooks";

export function refuse(log: Log, error: Webhooks.WebhookError): Response {
	if (error instanceof Webhooks.DuplicateDeliveryError)
		return ok({ duplicate: true });
	if (error instanceof Webhooks.PayloadValidationError) {
		return accepted({ ignored: true });
	}

	log.warn("webhook.rejected", { kind: error.name, delivery: error.deliveryId });

	if (error instanceof Webhooks.InvalidSecretError) {
		return serviceUnavailable({ error: "receiver not configured" });
	}

	return unauthorized({ error: "invalid delivery" });
}
```

A duplicate means the work already happened, so a success stops the retries. A
`PayloadValidationError` is authentic but shaped like nothing you model — an event type you
never subscribed to — so a retry would change nothing and `202` acknowledges it. A missing
secret is your fault rather than the sender's, and a `503` asks it to try again once you have
fixed it. Everything else — a missing header, a stale timestamp, a signature that matches no
secret — is an authentication failure. `name` and `deliveryId` are safe to log; no error carries
a secret or a signature.

To rotate your secret, pass both in `secrets` instead of `secret` — the new one first, the old
one after — wait for the sender's queue to drain, and drop the old one. A delivery is accepted
when any configured secret matches it.

## Do the work in the job

The job runs whenever the queue delivers the message, as many times as it takes to succeed.

```typescript {% title="app/jobs/orders/fulfil.ts" %}
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { Orders } from "~/app/models/orders";

export default createJobHandler(jobs.orders.fulfil, async (ctx) => {
	let order = await Orders.find(ctx.db, ctx.input.orderId);
	if (order === null) return ctx.exit("Order no longer exists");

	if (order.status === "paid") return ctx.ack("Already fulfilled");
	await Orders.markPaid(ctx.db, order.id);
});
```

`ctx.input` is parsed against the job's schema before the handler runs. Checking the order's
state first is what keeps a repeated message harmless: `ctx.ack` finishes the run as completed.
`ctx.exit` gives up for good on a message that can never succeed, so it is not retried forever.
`ctx.db` is published by job middleware, as it is on a request.

## Send webhooks of your own

Delivering is a job too, one per endpoint per event, so a slow subscriber holds up nobody else
and a failed attempt is retried by the queue. Enqueue one for each subscriber with
`ctx.jobs.enqueueMany(jobs.webhooks.deliver, …)` from the route handler where the event
happens, or with `dispatcher.enqueueMany` when it happens inside another job.

```typescript {% title="app/jobs/webhooks/deliver.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { checkUrl, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

import jobs from "~/app/jobs";
import { Endpoints } from "~/app/models/endpoints";
import { Events } from "~/app/models/events";

const retryBackoff = createBackoff({ base: "1 minute", max: "6 hours", jitter: 0.2 });

export default createJobHandler(jobs.webhooks.deliver, async (ctx) => {
	let endpoint = await Endpoints.find(ctx.db, ctx.input.endpointId);
	let event = await Events.find(ctx.db, ctx.input.eventId);
	if (endpoint === null || event === null)
		return ctx.exit("Endpoint or event is gone");

	let url = checkUrl(endpoint.url);
	if (isFailure(url)) return ctx.exit(url.error.message);

	let signed = await Webhooks.sign(event.payload, {
		secret: endpoint.secret,
		id: event.id,
		timestamp: new Date(),
	});
	if (isFailure(signed)) return ctx.exit(signed.error.name);

	let { headers, body } = signed.data;
	headers.set("Content-Type", "application/json");

	let response = await fetch(url.data, {
		method: "POST",
		headers,
		body,
		redirect: "manual",
		signal: AbortSignal.timeout(10_000),
	});
	release(response.body);

	if (response.status === 429 || response.status >= 500) {
		return ctx.retry({ delay: retryBackoff.delay(ctx.attempts) });
	}
	if (!response.ok) return ctx.exit(`Endpoint answered ${response.status}`);
});
```

The endpoint URL is one a subscriber typed, so it is checked before anything is sent:
`checkUrl` refuses anything but HTTP(S), credentials in the URL, private and reserved
addresses such as `169.254.169.254`, and names that cannot be public, such as `localhost` or
`.internal`. Run the same check when a subscriber saves the URL, so they see the refusal on the
form rather than in a failed delivery. The delivery reads a redirect as a failure, since a
receiver answers a webhook directly. Nothing reads the receiver's reply, so `release` lets go
of it at once.

<warning>
Keep `redirect: "manual"`. A followed redirect carries the signed body to whatever host the
subscriber's server names, including the private addresses `checkUrl` refused.
</warning>

A receiver that is down gets a minute before the second attempt, then twice as long each time
up to six hours, with ±20% jitter so the deliveries that failed together do not all return at
once. `ctx.attempts` is the delivery count the queue keeps, so the schedule needs no row of its
own. [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) and
[Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) cover both
packages further.

Reuse the same `id` on every attempt, so the receiver can recognize a retry, and sign each
attempt with a fresh `timestamp`, so a slow retry still lands inside its tolerance. Send
`signed.data.body` rather than re-serializing the payload: it is the exact text the signature
covers. `sign()` sets only the three signature headers, which is why the content type is added
here.

Each subscriber gets its own secret, in the format receivers expect: `whsec_` followed by
base64. Mint one with [`@sdxc/crypto`](/api/crypto) as
`` `whsec_${Base64.encode(randomBytes(32))}` ``, show it once, and store it sealed with `seal`
rather than in plain text.

## Receive a billing platform's deliveries

Billing platforms sign their webhooks in their own ways, so [`@sdxc/billing`](/api/billing)
wraps the whole receiver in one class: the provider verifies the signature, a store records
each delivery before anything trusts it, and a handler per event type does the work.

```typescript {% title="app/http/controllers/webhooks/billing.ts" %}
import { BillingWebhook } from "@sdxc/billing";

import jobs from "~/app/jobs";
import { polar } from "~/app/initializers/billing";
import { deliveries } from "~/app/models/webhook-deliveries";

export default new BillingWebhook(
	polar,
	{
		async "order.paid"(event, ctx) {
			await ctx.jobs.enqueue(jobs.orders.fulfil, { orderId: event.order.id });
		},
	},
	{ store: deliveries },
);
```

Mount it with `router.map(routes.webhooks.billing, billingWebhook)`: its bound `handler`
satisfies the router's action form. Each handler is called with the event and the request's
own context, so it reaches the same `ctx.jobs` the orders endpoint enqueues through. `polar` is
your `PolarBilling` provider from
`@sdxc/billing/providers/polar`. An unproven delivery is the one `401`; a duplicate already
processed answers `200` at once, an event type with no handler is logged and acknowledged, and a
handler that throws a retryable error answers `503` so the platform delivers again. The provider
reads its secret through a function such as `webhookSecret: () => env.POLAR_WEBHOOK_SECRET`, and
an unreadable secret fails verification, so this receiver fails closed too.

`deliveries` is your own table behind the `WebhookStore` interface — `find`, `record` and
`markProcessed` — which keeps forged deliveries as evidence and unprocessed ones ready to retry.
`MemoryWebhookStore` stands in for it in tests.

## Test the receiver

Sign a delivery with `Webhooks.sign`, exactly as a sender would, and post it through the router.
Set `ORDERS_WEBHOOK_SECRET` to a `whsec_` value and `WEBHOOKS` to `createKVNamespace()` in
`app/test/cloudflare-workers.ts`:

```typescript {% title="app/http/controllers/webhooks/orders.test.ts" %}
import { unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import { env } from "cloudflare:workers";
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

async function deliver(id: string, edit = (body: string) => body) {
	let payload = { type: "order.paid", data: { orderId: "order-1" } };
	let { headers, body } = unwrap(
		await Webhooks.sign(payload, {
			secret: env.ORDERS_WEBHOOK_SECRET,
			id,
			timestamp: new Date(),
		}),
	);
	headers.set("Content-Type", "application/json");
	return createWebRouter().fetch(
		new Request(new URL(routes.webhooks.orders.href(), "https://example.com"), {
			method: "POST",
			headers,
			body: edit(body),
		}),
	);
}

test("accepts a delivery once and answers its replay as a duplicate", async () => {
	expect((await deliver("msg_1")).status).toBe(202);
	expect((await deliver("msg_1")).status).toBe(200);
});

test("refuses a body changed after signing", async () => {
	let response = await deliver("msg_2", (body) =>
		body.replace("order-1", "order-2"),
	);

	expect(response.status).toBe(401);
});
```

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  the queue binding, and retries.
- [Test Workers apps](/docs/operations-and-testing/testing) — run the receiver and its replay
  store against real KV bindings, with deliveries signed by `Webhooks.sign`.
- [Sign and verify HTTP requests](/docs/identity-and-security/http-message-signatures) — for a
  sender that signs with an HTTP message signature and a key pair, rather than a shared secret.
