/**
 * Covers what the Mercado Pago provider promises: prices cross the wire as
 * decimals and come back as integers for a zero-decimal currency too, offset
 * paging surfaces only as an opaque cursor, a delivery is proven against the
 * manifest built from its own query string, and an event needs a read-back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { isFailure, isSuccess } from "@pkg/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { Billing } from "../../core/contract";
import type { BillingError } from "../../core/errors";
import type { Secret } from "../../core/secret";

import type { MercadoPagoProduct } from "./catalog";

import { decodeCursor, toMajorUnits, toMinorUnits } from "./money";

import type { MercadoPagoBillingOptions } from "./index";

import { MercadoPagoBilling } from "./index";

/** Origin every stub answers on. */
const API = "https://api.mercadopago.com";

/** The credential every request is expected to carry. */
const TOKEN = "APP_USR-test-token";

/** The signing secret the delivery assertions key against. */
const SECRET = "mp-webhook-secret";

/** Our own subject id, which is what every checkout carries as its reference. */
const SUBJECT = "subject_1";

/** Catalog the assertions sell from: a peso book, a peso plan, and a peso-less plan. */
const PRODUCTS: Record<string, MercadoPagoProduct> = {
	book: { kind: "one_time", name: "Book", price: { amount: 10_050, currency: "ars" } },
	santiago: { kind: "one_time", name: "Santiago", price: { amount: 5000, currency: "clp" } },
	pro: { kind: "recurring", plan: "plan_pro", features: { flow_monitors: true } },
	andes: { kind: "recurring", plan: "plan_andes" },
};

/** A stored payer, holding our subject id in its metadata and its description. */
const CUSTOMER = {
	id: "cus_1",
	email: "ada@example.com",
	first_name: "Ada",
	last_name: "Lovelace",
	description: SUBJECT,
	metadata: { external_reference: SUBJECT },
	date_created: "2026-01-02T03:04:05.000-03:00",
	live_mode: false,
};

/** A hosted one-time checkout, priced in the currency's own units. */
const PREFERENCE = {
	id: "1234567890-abc",
	init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890-abc`,
	sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890-abc`,
	items: [{ id: "book", title: "Book", quantity: 1, unit_price: 100.5, currency_id: "ARS" }],
	external_reference: SUBJECT,
	metadata: { product_slug: "book", customer_id: "cus_1" },
	date_created: "2026-01-02T03:04:05.000-03:00",
	collector_id: 1_234_567_890,
};

/** A settled charge for the hosted checkout above. */
const PAYMENT = {
	id: 9_876_543_210,
	status: "approved",
	status_detail: "accredited",
	currency_id: "ARS",
	transaction_amount: 100.5,
	taxes_amount: 0,
	transaction_amount_refunded: 0,
	external_reference: SUBJECT,
	metadata: { product_slug: "book" },
	payer: { id: "cus_1", email: "ada@example.com", type: "customer" },
	order: { id: 111, type: "mercadopago" },
	date_created: "2026-01-02T03:04:05.000-03:00",
	date_approved: "2026-01-02T03:05:05.000-03:00",
};

/** A recurring price the platform stores, which is the catalog read for a plan. */
const PLAN = {
	id: "plan_pro",
	reason: "Pro monthly",
	status: "active",
	auto_recurring: {
		frequency: 1,
		frequency_type: "months",
		transaction_amount: 100.5,
		currency_id: "ARS",
	},
	date_created: "2026-01-01T00:00:00.000-03:00",
};

/** The same plan priced in a currency with no minor unit. */
const ZERO_DECIMAL_PLAN = {
	id: "plan_andes",
	reason: "Andes monthly",
	status: "active",
	auto_recurring: {
		frequency: 1,
		frequency_type: "months",
		transaction_amount: 5000,
		currency_id: "CLP",
	},
	date_created: "2026-01-01T00:00:00.000-03:00",
};

/** An authorized subscription against the peso plan. */
const PREAPPROVAL = {
	id: "2c938084",
	status: "authorized",
	reason: "Pro monthly",
	payer_id: 555,
	payer_email: "ada@example.com",
	preapproval_plan_id: "plan_pro",
	external_reference: SUBJECT,
	init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=2c938084",
	auto_recurring: {
		frequency: 1,
		frequency_type: "months",
		transaction_amount: 100.5,
		currency_id: "ARS",
		start_date: "2026-01-02T03:04:05.000-03:00",
	},
	summarized: { charged_quantity: 3, last_charged_date: "2026-01-02T03:04:05.000-03:00" },
	next_payment_date: "2026-02-02T03:04:05.000-03:00",
	date_created: "2026-01-02T03:04:05.000-03:00",
	last_modified: "2026-01-02T03:04:05.000-03:00",
};

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Every request the stubs observed, in order, so an assertion reads the wire. */
let requests: Request[] = [];

beforeEach(() => {
	requests = [];
	server.events.removeAllListeners();
	server.events.on("request:start", ({ request }) => requests.push(request));
});

/** Bodies the stubs captured, keyed by the path that received them. */
let bodies = new Map<string, Record<string, unknown>>();

/** Builds the provider under test, configured against the stubbed origin. */
function billing(options: Partial<MercadoPagoBillingOptions> = {}): MercadoPagoBilling {
	return new MercadoPagoBilling({
		accessToken: TOKEN,
		products: PRODUCTS,
		webhookSecret: SECRET,
		notificationURL: "https://app.test/webhooks/billing",
		backURLs: { success: "https://app.test/thanks" },
		...options,
	});
}

/** Answers a create, recording the body so the wire format can be asserted. */
function captured(path: string, payload: Record<string, unknown>, status = 200) {
	return http.post(`${API}${path}`, async ({ request }) => {
		bodies.set(path, (await request.json()) as Record<string, unknown>);
		return HttpResponse.json(payload, { status });
	});
}

/** Renders digest bytes the way the signature header carries them. */
function toHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Signs a manifest the way the platform's senders do, for a delivery a test builds. */
async function sign(manifest: string): Promise<string> {
	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(manifest)));
}

/** Builds a delivery whose URL, headers, and body all belong to one notification. */
async function delivery(options: {
	dataId: string;
	requestId: string;
	timestamp: string;
	body: Record<string, unknown>;
	signedDataId?: string;
}): Promise<{ request: Request; rawBody: string }> {
	let manifest = `id:${options.signedDataId ?? options.dataId};request-id:${options.requestId};ts:${options.timestamp};`;
	let rawBody = JSON.stringify(options.body);

	let request = new Request(
		`https://app.test/webhooks/billing?data.id=${options.dataId}&type=payment`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-request-id": options.requestId,
				"x-signature": `ts=${options.timestamp},v1=${await sign(manifest)}`,
			},
			body: rawBody,
		},
	);

	return { request, rawBody };
}

/** Builds the inbound request one unsigned notification body arrives on. */
function notification(rawBody: string): Request {
	return new Request("https://app.test/webhooks/billing", { method: "POST", body: rawBody });
}

describe("Mercado Pago amounts", () => {
	test.each([
		[{ amount: 10_050, currency: "ars" }, 100.5],
		[{ amount: 5000, currency: "clp" }, 5000],
		[{ amount: 1, currency: "brl" }, 0.01],
		[{ amount: 115, currency: "mxn" }, 1.15],
		[{ amount: 0, currency: "ars" }, 0],
	])("carries %o as a decimal in the currency's own units", (money, wire) => {
		expect(toMajorUnits(money)).toBe(wire);
		expect(toMinorUnits(wire, money.currency)).toEqual(money);
	});

	test("reads an amount back under the currency code in any letter case", () => {
		expect(toMinorUnits(100.5, "ARS")).toEqual({ amount: 10_050, currency: "ars" });
		expect(toMajorUnits({ amount: 10_050, currency: "ARS" })).toBe(100.5);
	});

	test("rounds an amount the platform reported with floating-point noise", () => {
		expect(toMinorUnits(100.499_999_999_9, "ars")).toEqual({ amount: 10_050, currency: "ars" });
	});

	/**
	 * ISO 4217 gives the Colombian peso two decimals and the shared table follows
	 * it, so five thousand pesos is five hundred thousand minor units and reaches
	 * the wire as `5000`. Colombian prices are quoted in whole pesos, so a caller
	 * pricing in this currency states the two trailing zeroes.
	 */
	test("prices the Colombian peso through its ISO minor unit", () => {
		expect(toMajorUnits({ amount: 500_000, currency: "cop" })).toBe(5000);
		expect(toMinorUnits(5000, "cop")).toEqual({ amount: 500_000, currency: "cop" });
	});
});

describe("MercadoPagoBilling", () => {
	test("states the connection it bills against and the groups it leaves absent", () => {
		let provider = billing({ connection: "mercado-pago-ar" });

		expect(provider.connection).toBe("mercado-pago-ar");
		expect(provider.native).toBe(provider);

		let declared: Billing = provider;

		expect(declared.portal).toBeUndefined();
		expect(declared.discounts).toBeUndefined();
		expect(declared.usage).toBeUndefined();
		expect(declared.meters).toBeUndefined();
	});

	test("resolves a lazy access token once and carries it on every request", async () => {
		let reads = 0;
		let provider = billing({
			accessToken: () => {
				reads += 1;
				return TOKEN;
			},
		});

		server.use(
			http.get(`${API}/v1/payments/:id`, () => HttpResponse.json(PAYMENT)),
			http.get(`${API}/preapproval_plan/:id`, () => HttpResponse.json(PLAN)),
		);

		await provider.orders.find("9876543210");
		await provider.catalog.find("pro");

		expect(reads).toBe(1);
		expect(requests).toHaveLength(2);
		for (let request of requests) {
			expect(request.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
		}
	});

	test("reports an unresolvable token as unauthenticated and asks again after it fails", async () => {
		let attempts = 0;
		let provider = billing({
			accessToken: async () => {
				attempts += 1;
				if (attempts === 1) throw new Error("secret store unavailable");

				return await Promise.resolve(TOKEN);
			},
		});

		server.use(http.get(`${API}/v1/payments/:id`, () => HttpResponse.json(PAYMENT)));

		let refused = await provider.orders.find("9876543210");

		expect(isFailure(refused)).toBe(true);
		if (!isFailure(refused)) return;

		expect(refused.error.code).toBe("unauthenticated");

		expect(isSuccess(await provider.orders.find("9876543210"))).toBe(true);
		expect(isSuccess(await provider.orders.find("9876543210"))).toBe(true);
		expect(attempts).toBe(2);
	});

	test("prices a hosted checkout in the currency's own units", async () => {
		server.use(
			http.get(`${API}/v1/customers/:id`, () => HttpResponse.json(CUSTOMER)),
			captured("/checkout/preferences", PREFERENCE),
		);

		let created = await billing().checkouts.create({
			product: "book",
			customer: { id: "cus_1" },
			returnTo: "https://app.test/thanks",
		});

		expect(isSuccess(created)).toBe(true);

		let sent = bodies.get("/checkout/preferences");
		let items = sent?.["items"] as Array<Record<string, unknown>>;

		expect(items.at(0)).toMatchObject({ unit_price: 100.5, currency_id: "ARS", quantity: 1 });
		expect(sent).toMatchObject({ external_reference: SUBJECT, auto_return: "approved" });
	});

	test("prices a zero-decimal currency in whole units", async () => {
		server.use(captured("/checkout/preferences", PREFERENCE));

		await billing().checkouts.create({ product: "santiago", email: "ada@example.com" });

		let items = bodies.get("/checkout/preferences")?.["items"] as Array<Record<string, unknown>>;

		expect(items.at(0)).toMatchObject({ unit_price: 5000, currency_id: "CLP" });
	});

	test("reads a decimal price back as the integer it was sent as", async () => {
		server.use(captured("/checkout/preferences", PREFERENCE));

		let created = await billing().checkouts.create({ product: "book" });

		expect(isSuccess(created)).toBe(true);
		if (!isSuccess(created)) return;

		expect(created.data.amount).toEqual({ amount: 10_050, currency: "ars" });
		expect(created.data.id).toBe(`pref_${PREFERENCE.id}`);
		expect(created.data.url).toBe(PREFERENCE.init_point);
		expect(created.data.productSlug).toBe("book");
	});

	test("reads a zero-decimal price back without dividing it", async () => {
		server.use(
			http.get(`${API}/preapproval_plan/plan_andes`, () => HttpResponse.json(ZERO_DECIMAL_PLAN)),
		);

		let product = await billing().catalog.find("andes");

		expect(isSuccess(product)).toBe(true);
		if (!isSuccess(product)) return;

		expect(product.data.prices.at(0)?.amount).toEqual({ amount: 5000, currency: "clp" });
		expect(product.data.prices.at(0)?.interval).toBe("month");
	});

	test("refuses a reference the platform's own field cannot hold", async () => {
		let created = await billing().checkouts.create({
			product: "book",
			metadata: { external_reference: "subject (1)" },
		});

		expect(isFailure(created)).toBe(true);
		if (!isFailure(created)) return;

		expect(created.error.code).toBe("invalid_request");
		expect(requests).toHaveLength(0);
	});

	test("reports a hosted checkout the platform has already expired", async () => {
		server.use(
			http.get(`${API}/checkout/preferences/:id`, () =>
				HttpResponse.json({ ...PREFERENCE, preference_expired: true }),
			),
		);

		let read = await billing().checkouts.find(PREFERENCE.id);

		expect(isSuccess(read)).toBe(true);
		if (!isSuccess(read)) return;

		expect(read.data.status).toBe("expired");
	});

	test("carries an idempotency key on a create derived from our own reference", async () => {
		server.use(captured("/preapproval", PREAPPROVAL));

		await billing().checkouts.create({
			product: "pro",
			email: "ada@example.com",
			metadata: { external_reference: SUBJECT },
		});

		let create = requests.find((request) => new URL(request.url).pathname === "/preapproval");

		expect(create?.headers.get("x-idempotency-key")).toBe(SUBJECT);
		expect(bodies.get("/preapproval")).toMatchObject({
			preapproval_plan_id: "plan_pro",
			payer_email: "ada@example.com",
			status: "pending",
		});
	});

	test("reports a hosted page asked to collect a typed code as unsupported", async () => {
		let opened = await billing().checkouts.create({
			product: "book",
			allowDiscountCodes: true,
		});

		expect(requests).toHaveLength(0);
		expect(isFailure(opened)).toBe(true);
		if (!isFailure(opened)) return;

		expect(opened.error.code).toBe("unsupported");
	});

	test("opens a hosted page for a caller that closed the code field", async () => {
		server.use(captured("/checkout/preferences", PREFERENCE));

		let opened = await billing().checkouts.create({
			product: "book",
			allowDiscountCodes: false,
		});

		expect(isSuccess(opened)).toBe(true);
	});

	test("prices a one-time product from configuration, since the platform stores none", async () => {
		let product = await billing().catalog.find("book");

		expect(requests).toHaveLength(0);
		expect(isSuccess(product)).toBe(true);
		if (!isSuccess(product)) return;

		expect(product.data.slug).toBe("book");
		expect(product.data.prices.at(0)).toMatchObject({
			kind: "one_time",
			amount: { amount: 10_050, currency: "ars" },
		});
	});

	test("maps an authorized subscription onto our own vocabulary", async () => {
		server.use(http.get(`${API}/preapproval/:id`, () => HttpResponse.json(PREAPPROVAL)));

		let subscription = await billing().subscriptions.find("2c938084");

		expect(isSuccess(subscription)).toBe(true);
		if (!isSuccess(subscription)) return;

		expect(subscription.data).toMatchObject({
			id: "2c938084",
			customerId: "555",
			productSlug: "pro",
			status: "active",
			providerStatus: "authorized",
			interval: "month",
			cancelAtPeriodEnd: false,
			amount: { amount: 10_050, currency: "ars" },
		});
		expect(subscription.data.currentPeriodEnd?.toISOString()).toBe("2026-02-02T06:04:05.000Z");
	});

	test("refuses to name a subscription whose plan no slug is configured for", async () => {
		server.use(
			http.get(`${API}/preapproval/:id`, () =>
				HttpResponse.json({ ...PREAPPROVAL, preapproval_plan_id: "plan_unknown" }),
			),
		);

		let subscription = await billing().subscriptions.find("2c938084");

		expect(isFailure(subscription)).toBe(true);
		if (!isFailure(subscription)) return;

		expect(subscription.error.code).toBe("invalid_response");
		expect(subscription.error.message).toContain("plan_unknown");
	});

	test("hides offset paging behind an opaque cursor, and walks to the next page", async () => {
		server.use(
			http.get(`${API}/v1/payments/search`, ({ request }) => {
				let offset = Number(new URL(request.url).searchParams.get("offset"));

				return HttpResponse.json({
					paging: { total: 3, limit: 2, offset },
					results: offset === 0 ? [PAYMENT, { ...PAYMENT, id: 2 }] : [{ ...PAYMENT, id: 3 }],
				});
			}),
		);

		let provider = billing();
		let first = await provider.orders.list({ limit: 2 });

		expect(isSuccess(first)).toBe(true);
		if (!isSuccess(first)) return;

		expect(first.data.items).toHaveLength(2);
		expect(first.data.cursor).not.toBeNull();
		expect(first.data.cursor).not.toMatch(/^\d+$/);
		expect(first.data.cursor).not.toContain("offset");
		expect(decodeCursor(first.data.cursor ?? undefined)).toBe(2);

		let second = await provider.orders.list({ limit: 2, cursor: first.data.cursor ?? undefined });

		expect(isSuccess(second)).toBe(true);
		if (!isSuccess(second)) return;

		expect(new URL(requests[1]?.url ?? "").searchParams.get("offset")).toBe("2");
		expect(second.data.items).toHaveLength(1);
		expect(second.data.cursor).toBeNull();
	});

	test("refuses a cursor it did not issue", async () => {
		let page = await billing().orders.list({ cursor: "2" });

		expect(isFailure(page)).toBe(true);
		if (!isFailure(page)) return;

		expect(page.error.code).toBe("invalid_request");
		expect(requests).toHaveLength(0);
	});

	test.each([
		[404, "not_found", false],
		[401, "unauthenticated", false],
		[403, "forbidden", false],
		[400, "invalid_request", false],
		[429, "rate_limited", true],
	] as const)("maps a %i onto %s", async (status, code, retryable) => {
		server.use(
			http.get(`${API}/v1/payments/:id`, () =>
				HttpResponse.json(
					{
						message: "Payment not found",
						error: "not_found",
						status,
						cause: [{ code: 2034, description: "no such payment" }],
					},
					{ status },
				),
			),
		);

		let order = await billing().orders.find("missing");

		expect(isFailure(order)).toBe(true);
		if (!isFailure(order)) return;

		expect(order.error.code).toBe(code);
		expect(order.error.retryable).toBe(retryable);
		expect(order.error.providerCode).toBe("2034");
		expect(order.error.connection).toBe("mercado-pago");
	});

	test("maps a 5xx onto an outcome nobody knows, never onto a retry", async () => {
		server.use(
			http.get(`${API}/v1/payments/:id`, () =>
				HttpResponse.json({ message: "boom" }, { status: 502 }),
			),
		);

		let order = await billing().orders.find("9876543210");

		expect(isFailure(order)).toBe(true);
		if (!isFailure(order)) return;

		expect(order.error.code).toBe("unknown");
		expect(order.error.retryable).toBe(false);
	});

	test("maps a transport failure onto an outcome nobody knows", async () => {
		server.use(http.get(`${API}/v1/payments/:id`, () => HttpResponse.error()));

		let order = await billing().orders.find("9876543210");

		expect(isFailure(order)).toBe(true);
		if (!isFailure(order)) return;

		expect(order.error.code).toBe("unknown");
		expect(order.error.retryable).toBe(false);
	});

	test("proves a delivery against the manifest built from its own query string", async () => {
		let signed = await delivery({
			dataId: "9876543210",
			requestId: "req-1",
			timestamp: "1704908010",
			body: { id: 100, type: "payment", action: "payment.updated", data: { id: "9876543210" } },
		});

		expect(await billing().webhooks.verify(signed.request, signed.rawBody)).toBe(true);
	});

	test("rejects a delivery whose query string was changed after signing", async () => {
		let signed = await delivery({
			dataId: "1111111111",
			signedDataId: "9876543210",
			requestId: "req-1",
			timestamp: "1704908010",
			body: { id: 100, type: "payment", action: "payment.updated", data: { id: "9876543210" } },
		});

		expect(await billing().webhooks.verify(signed.request, signed.rawBody)).toBe(false);
	});

	test("proves a delivery against a secret read once however many arrive", async () => {
		let signed = await delivery({
			dataId: "9876543210",
			requestId: "req-1",
			timestamp: "1704908010",
			body: { id: 100, type: "payment", action: "payment.updated", data: { id: "9876543210" } },
		});

		let reads = 0;
		let provider = billing({
			webhookSecret: () => {
				reads += 1;

				return SECRET;
			},
		});

		expect(await provider.webhooks.verify(signed.request, signed.rawBody)).toBe(true);
		expect(await provider.webhooks.verify(signed.request, signed.rawBody)).toBe(true);
		expect(reads).toBe(1);
	});

	test("reads the signing secret again after a failed read", async () => {
		let signed = await delivery({
			dataId: "9876543210",
			requestId: "req-1",
			timestamp: "1704908010",
			body: { id: 100, type: "payment", action: "payment.updated", data: { id: "9876543210" } },
		});

		let attempts = 0;
		let provider = billing({
			webhookSecret: async () => {
				attempts += 1;
				if (attempts === 1) throw new Error("secret store unavailable");

				return await Promise.resolve(SECRET);
			},
		});

		expect(await provider.webhooks.verify(signed.request, signed.rawBody)).toBe(false);
		expect(await provider.webhooks.verify(signed.request, signed.rawBody)).toBe(true);
		expect(attempts).toBe(2);
	});

	test("fails a delivery closed while the signing secret is unusable", async () => {
		let signed = await delivery({
			dataId: "9876543210",
			requestId: "req-1",
			timestamp: "1704908010",
			body: { id: 100, type: "payment", action: "payment.updated", data: { id: "9876543210" } },
		});

		let unusable: Secret[] = [
			"",
			() => "",
			() => {
				throw new Error("secret store unavailable");
			},
			async () => await Promise.reject(new Error("secret store unavailable")),
		];

		for (let webhookSecret of unusable) {
			expect(await billing({ webhookSecret }).webhooks.verify(signed.request, signed.rawBody)).toBe(
				false,
			);
		}
	});

	test("fails a delivery closed while no signing secret is configured", async () => {
		let signed = await delivery({
			dataId: "9876543210",
			requestId: "req-1",
			timestamp: "1704908010",
			body: { id: 100, type: "payment", data: { id: "9876543210" } },
		});

		expect(
			await billing({ webhookSecret: undefined }).webhooks.verify(signed.request, signed.rawBody),
		).toBe(false);
	});

	test("names a delivery for deduplication, and reports an unreadable one", async () => {
		let provider = billing();
		let body = JSON.stringify({
			id: 100,
			type: "payment",
			action: "payment.updated",
			data: { id: "9876543210" },
		});

		expect(provider.webhooks.reference(notification(body), body)).toEqual({
			deliveryId: "100",
			object: { id: "9876543210", type: "payment.updated" },
		});

		expect(provider.webhooks.reference(notification("not-json"), "not-json")).toBeNull();

		let unreadable = await provider.webhooks.event(notification("not-json"), "not-json");

		expect(isFailure(unreadable)).toBe(true);
		if (!isFailure(unreadable)) return;

		expect(unreadable.error.code).toBe("invalid_request");
	});

	test("answers an unmodelled delivery family with the unrecognized arm", async () => {
		let body = JSON.stringify({ id: 7, type: "point_integration_wh", data: { id: "x" } });
		let event = await billing().webhooks.event(notification(body), body);

		expect(isSuccess(event)).toBe(true);
		if (!isSuccess(event)) return;

		expect(event.data.type).toBe("unrecognized");
		expect(event.data).toMatchObject({ id: "7", providerType: "point_integration_wh" });
		expect(event.data.raw).toMatchObject({ type: "point_integration_wh" });
		expect(requests).toHaveLength(0);
	});

	test("reads the charge a delivery points at before naming the event", async () => {
		server.use(http.get(`${API}/v1/payments/:id`, () => HttpResponse.json(PAYMENT)));

		let body = JSON.stringify({
			id: 100,
			type: "payment",
			action: "payment.updated",
			data: { id: "9876543210" },
		});

		let event = await billing().webhooks.event(notification(body), body);

		expect(new URL(requests[0]?.url ?? "").pathname).toBe("/v1/payments/9876543210");
		expect(isSuccess(event)).toBe(true);
		if (!isSuccess(event) || event.data.type !== "order.paid") {
			expect.unreachable("the delivery should have resolved to a paid order");
			return;
		}

		expect(event.data.order).toMatchObject({
			id: "9876543210",
			customerId: "cus_1",
			productSlug: "book",
			paid: true,
			total: { amount: 10_050, currency: "ars" },
		});
		expect(event.data.raw).toMatchObject({ action: "payment.updated" });
	});

	test("reads the subscription a delivery points at before naming the event", async () => {
		server.use(http.get(`${API}/preapproval/:id`, () => HttpResponse.json(PREAPPROVAL)));

		let body = JSON.stringify({
			id: 101,
			type: "subscription_preapproval",
			action: "updated",
			data: { id: "2c938084" },
		});

		let event = await billing().webhooks.event(notification(body), body);

		expect(new URL(requests[0]?.url ?? "").pathname).toBe("/preapproval/2c938084");
		expect(isSuccess(event)).toBe(true);
		if (!isSuccess(event) || event.data.type !== "subscription.activated") {
			expect.unreachable("the delivery should have resolved to an activated subscription");
			return;
		}

		expect(event.data.subscription.productSlug).toBe("pro");
	});

	test("leaves an unmodelled family unrecognized without reading anything back", async () => {
		let body = JSON.stringify({ id: 7, type: "invoice", data: { id: "x" } });
		let event = await billing().webhooks.event(notification(body), body);

		expect(requests).toHaveLength(0);
		expect(isSuccess(event)).toBe(true);
		if (!isSuccess(event)) return;

		expect(event.data.type).toBe("unrecognized");
	});

	test("resolves a hosted checkout a buyer has come back from", async () => {
		server.use(
			http.get(`${API}/checkout/preferences/:id`, () => HttpResponse.json(PREFERENCE)),
			http.get(`${API}/v1/payments/search`, () =>
				HttpResponse.json({ paging: { total: 1, limit: 100, offset: 0 }, results: [PAYMENT] }),
			),
		);

		let finished = await billing().checkouts.finish(PREFERENCE.id);

		expect(isSuccess(finished)).toBe(true);
		if (!isSuccess(finished)) return;

		expect(finished.data.status).toBe("completed");
		expect(finished.data.orderId).toBe("9876543210");
		expect(new URL(requests[1]?.url ?? "").searchParams.get("external_reference")).toBe(SUBJECT);
	});

	test("composes a snapshot from the subscriptions and purchases a payer holds", async () => {
		server.use(
			http.get(`${API}/v1/customers/:id`, () => HttpResponse.json(CUSTOMER)),
			http.get(`${API}/preapproval/search`, ({ request }) => {
				let payer = new URL(request.url).searchParams.get("payer_email");

				return HttpResponse.json({
					paging: { total: 1, limit: 100, offset: 0 },
					results: payer === CUSTOMER.email ? [PREAPPROVAL] : [],
				});
			}),
			http.get(`${API}/v1/payments/search`, () =>
				HttpResponse.json({ paging: { total: 1, limit: 100, offset: 0 }, results: [PAYMENT] }),
			),
		);

		let state = await billing().entitlements.of({ id: "cus_1" });

		expect(isSuccess(state)).toBe(true);
		if (!isSuccess(state)) return;

		expect(state.data.customerId).toBe("cus_1");
		expect(state.data.externalId).toBe(SUBJECT);
		expect([...state.data.products].sort()).toEqual(["book", "pro"]);
		expect(state.data.features).toEqual({ flow_monitors: true });
		expect(state.data.meters).toEqual([]);
		expect(state.data.subscriptions.at(0)).toMatchObject({
			subscriptionId: "2c938084",
			productSlug: "pro",
			status: "active",
		});
	});

	test("reports the platform's own refusal of a second payer for one address", async () => {
		server.use(
			http.post(`${API}/v1/customers`, () =>
				HttpResponse.json({ message: "customer already exists" }, { status: 409 }),
			),
		);

		let created = await billing().customers.create({
			email: CUSTOMER.email,
			externalId: SUBJECT,
		});

		expect(isFailure(created)).toBe(true);
		if (!isFailure(created)) return;

		expect(created.error.code).toBe("conflict");
	});

	test("carries the wait a rate-limited answer asked for", async () => {
		server.use(
			http.post(`${API}/v1/customers`, () =>
				HttpResponse.json(
					{ message: "too many requests" },
					{
						status: 429,
						headers: { "retry-after": "42" },
					},
				),
			),
		);

		let created = await billing().customers.create({
			email: CUSTOMER.email,
			externalId: SUBJECT,
		});

		expect(isFailure(created)).toBe(true);
		if (!isFailure(created)) return;

		expect(created.error.code).toBe("rate_limited");
		expect(created.error.retryable).toBe(true);
		expect(created.error.retryAfter).toBe(42);
	});

	test("writes our subject id where a payer read can find it again", async () => {
		server.use(captured("/v1/customers", CUSTOMER));

		let created = await billing().customers.create({
			email: CUSTOMER.email,
			externalId: SUBJECT,
			name: "Ada Lovelace",
		});

		expect(bodies.get("/v1/customers")).toMatchObject({
			email: CUSTOMER.email,
			first_name: "Ada",
			last_name: "Lovelace",
			description: SUBJECT,
			metadata: { external_reference: SUBJECT },
		});

		expect(isSuccess(created)).toBe(true);
		if (!isSuccess(created)) return;

		expect(created.data).toMatchObject({
			id: "cus_1",
			externalId: SUBJECT,
			email: CUSTOMER.email,
			name: "Ada Lovelace",
		});
	});

	test.each<[string, (provider: MercadoPagoBilling) => Promise<Result<unknown, BillingError>>]>([
		[
			"a payer named by our own reference",
			(provider) => provider.customers.find({ externalId: SUBJECT }),
		],
		[
			"a cancellation deferred to the period end",
			(provider) => provider.subscriptions.cancel("2c9", { atPeriodEnd: true }),
		],
	])("reports %s as something the platform cannot do", async (_what, call) => {
		let result = await call(billing());

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.code).toBe("unsupported");
		expect(result.error.retryable).toBe(false);
		expect(requests).toHaveLength(0);
	});
});
