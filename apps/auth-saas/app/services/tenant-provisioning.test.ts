/**
 * Unit tests for `provisionTenant` (ADR-003/004/005): the tenant row and its platform
 * domain row land in D1, the issuer is the same value in both places, and the tenant
 * Durable Object is provisioned with that issuer. `cloudflare:workers` is mocked with
 * `PLATFORM_DOMAIN` and a `TENANT` namespace routing to a recording stub, since the
 * service reads `env` at load time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { createDurableObjectNamespace, createEnv } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** Every `provision` call the stubbed tenant Durable Object namespace has received. */
let provisionCalls: Array<{ name: string; input: { tenantId: string; issuer: string } }> = [];

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		PLATFORM_DOMAIN: "auth.sergiodxa.com",
		TENANT: createDurableObjectNamespace((name) => ({
			provision: async (input: { tenantId: string; issuer: string }) => {
				provisionCalls.push({ name, input });
				return { applied: ["0001-init"], issuer: input.issuer };
			},
		})),
	}),
}));

let { createTestDatabase } = await import("~/app/test/db");
let Customer = (await import("~/app/models/customer")).default;
let Domain = (await import("~/app/models/domain")).default;
let { provisionTenant } = await import("./tenant-provisioning");

let db: Database;

beforeEach(async () => {
	provisionCalls = [];
	db = await createTestDatabase();
});

describe("provisionTenant", () => {
	test("writes a tenant row whose issuer is the slug's platform subdomain", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		let tenant = await provisionTenant(db, { customerId: customer.id, name: "Acme, Inc." });

		expect(tenant.customer_id).toBe(customer.id);
		expect(tenant.issuer).toBe(`https://${tenant.slug}.auth.sergiodxa.com`);
		expect(tenant.status).toBe("active");
		expect(tenant.plan).toBe("free");
	});

	test("writes an already-active platform domain row for the same hostname as the issuer", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		let tenant = await provisionTenant(db, { customerId: customer.id, name: "Acme, Inc." });

		let domain = await Domain.findByHostname(db, `${tenant.slug}.auth.sergiodxa.com`);
		expect(domain?.tenant_id).toBe(tenant.id);
		expect(domain?.kind).toBe("platform");
		expect(domain?.status).toBe("active");
		expect(domain?.verification_name).toBeNull();
		expect(domain?.verification_value).toBeNull();
	});

	test("provisions the tenant's Durable Object with the tenant id and issuer", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		let tenant = await provisionTenant(db, { customerId: customer.id, name: "Acme, Inc." });

		expect(provisionCalls).toEqual([
			{ name: tenant.id, input: { tenantId: tenant.id, issuer: tenant.issuer } },
		]);
	});

	test("places the tenant in the requested region", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });

		let tenant = await provisionTenant(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			region: "weur",
		});

		expect(tenant.region).toBe("weur");
	});
});
