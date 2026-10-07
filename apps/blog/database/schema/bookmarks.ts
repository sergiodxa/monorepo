/**
 * Data-table schema for the `bookmarks` table: what the blog knows about each bookmark's
 * address, one row per live `like` post. The unique address is what keeps a URL from being
 * bookmarked twice; the rest is the latest check, the review state and the archive's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * A bookmark's address and its upkeep. The title, URL and description stay in `post_meta`,
 * where the CMS edits them; every column here is written by the system.
 */
export const bookmarks = table({
	name: "bookmarks",
	primaryKey: "post_id",
	columns: {
		post_id: c
			.text()
			.primaryKey()
			.references("posts", "id", "fk_bookmarks_post_id")
			.onDelete("cascade"),
		/** The URL as duplicates are judged: no scheme, `www.` or trailing `/`, host lowercased. */
		address: c.text(),
		/** What the latest read of the page came to; `null` until it was read. */
		status: c.enum(["ok", "moved", "gone", "blocked", "flaky"]).nullable(),
		http_status: c.integer().nullable(),
		/** Where the latest read's redirect chain ended. */
		final_url: c.text().nullable(),
		checked_at: c.text().nullable(),
		/** The confirmed outcome awaiting review, kept through `blocked` and `flaky` reads. */
		flag: c.enum(["moved", "gone"]).nullable(),
		flagged_at: c.text().nullable(),
		/** The last CMS save, which closes every flag raised before it. */
		reviewed_at: c.text().nullable(),
		/** When the digest last reported this bookmark's flag. */
		notified_at: c.text().nullable(),
		/** The last attempt to fill a missing title or description from the page. */
		described_at: c.text().nullable(),
		archive_attempted_at: c.text().nullable(),
		/** A Wayback Machine capture job still being polled. */
		archive_job: c.text().nullable(),
	},
});

/** Persisted bookmark upkeep row. */
export type SelectBookmark = TableRow<typeof bookmarks>;
