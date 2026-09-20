/**
 * Exercises `closeTenantMeteringDay`: it closes the day on the tenant's own
 * Durable Object stub and folds the answered figures into the control
 * plane's `tenant_usage_day` table, safely on a second call for the same day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type Tenant from "~/database/tenant-do";

import Customer from "~/app/models/customer";
import TenantModel from "~/app/models/tenant";
import TenantUsageDay from "~/app/models/tenant-usage-day";
import { createTestDatabase } from "~/app/test/db";

import { closeTenantMeteringDay } from "./tenant-usage";

let db: Database;
let tenantId: string;

/** A stub answering `closeMeteringDay` with fixed figures, recording every call it receives. */
function stubClosingWith(usage: {
	day: number;
	subjects: number;
	sessions: number;
	tokens: number;
}) {
	let calls: Array<{ day: number }> = [];

	let stub = {
		closeMeteringDay: async (input: { day: number }) => {
			calls.push(input);
			return usage;
		},
	} as unknown as DurableObjectStub<Tenant>;

	return { stub, calls };
}

beforeEach(async () => {
	db = await createTestDatabase();
	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await TenantModel.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.example.com",
	});
	tenantId = tenant.id;
});

describe("closeTenantMeteringDay", () => {
	test("writes the closed day's figures into tenant_usage_day", async () => {
		let { stub } = stubClosingWith({ day: 20_000, subjects: 42, sessions: 0, tokens: 0 });

		let row = await closeTenantMeteringDay(stub, db, { tenantId, day: 20_000 });

		expect(row).toMatchObject({ tenant_id: tenantId, day: 20_000, subjects: 42 });

		let stored = await TenantUsageDay.findByTenantAndDay(db, tenantId, 20_000);
		expect(stored).toMatchObject({ tenant_id: tenantId, day: 20_000, subjects: 42 });
	});

	test("a second close for the same day overwrites rather than duplicating", async () => {
		let first = stubClosingWith({ day: 20_001, subjects: 10, sessions: 0, tokens: 0 });
		await closeTenantMeteringDay(first.stub, db, { tenantId, day: 20_001 });

		let second = stubClosingWith({ day: 20_001, subjects: 10, sessions: 0, tokens: 0 });
		await closeTenantMeteringDay(second.stub, db, { tenantId, day: 20_001 });

		let rows = await db.findMany(TenantUsageDay.table, { where: { tenant_id: tenantId } });
		expect(rows).toHaveLength(1);
		expect(rows[0]?.subjects).toBe(10);
	});
});
