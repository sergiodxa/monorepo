/**
 * Drives `GET /tenants/:tenantId/audit-events` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { AuditHarness } from "~/app/http/controllers/management/audit/test-harness";

import { buildAuditHarness } from "~/app/http/controllers/management/audit/test-harness";
import { sessions } from "~/database/sessions";

/** Inserts a live session row directly, the row shape `openSession` would have stored. */
async function insertSession(
	harness: AuditHarness,
	input: { subjectId: string; sessionId: string },
) {
	let now = Date.now();

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

describe("GET /tenants/:tenantId/audit-events", () => {
	test("reads a page of the tenant's own audit log", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/audit-events?from=0&to=${Date.now() + 60_000}`,
				token,
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toMatchObject([
			{ action: "subject.created", targetType: "subject", targetId: created.subjectId },
		]);
	});

	test("filters by the given time window", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken();

		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
		let early = await harness.tenantDO.createSubject({});
		if (!early.ok) throw new Error("unreachable");

		vi.setSystemTime(1_700_000_100_000);
		let late = await harness.tenantDO.createSubject({});
		if (!late.ok) throw new Error("unreachable");
		vi.useRealTimers();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/audit-events?from=1700000050000&to=1700000150000`,
				token,
			),
		);

		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toMatchObject([{ targetId: late.subjectId }]);
		expect(body).toHaveLength(1);
	});

	test("filters by action, actor id and target id", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken();

		let subjectA = await harness.tenantDO.createSubject({});
		if (!subjectA.ok) throw new Error("unreachable");
		let subjectB = await harness.tenantDO.createSubject({});
		if (!subjectB.ok) throw new Error("unreachable");

		await insertSession(harness, { subjectId: subjectA.subjectId, sessionId: "sess_1" });
		let revoked = await harness.tenantDO.revokeSession({
			subjectId: subjectA.subjectId,
			sessionId: "sess_1",
			reason: "admin_revoked",
			actor: { type: "client", id: "mgmt_client_1" },
		});
		if (!revoked.ok) throw new Error("unreachable");

		let window = `from=0&to=${Date.now() + 60_000}`;

		let byAction = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/audit-events?${window}&action=session.revoked`,
				token,
			),
		);
		let byActionBody = (await byAction.json()) as Array<Record<string, unknown>>;
		expect(byActionBody).toMatchObject([{ action: "session.revoked" }]);

		let byActor = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/audit-events?${window}&actor_id=mgmt_client_1`,
				token,
			),
		);
		let byActorBody = (await byActor.json()) as Array<Record<string, unknown>>;
		expect(byActorBody).toMatchObject([{ actorType: "client", actorId: "mgmt_client_1" }]);

		let byTarget = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/audit-events?${window}&target_id=${subjectB.subjectId}`,
				token,
			),
		);
		let byTargetBody = (await byTarget.json()) as Array<Record<string, unknown>>;
		expect(byTargetBody).toMatchObject([
			{ action: "subject.created", targetId: subjectB.subjectId },
		]);
	});

	test("refuses a caller missing the audit:read scope", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken({ scope: "subjects:write" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/audit-events?from=0&to=${Date.now()}`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/audit-events?from=0&to=${Date.now()}`, token),
		);

		expect(response.status).toBe(403);
	});

	test("answers a problem+json validation failure for a missing time window", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/audit-events`, token),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("answers a problem+json bad cursor for a cursor this ordering did not mint", async () => {
		let harness = await buildAuditHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/audit-events?from=0&to=${Date.now()}&cursor=not-a-real-cursor`,
				token,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
