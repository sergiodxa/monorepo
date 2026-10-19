/**
 * Drives `tenantFeatures` against the control-plane test database: a tenant holds the
 * features its projection grants, and a missing tenant or projection holds none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { tenantFeatures } from "~/app/services/billing/tenant-features";
import { createTestDatabase } from "~/app/test/db";
import { bindModels, seedTenant } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

describe("tenantFeatures", () => {
	test("lists the features the tenant's projection grants", async () => {
		let tenant = await seedTenant(models, "Acme");
		unwrap(
			await models.tenantEntitlements.upsert({
				tenant_id: tenant.id,
				products: ["pro"],
				features: { custom_domain: true, session_policy: false },
				read_at: 1,
			}),
		);

		expect(await tenantFeatures(models, tenant.id)).toEqual({ features: ["custom_domain"] });
	});

	test("lists none for a tenant nothing has billed", async () => {
		let tenant = await seedTenant(models, "Acme");

		expect(await tenantFeatures(models, tenant.id)).toEqual({ features: [] });
	});

	test("lists none for a tenant no longer on the control plane", async () => {
		expect(await tenantFeatures(models, "tnt_missing")).toEqual({ features: [] });
	});
});
