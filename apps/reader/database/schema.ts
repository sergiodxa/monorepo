/**
 * The reader's schema, declared for `remix/data-table` over the SQL each user object
 * keeps in its own storage. Column names and types mirror `database/migrations/`
 * exactly, since that SQL is what actually creates the tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Payload accepted when writing a row, with database defaults left out. */
type InsertRow<sourceTable extends AnyTable> = Partial<TableRow<sourceTable>>;

/**
 * The refresh cadences a reader may choose, in hours. The `CHECK` constraint in
 * `0001-init.sql` repeats this list, so the database refuses anything the settings
 * form somehow lets through.
 */
export const REFRESH_INTERVALS = [1, 3, 6, 9, 12, 24] as const;

/** One of the cadences {@link REFRESH_INTERVALS} offers. */
export type RefreshIntervalHours = (typeof REFRESH_INTERVALS)[number];

/** What a refresh attempt recorded, as a category rather than a message. */
export const FEED_STATUSES = [
	"ok",
	"not_modified",
	"http_error",
	"network_error",
	"parse_error",
] as const;

/** One of the outcomes {@link FEED_STATUSES} names. */
export type FeedStatus = (typeof FEED_STATUSES)[number];

export const settings = table({
	name: "settings",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.integer(),
		subject: c.text(),
		/**
		 * An integer rather than an enum column: the value is multiplied by an hour
		 * when the alarm is scheduled, and the legal set is enforced by the database's
		 * own `CHECK` and again where the setting is written.
		 */
		refresh_interval_hours: c.integer().default(1),
		last_refreshed_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export const feeds = table({
	name: "feeds",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		feed_url: c.text(),
		site_url: c.text().nullable(),
		title: c.text(),
		description: c.text().nullable(),
		language: c.text().nullable(),
		image_url: c.text().nullable(),
		etag: c.text().nullable(),
		last_modified: c.text().nullable(),
		last_fetched_at: c.integer().nullable(),
		last_status: c.enum(FEED_STATUSES).nullable(),
		last_http_status: c.integer().nullable(),
		last_error: c.text().nullable(),
		failure_count: c.integer().default(0),
		next_attempt_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export const feedItems = table({
	name: "feed_items",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		feed_id: c.text(),
		guid: c.text(),
		title: c.text(),
		url: c.text().nullable(),
		summary: c.text().nullable(),
		content: c.text().nullable(),
		author: c.text().nullable(),
		/**
		 * Written on insert and never updated. It leads the timeline's ordering, so
		 * moving a row within that ordering would make a cursor already in flight skip
		 * posts or serve them twice mid-scroll.
		 */
		published_at: c.integer(),
		content_hash: c.text(),
		read_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export type SelectSettings = TableRow<typeof settings>;
export type InsertSettings = InsertRow<typeof settings>;
export type SelectFeed = TableRow<typeof feeds>;
export type InsertFeed = InsertRow<typeof feeds>;
export type SelectFeedItem = TableRow<typeof feedItems>;
export type InsertFeedItem = InsertRow<typeof feedItems>;
