/**
 * Drives `POST /tenants/:tenantId/subjects` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

describe("POST /tenants/:tenantId/subjects", () => {
	test("creates a subject with its claimed identifiers", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				body: JSON.stringify({ identifiers: [{ kind: "username", value: "jane" }] }),
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.subjectId).toEqual(expect.stringMatching(/^sub_/));
		expect(body.identifiers).toMatchObject([{ kind: "username", value: "jane" }]);
	});

	test("answers a problem+json validation failure for a taken identifier", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				body: JSON.stringify({ identifiers: [{ kind: "username", value: "jane" }] }),
			}),
		);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				body: JSON.stringify({ identifiers: [{ kind: "username", value: "jane" }] }),
			}),
		);

		expect(response.status).toBe(409);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/identifier-taken");
	});

	test("answers a problem+json validation failure for a malformed body", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				body: JSON.stringify({ identifiers: [{ kind: "carrier-pigeon", value: "jane" }] }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		let body = (await response.json()) as Record<string, unknown>;
		expect(Array.isArray(body.errors)).toBe(true);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				body: JSON.stringify({ identifiers: [{ kind: "username", value: "jane" }] }),
			}),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				body: JSON.stringify({ identifiers: [{ kind: "username", value: "jane" }] }),
			}),
		);

		expect(response.status).toBe(403);
	});
});
