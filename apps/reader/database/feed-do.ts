/**
 * The canonical copy of one feed, and the RPC surface it answers.
 *
 * One object per feed, named by the id the catalog assigned it, so the traffic this
 * product sends a publisher is a function of how many feeds its readers follow rather than
 * of how many of them follow each one: ten thousand subscribers of a feed are one poll,
 * because one object does the polling and each reader takes a copy from it afterwards.
 *
 * It tells nobody when it finds something. Telling every subscriber is one write per
 * subscriber, for a fact each of them could work out — and most of them will not open the
 * reader today. Instead the feed publishes where it has got to, once, and readers compare
 * that against their own cursor when they next ask a question that needs the answer.
 *
 * Three things never cross this boundary, for the reason they never cross the reader's: a
 * `Result`, whose error subclass the platform drops; a `Date`, for the reason every stored
 * timestamp is an integer; and a thrown failure where a discriminated union would let the
 * caller tell one refusal from another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { DatabaseDriver } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { env } from "cloudflare:workers";
import { DurableObject } from "cloudflare:workers";
import { Database, gt } from "remix/data-table";

import type { FeedStatus, SelectFeed, SelectItem } from "~/database/feed-schema";

import { logger } from "~/bootstrap/logger";
import { forgetHead, publishHead } from "~/database/feed-head";
import { FEED_MIGRATIONS, FEED_JOURNAL } from "~/database/feed-migrations";
import {
	feed as feedTable,
	FEED_RETENTION,
	items,
	POLL_INTERVAL_MS,
	PURGE_GRACE_MS,
	subscribers,
} from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";
import { FEED_ROW_ID, measurePostsPerDay, pollFeed, pruneItems } from "~/database/refresh";
import { deleteFeed, renameFeed, retireFeed, reviveFeed, stampActivity } from "~/database/registry";

/**
 * Items a new subscriber is handed outright, which is what following a feed was already
 * worth: the newest page of it, there to read immediately. Everything older reaches them
 * through the cursor, and everything newer through the next check.
 */
const SUBSCRIPTION_PAGE = 50;

/**
 * Items one synchronization page carries. It bounds how long the object holds its single
 * thread for one reader, which matters most for the feed everybody follows.
 */
const SYNC_PAGE = 200;

/**
 * A run that leaves work behind comes back in a minute rather than an interval, so a feed
 * whose poll ran out of room catches up in the same sitting.
 */
const CATCH_UP_MS = 60 * 1000;

export namespace FeedStore {
	/** The feed's own description of itself, as a subscriber copies it. */
	export interface Metadata {
		feedUrl: string;
		siteUrl: string | null;
		title: string;
		description: string | null;
		language: string | null;
		imageUrl: string | null;
		/** What the feed publishes, in posts per day, or `null` before anything is known. */
		postsPerDay: number | null;
	}

	/** One canonical item, as a subscriber materializes it. */
	export interface Item {
		id: string;
		guid: string;
		title: string;
		url: string | null;
		summary: string | null;
		author: string | null;
		publishedAt: number;
		/** Where this sits in the order subscribers walk, which their cursor moves through. */
		revision: number;
	}

	/** What the last poll recorded, for the page that shows one feed. */
	export interface Health {
		status: FeedStatus | null;
		httpStatus: number | null;
		error: string | null;
		failureCount: number;
		lastFetchedAt: number | null;
		/** The head as this object holds it, so a page about one feed never reads the hint. */
		head: number;
		postsPerDay: number | null;
	}

	/** Why a subscription could not be created, told apart so the reader reads which. */
	export type SubscribeFailure = "unreachable" | "not-found";

	export type SubscribeResult =
		| {
				ok: true;
				feed: Metadata;
				head: number;
				/** The newest page of the feed, for the subscriber to store outright. */
				items: Item[];
		  }
		| { ok: false; reason: SubscribeFailure };

	export interface UnsubscribeResult {
		/** Whether anybody still follows the feed, which is what decides its alarm's job. */
		remaining: boolean;
	}

	/** Why a poll was asked for, so one path serves the schedule, a reader and a ping. */
	export type RefreshReason = "scheduled" | "manual" | "subscribe";

	export type RefreshResult =
		| { ok: true; status: "ok"; inserted: number; edited: number; head: number }
		| { ok: true; status: "not_modified"; head: number }
		| { ok: false; status: FeedStatus; message: string };

	/** A page of the items above a subscriber's cursor, in the order they were decided. */
	export interface ItemsPage {
		items: Item[];
		/** The feed's head as of this read, which is the truth the hint approximates. */
		head: number;
	}
}

export class FeedDO extends DurableObject<Cloudflare.Env> {
	/** The feed's own SQLite, built once because the storage handle outlives every call. */
	#db: Database;

	/** Kept because a purge empties the storage this instance is still answering from. */
	#adapter: DatabaseDriver;

	/**
	 * Opens the feed's database and applies whatever schema has not run yet.
	 *
	 * @param ctx - The object's storage, alarms and concurrency gate.
	 * @param env - The Worker's bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		let adapter = createSQLStorageDatabaseAdapter(ctx.storage.sql);
		this.#adapter = adapter;

		/**
		 * Auto-managed timestamps read this clock, which answers epoch milliseconds so a
		 * written timestamp binds and sorts as the integer every column of this schema holds.
		 */
		this.#db = new Database(adapter, { now: () => Date.now() });

		/**
		 * A constructor cannot await, and the runtime holds every request behind this, so
		 * each method below reads a schema that already exists.
		 */
		void ctx.blockConcurrencyWhile(() => runMigrations(adapter, FEED_MIGRATIONS, FEED_JOURNAL));
	}

	/**
	 * Records a subscriber, fetching the feed if this object has never fetched one, and
	 * answers with what that reader needs to start reading: the feed's own description of
	 * itself, the head it has reached, and its newest page of items.
	 *
	 * Idempotent, because the second follower of a feed reaches an object that already
	 * exists and has already done the fetching — which is the whole point of naming it
	 * after the feed rather than after the reader.
	 *
	 * @param userId - The reader subscribing, as their OIDC subject.
	 * @param feedUrl - The canonical URL, used only when this object has no document yet.
	 * @example let joined = await feedStore(feedId).subscribe(viewer.id, feedUrl);
	 */
	async subscribe(userId: string, feedUrl: string): Promise<FeedStore.SubscribeResult> {
		let now = Date.now();
		let feed = await this.#feedRow();

		if (feed === null) {
			let initialized = await this.#initialize(feedUrl, now);
			if (!initialized.ok) return initialized;
			feed = initialized.feed;
		}

		/**
		 * A membership is a row keyed by the reader, so following twice is one row either
		 * way. Read before written rather than written over: the second follower of a feed is
		 * the common case, and it costs a read rather than a write to the table every
		 * unsubscribe then has to check.
		 */
		let joined = await this.#db.find(subscribers, { user_id: userId });
		if (joined === null) {
			await this.#db.create(subscribers, { user_id: userId, subscribed_at: now });
		}

		/**
		 * A feed serving out its grace period is followed again, so the purge it was waiting
		 * for is called off and the catalog stops listing it as retired. Its items are all
		 * still here, which is what the grace period was for.
		 */
		if (feed.purge_at !== null) {
			await this.#db.update(feedTable, { id: FEED_ROW_ID }, { purge_at: null, updated_at: now });
			await reviveFeed(this.#feedId());
		}

		await this.#armPoll();

		this.#record("job", { event: "feed.subscriber.added", feedUrl: feed.feed_url });

		return {
			ok: true,
			feed: metadataOf(feed),
			head: feed.head,
			items: await this.#newest(SUBSCRIPTION_PAGE),
		};
	}

	/**
	 * Drops a subscriber, and says whether anybody is left.
	 *
	 * When nobody is, the feed stops polling immediately and sets a purge a week out
	 * instead: an unfollow and a re-follow a day later then costs one fetch rather than a
	 * re-download of everything the feed has ever published.
	 *
	 * @param userId - The reader leaving, as their OIDC subject.
	 */
	async unsubscribe(userId: string): Promise<FeedStore.UnsubscribeResult> {
		await this.#db.delete(subscribers, { user_id: userId });

		let feed = await this.#feedRow();

		if (await this.#hasSubscribers()) {
			this.#record("job", {
				event: "feed.subscriber.removed",
				feedUrl: feed?.feed_url ?? null,
				remaining: true,
			});

			return { remaining: true };
		}

		this.#record("job", {
			event: "feed.subscriber.removed",
			feedUrl: feed?.feed_url ?? null,
			remaining: false,
		});

		let now = Date.now();
		await this.#db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{ purge_at: now + PURGE_GRACE_MS, updated_at: now },
		);
		await retireFeed(this.#feedId());
		await this.ctx.storage.setAlarm(now + PURGE_GRACE_MS);

		return { remaining: false };
	}

	/**
	 * Retrieves the feed and reports what came back.
	 *
	 * One entry point for every reason a feed is fetched — the daily schedule, a reader
	 * asking on the spot, and whatever a publisher's own ping becomes later — so the
	 * trigger changes without anything downstream of it changing.
	 *
	 * @param reason - What asked for this, which decides whether a backoff holds it back.
	 */
	async refresh(reason: FeedStore.RefreshReason): Promise<FeedStore.RefreshResult> {
		let now = Date.now();
		let feed = await this.#feedRow();

		if (feed === null) {
			return { ok: false, status: "network_error", message: "This feed has no document yet" };
		}

		/**
		 * A backoff holds the schedule off an origin that has been failing. A reader asking
		 * on the spot is the one case it was never meant to hold back: a feed that has been
		 * failing is exactly the one they came here to ask about.
		 */
		if (reason === "scheduled" && feed.next_attempt_at !== null && feed.next_attempt_at > now) {
			return { ok: true, status: "not_modified", head: feed.head };
		}

		let outcome = await pollFeed(this.#db, { now });

		this.#record("job", {
			event: "feed.poll",
			feedUrl: feed.feed_url,
			reason,
			status: outcome.status,
			httpStatus: outcome.status === "http_error" ? outcome.httpStatus : null,
			durationMs: Date.now() - now,
			inserted: outcome.status === "ok" ? outcome.inserted : 0,
			edited: outcome.status === "ok" ? outcome.edited : 0,
			head: outcome.status === "ok" ? outcome.head : feed.head,
		});

		if (outcome.status === "not_modified") {
			return { ok: true, status: "not_modified", head: feed.head };
		}

		if (outcome.status !== "ok") {
			return { ok: false, status: outcome.status, message: outcome.message };
		}

		await pruneItems(this.#db, FEED_RETENTION);

		/**
		 * Published only when something actually moved, so a poll that stored nothing writes
		 * nothing outside its own row — which is what keeps a publication one write whatever
		 * the subscriber count, and nothing at all for a feed that has not published.
		 */
		if (outcome.inserted > 0 || outcome.edited > 0) {
			await publishHead(this.#feedId(), outcome.head);
			await stampActivity(this.#feedId());

			this.#record("job", {
				event: "feed.head.published",
				feedUrl: feed.feed_url,
				head: outcome.head,
			});
		}

		return {
			ok: true,
			status: "ok",
			inserted: outcome.inserted,
			edited: outcome.edited,
			head: outcome.head,
		};
	}

	/** The head this feed has reached, which is the truth the published hint approximates. */
	async getHead(): Promise<number> {
		let feed = await this.#feedRow();
		return feed?.head ?? 0;
	}

	/**
	 * What the last poll recorded, for the page about one feed.
	 *
	 * That page is about one feed, so it costs one call, and the call answers with the true
	 * head beside the health — so the one surface that names a feed never depends on a hint.
	 */
	async health(): Promise<FeedStore.Health | null> {
		let feed = await this.#feedRow();
		if (feed === null) return null;

		return {
			status: feed.last_status,
			httpStatus: feed.last_http_status,
			error: feed.last_error,
			failureCount: feed.failure_count,
			lastFetchedAt: feed.last_fetched_at,
			head: feed.head,
			postsPerDay: feed.posts_per_day,
		};
	}

	/**
	 * The items decided after `cursor`, oldest first, so a subscriber applies them in the
	 * order this object decided them and can stop anywhere without a hole.
	 *
	 * @param cursor - The greatest revision the caller has already ruled on.
	 * @param limit - The most items to answer with, capped at what one page carries.
	 */
	async getItemsAfter(cursor: number, limit: number = SYNC_PAGE): Promise<FeedStore.ItemsPage> {
		let rows = await this.#db.findMany(items, {
			where: gt("revision", cursor),
			orderBy: [["revision", "asc"]],
			limit: Math.min(Math.max(1, limit), SYNC_PAGE),
		});

		return { items: rows.map(itemOf), head: await this.getHead() };
	}

	/**
	 * The scheduled poll, or the purge of a feed nobody follows any more.
	 *
	 * Which job a firing is doing is a question about the `subscribers` table rather than a
	 * flag, so one alarm serves both and neither can be left set by a path that forgot.
	 *
	 * It never rejects. A rejected alarm is retried by the platform, which would re-fetch an
	 * origin that already answered.
	 */
	override async alarm(): Promise<void> {
		try {
			if (!(await this.#hasSubscribers())) {
				await this.#purge();
				return;
			}

			let outcome = await this.refresh("scheduled");
			await this.#armPoll(await this.#nextPollDelay(outcome));
		} catch (error) {
			console.error("feed poll alarm failed", error);
			await this.#armPoll().catch(() => undefined);
		}
	}

	/**
	 * Fetches the feed for the first time and writes the row the object is built around.
	 *
	 * A feed nobody can retrieve leaves no row at all, so the next subscriber tries again
	 * rather than joining an object that will never have anything in it.
	 */
	async #initialize(
		feedUrl: string,
		now: number,
	): Promise<{ ok: true; feed: SelectFeed } | { ok: false; reason: FeedStore.SubscribeFailure }> {
		let created = await this.#db.create(
			feedTable,
			{
				id: FEED_ROW_ID,
				feed_url: feedUrl,
				title: feedUrl,
				head: 0,
				failure_count: 0,
				created_at: now,
				updated_at: now,
			},
			{ returnRow: true },
		);

		let outcome = await pollFeed(this.#db, { now });

		if (outcome.status !== "ok" && outcome.status !== "not_modified") {
			await this.#db.delete(feedTable, { id: FEED_ROW_ID });
			return { ok: false, reason: outcome.status === "parse_error" ? "not-found" : "unreachable" };
		}

		await this.#db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{ posts_per_day: await measurePostsPerDay(this.#db, now), updated_at: now },
		);

		let feed = (await this.#feedRow()) ?? created;

		/**
		 * The catalog row was named after the address it was minted from, since nothing had
		 * read the feed yet. This object has now, so it says what the publisher calls it.
		 */
		await renameFeed(this.#feedId(), feed.title);

		/**
		 * Published from the first subscription rather than from the first publication, so a
		 * reader who joins a quiet feed reads a head rather than an absence — which every
		 * reader is told means there is no reason to go and look.
		 */
		await publishHead(this.#feedId(), feed.head);

		this.#record("job", {
			event: "feed.initialized",
			feedUrl: feed.feed_url,
			feedId: this.#feedId(),
			head: feed.head,
		});

		return { ok: true, feed };
	}

	/** Clears everything this feed holds, in every store that holds anything for it. */
	async #purge(): Promise<void> {
		let feedId = this.#feedId();
		let feed = await this.#feedRow();
		let held = await this.#db.count(items);

		await forgetHead(feedId);
		await this.ctx.storage.deleteAll();

		/**
		 * `deleteAll` takes the tables with the rows, and the schema is otherwise built in the
		 * constructor — but this instance is still live and still answering. Rebuilding it
		 * here is what leaves a purged feed looking like one nobody has subscribed to yet,
		 * which every method already has an answer for, rather than failing on a missing
		 * table until the runtime happens to evict it.
		 */
		await runMigrations(this.#adapter, FEED_MIGRATIONS, FEED_JOURNAL);

		/**
		 * Last, because a row deleted while the object still held items would hand the next
		 * follower a new id, a new object, and no way ever to reach the old one. The reverse
		 * — a row outliving the storage — costs the next follower one re-initialization of an
		 * object that is already empty.
		 */
		await deleteFeed(feedId).catch(() => undefined);

		this.#record("alarm", {
			event: "feed.purged",
			feedUrl: feed?.feed_url ?? null,
			items: held,
		});
	}

	/** The feed's single row, or `null` for an object nothing has subscribed to yet. */
	async #feedRow(): Promise<SelectFeed | null> {
		return await this.#db.find(feedTable, { id: FEED_ROW_ID });
	}

	/**
	 * Whether anybody still follows this feed.
	 *
	 * Asked as an existence rather than a count, because every unsubscribe and every alarm
	 * asks it and none of them wants the number: the index answers this from its first row.
	 */
	async #hasSubscribers(): Promise<boolean> {
		let [row] = await this.#db.query(subscribers).select("user_id").limit(1).all();
		return row !== undefined;
	}

	/** The newest items, for a subscriber to start from. */
	async #newest(limit: number): Promise<FeedStore.Item[]> {
		let rows = await this.#db.findMany(items, {
			orderBy: [
				["published_at", "desc"],
				["id", "desc"],
			],
			limit,
		});

		return rows.map(itemOf);
	}

	/**
	 * How long until this feed is next fetched.
	 *
	 * A feed that is failing is retried when its own backoff lifts, which is what makes that
	 * column a schedule rather than a veto: without it the next firing would find the floor
	 * still in place, report a poll it never made, and settle back to the daily cadence — so
	 * one failure would cost a day rather than five minutes.
	 *
	 * @param outcome - What the poll that just ran reported.
	 */
	async #nextPollDelay(outcome: FeedStore.RefreshResult): Promise<number> {
		let feed = await this.#feedRow();
		let waiting = feed?.next_attempt_at ?? null;
		let now = Date.now();

		if (waiting !== null && waiting > now) return Math.min(waiting - now, POLL_INTERVAL_MS);

		return outcome.ok ? POLL_INTERVAL_MS : CATCH_UP_MS;
	}

	/** Arms the poll, holding whatever alarm is already set unless this one is sooner. */
	async #armPoll(delay: number = POLL_INTERVAL_MS): Promise<void> {
		let next = Date.now() + delay;
		let armed = await this.ctx.storage.getAlarm();

		if (armed !== null && armed <= next) return;

		await this.ctx.storage.setAlarm(next);
	}

	/**
	 * Writes one wide event about what this object just did.
	 *
	 * Opened here rather than read off the request, because a Durable Object answers in its
	 * own context and the log the Worker opened for the request does not reach it. What goes
	 * in is counts and identifiers: a feed's address and what a poll did with it, never the
	 * contents of anything it fetched or the readers waiting for it.
	 *
	 * @param kind - What kind of invocation produced this, which the platform groups by.
	 * @param fields - The event's name and its measurements.
	 */
	#record(kind: Log.Kind, fields: Log.Fields): void {
		logger.open(kind, fields).emit();
	}

	/**
	 * The feed this object holds, which is the name it was reached by.
	 *
	 * @throws If the object was reached by id rather than by name, which would leave every
	 * key it writes and every catalog row it stamps addressed to nothing.
	 */
	#feedId(): string {
		let name = this.ctx.id.name;
		if (name === undefined) throw new Error("A feed object must be reached by name");
		return name;
	}
}

/**
 * The canonical copy of one feed, addressed by the id the catalog assigned it.
 *
 * @param feedId - The identifier the catalog minted for the feed's canonical URL.
 * @example let page = await feedStore(feedId).getItemsAfter(cursor);
 */
export function feedStore(feedId: string): DurableObjectStub<FeedDO> {
	return env.FEED.getByName(feedId);
}

/** The feed's description of itself, as it crosses the boundary. */
function metadataOf(feed: SelectFeed): FeedStore.Metadata {
	return {
		feedUrl: feed.feed_url,
		siteUrl: feed.site_url,
		title: feed.title,
		description: feed.description,
		language: feed.language,
		imageUrl: feed.image_url,
		postsPerDay: feed.posts_per_day,
	};
}

/** One stored item, as it crosses the boundary. */
function itemOf(row: SelectItem): FeedStore.Item {
	return {
		id: row.id,
		guid: row.guid,
		title: row.title,
		url: row.url,
		summary: row.summary,
		author: row.author,
		publishedAt: row.published_at,
		revision: row.revision,
	};
}
