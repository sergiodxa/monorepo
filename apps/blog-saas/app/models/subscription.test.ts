/**
 * Unit tests for the account `Subscription` control-plane model: the `isActive`
 * entitlement predicate and the upsert/lookup queries that back billing sync,
 * exercised against an in-memory SQLite database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { type TestDatabase, createTestDatabase } from "~/app/test/db";

import Account from "./account";
import Subscription, { type SubscriptionRow } from "./subscription";

let harness: TestDatabase;

beforeEach(() => {
	harness = createTestDatabase();
});

afterEach(() => {
	harness.sqliteDb.close();
});

/** Inserts an account so subscription rows satisfy the FK constraint. */
async function seedAccount(subject = "sub-1"): Promise<string> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject,
		email: `${subject}@example.com`,
	});
	return account.id;
}

describe("Subscription.isActive", () => {
	test("treats an active subscription as entitling", () => {
		expect(Subscription.isActive({ status: "active" } as SubscriptionRow)).toBe(true);
	});

	test("treats a trialing subscription as entitling", () => {
		expect(Subscription.isActive({ status: "trialing" } as SubscriptionRow)).toBe(true);
	});

	test("treats past_due, canceled, unpaid and incomplete as not entitling", () => {
		for (let status of ["past_due", "canceled", "unpaid", "incomplete"] as const) {
			expect(Subscription.isActive({ status } as SubscriptionRow)).toBe(false);
		}
	});

	test("treats a missing subscription as not entitling", () => {
		expect(Subscription.isActive(null)).toBe(false);
	});
});

describe("Subscription.upsert", () => {
	test("inserts a new subscription with the given status", async () => {
		let accountId = await seedAccount();

		let row = await Subscription.upsert(harness.db, accountId, {
			polar_subscription_id: "sub_polar_1",
			polar_product_id: "prod_1",
			status: "active",
		});

		expect(row.account_id).toBe(accountId);
		expect(row.status).toBe("active");
		expect(row.polar_subscription_id).toBe("sub_polar_1");
	});

	test("defaults a new subscription without a status to incomplete", async () => {
		let accountId = await seedAccount();

		let row = await Subscription.upsert(harness.db, accountId, {
			polar_subscription_id: "sub_polar_1",
		});

		expect(row.status).toBe("incomplete");
	});

	test("updates the existing row in place rather than inserting a second one", async () => {
		let accountId = await seedAccount();
		let created = await Subscription.upsert(harness.db, accountId, { status: "trialing" });

		let updated = await Subscription.upsert(harness.db, accountId, { status: "active" });

		expect(updated.id).toBe(created.id);
		expect(updated.status).toBe("active");
	});

	test("leaves unspecified fields untouched on update", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, {
			polar_subscription_id: "sub_polar_1",
			status: "active",
		});

		let updated = await Subscription.upsert(harness.db, accountId, { status: "past_due" });

		expect(updated.status).toBe("past_due");
		expect(updated.polar_subscription_id).toBe("sub_polar_1");
	});
});

describe("Subscription lookups", () => {
	test("findByAccount returns the account's subscription", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, { status: "active" });

		let found = await Subscription.findByAccount(harness.db, accountId);

		expect(found?.account_id).toBe(accountId);
	});

	test("findByAccount returns null when there is no subscription", async () => {
		let accountId = await seedAccount();

		let found = await Subscription.findByAccount(harness.db, accountId);

		expect(found).toBeNull();
	});

	test("findByPolarId resolves a subscription by its Polar id", async () => {
		let accountId = await seedAccount();
		await Subscription.upsert(harness.db, accountId, {
			polar_subscription_id: "sub_polar_42",
			status: "active",
		});

		let found = await Subscription.findByPolarId(harness.db, "sub_polar_42");

		expect(found?.account_id).toBe(accountId);
	});
});
