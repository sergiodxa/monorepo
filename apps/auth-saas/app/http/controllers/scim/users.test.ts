/**
 * Drives `/scim/v2/Users*` through the tenant router with real HTTP requests,
 * the way `oauth/token.test.ts` drives the token endpoint: a full
 * create-to-delete lifecycle, the entitlement gate (and the billing-state
 * carve-out a `DELETE` and a pure `active: false` `PATCH` get), the
 * rate-limit gate, and a bearer token refused before either ever runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
} from "~/app/http/middleware/tenant";

import {
	buildScimHarness,
	buildScimRouter,
	createScimConnectionToken,
	fakeLimiter,
	ISSUER,
	setScimEntitled,
	spyOnStub,
	TENANT_ID,
} from "./test-harness";

/** A `Request` resolved to the fixture tenant, with no `Authorization` header at all. */
function tokenlessRequest(path: string, init: RequestInit = {}) {
	let headers = new Headers(init.headers);
	headers.set(TENANT_ID_HEADER, TENANT_ID);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, ISSUER);
	return new Request(`${ISSUER}${path}`, { ...init, headers });
}

describe("SCIM Users lifecycle", () => {
	test("create, read, replace (unchanged writes nothing), patch, deactivate, and delete", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);

		let createResponse = await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
					externalId: "ext-dana",
					userName: "dana@example.com",
					emails: [{ value: "dana@example.com", primary: true }],
					name: { givenName: "Dana" },
				}),
			}),
		);

		expect(createResponse.status).toBe(201);
		expect(createResponse.headers.get("Content-Type")).toBe("application/scim+json");
		let created = (await createResponse.json()) as Record<string, unknown>;
		expect(created.userName).toBe("dana@example.com");
		expect(created.active).toBe(true);
		let id = created.id as string;

		let readResponse = await harness.router.fetch(harness.request(`/scim/v2/Users/${id}`, token));
		expect(readResponse.status).toBe(200);
		let read = (await readResponse.json()) as Record<string, unknown>;
		expect(read.id).toBe(id);

		let replaceBody = {
			externalId: "ext-dana",
			userName: "dana@example.com",
			emails: [{ value: "dana@example.com", primary: true }],
			name: { givenName: "Dana" },
		};

		let replaceResponse = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${id}`, token, {
				method: "PUT",
				body: JSON.stringify(replaceBody),
			}),
		);
		expect(replaceResponse.status).toBe(200);
		let replaced = (await replaceResponse.json()) as Record<string, unknown>;
		expect(replaced.id).toBe(id);

		// Confirms the replace above wrote nothing, the same way `scim.test.ts`'s own
		// `scimReplaceUser` test does, by reading the `cost` envelope only the RPC
		// surface (not the HTTP layer) exposes.
		let replayed = await harness.tenantDO.scimReplaceUser({ token, id, resource: replaceBody });
		expect(replayed.ok).toBe(true);
		if (!replayed.ok) throw new Error("unreachable");
		expect(replayed.unchanged).toBe(true);
		expect(replayed.cost.rowsWritten).toBe(0);

		let patchResponse = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${id}`, token, {
				method: "PATCH",
				body: JSON.stringify({
					Operations: [{ op: "replace", path: "displayName", value: "Dana D." }],
				}),
			}),
		);
		expect(patchResponse.status).toBe(200);
		let patched = (await patchResponse.json()) as Record<string, unknown>;
		expect(patched.displayName).toBe("Dana D.");

		let deactivateResponse = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${id}`, token, {
				method: "PATCH",
				body: JSON.stringify({ Operations: [{ op: "replace", path: "active", value: false }] }),
			}),
		);
		expect(deactivateResponse.status).toBe(200);
		let deactivated = (await deactivateResponse.json()) as Record<string, unknown>;
		expect(deactivated.active).toBe(false);

		let deleteResponse = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${id}`, token, { method: "DELETE" }),
		);
		expect(deleteResponse.status).toBe(204);

		// The connection's default policy is `block`, so the link survives the delete.
		let afterDelete = await harness.router.fetch(harness.request(`/scim/v2/Users/${id}`, token));
		expect(afterDelete.status).toBe(200);
		let afterDeleteBody = (await afterDelete.json()) as Record<string, unknown>;
		expect(afterDeleteBody.active).toBe(false);
	});

	test("lists a page of provisioned users", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);

		await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-a",
					emails: [{ value: "a@example.com", primary: true }],
				}),
			}),
		);
		await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-b",
					emails: [{ value: "b@example.com", primary: true }],
				}),
			}),
		);

		let response = await harness.router.fetch(harness.request("/scim/v2/Users", token));
		expect(response.status).toBe(200);
		let body = (await response.json()) as { totalResults: number; Resources: unknown[] };
		expect(body.totalResults).toBe(2);
		expect(body.Resources).toHaveLength(2);
	});
});

describe("SCIM entitlement gate", () => {
	test("refuses a create when the tenant holds no scim feature", async () => {
		let harness = await buildScimHarness();
		let token = await createScimConnectionToken(harness.tenantDO);

		let response = await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "x@example.com", primary: true }],
				}),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.schemas).toEqual(["urn:ietf:params:scim:api:messages:2.0:Error"]);
	});

	test("admits a create once the tenant holds the scim feature", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);

		let response = await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "x@example.com", primary: true }],
				}),
			}),
		);

		expect(response.status).toBe(201);
	});

	test("admits a DELETE even after the entitlement has lapsed", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);
		let provisioned = await harness.tenantDO.scimProvisionUser({
			token,
			resource: { externalId: "ext-1", emails: [{ value: "y@example.com", primary: true }] },
		});
		if (!provisioned.ok) throw new Error("unreachable");

		await setScimEntitled(harness.tenantDO, false);

		let response = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${provisioned.representation.id}`, token, {
				method: "DELETE",
			}),
		);
		expect(response.status).toBe(204);
	});

	test("admits a pure active: false PATCH even after the entitlement has lapsed", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);
		let provisioned = await harness.tenantDO.scimProvisionUser({
			token,
			resource: { externalId: "ext-1", emails: [{ value: "y2@example.com", primary: true }] },
		});
		if (!provisioned.ok) throw new Error("unreachable");

		await setScimEntitled(harness.tenantDO, false);

		let response = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${provisioned.representation.id}`, token, {
				method: "PATCH",
				body: JSON.stringify({ Operations: [{ op: "replace", path: "active", value: false }] }),
			}),
		);
		expect(response.status).toBe(200);
	});

	test("still requires the entitlement when a PATCH also changes another attribute", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);
		let provisioned = await harness.tenantDO.scimProvisionUser({
			token,
			resource: { externalId: "ext-1", emails: [{ value: "y3@example.com", primary: true }] },
		});
		if (!provisioned.ok) throw new Error("unreachable");

		await setScimEntitled(harness.tenantDO, false);

		let response = await harness.router.fetch(
			harness.request(`/scim/v2/Users/${provisioned.representation.id}`, token, {
				method: "PATCH",
				body: JSON.stringify({
					Operations: [
						{ op: "replace", path: "active", value: false },
						{ op: "replace", path: "displayName", value: "New Name" },
					],
				}),
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("SCIM rate limiting", () => {
	test("refuses once the connection's write budget is spent", async () => {
		let limiter = fakeLimiter(false);
		let harness = await buildScimHarness({ limiter });
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);

		let response = await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "z@example.com", primary: true }],
				}),
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).not.toBeNull();
	});

	test("keys the limiter on the presented token's own digest, not a raw value or the caller's address", async () => {
		let limiter = fakeLimiter(true);
		let harness = await buildScimHarness({ limiter });
		await setScimEntitled(harness.tenantDO, true);
		let token = await createScimConnectionToken(harness.tenantDO);

		await harness.router.fetch(
			harness.request("/scim/v2/Users", token, {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "z2@example.com", primary: true }],
				}),
			}),
		);

		expect(limiter.calls).toHaveLength(1);
		expect(limiter.calls[0]?.key).not.toBe(token);
		expect(limiter.calls[0]?.key).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("SCIM bearer token", () => {
	test("refuses a missing token before any entitlement check or DO call", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let { calls, stub } = spyOnStub(harness.tenantDO);
		let router = buildScimRouter(stub, harness.limiter);

		let response = await router.fetch(
			tokenlessRequest("/scim/v2/Users", {
				method: "POST",
				headers: { "Content-Type": "application/scim+json" },
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "w@example.com", primary: true }],
				}),
			}),
		);

		expect(response.status).toBe(401);
		expect(calls).toHaveLength(0);
	});

	test("refuses a malformed Authorization header before any entitlement check or DO call", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);
		let { calls, stub } = spyOnStub(harness.tenantDO);
		let router = buildScimRouter(stub, harness.limiter);

		let response = await router.fetch(
			tokenlessRequest("/scim/v2/Users", {
				method: "POST",
				headers: {
					Authorization: "Basic not-a-bearer-token",
					"Content-Type": "application/scim+json",
				},
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "w2@example.com", primary: true }],
				}),
			}),
		);

		expect(response.status).toBe(401);
		expect(calls).toHaveLength(0);
	});

	test("refuses a well-formed but wrong bearer token, once resolved by the tenant object", async () => {
		let harness = await buildScimHarness();
		await setScimEntitled(harness.tenantDO, true);

		let response = await harness.router.fetch(
			harness.request("/scim/v2/Users", "scim_not-a-real-token", {
				method: "POST",
				body: JSON.stringify({
					externalId: "ext-1",
					emails: [{ value: "w3@example.com", primary: true }],
				}),
			}),
		);

		expect(response.status).toBe(401);
	});
});
