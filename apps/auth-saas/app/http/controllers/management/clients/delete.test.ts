/**
 * Drives `DELETE /tenants/:tenantId/clients/:clientId` through the management
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

describe("DELETE /tenants/:tenantId/clients/:clientId", () => {
	test("deletes a client", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);

		let read = await harness.tenantDO.readClient({ clientId: created.client.id });
		expect(read).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("answers 404 for a client the tenant does not hold", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/client_missing`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the clients:write scope", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/${created.client.id}`, token, {
				method: "DELETE",
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
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(403);
	});
});
