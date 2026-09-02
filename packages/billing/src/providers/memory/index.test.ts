/**
 * Tests what the memory provider does beyond the shared conformance suite: it
 * settles checkouts into orders and subscriptions, derives entitlements from
 * that state, prices discounts in minor units, and signs its own deliveries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { Order } from "../../core/types";

import type { MemoryBillingOptions, MemoryProductSeed } from "./index";

import { MemoryBilling } from "./index";

/** Catalog every test starts from: a monthly plan, a one-time sale, and a yen plan. */
const CATALOG: Record<string, MemoryProductSeed> = {
	pro: {
		name: "Pro",
		amount: 4900,
		currency: "usd",
		interval: "month",
		features: { flow_monitors: true },
		credits: { pings: 1000 },
	},
	book: { amount: 2900, currency: "usd" },
	tokyo: { amount: 5000, currency: "jpy", interval: "month" },
};

/** Discounts every test starts from, one of them restricted to the yen plan. */
const DISCOUNTS = [
	{ id: "disc_tenth", code: "TENTH", percentage: 10, products: ["tokyo"] },
	{ id: "disc_five", code: "FIVE", amount: 500 },
];

/** Builds the provider under test with the shared catalog and discounts. */
function build(options: MemoryBillingOptions = {}): MemoryBilling {
	return new MemoryBilling({ catalog: CATALOG, discounts: DISCOUNTS, ...options });
}

/** Buys a product outright, which is how a test gets an order and a subscription. */
async function buy(billing: MemoryBilling, product: string, externalId = "u_1") {
	let customer = await unwrap(
		billing.customers.create({ email: `${externalId}@example.com`, externalId }),
	);

	let checkout = await unwrap(billing.checkouts.create({ product, customer: { id: customer.id } }));

	return { customer, checkout: await unwrap(billing.checkouts.finish(checkout.id)) };
}

describe("MemoryBilling", () => {
	test("reports the connection it was configured with", () => {
		expect(build().connection).toBe("memory");
		expect(build({ connection: "memory_eu" }).connection).toBe("memory_eu");
	});

	test("accepts a catalog seeded after construction", async () => {
		let billing = build();

		billing.seed({ team: { amount: 9900, currency: "usd", interval: "year" } });

		let product = await unwrap(billing.catalog.find("team"));

		expect(product.prices.at(0)?.interval).toBe("year");
		expect(product.prices.at(0)?.kind).toBe("recurring");
	});

	test("settles a finished checkout into a paid order and an active subscription", async () => {
		let billing = build();

		let { customer, checkout } = await buy(billing, "pro");

		expect(checkout.status).toBe("completed");
		expect(checkout.orderId).not.toBeNull();
		expect(checkout.subscriptionId).not.toBeNull();

		let order = await unwrap(billing.orders.find(checkout.orderId ?? ""));

		expect(order.paid).toBe(true);
		expect(order.total).toEqual({ amount: 4900, currency: "usd" });
		expect(order.customerId).toBe(customer.id);

		let subscription = await unwrap(billing.subscriptions.find(checkout.subscriptionId ?? ""));

		expect(subscription.status).toBe("active");
		expect(subscription.providerStatus).toBe("active");
		expect(subscription.productSlug).toBe("pro");
		expect(subscription.currentPeriodEnd?.getTime()).toBeGreaterThan(Date.now());
	});

	test("leaves a one-time sale without a subscription", async () => {
		let billing = build();

		let { checkout } = await buy(billing, "book");

		expect(checkout.orderId).not.toBeNull();
		expect(checkout.subscriptionId).toBeNull();
	});

	test("keeps a settled checkout settled, so a second return changes nothing", async () => {
		let billing = build();

		let { checkout } = await buy(billing, "pro");
		let again = await unwrap(billing.checkouts.finish(checkout.id));

		expect(again.orderId).toBe(checkout.orderId);

		let orders = await unwrap(billing.orders.list({ customer: { externalId: "u_1" } }));

		expect(orders.items).toHaveLength(1);
	});

	test("provisions a customer for a checkout opened with only our own identifier", async () => {
		let billing = build();

		let checkout = await unwrap(
			billing.checkouts.create({
				product: "book",
				customer: { externalId: "u_new" },
				email: "new@example.com",
			}),
		);

		expect(checkout.customerId).toBeNull();

		let settled = await unwrap(billing.checkouts.finish(checkout.id));
		let customer = await unwrap(billing.customers.find({ externalId: "u_new" }));

		expect(settled.customerId).toBe(customer.id);
		expect(customer.email).toBe("new@example.com");
	});

	test("derives entitlements from the products a customer holds", async () => {
		let billing = build();

		await buy(billing, "pro");

		let state = await unwrap(billing.entitlements.of({ externalId: "u_1" }));

		expect(state.products).toEqual(["pro"]);
		expect(state.features).toEqual({ flow_monitors: true });
		expect(state.subscriptions.at(0)?.status).toBe("active");
		expect(state.meters).toEqual([{ meter: "pings", credited: 1000, consumed: 0, balance: 1000 }]);
	});

	test("counts ingested usage against the granted credits", async () => {
		let billing = build();

		await buy(billing, "pro");

		await unwrap(
			billing.usage.ingest([
				{ name: "pings", customer: { externalId: "u_1" }, externalId: "e_1" },
				{ name: "pings", customer: { externalId: "u_1" }, externalId: "e_2" },
			]),
		);

		let state = await unwrap(billing.entitlements.of({ externalId: "u_1" }));

		expect(state.meters).toEqual([{ meter: "pings", credited: 1000, consumed: 2, balance: 998 }]);

		let reading = await unwrap(
			billing.meters.quantities({
				meter: "pings",
				customer: { externalId: "u_1" },
				from: new Date("2026-09-01T00:00:00Z"),
				to: new Date("2026-09-30T00:00:00Z"),
				interval: "day",
			}),
		);

		expect(reading.quantity).toBe(2);
	});

	test("rejects a usage event that names no meter", async () => {
		let billing = build();

		let result = await billing.usage.ingest([{ name: "", customer: { externalId: "u_1" } }]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("invalid_request");
	});

	test("takes a percentage discount off a zero-decimal price in whole units", async () => {
		let billing = build();

		let customer = await unwrap(
			billing.customers.create({ email: "yen@example.com", externalId: "u_yen" }),
		);

		let checkout = await unwrap(
			billing.checkouts.create({
				product: "tokyo",
				customer: { id: customer.id },
				discount: "disc_tenth",
			}),
		);

		expect(checkout.amount).toEqual({ amount: 4500, currency: "jpy" });
		expect(checkout.discountId).toBe("disc_tenth");
	});

	test("refuses a discount restricted to another product", async () => {
		let billing = build();

		let result = await billing.checkouts.create({
			product: "pro",
			customer: { externalId: "u_1" },
			discount: "disc_tenth",
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("invalid_request");
	});

	test("resolves a customer-facing discount code to the discount a checkout applies", async () => {
		let billing = build();

		let discount = await unwrap(billing.discounts.findByCode("FIVE"));

		expect(discount.id).toBe("disc_five");
		expect(discount.kind).toBe("fixed");
		expect(discount.amount).toEqual({ amount: 500, currency: "usd" });
	});

	test("refuses a second customer for one email address", async () => {
		let billing = build();

		await unwrap(billing.customers.create({ email: "one@example.com", externalId: "u_1" }));

		let repeated = await billing.customers.create({
			email: "one@example.com",
			externalId: "u_2",
		});

		expect(isFailure(repeated)).toBe(true);
		if (isFailure(repeated)) expect(repeated.error.code).toBe("conflict");
	});

	test("updates only the fields an update names", async () => {
		let billing = build();

		let created = await unwrap(
			billing.customers.create({ email: "one@example.com", externalId: "u_1", name: "One" }),
		);

		let updated = await unwrap(billing.customers.update({ id: created.id }, { name: "Uno" }));

		expect(updated.name).toBe("Uno");
		expect(updated.email).toBe("one@example.com");
		expect(updated.externalId).toBe("u_1");
	});

	test("answers an empty page for a filter naming a customer it never saw", async () => {
		let billing = build();

		let orders = await unwrap(billing.orders.list({ customer: { externalId: "u_missing" } }));

		expect(orders).toEqual({ items: [], cursor: null });
	});

	test("rejects a cursor it did not issue", async () => {
		let billing = build();

		let result = await billing.customers.list({ cursor: "not-a-cursor" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("invalid_request");
	});

	test("signs a delivery its own verification accepts, and normalizes it", async () => {
		let billing = build();

		let { checkout } = await buy(billing, "pro");
		let order = await unwrap(billing.orders.find(checkout.orderId ?? ""));

		let delivery = await unwrap(billing.webhooks.emit({ type: "order.paid", order }));

		expect(await billing.webhooks.verify(delivery.request, delivery.body)).toBe(true);
		expect(billing.webhooks.reference(delivery.request, delivery.body)).toEqual({
			deliveryId: delivery.event.id,
			object: { id: delivery.event.id, type: "order.paid" },
		});

		let event = await unwrap(billing.webhooks.event(delivery.request, delivery.body));

		expect(event.type).toBe("order.paid");
		expect(event.raw).toBeDefined();
		if (event.type !== "order.paid") return;

		expect(event.order.id).toBe(order.id);
		expect(event.order.createdAt).toBeInstanceOf(Date);
		expect(event.order.total).toEqual({ amount: 4900, currency: "usd" });
	});

	test("refuses a delivery signed with another secret", async () => {
		let billing = build();
		let other = build({ webhookSecret: "YW5vdGhlci1zaWduaW5nLXNlY3JldA" });

		let { checkout } = await buy(other, "pro");
		let order = await unwrap(other.orders.find(checkout.orderId ?? ""));
		let delivery = await unwrap(other.webhooks.emit({ type: "order.paid", order }));

		expect(await billing.webhooks.verify(delivery.request, delivery.body)).toBe(false);
	});

	test("reuses a delivery id on request, so a redelivery is detectable", async () => {
		let billing = build();

		let { checkout } = await buy(billing, "pro");
		let order = await unwrap(billing.orders.find(checkout.orderId ?? ""));

		let first = await unwrap(billing.webhooks.emit({ id: "whk_fixed", type: "order.paid", order }));
		let second = await unwrap(
			billing.webhooks.emit({ id: "whk_fixed", type: "order.paid", order }),
		);

		expect(billing.webhooks.reference(first.request, first.body)?.deliveryId).toBe("whk_fixed");
		expect(billing.webhooks.reference(second.request, second.body)?.deliveryId).toBe("whk_fixed");
	});

	test("normalizes a subscription delivery back into our own status vocabulary", async () => {
		let billing = build();

		let { checkout } = await buy(billing, "pro");
		let subscription = await unwrap(billing.subscriptions.find(checkout.subscriptionId ?? ""));

		let delivery = await unwrap(
			billing.webhooks.emit({ type: "subscription.activated", subscription }),
		);

		expect(delivery.event.type).toBe("subscription.activated");
		if (delivery.event.type !== "subscription.activated") return;

		expect(delivery.event.subscription.status).toBe("active");
		expect(delivery.event.subscription.currentPeriodEnd).toBeInstanceOf(Date);
	});

	test("carries an authentic delivery it does not model through as unrecognized", async () => {
		let billing = build();

		let delivery = await unwrap(
			billing.webhooks.emit({ type: "unrecognized", providerType: "refund.created" }),
		);

		expect(await billing.webhooks.verify(delivery.request, delivery.body)).toBe(true);
		expect(delivery.event.type).toBe("unrecognized");
		if (delivery.event.type !== "unrecognized") return;

		expect(delivery.event.providerType).toBe("refund.created");
	});

	test("reports an unmappable payload rather than inventing a model", async () => {
		let billing = build();

		let body = JSON.stringify({ id: "whk_1", type: "order.paid", data: { id: "ord_1" } });
		let request = new Request("https://example.com/webhooks/billing", { method: "POST", body });

		let event = await billing.webhooks.event(request, body);

		expect(isFailure(event)).toBe(true);
		if (isFailure(event)) expect(event.error.code).toBe("invalid_request");
	});

	test("exposes its stored state for an assertion no method covers", async () => {
		let billing = build();

		await buy(billing, "pro");

		let state = billing.native as { orders: Map<string, Order> };

		expect(state.orders.size).toBe(1);
	});

	test("reports a portal session for a known customer only", async () => {
		let billing = build();

		let customer = await unwrap(
			billing.customers.create({ email: "one@example.com", externalId: "u_1" }),
		);

		let session = await unwrap(billing.portal.create({ customer: { id: customer.id } }));

		expect(session.url).toContain(customer.id);
		expect(session.expiresAt).toBeInstanceOf(Date);

		let missing = await billing.portal.create({ customer: { externalId: "u_missing" } });

		expect(isSuccess(missing)).toBe(false);
	});
});
