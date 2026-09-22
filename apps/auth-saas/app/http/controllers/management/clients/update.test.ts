/**
 * Drives `PATCH /tenants/:tenantId/clients/:clientId` through the management
 * router.
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

/** The body `PATCH /tenants/:tenantId/clients/:clientId` accepts when a test does not care about most of it. */
function updateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return baseInput(overrides);
}

describe("PATCH /tenants/:tenantId/clients/:clientId", () => {
	test("replaces the whole editable record in one call", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody({ name: "Renamed Client", requireConsent: true })),
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ name: "Renamed Client", requireConsent: true });
	});

	test("answers 404 for a client the tenant does not hold", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/client_missing`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody()),
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json conflict for a change to kind", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody({ kind: "public", tokenEndpointAuthMethod: "none" })),
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/kind-immutable");
	});

	test("answers a problem+json validation failure for an invalid redirect URI", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody({ redirectUris: ["not-a-uri"] })),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/invalid-redirect-uri");
	});

	test("refuses a caller missing the clients:write scope", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody()),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildClientsHarness();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "PATCH",
				body: JSON.stringify(updateBody()),
			}),
		);

		expect(response.status).toBe(403);
	});
});
