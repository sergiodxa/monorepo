import type { SqliteDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "../../shared/test/db";
import { createClient, createSession, createSubject } from "../../shared/test/fixtures";

import Session from "./session";

describe("Session", () => {
	let sqliteDb: SqliteDatabase;
	let db: Database;

	beforeEach(async () => {
		sqliteDb = openDatabase(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.exec(migration);
		let adapter = createSqliteDatabaseAdapter(sqliteDb);
		db = new Database(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

	describe("create", () => {
		test("creates a session and returns the id", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let sessionId = await Session.create(db, {
				subjectId: subject.id,
				clientId: client.id,
				ip: "127.0.0.1",
				userAgent: "Test Agent",
			});

			expect(sessionId).toBeTypeOf("string");
			expect(sessionId).toHaveLength(36); // UUID length

			let session = await Session.show(db, sessionId);
			expect(session).not.toBeNull();
			expect(session?.subject_id).toBe(subject.id);
			expect(session?.client_id).toBe(client.id);
			expect(session?.ip).toBe("127.0.0.1");
			expect(session?.user_agent).toBe("Test Agent");
		});

		test("creates a session with null ip and userAgent", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let sessionId = await Session.create(db, {
				subjectId: subject.id,
				clientId: client.id,
			});

			let session = await Session.show(db, sessionId);
			expect(session?.ip).toBeNull();
			expect(session?.user_agent).toBeNull();
		});

		test("sets expires_at to 30 days from now", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let before = new Date();
			let sessionId = await Session.create(db, {
				subjectId: subject.id,
				clientId: client.id,
			});
			let after = new Date();

			let session = await Session.show(db, sessionId);
			let expiresAt = new Date(session!.expires_at);

			// Should be roughly 30 days from now
			let thirtyDays = 30 * 24 * 60 * 60 * 1000;
			expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before.getTime() + thirtyDays - 1000);
			expect(expiresAt.getTime()).toBeLessThanOrEqual(after.getTime() + thirtyDays + 1000);
		});
	});

	describe("show", () => {
		test("returns session by id", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let session = await Session.show(db, sessionId);
			expect(session).not.toBeNull();
			expect(session?.id).toBe(sessionId);
		});

		test("returns null for non-existent id", async () => {
			let session = await Session.show(db, "non-existent-id");
			expect(session).toBeNull();
		});
	});

	describe("list", () => {
		test("returns all sessions", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			await createSession(db, { subjectId: subject.id, clientId: client.id });
			await createSession(db, { subjectId: subject.id, clientId: client.id });

			let sessions = await Session.list(db);
			expect(sessions).toHaveLength(2);
		});
	});

	describe("listBySubject", () => {
		test("returns sessions for a specific subject", async () => {
			let subject1 = await createSubject(db, { verified: true });
			let subject2 = await createSubject(db, { verified: true });
			let client = await createClient(db);

			await createSession(db, { subjectId: subject1.id, clientId: client.id });
			await createSession(db, { subjectId: subject1.id, clientId: client.id });
			await createSession(db, { subjectId: subject2.id, clientId: client.id });

			let sessions = await Session.listBySubject(db, subject1.id);
			expect(sessions).toHaveLength(2);
			expect(sessions.every((s) => s.subject_id === subject1.id)).toBe(true);
		});
	});

	describe("touch", () => {
		test("updates the updated_at timestamp", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let before = await Session.show(db, sessionId);
			let originalUpdatedAt = before!.updated_at;

			// Wait a bit to ensure timestamp changes
			await new Promise((resolve) => setTimeout(resolve, 10));

			await Session.touch(db, sessionId);

			let after = await Session.show(db, sessionId);
			expect(after!.updated_at).not.toBe(originalUpdatedAt);
		});

		test("throws RecordNotFoundError for non-existent session", async () => {
			await expect(Session.touch(db, "non-existent")).rejects.toThrow("record");
		});
	});

	describe("destroy", () => {
		test("deletes the session", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			await Session.destroy(db, sessionId);

			let session = await Session.show(db, sessionId);
			expect(session).toBeNull();
		});

		test("throws RecordNotFoundError for non-existent session", async () => {
			await expect(Session.destroy(db, "non-existent")).rejects.toThrow("record");
		});
	});

	describe("destroyBySubject", () => {
		test("deletes all sessions for a subject", async () => {
			let subject1 = await createSubject(db, { verified: true });
			let subject2 = await createSubject(db, { verified: true });
			let client = await createClient(db);

			await createSession(db, { subjectId: subject1.id, clientId: client.id });
			await createSession(db, { subjectId: subject1.id, clientId: client.id });
			await createSession(db, { subjectId: subject2.id, clientId: client.id });

			let deletedCount = await Session.destroyBySubject(db, subject1.id);
			expect(deletedCount).toBe(2);

			let remainingSessions = await Session.list(db);
			expect(remainingSessions).toHaveLength(1);
			expect(remainingSessions[0]!.subject_id).toBe(subject2.id);
		});
	});

	describe("cleanupExpired", () => {
		test("deletes expired sessions", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			// Create a session
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			// Simulate time passing - 31 days in the future
			let futureTime = Date.now() + 31 * 24 * 60 * 60 * 1000;

			let deletedCount = await Session.cleanupExpired(db, futureTime);
			expect(deletedCount).toBe(1);

			let session = await Session.show(db, sessionId);
			expect(session).toBeNull();
		});

		test("keeps non-expired sessions", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			await createSession(db, { subjectId: subject.id, clientId: client.id });

			// Current time - sessions should not be expired
			let deletedCount = await Session.cleanupExpired(db, Date.now());
			expect(deletedCount).toBe(0);

			let sessions = await Session.list(db);
			expect(sessions).toHaveLength(1);
		});
	});
});
