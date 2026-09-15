/**
 * The per-reader Durable Object and the typed surface the Worker reaches it through. One
 * object holds one person's settings, the feeds they follow and every post from them, so
 * the reading queue is a single indexed query over their own rows rather than a merge
 * across feeds, and the refresh schedule lives beside the data it refreshes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetQuery } from "@sdxc/pagination";

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Feed, FeedFetchError } from "@sdxc/feed";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { DurableObject, env } from "cloudflare:workers";
import { and, Database, inList, isNull } from "remix/data-table";

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

	/** Setting a cadence the `CHECK` constraint would refuse is reported, never thrown. */
	export type IntervalResult =
		| { ok: true; settings: Settings }
		| { ok: false; reason: "invalid-interval" };
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
		let stored = await this.#db.find(settings, { id: SETTINGS_ID });

		let row =
			stored ??
			(await this.#db.create(
				settings,
				{
					id: SETTINGS_ID,
					subject,
					refresh_interval_hours: DEFAULT_INTERVAL_HOURS,
					last_refreshed_at: null,
				},
				{ returnRow: true },
			));

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

		let row = await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{ refresh_interval_hours: hours },
		);
		await this.#armRefresh(hours * HOUR_MS);

		return { ok: true, settings: toSettings(row) };
	}

	/** Every followed feed, newest subscription first, each with its unread count. */
	async listFeeds(): Promise<UserStore.FeedSummary[]> {
		let [rows, unread] = await Promise.all([
			this.#db.findMany(feeds, {
				orderBy: [
					["created_at", "desc"],
					["id", "desc"],
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

		let created = await this.#db.transaction(async (tx) => {
			let row = await tx.create(
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
				await tx.createMany(feedItems, batch);
			}

			return row;
		});

		return { ok: true, feed: toFeedSummary(created, rows.length), items: rows.length };
	}

	/** Drops a subscription and every post behind it. `false` when it was not followed. */
	unfollowFeed(feedId: string): Promise<boolean> {
		return this.#db.transaction(async (tx) => {
			await tx.deleteMany(feedItems, { where: { feed_id: feedId } });
			return tx.delete(feeds, { id: feedId });
		});
	}

	/** The unread posts across every followed feed, newest first. */
	readingQueue(options: UserStore.TimelineOptions = {}): Promise<UserStore.TimelineResult> {
		return this.#page(this.#timeline().where(isNull("read_at")), options);
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

				await this.#db.updateMany(
					settings,
					{ last_refreshed_at: Date.now() },
					{ where: { id: SETTINGS_ID } },
				);
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

/** The page size a caller asked for, held between one post and {@link MAX_PAGE_LIMIT}. */
function pageLimit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_LIMIT;
	return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}
