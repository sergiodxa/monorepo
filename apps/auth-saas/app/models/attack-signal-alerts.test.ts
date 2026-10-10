/**
 * Drives the attack-signal alerts model against the control-plane test database: a tenant
 * with no alert row for a day reads as not-yet-alerted, and `create` makes it read as
 * alerted from then on, scoped to that one day and that one tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { createTestDatabase } from "~/app/test/db";
import { bindModels, seedTenant } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

describe("attackSignalAlerts", () => {
	test("finds nothing for a tenant that was never alerted", async () => {
		let tenant = await seedTenant(models, "Acme");

		let found = await models.attackSignalAlerts.find({ tenant_id: tenant.id, day: 19_000 });
		expect(found).toBeNull();
	});

	test("finds the row once a tenant is alerted for a day", async () => {
		let tenant = await seedTenant(models, "Acme");
		unwrap(await models.attackSignalAlerts.create({ tenant_id: tenant.id, day: 19_000 }));

		let found = await models.attackSignalAlerts.find({ tenant_id: tenant.id, day: 19_000 });
		expect(found).toMatchObject({ tenant_id: tenant.id, day: 19_000 });
	});

	test("keeps a tenant's alert scoped to the day it was recorded for", async () => {
		let tenant = await seedTenant(models, "Acme");
		unwrap(await models.attackSignalAlerts.create({ tenant_id: tenant.id, day: 19_000 }));

		let otherDay = await models.attackSignalAlerts.find({ tenant_id: tenant.id, day: 19_001 });
		expect(otherDay).toBeNull();
	});

	test("keeps one tenant's alert from answering for another's", async () => {
		let first = await seedTenant(models, "Acme");
		let second = await seedTenant(models, "Bristle");
		unwrap(await models.attackSignalAlerts.create({ tenant_id: first.id, day: 19_000 }));

		let otherTenant = await models.attackSignalAlerts.find({ tenant_id: second.id, day: 19_000 });
		expect(otherTenant).toBeNull();
	});
});
