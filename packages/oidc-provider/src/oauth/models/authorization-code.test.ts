import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { Database } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";
import { createClient, createSession, createSubject } from "../../shared/test/fixtures";

import AuthorizationCode from "./authorization-code";

describe("AuthorizationCode", () => {
	let sqliteDb: SqliteDatabase;
	let db: Database;

	beforeEach(async () => {
		sqliteDb = new SqliteDatabase(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
		db = new Database(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

	describe("create", () => {
		test("creates an authorization code with all required fields", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
				scope: ["openid", "profile"],
				nonce: "test-nonce",
				pkce: { challenge: "test-challenge", method: "S256" },
			});

			expect(code).toBeString();
			expect(code).toHaveLength(36); // UUID length

			// Consume to verify the data was stored correctly
			let data = await AuthorizationCode.consume(db, code);
			expect(data.clientId).toBe(client.id);
			expect(data.subjectId).toBe(subject.id);
			expect(data.sessionId).toBe(sessionId);
			expect(data.redirectUri).toBe("https://example.com/callback");
			expect(data.scope).toEqual(["openid", "profile"]);
			expect(data.nonce).toBe("test-nonce");
			expect(data.pkce).toEqual({ challenge: "test-challenge", method: "S256" });
			expect(data.authTime).toBeNumber();
		});

		test("generates unique codes each time", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code1 = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			let code2 = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			expect(code1).not.toBe(code2);
		});

		test("creates code with optional fields as null", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			let data = await AuthorizationCode.consume(db, code);
			expect(data.scope).toEqual([]);
			expect(data.nonce).toBeNull();
			expect(data.pkce).toBeNull();
		});
	});

	describe("consume", () => {
		test("returns the code data and deletes it", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
				scope: ["openid"],
			});

			let data = await AuthorizationCode.consume(db, code);

			expect(data.clientId).toBe(client.id);
			expect(data.subjectId).toBe(subject.id);
			expect(data.sessionId).toBe(sessionId);
			expect(data.redirectUri).toBe("https://example.com/callback");
			expect(data.scope).toEqual(["openid"]);
		});

		test("throws AlreadyConsumedError for non-existent code", async () => {
			expect(AuthorizationCode.consume(db, "non-existent-code")).rejects.toThrow(
				AuthorizationCode.AlreadyConsumedError,
			);
		});

		test("throws AlreadyConsumedError when consuming same code twice (single-use)", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			// First consume should succeed
			await AuthorizationCode.consume(db, code);

			// Second consume should throw AlreadyConsumedError
			expect(AuthorizationCode.consume(db, code)).rejects.toThrow(
				AuthorizationCode.AlreadyConsumedError,
			);
		});

		test("throws ExpiredCodeError for expired code", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			// Manually update the code to be expired
			sqliteDb.run("UPDATE authorization_codes SET expires_at = ? WHERE code = ?", [
				Date.now() - 1000,
				code,
			]);

			expect(AuthorizationCode.consume(db, code)).rejects.toThrow(
				AuthorizationCode.ExpiredCodeError,
			);
		});

		test("deletes expired code after throwing ExpiredCodeError", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			// Manually update the code to be expired
			sqliteDb.run("UPDATE authorization_codes SET expires_at = ? WHERE code = ?", [
				Date.now() - 1000,
				code,
			]);

			// First consume throws ExpiredCodeError but deletes the code
			expect(AuthorizationCode.consume(db, code)).rejects.toThrow(
				AuthorizationCode.ExpiredCodeError,
			);

			// Second consume throws AlreadyConsumedError because code was deleted
			expect(AuthorizationCode.consume(db, code)).rejects.toThrow(
				AuthorizationCode.AlreadyConsumedError,
			);
		});
	});

	describe("cleanupExpired", () => {
		test("removes expired codes", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code1 = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			let code2 = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			// Set both codes to be expired
			sqliteDb.run("UPDATE authorization_codes SET expires_at = ? WHERE code IN (?, ?)", [
				Date.now() - 1000,
				code1,
				code2,
			]);

			// Cleanup should remove both expired codes
			let deletedCount = await AuthorizationCode.cleanupExpired(db, Date.now());
			expect(deletedCount).toBe(2);

			// Verify codes are deleted
			expect(AuthorizationCode.consume(db, code1)).rejects.toThrow(
				AuthorizationCode.AlreadyConsumedError,
			);
			expect(AuthorizationCode.consume(db, code2)).rejects.toThrow(
				AuthorizationCode.AlreadyConsumedError,
			);
		});

		test("keeps non-expired codes", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			// Cleanup with current time should not remove non-expired codes
			let deletedCount = await AuthorizationCode.cleanupExpired(db, Date.now());
			expect(deletedCount).toBe(0);

			// Verify code is still valid
			let data = await AuthorizationCode.consume(db, code);
			expect(data.clientId).toBe(client.id);
		});

		test("only removes expired codes, keeps valid ones", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let expiredCode = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			let validCode = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			// Set only one code to be expired
			sqliteDb.run("UPDATE authorization_codes SET expires_at = ? WHERE code = ?", [
				Date.now() - 1000,
				expiredCode,
			]);

			// Cleanup should only remove the expired code
			let deletedCount = await AuthorizationCode.cleanupExpired(db, Date.now());
			expect(deletedCount).toBe(1);

			// Expired code should be gone
			expect(AuthorizationCode.consume(db, expiredCode)).rejects.toThrow(
				AuthorizationCode.AlreadyConsumedError,
			);

			// Valid code should still work
			let data = await AuthorizationCode.consume(db, validCode);
			expect(data.clientId).toBe(client.id);
		});

		test("returns 0 when no codes exist", async () => {
			let deletedCount = await AuthorizationCode.cleanupExpired(db, Date.now());
			expect(deletedCount).toBe(0);
		});

		test("returns 0 when all codes are valid", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
			});

			let deletedCount = await AuthorizationCode.cleanupExpired(db, Date.now());
			expect(deletedCount).toBe(0);
		});
	});

	describe("PKCE support", () => {
		test("stores and retrieves PKCE challenge with S256 method", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
				pkce: { challenge: "sha256-challenge-hash", method: "S256" },
			});

			let data = await AuthorizationCode.consume(db, code);
			expect(data.pkce).toEqual({ challenge: "sha256-challenge-hash", method: "S256" });
		});

		test("stores and retrieves PKCE challenge with plain method", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);
			let sessionId = await createSession(db, { subjectId: subject.id, clientId: client.id });

			let code = await AuthorizationCode.create(db, {
				clientId: client.id,
				subjectId: subject.id,
				sessionId,
				redirectUri: "https://example.com/callback",
				pkce: { challenge: "plain-verifier", method: "plain" },
			});

			let data = await AuthorizationCode.consume(db, code);
			expect(data.pkce).toEqual({ challenge: "plain-verifier", method: "plain" });
		});
	});

	describe("TTL constant", () => {
		test("TTL is 10 minutes", () => {
			expect(AuthorizationCode.TTL).toBe(10 * 60 * 1000);
		});
	});
});
