/**
 * Unit tests for the `Credential` data-access model: storing a subject's password
 * hash and looking it up again. The create path is checked to actually persist a row,
 * which a fire-and-forget insert would not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

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
		let credential = await Credential.create(db, subjectId, "$2a$10$hash");

		expect(credential.subject_id).toBe(subjectId);
		expect(credential.password_hash).toBe("$2a$10$hash");
		expect(credential.verified_at).toBeNull();

		// Regression: the row has to exist after `create` resolves. An insert that is
		// built but never awaited returns a truthy value and stores nothing.
		expect(await Credential.find(db, subjectId)).not.toBeNull();
	});

	test("refuses a second credential for the same subject", async () => {
		await Credential.create(db, subjectId, "$2a$10$first");
		expect(Credential.create(db, subjectId, "$2a$10$second")).rejects.toThrow();
	});
});

describe("Credential.find", () => {
	test("returns the subject's credential", async () => {
		await Credential.create(db, subjectId, "$2a$10$hash");
		let found = await Credential.find(db, subjectId);
		expect(found?.password_hash).toBe("$2a$10$hash");
	});

	test("returns null for a subject that signs in another way", async () => {
		expect(await Credential.find(db, subjectId)).toBeNull();
	});
});
