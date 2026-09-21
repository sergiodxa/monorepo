/**
 * Exercises `forEachProvisionedTenant`: it visits every tenant whose status is not
 * `deleted`, resolves each one's stub by its tenant id, pages through the control
 * plane's tenant list past a single page, isolates one tenant's own failure from the
 * rest, and stops paging once its abort signal fires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createDurableObjectNamespace } from "@sdxc/cloudflare-mocks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

import { createTestDatabase } from "~/app/test/db";

import { forEachProvisionedTenant } from "./for-each-tenant";

let Customer = (await import("~/app/models/customer")).default;
let TenantModel = (await import("~/app/models/tenant")).default;

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Creates a tenant row, optionally overriding its status once created. */
async function makeTenant(name: string, status?: "active" | "suspended" | "deleted") {
	let customer = await Customer.create(db, { name });
	let tenant = await TenantModel.create(db, {
		customerId: customer.id,
		name,
		slug: name.toLowerCase(),
		issuer: `https://${name.toLowerCase()}.example.com`,
	});

	if (status !== undefined) {
		tenant = await db.update(TenantModel.table, { id: tenant.id }, { status });
	}

	return tenant;
}

describe("forEachProvisionedTenant", () => {
	test("visits every tenant whose status is not deleted", async () => {
		let active = await makeTenant("Acme");
		let suspended = await makeTenant("Bristle", "suspended");
		await makeTenant("Cinder", "deleted");

		let namespace = createDurableObjectNamespace<Tenant>(() => ({}));
		let visitedIds: string[] = [];

		let result = await forEachProvisionedTenant(db, namespace, async (_stub, tenantId) => {
			visitedIds.push(tenantId);
		});

		expect(visitedIds.sort()).toEqual([active.id, suspended.id].sort());
		expect(result).toEqual({ visited: 2 });
	});

	test("resolves each tenant's own stub by its tenant id", async () => {
		let tenant = await makeTenant("Acme");
		let namespace = createDurableObjectNamespace<Tenant>(() => ({}));

		await forEachProvisionedTenant(db, namespace, async () => {});

		expect(namespace.names).toEqual([tenant.id]);
	});

	test("pages past a single page of tenants", async () => {
		let first = await makeTenant("Acme");
		let second = await makeTenant("Bristle");
		let third = await makeTenant("Cinder");

		let namespace = createDurableObjectNamespace<Tenant>(() => ({}));
		let visitedIds: string[] = [];

		let result = await forEachProvisionedTenant(
			db,
			namespace,
			async (_stub, tenantId) => {
				visitedIds.push(tenantId);
			},
			{ pageSize: 1 },
		);

		expect(visitedIds.sort()).toEqual([first.id, second.id, third.id].sort());
		expect(result).toEqual({ visited: 3 });
	});

	test("isolates one tenant's own failure from the rest of the sweep", async () => {
		let failing = await makeTenant("Acme");
		let healthy = await makeTenant("Bristle");

		let namespace = createDurableObjectNamespace<Tenant>(() => ({}));
		let visitedIds: string[] = [];
		vi.spyOn(console, "error").mockImplementation(() => {});

		let result = await forEachProvisionedTenant(db, namespace, async (_stub, tenantId) => {
			if (tenantId === failing.id) throw new Error("this tenant's object is unavailable");
			visitedIds.push(tenantId);
		});

		expect(visitedIds).toEqual([healthy.id]);
		expect(result).toEqual({ visited: 1 });
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining(failing.id),
			expect.any(Error),
		);
	});

	test("stops paging once its abort signal fires", async () => {
		await makeTenant("Acme");
		await makeTenant("Bristle");
		await makeTenant("Cinder");

		let namespace = createDurableObjectNamespace<Tenant>(() => ({}));
		let controller = new AbortController();
		let visited = 0;

		let result = await forEachProvisionedTenant(
			db,
			namespace,
			async () => {
				visited++;
				controller.abort();
			},
			{ signal: controller.signal, pageSize: 1 },
		);

		expect(visited).toBe(1);
		expect(result).toEqual({ visited: 1 });
	});
});
