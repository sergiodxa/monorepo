/**
 * Drives `DELETE /tenants/:tenantId/subjects/:subjectId` through the
 * management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

describe("DELETE /tenants/:tenantId/subjects/:subjectId", () => {
	test("deletes a subject", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);

		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("answers 404 for a subject the tenant does not hold", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/sub_missing`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildSubjectsHarness();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(403);
	});
});
