/**
 * Drives `POST /tenants/:tenantId/clients` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildClientsHarness } from "~/app/http/controllers/management/clients/test-harness";

/** The body `POST /tenants/:tenantId/clients` accepts when a test does not care about most of it. */
function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: "Test Client",
		kind: "confidential",
		redirectUris: ["https://example.com/callback"],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
		...overrides,
	};
}

describe("POST /tenants/:tenantId/clients", () => {
	test("registers a confidential client and mints its first secret", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token, {
				method: "POST",
				body: JSON.stringify(baseBody({ name: "Pipeline" })),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.client).toMatchObject({ name: "Pipeline", kind: "confidential" });
		expect(body.secret).toMatch(/^csec_/);
	});

	test("registers a client for RS256 ID tokens, and defaults one that names none to ES256", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let register = (body: Record<string, unknown>) =>
			harness.router.fetch(
				harness.request(`/tenants/${harness.tenantId}/clients`, token, {
					method: "POST",
					body: JSON.stringify(body),
				}),
			);

		let rs256 = (await (
			await register(baseBody({ idTokenSignedResponseAlg: "RS256" }))
		).json()) as {
			client: Record<string, unknown>;
		};
		let unstated = (await (await register(baseBody())).json()) as {
			client: Record<string, unknown>;
		};

		expect(rs256.client.idTokenSignedResponseAlg).toBe("RS256");
		expect(unstated.client.idTokenSignedResponseAlg).toBe("ES256");
	});

	test("mints no secret for a public client", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token, {
				method: "POST",
				body: JSON.stringify(baseBody({ kind: "public", tokenEndpointAuthMethod: "none" })),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.secret).toBeNull();
	});

	test("answers a problem+json validation failure for an unknown grant type", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token, {
				method: "POST",
				body: JSON.stringify(baseBody({ grantTypes: ["not-a-real-grant"] })),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/invalid-grant-type");
	});

	test("answers a problem+json validation failure for a malformed body", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token, {
				method: "POST",
				body: JSON.stringify({ name: "Missing Fields" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(Array.isArray(body.errors)).toBe(true);
	});

	test("refuses a caller missing the clients:write scope", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token, {
				method: "POST",
				body: JSON.stringify(baseBody()),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/clients`, token, {
				method: "POST",
				body: JSON.stringify(baseBody()),
			}),
		);

		expect(response.status).toBe(403);
	});
});
