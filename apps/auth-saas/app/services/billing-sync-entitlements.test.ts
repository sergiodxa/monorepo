/**
 * Exercises `reprojectTenant`'s push of `applyEntitlements` onto the tenant's
 * own Durable Object: the tier its base subscription names is recorded as its
 * plan, that plan's cap and retention reach the object, and a stub the
 * projection cannot reach never aborts the write that already landed. `cloudflare:workers` is mocked with a `TENANT` namespace routing to
 * a recording stub, the way `tenant-provisioning.test.ts` mocks it, since
 * `billing-sync.ts` reads `env` at call time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementState, EntitlementSubscription } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { createDurableObjectNamespace, createEnv } from "@sdxc/cloudflare-mocks";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Models } from "~/app/models";

/** A snapshot naming only `subscriptions`; with none, `reprojectTenant` writes an empty feature map. */
function emptySnapshot(subscriptions: EntitlementSubscription[] = []): EntitlementState {
	return {
		customerId: null,
		externalId: null,
		products: [],
		features: {},
		meters: [],
		subscriptions,
		readAt: new Date(),
		providerData: {},
	};
}

/** A snapshot subscription for `productSlug`, in the given status. */
function subscription(
	subscriptionId: string,
	productSlug: string,
	status: EntitlementSubscription["status"],
): EntitlementSubscription {
	return { subscriptionId, productSlug, status, currentPeriodEnd: null, cancelAtPeriodEnd: false };
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
let { bindModels } = await import("~/app/test/models");
let { PLANS } = await import("~/app/services/billing/catalog");
let { reprojectTenant } = await import("./billing-sync");

let db: Database;
let models: Models;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);
	billing = new MemoryBilling({ catalog: {} });
	applyEntitlementsCalls = [];
	stubFailure = null;
});

describe("reprojectTenant", () => {
	test("pushes the tenant's plan cap and retention onto its own Durable Object", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		tenant = unwrap(await models.tenants.update(tenant.id, { plan_slug: "pro" }));

		await reprojectTenant(models, billing, tenant.id, emptySnapshot());

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
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		// An add-on-only slug is never a base tier, so the Free numbers stand in.
		tenant = unwrap(await models.tenants.update(tenant.id, { plan_slug: "sso_connections" }));

		await reprojectTenant(models, billing, tenant.id, emptySnapshot());

		expect(applyEntitlementsCalls).toEqual([
			expect.objectContaining({
				input: expect.objectContaining({
					dauCap: PLANS.free.dauCap,
					auditRetentionDays: PLANS.free.auditRetentionDays,
				}),
			}),
		]);
	});

	test("records the tier the tenant's base subscription names as its plan", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		unwrap(await models.tenants.update(tenant.id, { subscription_id: "sub_base" }));

		await reprojectTenant(
			models,
			billing,
			tenant.id,
			emptySnapshot([subscription("sub_base", "premium", "active")]),
		);

		expect((await models.tenants.find(tenant.id))?.plan_slug).toBe("premium");
		expect(applyEntitlementsCalls).toEqual([
			expect.objectContaining({
				input: expect.objectContaining({
					plan: "premium",
					dauCap: PLANS.premium.dauCap,
					auditRetentionDays: PLANS.premium.auditRetentionDays,
				}),
			}),
		]);
	});

	test("keeps a lapsed tenant on its former tier", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		unwrap(
			await models.tenants.update(tenant.id, { subscription_id: "sub_base", plan_slug: "pro" }),
		);

		await reprojectTenant(
			models,
			billing,
			tenant.id,
			emptySnapshot([subscription("sub_base", "pro", "revoked")]),
		);

		expect((await models.tenants.find(tenant.id))?.plan_slug).toBe("pro");
	});

	test("never records an add-on the tenant holds as its plan", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		unwrap(await models.tenants.update(tenant.id, { subscription_id: "sub_base" }));

		await reprojectTenant(
			models,
			billing,
			tenant.id,
			emptySnapshot([subscription("sub_base", "sso_connections", "active")]),
		);

		expect((await models.tenants.find(tenant.id))?.plan_slug).toBe("free");
	});

	test("a stub the object cannot be reached through never aborts the projection write", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);
		stubFailure = new Error("Durable Object unreachable");

		await expect(
			reprojectTenant(models, billing, tenant.id, emptySnapshot()),
		).resolves.toBeUndefined();

		expect(applyEntitlementsCalls).toEqual([]);
	});
});
