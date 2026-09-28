/**
 * Drives `GET .../sessions`, `DELETE .../sessions/:sessionId` and `POST
 * .../sessions/revoke-all` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { CredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";

import { buildCredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";
import { readAuditPage } from "~/database/audit-events";
import { sessions } from "~/database/sessions";

/** Inserts a live session row directly, the row shape `openSession` would have stored. */
async function insertSession(
	harness: CredentialsHarness,
	input: { subjectId: string; sessionId: string; createdAt?: number },
) {
	let now = input.createdAt ?? Date.now();

	await harness.tenantDb.create(sessions, {
		id: input.sessionId,
		token_hash: `hash-${input.sessionId}`,
		subject_id: input.subjectId,
		created_at: now,
		auth_time: now,
		last_seen_at: now,
		expires_at: now + 60_000,
		idle_expires_at: now + 60_000,
		amr: ["pwd"],
		remembered: false,
		acr: null,
		active_organization_id: null,
		ip: null,
		user_agent: null,
		country: null,
		region: null,
		city: null,
		revoked_at: null,
		revoked_reason: null,
	});
}

describe("GET /tenants/:tenantId/subjects/:subjectId/sessions", () => {
	test("pages a subject's own sessions, newest first", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_first" });

		vi.setSystemTime(1_700_000_000_000 + 1000);
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_second" });
		vi.useRealTimers();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions?per_page=1`,
				token,
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toContain('rel="next"');
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0]).toMatchObject({ id: "sess_second", isCurrent: false });
	});

	test("answers a problem+json bad cursor for a cursor this ordering did not mint", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions?cursor=not-a-real-cursor`,
				token,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the sessions:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({
			scope: "sessions:write",
			tenantId: harness.otherTenantId,
		});

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions`, token),
		);

		expect(response.status).toBe(403);
	});
});

describe("DELETE /tenants/:tenantId/subjects/:subjectId/sessions/:sessionId", () => {
	test("revokes one of a subject's sessions", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/sess_1?reason=admin_revoked`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(204);
	});

	test("attributes the revocation to the calling management client, not the subject", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/sess_1?reason=admin_revoked`,
				token,
				{ method: "DELETE" },
			),
		);
		expect(response.status).toBe(204);

		let page = await readAuditPage(harness.tenantDb, {
			from: 0,
			to: Date.now() + 60_000,
			action: "session.revoked",
		});
		if (!page.ok) throw new Error("unreachable");
		expect(page.events).toMatchObject([{ actorType: "client", actorId: expect.any(String) }]);
	});

	test("answers a problem+json not-found for a session this subject does not hold", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/sess_missing?reason=admin_revoked`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json validation failure for a missing reason", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/sess_1`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the sessions:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/sess_1?reason=admin_revoked`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({
			scope: "sessions:write",
			tenantId: harness.otherTenantId,
		});

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/sess_1?reason=admin_revoked`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/subjects/:subjectId/sessions/revoke-all", () => {
	test("revokes every live session a subject holds", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_1" });
		await insertSession(harness, { subjectId: created.subjectId, sessionId: "sess_2" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/revoke-all`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "admin_revoked" }) },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toEqual({ revoked: 2 });
	});

	test("answers a problem+json validation failure for a missing reason", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/revoke-all`,
				token,
				{ method: "POST", body: JSON.stringify({}) },
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the sessions:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/revoke-all`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "admin_revoked" }) },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({
			scope: "sessions:write",
			tenantId: harness.otherTenantId,
		});

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/sessions/revoke-all`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "admin_revoked" }) },
			),
		);

		expect(response.status).toBe(403);
	});
});
