import { afterEach, describe, expect, mock, test } from "bun:test";

// The webhooks module ships its own WebhookVerificationError; re-declare a matching
// shape here so the mocked module can throw instances the client recognises.
class MockWebhookVerificationError extends Error {}
class MockSDKValidationError extends Error {}

// Captures the last arguments passed to validateEvent so tests can assert on them,
// plus a controllable behaviour for the mocked verifier.
let validateEventCalls: Array<{ body: string; headers: Record<string, string>; secret: string }> =
	[];
let validateEventImpl: (
	body: string,
	headers: Record<string, string>,
	secret: string,
) => unknown = () => ({ type: "checkout.updated" });

mock.module("@polar-sh/sdk/webhooks.js", () => ({
	WebhookVerificationError: MockWebhookVerificationError,
	validateEvent: (body: string, headers: Record<string, string>, secret: string) => {
		validateEventCalls.push({ body, headers, secret });
		return validateEventImpl(body, headers, secret);
	},
}));

mock.module("@polar-sh/sdk/models/errors/polarerror.js", () => ({
	PolarError: class PolarError extends Error {},
}));

// A recording fake of the pieces of the Polar SDK the client touches. Each method
// records its input and returns a canned response.
// Use a null-prototype object so recorded keys (e.g. "new") never collide with
// inherited members like Object.prototype.constructor.
let calls: Record<string, unknown[]> = Object.create(null);
function record(method: string, arg: unknown) {
	(calls[method] ??= []).push(arg);
}

let ingestImpl: () => unknown = () => ({});
let getExternalImpl: () => unknown = () => ({ id: "cus_1" });
let listCustomersImpl: () => unknown[] = () => [{ id: "cus_1" }];
let subscriptionsListImpl: () => unknown[][] = () => [[{ id: "sub_1" }], [{ id: "sub_2" }]];
let meterQuantitiesImpl: () => unknown = () => ({ quantities: [], total: 42 });
let discountsListImpl: () => unknown[][] = () => [[{ id: "disc_1" }], [{ id: "disc_2" }]];
let ordersListImpl: () => unknown[][] = () => [[{ id: "ord_1" }], [{ id: "ord_2" }]];

mock.module("@polar-sh/sdk", () => ({
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
				// Async-iterable of pages, mirroring the SDK's paginated response.
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
		meters = {
			quantities: async (arg: unknown) => {
				record("meters.quantities", arg);
				return meterQuantitiesImpl();
			},
		};
	},
}));

// Import after mocks are registered so the client picks up the fakes.
let {
	ACTIVE_SUBSCRIPTION_STATUSES,
	isActiveSubscriptionStatus,
	PolarClient,
	PolarError,
	subscriptionFromEvent,
} = await import("./index.ts");

afterEach(() => {
	calls = Object.create(null);
	validateEventCalls = [];
	validateEventImpl = () => ({ type: "checkout.updated" });
	ingestImpl = () => ({});
	getExternalImpl = () => ({ id: "cus_1" });
	listCustomersImpl = () => [{ id: "cus_1" }];
	subscriptionsListImpl = () => [[{ id: "sub_1" }], [{ id: "sub_2" }]];
	meterQuantitiesImpl = () => ({ quantities: [], total: 42 });
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

	describe("createCustomer", () => {
		test("passes email/name/metadata through", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let customer = await polar.createCustomer("jane@example.com", "Jane", { tenant_id: "t_1" });
			expect(customer).toEqual({ id: "cus_1" });
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
			expect(customer).toEqual({ id: "cus_1" });
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
			expect(customer).toEqual({ id: "cus_1" });
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
		expect(subs).toEqual([{ id: "sub_1" }, { id: "sub_2" }]);
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
			expect(subscriptions).toEqual([
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

			expect(subscriptions).toEqual([{ id: "sub_1" }, { id: "sub_2" }]);
			expect(calls["subscriptions.list"]).toEqual([{ productId: "prod_1", active: true }]);
		});
	});

	describe("getMeterUsage", () => {
		test("queries the meter by external id, date range, and metadata, returning the total", async () => {
			meterQuantitiesImpl = () => ({
				quantities: [{ timestamp: "2026-07-01", quantity: 42 }],
				total: 42,
			});
			let polar = new PolarClient({ accessToken: "t" });
			let start = new Date("2026-07-01T00:00:00.000Z");
			let end = new Date("2026-07-31T23:59:59.999Z");

			let total = await polar.getMeterUsage(
				"ext_1",
				"meter_1",
				{ start, end },
				{ teamId: "team_1" },
			);

			expect(total).toBe(42);
			expect(calls["meters.quantities"]).toEqual([
				{
					externalCustomerId: "ext_1",
					startTimestamp: start,
					endTimestamp: end,
					interval: "month",
					id: "meter_1",
					metadata: { teamId: "team_1" },
				},
			]);
		});

		test("defaults metadata to an empty object", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let start = new Date("2026-07-01T00:00:00.000Z");
			let end = new Date("2026-07-31T23:59:59.999Z");

			await polar.getMeterUsage("ext_1", "meter_1", { start, end });

			expect(calls["meters.quantities"]).toEqual([
				{
					externalCustomerId: "ext_1",
					startTimestamp: start,
					endTimestamp: end,
					interval: "month",
					id: "meter_1",
					metadata: {},
				},
			]);
		});

		test("throws when the request fails", async () => {
			meterQuantitiesImpl = () => {
				throw new Error("network error");
			};
			let polar = new PolarClient({ accessToken: "t" });
			let start = new Date("2026-07-01T00:00:00.000Z");
			let end = new Date("2026-07-31T23:59:59.999Z");

			await expect(polar.getMeterUsage("ext_1", "meter_1", { start, end })).rejects.toThrow(
				"network error",
			);
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
			expect(discounts).toEqual([{ id: "disc_1" }, { id: "disc_2" }]);
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
			expect(orders).toEqual([{ id: "ord_1" }, { id: "ord_2" }]);
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
		// `customerId` must be absent, not undefined: the SDK picks the payload variant from
		// which field is present, and sending both is a validation error.
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
			// A string, because `(1e-7).toString()` is `"1e-7"` and Polar cannot parse that.
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
		function req(headers: Record<string, string>): Request {
			return new Request("https://app/webhook", { method: "POST", headers });
		}

		test("returns false when the secret is empty (fails closed)", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(req({}), "{}", "")).toBe(false);
			expect(validateEventCalls).toHaveLength(0);
		});

		test("forwards the raw body, flattened headers and secret to validateEvent", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			await polar.verifyWebhook(req({ "webhook-id": "wh_1" }), "raw-body", "whsec_1");
			expect(validateEventCalls).toHaveLength(1);
			expect(validateEventCalls[0]!.body).toBe("raw-body");
			expect(validateEventCalls[0]!.secret).toBe("whsec_1");
			expect(validateEventCalls[0]!.headers["webhook-id"]).toBe("wh_1");
		});

		test("returns true for a valid signature", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(req({}), "{}", "whsec_1")).toBe(true);
		});

		test("returns false for a WebhookVerificationError (bad signature)", async () => {
			validateEventImpl = () => {
				throw new MockWebhookVerificationError("bad signature");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(req({}), "{}", "whsec_1")).toBe(false);
		});

		test("returns true when the signature is valid but the event is unmodeled", async () => {
			validateEventImpl = () => {
				throw new MockSDKValidationError("Unknown event type");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(await polar.verifyWebhook(req({}), "{}", "whsec_1")).toBe(true);
		});
	});

	describe("parseWebhook", () => {
		function req(headers: Record<string, string>): Request {
			return new Request("https://app/webhook", { method: "POST", headers });
		}

		test("returns the validated event on success", async () => {
			validateEventImpl = () => ({ type: "order.paid", data: { id: "ord_1" } });
			let polar = new PolarClient({ accessToken: "t" });
			let result = await polar.parseWebhook(req({ "webhook-id": "wh_1" }), "raw-body", "whsec_1");
			expect(result.status).toBe("success");
			if (result.status !== "success") throw new Error("expected success");
			expect(result.data).toEqual({ type: "order.paid", data: { id: "ord_1" } });
			expect(validateEventCalls).toHaveLength(1);
			expect(validateEventCalls[0]!.body).toBe("raw-body");
			expect(validateEventCalls[0]!.secret).toBe("whsec_1");
			expect(validateEventCalls[0]!.headers["webhook-id"]).toBe("wh_1");
		});

		test("fails closed without calling the verifier when the secret is missing", async () => {
			let polar = new PolarClient({ accessToken: "t" });
			let result = await polar.parseWebhook(req({}), "{}", undefined);
			expect(result.status).toBe("failure");
			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).toBe("Missing Polar webhook secret");
			expect(validateEventCalls).toHaveLength(0);
		});

		test("fails with a signature error for a WebhookVerificationError", async () => {
			validateEventImpl = () => {
				throw new MockWebhookVerificationError("bad signature");
			};
			let polar = new PolarClient({ accessToken: "t" });
			let result = await polar.parseWebhook(req({}), "{}", "whsec_1");
			expect(result.status).toBe("failure");
			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).toBe("Invalid Polar webhook signature");
		});

		test("fails with a payload error for an SDK validation error", async () => {
			validateEventImpl = () => {
				throw new MockSDKValidationError("Unknown event type");
			};
			let polar = new PolarClient({ accessToken: "t" });
			let result = await polar.parseWebhook(req({}), "{}", "whsec_1");
			expect(result.status).toBe("failure");
			if (result.status !== "failure") throw new Error("expected failure");
			expect(result.error.message).toBe("Invalid Polar webhook payload: Unknown event type");
		});
	});

	// WebhookVerificationError is deliberately type-only: its module is the schema-heavy
	// webhook parser, so re-exporting the class would undo the lazy SDK load.
	test("re-exports PolarError as a value", () => {
		expect(typeof PolarError).toBe("function");
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
	 * Events are built by round-tripping through `parseWebhook` rather than as object
	 * literals: that is where a real caller gets one, and the union is 35 payload types
	 * wide, so a literal would need a cast to stand in for any of them.
	 */
	async function parse(event: { type: string; data: unknown }) {
		validateEventImpl = () => event;
		let polar = new PolarClient({ accessToken: "t" });
		let result = await polar.parseWebhook(
			new Request("https://app/webhook", { method: "POST" }),
			"{}",
			"whsec_1",
		);
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
			expect(subscriptionFromEvent(await parse({ type, data: { id: "sub_1" } }))).toEqual({
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
