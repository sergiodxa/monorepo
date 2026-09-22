/**
 * Drives `POST /tenants/:tenantId/api-keys/:keyId/revoke` through the
 * management router.
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

/** Mints a ready-to-use key for a freshly created subject. */
async function mintKey(harness: ApiKeysHarness): Promise<string> {
	let created = await harness.tenantDO.createSubject({});
	if (!created.ok) throw new Error("unreachable");

	let minted = await harness.tenantDO.createApiKey({
		subjectId: created.subjectId,
		name: "CI key",
		scopes: [],
		actor: ACTOR,
	});
	if (!minted.ok) throw new Error("unreachable");

	return minted.key.id;
}

describe("POST /tenants/:tenantId/api-keys/:keyId/revoke", () => {
	test("revokes a key at once", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let keyId = await mintKey(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/revoke`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "compromised" }),
			}),
		);

		expect(response.status).toBe(204);

		let read = await harness.tenantDO.readApiKey({ keyId });
		expect(read).toMatchObject({ ok: true, key: { revokedAt: expect.any(Number) } });
	});

	test("answers 404 for a key the tenant does not hold", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/akey_missing/revoke`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "compromised" }),
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json validation failure for a malformed body", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let keyId = await mintKey(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/revoke`, token, {
				method: "POST",
				body: JSON.stringify({}),
			}),
		);

		expect(response.status).toBe(400);
	});

	test("refuses a caller missing the keys:write scope", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ scope: "subjects:read" });
		let keyId = await mintKey(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/revoke`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "compromised" }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await provisionedHarness();
		let keyId = await mintKey(harness);
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/revoke`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "compromised" }),
			}),
		);

		expect(response.status).toBe(403);
	});
});
