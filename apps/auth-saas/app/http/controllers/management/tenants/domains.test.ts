/**
 * Drives every domain route through the management router: `GET
 * /tenants/:tenantId/domains` lists them, `POST .../domains` attaches a
 * custom domain, `GET .../domains/:domainId/verification` reads one's
 * verification and activation state, and `DELETE .../domains/:domainId`
 * removes one. An attach or remove call reaches Cloudflare's custom-hostname
 * API for real, through the `HostnameClient` the harness points at this
 * file's own MSW handlers, the way `app/services/domain.test.ts` already
 * drives that client. `cloudflare:workers` is mocked with an in-memory
 * `HOSTNAMES_KV` namespace before the modules under test are imported, since
 * a remove call's own cache invalidation reads `env` at load time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { TenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";

let hostnamesKv = createKVNamespace();

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return { ...actual, env: createEnv<Cloudflare.Env>({ HOSTNAMES_KV: hostnamesKv }) };
});

let { buildTenantsHarness, HOSTNAME_ZONE_ID } =
	await import("~/app/http/controllers/management/tenants/test-harness");
let Domain = (await import("~/app/models/domain")).default;
let Tenant = (await import("~/app/models/tenant")).default;

/** The Cloudflare custom-hostnames collection the test zone's handlers answer for. */
const API_URL = `https://api.cloudflare.com/client/v4/zones/${HOSTNAME_ZONE_ID}/custom_hostnames`;

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => hostnamesKv.reset());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Upgrades the harness's own tenant off the free plan, so attaching a custom domain is allowed. */
async function upgradeTenant(harness: TenantsHarness): Promise<void> {
	await Tenant.update(harness.db, harness.tenantId, { planSlug: "pro" });
}

describe("GET /tenants/:tenantId/domains", () => {
	test("lists the tenant's own domains", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		await Domain.create(harness.db, {
			tenantId: harness.tenantId,
			hostname: "acme.example.com",
			kind: "platform",
			status: "active",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toMatchObject([{ hostname: "acme.example.com", kind: "platform" }]);
	});

	test("refuses a caller missing the tenant:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains`, token),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/domains", () => {
	test("registers the hostname with Cloudflare and attaches a pending custom domain", async () => {
		let harness = await buildTenantsHarness();
		await upgradeTenant(harness);
		let token = await harness.signToken();

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
						custom_metadata: { tenant_id: harness.tenantId, region: "wnam" },
					},
					success: true,
					errors: [],
					messages: [],
				}),
			),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains`, token, {
				method: "POST",
				body: JSON.stringify({ hostname: "auth.acme.com", kind: "custom" }),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			hostname: "auth.acme.com",
			kind: "custom",
			status: "pending",
			verificationName: "_cf-custom-hostname.auth.acme.com",
			verificationValue: "abc123",
		});
	});

	test("refuses a platform-kind domain, which the platform provisions on its own", async () => {
		let harness = await buildTenantsHarness();
		await upgradeTenant(harness);
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains`, token, {
				method: "POST",
				body: JSON.stringify({ hostname: "auth.acme.com", kind: "platform" }),
			}),
		);

		expect(response.status).toBe(400);
	});

	test("refuses a tenant on the free plan", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains`, token, {
				method: "POST",
				body: JSON.stringify({ hostname: "auth.acme.com", kind: "custom" }),
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("GET /tenants/:tenantId/domains/:domainId/verification", () => {
	test("reads a domain's verification and activation state", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let domain = await Domain.create(harness.db, {
			tenantId: harness.tenantId,
			hostname: "auth.acme.com",
			kind: "custom",
		});
		await Domain.update(harness.db, domain.id, {
			verificationName: "_cf-custom-hostname.auth.acme.com",
			verificationValue: "abc123",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains/${domain.id}/verification`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			status: "pending",
			verificationName: "_cf-custom-hostname.auth.acme.com",
			verificationValue: "abc123",
		});
		expect(body).not.toHaveProperty("hostname");
	});

	test("answers 404 for a domain another tenant holds", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let otherDomain = await Domain.create(harness.db, {
			tenantId: harness.otherTenantId,
			hostname: "other.example.com",
			kind: "platform",
			status: "active",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains/${otherDomain.id}/verification`, token),
		);

		expect(response.status).toBe(404);
	});
});

describe("DELETE /tenants/:tenantId/domains/:domainId", () => {
	test("removes the Cloudflare hostname and the domain row", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let domain = await Domain.create(harness.db, {
			tenantId: harness.tenantId,
			hostname: "auth.acme.com",
			kind: "custom",
		});

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
			http.delete(`${API_URL}/:id`, () =>
				HttpResponse.json({ result: null, success: true, errors: [], messages: [] }),
			),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains/${domain.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);
		expect(await Domain.findByHostname(harness.db, domain.hostname)).toBeNull();
	});

	test("answers 404 for a domain another tenant holds, leaving it untouched", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let otherDomain = await Domain.create(harness.db, {
			tenantId: harness.otherTenantId,
			hostname: "other.example.com",
			kind: "platform",
			status: "active",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/domains/${otherDomain.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
		expect(await Domain.findByHostname(harness.db, otherDomain.hostname)).not.toBeNull();
	});
});
