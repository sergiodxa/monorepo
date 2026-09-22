/**
 * Drives `PUT /tenants/:tenantId/roles/:roleId/permissions` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RolesHarness } from "~/app/http/controllers/management/roles/test-harness";

import {
	buildRolesHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/roles/test-harness";

let ACTOR = { type: "platform" as const, id: "system" };

async function defineCustomRole(harness: RolesHarness): Promise<string> {
	let defined = await harness.tenantDO.defineRole({
		scope: "tenant",
		key: "support",
		name: "Support",
		description: "Reads support tickets",
		actor: ACTOR,
	});
	if (!defined.ok) throw new Error("setup failed");
	return defined.role.id;
}

describe("PUT /tenants/:tenantId/roles/:roleId/permissions", () => {
	test("replaces a custom role's whole granted set", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();
		let roleId = await defineCustomRole(harness);

		await harness.tenantDO.definePermission({
			key: "tickets.read",
			name: "Read tickets",
			description: "x",
			actor: ACTOR,
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles/${roleId}/permissions`, token, {
				method: "PUT",
				body: JSON.stringify({ permissionKeys: ["tickets.read"] }),
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ permissionKeys: ["tickets.read"] });
	});

	test("answers a problem+json validation failure for an undeclared permission key", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();
		let roleId = await defineCustomRole(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles/${roleId}/permissions`, token, {
				method: "PUT",
				body: JSON.stringify({ permissionKeys: ["never.defined"] }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/unknown-permission");
	});

	test("answers a problem+json conflict for a system role", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles/owner/permissions`, token, {
				method: "PUT",
				body: JSON.stringify({ permissionKeys: [] }),
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/system-role");
	});

	test("answers a problem+json entitlement failure without the custom_roles entitlement", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles/rol_does_not_matter/permissions`, token, {
				method: "PUT",
				body: JSON.stringify({ permissionKeys: [] }),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ scope: "subjects:read" });
		let roleId = await defineCustomRole(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles/${roleId}/permissions`, token, {
				method: "PUT",
				body: JSON.stringify({ permissionKeys: [] }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ tenantId: harness.otherTenantId });
		let roleId = await defineCustomRole(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles/${roleId}/permissions`, token, {
				method: "PUT",
				body: JSON.stringify({ permissionKeys: [] }),
			}),
		);

		expect(response.status).toBe(403);
	});
});
