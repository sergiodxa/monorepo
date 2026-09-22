/**
 * Drives `attack-signal-alert.ts` directly against the control-plane test
 * database: a tenant with no alert row for a day reads as not-yet-alerted, and
 * `create` makes it read as alerted from then on, scoped to that one day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { TenantRow } from "~/app/models/tenant";

import Customer from "~/app/models/customer";
import TenantModel from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import AttackSignalAlert from "./attack-signal-alert";

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

/** Creates a provisioned tenant row in the control plane, so a foreign key resolves. */
async function makeTenant(name: string): Promise<TenantRow> {
	let customer = await Customer.create(db, { name });
	return TenantModel.create(db, {
		customerId: customer.id,
		name,
		slug: name.toLowerCase(),
		issuer: `https://${name.toLowerCase()}.example.com`,
	});
}

describe("AttackSignalAlert", () => {
	test("finds nothing for a tenant that was never alerted", async () => {
		let tenant = await makeTenant("Acme");

		let found = await AttackSignalAlert.findByTenantAndDay(db, tenant.id, 19_000);
		expect(found).toBeNull();
	});

	test("finds the row once a tenant is alerted for a day", async () => {
		let tenant = await makeTenant("Acme");
		await AttackSignalAlert.create(db, tenant.id, 19_000);

		let found = await AttackSignalAlert.findByTenantAndDay(db, tenant.id, 19_000);
		expect(found).toMatchObject({ tenant_id: tenant.id, day: 19_000 });
	});

	test("keeps a tenant's alert scoped to the day it was recorded for", async () => {
		let tenant = await makeTenant("Acme");
		await AttackSignalAlert.create(db, tenant.id, 19_000);

		let otherDay = await AttackSignalAlert.findByTenantAndDay(db, tenant.id, 19_001);
		expect(otherDay).toBeNull();
	});

	test("keeps one tenant's alert from answering for another's", async () => {
		let first = await makeTenant("Acme");
		let second = await makeTenant("Bristle");
		await AttackSignalAlert.create(db, first.id, 19_000);

		let otherTenant = await AttackSignalAlert.findByTenantAndDay(db, second.id, 19_000);
		expect(otherTenant).toBeNull();
	});
});
