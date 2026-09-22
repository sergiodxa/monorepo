/**
 * Drives `GET /tenants/:tenantId/clients` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildClientsHarness } from "~/app/http/controllers/management/clients/test-harness";

/** The record `registerClient` accepts when a test does not care about most of it. */
function baseInput(overrides: Record<string, unknown> = {}) {
	return {
		name: "Test Client",
		kind: "confidential" as const,
		redirectUris: ["https://example.com/callback"],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid"],
		tokenEndpointAuthMethod: "client_secret_basic" as const,
		requireConsent: false,
		...overrides,
	};
}

describe("GET /tenants/:tenantId/clients", () => {
	test("pages the tenant's clients, newest first", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		await harness.tenantDO.registerClient(baseInput({ name: "First" }));
		await harness.tenantDO.registerClient(baseInput({ name: "Second" }));

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients?per_page=1`, token),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toContain('rel="next"');

		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0]).toMatchObject({ name: "Second" });
	});

	test("refuses a caller missing the clients:write scope", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token),
		);

		expect(response.status).toBe(403);
	});

	test("answers 400 for a cursor this ordering did not mint", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients?cursor=not-a-real-cursor`, token),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
