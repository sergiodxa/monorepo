/**
 * Drives the tenant add-ons model against the control-plane test database: `attach` records a
 * subscription's add-on once, so attaching the same checkout twice keeps the first row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import type { Models } from "~/app/models";

import { createTestDatabase } from "~/app/test/db";
import { bindModels, seedTenant } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

describe("tenantAddons.attach", () => {
	test("records a subscription's add-on with a minted addon_ id", async () => {
		let tenant = await seedTenant(models, "Acme");
		let addon = unwrap(
			await models.tenantAddons.attach({
				tenant_id: tenant.id,
				product_slug: "sso",
				subscription_id: "sub_1",
				status: "active",
				current_period_end: null,
			}),
		);

		expect(addon).toMatchObject({ tenant_id: tenant.id, subscription_id: "sub_1" });
		expect(addon.id).toMatch(/^addon_/);
	});

	test("keeps the first row when the same subscription is attached again", async () => {
		let tenant = await seedTenant(models, "Acme");
		let input = {
			tenant_id: tenant.id,
			product_slug: "sso",
			subscription_id: "sub_1",
			status: "active",
			current_period_end: null,
		};
		let first = unwrap(await models.tenantAddons.attach(input));
		let second = unwrap(await models.tenantAddons.attach({ ...input, status: "canceled" }));

		expect(second).toEqual(first);
		expect(await models.tenantAddons.ofTenant(tenant.id).all()).toHaveLength(1);
	});
});
