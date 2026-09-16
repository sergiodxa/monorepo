/**
 * The canonical feed's schema, declared for `remix/data-table` over the SQL each feed
 * object keeps in its own storage. Column names and types mirror
 * `database/feed-migrations/` exactly, since that SQL is what actually creates the
 * tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Payload accepted when writing a row, with database defaults left out. */
type InsertRow<sourceTable extends AnyTable> = Partial<TableRow<sourceTable>>;

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

/**
 * How often every feed is polled.
 *
 * One number for all of them, because the object doing the polling has no reader to ask:
 * it is shared by everyone following the feed, and a cadence is a question about a
 * document rather than about a person. Daily is what the median feed justifies — a blog
 * that posts weekly answers `304` a hundred and sixty-seven times out of a hundred and
 * sixty-eight at hourly — and a reader who wants something sooner still has the check
 * they can ask for on the spot.
 */
export const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * How long a feed nobody follows is kept before its storage, its head and its catalog row
 * go. An unfollow and a re-follow a day later then costs one fetch rather than a
 * re-download of everything the feed has ever published.
 */
export const PURGE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Items one feed keeps, oldest dropped first.
 *
 * At something under two kilobytes a row this is about a fifth of the ten gigabytes an
 * object gets, which leaves the estimate room to be wrong by five times. There is no age
 * rule beside it: a count bites first only for a feed above a couple of thousand posts a
 * day, so an age rule would only ever fire on an object that had room to spare — a blog
 * posting weekly held to its last year while it used a hundred kilobytes of ten gigabytes.
 *
 * Being generous is cheaper here than anywhere else, because one object is shared by every
 * subscriber of the feed: its history is paid for once rather than once per follower.
 */
export const FEED_RETENTION = 1_000_000;

export const feed = table({
	name: "feed",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		/** Pinned to 1 by a `CHECK`: an object holds one feed, so this table holds one row. */
		id: c.integer(),
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
		/**
		 * The counter issuing every tick this feed hands out, and the head it publishes. It
		 * only ever moves forward, including through a sweep that empties the table, which
		 * is what keeps a subscriber's cursor meaningful after a delete.
		 */
		head: c.integer().default(0),
		/** Declared with a scale because SQLite's REAL affinity carries a fraction of a post. */
		posts_per_day: c.decimal(8, 3).nullable(),
		purge_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export const items = table({
	name: "items",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		/**
		 * Minted here, on discovery, and copied verbatim into every subscriber's own row.
		 * That is what makes synchronization idempotent: the same item arriving twice is an
		 * upsert on a primary key rather than a duplicate.
		 */
		id: c.text(),
		/**
		 * The publisher's own identity for the entry. It exists to recognize the same entry
		 * on the next fetch and is never a primary key: it is chosen by somebody else, and
		 * can be reused, re-scoped or malformed.
		 */
		guid: c.text(),
		sequence: c.integer(),
		revision: c.integer(),
		title: c.text(),
		url: c.text().nullable(),
		summary: c.text().nullable(),
		author: c.text().nullable(),
		published_at: c.integer(),
		content_hash: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export const subscribers = table({
	name: "subscribers",
	primaryKey: ["user_id"],
	columns: {
		user_id: c.text(),
		subscribed_at: c.integer(),
	},
});

export type SelectFeed = TableRow<typeof feed>;
export type InsertFeed = InsertRow<typeof feed>;
export type SelectItem = TableRow<typeof items>;
export type InsertItem = InsertRow<typeof items>;
export type SelectSubscriber = TableRow<typeof subscribers>;
