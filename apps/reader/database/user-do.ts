/**
 * The per-reader Durable Object and the typed surface the Worker reaches it through. One
 * object holds one person's settings, the feeds they follow and every post from them, so
 * the reading queue is a single indexed query over their own rows rather than a merge
 * across feeds, and the refresh schedule lives beside the data it refreshes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetQuery, OrderByTuple, OrderDirection } from "@sdxc/pagination";
import type { Predicate, SqlStatement } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Feed, FeedFetchError } from "@sdxc/feed";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { DurableObject, env } from "cloudflare:workers";
import {
	and,
	Database,
	getTableColumns,
	inList,
	isNull,
	notNull,
	rawSql,
	sql,
} from "remix/data-table";

import type {
	FeedStatus,
	InsertFeedItem,
	RefreshIntervalHours,
	SelectFeed,
	SelectFeedItem,
	SelectSettings,
} from "~/database/schema";

import { runMigrations } from "~/database/migrations";
import {
	chunked,
	digest,
	displayableOf,
	insertChunkSize,
	publishedAt,
	refreshDueFeeds,
	refreshFeed,
} from "~/database/refresh";
import { feedItems, feeds, REFRESH_INTERVALS, settings } from "~/database/schema";

/** The row `settings` holds, which the `CHECK` on its primary key keeps to exactly one. */
const SETTINGS_ID = 1;

/** The cadence a reader gets before they choose one, matching the column's own default. */
const DEFAULT_INTERVAL_HOURS: RefreshIntervalHours = 1;

/** The unit the stored interval is expressed in. */
const HOUR_MS = 60 * 60 * 1000;

/**
 * How soon the alarm comes back when a firing left feeds unattempted, so a reader with
 * more feeds than one run carries has no permanently stale tail.
 */
const CATCH_UP_MS = 60 * 1000;

/** Posts a timeline page holds when the caller names no limit. */
const DEFAULT_PAGE_LIMIT = 50;

/** The largest page a caller may ask for, so one call cannot read the whole timeline. */
const MAX_PAGE_LIMIT = 100;

/** Ids one `IN` list carries, held under the same 100-parameter ceiling. */
const IDS_PER_LOOKUP = 90;

/**
 * The ordering both timelines read in, spelled once and shared. A cursor records the
 * exact column names it was minted for, so a page minted under one spelling of this
 * ordering cannot be followed under another.
 */
const NEWEST_FIRST = [
	["published_at", "desc"],
	["id", "desc"],
] as const;

/**
 * Feeds one on-demand run talks to at once. It paces a run by the slowest origin rather
 * than by the sum of them, while keeping a reader's object, which has one thread, from
 * opening a socket per feed — the same bound the scheduled refresh works under.
 */
const ON_DEMAND_CONCURRENCY = 6;

/**
 * The character that takes a wildcard's meaning away inside a `LIKE` pattern, so a reader
 * searching for a title holding `%` or `_` is looking for those characters.
 */
const LIKE_ESCAPE = "\\";

/**
 * The comparisons a keyset seek is spelled with, which is the whole grammar
 * {@link Pagination.byKeyset} builds out of an ordering and hands to a query.
 */
const SEEK_OPERATORS: Record<string, string> = { eq: "=", gt: ">", lt: "<" };

/**
 * Unread posts per feed, as the feed list shows them. Grouping wants an index led by
 * `feed_id`, which the unread index is not, so this is spelled the way the schema's own
 * query-plan test asserts SQLite answers it: from the guid index, without sorting.
 */
const UNREAD_COUNTS_SQL =
	"SELECT feed_id, COUNT(*) AS unread FROM feed_items WHERE read_at IS NULL GROUP BY feed_id";

/**
 * The columns a timeline page reads. Both ordering columns stay in it, since the cursor
 * is minted by reading the sort values off the row that came back, and the body stays out
 * of it, since a list renders none of it.
 */
type TimelineRow = Pick<
	SelectFeedItem,
	"id" | "feed_id" | "title" | "url" | "summary" | "author" | "published_at" | "read_at"
>;

/**
 * The values that cross the RPC boundary, and the shapes a controller renders from.
 *
 * Three rules govern everything here. No `Result` crosses: it is structured-cloneable,
 * but the platform serializes an `Error` by name and message and drops the subclass, so
 * an `instanceof` check is always false on the far side. No `Date` crosses, for the same
 * reason every stored timestamp is an integer. And every failure is a discriminated
 * union the caller can switch on, narrowed on this side of the boundary.
 */
export namespace UserStore {
	/** A reader's preferences, as one row of `settings` reads. */
	export interface Settings {
		subject: string;
		refreshIntervalHours: RefreshIntervalHours;
		/** Epoch milliseconds of the last refresh run, or `null` before the first one. */
		lastRefreshedAt: number | null;
	}

	/** A followed feed, with the unread count the feed list shows beside it. */
	export interface FeedSummary {
		id: string;
		feedUrl: string;
		siteUrl: string | null;
		title: string;
		description: string | null;
		imageUrl: string | null;
		lastFetchedAt: number | null;
		lastStatus: FeedStatus | null;
		/** Consecutive failed refreshes, reset by any success including a 304. */
		failureCount: number;
		unreadCount: number;
	}

	/**
	 * The feed one timeline item came from, carried alongside the items rather than
	 * joined into them: a join would qualify the ordering columns, and a cursor records
	 * the exact column names it was minted for.
	 */
	export interface FeedRef {
		id: string;
		title: string;
		siteUrl: string | null;
	}

	/** One post, with the fields a list renders. The body is left in the database. */
	export interface Item {
		id: string;
		feedId: string;
		title: string;
		url: string | null;
		summary: string | null;
		author: string | null;
		publishedAt: number;
		readAt: number | null;
	}

	/** Where in a timeline to read from, and how much of it. */
	export interface TimelineOptions {
		/** An opaque keyset cursor carrying its own direction, or `null` for the first page. */
		cursor?: string | null;
		limit?: number;
	}

	/** Which posts of the reading queue a page holds, by whether the reader has read them. */
	export type ReadState =
		/** Every stored post, read and unread alike. */
		| "all"
		/** Posts the reader has yet to read. */
		| "unread"
		/** Posts the reader has read. */
		| "read";

	/** Where in the reading queue to read from, how much of it, and which posts. */
	export interface ReadingQueueOptions extends TimelineOptions {
		/**
		 * Which posts the page holds. Unread when the caller names none, so a view that
		 * offers no filter shows the queue a reader still has ahead of them.
		 */
		readState?: ReadState;
		/**
		 * Words a post's title or summary has to contain, which narrow the page alongside
		 * {@link readState}. Text holding nothing but space narrows nothing, so an empty
		 * search box reads as the whole queue.
		 */
		query?: string;
	}

	/**
	 * One page of a timeline. A cursor that no longer decodes is reported rather than
	 * silently answered with the first page, which would look to a reader like their
	 * place was lost without saying so.
	 */
	export type TimelineResult =
		| {
				ok: true;
				items: Item[];
				/** Every feed the returned items came from, for labelling them. */
				feeds: FeedRef[];
				cursors: { next: string | null; prev: string | null };
		  }
		| { ok: false; reason: "bad-cursor" };

	/** Why a URL somebody pasted did not become a subscription. */
	export type FollowFailure =
		/** Not a URL, or not one with an HTTP scheme. */
		| "invalid-url"
		/** Reached, but it advertises no RSS or Atom feed. */
		| "not-found"
		/** The origin refused, timed out, or answered with an error status. */
		| "unreachable"
		/** Already followed; `feedId` names the existing subscription. */
		| "already-following";

	export type FollowResult =
		| { ok: true; feed: FeedSummary; items: number }
		| { ok: false; reason: FollowFailure; feedId: string | null };

	/** What a sweep of every followed feed got through. */
	export interface CheckAllResult {
		/** Feeds the sweep reached. */
		checked: number;
		/** Feeds that answered with something the reader had not seen. */
		withNewPosts: number;
		/** Posts the sweep brought in across all of them. */
		inserted: number;
		/** Feeds whose origin refused, timed out, or sent something that is not a feed. */
		failed: number;
	}

	/** One subscription as an export carries it, which is all OPML has room for. */
	export interface FeedExport {
		title: string;
		feedUrl: string;
		siteUrl: string | null;
	}

	/** What an OPML document's subscriptions became. */
	export interface ImportResult {
		/** Feeds now followed that were not before. */
		added: number;
		/** Feeds in the document that were already followed. */
		alreadyFollowing: number;
		/** Feeds in the document that could not be retrieved, with the URL each one names. */
		failed: string[];
	}

	/** Setting a cadence the `CHECK` constraint would refuse is reported, never thrown. */
	export type IntervalResult =
		| { ok: true; settings: Settings }
		| { ok: false; reason: "invalid-interval" };

	/** Why a reader's own check of one feed never reached the origin's answer. */
	export type CheckFailure =
		/** Not a feed this reader follows, so there was nothing to check. */
		| "not-following"
		/** The origin refused, timed out, or sent back something that is not a feed. */
		| "check-failed";

	/**
	 * What checking one feed on the spot came back with. `inserted` counts the posts the
	 * reader had not seen, which is the answer they asked the question for; `updated`
	 * counts entries the publisher revised. A 304 reports both as zero, since the stored
	 * copy is current and the reader's answer is the same either way.
	 */
	export type CheckResult =
		| { ok: true; inserted: number; updated: number }
		| { ok: false; reason: CheckFailure };
}

/**
 * One reader's storage, addressed by their OIDC subject. Every method is RPC: the Worker
 * renders the HTML and this object answers with data, so it stays a store rather than a
 * nested application.
 */
export class UserDO extends DurableObject<Cloudflare.Env> {
	/** The reader's own SQLite, built once because the storage handle outlives every call. */
	#db: Database;

	/**
	 * Opens the reader's database and applies whatever schema has not run yet.
	 *
	 * @param ctx - The object's storage, alarms and concurrency gate.
	 * @param env - The Worker's bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		let adapter = createSQLStorageDatabaseAdapter(ctx.storage.sql);

		/**
		 * Auto-managed timestamps read this clock, which answers epoch milliseconds so a
		 * written timestamp binds, sorts and encodes into a cursor as the integer every
		 * column of this schema holds.
		 */
		this.#db = new Database(adapter, { now: () => Date.now() });

		/**
		 * A constructor cannot await, and the runtime holds every request behind this, so
		 * each method below reads a schema that already exists.
		 */
		void ctx.blockConcurrencyWhile(() => runMigrations(adapter));
	}

	/**
	 * Creates the reader's row if this is their first sign-in, and arms the refresh
	 * schedule. Idempotent, because it runs on every completed sign-in rather than once:
	 * there is no user table and no sign-up step, so a first login is what creates a
	 * reader.
	 */
	async ensureUser(subject: string): Promise<UserStore.Settings> {
		let row = await this.#settingsRow(subject);
		await this.#scheduleRefresh();

		return toSettings(row);
	}

	/** The reader's preferences, or `null` for an object no sign-in has reached yet. */
	async getSettings(): Promise<UserStore.Settings | null> {
		let row = await this.#db.find(settings, { id: SETTINGS_ID });
		return row === null ? null : toSettings(row);
	}

	/**
	 * Changes the refresh cadence and re-arms the alarm unconditionally, so somebody
	 * moving from daily to hourly waits an hour rather than out the rest of the day.
	 */
	async setRefreshInterval(hours: number): Promise<UserStore.IntervalResult> {
		if (!isRefreshInterval(hours)) return { ok: false, reason: "invalid-interval" };

		await this.#settingsRow();

		let row = await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{ refresh_interval_hours: hours },
		);
		await this.#armRefresh(hours * HOUR_MS);

		return { ok: true, settings: toSettings(row) };
	}

	/**
	 * How many feeds the reader follows, which is what tells an empty queue apart from an
	 * empty subscription list without reading a page of feeds to count it.
	 */
	async countFeeds(): Promise<number> {
		return await this.#db.count(feeds);
	}

	/** Checks every followed feed now, reporting what the sweep as a whole found. */
	async checkAllFeedsNow(): Promise<UserStore.CheckAllResult> {
		let result: UserStore.CheckAllResult = {
			checked: 0,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		};

		try {
			/**
			 * Every followed feed, `next_attempt_at` and all. That column is a backoff floor
			 * holding the alarm off an origin that has been failing, and a person asking to
			 * check now is the one case it was never meant to hold back.
			 *
			 * Stalest first, so a sweep cut short by the object's own deadline has still
			 * reached the feeds that had waited longest.
			 */
			let followed = await this.#db.findMany(feeds, {
				orderBy: [
					["last_fetched_at", "asc"],
					["id", "asc"],
				],
			});

			let now = Date.now();

			await inParallel(followed, async (feed) => {
				let outcome = await refreshFeed(this.#db, feed, { now });

				if (outcome.status !== "ok" && outcome.status !== "not_modified") {
					result.failed += 1;
					return;
				}

				result.checked += 1;
				if (outcome.status === "not_modified") return;

				result.inserted += outcome.inserted;
				if (outcome.inserted > 0) result.withNewPosts += 1;
			});

			// A reader's own sweep brings their posts up to date exactly as the scheduled one
			// does, so the settings page reports it the same way rather than reading stale.
			await this.#stampRefreshed(now);
		} catch (error) {
			/**
			 * Reported rather than rejected, for the reason the alarm resolves: a reader who
			 * asked gets the count of what did get through, and a caller rendering a page is
			 * not taken down because one origin was unreachable.
			 */
			console.error("reader sweep of every feed failed", error);
		}

		return result;
	}

	/**
	 * Marks every unread post of one feed read, and reports how many that was.
	 *
	 * One statement rather than a page read and a row written per post, so clearing a feed
	 * a reader let pile up costs the same as clearing one they are caught up on.
	 */
	async markFeedRead(feedId: string): Promise<number> {
		let written = await this.#db.updateMany(
			feedItems,
			{ read_at: Date.now() },
			{ where: and({ feed_id: feedId }, isNull("read_at")) },
		);

		return written.affectedRows ?? 0;
	}

	/** Marks every unread post read across every feed, and reports how many that was. */
	async markAllRead(): Promise<number> {
		let written = await this.#db.updateMany(
			feedItems,
			{ read_at: Date.now() },
			{ where: isNull("read_at") },
		);

		return written.affectedRows ?? 0;
	}

	/** Every subscription, in the shape an export writes them. */
	async exportFeeds(): Promise<UserStore.FeedExport[]> {
		// The whole list, unpaged: a document holding some of a reader's subscriptions is
		// one they would restore an incomplete library from.
		let rows = await this.#db.findMany(feeds, {
			orderBy: [
				["created_at", "desc"],
				["id", "desc"],
			],
		});

		return rows.map((row) => ({
			title: row.title,
			feedUrl: row.feed_url,
			siteUrl: row.site_url,
		}));
	}

	/**
	 * Follows each URL that is not already followed, and reports what became of the rest.
	 * One unreachable feed in a document of fifty leaves the other forty-nine followed.
	 */
	async importFeeds(feedUrls: string[]): Promise<UserStore.ImportResult> {
		let result: UserStore.ImportResult = { added: 0, alreadyFollowing: 0, failed: [] };

		// A document listing the same URL twice names one subscription, and the second pass
		// would otherwise race the first into the unique index on `feed_url`.
		let requested = [...new Set(feedUrls)];

		await inParallel(requested, async (feedUrl) => {
			try {
				let followed = await this.followFeed(feedUrl);

				if (followed.ok) result.added += 1;
				else if (followed.reason === "already-following") result.alreadyFollowing += 1;
				else result.failed.push(feedUrl);
			} catch {
				// Whatever went wrong belongs to this URL alone, so the rest of the document
				// still lands and the reader is told which one did not.
				result.failed.push(feedUrl);
			}
		});

		return result;
	}

	/**
	 * Every followed feed in the order their names read, each with its unread count.
	 *
	 * Unpaged, because the one place a reader meets this list is the rail, which draws all
	 * of it and scrolls within its own column. A page of it would be a rail that stops
	 * partway down somebody's subscriptions with no way on.
	 */
	async listFeeds(): Promise<UserStore.FeedSummary[]> {
		let [rows, unread] = await Promise.all([
			/**
			 * The names, in order, so an eye running down the rail finds a feed by its name.
			 * Bytes are what SQLite compares, which the index carries; the reader's own
			 * language orders what comes back, where the request's locale is.
			 */
			this.#db.findMany(feeds, {
				orderBy: [
					["title", "asc"],
					["id", "asc"],
				],
			}),
			this.#unreadCounts(),
		]);

		return rows.map((row) => toFeedSummary(row, unread.get(row.id) ?? 0));
	}

	/** One followed feed, or `null` when this reader does not follow it. */
	async getFeed(feedId: string): Promise<UserStore.FeedSummary | null> {
		let row = await this.#db.find(feeds, { id: feedId });
		if (row === null) return null;

		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: feedId }, isNull("read_at")),
		});

		return toFeedSummary(row, unread);
	}

	/**
	 * Subscribes to whatever feed `input` leads to, accepting either a feed URL or a page
	 * that advertises one, and stores the posts it carries so the queue is never empty
	 * the moment a feed is followed.
	 */
	async followFeed(input: string): Promise<UserStore.FollowResult> {
		let target = normalizeFeedUrl(input);
		if (target === null) return { ok: false, reason: "invalid-url", feedId: null };

		let pasted = await this.#feedByUrl(target);
		if (pasted !== null) return { ok: false, reason: "already-following", feedId: pasted };

		let discovered = await Feed.discover(target);
		if (isFailure(discovered)) return { ok: false, reason: "unreachable", feedId: null };

		let [advertised] = discovered.data;
		if (advertised === undefined) return { ok: false, reason: "not-found", feedId: null };

		let retrieved = await Feed.fetch(advertised.url);
		if (isFailure(retrieved)) {
			/**
			 * A retrieval that failed to reach the origin is told apart from one that
			 * reached it and came back with something that is not a feed, since the first
			 * is worth retrying and the second is worth correcting.
			 */
			let reached = !(retrieved.error instanceof FeedFetchError);
			return { ok: false, reason: reached ? "not-found" : "unreachable", feedId: null };
		}

		/** A subscription is created from the document itself, and a 304 carries none. */
		if (retrieved.data.notModified) return { ok: false, reason: "unreachable", feedId: null };

		let { feed: document, url: feedUrl } = retrieved.data;

		let resolved = await this.#feedByUrl(feedUrl);
		if (resolved !== null) return { ok: false, reason: "already-following", feedId: resolved };

		let now = Date.now();
		let feedId = TypeID.fromUUID("feed", generateUUID()).toString();
		let rows = await Promise.all(document.items.map((item) => itemRow(feedId, item, now)));

		/**
		 * Written straight through rather than inside a transaction scope. A Durable Object
		 * refuses `BEGIN` and `SAVEPOINT` outright, and has no need of them: every write a
		 * turn makes is coalesced into one atomic commit and discarded together if the turn
		 * throws. Nothing below awaits anything outside storage, so the feed and its posts
		 * land together or not at all.
		 */
		let created = await this.#db.create(
			feeds,
			{
				id: feedId,
				feed_url: feedUrl,
				site_url: document.siteUrl ?? null,
				title: document.title,
				description: document.description ?? null,
				language: document.language ?? null,
				image_url: document.imageUrl ?? null,
				etag: retrieved.data.etag ?? null,
				last_modified: retrieved.data.lastModified ?? null,
				last_fetched_at: now,
				last_status: "ok",
				last_http_status: retrieved.data.status,
				last_error: null,
				failure_count: 0,
				next_attempt_at: null,
			},
			{ returnRow: true },
		);

		for (let batch of chunked(rows, insertChunkSize())) {
			await this.#db.createMany(feedItems, batch);
		}

		// Following a feed retrieves it, so the reader has posts as current as a sweep
		// would have left them and the settings page says so rather than reporting none.
		await this.#stampRefreshed(now);

		// A reader can reach this with a session older than the sign-in step that arms the
		// schedule, and a subscription nothing ever sweeps stays as stale as the day it was
		// followed. Arming here holds whatever alarm is already set.
		await this.#scheduleRefresh();

		return { ok: true, feed: toFeedSummary(created, rows.length), items: rows.length };
	}

	/**
	 * Retrieves one feed on the spot and reports what came back, for a reader who knows a
	 * site has just published and would rather not wait out their cadence.
	 *
	 * It resolves however the retrieval went, so a feed whose origin is down answers the
	 * reader instead of failing the request they made.
	 *
	 * @param feedId - The subscription to check.
	 * @example let checked = await userStore(subject).checkFeedNow(feedId);
	 */
	async checkFeedNow(feedId: string): Promise<UserStore.CheckResult> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return { ok: false, reason: "not-following" };

		/**
		 * `next_attempt_at` is read past here. That column is a backoff floor holding the
		 * alarm off an origin that has been failing, and a person deliberately asking to
		 * check now is the one case it was never meant to hold back: a feed that has been
		 * failing is exactly the one they come here to ask about.
		 */
		let now = Date.now();
		let outcome = await refreshFeed(this.#db, feed, { now });

		if (outcome.status !== "ok" && outcome.status !== "not_modified") {
			return { ok: false, reason: "check-failed" };
		}

		// The origin answered, so this reader's copy is current as of now — a 304 included,
		// which says the stored copy was already the current one.
		await this.#stampRefreshed(now);

		if (outcome.status === "not_modified") return { ok: true, inserted: 0, updated: 0 };

		return { ok: true, inserted: outcome.inserted, updated: outcome.updated };
	}

	/**
	 * Drops a subscription and every post behind it. `false` when it was not followed.
	 *
	 * The posts go first, so a turn that fails between the two deletes leaves the feed
	 * still followed rather than its posts orphaned under a feed that is gone.
	 */
	async unfollowFeed(feedId: string): Promise<boolean> {
		await this.#db.deleteMany(feedItems, { where: { feed_id: feedId } });
		return await this.#db.delete(feeds, { id: feedId });
	}

	/**
	 * The posts across every followed feed, newest first, narrowed to the read state the
	 * caller chooses and to the words they searched for. It answers the unread ones when
	 * they choose no state, and every post when they search for nothing.
	 *
	 * Each state is served by an index of its own, so paging the read posts of a reader
	 * who has read years of them costs what paging the unread ones does. A search rides on
	 * those same indexes for its ordering and matches the text off the row, which is what
	 * lets the two narrowings compose into one read.
	 *
	 * @param options - Which posts to page, where to page from, and how much of it.
	 * @example let page = await userStore(viewer.id).readingQueue({ readState: "all" });
	 * @example let found = await userStore(viewer.id).readingQueue({ query: "remix" });
	 */
	readingQueue(options: UserStore.ReadingQueueOptions = {}): Promise<UserStore.TimelineResult> {
		let readState = options.readState ?? "unread";
		let pattern = likePattern(options.query ?? "");

		if (pattern !== null) {
			return this.#page(
				new SearchQuery(this.#db, { pattern, readState, seek: [], orderBy: [], limit: null }),
				options,
			);
		}

		let timeline = this.#timeline();
		let narrowing = readStateWhere(readState);

		return this.#page(narrowing === null ? timeline : timeline.where(narrowing), options);
	}

	/** One feed's posts, read and unread alike, newest first. */
	feedTimeline(
		feedId: string,
		options: UserStore.TimelineOptions = {},
	): Promise<UserStore.TimelineResult> {
		return this.#page(this.#timeline().where({ feed_id: feedId }), options);
	}

	/** Marks one post read or unread. `false` when no such post is stored. */
	async markRead(itemId: string, read = true): Promise<boolean> {
		let written = await this.#db.updateMany(
			feedItems,
			{ read_at: read ? Date.now() : null },
			{ where: { id: itemId } },
		);

		return (written.affectedRows ?? 0) > 0;
	}

	/**
	 * Refreshes whatever feeds are due and re-arms the schedule.
	 *
	 * It never rejects. A rejected alarm is retried by the platform, which would re-fetch
	 * every feed because one origin was down, repeatedly, against origins that already
	 * answered.
	 */
	override async alarm(): Promise<void> {
		let remaining = 0;

		/** Read before the refresh, so the re-arm below needs nothing but the clock. */
		let interval = DEFAULT_INTERVAL_HOURS * HOUR_MS;

		try {
			try {
				interval = await this.#intervalMs();

				let run = await refreshDueFeeds(this.#db, { now: Date.now() });
				remaining = run.remaining;

				await this.#stampRefreshed(Date.now());
			} finally {
				/**
				 * A run that left feeds behind comes back in a minute rather than an
				 * interval, and the re-arm sits here so the heartbeat outlives whatever the
				 * refresh above did.
				 */
				await this.#armRefresh(remaining > 0 ? CATCH_UP_MS : interval);
			}
		} catch (error) {
			console.error("reader refresh alarm failed", error);
		}
	}

	/**
	 * The reader's settings row, written on first use when nothing has written it yet.
	 *
	 * Every path that touches settings comes through here, so the row's existence stops
	 * depending on which entry point reached the object first. A session outlives a
	 * deploy and there is no sign-up step, so a reader can hold an object that following
	 * a feed created and no sign-in ever provisioned: reading their cadence answered
	 * nothing, writing it failed on the missing row, and stamping a refresh matched none.
	 *
	 * @param subject - The reader this object holds, for a caller that already knows it.
	 */
	async #settingsRow(subject: string = this.#subject()): Promise<SelectSettings> {
		let stored = await this.#db.find(settings, { id: SETTINGS_ID });
		if (stored !== null) return stored;

		return await this.#db.create(
			settings,
			{
				id: SETTINGS_ID,
				subject,
				refresh_interval_hours: DEFAULT_INTERVAL_HOURS,
				last_refreshed_at: null,
			},
			{ returnRow: true },
		);
	}

	/**
	 * The reader this object holds, which is the name it was addressed by.
	 *
	 * Only an id built from a raw hex string or minted unique carries no name, and this
	 * object's rows are keyed on the reader's subject, so such an id leaves nothing to
	 * write one as. That is a mistake in how the object was reached rather than news
	 * about the reader, so it is raised where it was made.
	 */
	#subject(): string {
		let name = this.ctx.id.name;

		if (name === undefined) {
			throw new Error("UserDO must be addressed by name: its rows are keyed on that subject");
		}

		return name;
	}

	/**
	 * Records that this reader's posts were just brought up to date, which is what the
	 * settings page reports back to them.
	 */
	async #stampRefreshed(now: number): Promise<void> {
		await this.#settingsRow();
		await this.#db.update(settings, { id: SETTINGS_ID }, { last_refreshed_at: now });
	}

	/**
	 * Arms the schedule only when nothing is already scheduled.
	 *
	 * The guard is what makes the alarm survive an active reader: an object woken by every
	 * page view would otherwise push the same interval further into the future on every
	 * wake, and refresh once they stopped reading.
	 */
	async #scheduleRefresh(): Promise<void> {
		let scheduled = await this.ctx.storage.getAlarm();
		if (scheduled !== null) return;

		await this.#armRefresh(await this.#intervalMs());
	}

	/** Schedules the next refresh `delay` milliseconds out, replacing any alarm set. */
	async #armRefresh(delay: number): Promise<void> {
		await this.ctx.storage.setAlarm(Date.now() + delay);
	}

	/** How long the reader's chosen cadence runs, in milliseconds. */
	async #intervalMs(): Promise<number> {
		let row = await this.#db.find(settings, { id: SETTINGS_ID });
		let hours = row === null ? DEFAULT_INTERVAL_HOURS : readInterval(row);
		return hours * HOUR_MS;
	}

	/** The id of the subscription already holding `feedUrl`, or `null` for a new one. */
	async #feedByUrl(feedUrl: string): Promise<string | null> {
		let row = await this.#db.findOne(feeds, { where: { feed_url: feedUrl } });
		return row === null ? null : row.id;
	}

	/** The columns a timeline page reads, ordered and seeked by whoever pages it. */
	#timeline() {
		return this.#db
			.query(feedItems)
			.select("id", "feed_id", "title", "url", "summary", "author", "published_at", "read_at");
	}

	/**
	 * Pages a composed timeline and resolves the feeds its posts came from.
	 *
	 * The ordering is left off the query handed in: `Pagination.byKeyset()` owns it,
	 * because it needs the sort keys both to seek and to mint the cursor.
	 */
	async #page<whereArg, columnArg>(
		query: KeysetQuery<TimelineRow, whereArg, columnArg>,
		options: UserStore.TimelineOptions,
	): Promise<UserStore.TimelineResult> {
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: options.cursor,
			limit: pageLimit(options.limit),
		});

		if (isFailure(page)) {
			/**
			 * A cursor the reader's browser carried from an older ordering is news about
			 * the request; anything else here is a broken query, which belongs to whoever
			 * wrote it rather than to the person reading.
			 */
			if (page.error instanceof InvalidCursorError) return { ok: false, reason: "bad-cursor" };
			throw page.error;
		}

		let items = page.data.items.map(toItem);

		return { ok: true, items, feeds: await this.#feedRefs(items), cursors: page.data.cursors };
	}

	/** The feeds a page's posts came from, for labelling them. */
	async #feedRefs(items: readonly UserStore.Item[]): Promise<UserStore.FeedRef[]> {
		let ids = [...new Set(items.map((item) => item.feedId))];

		let refs: UserStore.FeedRef[] = [];
		for (let batch of chunked(ids, IDS_PER_LOOKUP)) {
			let rows = await this.#db.findMany(feeds, { where: inList("id", batch) });
			refs.push(...rows.map((row) => ({ id: row.id, title: row.title, siteUrl: row.site_url })));
		}

		return refs;
	}

	/** Unread posts per feed, keyed by feed id; a feed with none is absent. */
	async #unreadCounts(): Promise<Map<string, number>> {
		let { rows = [] } = await this.#db.exec(UNREAD_COUNTS_SQL);

		let counts = new Map<string, number>();
		for (let row of rows) {
			let { feed_id: feedId, unread } = row;
			if (typeof feedId === "string" && typeof unread === "number") counts.set(feedId, unread);
		}

		return counts;
	}
}

/** Everything one composed search statement is built from. */
interface SearchState {
	/** The `LIKE` pattern, already escaped, that both searched columns are matched against. */
	pattern: string;
	/** Which posts the match is narrowed to, spelled beside it in the same statement. */
	readState: UserStore.ReadState;
	/** Seek predicates the pager composed, which narrow the match to one page. */
	seek: readonly Predicate[];
	/** The ordering the pager owns, which is also what it mints cursors from. */
	orderBy: readonly OrderByTuple[];
	/** Posts the statement reads, or `null` before the pager has set one. */
	limit: number | null;
}

/**
 * A post search, as a query {@link Pagination.byKeyset} can seek, order and limit.
 *
 * The match is a `LIKE` carrying an `ESCAPE` clause, which is what lets somebody search
 * for a post whose title holds `%` or `_` instead of having those characters read as
 * wildcards. The query builder's own operators emit no such clause, so the statement is
 * spelled out here and the pager's seek predicate is folded into it: one page, one read.
 *
 * It costs a scan of the reader's posts. A match that may begin anywhere in the text is
 * one no index answers, so the timeline index serves the ordering and nothing else.
 */
class SearchQuery implements KeysetQuery<TimelineRow, Predicate, string> {
	#db: Database;
	#state: SearchState;

	/**
	 * @param db - The reader's database.
	 * @param state - The pattern to match, and whatever the pager has composed so far.
	 */
	constructor(db: Database, state: SearchState) {
		this.#db = db;
		this.#state = state;
	}

	where(input: Predicate): SearchQuery {
		return new SearchQuery(this.#db, { ...this.#state, seek: [...this.#state.seek, input] });
	}

	orderBy(column: string, direction: OrderDirection): SearchQuery {
		return new SearchQuery(this.#db, {
			...this.#state,
			orderBy: [...this.#state.orderBy, [column, direction]],
		});
	}

	limit(value: number): SearchQuery {
		return new SearchQuery(this.#db, { ...this.#state, limit: value });
	}

	async all(): Promise<TimelineRow[]> {
		let { rows = [] } = await this.#db.exec(searchStatement(this.#state));
		return rows.map(toTimelineRow);
	}
}

/** The statement one page of a search runs as. */
function searchStatement(state: SearchState): SqlStatement {
	let pattern = state.pattern;

	let match = sql`("title" like ${pattern} escape ${LIKE_ESCAPE} or "summary" like ${pattern} escape ${LIKE_ESCAPE})`;
	let narrowed = readStateSql(state.readState);
	let matched = narrowed === null ? match : sql`${match} and ${narrowed}`;
	let where = state.seek.reduce((left, right) => sql`${left} and ${seekSql(right)}`, matched);

	// The pager appends the ordering it owns before reading, and the fallback keeps a
	// statement built without one reading the way a search is defined to.
	let ordering = state.orderBy.length === 0 ? NEWEST_FIRST : state.orderBy;
	let orderBy = ordering
		.map(([column, direction]) => `${quoteColumn(column)} ${direction === "asc" ? "asc" : "desc"}`)
		.join(", ");

	return sql`select "id", "feed_id", "title", "url", "summary", "author", "published_at", "read_at"
		from feed_items
		where ${where}
		order by ${rawSql(orderBy)}
		limit ${state.limit ?? DEFAULT_PAGE_LIMIT}`;
}

/**
 * One seek predicate as SQL. `Pagination.byKeyset` builds these out of the ordering it was
 * given, so the comparisons and the `and`/`or` nesting below are the whole of what arrives.
 */
function seekSql(predicate: Predicate): SqlStatement {
	if (predicate.type === "logical") {
		let parts = predicate.predicates.map(seekSql);
		let joiner = predicate.operator === "and" ? " and " : " or ";

		return rawSql(
			`(${parts.map((part) => part.text).join(joiner)})`,
			parts.flatMap((part) => part.values),
		);
	}

	if (predicate.type === "comparison" && predicate.valueType === "value") {
		let operator = SEEK_OPERATORS[predicate.operator];

		if (operator !== undefined) {
			return rawSql(`${quoteColumn(predicate.column)} ${operator} ?`, [predicate.value]);
		}
	}

	throw new Error("a search page seeks on comparisons of its ordering columns alone");
}

/**
 * One column of `feed_items` as a SQL identifier. It accepts only a name the table
 * declares, so a statement written by hand cannot reach a column the schema has dropped.
 */
function quoteColumn(column: string): string {
	if (!(column in getTableColumns(feedItems))) {
		throw new Error(`feed_items declares no column named "${column}"`);
	}

	return `"${column}"`;
}

/** One row of the search statement, read back into the shape a timeline page is built from. */
function toTimelineRow(row: Record<string, unknown>): TimelineRow {
	let { feed_id: feedId, published_at: publishedAt, read_at: readAt } = row;

	return {
		id: typeof row.id === "string" ? row.id : "",
		feed_id: typeof feedId === "string" ? feedId : "",
		title: typeof row.title === "string" ? row.title : "",
		url: typeof row.url === "string" ? row.url : null,
		summary: typeof row.summary === "string" ? row.summary : null,
		author: typeof row.author === "string" ? row.author : null,
		published_at: typeof publishedAt === "number" ? publishedAt : 0,
		read_at: typeof readAt === "number" ? readAt : null,
	};
}

/**
 * What somebody typed, as a `LIKE` pattern that looks for exactly that text. The escape
 * character is escaped first, so escaping a wildcard afterwards cannot be undone by it.
 *
 * @param query - The text somebody typed into the search box.
 * @returns The pattern to match, or `null` when the box held nothing but space.
 */
function likePattern(query: string): string | null {
	let trimmed = query.trim();
	if (trimmed.length === 0) return null;

	let escaped = trimmed
		.replaceAll(LIKE_ESCAPE, LIKE_ESCAPE + LIKE_ESCAPE)
		.replaceAll("%", `${LIKE_ESCAPE}%`)
		.replaceAll("_", `${LIKE_ESCAPE}_`);

	return `%${escaped}%`;
}

/**
 * Runs `work` over every value, {@link ON_DEMAND_CONCURRENCY} of them at a time.
 *
 * Whatever one value's turn did stops there, so the worker that took it carries on to the
 * next rather than retiring with the queue half read.
 *
 * @param values - What to work through.
 * @param work - What one value's turn does.
 */
async function inParallel<value>(
	values: readonly value[],
	work: (value: value) => Promise<void>,
): Promise<void> {
	let next = 0;

	let workers = Array.from({ length: Math.min(ON_DEMAND_CONCURRENCY, values.length) }, async () => {
		while (next < values.length) {
			let value = values[next++];
			if (value === undefined) return;
			await work(value).catch(() => undefined);
		}
	});

	await Promise.allSettled(workers);
}

/**
 * The storage for one reader, addressed by the OIDC subject rather than the email, which
 * can be reassigned to another person — and renaming a Durable Object strands its storage.
 *
 * @param subject - The signed-in reader's OIDC `sub` claim.
 * @example let feeds = await userStore(viewer.id).listFeeds();
 */
export function userStore(subject: string): DurableObjectStub<UserDO> {
	return env.USER.getByName(subject);
}

/** Whether a number is one of the cadences the settings form and the `CHECK` both offer. */
function isRefreshInterval(hours: number): hours is RefreshIntervalHours {
	return REFRESH_INTERVALS.some((offered) => offered === hours);
}

/** The stored cadence, falling back to the column's default for a row written around it. */
function readInterval(row: SelectSettings): RefreshIntervalHours {
	return isRefreshInterval(row.refresh_interval_hours)
		? row.refresh_interval_hours
		: DEFAULT_INTERVAL_HOURS;
}

/** A settings row as the RPC boundary reports it. */
function toSettings(row: SelectSettings): UserStore.Settings {
	return {
		subject: row.subject,
		refreshIntervalHours: readInterval(row),
		lastRefreshedAt: row.last_refreshed_at,
	};
}

/** A feed row and its unread count as the feed list renders them. */
function toFeedSummary(row: SelectFeed, unreadCount: number): UserStore.FeedSummary {
	return {
		id: row.id,
		feedUrl: row.feed_url,
		siteUrl: row.site_url,
		title: row.title,
		description: row.description,
		imageUrl: row.image_url,
		lastFetchedAt: row.last_fetched_at,
		lastStatus: row.last_status,
		failureCount: row.failure_count,
		unreadCount,
	};
}

/** One timeline row as the RPC boundary reports it. */
function toItem(row: TimelineRow): UserStore.Item {
	return {
		id: row.id,
		feedId: row.feed_id,
		title: row.title,
		url: row.url,
		summary: row.summary,
		author: row.author,
		publishedAt: row.published_at,
		readAt: row.read_at,
	};
}

/**
 * Reads what somebody pasted as an HTTP URL, so a bare `example.com` reaches discovery
 * the way typing it into a browser would. The fragment is dropped: it addresses a place
 * inside a document rather than a document, so two pastes differing only by one name the
 * same subscription.
 */
function normalizeFeedUrl(input: string): string | null {
	let trimmed = input.trim();
	if (trimmed.length === 0) return null;

	let candidate = /^[a-z][\d+.a-z-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
	if (!URL.canParse(candidate)) return null;

	let url = new URL(candidate);
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	url.hash = "";
	return url.toString();
}

/**
 * One parsed entry as the row that stores it. Ids are TypeIDs so a post's identity says
 * what it identifies wherever it is read, and the projection, the digest and the date
 * fallback are the refresh path's own, so the first poll after this reads nothing as edited.
 */
async function itemRow(feedId: string, entry: Feed.Item, now: number): Promise<InsertFeedItem> {
	let displayable = displayableOf(entry);

	return {
		id: TypeID.fromUUID("item", generateUUID()).toString(),
		feed_id: feedId,
		guid: entry.guid,
		...displayable,
		published_at: publishedAt(entry, now),
		content_hash: await digest(displayable),
		read_at: null,
	};
}

/**
 * What one read state narrows the timeline by, or `null` for the state that narrows
 * nothing. Both predicates are spelled the way the partial index that serves them is, so
 * SQLite reads each page from that index rather than sorting the reader's posts.
 */
function readStateWhere(readState: UserStore.ReadState): Predicate<"read_at"> | null {
	if (readState === "unread") return isNull("read_at");
	if (readState === "read") return notNull("read_at");

	return null;
}

/**
 * What one read state narrows a hand-written statement by, or `null` for the state that
 * narrows nothing. It is the clause {@link readStateWhere} builds as a predicate, spelled
 * out in SQL because the search statement composes its own text rather than going through
 * the query builder, and both spellings match the partial index that serves them.
 *
 * @param readState - Which posts the caller asked for.
 */
function readStateSql(readState: UserStore.ReadState): SqlStatement | null {
	if (readState === "unread") return rawSql(`"read_at" is null`);
	if (readState === "read") return rawSql(`"read_at" is not null`);

	return null;
}

/** The page size a caller asked for, held between one post and {@link MAX_PAGE_LIMIT}. */
function pageLimit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_LIMIT;
	return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}
