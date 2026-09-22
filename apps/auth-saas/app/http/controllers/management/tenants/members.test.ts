/**
 * Drives every member route through the management router: `GET
 * /tenants/:tenantId/members` lists them, `POST .../members` grants a
 * subject access at a role, `PUT .../members/:membershipId` changes one's
 * role, and `DELETE .../members/:membershipId` revokes one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildTenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";
import Membership from "~/app/models/membership";

describe("GET /tenants/:tenantId/members", () => {
	test("lists the tenant's own memberships", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		await Membership.create(harness.db, {
			tenantId: harness.tenantId,
			subjectId: "sub_1",
			role: "admin",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toMatchObject([{ subjectId: "sub_1", role: "admin" }]);
	});

	test("refuses a caller missing the members:write scope", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members`, token),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/members", () => {
	test("grants a subject access to the tenant at a role", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId: "sub_1", role: "member" }),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ tenantId: harness.tenantId, subjectId: "sub_1", role: "member" });
	});

	test("answers a problem+json validation failure for a missing role", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members`, token, {
				method: "POST",
				body: JSON.stringify({ subjectId: "sub_1" }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});

describe("PUT /tenants/:tenantId/members/:membershipId", () => {
	test("changes a membership's role", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let membership = await Membership.create(harness.db, {
			tenantId: harness.tenantId,
			subjectId: "sub_1",
			role: "member",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${membership.id}`, token, {
				method: "PUT",
				body: JSON.stringify({ role: "admin" }),
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ id: membership.id, role: "admin" });
	});

	test("answers 404 for a membership another tenant holds", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let otherMembership = await Membership.create(harness.db, {
			tenantId: harness.otherTenantId,
			subjectId: "sub_1",
			role: "member",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${otherMembership.id}`, token, {
				method: "PUT",
				body: JSON.stringify({ role: "admin" }),
			}),
		);

		expect(response.status).toBe(404);
	});
});

describe("DELETE /tenants/:tenantId/members/:membershipId", () => {
	test("revokes a subject's access to the tenant", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let membership = await Membership.create(harness.db, {
			tenantId: harness.tenantId,
			subjectId: "sub_1",
			role: "member",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${membership.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);

		let remaining = await Membership.listByTenant(harness.db, harness.tenantId);
		expect(remaining.find((row) => row.id === membership.id)).toBeUndefined();
	});

	test("answers 404 for a membership another tenant holds, leaving it untouched", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let otherMembership = await Membership.create(harness.db, {
			tenantId: harness.otherTenantId,
			subjectId: "sub_1",
			role: "member",
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${otherMembership.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
		expect(await Membership.listByTenant(harness.db, harness.otherTenantId)).toHaveLength(1);
	});
});
