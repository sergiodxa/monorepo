/**
 * The refresh path: retrieving one feed and folding what came back into that feed's own
 * items. It takes a `Database` rather than a Durable Object, so the whole thing runs in a
 * plain test against SQLite with no object around it.
 *
 * Nothing here is scoped by a feed id, because the database it writes to holds one feed.
 * A reader's copy of a post is made later, by that reader's own object, from what this
 * stored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Feed, FeedFetchError } from "@sdxc/feed";
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { and, getTableColumns, getTableName, gt, lt, lte } from "remix/data-table";

import type { InsertItem, SelectFeed } from "~/database/feed-schema";

import { feed as feedTable, items } from "~/database/feed-schema";

/** The feed row's id, pinned by a `CHECK`, since an object holds exactly one feed. */
export const FEED_ROW_ID = 1;

/**
 * How long one feed's fetch may take. It caps what an unresponsive origin costs the
 * object's single alarm, which has other feeds' subscribers waiting on nothing else.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

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
 * Stored entries the classification prefetches, newest decided first.
 *
 * A cache hit rate rather than a correctness boundary: `UNIQUE (guid)` is what guarantees
 * an entry is stored once, and anything this window did not answer for gets an exact point
 * lookup on that index. Bounding it is what keeps a poll's cost a function of the document
 * the publisher served rather than of everything the feed has ever published.
 */
export const DIGEST_PREFETCH = 1000;

/**
 * The longest line a stored post keeps under its title.
 *
 * It is what a row actually renders: the timeline draws the summary on the title's own
 * line and clips it, so storing a chapter to display a sentence makes the cost of a row
 * unpredictable for no reader-visible gain. Every summary is cut to this, whether the
 * publisher wrote one or it was drawn out of the body, so both kinds read the same and a
 * row's size is something this object can reason about.
 */
export const MAX_SUMMARY_LENGTH = 280;

/** Closes a shortened line, so the passage reads as cut rather than as a stopped sentence. */
const SUMMARY_MARKER = "…";

/**
 * How far back publishing is measured, and the window a rate is taken over. A month is
 * long enough that a weekly blog registers at all and short enough that a site which has
 * gone quiet stops being described by what it used to do.
 */
const RATE_WINDOW_DAYS = 30;

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
 * What one poll recorded. Every branch is an outcome rather than a throw: the alarm that
 * drives these must never reject, and a feed that 404s is ordinary news about that feed
 * rather than a failure of the run it happened in.
 */
export type PollOutcome =
	| { status: "ok"; inserted: number; edited: number; head: number }
	/** The origin answered 304, so the stored copy is current and nothing was parsed. */
	| { status: "not_modified" }
	| { status: "http_error"; httpStatus: number; message: string }
	| { status: "network_error"; message: string }
	| { status: "parse_error"; message: string };

/** The fields a reader sees, as a row will hold them. */
export interface Displayable {
	title: string;
	url: string | null;
	summary: string | null;
	author: string | null;
}

/** One re-published entry, addressed by the guid that identifies it within the feed. */
interface ItemEdit {
	guid: string;
	changes: InsertItem;
}

/** What a parsed document turned into once compared against what is already stored. */
interface Classification {
	inserts: InsertItem[];
	edits: ItemEdit[];
}

/**
 * Retrieves the feed and writes what changed: new items inserted, edited ones updated,
 * and the feed's own validators and failure state stamped either way.
 *
 * A poll where nothing changed performs no writes beyond the feed's own timestamps, and
 * reports a head unchanged from the one it started with, so its caller publishes nothing.
 *
 * @param db - The feed's database.
 * @param options - The clock this run reads, and an optional per-fetch deadline.
 * @returns What the poll did, as a value; it resolves however badly the fetch went.
 * @example let outcome = await pollFeed(db, { now: Date.now() });
 */
export async function pollFeed(
	db: Database,
	options: { now: number; timeoutMs?: number },
): Promise<PollOutcome> {
	let now = options.now;
	let feed = await db.find(feedTable, { id: FEED_ROW_ID });

	/** Nothing has been subscribed to this object yet, so there is no address to fetch. */
	if (feed === null) return { status: "network_error", message: "This feed has no document yet" };

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
				feedTable,
				{ id: FEED_ROW_ID },
				{
					...carriedValidators(feed, retrieved.etag, retrieved.lastModified),
					last_fetched_at: now,
					last_status: "not_modified",
					last_http_status: 304,
					posts_per_day: await measurePostsPerDay(db, now),
					...CLEARED_FAILURE,
					updated_at: now,
				},
			);

			return { status: "not_modified" };
		}

		let known = await storedDigests(db);
		let { inserts, edits } = await classify(db, retrieved.feed.items, known, feed.head, now);

		/**
		 * The head moves by one tick per thing decided, and each tick is used exactly once:
		 * an insert takes one and writes it to both `sequence` and `revision`, an edit takes
		 * one and writes it to `revision` alone. So `sequence` stays a pure record of
		 * discovery and `revision` is a gap-free order over what a subscriber has not seen.
		 */
		let head = feed.head + inserts.length + edits.length;

		await insertItems(db, inserts);

		for (let edit of edits) {
			await db.updateMany(items, edit.changes, { where: { guid: edit.guid }, touch: false });
		}

		await db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{
				...documentMetadata(retrieved.feed),
				...carriedValidators(feed, retrieved.etag, retrieved.lastModified),
				last_fetched_at: now,
				last_status: "ok",
				last_http_status: retrieved.status,
				head,
				posts_per_day: await measurePostsPerDay(db, now),
				...CLEARED_FAILURE,
				updated_at: now,
			},
		);

		return { status: "ok", inserted: inserts.length, edited: edits.length, head };
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
 * Drops the oldest items beyond `keep`, and reports how many went.
 *
 * Pruning runs on `revision` rather than on a date. It is the order this object decided
 * things in, it is exactly the order cursors move through, and the rows at the bottom of
 * it are by construction the ones furthest behind every subscriber. A publication date
 * would not be: a publisher posting an entry dated four years ago has published something
 * new, and pruning on that date would delete it before a single reader synchronized it.
 *
 * Deleting the oldest cannot strand a cursor. Cursors only move forward, a reader whose
 * cursor is below everything left simply receives what remains, and the head counter is
 * untouched by a delete — which is why a sweep publishes nothing.
 *
 * @param db - The feed's database.
 * @param keep - How many items to leave in place.
 * @param head - The feed's head counter, which never shrinks and so bounds the table.
 */
export async function pruneItems(db: Database, keep: number, head: number): Promise<number> {
	/**
	 * The counter takes a tick per insert and per edit, so it is never below the number of
	 * items ever written: one integer comparison proves the table is under the ceiling and
	 * skips an offset probe that would otherwise step through the whole index to delete
	 * nothing, on every successful poll of every feed.
	 */
	if (keep > 0 && head <= keep) return 0;

	if (keep <= 0) {
		let all = await db.count(items);
		await db.deleteMany(items, { where: gt("revision", 0) });

		return all;
	}

	/** The oldest item inside the cap, found by counting down the order it was decided in. */
	let [cutoff] = await db
		.query(items)
		.select("revision")
		.orderBy("revision", "desc")
		.limit(1)
		.offset(keep - 1)
		.all();

	if (cutoff === undefined) return 0;

	/** Strictly below, so the cutoff row is the oldest one kept rather than the newest gone. */
	let older = lt("revision", cutoff.revision);

	/**
	 * Counted before the delete: what a write reports is rows of storage, and an item lives
	 * in the table and in every index it appears in, so a sweep of a hundred items reports
	 * several hundred rows written. What a caller wants to know is how many items went.
	 */
	let dropped = await db.count(items, { where: older });
	if (dropped === 0) return 0;

	await db.deleteMany(items, { where: older });

	return dropped;
}

/**
 * What the feed is publishing, in posts per day over the last month.
 *
 * Measured rather than guessed, and measured here because this object already holds every
 * item with the date it carries: the figure is taken once for a feed and shared by
 * everyone following it, the same way the fetch and the parse are.
 *
 * Taken on every poll, whatever the origin answered: a feed that stopped publishing
 * answers `304` forever, and it is that feed whose rate has to keep falling until the
 * window slides off its last entry and the schedule can call it dormant.
 *
 * @param db - The feed's database.
 * @param now - Epoch milliseconds the window is measured back from.
 */
export async function measurePostsPerDay(db: Database, now: number): Promise<number> {
	let since = now - RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	let published = await db.count(items, {
		where: and(gt("published_at", since), lte("published_at", now)),
	});

	return published / RATE_WINDOW_DAYS;
}

/** The feed's own description of itself, as the document last carried it. */
function documentMetadata(document: Feed.Data) {
	return {
		title: document.title,
		site_url: document.siteUrl ?? null,
		description: document.description ?? null,
		language: document.language ?? null,
		image_url: document.imageUrl ?? null,
	};
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
): Extract<PollOutcome, { status: "http_error" | "network_error" | "parse_error" }> {
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
	outcome: Extract<PollOutcome, { status: "http_error" | "network_error" | "parse_error" }>,
	now: number,
): Promise<void> {
	let failureCount = feed.failure_count + 1;

	await db.update(
		feedTable,
		{ id: FEED_ROW_ID },
		{
			last_fetched_at: now,
			last_status: outcome.status,
			last_http_status: outcome.status === "http_error" ? outcome.httpStatus : null,
			last_error: outcome.message,
			posts_per_day: await measurePostsPerDay(db, now),
			failure_count: failureCount,
			next_attempt_at: now + backoffFor(failureCount),
			updated_at: now,
		},
	);
}

/** How long a feed waits after its `count`-th consecutive failure. */
export function backoffFor(count: number): number {
	let doublings = Math.min(count - 1, Math.ceil(Math.log2(MAX_BACKOFF_MS / BASE_BACKOFF_MS)));
	return Math.min(BASE_BACKOFF_MS * 2 ** doublings, MAX_BACKOFF_MS);
}

/**
 * Every stored entry as guid to digest — the single prefetch that sorts a whole document
 * into inserts, no-ops and edits in memory, so an unchanged poll compares rows without
 * touching one.
 */
async function storedDigests(db: Database): Promise<Map<string, string>> {
	let rows = await db
		.query(items)
		.select("guid", "content_hash")
		.orderBy("revision", "desc")
		.limit(DIGEST_PREFETCH)
		.all();

	return new Map(rows.map((row) => [row.guid, row.content_hash]));
}

/**
 * The digest of one stored entry, for a guid the prefetch window did not answer for.
 *
 * One seek on `UNIQUE (guid)`, and at most as many of them as the document carries
 * entries, which is what keeps an old entry re-served by a publisher recognized as stored
 * rather than inserted a second time.
 */
async function storedDigestOf(db: Database, guid: string): Promise<string | undefined> {
	let [stored] = await db.query(items).select("content_hash").where({ guid }).limit(1).all();
	return stored?.content_hash;
}

/**
 * Writes new items, skipping any guid the table already holds.
 *
 * `UNIQUE (guid)` is what guarantees an entry is stored once, and deferring to it rather
 * than failing on it is what makes two polls of one object interleaving safe: the loser of
 * the race writes nothing instead of aborting a chunk of rows that were all new.
 */
async function insertItems(db: Database, rows: readonly InsertItem[]): Promise<void> {
	if (rows.length === 0) return;

	let columns = Object.keys(getTableColumns(items));
	let placeholders = `(${columns.map(() => "?").join(", ")})`;

	for (let chunk of chunked(rows, insertChunkSize())) {
		let values = chunk.flatMap((row) => {
			let record: Record<string, unknown> = row;
			return columns.map((column) => record[column] ?? null);
		});

		await db.exec(
			`insert into ${getTableName(items)} (${columns.join(", ")}) values ${chunk
				.map(() => placeholders)
				.join(", ")} on conflict (guid) do nothing`,
			values,
		);
	}
}

/**
 * Sorts every parsed entry against what is stored, without writing anything, handing each
 * decision the next tick of the head counter.
 *
 * An entry the prefetch window did not answer for is looked up by its guid before it is
 * called new, so a publisher re-serving something older than the window finds it stored
 * rather than inserted a second time.
 */
async function classify(
	db: Database,
	entries: Feed.Item[],
	known: Map<string, string>,
	head: number,
	now: number,
): Promise<Classification> {
	let inserts: InsertItem[] = [];
	let edits: ItemEdit[] = [];
	let tick = head;

	for (let entry of entries) {
		let displayable = displayableOf(entry);
		let hash = await digest(displayable);
		let stored = known.get(entry.guid) ?? (await storedDigestOf(db, entry.guid));

		if (stored === undefined) {
			tick += 1;

			inserts.push({
				id: TypeID.fromUUID("item", generateUUID()).toString(),
				guid: entry.guid,
				sequence: tick,
				revision: tick,
				...displayable,
				published_at: publishedAt(entry, now),
				content_hash: hash,
				created_at: now,
				updated_at: now,
			});

			continue;
		}

		if (stored === hash) continue;

		tick += 1;

		/**
		 * `sequence`, `id` and `published_at` are absent by construction: an edit is the same
		 * entry saying something new, so it keeps the place it was discovered at, the key
		 * every subscriber's copy is joined by, and the date their timeline sorts it under.
		 * A fresh `revision` is what puts it back in front of each of them exactly once.
		 */
		edits.push({
			guid: entry.guid,
			changes: { ...displayable, revision: tick, content_hash: hash, updated_at: now },
		});
	}

	return { inserts, edits };
}

/**
 * The fields a reader sees, resolved to what the row will hold. Build every stored item
 * from this, on any path: a publisher who titles nothing still gets something to click on,
 * and a summary past {@link MAX_SUMMARY_LENGTH} is cut here so it is hashed as it is stored.
 *
 * @param entry - One entry of a parsed feed document.
 */
export function displayableOf(entry: Feed.Item): Displayable {
	return {
		title: entry.title ?? entry.url ?? entry.guid,
		url: entry.url ?? null,
		summary: summaryOf(entry),
		author: entry.author?.name ?? null,
	};
}

/**
 * The line a post is stored with. Most RSS publishes a bare `<description>`, which a feed
 * reports as the body with no summary beside it, so the visible text of that body is what
 * gives those posts a line to read under their title.
 *
 * Both kinds are cut to the same length, so what is stored is what is shown either way.
 */
function summaryOf(entry: Feed.Item): string | null {
	if (entry.summary !== undefined) return shortened(entry.summary);
	if (entry.contentHtml === undefined) return null;

	let parsed = HTML.parse(entry.contentHtml);
	if (isFailure(parsed)) return null;

	let text = parsed.data.text;
	return text.length === 0 ? null : shortened(text);
}

/**
 * Text cut at the last whole word inside {@link MAX_SUMMARY_LENGTH}, closed so it reads as
 * shortened. Text already inside the length is returned as it came.
 */
function shortened(text: string): string {
	if (text.length <= MAX_SUMMARY_LENGTH) return text;

	/** The marker counts toward the cap, so what is stored never exceeds what was declared. */
	let cut = text.slice(0, MAX_SUMMARY_LENGTH - SUMMARY_MARKER.length);
	let lastSpace = cut.lastIndexOf(" ");

	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}${SUMMARY_MARKER}`;
}

/**
 * When a post was published, falling back to `now` so the column a timeline sorts on is
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
 * holds. Take it over a {@link displayableOf} projection on every path that writes an item,
 * so the first poll after a subscription reads every item it already stored as unchanged.
 *
 * @param displayable - The fields the row will hold, as {@link displayableOf} resolved them.
 */
export async function digest(displayable: Displayable): Promise<string> {
	let source = JSON.stringify([
		displayable.title,
		displayable.url,
		displayable.summary,
		displayable.author,
	]);

	let hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));

	return [...new Uint8Array(hashed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Rows one insert statement fits, derived from the schema so it follows a new column.
 * Call it from any path inserting items: a Durable Object statement binds at most
 * {@link MAX_BOUND_PARAMETERS} parameters, and a batch sized by hand stops being right the
 * day a column is added.
 */
export function insertChunkSize(): number {
	let columns = Object.keys(getTableColumns(items)).length;
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
