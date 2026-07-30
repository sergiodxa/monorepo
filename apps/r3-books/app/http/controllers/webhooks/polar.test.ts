/**
 * Tests for `POST /webhooks/polar` — the endpoint that records purchases against the
 * newsletter. It also holds the cross-origin-protection regression test: the bypass this
 * route needs fails closed, so a misconfiguration reads as an ordinary 403 in the logs
 * while paid-order events are silently dropped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { PolarClient } from "@pkg/polar";
import { failure, success } from "@pkg/result";

import { Product } from "~/app/data/product";
import { FakeButtondown } from "~/app/lib/test/buttondown";
import { FakePolarClient, makeEvent, makeOrderPaidEvent } from "~/app/lib/test/polar";
import { fetchApp } from "~/app/lib/test/router";
import { Buttondown } from "~/app/services/buttondown";

/** An origin other than the app's own, standing in for Polar's delivery. */
const FOREIGN_ORIGIN = "https://api.polar.sh";

/** Delivers one webhook body against scripted clients. */
function deliver(
	polar: FakePolarClient,
	buttondown: FakeButtondown,
	init: RequestInit = {},
): Promise<Response> {
	return fetchApp("/webhooks/polar", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ type: "order.paid" }),
		services: [
			[PolarClient, polar],
			[Buttondown, buttondown],
		],
		...init,
	});
}

describe("POST /webhooks/polar", () => {
	test("tags a subscriber who bought the Complete package", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ productId: Product.Complete })),
		});
		let buttondown = new FakeButtondown({ subscribed: ["buyer@example.com"] });

		let response = await deliver(polar, buttondown);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([
			{ email: "buyer@example.com", metadata: { purchase: "complete" } },
		]);
	});

	test("tags a subscriber who bought Essentials as an individual purchase", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ productId: Product.Essentials })),
		});
		let buttondown = new FakeButtondown({ subscribed: ["buyer@example.com"] });

		let response = await deliver(polar, buttondown);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([
			{ email: "buyer@example.com", metadata: { purchase: "individual" } },
		]);
	});

	test("accepts the delivery without tagging a buyer who is not a subscriber", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ productId: Product.Complete })),
		});
		let buttondown = new FakeButtondown();

		let response = await deliver(polar, buttondown);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([]);
	});

	test("accepts the delivery without tagging for an unrecognized product", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ productId: "product_unknown" })),
		});
		let buttondown = new FakeButtondown({ subscribed: ["buyer@example.com"] });

		let response = await deliver(polar, buttondown);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([]);
	});

	test("accepts an event type it does not handle without touching the newsletter", async () => {
		let polar = new FakePolarClient({ webhook: success(makeEvent("refund.created")) });
		let buttondown = new FakeButtondown({ subscribed: ["buyer@example.com"] });

		let response = await deliver(polar, buttondown);

		expect(response.status).toBe(200);
		expect(buttondown.tagged).toEqual([]);
	});

	test("rejects a delivery whose signature does not verify", async () => {
		let polar = new FakePolarClient({
			webhook: failure(new Error("Invalid Polar webhook signature")),
		});

		let response = await deliver(polar, new FakeButtondown());

		expect(response.status).toBe(400);
	});

	test("rejects an order with no product so Polar retries", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ productId: null })),
		});

		let response = await deliver(polar, new FakeButtondown());

		expect(response.status).toBe(400);
	});

	test("rejects an order with no customer email so Polar retries", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ email: null })),
		});

		let response = await deliver(polar, new FakeButtondown());

		expect(response.status).toBe(400);
	});

	test("never echoes the webhook secret back to the caller", async () => {
		let polar = new FakePolarClient({
			webhook: failure(new Error("Invalid Polar webhook signature")),
		});

		let response = await deliver(polar, new FakeButtondown());

		expect(await response.text()).not.toContain("POLAR_WEBHOOK_SECRET");
	});
});

describe("cross-origin protection", () => {
	test("lets a cross-origin delivery through the middleware chain", async () => {
		let polar = new FakePolarClient({
			webhook: success(makeOrderPaidEvent({ productId: Product.Complete })),
		});
		let buttondown = new FakeButtondown({ subscribed: ["buyer@example.com"] });

		let response = await deliver(polar, buttondown, {
			headers: { "content-type": "application/json", origin: FOREIGN_ORIGIN },
		});

		// The delivery is authenticated by its signature, not its origin: Polar posts from
		// its own origin, so a rejection here would drop every paid-order event.
		expect(response.status).toBe(200);
		expect(buttondown.tagged).toHaveLength(1);
	});

	test("still rejects a cross-origin post to the subscribe endpoint", async () => {
		let response = await fetchApp("/api/subscribe", {
			method: "POST",
			headers: { origin: FOREIGN_ORIGIN },
			body: new URLSearchParams({ email: "reader@example.com" }),
			services: [[Buttondown, new FakeButtondown()]],
		});

		// Proves the bypass is scoped to the webhook rather than disabling the protection.
		expect(response.status).toBe(403);
	});
});
