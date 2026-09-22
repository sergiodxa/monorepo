/**
 * Drives `POST /tenants/:tenantId/mfa-policy` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildTenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";

describe("POST /tenants/:tenantId/mfa-policy", () => {
	test("sets the tenant's second-factor policy", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/mfa-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: "required" }),
			}),
		);

		expect(response.status).toBe(204);
	});

	test("refuses a caller missing the tenant:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/mfa-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: "required" }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/mfa-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: "required" }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("answers a problem+json validation failure for an invalid policy", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/mfa-policy`, token, {
				method: "POST",
				body: JSON.stringify({ policy: "sometimes" }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
