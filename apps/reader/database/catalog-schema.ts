/**
 * The feed catalog's schema, declared for `remix/data-table` over the D1 database bound
 * as `PLATFORM_DB`. Column names and types mirror `database/catalog-migrations/` exactly,
 * since that SQL is what actually creates the table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

export const catalogFeeds = table({
	name: "feeds",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at" },
	columns: {
		/**
		 * A `feed_…` TypeID, minted by the upsert that first inserts the row. It names the
		 * feed's Durable Object, it is the body of the freshness key, and it is what a
		 * reader's subscription stores, so one identifier reaches a feed from anywhere.
		 */
		id: c.text(),
		/**
		 * The canonical URL, `UNIQUE`. That index is the convergence guarantee: one row per
		 * feed, therefore one id per feed, therefore one object per feed.
		 */
		feed_url: c.text(),
		/**
		 * A denormalized copy, so an administrative list is readable without waking
		 * anything. It lags what the feed's object holds, and the object is right.
		 */
		title: c.text(),
		created_at: c.integer(),
		/** When the feed last published something, moved only by a poll that stored an item. */
		last_active_at: c.integer().nullable(),
		/** When the feed's last subscriber left, and it began serving out its grace period. */
		retired_at: c.integer().nullable(),
	},
});

/** One catalog row, as it reads back. */
export type SelectCatalogFeed = TableRow<typeof catalogFeeds>;
