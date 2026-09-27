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

	test("reads an application/merge-patch+json body, clearing a profile claim given null", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDO.updateSubject({
			subjectId: created.subjectId,
			profile: { name: "Jane Doe", nickname: "jd" },
			actor: { kind: "admin" },
		});

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "PATCH",
				headers: { "Content-Type": "application/merge-patch+json" },
				body: JSON.stringify({ profile: { nickname: null } }),
			}),
		);

		expect(response.status).toBe(204);
		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({ ok: true, profile: { name: "Jane Doe", nickname: null } });
	});

	test("removes an attribute given null, where it used to store null as its value", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();
		await harness.tenantDO.defineAttribute({ key: "plan", type: "string", visibility: "claim" });

		let created = await harness.tenantDO.createSubject({ attributes: { plan: "pro" } });
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "PATCH",
				headers: { "Content-Type": "application/merge-patch+json" },
				body: JSON.stringify({ attributes: { plan: null } }),
			}),
		);

		expect(response.status).toBe(204);
		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({ ok: true, attributes: {} });
	});

	test("answers 415 with Accept-Patch for a body in another media type", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}`, token, {
				method: "PATCH",
				headers: { "Content-Type": "text/plain" },
				body: "name=Jane",
			}),
		);

		expect(response.status).toBe(415);
		expect(response.headers.get("Accept-Patch")).toBe("application/merge-patch+json");
	});
});
