/**
 * Exercises `reprojectTenant`'s push of `applyEntitlements` onto the tenant's
 * own Durable Object: the right plan's cap and retention reach the object,
 * and a stub the projection cannot reach never aborts the write that already
 * landed. `cloudflare:workers` is mocked with a `TENANT` namespace routing to
 * a recording stub, the way `tenant-provisioning.test.ts` mocks it, since
 * `billing-sync.ts` reads `env` at call time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementState } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { createDurableObjectNamespace, createEnv } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** A snapshot naming no subscriptions, so `reprojectTenant` writes an empty feature map. */
function emptySnapshot(): EntitlementState {
	return {
		customerId: null,
		externalId: null,
		products: [],
		features: {},
		meters: [],
		subscriptions: [],
		readAt: new Date(),
		providerData: {},
	};
}

/** Every `applyEntitlements` call the stubbed tenant Durable Object namespace has received. */
let applyEntitlementsCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

/** When set, the stubbed tenant object's `applyEntitlements` throws instead of recording. */
let stubFailure: Error | null = null;

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		TENANT: createDurableObjectNamespace((name) => ({
			applyEntitlements: async (input: Record<string, unknown>) => {
				if (stubFailure) throw stubFailure;
				applyEntitlementsCalls.push({ name, input });
				return { plan: input.plan, prunedRows: 0 };
			},
		})),
	}),
}));

let { createTestDatabase } = await import("~/app/test/db");
let Customer = (await import("~/app/models/customer")).default;
let Tenant = (await import("~/app/models/tenant")).default;
let { PLANS } = await import("~/app/services/billing/catalog");
let { reprojectTenant } = await import("./billing-sync");

let db: Database;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	billing = new MemoryBilling({ catalog: {} });
	applyEntitlementsCalls = [];
	stubFailure = null;
});

describe("reprojectTenant", () => {
	test("pushes the tenant's plan cap and retention onto its own Durable Object", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});
		tenant = await Tenant.update(db, tenant.id, { planSlug: "pro" });

		await reprojectTenant(db, billing, tenant.id, emptySnapshot());

		expect(applyEntitlementsCalls).toEqual([
			{
				name: tenant.id,
				input: {
					plan: "pro",
					features: {},
					dauCap: PLANS.pro.dauCap,
					auditRetentionDays: PLANS.pro.auditRetentionDays,
					effectiveAt: expect.any(Number),
				},
			},
		]);
	});

	test("falls back to the Free plan's cap and retention for an unrecognized plan slug", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});
		// An add-on-only slug is never a base tier, so the Free numbers stand in.
		tenant = await Tenant.update(db, tenant.id, { planSlug: "sso_connections" });

		await reprojectTenant(db, billing, tenant.id, emptySnapshot());

		expect(applyEntitlementsCalls).toEqual([
			expect.objectContaining({
				input: expect.objectContaining({
					dauCap: PLANS.free.dauCap,
					auditRetentionDays: PLANS.free.auditRetentionDays,
				}),
			}),
		]);
	});

	test("a stub the object cannot be reached through never aborts the projection write", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});
		stubFailure = new Error("Durable Object unreachable");

		await expect(reprojectTenant(db, billing, tenant.id, emptySnapshot())).resolves.toBeUndefined();

		expect(applyEntitlementsCalls).toEqual([]);
	});
});
