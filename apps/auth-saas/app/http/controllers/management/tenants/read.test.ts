/**
 * Drives `GET /tenants/:tenantId` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildTenantsHarness,
	grantMembership,
} from "~/app/http/controllers/management/tenants/test-harness";

describe("GET /tenants/:tenantId", () => {
	test("reads the tenant's own public record", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ id: harness.tenantId, slug: "acme", status: "active" });
		expect(body).not.toHaveProperty("customer_id");
		expect(body).not.toHaveProperty("subscription_id");
	});

	test("resolves a caller from a dashboard session's membership role", async () => {
		let harness = await buildTenantsHarness({
			resolveDashboardSubjectId: async () => "sub_member_1",
		});
		await grantMembership(harness.db, harness.tenantId, "sub_member_1", "owner");

		let response = await harness.router.fetch(
			new Request(`https://api.example.com/tenants/${harness.tenantId}`),
		);

		expect(response.status).toBe(200);
	});

	test("refuses a caller missing the tenant:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}`, token),
		);

		expect(response.status).toBe(403);
	});
});
