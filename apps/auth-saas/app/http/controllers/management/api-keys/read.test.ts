/**
 * Drives `GET /tenants/:tenantId/api-keys/:keyId` through the management
 * router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { ApiKeysHarness } from "~/app/http/controllers/management/api-keys/test-harness";
import type { AuditActor } from "~/database/audit-events";

import {
	buildApiKeysHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/api-keys/test-harness";

let ACTOR: AuditActor = { type: "platform", id: "system" };

/** A tenant entitled to machine-to-machine access, with its own key prefix set. */
async function provisionedHarness(): Promise<ApiKeysHarness> {
	let harness = await buildApiKeysHarness();
	await grantEntitlement(harness.tenantDO, "machine_access");
	await harness.tenantDO.setApiKeyPrefix({ prefix: "acme", actor: ACTOR });
	return harness;
}

describe("GET /tenants/:tenantId/api-keys/:keyId", () => {
	test("reads a key's own record", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let minted = await harness.tenantDO.createApiKey({
			subjectId: created.subjectId,
			name: "CI key",
			scopes: [],
			actor: ACTOR,
		});
		if (!minted.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${minted.key.id}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ id: minted.key.id, name: "CI key" });
		expect(body).not.toHaveProperty("secretHash");
	});

	test("answers 404 for a key the tenant does not hold", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/akey_missing`, token),
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the keys:write scope", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/akey_missing`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/akey_missing`, token),
		);

		expect(response.status).toBe(403);
	});
});
