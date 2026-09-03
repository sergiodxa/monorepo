/**
 * Tests for the subject password-credential model.
 *
 * Alongside the lifecycle cases these cover the stored-hash upgrade: a password
 * recorded under an earlier cost must still authenticate its subject, and doing so
 * must leave the row holding a hash at the current cost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SqliteDatabase } from "@sdxc/cloudflare-mocks/sqlite";

import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "../../shared/test/db";
import { createSubject } from "../../shared/test/fixtures";
import { underpoweredHash } from "../../shared/test/hashes";

import Credential from "./credential";

const CURRENT_PREFIX = "$pbkdf2-sha256$";

describe("Credential", () => {
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

	/**
	 * Inserts a credential hashed under an earlier cost, bypassing the model so the
	 * stored value genuinely trails current policy.
	 * @param subjectId - Subject the credential belongs to.
	 * @param password - Password to hash below the current cost.
	 */
	async function createLegacyCredential(subjectId: string, password: string) {
		let now = new Date().toISOString();
		await db.create(Credential.table, {
			id: crypto.randomUUID(),
			subject_id: subjectId,
			password_hash: await underpoweredHash(password),
			verified_at: null,
			created_at: now,
			updated_at: now,
		});
	}

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
			expect(credential?.password_hash?.startsWith(CURRENT_PREFIX)).toBe(true);
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

		test("returns true for a password stored in the superseded hash format", async () => {
			let subject = await createSubject(db);
			await createLegacyCredential(subject.id, "correctPassword123");

			let isValid = await Credential.verify(db, subject.id, "correctPassword123");

			expect(isValid).toBe(true);
		});

		test("rewrites a superseded hash in the current format after a match", async () => {
			let subject = await createSubject(db);
			await createLegacyCredential(subject.id, "correctPassword123");
			let before = await Credential.findBySubject(db, subject.id);

			await Credential.verify(db, subject.id, "correctPassword123");

			let upgraded = (await Credential.findBySubject(db, subject.id))?.password_hash;
			expect(upgraded?.startsWith(CURRENT_PREFIX)).toBe(true);

			expect((await Credential.findBySubject(db, subject.id))?.updated_at).toBe(
				before?.updated_at ?? "",
			);

			expect(await Credential.verify(db, subject.id, "correctPassword123")).toBe(true);
			expect((await Credential.findBySubject(db, subject.id))?.password_hash).toBe(upgraded);
		});

		test("returns false for a wrong password against a superseded hash, leaving it alone", async () => {
			let subject = await createSubject(db);
			await createLegacyCredential(subject.id, "correctPassword123");
			let before = (await Credential.findBySubject(db, subject.id))?.password_hash;

			let isValid = await Credential.verify(db, subject.id, "wrongPassword");

			expect(isValid).toBe(false);
			expect((await Credential.findBySubject(db, subject.id))?.password_hash).toBe(before);
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
