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
						yield { result: { items: [{ id: "sub_1" }] } };
						yield { result: { items: [{ id: "sub_2" }] } };
					},
				};
			},
		};
		checkouts = {
			create: async (arg: unknown) => {
				record("checkouts.create", arg);
				return { url: "https://polar.sh/checkout/1" };
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

// Import after mocks are registered so the client picks up the fakes.
let { PolarClient, PolarError, WebhookVerificationError } = await import("./index.ts");

afterEach(() => {
	calls = Object.create(null);
	validateEventCalls = [];
	validateEventImpl = () => ({ type: "checkout.updated" });
	ingestImpl = () => ({});
	getExternalImpl = () => ({ id: "cus_1" });
	listCustomersImpl = () => [{ id: "cus_1" }];
});

describe("PolarClient", () => {
	test("constructs the SDK with the given access token", () => {
		new PolarClient({ accessToken: "polar_at_test" });
		expect(calls["new"]).toEqual([{ accessToken: "polar_at_test" }]);
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

		test("returns false when the secret is empty (fails closed)", () => {
			let polar = new PolarClient({ accessToken: "t" });
			expect(polar.verifyWebhook(req({}), "{}", "")).toBe(false);
			expect(validateEventCalls).toHaveLength(0);
		});

		test("forwards the raw body, flattened headers and secret to validateEvent", () => {
			let polar = new PolarClient({ accessToken: "t" });
			polar.verifyWebhook(req({ "webhook-id": "wh_1" }), "raw-body", "whsec_1");
			expect(validateEventCalls).toHaveLength(1);
			expect(validateEventCalls[0]!.body).toBe("raw-body");
			expect(validateEventCalls[0]!.secret).toBe("whsec_1");
			expect(validateEventCalls[0]!.headers["webhook-id"]).toBe("wh_1");
		});

		test("returns true for a valid signature", () => {
			let polar = new PolarClient({ accessToken: "t" });
			expect(polar.verifyWebhook(req({}), "{}", "whsec_1")).toBe(true);
		});

		test("returns false for a WebhookVerificationError (bad signature)", () => {
			validateEventImpl = () => {
				throw new MockWebhookVerificationError("bad signature");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(polar.verifyWebhook(req({}), "{}", "whsec_1")).toBe(false);
		});

		test("returns true when the signature is valid but the event is unmodeled", () => {
			validateEventImpl = () => {
				throw new MockSDKValidationError("Unknown event type");
			};
			let polar = new PolarClient({ accessToken: "t" });
			expect(polar.verifyWebhook(req({}), "{}", "whsec_1")).toBe(true);
		});
	});

	test("re-exports PolarError and WebhookVerificationError", () => {
		expect(typeof PolarError).toBe("function");
		expect(typeof WebhookVerificationError).toBe("function");
	});
});
