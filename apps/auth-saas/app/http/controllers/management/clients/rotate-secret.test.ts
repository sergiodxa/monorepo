/**
 * Drives `POST /tenants/:tenantId/clients/:clientId/rotate-secret` through the
 * management router.
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

describe("POST /tenants/:tenantId/clients/:clientId/rotate-secret", () => {
	test("mints a successor secret and opens the incumbent's overlap window", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/rotate-secret`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.secret).toMatch(/^csec_/);
		expect(body.incumbentExpiresAt).toEqual(expect.any(Number));
	});

	test("caps a requested window", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");
		let before = Date.now();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/rotate-secret`,
				token,
				{ method: "POST", body: JSON.stringify({ windowDays: 90 }) },
			),
		);

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.incumbentExpiresAt as number).toBeLessThanOrEqual(
			before + 30 * 24 * 60 * 60 * 1000 + 1000,
		);
	});

	test("answers 404 for a client the tenant does not hold", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients/client_missing/rotate-secret`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json conflict for a public client", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(
			baseInput({ kind: "public", tokenEndpointAuthMethod: "none" }),
		);
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/rotate-secret`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/not-confidential");
	});

	test("answers a problem+json conflict while two secrets are already live", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDO.rotateClientSecret({ clientId: created.client.id });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/rotate-secret`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/too-many-live-secrets");
	});

	test("refuses a caller missing the clients:write scope", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/rotate-secret`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildClientsHarness();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/rotate-secret`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});
});
