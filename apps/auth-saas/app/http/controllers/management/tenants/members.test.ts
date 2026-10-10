/**
 * Drives every member route through the management router: `GET
 * /tenants/:tenantId/members` lists them, `POST .../members` grants a
 * subject access at a role, `PUT .../members/:membershipId` changes one's
 * role, and `DELETE .../members/:membershipId` revokes one — neither ever
 * leaving the tenant without an owner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { buildTenantsHarness } from "~/app/http/controllers/management/tenants/test-harness";
import { bindModels } from "~/app/test/models";

describe("GET /tenants/:tenantId/members", () => {
	test("lists the tenant's own memberships", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "admin",
			}),
		);

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

		let membership = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "member",
			}),
		);

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

		let otherMembership = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.otherTenantId,
				subject_id: "sub_1",
				role: "member",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${otherMembership.id}`, token, {
				method: "PUT",
				body: JSON.stringify({ role: "admin" }),
			}),
		);

		expect(response.status).toBe(404);
	});

	test("refuses to demote the tenant's last owner, leaving the role unchanged", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let owner = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "owner",
			}),
		);
		unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.otherTenantId,
				subject_id: "sub_2",
				role: "owner",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${owner.id}`, token, {
				method: "PUT",
				body: JSON.stringify({ role: "admin" }),
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as { type: string };
		expect(body.type).toBe("https://docs.example.com/errors/last-owner");
		expect(
			await bindModels(harness.db).memberships.findByTenantAndSubject(harness.tenantId, "sub_1"),
		).toMatchObject({ role: "owner" });
	});

	test("demotes an owner while another owner remains", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let owner = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "owner",
			}),
		);
		unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_2",
				role: "owner",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${owner.id}`, token, {
				method: "PUT",
				body: JSON.stringify({ role: "admin" }),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ id: owner.id, role: "admin" });
	});
});

describe("DELETE /tenants/:tenantId/members/:membershipId", () => {
	test("revokes a subject's access to the tenant", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let membership = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "member",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${membership.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);

		let remaining = await bindModels(harness.db).memberships.ofTenant(harness.tenantId).all();
		expect(remaining.find((row) => row.id === membership.id)).toBeUndefined();
	});

	test("answers 404 for a membership another tenant holds, leaving it untouched", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let otherMembership = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.otherTenantId,
				subject_id: "sub_1",
				role: "member",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${otherMembership.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
		expect(
			await bindModels(harness.db).memberships.ofTenant(harness.otherTenantId).all(),
		).toHaveLength(1);
	});

	test("refuses to remove the tenant's last owner, keeping the membership", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let owner = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "owner",
			}),
		);
		unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_2",
				role: "admin",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${owner.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as { type: string };
		expect(body.type).toBe("https://docs.example.com/errors/last-owner");
		expect(await bindModels(harness.db).memberships.ofTenant(harness.tenantId).all()).toHaveLength(
			2,
		);
	});

	test("removes an owner while another owner remains", async () => {
		let harness = await buildTenantsHarness();
		let token = await harness.signToken();

		let owner = unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_1",
				role: "owner",
			}),
		);
		unwrap(
			await bindModels(harness.db).memberships.create({
				tenant_id: harness.tenantId,
				subject_id: "sub_2",
				role: "owner",
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/members/${owner.id}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);
		expect(await bindModels(harness.db).memberships.ofTenant(harness.tenantId).all()).toMatchObject(
			[{ subject_id: "sub_2" }],
		);
	});
});
