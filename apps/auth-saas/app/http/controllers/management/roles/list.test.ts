/**
 * Drives `GET /tenants/:tenantId/roles` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildRolesHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/roles/test-harness";

describe("GET /tenants/:tenantId/roles", () => {
	test("lists the three system roles for a scope with no custom roles of its own", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles?scope=tenant`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body.map((role) => role.key).sort((a, b) => String(a).localeCompare(String(b)))).toEqual(
			["admin", "member", "owner"],
		);
	});

	test("includes a scope's own custom roles alongside the three system roles", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let defined = await harness.tenantDO.defineRole({
			scope: "tenant",
			key: "support",
			name: "Support",
			description: "Reads support tickets",
			actor: { type: "platform", id: "system" },
		});
		if (!defined.ok) throw new Error("setup failed");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles?scope=tenant`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(4);
		expect(body.find((role) => role.key === "support")).toMatchObject({ system: false });
	});

	test("answers a problem+json validation failure when scope is missing", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles?scope=tenant`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles?scope=tenant`, token),
		);

		expect(response.status).toBe(403);
	});

	test("never gates listing on the custom_roles entitlement", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles?scope=tenant`, token),
		);

		expect(response.status).toBe(200);
	});
});
