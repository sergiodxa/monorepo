/**
 * Drives `POST /tenants/:tenantId/api-keys` through the management router.
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
import { assignRole, definePermission, TENANT_SCOPE } from "~/database/roles";

let ACTOR: AuditActor = { type: "platform", id: "system" };

/** A tenant entitled to machine-to-machine access, with its own key prefix set. */
async function provisionedHarness(): Promise<ApiKeysHarness> {
	let harness = await buildApiKeysHarness();
	await grantEntitlement(harness.tenantDO, "machine_access");
	await harness.tenantDO.setApiKeyPrefix({ prefix: "acme", actor: ACTOR });
	return harness;
}

/**
 * A subject granted the `owner` system role, so it holds every declared
 * scope. Declares each permission and assigns the role directly against
 * `tenantDb`, the same bypass `database/api-keys.test.ts` uses, since custom
 * roles are their own entitlement this test has no need to grant.
 */
async function createSubjectHolding(harness: ApiKeysHarness, scopes: string[]): Promise<string> {
	let created = await harness.tenantDO.createSubject({});
	if (!created.ok) throw new Error("unreachable");

	for (let scope of scopes) {
		await definePermission(harness.tenantDb, {
			key: scope,
			name: scope,
			description: scope,
			actor: ACTOR,
		});
	}

	let assigned = await assignRole(harness.tenantDb, {
		subjectId: created.subjectId,
		scope: TENANT_SCOPE,
		roleKey: "owner",
		actor: ACTOR,
	});
	if (!assigned.ok) throw new Error("unreachable");

	return created.subjectId;
}

describe("POST /tenants/:tenantId/api-keys", () => {
	test("mints a key for a subject holding the requested scopes", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let subjectId = await createSubjectHolding(harness, ["keys.read"]);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId, name: "CI key", scopes: ["keys.read"] }),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.key).toMatchObject({ subjectId, name: "CI key", scopes: ["keys.read"] });
		expect(body.value).toMatch(/^acme_/);
	});

	test("answers a problem+json conflict before this tenant's own prefix has been set", async () => {
		let harness = await buildApiKeysHarness();
		await grantEntitlement(harness.tenantDO, "machine_access");
		let token = await harness.signToken();
		let subjectId = await createSubjectHolding(harness, []);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId, name: "CI key", scopes: [] }),
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/prefix-not-set");
	});

	test("answers a problem+json validation failure for a scope the subject does not hold", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let subjectId = await createSubjectHolding(harness, ["keys.read"]);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId, name: "CI key", scopes: ["keys.delete"] }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/scope-not-held");
	});

	test("answers a problem+json validation failure for an expiry more than 365 days out", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let subjectId = await createSubjectHolding(harness, []);
		let now = Date.now();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({
					subjectId,
					name: "CI key",
					scopes: [],
					expiresAt: now + 400 * 24 * 60 * 60 * 1000,
				}),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/expiry-too-far");
	});

	test("answers a problem+json entitlement failure distinct from a scope refusal", async () => {
		let harness = await buildApiKeysHarness();
		let token = await harness.signToken();
		let subjectId = await createSubjectHolding(harness, []);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId, name: "CI key", scopes: [] }),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/entitlement-required");
	});

	test("answers a problem+json validation failure for a malformed body", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ name: "Missing Fields" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(Array.isArray(body.errors)).toBe(true);
	});

	test("refuses a caller missing the keys:write scope", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ scope: "subjects:read" });
		let subjectId = await createSubjectHolding(harness, []);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId, name: "CI key", scopes: [] }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });
		let subjectId = await createSubjectHolding(harness, []);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId, name: "CI key", scopes: [] }),
			}),
		);

		expect(response.status).toBe(403);
	});
});
