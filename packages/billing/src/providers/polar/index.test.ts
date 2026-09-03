/**
 * Tests for the Polar provider, driven through MSW so the assertions are about
 * the requests it sends and the payloads it maps. They cover the headers every
 * call carries, both list envelopes, every failure body, and webhook handling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import { sign } from "@sdxc/webhooks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import type { BillingErrorCode } from "../../core/errors.js";
import type { Secret } from "../../core/secret.js";

import { BillingError } from "../../core/errors.js";

import { PolarBilling } from "./index.js";

/** Polar product id the tests configure the `pro` slug with. */
const PRODUCT_ID = "019product";

/** Polar meter id the tests configure the `pings` slug with. */
const METER_ID = "019meter";

/** Polar benefit id the tests configure the `flow_monitors` feature with. */
const BENEFIT_ID = "019benefit";

/** Signing secret as Polar issues one, whose UTF-8 bytes are the HMAC key. */
const WEBHOOK_SECRET = "whsec_pol4r-t3xt-secret";

/** Access token the tests expect on the wire. */
const ACCESS_TOKEN = "polar_oat_test";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Builds a provider configured the way an app configures one. */
function polar(options: { accessToken?: Secret; webhookSecret?: Secret } = {}) {
	return new PolarBilling({
		accessToken: options.accessToken ?? ACCESS_TOKEN,
		webhookSecret: options.webhookSecret ?? WEBHOOK_SECRET,
		products: { pro: PRODUCT_ID },
		meters: { pings: METER_ID },
		features: { flow_monitors: BENEFIT_ID },
		connection: "polar_test",
	});
}

/** Answers every Polar path with one payload, recording the requests it received. */
function stub(payload: Record<string, unknown>, init?: { status?: number }): Request[] {
	let received: Request[] = [];

	server.use(
		http.all("https://api.polar.sh/*", ({ request }) => {
			received.push(request.clone());

			return HttpResponse.json(payload, { status: init?.status ?? 200 });
		}),
	);

	return received;
}

/** Reads the failure a call reported, asserting the code a caller branches on. */
function expectFailure(
	result: Result<unknown, BillingError>,
	code: BillingErrorCode,
): BillingError {
	expect(result.status).toBe("failure");
	if (!isFailure(result)) throw new Error("expected a failure");

	expect(result.error).toBeInstanceOf(BillingError);
	expect(result.error.code).toBe(code);
	expect(result.error.connection).toBe("polar_test");

	return result.error;
}

/** A customer as Polar answers with one. */
function polarCustomer(overrides: Record<string, unknown> = {}) {
	return {
		id: "019customer",
		created_at: "2026-09-02T17:30:25Z",
		modified_at: null,
		type: "individual",
		email: "jane@example.com",
		email_verified: true,
		name: "Jane Doe",
		external_id: "subject_1",
		metadata: { tenant_id: "t_123", seats: 3 },
		organization_id: "019org",
		avatar_url: "https://example.com/a.png",
		deleted_at: null,
		...overrides,
	};
}

/** A subscription as Polar answers with one. */
function polarSubscription(overrides: Record<string, unknown> = {}) {
	return {
		id: "019subscription",
		created_at: "2026-09-02T17:30:25Z",
		modified_at: null,
		customer_id: "019customer",
		product_id: PRODUCT_ID,
		status: "active",
		amount: 4900,
		currency: "usd",
		recurring_interval: "month",
		recurring_interval_count: 1,
		current_period_start: "2026-09-01T00:00:00Z",
		current_period_end: "2026-10-01T00:00:00Z",
		cancel_at_period_end: false,
		canceled_at: null,
		ends_at: null,
		metadata: {},
		prices: [{ id: "019price" }],
		...overrides,
	};
}

/** A checkout as Polar answers with one, secret included. */
function polarCheckout(overrides: Record<string, unknown> = {}) {
	return {
		id: "019checkout",
		created_at: "2026-09-02T17:30:25Z",
		url: "https://polar.sh/checkout/019checkout",
		client_secret: "polar_cs_secret",
		customer_ip_address: "203.0.113.4",
		status: "open",
		expires_at: "2026-09-02T18:30:25Z",
		product_id: PRODUCT_ID,
		customer_id: "019customer",
		external_customer_id: "subject_1",
		currency: "usd",
		total_amount: 4900,
		discount_id: null,
		subscription_id: null,
		...overrides,
	};
}

/** A discount as Polar answers with one, scoped to the configured product. */
function polarDiscount(overrides: Record<string, unknown> = {}) {
	return {
		id: "019discount",
		created_at: "2026-09-02T17:30:25Z",
		name: "Launch week",
		code: "LAUNCH",
		type: "fixed",
		amount: 3000,
		currency: "usd",
		basis_points: null,
		max_redemptions: null,
		redemptions_count: 4,
		starts_at: null,
		ends_at: null,
		products: [{ id: PRODUCT_ID }],
		...overrides,
	};
}

/** An order as Polar answers with one, paid for the configured product. */
function polarOrder(overrides: Record<string, unknown> = {}) {
	return {
		id: "019order",
		created_at: "2026-09-02T17:30:25Z",
		customer_id: "019customer",
		customer: { id: "019customer", email: "jane@example.com", external_id: "subject_1" },
		product_id: PRODUCT_ID,
		subscription_id: null,
		discount_id: null,
		paid: true,
		currency: "usd",
		subtotal_amount: 4900,
		total_amount: 4900,
		...overrides,
	};
}

/** The offset envelope almost every Polar list answers with. */
function offsetPage(items: unknown[], pagination: { total_count: number; max_page: number }) {
	return { items, pagination };
}

/** Signs a delivery the way Polar's senders do, base64 over the secret's UTF-8 bytes. */
async function delivery(payload: unknown, secret = WEBHOOK_SECRET) {
	let binary = "";
	for (let byte of new TextEncoder().encode(secret)) binary += String.fromCharCode(byte);

	let signed = await unwrap(
		sign(payload, { secret: btoa(binary), id: "msg_1", timestamp: new Date() }),
	);

	return {
		body: signed.body,
		request: new Request("https://app.example.com/webhooks/billing", {
			method: "POST",
			headers: new Headers(signed.headers),
			body: signed.body,
		}),
	};
}

/** Builds the inbound request one delivery body arrives on, signing header aside. */
function inbound(rawBody: string, deliveryId?: string): Request {
	let headers = new Headers({ "content-type": "application/json" });
	if (deliveryId !== undefined) headers.set("webhook-id", deliveryId);

	return new Request("https://app.example.com/webhooks/billing", {
		method: "POST",
		headers,
		body: rawBody,
	});
}

describe("PolarBilling", () => {
	test("authenticates every call and pins the API version", async () => {
		let received = stub(polarCustomer());

		await unwrap(polar().customers.find({ id: "019customer" }));

		let request = received.at(0);

		expect(request?.headers.get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
		expect(request?.headers.get("polar-version")).toBe("2026-04");
		expect(request?.headers.get("accept")).toBe("application/json");
		expect(new URL(request?.url ?? "").pathname).toBe("/v1/customers/019customer");
	});

	test("resolves an awaited token once and asks again after it fails", async () => {
		stub(polarCustomer());

		let attempts = 0;
		let billing = polar({
			accessToken: async () => {
				attempts += 1;
				if (attempts === 1) throw new Error("secret store unavailable");
				return await Promise.resolve(ACCESS_TOKEN);
			},
		});

		expectFailure(await billing.customers.find({ id: "019customer" }), "unauthenticated");

		await unwrap(billing.customers.find({ id: "019customer" }));
		await unwrap(billing.customers.find({ id: "019customer" }));

		expect(attempts).toBe(2);
	});

	test("reads a customer by our own identifier", async () => {
		let received = stub(polarCustomer());

		let customer = await unwrap(polar().customers.find({ externalId: "subject_1" }));

		expect(new URL(received.at(0)?.url ?? "").pathname).toBe("/v1/customers/external/subject_1");
		expect(customer).toMatchObject({
			id: "019customer",
			externalId: "subject_1",
			email: "jane@example.com",
			metadata: { tenant_id: "t_123", seats: "3" },
		});
		expect(customer.createdAt).toBeInstanceOf(Date);
		expect(customer.providerData.organization_id).toBe("019org");
	});

	test("names a team customer with no address of its own", async () => {
		stub(polarCustomer({ type: "team", email: null }));

		let customer = await unwrap(polar().customers.find({ id: "019customer" }));

		expect(customer.email).toBeNull();
	});

	test("pages an offset envelope, and stops on the last page", async () => {
		let received = stub(offsetPage([polarCustomer()], { total_count: 3, max_page: 2 }));

		let first = await unwrap(polar().customers.list({ limit: 1 }));

		expect(first.items).toHaveLength(1);
		expect(first.cursor).toBe("2");

		stub(offsetPage([polarCustomer()], { total_count: 3, max_page: 2 }));

		let second = await unwrap(polar().customers.list({ limit: 1, cursor: "2" }));

		expect(second.cursor).toBeNull();
		expect(new URL(received.at(0)?.url ?? "").searchParams.get("limit")).toBe("1");
	});

	test("pages a cursor envelope the same way", async () => {
		stub({
			items: [
				{
					id: "019event",
					name: "pings",
					timestamp: "2026-09-02T17:30:25Z",
					external_customer_id: "subject_1",
					external_id: "use_1",
					metadata: { region: "eu", _cost: { amount: "0.003476700", currency: "usd" } },
				},
			],
			pagination: { has_next_page: true },
		});

		let page = await unwrap(polar().usage.list({ name: "pings" }));

		expect(page.cursor).toBe("2");
		expect(page.items.at(0)).toMatchObject({
			name: "pings",
			externalId: "use_1",
			metadata: { region: "eu" },
			cost: { amount: "0.003476700", currency: "usd" },
		});
	});

	test("reports a domain failure with Polar's own code", async () => {
		stub({ error: "ResourceNotFound", detail: "Not found" }, { status: 404 });

		let error = expectFailure(await polar().subscriptions.find("019missing"), "not_found");

		expect(error.providerCode).toBe("ResourceNotFound");
		expect(error.message).toBe("Not found");
		expect(error.retryable).toBe(false);
	});

	test("reports a validation failure, which spells its message differently", async () => {
		stub(
			{
				detail: [
					{
						loc: ["body", "email"],
						msg: "value is not a valid email address",
						type: "value_error",
					},
				],
			},
			{ status: 422 },
		);

		let error = expectFailure(
			await polar().customers.update({ id: "019customer" }, { email: "nope" }),
			"invalid_request",
		);

		expect(error.providerCode).toBeNull();
		expect(error.message).toBe("value is not a valid email address");
	});

	test("reports a URL matching no route, whose body carries no code", async () => {
		stub({ detail: "Not Found" }, { status: 404 });

		let error = expectFailure(await polar().orders.find("019missing"), "not_found");

		expect(error.providerCode).toBeNull();
		expect(error.message).toBe("Not Found");
	});

	test("reports a taken join key as a conflict", async () => {
		stub(
			{ detail: [{ loc: ["body", "external_id"], msg: "already exists", type: "value_error" }] },
			{ status: 422 },
		);

		expectFailure(
			await polar().customers.create({ email: "jane@example.com", externalId: "subject_1" }),
			"conflict",
		);
	});

	test("reports a server failure as an outcome nobody knows", async () => {
		stub({ detail: "Internal Server Error" }, { status: 503 });

		let error = expectFailure(await polar().customers.find({ id: "019customer" }), "unknown");

		expect(error.retryable).toBe(false);
	});

	test("reports a rate limit as retryable", async () => {
		stub({ detail: "Too Many Requests" }, { status: 429 });

		let error = expectFailure(await polar().customers.find({ id: "019customer" }), "rate_limited");

		expect(error.retryable).toBe(true);
	});

	test("reports an answer that never arrived as an unknown outcome", async () => {
		server.use(http.all("https://api.polar.sh/*", () => HttpResponse.error()));

		let error = expectFailure(await polar().customers.find({ id: "019customer" }), "unknown");

		expect(error.retryable).toBe(false);
	});

	test("addresses the catalog by our own slug", async () => {
		let received = stub({
			id: PRODUCT_ID,
			created_at: "2026-09-02T17:30:25Z",
			name: "Pro",
			description: "Everything",
			is_archived: false,
			is_recurring: true,
			recurring_interval: "month",
			prices: [
				{ id: "019price", amount_type: "fixed", price_amount: 4900, price_currency: "usd" },
				{ id: "019metered", amount_type: "metered_unit", unit_amount: "0.01", meter_id: METER_ID },
			],
			benefits: [{ id: BENEFIT_ID }, { id: "019other" }],
		});

		let product = await unwrap(polar().catalog.find("pro"));

		expect(new URL(received.at(0)?.url ?? "").pathname).toBe(`/v1/products/${PRODUCT_ID}`);
		expect(product.slug).toBe("pro");
		expect(product.features).toEqual({ flow_monitors: true });
		expect(product.prices.at(0)).toMatchObject({
			kind: "recurring",
			interval: "month",
			amount: { amount: 4900, currency: "usd" },
		});
		expect(product.prices.at(1)).toMatchObject({ kind: "metered", meter: "pings", amount: null });
	});

	test("answers a slug it was never configured with without asking Polar", async () => {
		let received = stub({});

		expectFailure(await polar().catalog.find("enterprise"), "not_found");

		expect(received).toHaveLength(0);
	});

	test("opens a checkout for a product id the caller never names", async () => {
		let received = stub(polarCheckout(), { status: 201 });

		let checkout = await unwrap(
			polar().checkouts.create({
				product: "pro",
				customer: { externalId: "subject_1" },
				returnTo: "https://app.example.com/thanks",
			}),
		);

		let sent = (await received.at(0)?.json()) as Record<string, unknown>;

		expect(sent).toMatchObject({
			products: [PRODUCT_ID],
			external_customer_id: "subject_1",
			success_url: "https://app.example.com/thanks",
		});
		expect(checkout).toMatchObject({ status: "open", productSlug: "pro" });
		expect(checkout.amount).toEqual({ amount: 4900, currency: "usd" });
	});

	test("opens a checkout whose page collects no typed code", async () => {
		let received = stub(polarCheckout(), { status: 201 });

		await unwrap(
			polar().checkouts.create({
				product: "pro",
				discount: "019discount",
				allowDiscountCodes: false,
				idempotencyKey: "attempt_1",
			}),
		);

		expect((await received.at(0)?.json()) as unknown).toMatchObject({
			discount_id: "019discount",
			allow_discount_codes: false,
			metadata: { idempotency_key: "attempt_1" },
		});
	});

	test("keeps what authorizes a checkout out of the stored payload", async () => {
		stub(polarCheckout());

		let checkout = await unwrap(polar().checkouts.find("019checkout"));

		expect(checkout.providerData).not.toHaveProperty("client_secret");
		expect(checkout.providerData).not.toHaveProperty("customer_ip_address");
		expect(checkout.providerData.payment_processor ?? null).toBeNull();
	});

	test("opens the hosted portal from our own identifier", async () => {
		let received = stub(
			{
				customer_portal_url: "https://polar.sh/portal/019session",
				expires_at: "2026-09-02T18:30:25Z",
				token: "polar_cst_secret",
			},
			{ status: 201 },
		);

		let session = await unwrap(polar().portal.create({ customer: { externalId: "subject_1" } }));

		expect((await received.at(0)?.json()) as unknown).toMatchObject({
			external_customer_id: "subject_1",
		});
		expect(session.url).toBe("https://polar.sh/portal/019session");
		expect(session.providerData).not.toHaveProperty("token");
	});

	test("maps every state Polar keeps a subscription in", async () => {
		stub(polarSubscription({ status: "unpaid" }));

		let subscription = await unwrap(polar().subscriptions.find("019subscription"));

		expect(subscription.status).toBe("revoked");
		expect(subscription.providerStatus).toBe("unpaid");
		expect(subscription.productSlug).toBe("pro");
		expect(subscription.amount).toEqual({ amount: 4900, currency: "usd" });
	});

	test("reports a state it has no mapping for", async () => {
		stub(polarSubscription({ status: "on_hold" }));

		expectFailure(await polar().subscriptions.find("019subscription"), "invalid_response");
	});

	test("keeps a subscription list a product configured elsewhere appears in", async () => {
		let warned = vi.spyOn(console, "warn").mockImplementation(() => {});

		stub(
			offsetPage(
				[
					polarSubscription({ id: "019elsewhere", product_id: "019unconfigured" }),
					polarSubscription(),
				],
				{ total_count: 2, max_page: 1 },
			),
		);

		let page = await unwrap(polar().subscriptions.list());

		expect(page.items.map((subscription) => subscription.id)).toEqual(["019subscription"]);
		expect(warned.mock.calls.at(0)?.at(0)).toContain("019unconfigured");

		warned.mockRestore();
	});

	test("reports a subscription read by id that names a product outside the catalog", async () => {
		stub(polarSubscription({ product_id: "019unconfigured" }));

		let error = expectFailure(
			await polar().subscriptions.find("019subscription"),
			"invalid_response",
		);

		expect(error.message).toContain("019unconfigured");
	});

	test("answers what a customer holds right now in one call", async () => {
		let received = stub({
			...polarCustomer(),
			active_subscriptions: [
				{
					id: "019subscription",
					product_id: PRODUCT_ID,
					status: "trialing",
					current_period_start: "2026-09-01T00:00:00Z",
					current_period_end: "2026-10-01T00:00:00Z",
					cancel_at_period_end: true,
				},
			],
			granted_benefits: [{ benefit_id: BENEFIT_ID }, { benefit_id: "019unconfigured" }],
			active_meters: [
				{ meter_id: METER_ID, consumed_units: 25, credited_units: 100, balance: 75 },
				{ meter_id: "019unconfigured", consumed_units: 1, credited_units: 2, balance: 1 },
			],
		});

		let state = await unwrap(polar().entitlements.of({ externalId: "subject_1" }));

		expect(received).toHaveLength(1);
		expect(new URL(received.at(0)?.url ?? "").pathname).toBe(
			"/v1/customers/external/subject_1/state",
		);
		expect(state.customerId).toBe("019customer");
		expect(state.products).toEqual(["pro"]);
		expect(state.features).toEqual({ flow_monitors: true });
		expect(state.meters).toEqual([{ meter: "pings", credited: 100, consumed: 25, balance: 75 }]);
		expect(state.subscriptions).toEqual([
			{
				subscriptionId: "019subscription",
				productSlug: "pro",
				status: "trialing",
				currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
				currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
				cancelAtPeriodEnd: true,
			},
		]);
		expect(state.readAt).toBeInstanceOf(Date);
	});

	test("skips a snapshot row naming a product this connection has no slug for", async () => {
		let warned = vi.spyOn(console, "warn").mockImplementation(() => {});

		stub({
			...polarCustomer(),
			active_subscriptions: [
				{ id: "019elsewhere", product_id: "019unconfigured", status: "active" },
				{
					id: "019subscription",
					product_id: PRODUCT_ID,
					status: "active",
					current_period_start: "2026-09-01T00:00:00Z",
					current_period_end: "2026-10-01T00:00:00Z",
				},
			],
			granted_benefits: [],
			active_meters: [],
		});

		let state = await unwrap(polar().entitlements.of({ externalId: "subject_1" }));

		expect(state.products).toEqual(["pro"]);
		expect(state.subscriptions).toEqual([
			{
				subscriptionId: "019subscription",
				productSlug: "pro",
				status: "active",
				currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
				currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
				cancelAtPeriodEnd: false,
			},
		]);
		expect(warned.mock.calls.at(0)?.at(0)).toContain("019elsewhere");

		warned.mockRestore();
	});

	test("keeps a discount list a campaign configured elsewhere appears in", async () => {
		let warned = vi.spyOn(console, "warn").mockImplementation(() => {});

		stub(
			offsetPage(
				[
					polarDiscount({ id: "019elsewhere", products: [{ id: "019unconfigured" }] }),
					polarDiscount(),
				],
				{ total_count: 2, max_page: 1 },
			),
		);

		let page = await unwrap(polar().discounts.list());

		expect(page.items.map((discount) => discount.id)).toEqual(["019discount"]);
		expect(warned.mock.calls.at(0)?.at(0)).toContain("019elsewhere");

		warned.mockRestore();
	});

	test("scopes a discount to the products it names that this connection sells", async () => {
		let warned = vi.spyOn(console, "warn").mockImplementation(() => {});

		stub(polarDiscount({ products: [{ id: PRODUCT_ID }, { id: "019unconfigured" }] }));

		let discount = await unwrap(polar().discounts.find("019discount"));

		expect(discount.productSlugs).toEqual(["pro"]);
		expect(warned).toHaveBeenCalled();

		warned.mockRestore();
	});

	test("reports a discount read by id that applies to nothing this connection sells", async () => {
		stub(polarDiscount({ products: [{ id: "019unconfigured" }] }));

		let error = expectFailure(await polar().discounts.find("019discount"), "invalid_response");

		expect(error.message).toContain("019unconfigured");
	});

	test("counts consumption in batches the platform can take", async () => {
		let batches: { events: Record<string, unknown>[] }[] = [];

		server.use(
			http.post("https://api.polar.sh/v1/events/ingest", async ({ request }) => {
				let body = (await request.json()) as { events: Record<string, unknown>[] };
				batches.push(body);

				return HttpResponse.json({ inserted: body.events.length, duplicates: 0 });
			}),
		);

		let events = Array.from({ length: 250 }, (_, index) => ({
			name: "pings",
			customer: { externalId: "subject_1" },
			externalId: `use_${index}`,
		}));

		let ingested = await unwrap(polar().usage.ingest(events));

		expect(ingested.accepted).toBe(250);
		expect(batches).toHaveLength(3);
		expect(batches.at(0)?.events).toHaveLength(100);
		expect(batches.at(2)?.events).toHaveLength(50);
		expect(batches.at(0)?.events.at(0)).toEqual({
			name: "pings",
			external_customer_id: "subject_1",
			external_id: "use_0",
			metadata: {},
		});
	});

	test("names the buyer an order was paid by without a second read", async () => {
		let received = stub(polarOrder());

		let order = await unwrap(polar().orders.find("019order"));

		expect(received).toHaveLength(1);
		expect(order.customerId).toBe("019customer");
		expect(order.customerEmail).toBe("jane@example.com");
		expect(order.customerExternalId).toBe("subject_1");
	});

	test("keeps an order list a product configured elsewhere appears in", async () => {
		let warned = vi.spyOn(console, "warn").mockImplementation(() => {});

		stub(
			offsetPage(
				[polarOrder({ id: "019elsewhere", product_id: "019unconfigured" }), polarOrder()],
				{
					total_count: 2,
					max_page: 1,
				},
			),
		);

		let page = await unwrap(polar().orders.list());

		expect(page.items.map((order) => order.id)).toEqual(["019order"]);
		expect(warned.mock.calls.at(0)?.at(0)).toContain("019unconfigured");

		warned.mockRestore();
	});

	test("reports an order read by id that names a product outside the catalog", async () => {
		stub(polarOrder({ product_id: "019unconfigured" }));

		let error = expectFailure(await polar().orders.find("019order"), "invalid_response");

		expect(error.message).toContain("019unconfigured");
	});

	test("adopts a platform customer that carries none of our own ids", async () => {
		let received = stub(polarCustomer());

		await unwrap(polar().customers.update({ id: "019customer" }, { externalId: "subject_1" }));

		expect(received.at(0)?.method).toBe("PATCH");
		expect((await received.at(0)?.json()) as unknown).toMatchObject({
			external_id: "subject_1",
		});
	});

	test("bills without a signing secret and fails every delivery closed", async () => {
		let billing = new PolarBilling({ accessToken: ACCESS_TOKEN, connection: "polar_test" });
		let signed = await delivery(polarCustomer());

		expect(await billing.webhooks.verify(signed.request, signed.body)).toBe(false);
		expectFailure(await billing.catalog.find("pro"), "not_found");
	});

	test("reads a meter after resolving who it is being read for", async () => {
		let received: Request[] = [];

		server.use(
			http.get("https://api.polar.sh/v1/customers/external/:id", ({ request }) => {
				received.push(request);
				return HttpResponse.json(polarCustomer());
			}),
			http.get("https://api.polar.sh/v1/meters/:id/quantities", ({ request }) => {
				received.push(request);
				return HttpResponse.json({
					total: 170.5,
					quantities: [{ timestamp: "2026-09-01T00:00:00Z", quantity: 170.5 }],
				});
			}),
		);

		let reading = await unwrap(
			polar().meters.quantities({
				meter: "pings",
				customer: { externalId: "subject_1" },
				from: new Date("2026-09-01T00:00:00Z"),
				to: new Date("2026-09-30T00:00:00Z"),
				interval: "day",
			}),
		);

		expect(reading).toMatchObject({ meter: "pings", customerId: "019customer", quantity: 170.5 });

		let url = new URL(received.at(1)?.url ?? "");

		expect(url.pathname).toBe(`/v1/meters/${METER_ID}/quantities`);
		expect(url.searchParams.get("interval")).toBe("day");
		expect(url.searchParams.get("customer_id")).toBe("019customer");
	});

	test("verifies a delivery signed over the secret's own bytes", async () => {
		let signed = await delivery({ type: "order.paid", data: { id: "019order" } });

		expect(await polar().webhooks.verify(signed.request, signed.body)).toBe(true);
	});

	test("refuses a delivery signed with anything else", async () => {
		let signed = await delivery({ type: "order.paid", data: { id: "019order" } }, "whsec_other");

		expect(await polar().webhooks.verify(signed.request, signed.body)).toBe(false);
	});

	test("refuses a delivery carrying no signature at all", async () => {
		let body = JSON.stringify({ type: "order.paid", data: { id: "019order" } });
		let request = new Request("https://app.example.com/webhooks/billing", { method: "POST", body });

		expect(await polar().webhooks.verify(request, body)).toBe(false);
	});

	test("verifies against a secret read once however many deliveries arrive", async () => {
		let signed = await delivery({ type: "order.paid", data: { id: "019order" } });

		let reads = 0;
		let billing = polar({
			webhookSecret: () => {
				reads += 1;

				return WEBHOOK_SECRET;
			},
		});

		expect(await billing.webhooks.verify(signed.request, signed.body)).toBe(true);
		expect(await billing.webhooks.verify(signed.request, signed.body)).toBe(true);
		expect(reads).toBe(1);
	});

	test("reads the signing secret again after a failed read", async () => {
		let signed = await delivery({ type: "order.paid", data: { id: "019order" } });

		let attempts = 0;
		let billing = polar({
			webhookSecret: async () => {
				attempts += 1;
				if (attempts === 1) throw new Error("secret store unavailable");

				return await Promise.resolve(WEBHOOK_SECRET);
			},
		});

		expect(await billing.webhooks.verify(signed.request, signed.body)).toBe(false);
		expect(await billing.webhooks.verify(signed.request, signed.body)).toBe(true);
		expect(attempts).toBe(2);
	});

	test("fails a delivery closed while the signing secret is unusable", async () => {
		let signed = await delivery({ type: "order.paid", data: { id: "019order" } });

		let unusable: Secret[] = [
			"",
			() => "",
			() => {
				throw new Error("secret store unavailable");
			},
			async () => await Promise.reject(new Error("secret store unavailable")),
		];

		for (let webhookSecret of unusable) {
			expect(await polar({ webhookSecret }).webhooks.verify(signed.request, signed.body)).toBe(
				false,
			);
		}
	});

	test("names the delivery by its own header and the resource it is about", () => {
		let body = JSON.stringify({
			type: "subscription.active",
			timestamp: "2026-09-02T17:30:25Z",
			data: polarSubscription(),
		});

		expect(polar().webhooks.reference(inbound(body, "msg_7"), body)).toEqual({
			deliveryId: "msg_7",
			object: { id: "019subscription", type: "subscription.active" },
		});

		expect(polar().webhooks.reference(inbound("not-json", "msg_7"), "not-json")).toEqual({
			deliveryId: "msg_7",
			object: null,
		});

		expect(polar().webhooks.reference(inbound(body), body)).toBeNull();
	});

	test("tells two deliveries about one object apart", () => {
		let body = JSON.stringify({
			type: "subscription.active",
			timestamp: "2026-09-02T17:30:25Z",
			data: polarSubscription(),
		});

		let first = polar().webhooks.reference(inbound(body, "msg_1"), body);
		let second = polar().webhooks.reference(inbound(body, "msg_2"), body);

		expect(first?.deliveryId).not.toBe(second?.deliveryId);
		expect(first?.object).toEqual(second?.object);
	});

	test("normalizes a delivery it models", async () => {
		let body = JSON.stringify({
			type: "subscription.active",
			timestamp: "2026-09-02T17:30:25Z",
			data: polarSubscription(),
		});

		let event = await unwrap(polar().webhooks.event(inbound(body), body));

		expect(event.type).toBe("subscription.activated");
		expect(event.raw).toMatchObject({ type: "subscription.active" });

		if (event.type !== "subscription.activated") throw new Error("expected a subscription event");

		expect(event.subscription.productSlug).toBe("pro");
	});

	test("carries a delivery it does not model instead of failing on it", async () => {
		for (let type of ["subscription.cycled", "member.created", "refund.created"]) {
			let body = JSON.stringify({ type, data: { id: "019resource" } });
			let event = await unwrap(polar().webhooks.event(inbound(body), body));

			expect(event.id).toBe("019resource");
			expect(["subscription.updated", "unrecognized"]).toContain(event.type);
		}

		let body = JSON.stringify({ type: "member.created", data: { id: "019member" } });
		let unmodelled = await unwrap(polar().webhooks.event(inbound(body), body));

		expect(unmodelled).toMatchObject({ type: "unrecognized", providerType: "member.created" });
	});

	test("carries a payload it cannot map as unrecognized", async () => {
		let body = JSON.stringify({
			type: "order.paid",
			data: { id: "019order", customer_id: "019customer", product_id: "019unconfigured" },
		});

		let event = await unwrap(polar().webhooks.event(inbound(body), body));

		expect(event).toMatchObject({ type: "unrecognized", providerType: "order.paid" });
	});

	test("completes a checkout only once the session produced something", async () => {
		let succeeded = JSON.stringify({
			type: "checkout.updated",
			data: polarCheckout({ status: "succeeded" }),
		});

		let completed = await unwrap(polar().webhooks.event(inbound(succeeded), succeeded));

		expect(completed.type).toBe("checkout.completed");

		let pending = JSON.stringify({ type: "checkout.updated", data: polarCheckout() });
		let open = await unwrap(polar().webhooks.event(inbound(pending), pending));

		expect(open).toMatchObject({ type: "unrecognized", providerType: "checkout.updated" });
	});

	test("reports a body it cannot read at all", async () => {
		expectFailure(
			await polar().webhooks.event(inbound("not-json"), "not-json"),
			"invalid_response",
		);
	});

	test("states the connection it bills against", () => {
		let billing = polar();

		expect(billing.connection).toBe("polar_test");
		expect(billing.native).toBe(billing);
	});
});
