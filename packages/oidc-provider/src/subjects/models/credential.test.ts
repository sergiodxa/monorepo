import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";
import { createSubject } from "../../shared/test/fixtures";

import Credential from "./credential";

describe("Credential", () => {
	let sqliteDb: Database;
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		sqliteDb = new Database(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
		db = createDatabase(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

	describe("create", () => {
		test("creates a credential with hashed password for a subject", async () => {
			let subject = await createSubject(db);
			let password = "securePassword123";

			let result = await Credential.create(db, subject.id, password);

			expect(result.affectedRows).toBe(1);

			let credential = await Credential.findBySubject(db, subject.id);
			expect(credential).not.toBeNull();
			expect(credential?.subject_id).toBe(subject.id);
			expect(credential?.password_hash).not.toBe(password);
			expect(credential?.password_hash).toStartWith("$2");
			expect(credential?.verified_at).toBeNull();
		});
	});

	describe("findBySubject", () => {
		test("finds a credential by subject ID", async () => {
			let subject = await createSubject(db);
			await Credential.create(db, subject.id, "password123");

			let credential = await Credential.findBySubject(db, subject.id);

			expect(credential).not.toBeNull();
			expect(credential?.subject_id).toBe(subject.id);
		});

		test("returns null for non-existent subject", async () => {
			let credential = await Credential.findBySubject(db, "non-existent-id");

			expect(credential).toBeNull();
		});
	});

	describe("verify", () => {
		test("returns true for correct password", async () => {
			let subject = await createSubject(db);
			let password = "correctPassword123";
			await Credential.create(db, subject.id, password);

			let isValid = await Credential.verify(db, subject.id, password);

			expect(isValid).toBe(true);
		});

		test("returns false for incorrect password", async () => {
			let subject = await createSubject(db);
			await Credential.create(db, subject.id, "correctPassword123");

			let isValid = await Credential.verify(db, subject.id, "wrongPassword");

			expect(isValid).toBe(false);
		});

		test("throws InvalidCredentialError for non-existent credential", async () => {
			await expect(Credential.verify(db, "non-existent-id", "anyPassword")).rejects.toThrow(
				Credential.InvalidCredentialError,
			);
		});
	});

	describe("updatePassword", () => {
		test("updates the password hash", async () => {
			let subject = await createSubject(db);
			let originalPassword = "originalPassword123";
			let newPassword = "newPassword456";

			await Credential.create(db, subject.id, originalPassword);
			let originalCredential = await Credential.findBySubject(db, subject.id);
			let originalHash = originalCredential?.password_hash;

			await Credential.updatePassword(db, subject.id, newPassword);

			let updatedCredential = await Credential.findBySubject(db, subject.id);
			expect(updatedCredential?.password_hash).not.toBe(originalHash);

			let isOldPasswordValid = await Credential.verify(db, subject.id, originalPassword);
			expect(isOldPasswordValid).toBe(false);

			let isNewPasswordValid = await Credential.verify(db, subject.id, newPassword);
			expect(isNewPasswordValid).toBe(true);
		});

		test("throws InvalidCredentialError for non-existent credential", async () => {
			await expect(Credential.updatePassword(db, "non-existent-id", "newPassword")).rejects.toThrow(
				Credential.InvalidCredentialError,
			);
		});
	});
});
