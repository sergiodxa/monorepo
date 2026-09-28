/**
 * Covers the sweep that closes stale postings, because it is the one write the board makes
 * outside a request: nothing renders its result, so a statement the driver refuses would
 * otherwise only show up as a failed job in a log nobody is reading during a talk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import Job, { POSTING_LIFETIME_DAYS } from "~/app/data/posting";
import { createTestDatabase } from "~/app/lib/test/router";

/** Milliseconds in one day, the unit the lifetime is stated in. */
const DAY_MS = 86_400_000;

/** A complete posting, with only the fields a test varies left to the caller. */
function posting(overrides: Record<string, unknown> = {}) {
	return {
		title: "Senior Remix Engineer",
		company: "Acme",
		location: "Remote",
		salary: "$150k – $180k",
		description: "We build things with Remix v3.",
		contact_email: "hiring@acme.test",
		...overrides,
	};
}

test("closes the postings older than the board's lifetime and leaves the rest", async () => {
	let db = await createTestDatabase();

	let fresh = await Job.publish(db, posting());
	let stale = await Job.publish(db, posting({ title: "Stale" }));
	await db.exec("UPDATE postings SET created_at = ? WHERE id = ?", [1, stale.id]);

	let closed = await Job.expirePublishedBefore(db, Date.now() - POSTING_LIFETIME_DAYS * DAY_MS);

	expect(closed).toBe(1);
	expect((await Job.listOpen(db, 10)).map((it) => it.id)).toEqual([fresh.id]);
});
