/**
 * Tests for `hasBillingProblem`, over an in-memory database seeded with the subscription
 * rows the billing sync writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid/v4";
import { describe, expect, test } from "vitest";

import { hasBillingProblem } from "~/app/services/billing-problem";
import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";
import { subscriptions } from "~/database/schema";

const OWNER = "owner-1";

/** Records one subscription for {@link OWNER} in `status`, revoked when `revoked` is set. */
async function record(db: Database, status: string, revoked = false) {
	let now = Date.now();
	await db.create(subscriptions, {
		id: generateUUID(),
		created_at: now,
		updated_at: now,
		external_customer_id: OWNER,
		billing_subscription_id: generateUUID(),
		billing_product_slug: "monitoring",
		status,
		current_period_end: null,
		revoked_at: revoked ? now : null,
		billing_read_at: now,
	});
}

describe("hasBillingProblem", () => {
	test("answers false for an owner with no recorded subscription", async () => {
		let { db } = createTestDatabase();
		expect(await hasBillingProblem(bindModels(db), OWNER)).toBe(false);
	});

	test("answers true for a live past-due subscription", async () => {
		let { db } = createTestDatabase();
		await record(db, "past_due");
		expect(await hasBillingProblem(bindModels(db), OWNER)).toBe(true);
	});

	test("answers false while another subscription still grants monitoring", async () => {
		let { db } = createTestDatabase();
		await record(db, "past_due");
		await record(db, "active");
		expect(await hasBillingProblem(bindModels(db), OWNER)).toBe(false);
	});

	test("ignores a revoked past-due subscription", async () => {
		let { db } = createTestDatabase();
		await record(db, "past_due", true);
		expect(await hasBillingProblem(bindModels(db), OWNER)).toBe(false);
	});

	test("answers false for an active subscription", async () => {
		let { db } = createTestDatabase();
		await record(db, "active");
		expect(await hasBillingProblem(bindModels(db), OWNER)).toBe(false);
	});
});
