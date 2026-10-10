/**
 * Covers the sweep that closes stale postings, because it is the one write the board makes
 * outside a request: nothing renders its result, so a statement the driver refuses would
 * otherwise only show up as a failed job in a log nobody is reading during a talk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import { bindModels, PostingFactory } from "~/app/lib/test/models";
import { createTestDatabase } from "~/app/lib/test/router";
import { POSTING_LIFETIME_DAYS } from "~/app/models/posting";

/** Milliseconds in one day, the unit the lifetime is stated in. */
const DAY_MS = 86_400_000;

test("closes the postings older than the board's lifetime and leaves the rest", async () => {
	let db = await createTestDatabase();
	let { models, factories } = await bindModels(db);

	let fresh = await factories.create(PostingFactory);
	let stale = await factories.create(PostingFactory, { title: "Stale" });
	await db.exec("UPDATE postings SET created_at = ? WHERE id = ?", [1, stale.id]);

	let cutoff = Date.now() - POSTING_LIFETIME_DAYS * DAY_MS;
	let closed = await models.postings.expirePublishedBefore(cutoff);

	expect(closed).toBe(1);
	expect((await models.postings.listOpen(10)).map((it) => it.id)).toEqual([fresh.id]);
});
