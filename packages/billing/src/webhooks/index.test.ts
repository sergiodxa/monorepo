/**
 * Tests the webhook endpoint against real signed deliveries: it verifies before
 * it trusts, records the delivery, dispatches a narrowed event, deduplicates a
 * replay, acknowledges what nothing handles, and contains a failing handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { sign } from "@sdxc/webhooks";
import { createRouter, RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Order, Subscription } from "../core/types.js";

import { BillingError } from "../core/errors.js";
import { MemoryBilling } from "../providers/memory/index.js";
import { BillingWebhook, MemoryWebhookStore } from "../webhooks/index.js";

/** Secret the deliveries a test signs by hand are keyed on. */
const SECRET = "dGVzdC1zaWduaW5nLXNlY3JldC12YWx1ZQ";

/** Catalog every delivery here is about: one monthly plan. */
const CATALOG = { pro: { amount: 4900, currency: "usd", interval: "month" as const } };

/**
 * Runs one delivery under a log of its own, so a test reads what the endpoint recorded
 * off the emitted record rather than through a logger it installed.
 */
async function recorded(
	fn: () => Response | Promise<Response>,
): Promise<{ response: Response; record: Record<string, unknown> }> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });
	let response = await log.run(fn);
	return { response, record: records[0] ?? {} };
}

/** Every note the record carries, by name and in order. */
function noteNames(record: Record<string, unknown>): string[] {
	return ((record.notes ?? []) as Log.Note[]).map((note) => note.name);
}

/** Buys the plan outright, which is how a test gets an order and a subscription. */
async function buy(billing: MemoryBilling): Promise<{ order: Order; subscription: Subscription }> {
	let customer = await unwrap(
		billing.customers.create({ email: "jane@example.com", externalId: "u_1" }),
	);

	let opened = await unwrap(
		billing.checkouts.create({ product: "pro", customer: { id: customer.id } }),
	);

	let checkout = await unwrap(billing.checkouts.finish(opened.id));

	return {
		order: await unwrap(billing.orders.find(checkout.orderId ?? "")),
		subscription: await unwrap(billing.subscriptions.find(checkout.subscriptionId ?? "")),
	};
}

/** Builds the context the endpoint answers, carrying the delivery as received. */
function context(request: Request): RequestContext {
	return new RequestContext(request);
}

describe("BillingWebhook", () => {
	test("dispatches a valid delivery to the handler keyed by its type", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let paid: string[] = [];

		let endpoint = new BillingWebhook(billing, {
			async "order.paid"(event) {
				paid.push(event.order.id);
				expect(event.order.total).toEqual({ amount: 4900, currency: "usd" });
				expect(event.raw).toBeDefined();
			},
		});

		let response = await endpoint.handler(context(delivery.request));

		expect(response.status).toBe(200);
		expect(paid).toEqual([order.id]);
	});

	test("dispatches each type to its own handler", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { subscription } = await buy(billing);

		let activated: string[] = [];
		let paid: string[] = [];

		let endpoint = new BillingWebhook(billing, {
			async "order.paid"(event) {
				paid.push(event.order.id);
			},
			async "subscription.activated"(event) {
				if (event.subscription.productSlug !== null) activated.push(event.subscription.productSlug);
			},
		});

		let delivery = await unwrap(
			billing.webhooks.emit({ type: "subscription.activated", subscription }),
		);

		await endpoint.handler(context(delivery.request));

		expect(activated).toEqual(["pro"]);
		expect(paid).toEqual([]);
	});

	test("answers 401 without dispatching a delivery signed with another secret", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let forger = new MemoryBilling({
			catalog: CATALOG,
			webhookSecret: "YW5vdGhlci1zaWduaW5nLXNlY3JldA",
		});

		let { order } = await buy(forger);
		let delivery = await unwrap(forger.webhooks.emit({ type: "order.paid", order }));

		let reached = false;

		let endpoint = new BillingWebhook(billing, {
			async "order.paid"() {
				reached = true;
			},
		});

		let { response, record } = await recorded(() => endpoint.handler(context(delivery.request)));

		expect(response.status).toBe(401);
		expect(reached).toBe(false);
		expect(noteNames(record)).toEqual(["billing.webhook.invalid_signature"]);
	});

	test("records a forged delivery as invalid, so the trail shows it arrived", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let forger = new MemoryBilling({
			catalog: CATALOG,
			webhookSecret: "YW5vdGhlci1zaWduaW5nLXNlY3JldA",
		});

		let { order } = await buy(forger);
		let delivery = await unwrap(forger.webhooks.emit({ type: "order.paid", order }));

		let store = new MemoryWebhookStore();
		let endpoint = new BillingWebhook(billing, {}, { store });

		await endpoint.handler(context(delivery.request));

		expect(store.deliveries).toEqual([
			{
				id: delivery.event.id,
				type: "order.paid",
				payload: delivery.body,
				valid: false,
				processed: false,
			},
		]);
	});

	test("records a handled delivery as valid and processed", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let store = new MemoryWebhookStore();

		let endpoint = new BillingWebhook(
			billing,
			{
				async "order.paid"() {},
			},
			{ store },
		);

		await endpoint.handler(context(delivery.request));

		expect(await store.find(delivery.event.id)).toEqual({
			id: delivery.event.id,
			type: "order.paid",
			payload: delivery.body,
			valid: true,
			processed: true,
		});
	});

	test("acknowledges a redelivery without running the handler again", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);

		let store = new MemoryWebhookStore();
		let calls = 0;

		let endpoint = new BillingWebhook(
			billing,
			{
				async "order.paid"() {
					calls += 1;
				},
			},
			{ store },
		);

		let first = await unwrap(billing.webhooks.emit({ id: "whk_same", type: "order.paid", order }));
		let second = await unwrap(billing.webhooks.emit({ id: "whk_same", type: "order.paid", order }));

		expect((await endpoint.handler(context(first.request))).status).toBe(200);

		let replay = await recorded(() => endpoint.handler(context(second.request)));

		expect(replay.response.status).toBe(200);
		expect(calls).toBe(1);
		expect(replay.record).toMatchObject({ "billing.webhook.duplicate": true });
		expect(noteNames(replay.record)).toEqual(["billing.webhook.duplicate"]);
	});

	test("dispatches a redelivery when no store is keeping the trail", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let calls = 0;

		let endpoint = new BillingWebhook(billing, {
			async "order.paid"() {
				calls += 1;
			},
		});

		let first = await unwrap(billing.webhooks.emit({ id: "whk_same", type: "order.paid", order }));
		let second = await unwrap(billing.webhooks.emit({ id: "whk_same", type: "order.paid", order }));

		await endpoint.handler(context(first.request));
		await endpoint.handler(context(second.request));

		expect(calls).toBe(2);
	});

	test("acknowledges a type nothing handles", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.refunded", order }));

		let store = new MemoryWebhookStore();

		let endpoint = new BillingWebhook(
			billing,
			{
				async "order.paid"() {},
			},
			{ store },
		);

		let { response, record } = await recorded(() => endpoint.handler(context(delivery.request)));

		expect(response.status).toBe(200);
		expect(noteNames(record)).toEqual(["billing.webhook.unhandled"]);
		expect((await store.find(delivery.event.id))?.processed).toBe(true);
	});

	test("acknowledges an authentic delivery this vocabulary does not model", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let delivery = await unwrap(
			billing.webhooks.emit({ type: "unrecognized", providerType: "refund.created" }),
		);

		let seen: string[] = [];

		let endpoint = new BillingWebhook(billing, {
			async unrecognized(event) {
				seen.push(event.providerType);
			},
		});

		let response = await endpoint.handler(context(delivery.request));

		expect(response.status).toBe(200);
		expect(seen).toEqual(["refund.created"]);
	});

	test("acknowledges an authentic body it cannot normalize", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG, webhookSecret: SECRET });

		let signed = await unwrap(
			sign(JSON.stringify({ id: "whk_broken", type: "order.paid", data: { id: "ord_1" } }), {
				secret: SECRET,
				id: "whk_broken",
				timestamp: new Date(),
			}),
		);

		let endpoint = new BillingWebhook(billing, {
			async "order.paid"() {},
		});

		let { response, record } = await recorded(() =>
			endpoint.handler(
				context(
					new Request("https://example.com/webhooks/billing", {
						method: "POST",
						headers: signed.headers,
						body: signed.body,
					}),
				),
			),
		);

		expect(response.status).toBe(200);
		expect(noteNames(record)).toEqual(["billing.webhook.unreadable"]);
	});

	test("logs a throwing handler and acknowledges, so the platform stays enabled", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let store = new MemoryWebhookStore();

		let endpoint = new BillingWebhook(
			billing,
			{
				async "order.paid"() {
					throw new Error("grant failed");
				},
			},
			{ store },
		);

		let { response, record } = await recorded(() => endpoint.handler(context(delivery.request)));

		expect(response.status).toBe(200);
		expect(noteNames(record)).toEqual(["billing.webhook.handler_failed"]);
		expect(record.outcome).toBe("degraded");
		expect((record.notes as Log.Note[])[0]?.error).toBe("grant failed");
		expect((await store.find(delivery.event.id))?.processed).toBe(false);
	});

	test("asks for another delivery when the handler failure is retryable", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let endpoint = new BillingWebhook(billing, {
			async "order.paid"() {
				throw new BillingError("platform is down", {
					code: "rate_limited",
					connection: billing.connection,
				});
			},
		});

		expect((await endpoint.handler(context(delivery.request))).status).toBe(503);
	});

	test("asks for another delivery when the app's retry policy says so", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let endpoint = new BillingWebhook(
			billing,
			{
				async "order.paid"() {
					throw new Error("write conflict");
				},
			},
			{ retry: () => true },
		);

		expect((await endpoint.handler(context(delivery.request))).status).toBe(503);
	});

	test("answers a delivery unchanged when no log is open to record it", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let response = await new BillingWebhook(billing, {}).handler(context(delivery.request));

		expect(response.status).toBe(200);
	});

	test("mounts as a route action", async () => {
		let billing = new MemoryBilling({ catalog: CATALOG });
		let { order } = await buy(billing);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let paid: string[] = [];

		let router = createRouter();

		router.post(
			"/webhooks/billing",
			new BillingWebhook(billing, {
				async "order.paid"(event) {
					paid.push(event.order.id);
				},
			}),
		);

		let response = await router.fetch(
			new Request("https://example.com/webhooks/billing", {
				method: "POST",
				headers: delivery.headers,
				body: delivery.body,
			}),
		);

		expect(response.status).toBe(200);
		expect(paid).toEqual([order.id]);
	});
});
