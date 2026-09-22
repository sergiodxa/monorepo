/**
 * Drives `POST /tenants/:tenantId/subjects/:subjectId/block` and
 * `POST /tenants/:tenantId/subjects/:subjectId/unblock` through the
 * management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

describe("POST /tenants/:tenantId/subjects/:subjectId/block", () => {
	test("blocks a subject", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/block`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "fraud" }),
			}),
		);

		expect(response.status).toBe(204);

		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({ ok: true, profile: { status: "blocked" } });
	});

	test("answers 404 for a subject the tenant does not hold", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/sub_missing/block`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "fraud" }),
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
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/block`, token, {
				method: "POST",
				body: JSON.stringify({ reason: "fraud" }),
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/subjects/:subjectId/unblock", () => {
	test("restores a blocked subject to active", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDO.blockSubject({ subjectId: created.subjectId, reason: "fraud" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/unblock`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(204);

		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({ ok: true, profile: { status: "active" } });
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/unblock`, token, {
				method: "POST",
			}),
		);

		expect(response.status).toBe(403);
	});
});
