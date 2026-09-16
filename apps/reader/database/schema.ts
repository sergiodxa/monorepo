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

import type { Tier } from "~/app/lib/entitlement";

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
 * Posts one reader's object keeps across every feed they follow, by the tier they are on.
 *
 * A budget rather than a per-feed number, because a per-feed number is wrong at both
 * ends: a reader following one feed would be held to a cap sized for somebody following
 * two hundred, and a reader following two hundred would be allowed two hundred times more
 * than one of them. The object is what has a limit, so the object is what gets the figure,
 * and a feed's share of it is this divided by how many feeds the reader follows.
 *
 * Each figure is a count of rows priced at two kilobytes apiece, against the ten
 * gigabytes an object gets: half a gigabyte, three, and six. They sit that far inside the
 * object because a write to a full one fails and takes the sweep that would make room with
 * it, where a budget reached is back-pressure the interface explains.
 */
export const TIER_BUDGETS: Record<Tier, number> = {
	free: 250_000,
	paid: 1_500_000,
	premium: 3_000_000,
};

/**
 * Posts a reader may keep saved, by the tier they are on.
 *
 * The numbers are about what a person can meaningfully keep rather than about storage —
 * the largest of them is fifty megabytes against a budget measured in gigabytes. Reaching
 * one refuses the next save rather than evicting the oldest, because evicting would delete
 * the one thing in this design a reader explicitly asked to keep.
 */
export const TIER_SAVED_LIMITS: Record<Tier, number> = {
	free: 1_000,
	paid: 5_000,
	premium: 25_000,
};

/**
 * Labels one reader may have.
 *
 * A hundred keeps the picker the same kind of thing as the rail: one unpaged read, drawn
 * whole, scannable without a search box of its own. Somebody with four hundred labels has
 * a second junk drawer with a worse interface, and the honest moment to say so is at the
 * hundred-and-first rather than when they are looking for something.
 */
export const TAG_LIMIT = 100;

/**
 * Labels one post may carry. It bounds the join table against the saved cap, and is
 * generous against how anybody labels: a post with eleven reasons to have been kept has
 * none.
 */
export const TAGS_PER_ITEM = 10;

/**
 * How long a label may be, in UTF-16 units. Thirty-two is where a label is still a chip on
 * one line beside four others, and past which somebody is writing a note into a field the
 * search serves better.
 */
export const TAG_NAME_LENGTH = 32;

/**
 * Subscriptions a reader may pin. A feed somebody never wants to miss stops meaning
 * anything at thirty, the strip has to sit above the river without becoming the page, and
 * ten ids sit well inside the hundred-parameter bind limit every lookup here works under.
 */
export const PIN_LIMIT = 10;

/**
 * Below what measured rate a feed is quiet: one post a week, against the thirty-day window
 * the measurement is taken over, so a monthly newsletter at 0.03 and a three-a-month blog
 * at 0.1 are in while a twice-weekly feed is out.
 *
 * It is the same judgement as the rate above which a feed publishes enough to be worth
 * offering a velocity for, read from the other end: that one decides when a feed is busy,
 * this one when it publishes so little that it disappears.
 */
export const QUIET_POSTS_PER_DAY = 1 / 7;

export const settings = table({
	name: "settings",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.integer(),
		subject: c.text(),
		last_refreshed_at: c.integer().nullable(),
		/** What every limit check reads, written only by the one RPC that takes a snapshot. */
		tier: c.text().default("free"),
		/** Whether the payment platform put the tier there or a person did. */
		tier_source: c.text().default("default"),
		/** When the lapse window runs out, and `null` while the reader has not lapsed. */
		grace_until: c.integer().nullable(),
		/**
		 * When a snapshot last confirmed the tier. A write carrying an older read is refused,
		 * so two snapshots landing out of order converge on the later one.
		 */
		tier_checked_at: c.integer().default(0),
		/** When the reader last opened the reader, which dormancy is measured from. */
		last_opened_at: c.integer().nullable(),
		/** When the next scheduled freshness check is due, and `null` for a tier arming none. */
		next_check_at: c.integer().nullable(),
		/** When the next retention sweep is due, so a velocity window closes on its own. */
		next_sweep_at: c.integer().nullable(),
		/** When the leftovers of a bounded run carry on, and `null` while there are none. */
		next_catch_up_at: c.integer().nullable(),
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
		/** The group the reader filed this subscription into, or `null` for an unfiled one. */
		folder_id: c.text().nullable(),
		/**
		 * When the reader pinned this subscription, or `null` for one they have not. A
		 * timestamp rather than a boolean, for the reason the other marks here are: it
		 * answers when as well as whether, so pin order is an ordering the reader produced.
		 */
		pinned_at: c.integer().nullable(),
		/**
		 * What the feed publishes, in posts per day, as the feed's own object measured it.
		 * Declared as a decimal here for a column the migration creates as `REAL`, since a
		 * rate below one post a day is the whole of what it is read for.
		 */
		posts_per_day: c.decimal(10, 4).nullable(),
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
		/**
		 * The folder of the subscription this post belongs to, copied in when the post is
		 * written, which is what makes a folder's timeline the seek every other timeline is.
		 * It is rewritten whenever the subscription moves, since it is the reader's own
		 * answer rather than the publisher's and it orders nothing.
		 */
		folder_id: c.text().nullable(),
	},
});

/**
 * Named groups of subscriptions, each with a stream of its own.
 *
 * Flat: no parent, no position, no depth. The list is short and it is drawn in the order
 * the names read, the way the rail draws subscriptions, and the unique title in
 * `0007-folders.sql` is what both keeps two rows from reading alike and makes filing by
 * name an upsert.
 */
export const folders = table({
	name: "folders",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		title: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * The labels a reader puts on the posts they kept.
 *
 * Held by an id rather than by the name, which is what makes renaming one write a single
 * row however many posts carry it and keeps a URL built from a label working after it is
 * renamed. {@link tags.slug} is the folded form uniqueness is taken over, so `Rust` and
 * `rust` are one label wearing the name it was first given.
 */
export const tags = table({
	name: "tags",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		/** The name as the reader typed it, which is the one drawn. */
		name: c.text(),
		/** The case-folded form uniqueness and matching are taken over. */
		slug: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * Which posts carry which label, one row per pairing.
 *
 * `published_at` is a copy of the post's own. It is what puts the filter and both ordering
 * columns into one index, since no index spans two tables, and it is safe to copy because
 * that column is frozen against a publisher's edits: it leads the timeline's ordering, and
 * a row moving within that ordering would make an in-flight cursor skip posts. The copy is
 * written once, by the statement that applies the label.
 *
 * Every row here belongs to a saved post by construction, so a query for a reader's kept
 * posts under one label needs no `saved_at` filter: the join is the filter.
 */
export const itemTags = table({
	name: "item_tags",
	primaryKey: ["tag_id", "item_id"],
	columns: {
		tag_id: c.text(),
		item_id: c.text(),
		published_at: c.integer(),
		created_at: c.integer(),
	},
});

export type SelectTag = TableRow<typeof tags>;
export type InsertTag = InsertRow<typeof tags>;
export type SelectItemTag = TableRow<typeof itemTags>;
export type InsertItemTag = InsertRow<typeof itemTags>;

export type SelectFolder = TableRow<typeof folders>;
export type InsertFolder = InsertRow<typeof folders>;

export type SelectSettings = TableRow<typeof settings>;
export type InsertSettings = InsertRow<typeof settings>;
export type SelectFeed = TableRow<typeof feeds>;
export type InsertFeed = InsertRow<typeof feeds>;
export type SelectFeedItem = TableRow<typeof feedItems>;
export type InsertFeedItem = InsertRow<typeof feedItems>;
