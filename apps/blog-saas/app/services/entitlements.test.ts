/**
 * Unit tests for the entitlement sync: a paid checkout projects the customer link,
 * the subscription row, and an active fan-out; a cancelled subscription suspends the
 * blogs; and a snapshot naming an account we do not hold writes nothing. Driven
 * against a full in-memory billing platform rather than a stubbed client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MemoryBilling as MemoryBillingType } from "@sdxc/billing/providers/memory";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { createEnv } from "@sdxc/cloudflare-mocks";
import { unwrap } from "@sdxc/result";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { BlogFanOut } from "~/app/services/entitlements";
import type { TestDatabase } from "~/app/test/db";

/** Precedes the dynamic imports below, since the billing module reads `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		POLAR_ACCESS_TOKEN: "polar-token",
		POLAR_PRODUCT_ID: "prod_configured",
	}),
	DurableObject: class {},
}));

let { createTestDatabase } = await import("~/app/test/db");
let Account = (await import("~/app/models/account")).default;
let BillingCustomer = (await import("~/app/models/billing-customer")).default;
let Subscription = (await import("~/app/models/subscription")).default;
let { blogStatusFor, entitlingSubscription, projectStatus, syncEntitlements } =
	await import("./entitlements");

let harness: TestDatabase;
let billing: MemoryBillingType;

/** Statuses the fan-out was asked for, in the order it was asked. */
let fannedOut: Array<{ accountId: string; status: "active" | "suspended" }>;

/** Records the verdict instead of reaching the blogs' durable objects. */
const blogs: BlogFanOut = {
	/**
	 * Records one fan-out.
	 *
	 * @param accountId The account whose blogs were addressed.
	 * @param status The verdict the sync reached.
	 */
	async setAccountBlogsStatus(accountId, status) {
		fannedOut.push({ accountId, status });
	},
};

/** A subscription on the platform plan, varied per assertion. */
const SUBSCRIPTION = {
	subscriptionId: "sub_1",
	productSlug: "pro",
	status: "active",
	currentPeriodEnd: null,
	cancelAtPeriodEnd: false,
} as const;

beforeEach(() => {
	harness = createTestDatabase();
	fannedOut = [];
	billing = new MemoryBilling({
		catalog: { pro: { amount: 2900, currency: "usd", interval: "month" } },
	});
});

afterEach(() => {
	harness.sqliteDb.close();
});

/** Seeds an account and sells it the platform subscription, returning both ids. */
async function seedSubscribedAccount(): Promise<{ accountId: string; customerId: string }> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject: "auth0|123",
		email: "jane@example.com",
	});

	let customer = await unwrap(
		billing.customers.create({ email: account.email, externalId: account.id }),
	);
	let opened = await unwrap(
		billing.checkouts.create({ product: "pro", customer: { id: customer.id } }),
	);
	await unwrap(billing.checkouts.finish(opened.id));

	return { accountId: account.id, customerId: customer.id };
}

describe("syncEntitlements", () => {
	test("projects the customer link, the subscription and an active fan-out", async () => {
		let { accountId, customerId } = await seedSubscribedAccount();

		await syncEntitlements(billing, harness.db, blogs, customerId);

		let link = await BillingCustomer.findDefault(harness.db, accountId);
		expect(link?.connection).toBe("memory");
		expect(link?.provider_customer_id).toBe(customerId);

		let subscription = await Subscription.findByAccount(harness.db, accountId);
		expect(subscription?.status).toBe("active");
		expect(subscription?.billing_product_slug).toBe("pro");

		expect(fannedOut).toEqual([{ accountId, status: "active" }]);
	});

	test("suspends the blogs once the subscription is gone", async () => {
		let { accountId, customerId } = await seedSubscribedAccount();
		await syncEntitlements(billing, harness.db, blogs, customerId);

		let held = await unwrap(billing.subscriptions.list({ customer: { id: customerId } }));
		await unwrap(billing.subscriptions.cancel(held.items[0]!.id));

		fannedOut = [];
		await syncEntitlements(billing, harness.db, blogs, customerId);

		expect(await Subscription.findByAccount(harness.db, accountId)).toMatchObject({
			status: "canceled",
		});
		expect(fannedOut).toEqual([{ accountId, status: "suspended" }]);
	});

	test("writes nothing for a customer whose account we do not hold", async () => {
		let customer = await unwrap(
			billing.customers.create({ email: "stranger@example.com", externalId: "account-unknown" }),
		);

		await syncEntitlements(billing, harness.db, blogs, customer.id);

		expect(await BillingCustomer.findDefault(harness.db, "account-unknown")).toBeNull();
		expect(fannedOut).toEqual([]);
	});

	test("does nothing at all when the delivery named no customer", async () => {
		await syncEntitlements(billing, harness.db, blogs, null);

		expect(fannedOut).toEqual([]);
	});
});

describe("projectStatus", () => {
	test("stores a revoked subscription as canceled", () => {
		expect(projectStatus("revoked")).toBe("canceled");
	});

	test("passes every other platform status through unchanged", () => {
		for (let status of ["active", "trialing", "past_due", "canceled", "incomplete"] as const) {
			expect(projectStatus(status)).toBe(status);
		}
	});
});

describe("blogStatusFor", () => {
	test("serves the blogs while the subscription is paid or in trial", () => {
		for (let status of ["active", "trialing"] as const) {
			expect(blogStatusFor({ ...SUBSCRIPTION, status })).toBe("active");
		}
	});

	test("suspends the blogs for every other state, including no subscription", () => {
		for (let status of ["past_due", "canceled", "revoked", "incomplete"] as const) {
			expect(blogStatusFor({ ...SUBSCRIPTION, status })).toBe("suspended");
		}
		expect(blogStatusFor(null)).toBe("suspended");
	});
});

describe("entitlingSubscription", () => {
	test("ignores a subscription for a product that is not the platform plan", () => {
		let state = {
			customerId: "cus_1",
			externalId: "account-1",
			products: ["other"],
			features: {},
			meters: [],
			subscriptions: [{ ...SUBSCRIPTION, productSlug: "other" }],
			readAt: new Date(),
			providerData: {},
		};

		expect(entitlingSubscription(state)).toBeNull();
	});
});
