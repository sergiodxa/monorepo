/**
 * Unit tests for the `Credential` data-access model: storing a subject's password
 * hash and looking it up again. The create path asserts the row exists afterwards,
 * since an insert that is built but never awaited returns truthy and stores nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import Credential from "~/app/data/credential";
import Subject from "~/app/data/subject";
import { createTestDatabase } from "~/app/lib/test/db";

let db: Database;
let subjectId: string;

beforeEach(async () => {
	db = createTestDatabase().db;
	let subject = await Subject.create(db, {
		email_address: "jane@example.com",
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
	});
	subjectId = subject.id;
});

describe("Credential.create", () => {
	test("persists the credential and returns the stored row", async () => {
		let credential = await Credential.create(db, subjectId, "$2a$10$hash", 1_750_000_000_000);

		expect(credential.subject_id).toBe(subjectId);
		expect(credential.password_hash).toBe("$2a$10$hash");
		expect(credential.verified_at).toBe(1_750_000_000_000);

		expect(await Credential.find(db, subjectId)).not.toBeNull();
	});

	test("stores no verification instant when the caller has not established the owner", async () => {
		let credential = await Credential.create(db, subjectId, "$2a$10$hash", null);

		expect(credential.verified_at).toBeNull();
	});

	test("refuses a second credential for the same subject", async () => {
		await Credential.create(db, subjectId, "$2a$10$first", Date.now());
		await expect(Credential.create(db, subjectId, "$2a$10$second", Date.now())).rejects.toThrow();
	});
});

describe("Credential.find", () => {
	test("returns the subject's credential", async () => {
		await Credential.create(db, subjectId, "$2a$10$hash", Date.now());
		let found = await Credential.find(db, subjectId);
		expect(found?.password_hash).toBe("$2a$10$hash");
	});

	test("returns null for a subject that signs in another way", async () => {
		expect(await Credential.find(db, subjectId)).toBeNull();
	});
});

describe("Credential.updatePasswordHash", () => {
	test("replaces the stored hash for the subject", async () => {
		await Credential.create(db, subjectId, "$2a$10$legacy", Date.now());

		let rewritten = await Credential.updatePasswordHash(db, subjectId, "$scrypt$upgraded");

		expect(rewritten).toBe(1);
		expect((await Credential.find(db, subjectId))?.password_hash).toBe("$scrypt$upgraded");
	});

	test("creates nothing for a subject with no credential, who must stay without a password", async () => {
		let rewritten = await Credential.updatePasswordHash(db, subjectId, "$scrypt$upgraded");

		expect(rewritten).toBe(0);
		expect(await Credential.find(db, subjectId)).toBeNull();
	});
});
