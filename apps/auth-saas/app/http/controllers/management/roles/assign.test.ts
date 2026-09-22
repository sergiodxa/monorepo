/**
 * Drives `POST /tenants/:tenantId/subjects/:subjectId/roles` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildRolesHarness } from "~/app/http/controllers/management/roles/test-harness";

describe("POST /tenants/:tenantId/subjects/:subjectId/roles", () => {
	test("assigns a role to a subject at the tenant scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", roleKey: "owner" }),
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ roleKey: "owner" });
	});

	test("answers a problem+json not-found for a subject this tenant does not hold", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/sub_does_not_exist/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", roleKey: "owner" }),
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json conflict for the scope's last owner", async () => {
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
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", roleKey: "member" }),
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/last-owner");
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", roleKey: "owner" }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", roleKey: "owner" }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("is never gated by the custom_roles entitlement", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/roles`, token, {
				method: "POST",
				body: JSON.stringify({ scope: "tenant", roleKey: "owner" }),
			}),
		);

		expect(response.status).toBe(200);
	});
});
