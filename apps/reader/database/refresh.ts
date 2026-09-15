/**
 * The refresh path: retrieving one feed, folding what came back into a reader's posts,
 * and choosing which feeds are due. It takes a `Database` rather than a Durable Object,
 * so the whole thing runs in a plain test against SQLite with no object around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type { SelectFeed } from "~/database/schema";

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
 * Retrieves one feed and writes what changed: new posts inserted, edited ones updated,
 * and the feed's own validators and failure state stamped either way.
 *
 * A poll where nothing changed performs no writes beyond the feed's own timestamps.
 *
 * @param db - The reader's database.
 * @param feed - The stored feed, whose `etag` and `last_modified` are sent as preconditions.
 * @param options - The clock this run reads, and an optional per-fetch deadline.
 */
export function refreshFeed(
	_db: Database,
	_feed: SelectFeed,
	_options: { now: number; timeoutMs?: number },
): Promise<RefreshOutcome> {
	throw new Error("refreshFeed is not implemented");
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
export function refreshDueFeeds(_db: Database, _options: RefreshRunOptions): Promise<RefreshRun> {
	throw new Error("refreshDueFeeds is not implemented");
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
export function pruneFeed(_db: Database, _feedId: string, _keep: number): Promise<number> {
	throw new Error("pruneFeed is not implemented");
}
