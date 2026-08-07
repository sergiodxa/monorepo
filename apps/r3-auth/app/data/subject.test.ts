/**
 * Unit tests for the `Subject` data-access model: lookup by email and id, the
 * paginated admin listing and count, and create/update/delete — all against an
 * in-memory SQLite database with the real migrations applied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import Subject from "~/app/data/subject";
import { createTestDatabase } from "~/app/lib/test/db";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** Registers a subject with unique-by-default attributes a test can override. */
async function createSubject(overrides: Partial<Parameters<typeof Subject.create>[1]> = {}) {
	return await Subject.create(db, {
		email_address: "jane@example.com",
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
		...overrides,
	});
}

describe("Subject.create", () => {
	test("stores the subject with epoch-ms timestamps and the default role", async () => {
		let subject = await createSubject();

		expect(subject.id).toBeString();
		expect(subject.role).toBe("user");
		expect(subject.created_at).toBeNumber();
		expect(subject.updated_at).toBeNumber();
		expect(subject.created_at).toBeGreaterThan(1_700_000_000_000);
	});

	test("leaves the email unverified unless a verification stamp is given", async () => {
		let unverified = await createSubject();
		expect(unverified.email_verified_at).toBeNull();

		let verified = await createSubject({
			email_address: "sam@example.com",
			username: "sam",
			email_verified_at: 1_750_000_000_000,
		});
		expect(verified.email_verified_at).toBe(1_750_000_000_000);
	});

	test("honors a caller-supplied id so a provisioning flow can pick it", async () => {
		let subject = await createSubject({ id: "subject-1" });
		expect(subject.id).toBe("subject-1");
	});
});

describe("Subject.findByEmail", () => {
	test("finds the registered subject", async () => {
		await createSubject();
		let found = await Subject.findByEmail(db, "jane@example.com");
		expect(found?.username).toBe("jane");
	});

	test("returns null for an address nobody registered", async () => {
		expect(await Subject.findByEmail(db, "nobody@example.com")).toBeNull();
	});
});

describe("Subject.findById", () => {
	test("returns null for an unknown id instead of throwing", async () => {
		expect(await Subject.findById(db, "missing")).toBeNull();
	});
});

describe("Subject.findAll", () => {
	test("pages through subjects oldest first", async () => {
		await createSubject({ id: "a", email_address: "a@example.com", username: "a" });
		await createSubject({ id: "b", email_address: "b@example.com", username: "b" });
		await createSubject({ id: "c", email_address: "c@example.com", username: "c" });

		let first = await Subject.findAll(db, { limit: 2, offset: 0 });
		let second = await Subject.findAll(db, { limit: 2, offset: 2 });

		expect(first).toHaveLength(2);
		expect(second).toHaveLength(1);
		expect([...first, ...second].map((subject) => subject.id)).toEqual(["a", "b", "c"]);
	});
});

describe("Subject.count", () => {
	test("counts every subject", async () => {
		expect(await Subject.count(db)).toBe(0);
		await createSubject();
		expect(await Subject.count(db)).toBe(1);
	});
});

describe("Subject.update", () => {
	test("applies the changes and returns the stored row", async () => {
		let subject = await createSubject();
		let updated = await Subject.update(db, subject.id, { display_name: "Jane R. Doe" });

		expect(updated.display_name).toBe("Jane R. Doe");
		expect(await Subject.findById(db, subject.id)).toMatchObject({
			display_name: "Jane R. Doe",
		});
	});
});

describe("Subject.delete", () => {
	test("removes the subject", async () => {
		let subject = await createSubject();
		expect(await Subject.delete(db, subject.id)).toBe(true);
		expect(await Subject.findById(db, subject.id)).toBeNull();
	});
});
