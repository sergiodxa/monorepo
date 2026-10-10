/**
 * Drives the tenant entitlements model against the control-plane test database: `upsert`
 * creates a tenant's projection on its first write and overwrites it wholesale after, and
 * `staleBefore` lists the projections last read before a cutoff.
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

describe("tenantEntitlements.upsert", () => {
	test("creates a projection, then overwrites it wholesale keeping created_at", async () => {
		let tenant = await seedTenant(models, "Acme");

		let first = unwrap(
			await models.tenantEntitlements.upsert({
				tenant_id: tenant.id,
				products: ["pro"],
				features: { sso: true },
				read_at: 1,
			}),
		);
		let second = unwrap(
			await models.tenantEntitlements.upsert({
				tenant_id: tenant.id,
				products: [],
				features: {},
				read_at: 2,
			}),
		);

		expect(second).toMatchObject({ products: [], features: {}, read_at: 2 });
		expect(second.created_at).toBe(first.created_at);
		expect(await models.tenantEntitlements.query().count()).toBe(1);
	});
});

describe("tenantEntitlements.staleBefore", () => {
	test("lists only projections read before the cutoff", async () => {
		let fresh = await seedTenant(models, "Fresh");
		let stale = await seedTenant(models, "Stale");
		for (let [tenant, readAt] of [
			[fresh, 200],
			[stale, 100],
		] as const) {
			unwrap(
				await models.tenantEntitlements.upsert({
					tenant_id: tenant.id,
					products: [],
					features: {},
					read_at: readAt,
				}),
			);
		}

		let rows = await models.tenantEntitlements.staleBefore(200).all();
		expect(rows.map((row) => row.tenant_id)).toEqual([stale.id]);
	});
});
