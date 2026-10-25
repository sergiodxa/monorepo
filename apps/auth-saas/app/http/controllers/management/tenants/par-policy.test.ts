/**
 * Drives `POST /tenants/:tenantId/par-policy` through the management router, and reads the
 * setting back from the discovery facts the tenant publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildTenantsHarness } from "~/app/test/harness/management/tenants";

describe("POST /tenants/:tenantId/par-policy", () => {
	test("sets whether the tenant requires pushed authorization requests", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/par-policy`, token, {
				method: "POST",
				body: JSON.stringify({ required: true }),
			}),
		);

		expect(response.status).toBe(204);

		let published = await harness.tenantDO.publishMetadata({ now: Date.now() });
		expect(published.requirePushedAuthorizationRequests).toBe(true);
	});

	test("refuses a caller missing the tenant:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/par-policy`, token, {
				method: "POST",
				body: JSON.stringify({ required: true }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/par-policy`, token, {
				method: "POST",
				body: JSON.stringify({ required: true }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("answers a problem+json validation failure for an invalid policy", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/par-policy`, token, {
				method: "POST",
				body: JSON.stringify({ required: "sometimes" }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
