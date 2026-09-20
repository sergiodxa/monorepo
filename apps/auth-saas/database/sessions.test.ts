/**
 * Drives `sessions.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `passkeys.test.ts` drives the tenant object's passkey
 * functions: nothing here can wire a new RPC method onto the tenant object, so these
 * functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
	listSubjectSessions,
	openSession,
	resolveSession,
	revokeSession,
	revokeSubjectSessions,
	sessions,
	sweepExpiredSessions,
} from "./sessions";
import { createSubject } from "./subjects";
import { runMigrations } from "./tenant-migrations";
import sessionsMigration from "./tenant-migrations/0005-sessions.sql?raw";

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(sessionsMigration);
	db = new Database(driver);
});

afterEach(() => {
	vi.useRealTimers();
});

/** Creates a bare subject with a username, the shape most tests open a session for. */
async function createTestSubject(username = "jane"): Promise<string> {
	let created = await createSubject(db, { identifiers: [{ kind: "username", value: username }] });
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

describe("openSession", () => {
	test("mints a token that resolves back to the subject", async () => {
		let subjectId = await createTestSubject();

		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		expect(opened.sessionId).toMatch(/^sess_/);
		expect(opened.expiresAt).toBeGreaterThan(opened.authTime);
		expect(opened.idleExpiresAt).toBeGreaterThan(opened.authTime);

		let resolved = await resolveSession(db, { token: opened.token });

		expect(resolved).toEqual({
			status: "active",
			sessionId: opened.sessionId,
			subjectId,
			authTime: opened.authTime,
			amr: ["pwd"],
			expiresAt: opened.expiresAt,
			idleExpiresAt: opened.idleExpiresAt,
		});
	});

	test("stores only the token's digest, never the token itself", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: false });

		let row = await db.find(sessions, { id: opened.sessionId });

		expect(row?.token_hash).not.toBe(opened.token);
		expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("resolveSession", () => {
	test("answers unknown for a token that was never minted", async () => {
		expect(await resolveSession(db, { token: "not-a-real-token" })).toEqual({ status: "unknown" });
	});

	test("answers revoked for a session that was revoked", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		await revokeSession(db, { subjectId, sessionId: opened.sessionId, reason: "sign-out" });

		expect(await resolveSession(db, { token: opened.token })).toEqual({ status: "revoked" });
	});

	test("answers expired once the absolute lifetime has passed", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		await db.update(sessions, { id: opened.sessionId }, { expires_at: Date.now() - 1 });

		expect(await resolveSession(db, { token: opened.token })).toEqual({ status: "expired" });
	});

	test("answers expired once the idle lifetime has passed", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		await db.update(sessions, { id: opened.sessionId }, { idle_expires_at: Date.now() - 1 });

		expect(await resolveSession(db, { token: opened.token })).toEqual({ status: "expired" });
	});

	describe("the last-seen throttle", () => {
		test("leaves last_seen_at and the idle window untouched inside the throttle window", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);

			let subjectId = await createTestSubject();
			let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

			vi.setSystemTime(1_700_000_000_000 + 30_000);
			await resolveSession(db, { token: opened.token });

			let row = await db.find(sessions, { id: opened.sessionId });
			expect(row?.last_seen_at).toBe(1_700_000_000_000);
			expect(row?.idle_expires_at).toBe(opened.idleExpiresAt);
		});

		test("slides last_seen_at and the idle window once the throttle window has passed", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);

			let subjectId = await createTestSubject();
			let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

			let later = 1_700_000_000_000 + 61_000;
			vi.setSystemTime(later);
			let resolved = await resolveSession(db, { token: opened.token });

			expect(resolved).toMatchObject({
				status: "active",
				idleExpiresAt: later + 7 * 24 * 60 * 60 * 1000,
			});

			let row = await db.find(sessions, { id: opened.sessionId });
			expect(row?.last_seen_at).toBe(later);
			expect(row?.idle_expires_at).toBe(later + 7 * 24 * 60 * 60 * 1000);
		});
	});
});

describe("listSubjectSessions", () => {
	test("pages newest first and flags the caller's own session", async () => {
		let subjectId = await createTestSubject();

		let first = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		await db.update(sessions, { id: first.sessionId }, { created_at: 1_000 });

		let second = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		await db.update(sessions, { id: second.sessionId }, { created_at: 2_000 });

		let third = await openSession(db, { subjectId, amr: ["webauthn"], remembered: true });
		await db.update(sessions, { id: third.sessionId }, { created_at: 3_000 });

		let page = await listSubjectSessions(db, {
			subjectId,
			callerSessionId: third.sessionId,
			limit: 2,
		});
		if (!page.ok) throw new Error("unreachable");

		expect(page.sessions.map((session) => session.id)).toEqual([third.sessionId, second.sessionId]);
		expect(page.sessions[0]).toMatchObject({ isCurrent: true, amr: ["webauthn"] });
		expect(page.sessions[1]).toMatchObject({ isCurrent: false });
		expect(page.cursors.next).not.toBeNull();

		let next = await listSubjectSessions(db, {
			subjectId,
			callerSessionId: third.sessionId,
			cursor: page.cursors.next,
			limit: 2,
		});
		if (!next.ok) throw new Error("unreachable");

		expect(next.sessions.map((session) => session.id)).toEqual([first.sessionId]);
		expect(next.cursors.next).toBeNull();
	});

	test("excludes a revoked session from the page", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		await revokeSession(db, { subjectId, sessionId: opened.sessionId, reason: "sign-out" });

		let page = await listSubjectSessions(db, { subjectId, callerSessionId: opened.sessionId });
		if (!page.ok) throw new Error("unreachable");

		expect(page.sessions).toEqual([]);
	});

	test("answers bad-cursor for a cursor this ordering did not mint", async () => {
		let subjectId = await createTestSubject();
		await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		let page = await listSubjectSessions(db, {
			subjectId,
			callerSessionId: "sess_missing",
			cursor: "not-a-real-cursor",
		});

		expect(page).toEqual({ ok: false, reason: "bad-cursor" });
	});
});

describe("revokeSession", () => {
	test("refuses a session belonging to another subject", async () => {
		let owner = await createTestSubject("owner");
		let stranger = await createTestSubject("stranger");
		let opened = await openSession(db, { subjectId: owner, amr: ["pwd"], remembered: true });

		let result = await revokeSession(db, {
			subjectId: stranger,
			sessionId: opened.sessionId,
			reason: "not-yours",
		});

		expect(result).toEqual({ ok: false, reason: "not-found" });
		expect(await resolveSession(db, { token: opened.token })).toMatchObject({ status: "active" });
	});

	test("revokes a session belonging to the given subject", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		let result = await revokeSession(db, {
			subjectId,
			sessionId: opened.sessionId,
			reason: "sign-out",
		});

		expect(result).toEqual({ ok: true });
		expect(await resolveSession(db, { token: opened.token })).toEqual({ status: "revoked" });
	});
});

describe("revokeSubjectSessions", () => {
	test("revokes every session but the one spared", async () => {
		let subjectId = await createTestSubject();
		let kept = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		let first = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		let second = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		let result = await revokeSubjectSessions(db, {
			subjectId,
			reason: "password-changed",
			exceptSessionId: kept.sessionId,
		});

		expect(result).toEqual({ revoked: 2 });
		expect(await resolveSession(db, { token: kept.token })).toMatchObject({ status: "active" });
		expect(await resolveSession(db, { token: first.token })).toEqual({ status: "revoked" });
		expect(await resolveSession(db, { token: second.token })).toEqual({ status: "revoked" });
	});

	test("revokes every session when nothing is spared", async () => {
		let subjectId = await createTestSubject();
		let first = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		let second = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		let result = await revokeSubjectSessions(db, { subjectId, reason: "blocked" });

		expect(result).toEqual({ revoked: 2 });
		expect(await resolveSession(db, { token: first.token })).toEqual({ status: "revoked" });
		expect(await resolveSession(db, { token: second.token })).toEqual({ status: "revoked" });
	});
});

describe("sweepExpiredSessions", () => {
	test("deletes a bounded batch and reports whether more remain", async () => {
		let subjectId = await createTestSubject();
		let now = Date.now();

		let ids: string[] = [];
		for (let i = 0; i < 3; i++) {
			let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
			await db.update(sessions, { id: opened.sessionId }, { expires_at: now - 1000 });
			ids.push(opened.sessionId);
		}

		let firstBatch = await sweepExpiredSessions(db, { now, batchSize: 2 });
		expect(firstBatch).toEqual({ deleted: 2, more: true });

		let secondBatch = await sweepExpiredSessions(db, { now, batchSize: 2 });
		expect(secondBatch).toEqual({ deleted: 1, more: false });

		for (let id of ids) expect(await db.find(sessions, { id })).toBeNull();
	});

	test("leaves a session that has not expired alone", async () => {
		let subjectId = await createTestSubject();
		let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		let swept = await sweepExpiredSessions(db);

		expect(swept).toEqual({ deleted: 0, more: false });
		expect(await db.find(sessions, { id: opened.sessionId })).not.toBeNull();
	});
});
