/**
 * Drives `/scim/v2/Groups*` through the tenant router with real HTTP
 * requests: create, read, a membership patch, list, and delete. The
 * entitlement and rate-limit gate is already covered end to end in
 * `users.test.ts`; this file only confirms the group wire mapping and PATCH
 * translation are wired correctly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PATCH_OP_SCHEMA } from "@sdxc/scim";
import { beforeEach, describe, expect, test } from "vitest";

import { buildScimHarness, createScimConnectionToken, setScimEntitled } from "./test-harness";

let harness: Awaited<ReturnType<typeof buildScimHarness>>;
let token: string;

beforeEach(async () => {
	harness = await buildScimHarness();
	await setScimEntitled(harness.tenantDO, true);
	token = await createScimConnectionToken(harness.tenantDO);
});

/** Creates a bare subject directly on the tenant object, for a group's membership. */
async function createMember(email: string): Promise<string> {
	let created = await harness.tenantDO.createSubject({
		identifiers: [{ kind: "email", value: email }],
	});
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

describe("SCIM Groups lifecycle", () => {
	test("creates, reads, patches membership, lists, and deletes a group", async () => {
		let memberId = await createMember("member-1@example.com");

		let createResponse = await harness.router.fetch(
			harness.request("/scim/v2/Groups", token, {
				method: "POST",
				body: JSON.stringify({
					schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
					externalId: "ext-engineering",
					displayName: "Engineering",
					members: [{ value: memberId }],
				}),
			}),
		);

		expect(createResponse.status).toBe(201);
		expect(createResponse.headers.get("Content-Type")).toBe("application/scim+json");
		let created = (await createResponse.json()) as Record<string, unknown>;
		expect(created.displayName).toBe("Engineering");
		expect(created.members).toEqual([{ value: memberId }]);
		let id = created.id as string;

		let readResponse = await harness.router.fetch(harness.request(`/scim/v2/Groups/${id}`, token));
		expect(readResponse.status).toBe(200);

		let secondMemberId = await createMember("member-2@example.com");
		let patchResponse = await harness.router.fetch(
			harness.request(`/scim/v2/Groups/${id}`, token, {
				method: "PATCH",
				body: JSON.stringify({
					schemas: [PATCH_OP_SCHEMA],
					Operations: [
						{ op: "add", path: "members", value: [{ value: secondMemberId }] },
						{ op: "remove", path: `members[value eq "${memberId}"]` },
					],
				}),
			}),
		);
		expect(patchResponse.status).toBe(200);
		let patched = (await patchResponse.json()) as Record<string, unknown>;
		expect(patched.members).toEqual([{ value: secondMemberId }]);

		let listResponse = await harness.router.fetch(harness.request("/scim/v2/Groups", token));
		expect(listResponse.status).toBe(200);
		let list = (await listResponse.json()) as { totalResults: number };
		expect(list.totalResults).toBe(1);

		let deleteResponse = await harness.router.fetch(
			harness.request(`/scim/v2/Groups/${id}`, token, { method: "DELETE" }),
		);
		expect(deleteResponse.status).toBe(204);

		let afterDelete = await harness.router.fetch(harness.request(`/scim/v2/Groups/${id}`, token));
		expect(afterDelete.status).toBe(404);
	});

	test("refuses an unsupported PATCH form with invalidPath", async () => {
		let createResponse = await harness.router.fetch(
			harness.request("/scim/v2/Groups", token, {
				method: "POST",
				body: JSON.stringify({ externalId: "ext-sales", displayName: "Sales" }),
			}),
		);
		let created = (await createResponse.json()) as { id: string };

		let response = await harness.router.fetch(
			harness.request(`/scim/v2/Groups/${created.id}`, token, {
				method: "PATCH",
				body: JSON.stringify({
					schemas: [PATCH_OP_SCHEMA],
					Operations: [{ op: "replace", path: "externalId", value: "ext-other" }],
				}),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.scimType).toBe("invalidPath");
	});
});
