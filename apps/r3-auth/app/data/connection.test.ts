/**
 * Unit tests for the `Connection` data-access model: linking a provider identity to a
 * subject on first sign-in, and resolving that identity again on later sign-ins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import Connection from "~/app/data/connection";
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

describe("Connection.create", () => {
	test("links the provider identity to the subject", async () => {
		let connection = await Connection.create(db, "github", "12345", subjectId);

		expect(connection.provider).toBe("github");
		expect(connection.external_id).toBe("12345");
		expect(connection.subject_id).toBe(subjectId);
	});

	test("refuses to link the same provider identity twice", async () => {
		await Connection.create(db, "github", "12345", subjectId);
		await expect(Connection.create(db, "github", "12345", subjectId)).rejects.toThrow();
	});
});

describe("Connection.find", () => {
	test("resolves a returning provider identity to its connection", async () => {
		await Connection.create(db, "github", "12345", subjectId);
		let found = await Connection.find(db, "github", "12345");
		expect(found?.subject_id).toBe(subjectId);
	});

	test("keys on the provider as well as the external id", async () => {
		await Connection.create(db, "github", "12345", subjectId);
		expect(await Connection.find(db, "gitlab", "12345")).toBeNull();
	});

	test("returns null for an identity that has never signed in", async () => {
		expect(await Connection.find(db, "github", "unknown")).toBeNull();
	});
});
