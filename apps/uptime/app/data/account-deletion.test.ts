/**
 * Tests the deletion queue: that enqueueing twice is one request rather than two the sweep
 * would process in sequence, that a repeat keeps the original request date while taking the
 * fresher address, and that removal — the one operation both cancelling and completing use — is
 * safe to call for a subject who has nothing queued.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import AccountDeletion from "~/app/data/account-deletion";
import { createTestDatabase } from "~/app/lib/test/db";
import { accountDeletions } from "~/database/schema";

describe("AccountDeletion.enqueue", () => {
	test("records the request with the address the confirmation mail will need", async () => {
		let { db } = createTestDatabase();

		let row = await AccountDeletion.enqueue(db, "subject-1", "ada@example.com", 1_700_000_000_000);

		expect(row.subject_id).toBe("subject-1");
		expect(row.email).toBe("ada@example.com");
		expect(row.requested_at).toBe(1_700_000_000_000);
		expect(await db.count(accountDeletions)).toBe(1);
	});

	/**
	 * A double-submitted form must not leave two rows: the sweep would erase the account on the
	 * first and then attempt the whole cascade again on the second within the same run.
	 */
	test("is one request per subject however many times it is asked for", async () => {
		let { db } = createTestDatabase();

		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com", 1_000);
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com", 2_000);

		expect(await db.count(accountDeletions, { where: { subject_id: "subject-1" } })).toBe(1);
	});

	test("takes the newer address on a repeat but keeps the date the person actually asked", async () => {
		let { db } = createTestDatabase();

		await AccountDeletion.enqueue(db, "subject-1", "old@example.com", 1_000);
		let row = await AccountDeletion.enqueue(db, "subject-1", "new@example.com", 2_000);

		expect(row.email).toBe("new@example.com");
		expect(row.requested_at).toBe(1_000);
	});
});

describe("AccountDeletion.findBySubjectId", () => {
	test("answers null for a subject with nothing queued, which is what the page branches on", async () => {
		let { db } = createTestDatabase();

		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();

		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).not.toBeNull();
	});
});

describe("AccountDeletion.listPending", () => {
	test("returns the queue oldest request first", async () => {
		let { db } = createTestDatabase();
		await AccountDeletion.enqueue(db, "subject-late", "late@example.com", 3_000);
		await AccountDeletion.enqueue(db, "subject-early", "early@example.com", 1_000);
		await AccountDeletion.enqueue(db, "subject-mid", "mid@example.com", 2_000);

		let pending = await AccountDeletion.listPending(db);

		expect(pending.map((row) => row.subject_id)).toEqual([
			"subject-early",
			"subject-mid",
			"subject-late",
		]);
	});
});

describe("AccountDeletion.remove", () => {
	test("drops the request, which is what makes the deletion never run", async () => {
		let { db } = createTestDatabase();
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await AccountDeletion.remove(db, "subject-1");

		expect(await AccountDeletion.listPending(db)).toHaveLength(0);
	});

	test("is a no-op for a subject with nothing queued", async () => {
		let { db } = createTestDatabase();

		await AccountDeletion.remove(db, "subject-1");

		expect(await db.count(accountDeletions)).toBe(0);
	});
});
