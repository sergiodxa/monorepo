/**
 * Tests for the paid-order webhook — the endpoint that records purchases against the
 * newsletter. It also holds the cross-origin-protection regression test: the bypass this
 * route needs fails closed, so a misconfiguration reads as an ordinary 403 in the logs
 * while paid-order events are silently dropped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MemoryBilling, MemoryDelivery } from "@sdxc/billing/providers/memory";

import { BillingWebhook, MemoryWebhookStore } from "@sdxc/billing";
import { Log } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { Product } from "~/app/data/product";
import { handlers } from "~/app/http/controllers/webhooks/polar";
import { container } from "~/app/lib/container";
import { memoryBilling, purchase } from "~/app/lib/test/billing";
import { FakeButtondown } from "~/app/lib/test/buttondown";
import { fetchApp } from "~/app/lib/test/router";
import { Buttondown } from "~/app/services/buttondown";

/** A third-party origin, standing in for the platform's webhook delivery. */
const FOREIGN_ORIGIN = "https://api.polar.sh";

/** The buyer every delivery under test is about. */
const BUYER = "buyer@example.com";

/** A secret no endpoint here is configured with, so a delivery signed by it is a forgery. */
const FOREIGN_SECRET = "YW5vdGhlci1zaWduaW5nLXNlY3JldA";

/**
 * Answers one delivery through the app's own handlers, inside the container
 * scope the worker opens, so the newsletter client resolves the way it does in
 * production.
 *
 * @param billing - The platform the delivery came from and is verified against.
 * @param buttondown - The newsletter client the handler tags through.
 * @param delivery - The signed delivery to answer.
 * @param store - Where deliveries are recorded, for a redelivery under test.
 * @returns The endpoint's response.
 */
function deliver(
	billing: MemoryBilling,
	buttondown: FakeButtondown,
	delivery: MemoryDelivery,
	store?: MemoryWebhookStore,
): Promise<Response> {
	let endpoint = new BillingWebhook(billing, handlers, { store });

	return container.scope(async () => {
		getServiceContainer().instance(Buttondown, buttondown);

		let context = new RequestContext(delivery.request);
		context.billing = billing;
		context.log = new Log({ kind: "request", sink() {} });

		return await endpoint.handler(context);
	});
}

/** Buys a package and signs the paid-order delivery the platform would send for it. */
async function paidOrder(billing: MemoryBilling, product: Product): Promise<MemoryDelivery> {
	let order = await purchase(billing, product, BUYER);
	return await unwrap(billing.webhooks.emit({ type: "order.paid", order }));
}

describe("the paid-order webhook", () => {
	test("tags a subscriber who bought the Complete package", async () => {
		let billing = memoryBilling();
		let buttondown = new FakeButtondown({ subscribed: [BUYER] });

		let response = await deliver(billing, buttondown, await paidOrder(billing, Product.Complete));

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([{ email: BUYER, metadata: { purchase: "complete" } }]);
	});

	test("tags a subscriber who bought Essentials as an individual purchase", async () => {
		let billing = memoryBilling();
		let buttondown = new FakeButtondown({ subscribed: [BUYER] });

		let response = await deliver(billing, buttondown, await paidOrder(billing, Product.Essentials));

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([{ email: BUYER, metadata: { purchase: "individual" } }]);
	});

	test("accepts the delivery without tagging a buyer who is not a subscriber", async () => {
		let billing = memoryBilling();
		let buttondown = new FakeButtondown();

		let response = await deliver(billing, buttondown, await paidOrder(billing, Product.Complete));

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([]);
	});

	test("accepts the delivery without tagging for a package this funnel does not sell", async () => {
		let billing = memoryBilling();
		billing.seed({ workshop: { amount: 19_900 } });

		let buttondown = new FakeButtondown({ subscribed: [BUYER] });
		let order = await purchase(billing, "workshop", BUYER);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		let response = await deliver(billing, buttondown, delivery);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([]);
	});

	test("accepts an event type it does not handle without touching the newsletter", async () => {
		let billing = memoryBilling();
		let buttondown = new FakeButtondown({ subscribed: [BUYER] });

		let order = await purchase(billing, Product.Complete, BUYER);
		let delivery = await unwrap(billing.webhooks.emit({ type: "order.refunded", order }));

		let response = await deliver(billing, buttondown, delivery);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([]);
	});

	test("rejects a delivery whose signature does not verify", async () => {
		let billing = memoryBilling();
		let forger = memoryBilling({ webhookSecret: FOREIGN_SECRET });
		let buttondown = new FakeButtondown({ subscribed: [BUYER] });

		let response = await deliver(billing, buttondown, await paidOrder(forger, Product.Complete));

		expect(response.status).toBe(401);
		expect(buttondown.tagged).toEqual([]);
	});

	test("never echoes the webhook secret back to the caller", async () => {
		let billing = memoryBilling();
		let forger = memoryBilling({ webhookSecret: FOREIGN_SECRET });

		let response = await deliver(
			billing,
			new FakeButtondown(),
			await paidOrder(forger, Product.Complete),
		);

		expect(await response.text()).not.toContain("POLAR_WEBHOOK_SECRET");
	});

	test("tags a buyer once when the platform delivers the same order twice", async () => {
		let billing = memoryBilling();
		let buttondown = new FakeButtondown({ subscribed: [BUYER] });
		let store = new MemoryWebhookStore();
		let order = await purchase(billing, Product.Complete, BUYER);

		/** Reusing the delivery id is what makes the second call a redelivery. */
		let first = await unwrap(billing.webhooks.emit({ id: "whk_1", type: "order.paid", order }));
		let second = await unwrap(billing.webhooks.emit({ id: "whk_1", type: "order.paid", order }));

		expect((await deliver(billing, buttondown, first, store)).status).toBe(200);
		expect((await deliver(billing, buttondown, second, store)).status).toBe(200);

		expect(buttondown.tagged).toHaveLength(1);
		expect(store.deliveries.at(0)?.processed).toBe(true);
	});
});

describe("cross-origin protection", () => {
	test("lets a cross-origin delivery reach the webhook endpoint", async () => {
		let response = await fetchApp("/webhooks/polar", {
			method: "POST",
			headers: { "content-type": "application/json", origin: FOREIGN_ORIGIN },
			body: JSON.stringify({ type: "order.paid" }),
		});

		/** 401 is the endpoint refusing an unsigned delivery, which is proof it got there. */
		expect(response.status).toBe(401);
	});

	test("still rejects a cross-origin post to the subscribe endpoint", async () => {
		let response = await fetchApp("/api/subscribe", {
			method: "POST",
			headers: { origin: FOREIGN_ORIGIN },
			body: new URLSearchParams({ email: "reader@example.com" }),
			services: [[Buttondown, new FakeButtondown()]],
		});

		expect(response.status).toBe(403);
	});
});
