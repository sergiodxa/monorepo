/**
 * Covers what the Stripe provider promises: bracketed form bodies, a pinned API
 * version, models assembled from Stripe's split objects, its own delivery
 * signature, and a failure taxonomy where a 5xx stays an unknown outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { isFailure, isSuccess } from "@pkg/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Billing } from "../../core/contract";
import type { BillingError } from "../../core/errors";

import { supports } from "../../core/supports";

import type { StripeBillingOptions } from "./index";

import { StripeBilling } from "./index";

/** Origin every request in this file is intercepted at. */
const ORIGIN = "https://api.stripe.com/v1";

/** Endpoint signing secret every signed delivery in this file is proved by. */
const WEBHOOK_SECRET = "whsec_test_secret";

/** Epoch seconds every fixture reports its creation at. */
const CREATED = 1735689600;

/** Epoch seconds the fixture subscription's period ends at. */
const PERIOD_END = 1738368000;

/** Milliseconds in a second, for building a delivery timestamp. */
const MS_PER_SECOND = 1000;

/** A customer holding our own identifier in the metadata key the provider uses. */
const CUSTOMER = {
	id: "cus_1",
	object: "customer",
	email: "ada@example.com",
	name: "Ada Lovelace",
	metadata: { external_id: "u_1" },
	created: CREATED,
	currency: "usd",
	delinquent: false,
	livemode: false,
};

/** The monthly price the `pro` slug is configured with. */
const PRICE = {
	id: "price_pro",
	object: "price",
	active: true,
	currency: "usd",
	unit_amount: 4900,
	type: "recurring",
	recurring: { interval: "month", usage_type: "licensed", meter: null },
	product: "prod_pro",
	metadata: {},
	billing_scheme: "per_unit",
	lookup_key: null,
	livemode: false,
};

/** A price in a currency with no minor units, which must stay a whole integer. */
const YEN_PRICE = {
	...PRICE,
	id: "price_tokyo",
	currency: "jpy",
	unit_amount: 5000,
	product: "prod_tokyo",
};

/** The product the `pro` slug is configured with, which carries no price. */
const PRODUCT = {
	id: "prod_pro",
	object: "product",
	name: "Pro",
	description: "Everything in Pro",
	active: true,
	created: CREATED,
	metadata: {},
	livemode: false,
};

/** The product the `tokyo` slug is configured with. */
const YEN_PRODUCT = { ...PRODUCT, id: "prod_tokyo", name: "Tokyo" };

/** A feature attachment whose lookup key is already the slug an app asks about. */
const PRODUCT_FEATURE = {
	id: "prodft_1",
	object: "product_feature",
	entitlement_feature: {
		id: "feat_1",
		object: "entitlements.feature",
		lookup_key: "flow_monitors",
		name: "Flow monitors",
	},
};

/** An active subscription to the `pro` slug, with the period on its item. */
const SUBSCRIPTION = {
	id: "sub_1",
	object: "subscription",
	customer: "cus_1",
	status: "active",
	currency: "usd",
	cancel_at_period_end: false,
	canceled_at: null,
	ended_at: null,
	cancel_at: null,
	created: CREATED,
	metadata: { plan: "pro" },
	collection_method: "charge_automatically",
	latest_invoice: "in_1",
	livemode: false,
	items: {
		object: "list",
		data: [
			{
				id: "si_1",
				object: "subscription_item",
				quantity: 1,
				current_period_start: CREATED,
				current_period_end: PERIOD_END,
				price: PRICE,
			},
		],
	},
};

/** An open checkout session for the `pro` slug. */
const SESSION = {
	id: "cs_1",
	object: "checkout.session",
	url: "https://checkout.stripe.com/c/pay/cs_1",
	status: "open",
	mode: "subscription",
	payment_status: "unpaid",
	amount_total: 4900,
	currency: "usd",
	customer: "cus_1",
	client_reference_id: "u_1",
	subscription: null,
	invoice: null,
	expires_at: PERIOD_END,
	created: CREATED,
	metadata: { billing_product_slug: "pro" },
	livemode: false,
};

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Wraps a payload as a Stripe collection page. */
function page(data: unknown[], hasMore = false): object {
	return { object: "list", data, has_more: hasMore, url: "/v1/things" };
}

/** Builds a provider configured with the two slugs every test bills against. */
function create(options?: Partial<StripeBillingOptions>): StripeBilling {
	return new StripeBilling({
		secretKey: "sk_test_123",
		webhookSecret: WEBHOOK_SECRET,
		catalog: {
			pro: { product: "prod_pro", price: "price_pro" },
			tokyo: { product: "prod_tokyo", price: "price_tokyo" },
		},
		...options,
	});
}

/**
 * Signs a body the way Stripe's senders do, computed here rather than through
 * the provider so verification is checked against the published formula.
 *
 * @param body - The body as it will be delivered.
 * @param timestamp - Send time in whole seconds.
 */
async function signDelivery(body: string, timestamp: number): Promise<string> {
	let encoder = new TextEncoder();

	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(WEBHOOK_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	let mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
	let hex = Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");

	return `t=${timestamp},v1=${hex}`;
}

/** Builds a delivery request carrying a header value. */
function delivery(body: string, header?: string): Request {
	return new Request("https://example.com/webhooks/billing", {
		method: "POST",
		headers: header === undefined ? undefined : { "stripe-signature": header },
		body,
	});
}

/** Serves the three reads one catalog product is assembled from. */
function catalogHandlers(product: object, prices: unknown[], productId: string): void {
	server.use(
		http.get(`${ORIGIN}/products/${productId}/features`, () =>
			HttpResponse.json(page([PRODUCT_FEATURE])),
		),
		http.get(`${ORIGIN}/products/${productId}`, () => HttpResponse.json(product)),
		http.get(`${ORIGIN}/prices`, () => HttpResponse.json(page(prices))),
	);
}

describe("StripeBilling requests", () => {
	test("declares the connection it bills against", () => {
		let billing = create();

		expect(billing.connection).toBe("stripe");
		expect(billing.native).toBeDefined();
	});

	test("sends a nested create as bracketed form fields", async () => {
		let body = "";
		let contentType: string | null = null;

		server.use(
			http.get(`${ORIGIN}/prices/price_pro`, () => HttpResponse.json(PRICE)),
			http.post(`${ORIGIN}/checkout/sessions`, async ({ request }) => {
				contentType = request.headers.get("content-type");
				body = await request.text();
				return HttpResponse.json(SESSION);
			}),
		);

		let result = await create().checkouts.create({
			product: "pro",
			customer: { id: "cus_1" },
			returnTo: "https://example.com/thanks?ref=email",
			quantity: 2,
			metadata: { order: "o_1" },
			discount: "promo_123",
		});

		if (isFailure(result)) throw result.error;

		expect(contentType).toContain("application/x-www-form-urlencoded");

		let sent = new URLSearchParams(body);

		expect(sent.get("mode")).toBe("subscription");
		expect(sent.get("line_items[0][price]")).toBe("price_pro");
		expect(sent.get("line_items[0][quantity]")).toBe("2");
		expect(sent.get("metadata[order]")).toBe("o_1");
		expect(sent.get("metadata[billing_product_slug]")).toBe("pro");
		expect(sent.get("discounts[0][promotion_code]")).toBe("promo_123");
		expect(sent.get("customer")).toBe("cus_1");
		expect(sent.get("success_url")).toBe(
			"https://example.com/thanks?ref=email&session_id={CHECKOUT_SESSION_ID}",
		);

		expect(result.data.url).toBe(SESSION.url);
		expect(result.data.status).toBe("open");
		expect(result.data.productSlug).toBe("pro");
		expect(result.data.customerExternalId).toBe("u_1");
		expect(result.data.amount).toEqual({ amount: 4900, currency: "usd" });
	});

	test("authenticates every request and pins the API version", async () => {
		let authorization: string | null = null;
		let version: string | null = null;

		server.use(
			http.get(`${ORIGIN}/customers/cus_1`, ({ request }) => {
				authorization = request.headers.get("authorization");
				version = request.headers.get("stripe-version");
				return HttpResponse.json(CUSTOMER);
			}),
		);

		await create().customers.find({ id: "cus_1" });

		expect(authorization).toBe("Bearer sk_test_123");
		expect(version).toBe("2025-03-31.basil");
	});
});

describe("StripeBilling customers", () => {
	test("creates a customer carrying our own identifier in its metadata", async () => {
		let searched: string | null = null;
		let idempotency: string | null = null;
		let body = "";

		server.use(
			http.get(`${ORIGIN}/customers/search`, ({ request }) => {
				searched = new URL(request.url).searchParams.get("query");
				return HttpResponse.json(page([]));
			}),
			http.post(`${ORIGIN}/customers`, async ({ request }) => {
				idempotency = request.headers.get("idempotency-key");
				body = await request.text();
				return HttpResponse.json(CUSTOMER);
			}),
		);

		let result = await create().customers.create({
			email: "ada@example.com",
			externalId: "u_1",
			name: "Ada Lovelace",
		});

		if (isFailure(result)) throw result.error;

		expect(searched).toBe("metadata['external_id']:'u_1'");
		expect(idempotency).toBe("stripe:customer:u_1");
		expect(new URLSearchParams(body).get("metadata[external_id]")).toBe("u_1");

		expect(result.data.externalId).toBe("u_1");
		expect(result.data.email).toBe("ada@example.com");
		expect(result.data.createdAt).toBeInstanceOf(Date);
		expect(result.data.providerData).toMatchObject({ id: "cus_1", livemode: false });
	});

	test("refuses a second customer for one external identifier", async () => {
		server.use(http.get(`${ORIGIN}/customers/search`, () => HttpResponse.json(page([CUSTOMER]))));

		let result = await create().customers.create({ email: "grace@example.com", externalId: "u_1" });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.code).toBe("conflict");
		expect(result.error.retryable).toBe(false);
	});

	test("finds a customer by our own identifier through the search index", async () => {
		server.use(http.get(`${ORIGIN}/customers/search`, () => HttpResponse.json(page([CUSTOMER]))));

		let result = await create().customers.find({ externalId: "u_1" });

		if (isFailure(result)) throw result.error;
		expect(result.data.id).toBe("cus_1");
	});

	test("reports a customer Stripe has deleted as absent", async () => {
		server.use(
			http.get(`${ORIGIN}/customers/cus_1`, () =>
				HttpResponse.json({ id: "cus_1", object: "customer", created: CREATED, deleted: true }),
			),
		);

		let result = await create().customers.find({ id: "cus_1" });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("not_found");
	});

	test("refuses an external identifier that would break the search syntax", async () => {
		let result = await create().customers.find({ externalId: "u'1" });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("invalid_request");
	});
});

describe("StripeBilling catalog", () => {
	test("assembles a product from its Stripe product, prices, and features", async () => {
		catalogHandlers(PRODUCT, [PRICE], "prod_pro");

		let result = await create().catalog.find("pro");

		if (isFailure(result)) throw result.error;

		expect(result.data.slug).toBe("pro");
		expect(result.data.name).toBe("Pro");
		expect(result.data.archived).toBe(false);
		expect(result.data.features).toEqual({ flow_monitors: true });
		expect(result.data.prices).toHaveLength(1);
		expect(result.data.prices.at(0)).toMatchObject({
			id: "price_pro",
			kind: "recurring",
			interval: "month",
			amount: { amount: 4900, currency: "usd" },
			meter: null,
		});
	});

	test("prices a zero-decimal currency in whole minor units", async () => {
		catalogHandlers(YEN_PRODUCT, [YEN_PRICE], "prod_tokyo");

		let result = await create().catalog.find("tokyo");

		if (isFailure(result)) throw result.error;

		let amount = result.data.prices.at(0)?.amount;

		expect(amount).toEqual({ amount: 5000, currency: "jpy" });
		expect(Number.isInteger(amount?.amount)).toBe(true);
	});

	test("reports an unconfigured slug as absent", async () => {
		let result = await create().catalog.find("missing");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("not_found");
	});

	test("lists the configured catalog one page at a time", async () => {
		server.use(
			http.get(`${ORIGIN}/products/:id/features`, () => HttpResponse.json(page([]))),
			http.get(`${ORIGIN}/products/prod_pro`, () => HttpResponse.json(PRODUCT)),
			http.get(`${ORIGIN}/products/prod_tokyo`, () => HttpResponse.json(YEN_PRODUCT)),
			http.get(`${ORIGIN}/prices`, () => HttpResponse.json(page([PRICE]))),
		);

		let result = await create().catalog.list({ limit: 1 });

		if (isFailure(result)) throw result.error;

		expect(result.data.items).toHaveLength(1);
		expect(result.data.items.at(0)?.slug).toBe("pro");
		expect(result.data.cursor).toBe("pro");
	});
});

describe("StripeBilling hosted sessions", () => {
	test("reads back the session a customer returns from", async () => {
		server.use(
			http.get(`${ORIGIN}/checkout/sessions/cs_1`, () =>
				HttpResponse.json({ ...SESSION, status: "complete", url: null, subscription: "sub_1" }),
			),
		);

		let result = await create().checkouts.finish("cs_1");

		if (isFailure(result)) throw result.error;

		expect(result.data.status).toBe("completed");
		expect(result.data.productSlug).toBe("pro");
		expect(result.data.subscriptionId).toBe("sub_1");
		expect(result.data.url).toBeNull();
	});

	test("opens a portal session for a customer", async () => {
		let body = "";

		server.use(
			http.post(`${ORIGIN}/billing_portal/sessions`, async ({ request }) => {
				body = await request.text();
				return HttpResponse.json({
					id: "bps_1",
					object: "billing_portal.session",
					url: "https://billing.stripe.com/p/session/bps_1",
					created: CREATED,
					customer: "cus_1",
					return_url: "https://example.com/account",
					configuration: "bpc_1",
					livemode: false,
				});
			}),
		);

		let result = await create({ portalConfiguration: "bpc_1" }).portal.create({
			customer: { id: "cus_1" },
			returnTo: "https://example.com/account",
		});

		if (isFailure(result)) throw result.error;

		let sent = new URLSearchParams(body);

		expect(sent.get("customer")).toBe("cus_1");
		expect(sent.get("return_url")).toBe("https://example.com/account");
		expect(sent.get("configuration")).toBe("bpc_1");

		expect(new URL(result.data.url).protocol).toBe("https:");
		expect(result.data.expiresAt).toBeNull();
	});
});

describe("StripeBilling subscriptions", () => {
	test("maps a subscription's period and price from the item that carries them", async () => {
		server.use(http.get(`${ORIGIN}/subscriptions/sub_1`, () => HttpResponse.json(SUBSCRIPTION)));

		let result = await create().subscriptions.find("sub_1");

		if (isFailure(result)) throw result.error;

		expect(result.data).toMatchObject({
			id: "sub_1",
			customerId: "cus_1",
			productSlug: "pro",
			priceId: "price_pro",
			status: "active",
			providerStatus: "active",
			interval: "month",
			cancelAtPeriodEnd: false,
		});

		expect(result.data.amount).toEqual({ amount: 4900, currency: "usd" });
		expect(result.data.currentPeriodEnd?.getTime()).toBe(PERIOD_END * MS_PER_SECOND);
		expect(result.data.endsAt).toBeNull();
	});

	test("narrows a status several Stripe statuses share after the read", async () => {
		let requestedStatus: string | null = null;

		server.use(
			http.get(`${ORIGIN}/subscriptions`, ({ request }) => {
				requestedStatus = new URL(request.url).searchParams.get("status");
				return HttpResponse.json(
					page([SUBSCRIPTION, { ...SUBSCRIPTION, id: "sub_2", status: "unpaid" }], true),
				);
			}),
		);

		let result = await create().subscriptions.list({ status: ["revoked"], limit: 2 });

		if (isFailure(result)) throw result.error;

		expect(requestedStatus).toBe("all");
		expect(result.data.items).toHaveLength(1);
		expect(result.data.items.at(0)).toMatchObject({ id: "sub_2", status: "revoked" });
		expect(result.data.cursor).toBe("sub_2");
	});

	test("refuses a subscription billing a price outside the configured catalog", async () => {
		server.use(
			http.get(`${ORIGIN}/subscriptions/sub_9`, () =>
				HttpResponse.json({
					...SUBSCRIPTION,
					id: "sub_9",
					items: {
						object: "list",
						data: [
							{
								id: "si_9",
								object: "subscription_item",
								quantity: 1,
								price: { ...PRICE, id: "price_other", product: "prod_other" },
							},
						],
					},
				}),
			),
		);

		let result = await create().subscriptions.find("sub_9");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("invalid_request");
	});
});

describe("StripeBilling entitlements", () => {
	test("composes the snapshot from subscriptions and active entitlements", async () => {
		server.use(
			http.get(`${ORIGIN}/customers/cus_1`, () => HttpResponse.json(CUSTOMER)),
			http.get(`${ORIGIN}/subscriptions`, () =>
				HttpResponse.json(
					page([
						SUBSCRIPTION,
						{ ...SUBSCRIPTION, id: "sub_2", status: "canceled" },
						{
							...SUBSCRIPTION,
							id: "sub_3",
							items: {
								object: "list",
								data: [
									{
										id: "si_3",
										object: "subscription_item",
										quantity: 1,
										price: { ...PRICE, id: "price_other", product: "prod_other" },
									},
								],
							},
						},
					]),
				),
			),
			http.get(`${ORIGIN}/entitlements/active_entitlements`, () =>
				HttpResponse.json(
					page([
						{
							id: "ent_1",
							object: "entitlements.active_entitlement",
							lookup_key: "flow_monitors",
							feature: "feat_1",
						},
					]),
				),
			),
		);

		let result = await create().entitlements.of({ id: "cus_1" });

		if (isFailure(result)) throw result.error;

		expect(result.data.customerId).toBe("cus_1");
		expect(result.data.externalId).toBe("u_1");
		expect(result.data.products).toEqual(["pro"]);
		expect(result.data.features).toEqual({ flow_monitors: true });
		expect(result.data.meters).toEqual([]);
		expect(result.data.subscriptions).toEqual([
			{
				subscriptionId: "sub_1",
				productSlug: "pro",
				status: "active",
				currentPeriodEnd: new Date(PERIOD_END * MS_PER_SECOND),
				cancelAtPeriodEnd: false,
			},
		]);
		expect(result.data.readAt).toBeInstanceOf(Date);
	});
});

describe("StripeBilling failures", () => {
	test("maps a missing object to not_found and a 5xx to an unknown outcome", async () => {
		server.use(
			http.get(`${ORIGIN}/customers/cus_missing`, () =>
				HttpResponse.json(
					{
						error: {
							type: "invalid_request_error",
							code: "resource_missing",
							message: "No such customer",
						},
					},
					{ status: 404 },
				),
			),
			http.get(`${ORIGIN}/customers/cus_broken`, () =>
				HttpResponse.json(
					{ error: { type: "api_error", message: "Stripe is down" } },
					{ status: 503 },
				),
			),
		);

		let billing = create();

		let missing = await billing.customers.find({ id: "cus_missing" });
		let broken = await billing.customers.find({ id: "cus_broken" });

		expect(isFailure(missing)).toBe(true);
		if (isFailure(missing)) {
			expect(missing.error.code).toBe("not_found");
			expect(missing.error.providerCode).toBe("resource_missing");
			expect(missing.error.connection).toBe("stripe");
		}

		expect(isFailure(broken)).toBe(true);
		if (isFailure(broken)) {
			expect(broken.error.code).toBe("unknown");
			expect(broken.error.retryable).toBe(false);
			expect(broken.error.providerCode).toBe("api_error");
		}
	});

	test("reads a missing reference reported as a 400 as not_found", async () => {
		server.use(
			http.post(`${ORIGIN}/billing_portal/sessions`, () =>
				HttpResponse.json(
					{ error: { type: "invalid_request_error", code: "resource_missing", param: "customer" } },
					{ status: 400 },
				),
			),
		);

		let result = await create().portal.create({ customer: { id: "cus_missing" } });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("not_found");
	});

	test("maps a throttled request to a retryable rate_limited failure", async () => {
		server.use(
			http.get(`${ORIGIN}/customers/cus_1`, () =>
				HttpResponse.json(
					{ error: { type: "rate_limit_error", code: "rate_limit" } },
					{ status: 429 },
				),
			),
		);

		let result = await create().customers.find({ id: "cus_1" });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.code).toBe("rate_limited");
		expect(result.error.retryable).toBe(true);
	});

	test("reports an answer in a shape it cannot read as invalid_response", async () => {
		server.use(http.get(`${ORIGIN}/customers/cus_1`, () => HttpResponse.json({ id: 7 })));

		let result = await create().customers.find({ id: "cus_1" });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("invalid_response");
		expect(result.error.retryable).toBe(false);
	});

	test("omits the optional groups it does not answer instead of stubbing them", () => {
		let billing: Billing = create();

		expect(billing.discounts).toBeUndefined();
		expect(billing.usage).toBeUndefined();
		expect(billing.meters).toBeUndefined();
		expect(supports(billing, "portal")).toBe(true);
	});

	test("reports a required group it does not answer as not_implemented", async () => {
		let billing: Billing = create();

		let unimplemented: Result<unknown, BillingError>[] = [
			await billing.orders.find("in_1"),
			await billing.orders.list(),
			await billing.customers.list(),
		];

		for (let result of unimplemented) {
			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) continue;
			expect(result.error.code).toBe("not_implemented");
		}
	});
});

describe("StripeBilling webhooks", () => {
	test("proves a delivery Stripe signed, and refuses a tampered body", async () => {
		let billing = create();
		let body = JSON.stringify({
			id: "evt_1",
			type: "customer.created",
			data: { object: CUSTOMER },
		});
		let timestamp = Math.floor(Date.now() / MS_PER_SECOND);
		let header = await signDelivery(body, timestamp);

		expect(await billing.webhooks.verify(delivery(body, header), body)).toBe(true);
		expect(await billing.webhooks.verify(delivery(body, header), `${body} `)).toBe(false);
	});

	test("fails a delivery closed when its header, secret, or timestamp fails", async () => {
		let body = JSON.stringify({
			id: "evt_1",
			type: "customer.created",
			data: { object: CUSTOMER },
		});
		let timestamp = Math.floor(Date.now() / MS_PER_SECOND);
		let header = await signDelivery(body, timestamp);
		let stale = await signDelivery(body, timestamp - 3600);

		let billing = create();

		expect(await billing.webhooks.verify(delivery(body), body)).toBe(false);
		expect(await billing.webhooks.verify(delivery(body, "t=1,v1=nope"), body)).toBe(false);
		expect(await billing.webhooks.verify(delivery(body, stale), body)).toBe(false);
		expect(
			await create({ webhookSecret: undefined }).webhooks.verify(delivery(body, header), body),
		).toBe(false);
	});

	test("names a delivery for deduplication and the object it changed, and reports an unreadable one", async () => {
		let billing = create();
		let body = JSON.stringify({
			id: "evt_1",
			type: "invoice.paid",
			data: { object: { id: "in_1" } },
		});

		expect(billing.webhooks.reference(delivery(body), body)).toEqual({
			deliveryId: "evt_1",
			object: { id: "in_1", type: "invoice.paid" },
		});

		expect(billing.webhooks.reference(delivery("not-json"), "not-json")).toBeNull();

		let unreadable = await billing.webhooks.event(delivery("not-json"), "not-json");

		expect(isFailure(unreadable)).toBe(true);
		if (!isFailure(unreadable)) return;
		expect(unreadable.error.code).toBe("invalid_request");
	});

	test("reports an unmodelled delivery as unrecognized rather than failing it", async () => {
		let billing = create();

		for (let type of ["invoice.paid", "charge.refunded", "radar.early_fraud_warning.created"]) {
			let body = JSON.stringify({ id: "evt_2", type, data: { object: { id: "obj_1" } } });
			let result = await billing.webhooks.event(delivery(body), body);

			if (isFailure(result)) throw result.error;

			expect(result.data.type).toBe("unrecognized");
			expect(result.data.id).toBe("evt_2");
			expect(result.data.raw).toMatchObject({ type });
		}
	});

	test("normalizes the customer, checkout, and subscription deliveries it models", async () => {
		let billing = create();

		let customerBody = JSON.stringify({
			id: "evt_3",
			type: "customer.updated",
			data: { object: CUSTOMER },
		});

		let checkoutBody = JSON.stringify({
			id: "evt_4",
			type: "checkout.session.completed",
			data: { object: { ...SESSION, status: "complete" } },
		});

		let subscriptionBody = JSON.stringify({
			id: "evt_5",
			type: "customer.subscription.paused",
			data: { object: { ...SUBSCRIPTION, status: "paused" } },
		});

		let customer = await billing.webhooks.event(delivery(customerBody), customerBody);
		let checkout = await billing.webhooks.event(delivery(checkoutBody), checkoutBody);
		let subscription = await billing.webhooks.event(delivery(subscriptionBody), subscriptionBody);

		if (!isSuccess(customer) || !isSuccess(checkout) || !isSuccess(subscription)) {
			throw new Error("every modelled delivery normalizes");
		}

		expect(customer.data).toMatchObject({ type: "customer.updated" });
		expect(checkout.data).toMatchObject({ type: "checkout.completed" });
		expect(subscription.data).toMatchObject({ type: "subscription.revoked" });

		if (subscription.data.type !== "subscription.revoked") return;
		expect(subscription.data.subscription.productSlug).toBe("pro");
		expect(subscription.data.subscription.providerStatus).toBe("paused");
	});

	test("reports a modelled delivery whose payload it cannot read as unrecognized", async () => {
		let body = JSON.stringify({
			id: "evt_6",
			type: "customer.subscription.updated",
			data: { object: {} },
		});

		let result = await create().webhooks.event(delivery(body), body);

		if (isFailure(result)) throw result.error;

		expect(result.data.type).toBe("unrecognized");
	});
});
