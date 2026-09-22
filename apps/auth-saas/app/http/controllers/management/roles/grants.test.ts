/**
 * Drives `GET /tenants/:tenantId/subjects/:subjectId/grants` and `POST
 * .../grants/:clientId/revoke` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import { buildRolesHarness } from "~/app/http/controllers/management/roles/test-harness";
import { grants } from "~/database/consent";

describe("GET /tenants/:tenantId/subjects/:subjectId/grants", () => {
	test("pages a subject's own grants, most recently agreed to first", async () => {
		let harness = await buildRolesHarness({ defaultScope: "subjects:read" });
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
		await harness.tenantDb.create(grants, {
			subject_id: created.subjectId,
			client_id: "client_first",
			scopes: ["openid"],
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		vi.setSystemTime(1_700_000_000_000 + 1000);
		await harness.tenantDb.create(grants, {
			subject_id: created.subjectId,
			client_id: "client_second",
			scopes: ["openid"],
			created_at: Date.now(),
			updated_at: Date.now(),
		});
		vi.useRealTimers();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants?per_page=1`,
				token,
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toContain('rel="next"');
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0]).toMatchObject({ clientId: "client_second" });
	});

	test("answers 400 for a cursor this ordering did not mint", async () => {
		let harness = await buildRolesHarness({ defaultScope: "subjects:read" });
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants?cursor=not-a-real-cursor`,
				token,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the subjects:read scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ scope: "members:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness({ defaultScope: "subjects:read" });
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants`, token),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/subjects/:subjectId/grants/:clientId/revoke", () => {
	test("revokes a subject's standing grant for one client", async () => {
		let harness = await buildRolesHarness({ defaultScope: "subjects:write" });
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDb.create(grants, {
			subject_id: created.subjectId,
			client_id: "client_1",
			scopes: ["openid"],
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants/client_1/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(204);
	});

	test("answers a problem+json not-found for a grant this subject does not hold", async () => {
		let harness = await buildRolesHarness({ defaultScope: "subjects:write" });
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants/client_does_not_exist/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildRolesHarness();
		let token = await harness.signToken({ scope: "subjects:read" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants/client_1/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildRolesHarness({ defaultScope: "subjects:write" });
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/grants/client_1/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});
});
