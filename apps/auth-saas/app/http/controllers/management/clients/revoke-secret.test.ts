/**
 * Drives `POST /tenants/:tenantId/clients/:clientId/secrets/:secretId/revoke`
 * through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildClientsHarness } from "~/app/http/controllers/management/clients/test-harness";
import { clientSecrets } from "~/database/clients";

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

describe("POST /tenants/:tenantId/clients/:clientId/secrets/:secretId/revoke", () => {
	test("closes a live secret's window immediately", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");
		let rotated = await harness.tenantDO.rotateClientSecret({ clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/secrets/${rotated.secretId}/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(204);
	});

	test("answers 404 for a secret this client does not hold", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/secrets/csec_missing/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json conflict for a client's only live secret", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");

		let rows = await harness.tenantDb.findMany(clientSecrets, {
			where: { client_id: created.client.id },
		});
		let onlySecretId = rows[0]?.id;
		if (!onlySecretId) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/secrets/${onlySecretId}/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/last-live-secret");
	});

	test("refuses a caller missing the clients:write scope", async () => {
		let harness = await buildClientsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.registerClient(baseInput());
		if (!created.ok) throw new Error("unreachable");
		let rotated = await harness.tenantDO.rotateClientSecret({ clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/secrets/${rotated.secretId}/revoke`,
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
		let rotated = await harness.tenantDO.rotateClientSecret({ clientId: created.client.id });
		if (!rotated.ok) throw new Error("unreachable");

		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/clients/${created.client.id}/secrets/${rotated.secretId}/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});
});
