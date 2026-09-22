/**
 * Drives `POST .../password/force-reset` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildCredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";

describe("POST /tenants/:tenantId/subjects/:subjectId/password/force-reset", () => {
	test("marks a subject's current password as owing a change", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		let written = await harness.tenantDO.setPassword({
			subjectId: created.subjectId,
			password: "Zx9!fqPlm2AbC",
			actor: { kind: "admin" },
		});
		if (!written.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/password/force-reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ reason: "suspected_compromise" });
	});

	test("answers a problem+json not-found for an unknown subject", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/sub_missing/password/force-reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json conflict for a subject holding no password", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/password/force-reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/no-password");
	});

	test("answers a problem+json validation failure for a missing reason", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/password/force-reset`,
				token,
				{ method: "POST", body: JSON.stringify({}) },
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/password/force-reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/password/force-reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(403);
	});
});
