/**
 * Exercises `reportDailyUsage`: a tenant with a settled day and a resolvable
 * customer reports both `auth.dau` and `infra.cost` to the billing provider;
 * a tenant whose customer has no `provider_customer_id` yet is skipped and
 * reported as skipped rather than sent; a retryable `usage.ingest` failure
 * rethrows so a scheduled caller retries the whole day; a non-retryable one
 * is logged and swallowed; and a day with no `tenant_usage_day` rows reports
 * zero tenant-days without touching the network. The Analytics Engine SQL API
 * is stubbed with MSW, and `cloudflare:workers` is mocked with the account id
 * and API token that endpoint is called with, the way `domain.test.ts` mocks
 * `cloudflare:workers` for `HostnameClient`'s own Cloudflare API calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { createEnv } from "@sdxc/cloudflare-mocks";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

let CF_ACCOUNT_ID = "acct_1";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ CF_ACCOUNT_ID, CF_API_TOKEN: "test-cf-token" }),
}));

let { createTestDatabase } = await import("~/app/test/db");
let Customer = (await import("~/app/models/customer")).default;
let Tenant = (await import("~/app/models/tenant")).default;
let TenantUsageDay = (await import("~/app/models/tenant-usage-day")).default;
let { reportDailyUsage } = await import("./usage-reporting");

/** The Analytics Engine SQL API endpoint the job queries cost from. */
let ANALYTICS_SQL_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`;

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers the day's cost query with one row per tenant, in cents. */
function mockDailyCost(rows: Array<{ tenant_id: string; cents: number }>): void {
	server.use(http.post(ANALYTICS_SQL_URL, () => HttpResponse.json({ data: rows })));
}

let db: Database;
let day = 20_345;

beforeEach(async () => {
	db = await createTestDatabase();
});

/** Creates a tenant on a real plan, whose customer optionally already checked out. */
async function makeTenant(options: { hasProviderCustomer: boolean; plan?: string }) {
	let customer = await Customer.create(db, { name: "Acme, Inc." });

	if (options.hasProviderCustomer) {
		customer = await Customer.joinProviderCustomer(db, customer.id, {
			connection: "polar",
			providerCustomerId: "cus_polar_1",
		});
	}

	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.example.com",
	});

	if (options.plan)
		tenant = await db.update(Tenant.table, { id: tenant.id }, { plan_slug: options.plan });

	return { customer, tenant };
}

describe("reportDailyUsage", () => {
	test("reports auth.dau and infra.cost for a tenant with a settled day and a resolvable customer", async () => {
		let { customer, tenant } = await makeTenant({ hasProviderCustomer: true, plan: "pro" });
		await TenantUsageDay.upsert(db, tenant.id, { day, subjects: 42, sessions: 10, tokens: 5 });
		mockDailyCost([{ tenant_id: tenant.id, cents: 0.0000027 }]);

		let billing = new MemoryBilling();

		let result = await reportDailyUsage(db, billing, { day });

		expect(result).toEqual({ day, reported: 1, skipped: [] });

		let page = await unwrap(billing.usage.list({}));
		expect(page.items).toHaveLength(2);

		let dau = page.items.find((item) => item.name === "auth.dau");
		expect(dau).toMatchObject({
			customerExternalId: customer.id,
			externalId: `auth.dau:${tenant.id}:${day}`,
			metadata: { tenantId: tenant.id, tier: "pro", subjects: 42 },
		});

		let cost = page.items.find((item) => item.name === "infra.cost");
		expect(cost).toMatchObject({
			customerExternalId: customer.id,
			externalId: `infra.cost:${tenant.id}:${day}`,
			metadata: { tenantId: tenant.id, tier: "pro" },
			cost: { amount: (0.0000027).toFixed(9), currency: "usd" },
		});
	});

	test("skips a tenant whose customer has no provider_customer_id, reporting it as skipped rather than sent", async () => {
		let { tenant } = await makeTenant({ hasProviderCustomer: false });
		await TenantUsageDay.upsert(db, tenant.id, { day, subjects: 7, sessions: 1, tokens: 1 });
		mockDailyCost([]);

		let billing = new MemoryBilling();

		let result = await reportDailyUsage(db, billing, { day });

		expect(result).toEqual({
			day,
			reported: 0,
			skipped: [{ tenantId: tenant.id, day, reason: "no_provider_customer" }],
		});

		let page = await unwrap(billing.usage.list({}));
		expect(page.items).toHaveLength(0);
	});

	test("rethrows a retryable usage.ingest failure so the day can be retried", async () => {
		let { tenant } = await makeTenant({ hasProviderCustomer: true });
		await TenantUsageDay.upsert(db, tenant.id, { day, subjects: 3, sessions: 0, tokens: 0 });
		mockDailyCost([]);

		let billing = new MemoryBilling();
		billing.fail("usage.ingest", "rate_limited");

		await expect(reportDailyUsage(db, billing, { day })).rejects.toMatchObject({
			retryable: true,
		});
	});

	test("logs and swallows a non-retryable usage.ingest failure", async () => {
		let { tenant } = await makeTenant({ hasProviderCustomer: true });
		await TenantUsageDay.upsert(db, tenant.id, { day, subjects: 3, sessions: 0, tokens: 0 });
		mockDailyCost([]);

		let billing = new MemoryBilling();
		billing.fail("usage.ingest");

		let result = await reportDailyUsage(db, billing, { day });

		expect(result).toEqual({ day, reported: 0, skipped: [] });
	});

	test("reports zero tenant-days cleanly for a day with no tenant_usage_day rows", async () => {
		let billing = new MemoryBilling();

		let result = await reportDailyUsage(db, billing, { day });

		expect(result).toEqual({ day, reported: 0, skipped: [] });
	});

	test("logs and returns early when the provider does not support usage", async () => {
		let { tenant } = await makeTenant({ hasProviderCustomer: true });
		await TenantUsageDay.upsert(db, tenant.id, { day, subjects: 3, sessions: 0, tokens: 0 });

		let billing = new MemoryBilling();
		let unsupported = billing.with({ usage: undefined });

		let result = await reportDailyUsage(db, unsupported, { day });

		expect(result).toEqual({ day, reported: 0, skipped: [] });
	});

	test("defaults to yesterday, UTC, when no day is given", async () => {
		let billing = new MemoryBilling();
		let before = Math.floor(Date.now() / 1000);

		let result = await reportDailyUsage(db, billing, {});

		let expectedDay = Math.floor(before / 86_400) - 1;
		expect(result.day).toBe(expectedDay);
	});
});
