/**
 * Drives the identifier sub-resource routes through the management router:
 * add, verify, set-primary and remove.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

describe("POST /tenants/:tenantId/subjects/:subjectId/identifiers", () => {
	test("claims a new identifier, minting a ticket for an email", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers`,
				token,
				{ method: "POST", body: JSON.stringify({ kind: "email", value: "jane@example.com" }) },
			),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ kind: "email", value: "jane@example.com" });
		expect(typeof body.ticket).toBe("string");
	});

	test("answers 404 for a subject the tenant does not hold", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/sub_missing/identifiers`, token, {
				method: "POST",
				body: JSON.stringify({ kind: "email", value: "jane@example.com" }),
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
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers`,
				token,
				{ method: "POST", body: JSON.stringify({ kind: "email", value: "jane@example.com" }) },
			),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/subjects/identifiers/verify", () => {
	test("spends a verification ticket", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await harness.tenantDO.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: { kind: "admin" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/identifiers/verify`, token, {
				method: "POST",
				body: JSON.stringify({ ticket: added.ticket }),
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ subjectId: created.subjectId, promotedPrimary: true });
	});

	test("answers a problem+json failure for an invalid ticket", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/identifiers/verify`, token, {
				method: "POST",
				body: JSON.stringify({ ticket: "not-a-real-ticket" }),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/invalid-ticket");
	});
});

describe("POST /tenants/:tenantId/subjects/:subjectId/identifiers/primary", () => {
	test("moves the primary identifier to a verified address", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let firstAdded = await harness.tenantDO.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "first@example.com",
			actor: { kind: "admin" },
		});
		if (!firstAdded.ok || firstAdded.kind !== "email") throw new Error("unreachable");
		await harness.tenantDO.verifyIdentifier({ ticket: firstAdded.ticket });

		let secondAdded = await harness.tenantDO.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "second@example.com",
			actor: { kind: "admin" },
		});
		if (!secondAdded.ok || secondAdded.kind !== "email") throw new Error("unreachable");
		await harness.tenantDO.verifyIdentifier({ ticket: secondAdded.ticket });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers/primary`,
				token,
				{ method: "POST", body: JSON.stringify({ value: "second@example.com" }) },
			),
		);

		expect(response.status).toBe(204);

		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({
			ok: true,
			identifiers: expect.arrayContaining([
				expect.objectContaining({ value: "second@example.com", isPrimary: true }),
			]),
		});
	});

	test("answers 409 for an unverified identifier", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let added = await harness.tenantDO.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: { kind: "admin" },
		});
		if (!added.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers/primary`,
				token,
				{ method: "POST", body: JSON.stringify({ value: "jane@example.com" }) },
			),
		);

		expect(response.status).toBe(409);
	});
});

describe("DELETE /tenants/:tenantId/subjects/:subjectId/identifiers/:value", () => {
	test("removes an identifier", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({
			identifiers: [
				{ kind: "username", value: "jane" },
				{ kind: "email", value: "jane@example.com" },
			],
		});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers/${encodeURIComponent("jane")}`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toHaveProperty("promotedPrimary");
		expect(body).toHaveProperty("notify");

		let described = await harness.tenantDO.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		expect(described).toMatchObject({
			ok: true,
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
	});

	test("answers 404 for an identifier this subject does not hold", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers/missing`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({
			identifiers: [{ kind: "username", value: "jane" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/identifiers/jane`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});
});
