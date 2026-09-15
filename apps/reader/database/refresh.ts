/**
 * The refresh path: retrieving one feed, folding what came back into a reader's posts,
 * and choosing which feeds are due. It takes a `Database` rather than a Durable Object,
 * so the whole thing runs in a plain test against SQLite with no object around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Feed, FeedFetchError } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { and, eq, getTableColumns, isNull, lt, lte, notNull, or } from "remix/data-table";

import type { InsertFeedItem, SelectFeed } from "~/database/schema";

import { feedItems, feeds } from "~/database/schema";

/**
 * Feeds one firing may attempt. It bounds how long a single alarm holds the object and
 * how many origins one firing talks to; whatever it leaves behind is reported as
 * `remaining` so the caller re-arms in a minute rather than an interval.
 */
const DEFAULT_LIMIT = 20;

/**
 * Feeds fetched at once. High enough that a run is paced by the slowest origin rather
 * than by the sum of them, low enough that one reader's refresh is not a burst of
 * connections from the object's single thread.
 */
const DEFAULT_CONCURRENCY = 6;

/**
 * How long one feed's fetch may take. It caps what a single unresponsive origin costs
 * the run, so twenty healthy feeds still refresh while one of them hangs.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Posts kept per feed. It bounds the object's storage against the 10 GB an object gets,
 * while leaving a reader months of a daily feed to look back through.
 */
const DEFAULT_RETENTION = 500;

/**
 * The first backoff a failing feed waits. Short enough that a feed down for one poll is
 * back within the hour, long enough that a flapping origin is not polled every firing.
 */
const BASE_BACKOFF_MS = 5 * 60 * 1000;

/**
 * The longest a failing feed waits between attempts. A feed whose origin has been gone
 * for days is still retried daily, so it recovers on its own once the origin returns.
 */
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;

/** Bound parameters one SQL storage statement accepts, which is what chunks an insert. */
const MAX_BOUND_PARAMETERS = 100;

/**
 * The longest body a stored post keeps. A Durable Object's row is capped at 2 MB, so a
 * publisher who inlines a whole book still leaves every other column of the row its room.
 * {@link displayableOf} applies it, which is what keeps a cut body hashing the same twice.
 */
export const MAX_CONTENT_LENGTH = 1_000_000;

/**
 * The longest summary a stored post keeps. Its own cap rather than the body's, so the two
 * together still leave the row room: a summary is a paragraph even when a publisher sends
 * a chapter.
 */
export const MAX_SUMMARY_LENGTH = 100_000;

/**
 * The status behind a failed retrieval. `Feed.fetch` reports an error status and an
 * unreachable origin through one error type and carries the number only in the message,
 * so reading it back here is what fills `last_http_status` — and lets a view say a feed
 * 404s by reading a column instead of prose.
 */
const HTTP_STATUS_MESSAGE = /^Failed to fetch feed: (\d{3})$/;

/** The columns any success writes, so a feed that answers at all leaves the backoff. */
const CLEARED_FAILURE = {
	last_error: null,
	failure_count: 0,
	next_attempt_at: null,
} satisfies Partial<SelectFeed>;

/**
 * What one feed's refresh recorded. Every branch is an outcome rather than a throw: the
 * alarm that drives these must never reject, and a feed that 404s is ordinary news about
 * that feed rather than a failure of the run it happened in.
 */
export type RefreshOutcome =
	| { status: "ok"; inserted: number; updated: number }
	/** The origin answered 304, so the stored copy is current and nothing was parsed. */
	| { status: "not_modified" }
	| { status: "http_error"; httpStatus: number; message: string }
	| { status: "network_error"; message: string }
	| { status: "parse_error"; message: string };

/** What one firing of the refresh got through. */
export interface RefreshRun {
	/** Feeds this firing attempted, at most the budget it was given. */
	attempted: number;
	/** Feeds still due when the budget ran out, so the caller can re-arm sooner. */
	remaining: number;
}

/** How a whole refresh run is bounded. */
export interface RefreshRunOptions {
	/** Epoch milliseconds this run is measured against, threaded through for testability. */
	now: number;
	/** Most feeds to attempt in one firing. */
	limit?: number;
	/** How many feeds are fetched at once. */
	concurrency?: number;
	/** How long one feed's fetch may take before it is abandoned. */
	timeoutMs?: number;
	/** Most posts to keep per feed; older read ones beyond it are pruned. */
	retention?: number;
}

/**
 * The fields a reader sees, and the whole of what `content_hash` is taken over. A
 * publication date stays out of it deliberately: feeds that re-date every entry on every
 * poll exist, and one of them would otherwise read as a publisher editing everything.
 */
export interface Displayable {
	title: string;
	url: string | null;
	summary: string | null;
	content: string | null;
	author: string | null;
}

/** One re-published entry, addressed by the guid that identifies it within its feed. */
interface ItemEdit {
	guid: string;
	changes: InsertFeedItem;
}

/** What a parsed document turned into once compared against what is already stored. */
interface Classification {
	inserts: InsertFeedItem[];
	edits: ItemEdit[];
}

/**
 * Retrieves one feed and writes what changed: new posts inserted, edited ones updated,
 * and the feed's own validators and failure state stamped either way.
 *
 * A poll where nothing changed performs no writes beyond the feed's own timestamps.
 *
 * @param db - The reader's database.
 * @param feed - The stored feed, whose `etag` and `last_modified` are sent as preconditions.
 * @param options - The clock this run reads, and an optional per-fetch deadline.
 */
export async function refreshFeed(
	db: Database,
	feed: SelectFeed,
	options: { now: number; timeoutMs?: number },
): Promise<RefreshOutcome> {
	let now = options.now;

	try {
		let result = await Feed.fetch(feed.feed_url, {
			etag: feed.etag,
			lastModified: feed.last_modified,
			signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
		});

		if (isFailure(result)) {
			let outcome = classifyFailure(result.error);
			await recordFailure(db, feed, outcome, now);
			return outcome;
		}

		let retrieved = result.data;

		if (retrieved.notModified) {
			await db.update(
				feeds,
				{ id: feed.id },
				{
					...carriedValidators(feed, retrieved.etag, retrieved.lastModified),
					last_fetched_at: now,
					last_status: "not_modified",
					last_http_status: 304,
					...CLEARED_FAILURE,
					updated_at: now,
				},
			);

			return { status: "not_modified" };
		}

		let known = await storedDigests(db, feed.id);
		let { inserts, edits } = await classify(feed, retrieved.feed.items, known, now);

		for (let chunk of chunked(inserts, insertChunkSize())) {
			await db.createMany(feedItems, chunk, { touch: false });
		}

		for (let edit of edits) {
			await db.updateMany(feedItems, edit.changes, {
				where: { feed_id: feed.id, guid: edit.guid },
				touch: false,
			});
		}

		await db.update(
			feeds,
			{ id: feed.id },
			{
				...carriedValidators(feed, retrieved.etag, retrieved.lastModified),
				last_fetched_at: now,
				last_status: "ok",
				last_http_status: retrieved.status,
				...CLEARED_FAILURE,
				updated_at: now,
			},
		);

		return { status: "ok", inserted: inserts.length, updated: edits.length };
	} catch (error) {
		/**
		 * An unexpected throw is reported as a feed that could not be reached: the caller's
		 * only decision is whether this feed refreshed, and that is what the union says.
		 */
		let outcome = { status: "network_error", message: describe(error) } as const;
		await recordFailure(db, feed, outcome, now).catch(() => undefined);
		return outcome;
	}
}

/**
 * Refreshes every feed whose backoff has elapsed, a bounded number at a time.
 *
 * Resolves rather than rejects however badly the run went, so an alarm can await it
 * directly without a rejection reaching the platform and earning a retry.
 *
 * @param db - The reader's database.
 * @param options - The clock, the budget, and the retention cap applied after each feed.
 */
export async function refreshDueFeeds(
	db: Database,
	options: RefreshRunOptions,
): Promise<RefreshRun> {
	let {
		now,
		limit = DEFAULT_LIMIT,
		concurrency = DEFAULT_CONCURRENCY,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		retention = DEFAULT_RETENTION,
	} = options;

	try {
		let due = or(isNull("next_attempt_at"), lte("next_attempt_at", now));
		let total = await db.count(feeds, { where: due });

		/**
		 * Stalest first, and a feed never fetched leads them, since SQLite sorts NULL ahead
		 * of every value. That ordering is what keeps a reader with more feeds than one
		 * firing can carry from refreshing the same head of the list every time.
		 */
		let batch = await db.findMany(feeds, {
			where: due,
			orderBy: [
				["last_fetched_at", "asc"],
				["id", "asc"],
			],
			limit,
		});

		let next = 0;
		let workers = Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
			while (next < batch.length) {
				let feed = batch[next++];
				if (feed === undefined) return;
				await refreshOne(db, feed, { now, timeoutMs, retention });
			}
		});

		await Promise.allSettled(workers);

		return { attempted: batch.length, remaining: Math.max(0, total - batch.length) };
	} catch {
		return { attempted: 0, remaining: 0 };
	}
}

/**
 * Drops the oldest read posts of one feed beyond `keep`, and reports how many went.
 *
 * Only read posts are eligible. Retention is the one thing that deletes a post — a post
 * that fell out of the feed document is kept, since a feed carries only its most recent
 * entries and dropping the rest would erase a reader's history a week after publication.
 *
 * @param db - The reader's database.
 * @param feedId - The feed to prune.
 * @param keep - How many of the feed's posts to leave in place.
 */
export async function pruneFeed(db: Database, feedId: string, keep: number): Promise<number> {
	let read = and({ feed_id: feedId }, notNull("read_at"));

	if (keep <= 0) {
		return (await db.deleteMany(feedItems, { where: read })).affectedRows;
	}

	/**
	 * The oldest post inside the cap, found by counting down the feed's own timeline. Read
	 * and unread alike count toward it, so the cap describes the feed's whole footprint
	 * rather than a number that grows with whatever the reader has left unread.
	 */
	let [cutoff] = await db
		.query(feedItems)
		.where({ feed_id: feedId })
		.select("published_at", "id")
		.orderBy("published_at", "desc")
		.orderBy("id", "desc")
		.limit(1)
		.offset(keep - 1)
		.all();

	if (cutoff === undefined) return 0;

	let older = or(
		lt("published_at", cutoff.published_at),
		and(eq("published_at", cutoff.published_at), lt("id", cutoff.id)),
	);

	return (await db.deleteMany(feedItems, { where: and(read, older) })).affectedRows;
}

/**
 * One feed's whole turn in a run: refreshed, then pruned to the retention cap. Whatever
 * went wrong stops here, so the worker that took this feed carries on to the next one
 * rather than retiring with the queue half read.
 */
async function refreshOne(
	db: Database,
	feed: SelectFeed,
	options: { now: number; timeoutMs: number; retention: number },
): Promise<void> {
	try {
		await refreshFeed(db, feed, options);
		await pruneFeed(db, feed.id, options.retention);
	} catch {
		return;
	}
}

/**
 * The validators to store, preferring what this response carried. A 304 is allowed to
 * omit them, and dropping them then would send the next poll without preconditions and
 * spend a whole document on a feed that has not changed.
 */
function carriedValidators(
	feed: SelectFeed,
	etag: string | undefined,
	lastModified: string | undefined,
) {
	return { etag: etag ?? feed.etag, last_modified: lastModified ?? feed.last_modified };
}

/** Reads a thrown value's message, whether or not what threw was an `Error`. */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Sorts a failed retrieval into the category `last_status` records. */
function classifyFailure(
	error: Error,
): Extract<RefreshOutcome, { status: "http_error" | "network_error" | "parse_error" }> {
	if (!(error instanceof FeedFetchError)) {
		return { status: "parse_error", message: error.message };
	}

	let status = HTTP_STATUS_MESSAGE.exec(error.message)?.[1];
	if (status === undefined) return { status: "network_error", message: error.message };

	return { status: "http_error", httpStatus: Number(status), message: error.message };
}

/** Stamps the feed with why it failed and how long it waits before the next attempt. */
async function recordFailure(
	db: Database,
	feed: SelectFeed,
	outcome: Extract<RefreshOutcome, { status: "http_error" | "network_error" | "parse_error" }>,
	now: number,
): Promise<void> {
	let failureCount = feed.failure_count + 1;

	await db.update(
		feeds,
		{ id: feed.id },
		{
			last_fetched_at: now,
			last_status: outcome.status,
			last_http_status: outcome.status === "http_error" ? outcome.httpStatus : null,
			last_error: outcome.message,
			failure_count: failureCount,
			next_attempt_at: now + backoffFor(failureCount),
			updated_at: now,
		},
	);
}

/** How long a feed waits after its `count`-th consecutive failure. */
function backoffFor(count: number): number {
	let doublings = Math.min(count - 1, Math.ceil(Math.log2(MAX_BACKOFF_MS / BASE_BACKOFF_MS)));
	return Math.min(BASE_BACKOFF_MS * 2 ** doublings, MAX_BACKOFF_MS);
}

/**
 * Every stored entry of one feed as guid to digest — the single prefetch that sorts a
 * whole document into inserts, no-ops and edits in memory, so an unchanged poll compares
 * rows without touching one.
 */
async function storedDigests(db: Database, feedId: string): Promise<Map<string, string>> {
	let rows = await db
		.query(feedItems)
		.where({ feed_id: feedId })
		.select("guid", "content_hash")
		.all();

	return new Map(rows.map((row) => [row.guid, row.content_hash]));
}

/** Sorts every parsed entry against what is stored, without writing anything. */
async function classify(
	feed: SelectFeed,
	entries: Feed.Item[],
	known: Map<string, string>,
	now: number,
): Promise<Classification> {
	let inserts: InsertFeedItem[] = [];
	let edits: ItemEdit[] = [];

	for (let entry of entries) {
		let displayable = displayableOf(entry);
		let hash = await digest(displayable);
		let stored = known.get(entry.guid);

		if (stored === undefined) {
			inserts.push({
				id: TypeID.fromUUID("item", generateUUID()).toString(),
				feed_id: feed.id,
				guid: entry.guid,
				...displayable,
				published_at: publishedAt(entry, now),
				content_hash: hash,
				read_at: null,
				created_at: now,
				updated_at: now,
			});
			continue;
		}

		if (stored === hash) continue;

		/**
		 * `read_at`, `id` and `published_at` are absent by construction: a publisher fixing
		 * a typo leaves a read article read, keeps the key the timeline's tiebreaker was
		 * minted from, and leaves the leading cursor column where an in-flight cursor
		 * expects to find it.
		 */
		edits.push({
			guid: entry.guid,
			changes: { ...displayable, content_hash: hash, updated_at: now },
		});
	}

	return { inserts, edits };
}

/**
 * The fields a reader sees, resolved to what the row will hold. Build every stored post
 * from this, on any path: a publisher who titles nothing still gets something to click on,
 * and a body past {@link MAX_CONTENT_LENGTH} is cut here so it is hashed as it is stored.
 *
 * @param entry - One entry of a parsed feed document.
 */
export function displayableOf(entry: Feed.Item): Displayable {
	let content = entry.contentHtml ?? null;

	let summary = entry.summary ?? null;

	return {
		title: entry.title ?? entry.url ?? entry.guid,
		url: entry.url ?? null,
		summary: summary === null ? null : summary.slice(0, MAX_SUMMARY_LENGTH),
		content: content === null ? null : content.slice(0, MAX_CONTENT_LENGTH),
		author: entry.author?.name ?? null,
	};
}

/**
 * When a post was published, falling back to `now` so the column the timeline sorts on is
 * total. Call it for an entry being inserted: a stored post keeps the date it was written
 * with, so a feed that jitters its dates re-dates nothing.
 *
 * @param entry - One entry of a parsed feed document.
 * @param now - Epoch milliseconds the entry is first seen at.
 */
export function publishedAt(entry: Feed.Item, now: number): number {
	let published = entry.publishedAt?.getTime();
	return published === undefined || Number.isNaN(published) ? now : published;
}

/**
 * The digest that tells an edited post from an unchanged one, which is what `content_hash`
 * holds. Take it over a {@link displayableOf} projection on every path that writes a post,
 * so the first poll after a subscription reads every post it already stored as unchanged.
 *
 * @param displayable - The fields the row will hold, as {@link displayableOf} resolved them.
 */
export async function digest(displayable: Displayable): Promise<string> {
	let source = JSON.stringify([
		displayable.title,
		displayable.url,
		displayable.summary,
		displayable.content,
		displayable.author,
	]);

	let hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));

	return [...new Uint8Array(hashed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Rows one insert statement fits, derived from the schema so it follows a new column.
 * Call it from any path inserting posts: a Durable Object statement binds at most
 * {@link MAX_BOUND_PARAMETERS} parameters, and a batch sized by hand stops being right
 * the day a column is added.
 */
export function insertChunkSize(): number {
	let columns = Object.keys(getTableColumns(feedItems)).length;
	return Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columns));
}

/**
 * Splits a batch into runs of `size`, the last one holding whatever is left.
 *
 * @param values - The batch to split.
 * @param size - The largest run to produce.
 */
export function chunked<value>(values: readonly value[], size: number): value[][] {
	let chunks: value[][] = [];
	for (let index = 0; index < values.length; index += size) {
		chunks.push(values.slice(index, index + size));
	}
	return chunks;
}
