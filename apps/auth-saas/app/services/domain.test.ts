/**
 * Unit tests for the domain lifecycle service (ADR-005): the free-plan gate on
 * attaching a custom domain, writing the row `pending` with its TXT verification
 * fields, promoting a domain to `active` once Cloudflare reports it and its
 * certificate active, failing a domain still pending past seven days, and removing a
 * domain while treating an already-gone Cloudflare hostname as success. The
 * Cloudflare API is stubbed with MSW against a real `HostnameClient`, and
 * `cloudflare:workers` is mocked with an in-memory `HOSTNAMES_KV` namespace before the
 * modules under test are imported, since `invalidateHostnameCache` reads `env` at
 * load time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { HostnameClient } from "@sdxc/hostname";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

let hostnamesKv = createKVNamespace();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ HOSTNAMES_KV: hostnamesKv }),
}));

let { hostnameCacheKey } = await import("~/app/lib/hostname-cache");
let { createTestDatabase } = await import("~/app/test/db");
let Customer = (await import("~/app/models/customer")).default;
let Domain = (await import("~/app/models/domain")).default;
let Tenant = (await import("~/app/models/tenant")).default;
let { attachCustomDomain, CustomDomainNotAllowedError, refreshDomainStatus, removeDomain } =
	await import("./domain");

/** The Cloudflare custom-hostnames collection the test client is pointed at. */
let API_URL = "https://api.cloudflare.com/client/v4/zones/zone-1/custom_hostnames";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A client pointed at the zone the MSW handlers above answer for. */
function makeClient(): InstanceType<typeof HostnameClient> {
	return new HostnameClient({
		apiToken: "test-token",
		zoneId: "zone-1",
		platformDomain: "auth.example.com",
	});
}

let db: Database;

beforeEach(async () => {
	hostnamesKv.reset();
	db = await createTestDatabase();
});

/** Creates a tenant on the given plan, defaulting to `pro` so domain attachment is allowed. */
async function makeTenant(plan: "free" | "pro" | "premium" = "pro") {
	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
		region: "wnam",
	});
	if (plan !== "free") {
		tenant = await db.update(Tenant.table, { id: tenant.id }, { plan_slug: plan });
	}
	return tenant;
}

describe("attachCustomDomain", () => {
	test("refuses a tenant on the free plan", async () => {
		let tenant = await makeTenant("free");

		await expect(
			attachCustomDomain(db, makeClient(), tenant.id, "auth.acme.com"),
		).rejects.toBeInstanceOf(CustomDomainNotAllowedError);

		expect(await Domain.findByHostname(db, "auth.acme.com")).toBeNull();
	});

	test("rejects an unknown tenant id", async () => {
		await expect(
			attachCustomDomain(db, makeClient(), "ten_missing", "auth.acme.com"),
		).rejects.toThrow();
	});

	test("registers the hostname with Cloudflare and writes a pending domain with its TXT record", async () => {
		let tenant = await makeTenant("pro");

		server.use(
			http.post(API_URL, () =>
				HttpResponse.json({
					result: {
						id: "cf-1",
						hostname: "auth.acme.com",
						status: "pending",
						ssl: {
							status: "pending_validation",
							method: "txt",
							type: "dv",
							validation_records: [
								{ txt_name: "_cf-custom-hostname.auth.acme.com", txt_value: "abc123" },
							],
						},
						custom_metadata: { tenant_id: tenant.id, region: "wnam" },
					},
					success: true,
					errors: [],
					messages: [],
				}),
			),
		);

		let domain = await attachCustomDomain(db, makeClient(), tenant.id, "auth.acme.com");

		expect(domain.kind).toBe("custom");
		expect(domain.status).toBe("pending");
		expect(domain.verification_name).toBe("_cf-custom-hostname.auth.acme.com");
		expect(domain.verification_value).toBe("abc123");
	});
});

describe("refreshDomainStatus", () => {
	async function makePendingDomain(tenantId: string, hostname = "auth.acme.com") {
		return Domain.create(db, { tenantId, hostname, kind: "custom" });
	}

	test("promotes a domain to active once Cloudflare reports it and its SSL as active", async () => {
		let tenant = await makeTenant();
		let domain = await makePendingDomain(tenant.id);

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [
						{
							id: "cf-1",
							hostname: domain.hostname,
							status: "active",
							ssl: { status: "active", method: "txt", type: "dv" },
						},
					],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
				}),
			),
		);

		let updated = await refreshDomainStatus(db, makeClient(), domain);

		expect(updated.status).toBe("active");
		expect(updated.certificate_status).toBe("active");
	});

	test("invalidates the hostname cache on promotion to active", async () => {
		let tenant = await makeTenant();
		let domain = await makePendingDomain(tenant.id);
		await hostnamesKv.put(hostnameCacheKey(domain.hostname), JSON.stringify({ miss: true }));

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [
						{
							id: "cf-1",
							hostname: domain.hostname,
							status: "active",
							ssl: { status: "active", method: "txt", type: "dv" },
						},
					],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
				}),
			),
		);

		await refreshDomainStatus(db, makeClient(), domain);

		expect(await hostnamesKv.get(hostnameCacheKey(domain.hostname))).toBeNull();
	});

	test("leaves a recently-created domain pending while Cloudflare still reports it pending", async () => {
		let tenant = await makeTenant();
		let domain = await makePendingDomain(tenant.id);

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [
						{
							id: "cf-1",
							hostname: domain.hostname,
							status: "pending",
							ssl: { status: "pending_validation", method: "txt", type: "dv" },
						},
					],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
				}),
			),
		);

		let result = await refreshDomainStatus(db, makeClient(), domain);

		expect(result).toBe(domain);
		expect((await Domain.findByHostname(db, domain.hostname))?.status).toBe("pending");
	});

	test("fails a domain still pending more than seven days after creation", async () => {
		let tenant = await makeTenant();
		let domain = await makePendingDomain(tenant.id);
		let eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		domain = await db.update(Domain.table, { id: domain.id }, { created_at: eightDaysAgo });

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [
						{
							id: "cf-1",
							hostname: domain.hostname,
							status: "pending",
							ssl: { status: "pending_validation", method: "txt", type: "dv" },
						},
					],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
				}),
			),
		);

		let updated = await refreshDomainStatus(db, makeClient(), domain);

		expect(updated.status).toBe("failed");
	});

	test("fails a stale-pending domain even when Cloudflare no longer has a matching hostname", async () => {
		let tenant = await makeTenant();
		let domain = await makePendingDomain(tenant.id);
		let eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		domain = await db.update(Domain.table, { id: domain.id }, { created_at: eightDaysAgo });

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 0, total_pages: 1 },
				}),
			),
		);

		let updated = await refreshDomainStatus(db, makeClient(), domain);

		expect(updated.status).toBe("failed");
	});
});

describe("removeDomain", () => {
	async function makeDomain(tenantId: string, hostname = "auth.acme.com") {
		return Domain.create(db, { tenantId, hostname, kind: "custom" });
	}

	test("deletes the Cloudflare hostname found by name, then the row", async () => {
		let tenant = await makeTenant();
		let domain = await makeDomain(tenant.id);
		let deleted: string[] = [];

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [
						{
							id: "cf-1",
							hostname: domain.hostname,
							status: "active",
							ssl: { status: "active", method: "txt", type: "dv" },
						},
					],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
				}),
			),
			http.delete(`${API_URL}/:id`, ({ params }) => {
				deleted.push(params.id as string);
				return HttpResponse.json({ result: null, success: true, errors: [], messages: [] });
			}),
		);

		await removeDomain(db, makeClient(), domain);

		expect(deleted).toEqual(["cf-1"]);
		expect(await Domain.findByHostname(db, domain.hostname)).toBeNull();
	});

	test("removes the row without calling delete when Cloudflare has no matching hostname", async () => {
		let tenant = await makeTenant();
		let domain = await makeDomain(tenant.id);
		let deleteCalled = false;

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 0, total_pages: 1 },
				}),
			),
			http.delete(`${API_URL}/:id`, () => {
				deleteCalled = true;
				return HttpResponse.json({ result: null, success: true, errors: [], messages: [] });
			}),
		);

		await removeDomain(db, makeClient(), domain);

		expect(deleteCalled).toBe(false);
		expect(await Domain.findByHostname(db, domain.hostname)).toBeNull();
	});

	test("treats a 404 from Cloudflare's delete as the hostname already being gone", async () => {
		let tenant = await makeTenant();
		let domain = await makeDomain(tenant.id);

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [
						{
							id: "cf-1",
							hostname: domain.hostname,
							status: "active",
							ssl: { status: "active", method: "txt", type: "dv" },
						},
					],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
				}),
			),
			http.delete(
				`${API_URL}/:id`,
				() =>
					new HttpResponse(
						JSON.stringify({ success: false, errors: [{ code: 1436, message: "not found" }] }),
						{ status: 404 },
					),
			),
		);

		await removeDomain(db, makeClient(), domain);

		expect(await Domain.findByHostname(db, domain.hostname)).toBeNull();
	});

	test("invalidates the hostname cache", async () => {
		let tenant = await makeTenant();
		let domain = await makeDomain(tenant.id);
		await hostnamesKv.put(
			hostnameCacheKey(domain.hostname),
			JSON.stringify({ tenantId: tenant.id }),
		);

		server.use(
			http.get(API_URL, () =>
				HttpResponse.json({
					result: [],
					success: true,
					errors: [],
					messages: [],
					result_info: { page: 1, per_page: 50, total_count: 0, total_pages: 1 },
				}),
			),
		);

		await removeDomain(db, makeClient(), domain);

		expect(await hostnamesKv.get(hostnameCacheKey(domain.hostname))).toBeNull();
	});
});
