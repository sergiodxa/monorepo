/**
 * Drives `DELETE /tenants/:tenantId/roles/:roleId` through the management router.
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

async function defineCustomRole(harness: RolesHarness): Promise<string> {
	let defined = await harness.tenantDO.defineRole({
		scope: "tenant",
		key: "support",
		name: "Support",
		description: "Reads support tickets",
		actor: { type: "platform", id: "system" },
	});
	if (!defined.ok) throw new Error("setup failed");
	return defined.role.id;
}

describe("DELETE /tenants/:tenantId/roles/:roleId", () => {
	test("deletes a custom role, reassigning every current holder", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();
		let roleId = await defineCustomRole(harness);

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDO.assignRole({
			subjectId: created.subjectId,
			scope: "tenant",
			roleKey: "support",
			actor: { type: "platform", id: "system" },
		});

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/roles/${roleId}?scope=tenant&reassignTo=member`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ reassigned: 1 });
	});

	test("answers a problem+json conflict for a system role", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/roles/owner?scope=tenant&reassignTo=admin`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/system-role");
	});

	test("answers a problem+json validation failure for an unknown reassignment target", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();
		let roleId = await defineCustomRole(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/roles/${roleId}?scope=tenant&reassignTo=rol_does_not_exist`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/invalid-reassignment");
	});

	test("answers a problem+json entitlement failure without the custom_roles entitlement", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/roles/rol_does_not_matter?scope=tenant&reassignTo=member`,
				token,
				{ method: "DELETE" },
			),
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
			harness.request(
				`/tenants/${harness.tenantId}/roles/${roleId}?scope=tenant&reassignTo=member`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ tenantId: harness.otherTenantId });
		let roleId = await defineCustomRole(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/roles/${roleId}?scope=tenant&reassignTo=member`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});
});
