/**
 * Drives `POST /tenants/:tenantId/api-keys/:keyId/rotate` through the
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
import { apiKeySettings } from "~/database/api-keys";

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

describe("POST /tenants/:tenantId/api-keys/:keyId/rotate", () => {
	test("mints a successor and opens the incumbent's overlap window", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let keyId = await mintKey(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/rotate`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.value).toMatch(/^acme_/);
		expect(body.incumbentExpiresAt).toEqual(expect.any(Number));
	});

	test("answers a problem+json validation failure for an overlap over thirty days", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let keyId = await mintKey(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/rotate`, token, {
				method: "POST",
				body: JSON.stringify({ overlap: 31 }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/overlap-too-long");
	});

	test("answers 404 for a key the tenant does not hold", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/akey_missing/rotate`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json conflict when this tenant has no prefix of its own set", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let keyId = await mintKey(harness);

		await harness.tenantDb.delete(apiKeySettings, { id: "current" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/rotate`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/prefix-not-set");
	});

	test("answers a problem+json entitlement failure distinct from a scope refusal", async () => {
		let harness = await buildApiKeysHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/akey_missing/rotate`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
	});

	test("refuses a caller missing the keys:write scope", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ scope: "subjects:read" });
		let keyId = await mintKey(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/rotate`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await provisionedHarness();
		let keyId = await mintKey(harness);
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys/${keyId}/rotate`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(403);
	});
});
