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
 * How long a post from a feed stays in the reader's timeline, measured from when it was
 * published. The `CHECK` constraint in `0006-shared-feed-objects.sql` repeats these
 * names, so the database refuses anything a form somehow lets through.
 *
 * It is a per-subscription answer because two people following one newspaper disagree
 * about it all the time — one wants the day's headlines gone by evening, the other keeps
 * them for the weekend — and neither is wrong, so neither answer belongs in the object
 * they share.
 */
export const VELOCITIES = ["breaking", "news", "article", "essay", "evergreen"] as const;

/** One of the answers {@link VELOCITIES} offers. */
export type Velocity = (typeof VELOCITIES)[number];

/**
 * How long each of them holds a post, and `null` for the one that never lets go.
 *
 * Measured from when the world saw the post rather than from when this system found it,
 * which is the opposite of the rule the feed side prunes by and for the opposite reason:
 * a headline published four hours ago is stale whether it was discovered four hours ago
 * or four minutes ago.
 */
export const VELOCITY_WINDOW_MS: Record<Velocity, number | null> = {
	breaking: 3 * 60 * 60 * 1000,
	news: 18 * 60 * 60 * 1000,
	article: 3 * 24 * 60 * 60 * 1000,
	essay: 14 * 24 * 60 * 60 * 1000,
	evergreen: null,
};

/**
 * What a subscription holds until the reader says otherwise, which is everything. A rule
 * that deletes an unread post is the reader's to ask for, so nothing ages out of a feed
 * they have not set a velocity on.
 */
export const DEFAULT_VELOCITY: Velocity = "evergreen";

/**
 * Posts one reader's object keeps across every feed they follow.
 *
 * A budget rather than a per-feed number, because a per-feed number is wrong at both
 * ends: a reader following one feed would be held to a cap sized for somebody following
 * two hundred, and a reader following two hundred would be allowed two hundred times more
 * than one of them. The object is what has a limit, so the object is what gets the figure,
 * and a feed's share of it is this divided by how many feeds the reader follows.
 *
 * Around two gigabytes at the size of a row, a fifth of the ten gigabytes an object gets,
 * which leaves room for the estimate to be wrong by five times. It sits that far inside
 * the object rather than at its edge because a reader notices what happens at the edge:
 * a budget that cannot be reclaimed stops taking posts rather than deleting them.
 */
export const READER_BUDGET = 1_000_000;

/**
 * Posts a reader may keep saved.
 *
 * The number is about what a person can meaningfully keep rather than about storage — a
 * thousand posts is two megabytes against that budget. Reaching it refuses the next save
 * rather than evicting the oldest, because evicting would delete the one thing in this
 * design a reader explicitly asked to keep.
 */
export const SAVED_LIMIT = 1000;

export const settings = table({
	name: "settings",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.integer(),
		subject: c.text(),
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
		/** This app's own handle for the subscription, which its URLs are built from. */
		id: c.text(),
		/** The catalog's identifier for the feed, which names the object behind it. */
		feed_id: c.text(),
		feed_url: c.text(),
		site_url: c.text().nullable(),
		title: c.text(),
		description: c.text().nullable(),
		language: c.text().nullable(),
		image_url: c.text().nullable(),
		cursor: c.integer().default(0),
		velocity: c.enum(VELOCITIES).default(DEFAULT_VELOCITY),
		unfollowed_at: c.integer().nullable(),
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
		author: c.text().nullable(),
		/**
		 * Written on insert and never updated. It leads the timeline's ordering, so
		 * moving a row within that ordering would make a cursor already in flight skip
		 * posts or serve them twice mid-scroll.
		 */
		published_at: c.integer(),
		read_at: c.integer().nullable(),
		saved_at: c.integer().nullable(),
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
