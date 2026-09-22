/**
 * Drives `GET /tenants/:tenantId/subjects/:subjectId/access` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildRolesHarness } from "~/app/http/controllers/management/roles/test-harness";

describe("GET /tenants/:tenantId/subjects/:subjectId/access", () => {
	test("reads the role a subject holds at a scope and its resolved permissions", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		let assigned = await harness.tenantDO.assignRole({
			subjectId: created.subjectId,
			scope: "tenant",
			roleKey: "owner",
			actor: { type: "platform", id: "system" },
		});
		expect(assigned.ok).toBe(true);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/access?scope=tenant`,
				token,
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.roles).toMatchObject([{ key: "owner" }]);
		expect(body.cost).toBeUndefined();
	});

	test("reads an empty summary for a subject holding no role at that scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/access?scope=tenant`,
				token,
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ roles: [], permissions: [] });
	});

	test("answers a problem+json validation failure when scope is missing", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/access`, token),
		);

		expect(response.status).toBe(400);
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/access?scope=tenant`,
				token,
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/access?scope=tenant`,
				token,
			),
		);

		expect(response.status).toBe(403);
	});
});
