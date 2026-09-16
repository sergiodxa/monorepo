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

/** One minute, the unit the polling floor is expressed in. */
const MINUTE_MS = 60 * 1000;

/** One hour, the unit most of the cadence table is expressed in. */
const HOUR_MS = 60 * MINUTE_MS;

/** One day, the unit the ceiling and the dormant cadence are expressed in. */
const DAY_MS = 24 * HOUR_MS;

/**
 * The shortest wait any feed serves, whatever it publishes.
 *
 * It is the only thing bounding what the busiest feed in the system costs, and below it
 * the gain stops being visible anyway: the head a reader compares against is eventually
 * consistent for up to a minute, and they find out when they next open the app.
 */
export const POLL_FLOOR_MS = 15 * MINUTE_MS;

/** The longest wait a feed that is publishing anything at all serves. */
export const POLL_CEILING_MS = DAY_MS;

/**
 * What a feed with nothing published inside the rate window waits.
 *
 * Weekly notices a resurrection within a week while returning most of that feed's budget.
 * It is not zero because nothing else here can tell us a publication resumed: dormant is
 * a cadence, and retirement is what the last unsubscribe already does.
 */
export const POLL_DORMANT_MS = 7 * DAY_MS;

/**
 * How long a new feed is polled at {@link POLL_WARMUP_INTERVAL_MS} before its own
 * measurement decides.
 *
 * A feed document carries only its most recent entries, so a firehose whose document
 * holds fifty of them measures as though it published fifty in a month. Truncation can
 * only make a feed look slower than it is, and slow is the expensive answer to be wrong
 * about, so a day of observed publishing is bought for twenty-four extra polls.
 */
export const POLL_WARMUP_MS = DAY_MS;

/** The cadence a feed serves through {@link POLL_WARMUP_MS}, unless its rate is faster. */
export const POLL_WARMUP_INTERVAL_MS = HOUR_MS;

/**
 * The share of a boundary a rate must fall below before a feed slows down again.
 *
 * Speeding up costs a little money and slowing down costs a reader latency, so the cheap
 * error is the one made eagerly: a rate crossing upward moves bands at once, and a rate
 * drifting back settles rather than flapping between two cadences forever.
 */
export const POLL_SLOWDOWN_THRESHOLD = 0.8;

/** One row of the cadence table: the rate at which it starts, and what that rate waits. */
export interface PollBand {
	/** Posts a day at or above which this band applies. */
	minRate: number;
	intervalMs: number;
}

/**
 * The cadence table, fastest band first, covering every rate above zero.
 *
 * The boundaries fall where `interval ≈ 4.8 / rate` hours crosses between two bands, which
 * holds a post's worst wait between a tenth and a little over four tenths of the time the
 * feed itself takes between posts — so a newspaper and an essayist give their readers the
 * same guarantee even though their intervals differ by two orders of magnitude.
 */
export const POLL_BANDS: readonly PollBand[] = [
	{ minRate: 10, intervalMs: POLL_FLOOR_MS },
	{ minRate: 2.5, intervalMs: HOUR_MS },
	{ minRate: 0.7, intervalMs: 4 * HOUR_MS },
	{ minRate: 0.3, intervalMs: 12 * HOUR_MS },
	{ minRate: 0, intervalMs: POLL_CEILING_MS },
];

/**
 * How long this feed waits before it is fetched again, from what it has been publishing.
 *
 * The previous rate is what supplies the hysteresis, so nothing has to be stored beside
 * the measurement: a poll reads `posts_per_day` before it writes the new one, which puts
 * the band a feed was in and the band it now measures at both in hand.
 *
 * @param previousRate - The rate this feed measured on its previous poll, if it has one.
 * @param rate - The rate it measures now, where zero means nothing inside the window.
 * @param createdAt - Epoch milliseconds this feed's row was written.
 * @param now - Epoch milliseconds the decision is made at.
 * @example let interval = pollIntervalFor(feed.posts_per_day, rate, feed.created_at, now);
 */
export function pollIntervalFor(
	previousRate: number | null,
	rate: number | null,
	createdAt: number,
	now: number,
): number {
	let measured = rate ?? 0;
	let interval = measured <= 0 ? POLL_DORMANT_MS : heldBand(previousRate, measured).intervalMs;

	if (now - createdAt < POLL_WARMUP_MS) return Math.min(interval, POLL_WARMUP_INTERVAL_MS);

	return interval;
}

/**
 * The band `rate` sits in, kept at the faster one while the rate stays within
 * {@link POLL_SLOWDOWN_THRESHOLD} of the boundary it crossed on the way up.
 */
function heldBand(previousRate: number | null, rate: number): PollBand {
	let band = bandFor(rate);

	if (previousRate === null || previousRate <= 0) return band;

	let previous = bandFor(previousRate);
	if (band.intervalMs <= previous.intervalMs) return band;

	return rate >= previous.minRate * POLL_SLOWDOWN_THRESHOLD ? previous : band;
}

/** The band a rate above zero falls in, read straight off {@link POLL_BANDS}. */
function bandFor(rate: number): PollBand {
	return (
		POLL_BANDS.find((band) => rate >= band.minRate) ?? { minRate: 0, intervalMs: POLL_CEILING_MS }
	);
}

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
