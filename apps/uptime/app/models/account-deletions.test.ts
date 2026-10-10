/**
 * Tests the deletion queue: that enqueueing twice leaves one request for the sweep, that a
 * repeat keeps the original request date while taking the fresher address, and that removal
 * — the one operation both cancelling and completing use — is safe for a subject with
 * nothing queued.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { accountDeletions } from "~/database/schema";

/** Models over a fresh database, with the database itself for counting rows. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db, recordJobs().jobs) };
}

describe("accountDeletions.enqueue", () => {
	test("records the request with the address the confirmation mail will need", async () => {
		let { db, models } = setup();

		let row = await models.accountDeletions.enqueue(
			"subject-1",
			"ada@example.com",
			1_700_000_000_000,
		);

		expect(row.subject_id).toBe("subject-1");
		expect(row.email).toBe("ada@example.com");
		expect(row.requested_at).toBe(1_700_000_000_000);
		expect(await db.count(accountDeletions)).toBe(1);
	});

	/**
	 * A double-submitted form must leave exactly one row: the sweep would erase the account on
	 * the first and then attempt the whole cascade again on the second within the same run.
	 */
	test("is one request per subject however many times it is asked for", async () => {
		let { db, models } = setup();

		await models.accountDeletions.enqueue("subject-1", "ada@example.com", 1_000);
		await models.accountDeletions.enqueue("subject-1", "ada@example.com", 2_000);

		expect(await db.count(accountDeletions, { where: { subject_id: "subject-1" } })).toBe(1);
	});

	test("takes the newer address on a repeat but keeps the date the person actually asked", async () => {
		let { models } = setup();

		await models.accountDeletions.enqueue("subject-1", "old@example.com", 1_000);
		let row = await models.accountDeletions.enqueue("subject-1", "new@example.com", 2_000);

		expect(row.email).toBe("new@example.com");
		expect(row.requested_at).toBe(1_000);
	});
});

describe("accountDeletions.findBy", () => {
	test("answers null for a subject with nothing queued, which is what the page branches on", async () => {
		let { models } = setup();

		expect(await models.accountDeletions.findBy({ subject_id: "subject-1" })).toBeNull();

		await models.accountDeletions.enqueue("subject-1", "ada@example.com");
		expect(await models.accountDeletions.findBy({ subject_id: "subject-1" })).not.toBeNull();
	});
});

describe("accountDeletions.listPending", () => {
	test("returns the queue oldest request first", async () => {
		let { models } = setup();
		await models.accountDeletions.enqueue("subject-late", "late@example.com", 3_000);
		await models.accountDeletions.enqueue("subject-early", "early@example.com", 1_000);
		await models.accountDeletions.enqueue("subject-mid", "mid@example.com", 2_000);

		let pending = await models.accountDeletions.listPending();

		expect(pending.map((row) => row.subject_id)).toEqual([
			"subject-early",
			"subject-mid",
			"subject-late",
		]);
	});
});

describe("accountDeletions.remove", () => {
	test("drops the request, which is what makes the deletion never run", async () => {
		let { models } = setup();
		await models.accountDeletions.enqueue("subject-1", "ada@example.com");

		await models.accountDeletions.remove("subject-1");

		expect(await models.accountDeletions.listPending()).toHaveLength(0);
	});

	test("is a no-op for a subject with nothing queued", async () => {
		let { db, models } = setup();

		await models.accountDeletions.remove("subject-1");

		expect(await db.count(accountDeletions)).toBe(0);
	});
});
