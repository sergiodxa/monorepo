/**
 * Drives `GET/POST /tenants/:tenantId/permissions` and `DELETE
 * /tenants/:tenantId/permissions?key=` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildRolesHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/roles/test-harness";

describe("GET /tenants/:tenantId/permissions", () => {
	test("lists a tenant's own declared permissions", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		await harness.tenantDO.definePermission({
			key: "billing.view",
			name: "View billing",
			description: "x",
			actor: { type: "platform", id: "system" },
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toMatchObject([{ key: "billing.view", name: "View billing" }]);
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/permissions", () => {
	test("defines a tenant's own permission", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token, {
				method: "POST",
				body: JSON.stringify({ key: "billing.view", name: "View billing", description: "x" }),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ key: "billing.view" });
	});

	test("answers a problem+json refusal for a key beginning auth:", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token, {
				method: "POST",
				body: JSON.stringify({
					key: "auth:tenants.manage",
					name: "Manage tenants",
					description: "x",
				}),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/reserved-key");
	});

	test("answers a problem+json entitlement failure without the custom_roles entitlement", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token, {
				method: "POST",
				body: JSON.stringify({ key: "billing.view", name: "View billing", description: "x" }),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions`, token, {
				method: "POST",
				body: JSON.stringify({ key: "billing.view", name: "View billing", description: "x" }),
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("DELETE /tenants/:tenantId/permissions?key=", () => {
	test("removes a tenant's own permission", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		await harness.tenantDO.definePermission({
			key: "billing.view",
			name: "View billing",
			description: "x",
			actor: { type: "platform", id: "system" },
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions?key=billing.view`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);
	});

	test("answers a problem+json not-found for a permission this tenant has not declared", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions?key=never.defined`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions?key=billing.view`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/permissions?key=billing.view`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(403);
	});
});
