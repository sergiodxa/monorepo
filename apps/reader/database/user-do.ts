/**
 * The per-reader Durable Object and the typed surface the Worker reaches it through. One
 * object holds one person's settings, the feeds they follow and their own copy of every
 * post from them, so the reading queue is a single indexed query over their own rows
 * rather than a merge across feeds.
 *
 * It fetches nothing. A feed is retrieved once, by the object named after that feed, and
 * what this holds is a projection of it: the items this reader has ruled on, in the order
 * their timeline reads. The two are joined by a cursor — the greatest revision this reader
 * has accounted for — and a reader finds out there is more by comparing that against the
 * head the feed publishes, rather than by being told.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { KeysetQuery, OrderByTuple, OrderDirection } from "@sdxc/pagination";
import type { Predicate, SqlStatement } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Feed } from "@sdxc/feed";
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
	lt,
	notNull,
	rawSql,
	sql,
} from "remix/data-table";

import type { FeedStore } from "~/database/feed-do";
import type { SelectFeed, SelectFeedItem, SelectSettings, Velocity } from "~/database/schema";

import { logger } from "~/bootstrap/logger";
import { feedStore } from "~/database/feed-do";
import { KEYS_PER_BULK_READ, readHeads } from "~/database/feed-head";
import { runMigrations } from "~/database/migrations";
import { chunked, insertChunkSize } from "~/database/refresh";
import { registerFeed } from "~/database/registry";
import {
	DEFAULT_VELOCITY,
	feedItems,
	feeds,
	READER_BUDGET,
	SAVED_LIMIT,
	settings,
	VELOCITIES,
	VELOCITY_WINDOW_MS,
} from "~/database/schema";

/** The row `settings` holds, which the `CHECK` on its primary key keeps to exactly one. */
const SETTINGS_ID = 1;

/**
 * Feeds one request synchronizes behind the page it has already answered. A reader back
 * after a month with two hundred stale feeds gets their timeline first, the most useful of
 * those feeds behind it, and the rest over the following minutes.
 */
const SYNC_FEEDS_PER_REQUEST = 8;

/** Feeds synchronized at once, so one slow object does not pace the rest of the batch. */
const SYNC_CONCURRENCY = 4;

/** Pages of one feed a single run walks, so no feed can hold the object indefinitely. */
const SYNC_PAGES_PER_FEED = 5;

/**
 * How long the catch-up alarm waits before carrying on with whatever a run left behind.
 * A minute rather than an interval, because leftover work is work a reader is waiting for.
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
	| "id"
	| "feed_id"
	| "title"
	| "url"
	| "summary"
	| "author"
	| "published_at"
	| "read_at"
	| "saved_at"
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
		/** Epoch milliseconds of the last synchronization, or `null` before the first one. */
		lastRefreshedAt: number | null;
	}

	/** A followed feed, with the unread count the feed list shows beside it. */
	export interface FeedSummary {
		/** This app's own handle for the subscription, which its URLs are built from. */
		id: string;
		/** The feed itself, which names the object holding it and the head it publishes. */
		feedId: string;
		feedUrl: string;
		siteUrl: string | null;
		title: string;
		description: string | null;
		imageUrl: string | null;
		/** How long a post from this feed stays in this reader's timeline. */
		velocity: Velocity;
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
		/** When the reader asked to keep it, or `null` for a post under the ordinary rules. */
		savedAt: number | null;
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

	/**
	 * What the reader has waiting that they have not got yet, worked out by comparing each
	 * subscription's cursor against the head its feed published. It is a count and the
	 * feeds it came from, never a promise of fresher posts: the page has already been read
	 * out of local storage by the time this is known.
	 */
	export interface Freshness {
		/** The subscriptions with something above their cursor, as this app's own feed ids. */
		stale: string[];
		count: number;
	}

	/** A page of the queue, and what is known to be missing from it. */
	export interface OpenResult {
		timeline: TimelineResult;
		freshness: Freshness;
	}

	/** What one synchronization run got through, for the log and for the alarm. */
	export interface SyncRun {
		/** Feeds this run brought up to date. */
		synchronized: number;
		/** Posts it materialized across all of them. */
		items: number;
		/** Feeds it left behind, which the catch-up alarm carries on with. */
		remaining: number;
		/** Feeds holding back because the object is over budget with nothing to reclaim. */
		paused: number;
	}

	/** Setting a velocity the `CHECK` constraint would refuse is reported, never thrown. */
	export type VelocityResult =
		| { ok: true; feed: FeedSummary }
		| { ok: false; reason: "not-following" | "invalid-velocity" };

	/**
	 * Why a post could not be kept. A full shelf refuses the next save rather than
	 * evicting the oldest, because evicting deletes the one thing a reader explicitly
	 * asked to keep.
	 */
	export type SaveFailure = "not-found" | "full";

	export type SaveResult = { ok: true; saved: boolean } | { ok: false; reason: SaveFailure };
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
		return toSettings(await this.#settingsRow(subject));
	}

	/** The reader's preferences, or `null` for an object no sign-in has reached yet. */
	async getSettings(): Promise<UserStore.Settings | null> {
		let row = await this.#db.find(settings, { id: SETTINGS_ID });
		return row === null ? null : toSettings(row);
	}

	/**
	 * How many feeds the reader follows, which is what tells an empty queue apart from an
	 * empty subscription list without reading a page of feeds to count it.
	 */
	async countFeeds(): Promise<number> {
		return await this.#db.count(feeds, { where: isNull("unfollowed_at") });
	}

	/**
	 * Checks every followed feed now, reporting what the sweep as a whole found.
	 *
	 * Each feed is asked of the object that owns it, so a reader sweeping their
	 * subscriptions fetches nothing themselves and a feed two of them share is retrieved
	 * once. What comes back into this object afterwards is the reader's own copy.
	 */
	async checkAllFeedsNow(): Promise<UserStore.CheckAllResult> {
		let result: UserStore.CheckAllResult = {
			checked: 0,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		};

		try {
			let followed = await this.#subscriptions();
			let now = Date.now();

			await inParallel(followed, async (feed) => {
				let refreshed = await feedStore(feed.feed_id).refresh("manual");

				if (!refreshed.ok) {
					result.failed += 1;
					return;
				}

				result.checked += 1;

				let synchronized = await this.#syncFeed(feed);
				result.inserted += synchronized.items;
				if (synchronized.items > 0) result.withNewPosts += 1;
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
		let unread = and({ feed_id: feedId }, isNull("read_at"));

		/**
		 * Counted before the write rather than read back from it. What a write reports is
		 * rows of storage, and a post lives in the table and in whichever partial indexes it
		 * qualifies for, so marking one read writes several rows. The reader is told about
		 * posts.
		 */
		let posts = await this.#db.count(feedItems, { where: unread });
		if (posts === 0) return 0;

		await this.#db.updateMany(feedItems, { read_at: Date.now() }, { where: unread });

		return posts;
	}

	/** Marks every unread post read across every feed, and reports how many that was. */
	async markAllRead(): Promise<number> {
		/** Counted rather than read back from the write, for the reason one feed's sweep is. */
		let posts = await this.#db.count(feedItems, { where: isNull("read_at") });
		if (posts === 0) return 0;

		await this.#db.updateMany(feedItems, { read_at: Date.now() }, { where: isNull("read_at") });

		return posts;
	}

	/** Every subscription, in the shape an export writes them. */
	async exportFeeds(): Promise<UserStore.FeedExport[]> {
		// The whole list, unpaged: a document holding some of a reader's subscriptions is
		// one they would restore an incomplete library from.
		let rows = await this.#db.findMany(feeds, {
			where: isNull("unfollowed_at"),
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
				where: isNull("unfollowed_at"),
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
		if (row === null || row.unfollowed_at !== null) return null;

		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: feedId }, isNull("read_at")),
		});

		return toFeedSummary(row, unread);
	}

	/**
	 * Subscribes to whatever feed `input` leads to, accepting either a feed URL or a page
	 * that advertises one, and stores the page of posts the feed hands back so the queue is
	 * never empty the moment a feed is followed.
	 *
	 * The feed itself is fetched by the object named after it, which is what makes the
	 * second follower of a feed cost no request at all: they reach an object that has
	 * already done the work and is already being polled for everybody.
	 */
	async followFeed(input: string): Promise<UserStore.FollowResult> {
		let target = normalizeFeedUrl(input);
		if (target === null) return { ok: false, reason: "invalid-url", feedId: null };

		let pasted = await this.#subscriptionByUrl(target);
		if (pasted !== null) return await this.#follow(pasted);

		/**
		 * The one external request made outside a feed's own object, and the step that
		 * decides what two people are following: it reports the address the response finally
		 * came from, so a person who pastes a site and a person who pastes its feed converge
		 * on one name.
		 */
		let discovered = await Feed.discover(target);
		if (isFailure(discovered)) return { ok: false, reason: "unreachable", feedId: null };

		let [advertised] = discovered.data;
		if (advertised === undefined) return { ok: false, reason: "not-found", feedId: null };

		let feedUrl = advertised.url;

		let resolved = await this.#subscriptionByUrl(feedUrl);
		if (resolved !== null) return await this.#follow(resolved);

		/**
		 * The URL is exchanged for an id once, here, and written down from then on. The
		 * unique index the exchange goes through is what makes two people following one feed
		 * in the same second come out with one id, and so with one object.
		 */
		let feedId: string;
		try {
			feedId = await registerFeed(feedUrl, advertised.title ?? feedUrl);
		} catch {
			return { ok: false, reason: "unreachable", feedId: null };
		}

		let joined = await feedStore(feedId).subscribe(this.#subject(), feedUrl);
		if (!joined.ok) return { ok: false, reason: joined.reason, feedId: null };

		let now = Date.now();
		let subscriptionId = TypeID.fromUUID("feed", generateUUID()).toString();

		/**
		 * Written straight through rather than inside a transaction scope. A Durable Object
		 * refuses `BEGIN` and `SAVEPOINT` outright, and has no need of them: every write a
		 * turn makes is coalesced into one atomic commit and discarded together if the turn
		 * throws.
		 */
		let created = await this.#db.create(
			feeds,
			{
				id: subscriptionId,
				feed_id: feedId,
				feed_url: joined.feed.feedUrl,
				site_url: joined.feed.siteUrl,
				title: joined.feed.title,
				description: joined.feed.description,
				language: joined.feed.language,
				image_url: joined.feed.imageUrl,
				cursor: 0,
				velocity: DEFAULT_VELOCITY,
				unfollowed_at: null,
			},
			{ returnRow: true },
		);

		let stored = await this.#materialize(subscriptionId, joined.items, DEFAULT_VELOCITY, now);

		/**
		 * Set to the head the feed reported alongside the page, so a subscription starts
		 * current and what reaches the reader from here is what the feed publishes next.
		 *
		 * Not the greatest revision among the items handed over: a feed numbers entries in
		 * the order it discovered them, which is the order the document listed them, so
		 * whether a newest-first page carries the highest revisions or the lowest is a
		 * decision the publisher made. Reading the head makes a new subscription mean the
		 * same thing either way — the newest page, and everything after it.
		 *
		 * This is not the cursor taking its value from the shared index. That head is a hint
		 * which may lag; this one came back from the feed itself, in the same answer as the
		 * items, and names exactly what that object had decided by the time it answered.
		 */
		await this.#db.update(feeds, { id: subscriptionId }, { cursor: joined.head });

		await this.#stampRefreshed(now);

		return { ok: true, feed: toFeedSummary(created, stored), items: stored };
	}

	/**
	 * Retrieves one feed on the spot and reports what came back, for a reader who knows a
	 * site has just published and would rather not wait out the schedule.
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
		 * Asked for by a person rather than by the schedule, so the feed's own backoff is
		 * told to stand aside: a feed that has been failing is exactly the one they came
		 * here to ask about.
		 */
		let refreshed = await feedStore(feed.feed_id).refresh("manual");
		if (!refreshed.ok) return { ok: false, reason: "check-failed" };

		let now = Date.now();

		try {
			let synchronized = await this.#syncFeed(feed);

			// The origin answered, so this reader's copy is current as of now — a 304 included,
			// which says the stored copy was already the current one.
			await this.#stampRefreshed(now);

			return { ok: true, inserted: synchronized.items, updated: 0 };
		} catch (error) {
			/**
			 * The feed answered and this reader's copy did not follow, which is the same news
			 * to somebody standing in front of a page: they asked for this feed to be checked
			 * and it has not been. Told as a refusal rather than thrown, so the page they are
			 * on renders with the outcome on it.
			 */
			console.error("reader synchronization of one feed failed", error);

			return { ok: false, reason: "check-failed" };
		}
	}

	/**
	 * Drops a subscription and every post behind it, and tells the feed it has one fewer
	 * subscriber — which is what eventually stops the feed being polled at all.
	 *
	 * The posts go first, so a turn that fails between the two leaves the feed still
	 * followed rather than its posts orphaned under a subscription that is gone. Saved posts
	 * are the exception: they survive, and the subscription's row survives with them to hold
	 * the feed's name, marked as no longer followed so every list leaves it out.
	 */
	async unfollowFeed(feedId: string): Promise<boolean> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return false;

		await this.#db.deleteMany(feedItems, {
			where: and({ feed_id: feedId }, isNull("saved_at")),
		});

		let saved = await this.#db.count(feedItems, { where: { feed_id: feedId } });

		if (saved > 0) {
			await this.#db.update(feeds, { id: feedId }, { unfollowed_at: Date.now() });
		} else {
			await this.#db.delete(feeds, { id: feedId });
		}

		/**
		 * Told after this reader's own state is settled: the feed's answer decides nothing
		 * here, and a failure to reach it must not leave a reader still following something
		 * they asked to be rid of.
		 */
		await feedStore(feed.feed_id).unsubscribe(this.#subject());

		return true;
	}

	/**
	 * The first page of the queue, and what the reader has waiting that they have not got
	 * yet — which is the question the reading page actually asks.
	 *
	 * The page comes out of local storage and is answered immediately. The staleness beside
	 * it is derived rather than stored: each subscription's cursor is compared against the
	 * head its feed published, so there is no flag to leave set, nothing a lost message can
	 * miss, and no path that can write one and forget the other.
	 *
	 * @param options - Which posts the page holds, where to page from, and how much of it.
	 * @example let opened = await userStore(viewer.id).openReader({ readState: "unread" });
	 */
	async openReader(options: UserStore.ReadingQueueOptions = {}): Promise<UserStore.OpenResult> {
		let [timeline, subscriptions] = await Promise.all([
			this.readingQueue(options),
			this.#subscriptions(),
		]);

		let started = Date.now();
		let heads = await readHeads(subscriptions.map((feed) => feed.feed_id));

		let stale = subscriptions
			.filter((feed) => (heads.get(feed.feed_id) ?? 0) > feed.cursor)
			.map((feed) => feed.id);

		/**
		 * How many reads covered the subscription list is the number worth watching: a check
		 * that stops being one round trip is visible here before a reader notices it.
		 */
		this.#record("job", {
			event: "user.freshness",
			feeds: subscriptions.length,
			reads: Math.ceil(subscriptions.length / KEYS_PER_BULK_READ),
			stale: stale.length,
			durationMs: Date.now() - started,
		});

		return { timeline, freshness: { stale, count: stale.length } };
	}

	/**
	 * Brings stale subscriptions up to date, a bounded number at a time, and reports what it
	 * left behind.
	 *
	 * Nothing renders behind this. It runs after a page has been answered, so a reader back
	 * after a month gets their timeline in one indexed seek and the feeds they are missing
	 * over the seconds and minutes after it.
	 *
	 * @param feedIds - The subscriptions to bring up to date; every stale one when omitted.
	 */
	async synchronize(feedIds?: string[]): Promise<UserStore.SyncRun> {
		let run: UserStore.SyncRun = { synchronized: 0, items: 0, remaining: 0, paused: 0 };

		try {
			let due = await this.#staleSubscriptions(feedIds);
			let batch = due.slice(0, SYNC_FEEDS_PER_REQUEST);
			run.remaining = Math.max(0, due.length - batch.length);

			await inParallel(
				batch,
				async (feed) => {
					let synchronized = await this.#syncFeed(feed);

					run.items += synchronized.items;
					run.synchronized += 1;
					if (synchronized.paused) run.paused += 1;
				},
				SYNC_CONCURRENCY,
			);

			let swept = await this.#sweep(Date.now());
			await this.#stampRefreshed(Date.now());

			this.#record("job", {
				event: "user.retention",
				aged: swept.aged,
				reclaimed: swept.reclaimed,
				paused: swept.paused + run.paused,
			});

			/** Whatever a run could not reach carries on in a minute rather than an interval. */
			if (run.remaining > 0) {
				await this.#armCatchUp();
				this.#record("job", { event: "user.sync.deferred", remaining: run.remaining });
			}
		} catch (error) {
			/**
			 * Reported rather than rejected, for the reason the alarm resolves: this runs
			 * behind a page that has already been sent, and a reader is not shown an error for
			 * work they never asked to wait for.
			 */
			console.error("reader synchronization failed", error);
		}

		return run;
	}

	/**
	 * Changes how long a feed's posts stay in this reader's timeline, and applies it at
	 * once, so the choice is visible in the list rather than at the next sweep.
	 *
	 * @param feedId - The subscription to set it on.
	 * @param velocity - One of the answers the column's `CHECK` allows.
	 */
	async setVelocity(feedId: string, velocity: string): Promise<UserStore.VelocityResult> {
		if (!isVelocity(velocity)) return { ok: false, reason: "invalid-velocity" };

		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return { ok: false, reason: "not-following" };

		let updated = await this.#db.update(feeds, { id: feedId }, { velocity });
		await this.#ageOut(updated, Date.now());

		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: feedId }, isNull("read_at")),
		});

		return { ok: true, feed: toFeedSummary(updated, unread) };
	}

	/**
	 * Keeps a post, or stops keeping it. A kept post is exempt from every rule that deletes
	 * one: the budget's reclamation, its feed's velocity, and the sweep behind both.
	 *
	 * A full shelf refuses rather than making room, because making room would delete the one
	 * thing in this object a reader explicitly asked to keep.
	 *
	 * @param itemId - The post to keep.
	 * @param saved - Whether to keep it; `false` puts it back under whatever rule would take it.
	 */
	async saveItem(itemId: string, saved = true): Promise<UserStore.SaveResult> {
		let item = await this.#db.find(feedItems, { id: itemId });
		if (item === null) return { ok: false, reason: "not-found" };

		if (!saved) {
			await this.#db.update(feedItems, { id: itemId }, { saved_at: null });
			await this.#dropIfSpent(item.feed_id);

			return { ok: true, saved: false };
		}

		if (item.saved_at !== null) return { ok: true, saved: true };

		let kept = await this.#db.count(feedItems, { where: notNull("saved_at") });
		if (kept >= SAVED_LIMIT) return { ok: false, reason: "full" };

		await this.#db.update(feedItems, { id: itemId }, { saved_at: Date.now() });

		return { ok: true, saved: true };
	}

	/**
	 * The posts this reader asked to keep, newest first, paged by the keyset every other
	 * list in this app pages by.
	 *
	 * @param options - Where to page from, and how much of it.
	 */
	savedQueue(options: UserStore.TimelineOptions = {}): Promise<UserStore.TimelineResult> {
		return this.#page(this.#timeline().where(notNull("saved_at")), options);
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
	 * Carries on with whatever synchronization a request left behind.
	 *
	 * The alarm exists for leftovers alone now that nothing here fetches: a reader back
	 * after a month has more stale feeds than one request should carry, so the request
	 * takes a batch and this takes the rest, a minute at a time, until there are none.
	 *
	 * It never rejects. A rejected alarm is retried by the platform, which would run the
	 * same catch-up again against objects that already answered.
	 */
	override async alarm(): Promise<void> {
		try {
			let run = await this.synchronize();

			/** Armed only while work is left, so a reader who is caught up costs no wakes. */
			if (run.remaining > 0) await this.#armCatchUp();
		} catch (error) {
			console.error("reader catch-up alarm failed", error);
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
			{ id: SETTINGS_ID, subject, last_refreshed_at: null },
			{ returnRow: true },
		);
	}

	/**
	 * Writes one wide event about what this object just did.
	 *
	 * Opened here rather than read off the request, because a Durable Object answers in its
	 * own context and the log the Worker opened for the request does not reach it. Counts
	 * and feed identifiers only: nothing about what the reader reads, beyond the subject
	 * this object is already named for.
	 *
	 * @param kind - What kind of invocation produced this, which the platform groups by.
	 * @param fields - The event's name and its measurements.
	 */
	#record(kind: Log.Kind, fields: Log.Fields): void {
		logger.open(kind, fields).emit();
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
	 * Arms the catch-up, holding whatever alarm is already set unless this one is sooner.
	 *
	 * The guard is what keeps an active reader from pushing their own catch-up away: an
	 * object woken by every page view would otherwise re-arm the same minute on every wake
	 * and carry on once they stopped reading.
	 */
	async #armCatchUp(): Promise<void> {
		let next = Date.now() + CATCH_UP_MS;
		let armed = await this.ctx.storage.getAlarm();

		if (armed !== null && armed <= next) return;

		await this.ctx.storage.setAlarm(next);
	}

	/** Every feed this reader still follows, which is every list and sweep's starting point. */
	async #subscriptions(): Promise<SelectFeed[]> {
		return await this.#db.findMany(feeds, { where: isNull("unfollowed_at") });
	}

	/**
	 * The subscriptions with something above their cursor, newest news first.
	 *
	 * The heads are read in bulk, one request per hundred feeds rather than one per feed,
	 * so a reader following two hundred pays the latency of a reader following two.
	 *
	 * @param feedIds - Narrows the question to these subscriptions, when the caller knows.
	 */
	async #staleSubscriptions(feedIds?: string[]): Promise<SelectFeed[]> {
		let followed = await this.#subscriptions();
		let asked =
			feedIds === undefined ? followed : followed.filter((feed) => feedIds.includes(feed.id));

		let heads = await readHeads(asked.map((feed) => feed.feed_id));

		return asked.filter((feed) => (heads.get(feed.feed_id) ?? 0) > feed.cursor);
	}

	/**
	 * Brings one subscription up to date, a page at a time, and stops where the reader has
	 * no room left.
	 *
	 * The cursor is written after the items, never before. A run that dies between the two
	 * leaves a cursor pointing at work already done, and the retry upserts rows it already
	 * wrote, which changes nothing; a cursor advanced first would skip whatever it skipped
	 * past, permanently, and no later check would notice, because the comparison that would
	 * have caught it is the one the cursor just satisfied.
	 *
	 * What the cursor may pass is anything the reader has ruled on: an item stored and an
	 * item dropped for being older than this feed's velocity are both decided. An item whose
	 * write failed, or that this run never reached, is neither.
	 */
	async #syncFeed(feed: SelectFeed): Promise<{ items: number; paused: boolean }> {
		let stored = 0;
		let skipped = 0;
		let cursor = feed.cursor;
		let now = Date.now();
		let started = now;

		/**
		 * A reader over their budget with nothing left to reclaim stops taking posts rather
		 * than deleting ones nobody agreed to lose. The subscription stays stale and says so,
		 * which is back-pressure rather than data loss: nothing they have is taken, and what
		 * they have not got yet waits.
		 */
		if (await this.#isPaused(feed)) return { items: 0, paused: true };

		for (let page = 0; page < SYNC_PAGES_PER_FEED; page += 1) {
			let answered = await feedStore(feed.feed_id).getItemsAfter(cursor);
			if (answered.items.length === 0) break;

			let kept = await this.#materialize(feed.id, answered.items, feed.velocity, now);

			stored += kept;
			skipped += answered.items.length - kept;

			cursor = greatestRevision(answered.items);
			await this.#db.update(feeds, { id: feed.id }, { cursor });

			if (answered.head <= cursor) break;
		}

		this.#record("job", {
			event: "user.sync",
			feedId: feed.feed_id,
			items: stored,
			skipped,
			cursorFrom: feed.cursor,
			cursorTo: cursor,
			durationMs: Date.now() - started,
		});

		return { items: stored, paused: false };
	}

	/**
	 * Writes a feed's items as this reader's own copies, and answers how many it kept.
	 *
	 * An item already older than this subscription's velocity is not stored at all, so a
	 * reader returning after a month to a feed they read for headlines materializes the last
	 * few hours rather than a month of them to delete on the next sweep.
	 */
	async #materialize(
		subscriptionId: string,
		incoming: readonly FeedStore.Item[],
		velocity: Velocity,
		now: number,
	): Promise<number> {
		let window = VELOCITY_WINDOW_MS[velocity];
		let kept = incoming.filter((item) => window === null || item.publishedAt >= now - window);
		if (kept.length === 0) return 0;

		for (let chunk of chunked(kept, insertChunkSize())) {
			await this.#db.exec(...upsertItems(subscriptionId, chunk, now));
		}

		return kept.length;
	}

	/**
	 * Lets go of a feed the reader unfollowed once the last post they kept from it goes.
	 *
	 * Such a row outlives the subscription for one reason — to hold the feed's name for the
	 * saved list to show — so it has nothing left to do the moment that list stops naming
	 * it. A feed the reader still follows is untouched.
	 *
	 * @param subscriptionId - The feed the unsaved post belonged to.
	 */
	async #dropIfSpent(subscriptionId: string): Promise<void> {
		let feed = await this.#db.find(feeds, { id: subscriptionId });
		if (feed === null || feed.unfollowed_at === null) return;

		let kept = await this.#db.count(feedItems, {
			where: and({ feed_id: subscriptionId }, notNull("saved_at")),
		});

		if (kept > 0) return;

		await this.#db.deleteMany(feedItems, { where: { feed_id: subscriptionId } });
		await this.#db.delete(feeds, { id: subscriptionId });
	}

	/**
	 * Whether this subscription has to stop taking posts: the object is over its budget, and
	 * this feed is over the share of it that its reader's other feeds leave.
	 */
	async #isPaused(feed: SelectFeed): Promise<boolean> {
		/**
		 * The share this feed is held to, then its own rows, and the object's whole count
		 * only for a feed already over that share. A feed inside its share cannot pause
		 * whatever else the object holds, so the common answer costs two counts a small
		 * table and one index answer rather than a scan of every post the reader has.
		 */
		let followed = await this.#db.count(feeds, { where: isNull("unfollowed_at") });
		let held = await this.#db.count(feedItems, { where: { feed_id: feed.id } });

		if (held <= shareOf(followed)) return false;

		/**
		 * At the budget rather than past it: the figure is one number with two consequences,
		 * and refusing is what it does when reclaiming has nothing left to take. An object
		 * sitting exactly on it has no room for the next post either.
		 */
		return (await this.#db.count(feedItems)) >= READER_BUDGET;
	}

	/**
	 * Takes what the reader has agreed to lose, and nothing else.
	 *
	 * Two rules, and both are the reader's own: a velocity they set on a feed, and a budget
	 * they are over. Nothing is deleted for being old on an object with room for it — a
	 * sweep that dropped posts read a year ago would fire on an object holding a thousand
	 * rows as readily as on one holding a million, and take reading history from somebody
	 * using a thousandth of their space.
	 *
	 * @param now - Epoch milliseconds the velocities are measured against.
	 */
	async #sweep(now: number): Promise<{ aged: number; reclaimed: number; paused: number }> {
		let swept = { aged: 0, reclaimed: 0, paused: 0 };
		let followed = await this.#subscriptions();

		for (let feed of followed) swept.aged += await this.#ageOut(feed, now);

		let total = await this.#db.count(feedItems);
		if (total < READER_BUDGET) return swept;

		/**
		 * The share is applied only while the object is over budget, which is what keeps the
		 * division from being destructive: a reader under it keeps everything, so following a
		 * second feed does not halve the history of the first.
		 */
		let share = shareOf(followed.length);

		for (let feed of followed) {
			let held = await this.#db.count(feedItems, { where: { feed_id: feed.id } });
			if (held <= share) continue;

			let reclaimed = await this.#reclaim(feed.id, held - share);
			swept.reclaimed += reclaimed;

			/** Nothing left that was read, so this feed holds rather than losing unread posts. */
			if (reclaimed < held - share) swept.paused += 1;
		}

		return swept;
	}

	/**
	 * Drops the posts of one feed that are older than the velocity its reader set, and
	 * answers how many went. A saved post stays: it is the one answer that outlives every
	 * rule here.
	 */
	async #ageOut(feed: SelectFeed, now: number): Promise<number> {
		let window = VELOCITY_WINDOW_MS[feed.velocity];
		if (window === null) return 0;

		let past = and({ feed_id: feed.id }, lt("published_at", now - window), isNull("saved_at"));

		/** Counted before the delete, since what a write reports is rows of storage. */
		let posts = await this.#db.count(feedItems, { where: past });
		if (posts === 0) return 0;

		await this.#db.deleteMany(feedItems, { where: past });

		return posts;
	}

	/**
	 * Takes back up to `excess` of one feed's posts, oldest first, from what the reader has
	 * already read and has not saved. It answers how many it got, which is short of what was
	 * asked for exactly when there is nothing left the reader agreed to lose.
	 */
	async #reclaim(subscriptionId: string, excess: number): Promise<number> {
		let reclaimable = await this.#db
			.query(feedItems)
			.where(and({ feed_id: subscriptionId }, notNull("read_at"), isNull("saved_at")))
			.select("id")
			.orderBy("published_at", "asc")
			.orderBy("id", "asc")
			.limit(excess)
			.all();

		if (reclaimable.length === 0) return 0;

		for (let batch of chunked(
			reclaimable.map((row) => row.id),
			IDS_PER_LOOKUP,
		)) {
			await this.#db.deleteMany(feedItems, { where: inList("id", batch) });
		}

		/**
		 * The posts it named, rather than what the deletes reported: a write reports rows of
		 * storage, and this number decides whether the feed has anything left to give back.
		 */
		return reclaimable.length;
	}

	/**
	 * The subscription already holding `feedUrl`, or `null` for a feed nobody here follows.
	 *
	 * It finds a row the reader has unfollowed as readily as one they follow, because such
	 * a row is still theirs: it was kept to hold the name of a feed they saved posts from,
	 * and following that feed again is picking it back up rather than starting a second one.
	 */
	async #subscriptionByUrl(feedUrl: string): Promise<SelectFeed | null> {
		return await this.#db.findOne(feeds, { where: { feed_url: feedUrl } });
	}

	/**
	 * Answers a follow of a feed this object already has a row for: already following when
	 * the reader still follows it, and picked back up when only its saved posts were left.
	 */
	async #follow(existing: SelectFeed): Promise<UserStore.FollowResult> {
		if (existing.unfollowed_at === null) {
			return { ok: false, reason: "already-following", feedId: existing.id };
		}

		let revived = await this.#db.update(feeds, { id: existing.id }, { unfollowed_at: null });
		await feedStore(existing.feed_id).subscribe(this.#subject(), existing.feed_url);

		let synchronized = await this.#syncFeed(revived);
		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: existing.id }, isNull("read_at")),
		});

		return { ok: true, feed: toFeedSummary(revived, unread), items: synchronized.items };
	}

	/** The columns a timeline page reads, ordered and seeked by whoever pages it. */
	#timeline() {
		return this.#db
			.query(feedItems)
			.select(
				"id",
				"feed_id",
				"title",
				"url",
				"summary",
				"author",
				"published_at",
				"read_at",
				"saved_at",
			);
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

	return sql`select "id", "feed_id", "title", "url", "summary", "author", "published_at", "read_at", "saved_at"
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
	let { feed_id: feedId, published_at: publishedAt, read_at: readAt, saved_at: savedAt } = row;

	return {
		id: typeof row.id === "string" ? row.id : "",
		feed_id: typeof feedId === "string" ? feedId : "",
		title: typeof row.title === "string" ? row.title : "",
		url: typeof row.url === "string" ? row.url : null,
		summary: typeof row.summary === "string" ? row.summary : null,
		author: typeof row.author === "string" ? row.author : null,
		published_at: typeof publishedAt === "number" ? publishedAt : 0,
		read_at: typeof readAt === "number" ? readAt : null,
		saved_at: typeof savedAt === "number" ? savedAt : null,
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
	concurrency: number = ON_DEMAND_CONCURRENCY,
): Promise<void> {
	let next = 0;

	let workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
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

/** A settings row as the RPC boundary reports it. */
function toSettings(row: SelectSettings): UserStore.Settings {
	return { subject: row.subject, lastRefreshedAt: row.last_refreshed_at };
}

/** A feed row and its unread count as the feed list renders them. */
function toFeedSummary(row: SelectFeed, unreadCount: number): UserStore.FeedSummary {
	return {
		id: row.id,
		feedId: row.feed_id,
		feedUrl: row.feed_url,
		siteUrl: row.site_url,
		title: row.title,
		description: row.description,
		imageUrl: row.image_url,
		velocity: row.velocity,
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
		savedAt: row.saved_at,
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

	/**
	 * A subscribe button hands out `feed://example.com/rss`, or `feed:` wrapped around a
	 * whole address, and a reader who clicked one and pasted what they got is holding the
	 * feed they meant. The scheme says "this is a feed" rather than how to fetch it, so it
	 * comes off and what is underneath is read as the address it is.
	 */
	let addressed = trimmed.replace(/^feeds?:(\/\/)?/i, "");
	if (addressed.length === 0) return null;

	let candidate = /^[a-z][\d+.a-z-]*:/i.test(addressed) ? addressed : `https://${addressed}`;
	if (!URL.canParse(candidate)) return null;

	let url = new URL(candidate);
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	url.hash = "";
	return url.toString();
}

/** Whether a submitted value is one of the velocities the column's `CHECK` allows. */
function isVelocity(value: string): value is Velocity {
	return VELOCITIES.some((offered) => offered === value);
}

/**
 * A feed's share of the reader's budget: the whole of it divided by how many feeds they
 * follow. One feed may fill it alone; a thousand feeds get a thousand posts each, and a
 * quiet feed is never charged for a prolific one.
 *
 * @param followed - How many feeds the reader follows.
 */
function shareOf(followed: number): number {
	return Math.max(1, Math.floor(READER_BUDGET / Math.max(1, followed)));
}

/**
 * The greatest revision a page of items accounted for, which is where a cursor lands.
 *
 * @param incoming - The page as the feed answered it, in the order it decided them.
 */
function greatestRevision(incoming: readonly FeedStore.Item[]): number {
	return incoming.reduce((highest, item) => Math.max(highest, item.revision), 0);
}

/** The columns one materialized post is written with, in the order the statement binds them. */
const ITEM_COLUMNS = [
	"id",
	"feed_id",
	"guid",
	"title",
	"url",
	"summary",
	"author",
	"published_at",
	"created_at",
	"updated_at",
] as const;

/**
 * The statement that writes a page of a feed's items as this reader's own copies.
 *
 * An upsert on the canonical id rather than an insert, which is what makes synchronization
 * idempotent: a run that died before it wrote its cursor re-applies the same items on the
 * retry and changes nothing. Three columns are left out of the update deliberately —
 * `read_at`, so a publisher's correction does not resurrect a post the reader has already
 * read; `id`, the key their copy is joined by; and `published_at`, the leading cursor
 * column, whose movement would make a cursor already in flight skip posts mid-scroll.
 * `saved_at` is left out for the same reason as `read_at`: it is the reader's answer, not
 * the publisher's.
 *
 * @param subscriptionId - This reader's own handle for the feed the items came from.
 * @param incoming - The items to write.
 * @param now - Epoch milliseconds the copies are stamped with.
 */
function upsertItems(
	subscriptionId: string,
	incoming: readonly FeedStore.Item[],
	now: number,
): [string, unknown[]] {
	let values: unknown[] = [];

	for (let item of incoming) {
		values.push(
			item.id,
			subscriptionId,
			item.guid,
			item.title,
			item.url,
			item.summary,
			item.author,
			item.publishedAt,
			now,
			now,
		);
	}

	let row = `(${ITEM_COLUMNS.map(() => "?").join(", ")})`;
	let columns = ITEM_COLUMNS.map((column) => `"${column}"`).join(", ");

	let statement = [
		`insert into "feed_items" (${columns})`,
		`values ${incoming.map(() => row).join(", ")}`,
		`on conflict ("id") do update set`,
		`"title" = excluded."title",`,
		`"url" = excluded."url",`,
		`"summary" = excluded."summary",`,
		`"author" = excluded."author",`,
		`"updated_at" = excluded."updated_at"`,
	].join(" ");

	return [statement, values];
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
