/**
 * Drives `GET /tenants/:tenantId/subjects` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

describe("GET /tenants/:tenantId/subjects", () => {
	test("pages the tenant's subjects, newest first", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		await harness.tenantDO.createSubject({ identifiers: [{ kind: "username", value: "first" }] });
		await harness.tenantDO.createSubject({ identifiers: [{ kind: "username", value: "second" }] });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects?per_page=1`, token),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toContain('rel="next"');

		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
	});

	test("filters by status", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDO.blockSubject({ subjectId: created.subjectId, reason: "fraud" });
		await harness.tenantDO.createSubject({});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects?status=blocked`, token),
		);

		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toMatchObject([{ id: created.subjectId, status: "blocked" }]);
	});

	test("refuses a caller missing the subjects:read scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token),
		);

		expect(response.status).toBe(403);
	});

	test("answers 400 for a cursor this ordering did not mint", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects?cursor=not-a-real-cursor`, token),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
