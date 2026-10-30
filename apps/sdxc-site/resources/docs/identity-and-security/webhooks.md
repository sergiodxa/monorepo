---
title: Receive and send webhooks
description: Verify Standard Webhooks deliveries, reject replays, hand the work to a queue, and sign the deliveries you send.
section:
    title: Identity & security
    order: 6
order: 3
lastUpdated: 2026-10-25
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
on WebCrypto and [`@sdxc/jobs`](/api/jobs) runs the work off the request. Sending your own,
[`@sdxc/outbound`](/api/outbound) keeps each delivery on the public internet and
[`@sdxc/backoff`](/api/backoff) spaces out the retries.

```bash
npm add @sdxc/backoff @sdxc/http @sdxc/jobs @sdxc/logger @sdxc/outbound \
	@sdxc/result @sdxc/webhooks remix
```

## Declare the job a delivery becomes

The endpoint only decides whether a delivery is authentic. Everything it means for your app
runs in a job, so a slow database never makes the sender time out and retry.

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

The second job is for sending, further down.
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds the queue, the
dispatcher, and the `ctx.jobs` a route handler enqueues through.

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

A sender has no session and no `Origin` header, so if your app runs Remix's
[`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware), exempt the
webhook paths from it: the signature is the stronger claim.

> [!NOTE]
> Verify before anything else reads the request: the body is a stream, and one consumed upstream
> fails with `UnreadableBodyError`.

> [!WARNING]
> KV reads are eventually consistent, so a duplicate arriving within seconds in another location
> can slip past the replay store. The store narrows the replay window; an idempotent job is what
> makes a repeat harmless.

## Fail closed, and answer each failure honestly

An unset, empty or malformed secret fails the call with `InvalidSecretError`, so every delivery
is refused until the secret exists. What remains is choosing the status for each failure, since
the status tells the sender whether to retry:

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

A duplicate means the work already happened, so a success stops the retries. An authentic
event type you never modeled gets a `202`, since a retry would change nothing. A missing secret
is your fault, and a `503` asks the sender to try again later. Everything else is an
authentication failure. To rotate your secret, pass both in `secrets`, new one first, and drop
the old one once the sender's queue drains.

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

Checking the order's state first keeps a repeated message harmless: `ctx.ack` finishes the run
as completed, and `ctx.exit` gives up for good on a message that can never succeed.

## Send webhooks of your own

Delivering is a job too, one per endpoint per event, so a slow subscriber holds up nobody else.
Enqueue one for each subscriber with `ctx.jobs.enqueueMany(jobs.webhooks.deliver, …)` where
the event happens.

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

The endpoint URL is one a subscriber typed, so `checkUrl` refuses private and reserved
addresses such as `169.254.169.254` before anything is sent; run the same check when the
subscriber saves the URL. [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls)
covers it further.

> [!WARNING]
> Keep `redirect: "manual"`. A followed redirect carries the signed body to whatever host the
> subscriber's server names, including the private addresses `checkUrl` refused.

A receiver that is down gets a minute before the second attempt, then twice as long each time
up to six hours, with jitter so failed deliveries do not all return at once. Reuse the same `id`
on every attempt, so the receiver can recognize a retry, and sign each attempt with a fresh
`timestamp`, so a slow retry still lands inside its tolerance.

Each subscriber gets its own secret: `whsec_` followed by base64, minted with
[`@sdxc/crypto`](/api/crypto) as `` `whsec_${Base64.encode(randomBytes(32))}` ``, shown once
and stored sealed.

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
