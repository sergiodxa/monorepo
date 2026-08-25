/**
 * Tests for the Polar billing client.
 *
 * The vendor SDK is faked so the API surface can be asserted without network calls,
 * but webhook signatures are real: verification is the security boundary, so every
 * delivery here is signed the way Polar signs and the new verification path is
 * cross-checked against the SDK's own verifier on the same bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as Webhooks from "@pkg/webhooks";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Customer, Discount, Order, Subscription } from "./index";

/**
 * Captured before the module is mocked below, so the cross-check runs against
 * the verifier the SDK actually ships.
 */
let { validateEvent: sdkValidateEvent, WebhookVerificationError: SDKWebhookVerificationError } =
	await import("@polar-sh/sdk/webhooks.js");

/** Stands in for the error the SDK raises when it cannot model an event's payload. */
class MockSDKValidationError extends Error {}

let validateEventCalls: Array<{ body: string; headers: Record<string, string>; secret: string }> =
	[];
let validateEventImpl: (
	body: string,
	headers: Record<string, string>,
	secret: string,
) => unknown = () => ({ type: "checkout.updated" });

vi.doMock("@polar-sh/sdk/webhooks.js", () => ({
	WebhookVerificationError: SDKWebhookVerificationError,
	validateEvent: (body: string, headers: Record<string, string>, secret: string) => {
		validateEventCalls.push({ body, headers, secret });
		return validateEventImpl(body, headers, secret);
	},
}));

vi.doMock("@polar-sh/sdk/models/errors/polarerror.js", () => ({
	PolarError: class PolarError extends Error {},
}));

/**
 * Uses a null-prototype object so recorded keys (e.g. "new") never collide
 * with inherited members like Object.prototype.constructor.
 */
let calls: Record<string, unknown[]> = Object.create(null);
function record(method: string, arg: unknown) {
	(calls[method] ??= []).push(arg);
}

let ingestImpl: () => unknown = () => ({});
let getExternalImpl: () => unknown = () => ({ id: "cus_1" });
let listCustomersImpl: () => unknown[] = () => [{ id: "cus_1" }];
let subscriptionsListImpl: () => unknown[][] = () => [[{ id: "sub_1" }], [{ id: "sub_2" }]];
let discountsListImpl: () => unknown[][] = () => [[{ id: "disc_1" }], [{ id: "disc_2" }]];
let ordersListImpl: () => unknown[][] = () => [[{ id: "ord_1" }], [{ id: "ord_2" }]];

vi.doMock("@polar-sh/sdk", () => ({
	Polar: class Polar {
		accessToken: string;
		constructor(opts: { accessToken: string }) {
			this.accessToken = opts.accessToken;
			record("new", opts);
		}
		customers = {
			create: async (arg: unknown) => {
				record("customers.create", arg);
				return { id: "cus_1" };
			},
			get: async (arg: unknown) => {
				record("customers.get", arg);
				return { id: "cus_1" };
			},
			getExternal: async (arg: unknown) => {
				record("customers.getExternal", arg);
				return getExternalImpl();
			},
			list: async (arg: unknown) => {
				record("customers.list", arg);
				return {
					async *[Symbol.asyncIterator]() {
						yield { result: { items: listCustomersImpl() } };
					},
				};
			},
			update: async (arg: unknown) => {
				record("customers.update", arg);
				return { id: "cus_1" };
			},
		};
		subscriptions = {
			get: async (arg: unknown) => {
				record("subscriptions.get", arg);
				return { id: "sub_1", status: "active" };
			},
			revoke: async (arg: unknown) => {
				record("subscriptions.revoke", arg);
				return { id: "sub_1", status: "canceled" };
			},
			list: async (arg: unknown) => {
				record("subscriptions.list", arg);
				return {
					async *[Symbol.asyncIterator]() {
						for (let items of subscriptionsListImpl()) yield { result: { items } };
					},
				};
			},
		};
		products = {
			get: async (arg: unknown) => {
				record("products.get", arg);
				return { id: "prod_1", name: "Complete", prices: [] };
			},
		};
		discounts = {
			list: async (arg: unknown) => {
				record("discounts.list", arg);
				return {
					async *[Symbol.asyncIterator]() {
						for (let items of discountsListImpl()) yield { result: { items } };
					},
				};
			},
		};
		orders = {
			list: async (arg: unknown) => {
				record("orders.list", arg);
				return {
					async *[Symbol.asyncIterator]() {
						for (let items of ordersListImpl()) yield { result: { items } };
					},
				};
			},
		};
		checkouts = {
			create: async (arg: unknown) => {
				record("checkouts.create", arg);
				return { id: "chk_1", url: "https://polar.sh/checkout/1" };
			},
		};
		customerSessions = {
			create: async (arg: unknown) => {
				record("customerSessions.create", arg);
				return { customerPortalUrl: "https://polar.sh/portal/1" };
			},
		};
		events = {
			ingest: async (arg: unknown) => {
				record("events.ingest", arg);
				return ingestImpl();
			},
		};
	},
}));

/** Imported after mocks are registered so the client picks up the fakes. */
let {
	ACTIVE_SUBSCRIPTION_STATUSES,
	isActiveSubscriptionStatus,
	PolarClient,
	PolarError,
	subscriptionFromEvent,
} = await import("./index");

/** A webhook secret in the form Polar issues one: arbitrary text, never base64. */
const WEBHOOK_SECRET = "polar_whs_TestSecretValue123";

/** A body Polar could plausibly deliver; the SDK's parser is mocked, so shape is free. */
const WEBHOOK_BODY = '{"type":"checkout.updated","data":{"id":"chk_1"}}';

/** How a delivery is described to the fixture helpers before it is signed. */
interface DeliveryOptions {
	/** Body text to sign and send; defaults to {@link WEBHOOK_BODY}. */
	body?: string;
	/** Delivery id for the `webhook-id` header. */
	id?: string;
	/** Send time in whole seconds since the epoch; defaults to now. */
	timestamp?: number;
	/** Secret to sign with; defaults to {@link WEBHOOK_SECRET}. */
	secret?: string;
}

/**
 * Signs a delivery the way Polar's senders do, computed independently with
 * WebCrypto so the fixtures act as an oracle for the code under test. The
 * HMAC key is the secret's UTF-8 bytes; the signed content is `id.timestamp.body`.
 *
 * @param options - The delivery to sign.
 * @returns The three Standard Webhooks headers, as a plain record.
 */
async function signLikePolar(options: DeliveryOptions = {}): Promise<Record<string, string>> {
	let body = options.body ?? WEBHOOK_BODY;
	let id = options.id ?? "wh_1";
	let timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
	let secret = options.secret ?? WEBHOOK_SECRET;

	let key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	let mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${id}.${timestamp}.${body}`),
	);

	let binary = "";
	for (let byte of new Uint8Array(mac)) binary += String.fromCharCode(byte);

	return {
		"webhook-id": id,
		"webhook-timestamp": String(timestamp),
		"webhook-signature": `v1,${btoa(binary)}`,
	};
}

/**
 * Builds a signed delivery as a handler receives one: the request whose headers carry
 * the signature, plus the raw body text already read off it.
 *
 * @param options - The delivery to sign.
 * @returns The request and the exact body the signature covers.
 */
async function delivery(
	options: DeliveryOptions = {},
): Promise<{ request: Request; body: string }> {
	let body = options.body ?? WEBHOOK_BODY;
	let headers = await signLikePolar(options);
	return { request: new Request("https://app/webhook", { method: "POST", headers }), body };
}

/**
 * The verdict the SDK's own verifier reaches: only a `WebhookVerificationError`
 * counts as a rejected signature, so any other throw means the signature passed
 * and only the typing failed.
 *
 * @param body - The raw delivery body.
 * @param headers - The delivery headers, flattened as the SDK expects them.
 * @param secret - The Polar webhook signing secret.
 * @returns `true` when the SDK considers the delivery authentic.
 */
function sdkSaysAuthentic(
	body: string,
	headers: Record<string, string>,
	secret: string = WEBHOOK_SECRET,
): boolean {
	try {
		sdkValidateEvent(body, headers, secret);
		return true;
	} catch (error) {
		return !(error instanceof SDKWebhookVerificationError);
	}
}

afterEach(() => {
	calls = Object.create(null);
	validateEventCalls = [];
	validateEventImpl = () => ({ type: "checkout.updated" });
	ingestImpl = () => ({});
	getExternalImpl = () => ({ id: "cus_1" });
	listCustomersImpl = () => [{ id: "cus_1" }];
	subscriptionsListImpl = () => [[{ id: "sub_1" }], [{ id: "sub_2" }]];
	discountsListImpl = () => [[{ id: "disc_1" }], [{ id: "disc_2" }]];
	ordersListImpl = () => [[{ id: "ord_1" }], [{ id: "ord_2" }]];
});

describe("PolarClient", () => {
	test("does not load or construct the SDK until a method is called", async () => {
		let polar = new PolarClient({ accessToken: "polar_at_test" });
		expect(calls["new"]).toBeUndefined();

		await polar.getCustomer("cus_1");
		expect(calls["new"]).toEqual([{ accessToken: "polar_at_test" }]);
	});

	test("constructs the SDK once and reuses it across calls", async () => {
		let polar = new PolarClient({ accessToken: "polar_at_test" });
		await Promise.all([polar.getCustomer("cus_1"), polar.getCustomer("cus_2")]);
		await polar.getCustomer("cus_3");
		expect(calls["new"]).toHaveLength(1);
	});

	test("resolves a token provider on first use and configures the SDK with its value", async () => {
		let resolutions = 0;
		let polar = new PolarClient({
			accessToken: async () => {
				resolutions++;
				return "polar_at_from_store";
			},
		});

		expect(resolutions).toBe(0);

		await polar.getCustomer("cus_1");
		expect(calls["new"]).toEqual([{ accessToken: "polar_at_from_store" }]);

		await polar.getCustomer("cus_2");
		expect(resolutions).toBe(1);
	});

	test("retries a token provider that failed rather than staying broken", async () => {
		let attempts = 0;
		let polar = new PolarClient({
			accessToken: async () => {
				attempts++;
				if (attempts === 1) throw new Error("Secret not found");
				return "polar_at_second_try";
			},
		});

		await expect(polar.getCustomer("cus_1")).rejects.toThrow("Secret not found");

		await polar.getCustomer("cus_1");
		expect(attempts).toBe(2);
		expect(calls["new"]).toEqual([{ accessToken: "polar_at_second_try" }]);
	});

	describe("createCustomer", () => {
		test("passes email/name/metadata through", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let customer = await polar.createCustomer("jane@example.com", "Jane", { tenant_id: "t_1" });
			expect<Partial<Customer>>(customer).toEqual({ id: "cus_1" });
			expect(calls["customers.create"]).toEqual([
				{ email: "jane@example.com", name: "Jane", metadata: { tenant_id: "t_1" } },
			]);
		});

		test("maps a null name to undefined and defaults metadata", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.createCustomer("jane@example.com", null);
			expect(calls["customers.create"]).toEqual([
				{ email: "jane@example.com", name: undefined, metadata: {} },
			]);
		});
	});

	test("getCustomer looks up by id", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.getCustomer("cus_1");
		expect(calls["customers.get"]).toEqual([{ id: "cus_1" }]);
	});

	test("updateCustomer wraps updates in a customerUpdate payload", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.updateCustomer("cus_1", { name: "New", metadata: { a: "b" } });
		expect(calls["customers.update"]).toEqual([
			{ id: "cus_1", customerUpdate: { name: "New", metadata: { a: "b" }, externalId: undefined } },
		]);
	});

	test("updateCustomer forwards externalId when linking a customer", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.updateCustomer("cus_1", { externalId: "sub_123" });
		expect(calls["customers.update"]).toEqual([
			{
				id: "cus_1",
				customerUpdate: { name: undefined, metadata: undefined, externalId: "sub_123" },
			},
		]);
	});

	describe("getExternalCustomer", () => {
		test("looks up by external id", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let customer = await polar.getExternalCustomer("sub_123");
			expect<Partial<Customer> | null>(customer).toEqual({ id: "cus_1" });
			expect(calls["customers.getExternal"]).toEqual([{ externalId: "sub_123" }]);
		});

		test("returns null when no customer has that external id", async () => {
			getExternalImpl = () => {
				throw new Error("not found");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.getExternalCustomer("missing")).toBeNull();
		});
	});

	describe("findCustomerByEmail", () => {
		test("returns the first matching customer", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let customer = await polar.findCustomerByEmail("jane@example.com");
			expect<Partial<Customer> | null>(customer).toEqual({ id: "cus_1" });
			expect(calls["customers.list"]).toEqual([{ email: "jane@example.com" }]);
		});

		test("returns null when no customer matches", async () => {
			listCustomersImpl = () => [];
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.findCustomerByEmail("nobody@example.com")).toBeNull();
		});
	});

	test("getSubscription looks up by id", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		let sub = await polar.getSubscription("sub_1");
		expect(sub).toMatchObject({ id: "sub_1", status: "active" });
		expect(calls["subscriptions.get"]).toEqual([{ id: "sub_1" }]);
	});

	test("revokeSubscription revokes by id", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.revokeSubscription("sub_1");
		expect(calls["subscriptions.revoke"]).toEqual([{ id: "sub_1" }]);
	});

	test("listSubscriptions flattens every page", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		let subs = await polar.listSubscriptions("cus_1");
		expect<Partial<Subscription>[]>(subs).toEqual([{ id: "sub_1" }, { id: "sub_2" }]);
		expect(calls["subscriptions.list"]).toEqual([{ customerId: "cus_1" }]);
	});

	describe("hasActiveSubscription", () => {
		test("returns true when an active subscription matches the product id", async () => {
			subscriptionsListImpl = () => [[{ id: "sub_1", productId: "prod_1" }]];
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.hasActiveSubscription("ext_1", "prod_1")).toBe(true);
			expect(calls["subscriptions.list"]).toEqual([{ externalCustomerId: "ext_1", active: true }]);
		});

		test("returns false when no subscription matches the product id", async () => {
			subscriptionsListImpl = () => [[{ id: "sub_1", productId: "prod_other" }]];
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.hasActiveSubscription("ext_1", "prod_1")).toBe(false);
		});

		test("returns false instead of throwing when the request fails", async () => {
			subscriptionsListImpl = () => {
				throw new Error("network error");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.hasActiveSubscription("ext_1", "prod_1")).toBe(false);
		});
	});

	describe("listActiveSubscriptions", () => {
		test("queries by external id and active:true, filtering to the given product", async () => {
			subscriptionsListImpl = () => [
				[
					{ id: "sub_1", productId: "prod_1" },
					{ id: "sub_2", productId: "prod_other" },
				],
				[{ id: "sub_3", productId: "prod_1" }],
			];
			let polar = new PolarClient({ accessToken: "t" });
			let subscriptions = await polar.listActiveSubscriptions("ext_1", "prod_1");
			expect<Partial<Subscription>[]>(subscriptions).toEqual([
				{ id: "sub_1", productId: "prod_1" },
				{ id: "sub_3", productId: "prod_1" },
			]);
			expect(calls["subscriptions.list"]).toEqual([{ externalCustomerId: "ext_1", active: true }]);
		});

		test("throws when the request fails", async () => {
			subscriptionsListImpl = () => {
				throw new Error("network error");
			};
			let polar = new PolarClient({ accessToken: "t" });
			await expect(polar.listActiveSubscriptions("ext_1", "prod_1")).rejects.toThrow(
				"network error",
			);
		});
	});

	describe("listActiveSubscriptionsByProduct", () => {
		test("queries by product and active:true, flattening every page", async () => {
			subscriptionsListImpl = () => [[{ id: "sub_1" }], [{ id: "sub_2" }]];
			let polar = new PolarClient({ accessToken: "t" });

			let subscriptions = await polar.listActiveSubscriptionsByProduct("prod_1");

			expect<Partial<Subscription>[]>(subscriptions).toEqual([{ id: "sub_1" }, { id: "sub_2" }]);
			expect(calls["subscriptions.list"]).toEqual([{ productId: "prod_1", active: true }]);
		});
	});

	test("getProduct looks up by id", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		let product = await polar.getProduct("prod_1");
		expect(product).toMatchObject({ id: "prod_1", name: "Complete" });
		expect(calls["products.get"]).toEqual([{ id: "prod_1" }]);
	});

	describe("listDiscounts", () => {
		test("flattens every page and defaults the limit to 12", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let discounts = await polar.listDiscounts();
			expect<Partial<Discount>[]>(discounts).toEqual([{ id: "disc_1" }, { id: "disc_2" }]);
			expect(calls["discounts.list"]).toEqual([{ limit: 12 }]);
		});

		test("forwards an explicit limit", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.listDiscounts(50);
			expect(calls["discounts.list"]).toEqual([{ limit: 50 }]);
		});

		test("throws when the request fails", async () => {
			discountsListImpl = () => {
				throw new Error("network error");
			};
			let polar = new PolarClient({ accessToken: "t" });
			await expect(polar.listDiscounts()).rejects.toThrow("network error");
		});
	});

	describe("listOrders", () => {
		test("forwards the customer/product filters and flattens every page", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let orders = await polar.listOrders({ customerId: "cus_1", productId: "prod_1" });
			expect<Partial<Order>[]>(orders).toEqual([{ id: "ord_1" }, { id: "ord_2" }]);
			expect(calls["orders.list"]).toEqual([{ customerId: "cus_1", productId: "prod_1" }]);
		});

		test("sends undefined for omitted filters", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.listOrders({});
			expect(calls["orders.list"]).toEqual([{ customerId: undefined, productId: undefined }]);
		});

		test("returns an empty array when there are no orders", async () => {
			ordersListImpl = () => [[]];
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.listOrders({ customerId: "cus_1" })).toEqual([]);
		});
	});

	describe("createCheckoutSession", () => {
		test("wraps productId in a products array and returns the url", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let result = await polar.createCheckoutSession("prod_1", "cus_1", "https://app/ok", {
				account_id: "a_1",
			});
			expect(result).toEqual({ url: "https://polar.sh/checkout/1" });
			expect(calls["checkouts.create"]).toEqual([
				{
					products: ["prod_1"],
					customerId: "cus_1",
					successUrl: "https://app/ok",
					metadata: { account_id: "a_1" },
				},
			]);
		});

		test("defaults metadata to an empty object", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.createCheckoutSession("prod_1", "cus_1", "https://app/ok");
			expect(calls["checkouts.create"]).toEqual([
				{
					products: ["prod_1"],
					customerId: "cus_1",
					successUrl: "https://app/ok",
					metadata: {},
				},
			]);
		});

		test("allows an undefined customerId (Polar creates the customer)", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.createCheckoutSession("prod_1", undefined, "https://app/ok", {
				account_id: "a_1",
			});
			expect(calls["checkouts.create"]).toEqual([
				{
					products: ["prod_1"],
					customerId: undefined,
					successUrl: "https://app/ok",
					metadata: { account_id: "a_1" },
				},
			]);
		});
	});

	describe("createCheckout", () => {
		test("forwards every option and returns url + id", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let result = await polar.createCheckout({
				productId: "prod_1",
				customerId: "cus_1",
				customerEmail: "jane@example.com",
				discountId: "disc_1",
				allowDiscountCodes: false,
				successUrl: "https://app/ok",
				metadata: { account_id: "a_1" },
			});
			expect(result).toEqual({ url: "https://polar.sh/checkout/1", id: "chk_1" });
			expect(calls["checkouts.create"]).toEqual([
				{
					products: ["prod_1"],
					customerId: "cus_1",
					customerEmail: "jane@example.com",
					discountId: "disc_1",
					allowDiscountCodes: false,
					successUrl: "https://app/ok",
					metadata: { account_id: "a_1" },
				},
			]);
		});

		test("maps a null customerEmail to undefined and defaults metadata", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.createCheckout({
				productId: "prod_1",
				customerEmail: null,
				allowDiscountCodes: true,
			});
			expect(calls["checkouts.create"]).toEqual([
				{
					products: ["prod_1"],
					customerId: undefined,
					customerEmail: undefined,
					discountId: undefined,
					allowDiscountCodes: true,
					successUrl: undefined,
					metadata: {},
				},
			]);
		});
	});

	test("createPortalSession returns the customer portal url", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		let result = await polar.createPortalSession("cus_1");
		expect(result).toEqual({ url: "https://polar.sh/portal/1" });
		expect(calls["customerSessions.create"]).toEqual([{ customerId: "cus_1" }]);
	});

	test("ingestEvents maps each event to the SDK shape", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		let when = new Date("2026-07-04T00:00:00.000Z");
		await polar.ingestEvents([
			{ customerId: "cus_1", name: "mau", metadata: { count: 3 }, timestamp: when },
		]);
		expect(calls["events.ingest"]).toEqual([
			{
				events: [
					{
						customerId: "cus_1",
						name: "mau",
						metadata: { count: 3 },
						timestamp: when,
						externalId: undefined,
					},
				],
			},
		]);
	});

	test("ingestEvents forwards externalId to the SDK for deduplication", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.ingestEvents([
			{ customerId: "cus_1", name: "page_views", metadata: { views: 5 }, externalId: "dedupe-1" },
		]);
		expect(calls["events.ingest"]).toEqual([
			{
				events: [
					{
						customerId: "cus_1",
						name: "page_views",
						metadata: { views: 5 },
						timestamp: undefined,
						externalId: "dedupe-1",
					},
				],
			},
		]);
	});

	test("ingestEvents keys on externalCustomerId when that is the id given", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.ingestEvents([{ externalCustomerId: "owner-1", name: "infra.cost.daily" }]);
		/**
		 * `customerId` must be absent, not undefined: the SDK picks the payload
		 * variant from which field is present, and sending both is a
		 * validation error.
		 */
		expect(calls["events.ingest"]).toEqual([
			{
				events: [
					{
						externalCustomerId: "owner-1",
						name: "infra.cost.daily",
						metadata: undefined,
						timestamp: undefined,
						externalId: undefined,
					},
				],
			},
		]);
	});

	test("ingestEvents nests cost under the _cost metadata key Cost Insights reads", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.ingestEvents([
			{
				externalCustomerId: "owner-1",
				name: "infra.cost.daily",
				metadata: { team_id: "team-1" },
				cost: { amount: "0.003476700", currency: "usd" },
			},
		]);
		let [call] = calls["events.ingest"] as { events: { metadata: unknown }[] }[];
		expect(call?.events[0]?.metadata).toEqual({
			team_id: "team-1",
			/** A string, because `(1e-7).toString()` is `"1e-7"` and Polar cannot parse that. */
			_cost: { amount: "0.003476700", currency: "usd" },
		});
	});

	test("ingestEvents throws when an event identifies no customer", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await expect(polar.ingestEvents([{ name: "infra.cost.daily" }])).rejects.toThrow(
			/names neither a customerId nor an externalCustomerId/,
		);
	});

	test("ingestEvents splits more than 100 events across requests", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		let events = Array.from({ length: 250 }, (_unused, index) => ({
			externalCustomerId: `owner-${index}`,
			name: "infra.cost.daily",
		}));

		await polar.ingestEvents(events);

		let requests = calls["events.ingest"] as { events: unknown[] }[];
		expect(requests.map((request) => request.events.length)).toEqual([100, 100, 50]);
	});

	describe("ingestEventsSafe", () => {
		test("returns true when every chunk is accepted", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.ingestEventsSafe([{ customerId: "cus_1", name: "e" }])).toBe(true);
		});

		test("returns false instead of throwing so a cron can retry on its next run", async () => {
			ingestImpl = () => {
				throw new Error("boom");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.ingestEventsSafe([{ customerId: "cus_1", name: "e" }])).toBe(false);
		});
	});

	test("reportMAU emits a single mau event with tenant_id/month/count", async () => {
		let polar = new PolarClient({ accessToken: "t" });
		await polar.reportMAU("cus_1", 1200, "t_1", "2026-07");
		expect(calls["events.ingest"]).toEqual([
			{
				events: [
					{
						customerId: "cus_1",
						name: "mau",
						metadata: { tenant_id: "t_1", month: "2026-07", count: 1200 },
						timestamp: undefined,
						externalId: undefined,
					},
				],
			},
		]);
	});

	describe("ingestPageViews", () => {
		test("emits a page_views event and returns true on success", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let ok = await polar.ingestPageViews("cus_1", 42, "2026-07-04");
			expect(ok).toBe(true);
			expect(calls["events.ingest"]).toEqual([
				{
					events: [
						{
							customerId: "cus_1",
							name: "page_views",
							metadata: { views: 42, day: "2026-07-04" },
							timestamp: undefined,
							externalId: undefined,
						},
					],
				},
			]);
		});

		test("forwards a deterministic externalId so retries are deduplicated", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let ok = await polar.ingestPageViews(
				"cus_1",
				42,
				"2026-07-04",
				"page_views:blog-1:2026-07-04",
			);
			expect(ok).toBe(true);
			expect(calls["events.ingest"]).toEqual([
				{
					events: [
						{
							customerId: "cus_1",
							name: "page_views",
							metadata: { views: 42, day: "2026-07-04" },
							timestamp: undefined,
							externalId: "page_views:blog-1:2026-07-04",
						},
					],
				},
			]);
		});

		test("returns false instead of throwing when ingestion fails", async () => {
			ingestImpl = () => {
				throw new Error("boom");
			};
			let polar = new PolarClient({ accessToken: "t" });
			let ok = await polar.ingestPageViews("cus_1", 42, "2026-07-04");
			expect(ok).toBe(false);
		});
	});

	describe("verifyWebhook", () => {
		test("returns false when the secret is empty (fails closed)", async () => {
			let { request, body } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(request, body, "")).toBe(false);
		});

		test("returns true for a valid signature", async () => {
			let { request, body } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(request, body, WEBHOOK_SECRET)).toBe(true);
		});

		test("returns false when the body was changed after signing", async () => {
			let { request } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(request, `${WEBHOOK_BODY} `, WEBHOOK_SECRET)).toBe(false);
		});

		test("returns false when the signature was tampered with", async () => {
			let headers = await signLikePolar();
			headers["webhook-signature"] = `v1,${btoa("not the mac at all")}`;
			let polar = new PolarClient({ accessToken: "t" });
			let request = new Request("https://app/webhook", { method: "POST", headers });
			expect(await polar.verifyWebhook(request, WEBHOOK_BODY, WEBHOOK_SECRET)).toBe(false);
		});

		test("returns false for a timestamp outside the tolerance (replay)", async () => {
			let stale = Math.floor(Date.now() / 1000) - 10 * 60;
			let { request, body } = await delivery({ timestamp: stale });
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(request, body, WEBHOOK_SECRET)).toBe(false);
		});

		test("returns false when the delivery was signed with another secret", async () => {
			let { request, body } = await delivery({ secret: "some_other_secret" });
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(request, body, WEBHOOK_SECRET)).toBe(false);
		});

		test("returns false when a signature header is missing", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			for (let missing of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
				let headers = await signLikePolar();
				delete headers[missing];
				let request = new Request("https://app/webhook", { method: "POST", headers });
				expect(await polar.verifyWebhook(request, WEBHOOK_BODY, WEBHOOK_SECRET)).toBe(false);
			}
		});

		test("returns true when the signature is valid but the body is unmodelled", async () => {
			let { request, body } = await delivery({ body: '{"type":"nothing.models.this"}' });
			let polar = new PolarClient({ accessToken: "t" });
			/** The security boundary passed; typing the payload is the caller's problem. */
			expect(await polar.verifyWebhook(request, body, WEBHOOK_SECRET)).toBe(true);
		});

		test("returns true when the signature is valid but the body is not JSON at all", async () => {
			let { request, body } = await delivery({ body: "not json" });
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(request, body, WEBHOOK_SECRET)).toBe(true);
		});

		test("never loads the vendor SDK, because verification no longer needs it", async () => {
			let { request, body } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });
			await polar.verifyWebhook(request, body, WEBHOOK_SECRET);
			expect(calls["new"]).toBeUndefined();
			expect(validateEventCalls).toHaveLength(0);
		});
	});

	describe("parseWebhook", () => {
		test("returns the validated event on success", async () => {
			validateEventImpl = () => ({ type: "order.paid", data: { id: "ord_1" } });
			let { request, body } = await delivery({ id: "wh_7" });
			let polar = new PolarClient({ accessToken: "t" });

			let result = await polar.parseWebhook(request, body, WEBHOOK_SECRET);

			expect(result.status).toBe("success");
			if (result.status !== "success") throw new Error("expected success");
			expect(result.data).toMatchObject({ type: "order.paid", data: { id: "ord_1" } });
		});

		test("forwards the raw body, flattened headers and secret to the parser", async () => {
			let { request, body } = await delivery({ id: "wh_7" });
			let polar = new PolarClient({ accessToken: "t" });

			await polar.parseWebhook(request, body, WEBHOOK_SECRET);

			expect(validateEventCalls).toHaveLength(1);
			expect(validateEventCalls[0]!.body).toBe(body);
			expect(validateEventCalls[0]!.secret).toBe(WEBHOOK_SECRET);
			expect(validateEventCalls[0]!.headers["webhook-id"]).toBe("wh_7");
		});

		test("fails closed without any signature work when the secret is missing", async () => {
			let { request, body } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });

			let result = await polar.parseWebhook(request, body, undefined);

			expect(result.status).toBe("failure");
			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).toBe("Missing Polar webhook secret");
			expect(validateEventCalls).toHaveLength(0);
		});

		test("fails with a signature error, and never reaches the parser, for a bad signature", async () => {
			let { request } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });

			let result = await polar.parseWebhook(request, `${WEBHOOK_BODY} `, WEBHOOK_SECRET);

			expect(result.status).toBe("failure");
			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).toBe("Invalid Polar webhook signature");
			expect(validateEventCalls).toHaveLength(0);
		});

		test("fails with a payload error when the parser cannot type the event", async () => {
			validateEventImpl = () => {
				throw new MockSDKValidationError("Unknown event type");
			};
			let { request, body } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });

			let result = await polar.parseWebhook(request, body, WEBHOOK_SECRET);

			expect(result.status).toBe("failure");
			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).toBe("Invalid Polar webhook payload: Unknown event type");
		});

		test("never puts the signature or the secret on a failure", async () => {
			let { request } = await delivery();
			let polar = new PolarClient({ accessToken: "t" });

			let result = await polar.parseWebhook(request, `${WEBHOOK_BODY} `, WEBHOOK_SECRET);

			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).not.toContain(WEBHOOK_SECRET);
			expect(result.error.message).not.toContain(request.headers.get("webhook-signature"));
		});
	});

	/**
	 * WebhookVerificationError is deliberately type-only: its module is the
	 * schema-heavy webhook parser, so re-exporting the class would undo the
	 * lazy SDK load.
	 */
	test("re-exports PolarError as a value", () => {
		expect(typeof PolarError).toBe("function");
	});
});

/**
 * ADR-026 requires the SDK's verifier and `verifyWebhook` to reach the same
 * accept/reject verdict on identical bytes, since a silent mismatch would
 * reject legitimate billing events. Fixtures are signed independently.
 */
describe("webhook verification cross-check against the vendor SDK", () => {
	/**
	 * Runs one delivery through both implementations and returns the two verdicts,
	 * so a test only has to say what it expects them to agree on.
	 */
	async function verdicts(
		headers: Record<string, string>,
		body: string,
		secret: string = WEBHOOK_SECRET,
	): Promise<{ sdk: boolean; pkg: boolean }> {
		let request = new Request("https://app/webhook", { method: "POST", headers });
		let polar = new PolarClient({ accessToken: "t" });
		return {
			sdk: sdkSaysAuthentic(body, headers, secret),
			pkg: await polar.verifyWebhook(request, body, secret),
		};
	}

	test("both accept a delivery signed the way Polar signs", async () => {
		let headers = await signLikePolar();
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: true, pkg: true });
	});

	test("both accept an authentic body neither can model", async () => {
		/**
		 * The distinction ADR-026 preserves: the signature authenticates the
		 * delivery, independent of whether the event type here is recognized.
		 */
		let body = '{"type":"nothing.models.this","data":{}}';
		let headers = await signLikePolar({ body });
		expect(await verdicts(headers, body)).toEqual({ sdk: true, pkg: true });
	});

	test("both accept an authentic body that is not JSON", async () => {
		let body = "not json at all";
		let headers = await signLikePolar({ body });
		expect(await verdicts(headers, body)).toEqual({ sdk: true, pkg: true });
	});

	test("both accept a good signature presented beside an unreadable one", async () => {
		/**
		 * During secret rotation, a sender may present multiple space-separated
		 * signature schemes; the scheme actually read stays authoritative
		 * alongside the others.
		 */
		let headers = await signLikePolar();
		headers["webhook-signature"] = `v1a,AAAA ${headers["webhook-signature"]}`;
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: true, pkg: true });
	});

	test("both reject a body changed after signing", async () => {
		let headers = await signLikePolar();
		expect(await verdicts(headers, `${WEBHOOK_BODY} `)).toEqual({ sdk: false, pkg: false });
	});

	test("both reject a tampered signature", async () => {
		let headers = await signLikePolar();
		headers["webhook-signature"] = `v1,${btoa("this is not the mac")}`;
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: false, pkg: false });
	});

	test("both reject a delivery id the signature did not cover", async () => {
		let headers = await signLikePolar();
		headers["webhook-id"] = "wh_someone_elses";
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: false, pkg: false });
	});

	test("both reject a stale timestamp", async () => {
		let headers = await signLikePolar({ timestamp: Math.floor(Date.now() / 1000) - 10 * 60 });
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: false, pkg: false });
	});

	test("both reject a timestamp too far in the future", async () => {
		let headers = await signLikePolar({ timestamp: Math.floor(Date.now() / 1000) + 10 * 60 });
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: false, pkg: false });
	});

	test("both reject a delivery signed with a different secret", async () => {
		let headers = await signLikePolar({ secret: "some_other_secret" });
		expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: false, pkg: false });
	});

	test("both reject a delivery missing any one of the three headers", async () => {
		for (let missing of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
			let headers = await signLikePolar();
			delete headers[missing];
			expect(await verdicts(headers, WEBHOOK_BODY)).toEqual({ sdk: false, pkg: false });
		}
	});

	test("`Webhooks.sign()` reproduces the header a Polar sender produces", async () => {
		/**
		 * Pins secret handling for signing too: `@pkg/webhooks` keys on the
		 * base64-decoded secret, so Polar's plain-text secret must be
		 * re-encoded as base64 before being handed to the package.
		 */
		let id = "wh_pinned";
		let timestamp = 1614265330;
		let expected = await signLikePolar({ id, timestamp });

		let signed = await Webhooks.sign(WEBHOOK_BODY, {
			secret: btoa(WEBHOOK_SECRET),
			id,
			timestamp,
		});

		if (signed.status !== "success") throw new Error("expected the delivery to sign");
		expect(Object.fromEntries(signed.data.headers.entries())).toEqual(expected);
	});

	test("verifying against the raw, undecoded secret would reject a genuine delivery", async () => {
		/**
		 * Polar's secret is arbitrary text; handing it to a Standard Webhooks
		 * verifier unchanged keys on the wrong bytes and rejects every
		 * legitimate billing event.
		 */
		let headers = await signLikePolar();
		let request = new Request("https://app/webhook", { method: "POST", headers });

		let result = await Webhooks.verify(request, { secret: WEBHOOK_SECRET });

		expect(result.status).toBe("failure");
		if (result.status !== "failure") throw new Error("expected failure");
		expect(result.error).toBeInstanceOf(Webhooks.SignatureMismatchError);
	});
});

describe("isActiveSubscriptionStatus", () => {
	test("counts exactly the statuses Polar's own active filter returns", () => {
		expect(ACTIVE_SUBSCRIPTION_STATUSES).toEqual(["active", "trialing"]);
		expect(isActiveSubscriptionStatus("active")).toBe(true);
		expect(isActiveSubscriptionStatus("trialing")).toBe(true);
	});

	test("rejects every other status, `canceled` included", () => {
		for (let status of ["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired"]) {
			expect(isActiveSubscriptionStatus(status)).toBe(false);
		}
	});
});

describe("subscriptionFromEvent", () => {
	/**
	 * Events are built by round-tripping through `parseWebhook`, the way a
	 * real caller obtains one. The union spans 35 payload types, too wide
	 * for a literal without a cast.
	 */
	async function parse(event: { type: string; data: unknown }) {
		validateEventImpl = () => event;
		let { request, body } = await delivery();
		let polar = new PolarClient({ accessToken: "t" });
		let result = await polar.parseWebhook(request, body, WEBHOOK_SECRET);
		if (result.status !== "success") throw new Error("expected success");
		return result.data;
	}

	test("returns the subscription for every subscription lifecycle event", async () => {
		let types = [
			"subscription.created",
			"subscription.updated",
			"subscription.active",
			"subscription.canceled",
			"subscription.uncanceled",
			"subscription.past_due",
			"subscription.revoked",
		];

		for (let type of types) {
			expect<Partial<Subscription> | null>(
				subscriptionFromEvent(await parse({ type, data: { id: "sub_1" } })),
			).toEqual({
				id: "sub_1",
			});
		}
	});

	test("returns null for events carrying something else", async () => {
		expect(
			subscriptionFromEvent(await parse({ type: "order.paid", data: { id: "ord_1" } })),
		).toBeNull();
		expect(
			subscriptionFromEvent(await parse({ type: "checkout.updated", data: { id: "chk_1" } })),
		).toBeNull();
	});
});
