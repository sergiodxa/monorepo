/**
 * Drives `GET /tenants/:tenantId/session-policy` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildTenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";

const SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_LIFETIME_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;

describe("GET /tenants/:tenantId/session-policy", () => {
	test("reads the effective policy and bounds for a tenant holding no session_policy entitlement", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		// This harness never grants `session_policy` on either layer — proving
		// the read succeeds without it is the entire point of this test.
		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/session-policy`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			absoluteLifetimeMs: { value: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS, source: "default" },
			idleLifetimeMs: { value: SESSION_IDLE_LIFETIME_DEFAULT_MS, source: "default" },
		});
		expect(body.bounds).toBeDefined();
	});

	test("refuses a caller missing the tenant:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/session-policy`, token),
		);

		expect(response.status).toBe(403);
	});
});
