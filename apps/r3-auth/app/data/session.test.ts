/**
 * Unit tests for the `Session` data-access model: opening a session with its 30-day
 * expiry, listing a subject's sessions with the client each belongs to, touching,
 * revocation by id/subject/subject+client, the expiry sweep, and the active count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import Client from "~/app/data/client";
import Session, { SESSION_TTL } from "~/app/data/session";
import Subject from "~/app/data/subject";
import { createTestDatabase } from "~/app/lib/test/db";
import { sessions } from "~/database/schema";

let db: Database;
let subjectId: string;
let clientId: string;

beforeEach(async () => {
	db = createTestDatabase().db;

	let subject = await Subject.create(db, {
		email_address: "jane@example.com",
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
	});
	subjectId = subject.id;

	let client = await Client.create(db, {
		name: "Blog",
		redirect_uri: "https://blog.example.com/auth/callback",
		logout_uri: "https://blog.example.com/logout",
	});
	clientId = client.id;
});

describe("Session.create", () => {
	test("stamps an expiry 30 days out, since the column has no database default", async () => {
		let before = Date.now();
		let session = await Session.create(db, subjectId, clientId, "203.0.113.1", "Firefox");

		expect(session.expires_at).toBeGreaterThanOrEqual(before + SESSION_TTL);
		expect(session.expires_at).toBeLessThanOrEqual(Date.now() + SESSION_TTL);
	});

	test("records the device details and gives the session a unique id", async () => {
		let first = await Session.create(db, subjectId, clientId, "203.0.113.1", "Firefox");
		let second = await Session.create(db, subjectId, clientId, null, null);

		expect(first.ip_address).toBe("203.0.113.1");
		expect(first.user_agent).toBe("Firefox");
		expect(second.ip_address).toBeNull();
		expect(second.user_agent).toBeNull();
		expect(first.id).not.toBe(second.id);
	});
});

describe("Session.findById", () => {
	test("resolves a presented refresh token to its session", async () => {
		let session = await Session.create(db, subjectId, clientId, null, null);
		expect((await Session.findById(db, session.id))?.subject_id).toBe(subjectId);
	});

	test("returns null for a revoked or invented token", async () => {
		expect(await Session.findById(db, "not-a-session")).toBeNull();
	});
});

describe("Session.findBySubjectId", () => {
	test("loads each session with the client it was issued to, most recent first", async () => {
		let older = await Session.create(db, subjectId, clientId, null, null);
		let newer = await Session.create(db, subjectId, clientId, null, null);

		await db.update(sessions, older.id, { updated_at: 1_000 });
		await db.update(sessions, newer.id, { updated_at: 2_000 });

		let list = await Session.findBySubjectId(db, subjectId);

		expect(list.map((session) => session.id)).toEqual([newer.id, older.id]);
		expect(list[0]?.client?.name).toBe("Blog");
	});
});

describe("Session.touch", () => {
	test("moves the session's updated_at forward without changing anything else", async () => {
		let session = await Session.create(db, subjectId, clientId, null, null);
		await db.update(sessions, session.id, { updated_at: 1_000 });

		let touched = await Session.touch(db, session.id);

		expect(touched.updated_at).toBeGreaterThan(1_000);
		expect(touched.expires_at).toBe(session.expires_at);
	});
});

describe("Session revocation", () => {
	test("deleteById revokes exactly one session", async () => {
		let first = await Session.create(db, subjectId, clientId, null, null);
		let second = await Session.create(db, subjectId, clientId, null, null);

		expect(await Session.deleteById(db, first.id)).toBe(true);
		expect(await Session.findById(db, first.id)).toBeNull();
		expect(await Session.findById(db, second.id)).not.toBeNull();
	});

	test("deleteBySubjectId revokes every session the subject has", async () => {
		await Session.create(db, subjectId, clientId, null, null);
		await Session.create(db, subjectId, clientId, null, null);

		expect(await Session.deleteBySubjectId(db, subjectId)).toBe(2);
		expect(await Session.findBySubjectId(db, subjectId)).toHaveLength(0);
	});

	test("deleteBySubjectAndClient leaves the subject's other clients signed in", async () => {
		let other = await Client.create(db, {
			name: "Uptime",
			redirect_uri: "https://uptime.example.com/auth/callback",
			logout_uri: "https://uptime.example.com/logout",
		});

		await Session.create(db, subjectId, clientId, null, null);
		let kept = await Session.create(db, subjectId, other.id, null, null);

		expect(await Session.deleteBySubjectAndClient(db, subjectId, clientId)).toBe(1);

		let remaining = await Session.findBySubjectId(db, subjectId);
		expect(remaining.map((session) => session.id)).toEqual([kept.id]);
	});
});

describe("Session expiry", () => {
	test("findExpiredSessions returns only sessions whose expiry has passed", async () => {
		let expired = await Session.create(db, subjectId, clientId, null, null);
		let live = await Session.create(db, subjectId, clientId, null, null);
		await db.update(sessions, expired.id, { expires_at: Date.now() - 1 });

		let found = await Session.findExpiredSessions(db);

		expect(found.map((session) => session.id)).toEqual([expired.id]);
		expect(found.map((session) => session.id)).not.toContain(live.id);
	});

	test("deleteExpiredSessions removes them and reports how many", async () => {
		let expired = await Session.create(db, subjectId, clientId, null, null);
		await Session.create(db, subjectId, clientId, null, null);
		await db.update(sessions, expired.id, { expires_at: Date.now() - 1 });

		expect(await Session.deleteExpiredSessions(db)).toBe(1);
		expect(await Session.findExpiredSessions(db)).toHaveLength(0);
		expect(await Session.findBySubjectId(db, subjectId)).toHaveLength(1);
	});

	test("deleteExpiredSessions is a no-op when nothing has expired", async () => {
		await Session.create(db, subjectId, clientId, null, null);
		expect(await Session.deleteExpiredSessions(db)).toBe(0);
	});

	test("countActive counts only sessions that have not expired", async () => {
		let expired = await Session.create(db, subjectId, clientId, null, null);
		await Session.create(db, subjectId, clientId, null, null);
		await db.update(sessions, expired.id, { expires_at: Date.now() - 1 });

		expect(await Session.countActive(db)).toBe(1);
	});
});
