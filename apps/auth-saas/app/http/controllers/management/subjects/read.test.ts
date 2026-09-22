/**
 * Drives `GET /tenants/:tenantId/subjects/:subjectId` through the management
 * router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildSubjectsHarness,
	grantMembership,
} from "~/app/http/controllers/management/subjects/test-harness";

describe("GET /tenants/:tenantId/subjects/:subjectId", () => {
	test("reads a subject's assembled profile", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			profile: { id: created.subjectId, status: "active" },
			identifiers: [{ kind: "username", value: "jane" }],
		});
		expect(body).not.toHaveProperty("cost");
		expect(body).not.toHaveProperty("ok");
	});

	test("resolves a caller from a dashboard session's membership role", async () => {
		let harness = await buildSubjectsHarness({
			resolveDashboardSubjectId: async () => "sub_member_1",
		});

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await grantMembership(harness.db, harness.tenantId, "sub_member_1", "member");

		let response = await harness.router.fetch(
			new Request(
				`https://api.example.com/tenants/${harness.tenantId}/subjects/${created.subjectId}`,
			),
		);

		expect(response.status).toBe(200);
	});

	test("answers 404 for a subject the tenant does not hold", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/sub_missing`, token),
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the subjects:read scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildSubjectsHarness();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token),
		);

		expect(response.status).toBe(403);
	});
});
