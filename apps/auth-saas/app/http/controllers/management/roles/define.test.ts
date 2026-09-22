/**
 * Drives `POST /tenants/:tenantId/roles` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildRolesHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/roles/test-harness";

describe("POST /tenants/:tenantId/roles", () => {
	test("defines a custom role at a scope", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({
					scope: "tenant",
					key: "support",
					name: "Support",
					description: "Reads support tickets",
				}),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ key: "support", scope: "tenant", system: false });
	});

	test("answers a problem+json refusal for a key colliding with a system role", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", key: "owner", name: "Owner", description: "x" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/reserved-key");
	});

	test("answers a problem+json conflict for a duplicate (scope, key)", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let define = () =>
			harness.router.fetch(
				harness.request(`/tenants/${harness.tenantId}/roles`, token, {
					method: "POST",
					body: JSON.stringify({
						scope: "tenant",
						key: "support",
						name: "Support",
						description: "x",
					}),
				}),
			);

		expect((await define()).status).toBe(201);

		let second = await define();
		expect(second.status).toBe(409);
		let body = (await second.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/duplicate-role");
	});

	test("answers a problem+json entitlement failure without the custom_roles entitlement", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({
					scope: "tenant",
					key: "support",
					name: "Support",
					description: "x",
				}),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
	});

	test("answers a problem+json validation failure for a malformed body", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(Array.isArray(body.errors)).toBe(true);
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({
					scope: "tenant",
					key: "support",
					name: "Support",
					description: "x",
				}),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		await grantEntitlement(harness.tenantDO, "custom_roles");
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({
					scope: "tenant",
					key: "support",
					name: "Support",
					description: "x",
				}),
			}),
		);

		expect(response.status).toBe(403);
	});
});
