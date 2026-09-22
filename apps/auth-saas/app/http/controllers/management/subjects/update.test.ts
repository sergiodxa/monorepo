/**
 * Drives `PATCH /tenants/:tenantId/subjects/:subjectId` through the
 * management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

describe("PATCH /tenants/:tenantId/subjects/:subjectId", () => {
	test("writes the given profile columns", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "PATCH",
				body: JSON.stringify({ profile: { name: "Jane Doe" } }),
			}),
		);

		expect(response.status).toBe(204);

		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({ ok: true, profile: { name: "Jane Doe" } });
	});

	test("answers 404 for a subject the tenant does not hold", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/sub_missing`, token, {
				method: "PATCH",
				body: JSON.stringify({ profile: { name: "Jane Doe" } }),
			}),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json validation failure for an unknown attribute", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "PATCH",
				body: JSON.stringify({ attributes: { plan: "pro" } }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/unknown-attribute");
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "PATCH",
				body: JSON.stringify({ profile: { name: "Jane Doe" } }),
			}),
		);

		expect(response.status).toBe(403);
	});
});
