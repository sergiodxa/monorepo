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

import { randomToken, timingSafeEqual } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { env } from "cloudflare:workers";
import { DurableObject } from "cloudflare:workers";
import { Database, gt } from "remix/data-table";

import type { FeedStatus, SelectFeed, SelectItem } from "~/database/feed-schema";
import type { HubAdvert } from "~/database/refresh";

import { features, flagsFor } from "~/app/lib/flags";
import { logger } from "~/bootstrap/logger";
import { forgetHead, publishHead } from "~/database/feed-head";
import { FEED_MIGRATIONS, FEED_JOURNAL } from "~/database/feed-migrations";
import {
	feed as feedTable,
	FEED_RETENTION,
	HUB_COOLOFF_MS,
	HUB_DAILY_NOTIFICATION_LIMIT,
	HUB_LEASE_SECONDS,
	HUB_MISS_LIMIT,
	HUB_NOTIFICATION_WINDOW_MS,
	HUB_POLL_FLOOR_MS,
	hubCoalesced,
	hubRenewalAt,
	items,
	POLL_CEILING_MS,
	POLL_FLOOR_MS,
	pollIntervalFor,
	PURGE_GRACE_MS,
	subscribers,
} from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";
import { FEED_ROW_ID, pollFeed, pruneItems } from "~/database/refresh";
import { deleteFeed, renameFeed, retireFeed, reviveFeed, stampActivity } from "~/database/registry";
import routes from "~/routes/web";

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

/** Entropy behind the shared secret every notification from a hub is signed with. */
const HUB_SECRET_BYTES = 32;

/**
 * Entropy behind the unguessable half of the callback URL. The feed id in front of it is
 * not a secret — it appears in administrative URLs and in logs — so this is the whole of
 * what stops anything that can reach a public endpoint from making this object fetch.
 */
const HUB_TOKEN_BYTES = 32;

/** How long a request to a hub may take, which bounds what one costs a firing alarm. */
const HUB_TIMEOUT_MS = 10_000;

/** What a subscription request is encoded as, which is the only form WebSub defines. */
const HUB_CONTENT_TYPE = "application/x-www-form-urlencoded";

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
	export type RefreshReason = "scheduled" | "manual" | "subscribe" | "websub";

	/** The verification a hub sends before it starts delivering. */
	export interface HubChallenge {
		/** The unguessable half of the callback URL the hub was given. */
		token: string;
		mode: string;
		topic: string;
		/** Echoed back verbatim when all three of token, topic and mode agree. */
		challenge: string;
		leaseSeconds: number;
	}

	/** What the callback needs to judge a delivery, for a caller holding the token. */
	export interface HubCredentials {
		/** The secret the subscription was made with, which every notification is signed with. */
		secret: string;
		feedUrl: string;
	}

	/** What one accepted notification did, for the event the callback records. */
	export interface HubNotice {
		feedUrl: string | null;
		/** Whether the feed was answered from the stored copy rather than fetched again. */
		coalesced: boolean;
		inserted: number;
	}

	export type RefreshResult =
		| { ok: true; status: "ok"; inserted: number; edited: number; head: number }
		| { ok: true; status: "not_modified"; head: number }
		| { ok: false; status: FeedStatus; message: string };

	/** A page of the items above a subscriber's cursor, in the order they were decided. */
	export interface ItemsPage {
		items: Item[];
		/** The feed's head as of this read, which is the truth the hint approximates. */
		head: number;
		/**
		 * What the feed publishes, in posts per day, measured once here and shared by every
		 * subscriber, so nobody has to ask a second time for a number this answer already
		 * holds. `null` before any poll has measured one.
		 */
		postsPerDay: number | null;
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

		await this.#armNext(await this.#pollInterval(feed.posts_per_day, feed));

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

		/**
		 * The grace period is about this app's storage — it exists so a re-follow does not
		 * re-download a feed — and it is no reason to leave somebody else's hub delivering
		 * for a feed nobody reads. The token goes with the subscription, so a hub that keeps
		 * notifying is answered `404` without waking anything.
		 */
		if (feed !== null) {
			await this.#leaveHub(feed, "unfollowed");
			await this.#clearHub("none", null, now);
		}

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
	 * One entry point for every reason a feed is fetched — its own schedule, a reader
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
		 * A backoff holds a schedule, and a publisher's hub, off an origin that has been
		 * failing: a ping cannot fix a 502, and re-fetching a failing origin on somebody
		 * else's schedule is the abuse the backoff exists to prevent. A reader asking on the
		 * spot is the one case it was never meant to hold back: a feed that has been failing
		 * is exactly the one they came here to ask about.
		 */
		if (held(reason) && feed.next_attempt_at !== null && feed.next_attempt_at > now) {
			return { ok: true, status: "not_modified", head: feed.head };
		}

		/**
		 * However many notifications a hub sends, the origin behind it is asked at most once
		 * a minute: a ping decides when to go and look, and looking again at what was just
		 * retrieved answers with what is already stored.
		 */
		if (reason === "websub" && hubCoalesced(feed.last_fetched_at, now)) {
			return { ok: true, status: "not_modified", head: feed.head };
		}

		let outcome = await pollFeed(this.#db, { now });
		let polled = await this.#feedRow();

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
			postsPerDay: polled?.posts_per_day ?? null,
			intervalMs: await this.#pollInterval(feed.posts_per_day, polled),
		});

		if (outcome.status === "not_modified") {
			return { ok: true, status: "not_modified", head: feed.head };
		}

		if (outcome.status !== "ok") {
			return { ok: false, status: outcome.status, message: outcome.message };
		}

		/**
		 * The poll is also the detector, so what it found is judged against what the hub
		 * announced before the document it just served decides the subscription.
		 */
		await this.#countHubMiss(feed, outcome.inserted, now);
		await this.#reconcileHub(feed, outcome.hub, now);

		await pruneItems(this.#db, FEED_RETENTION, outcome.head);

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

		/**
		 * The measured rate rides along with the page a subscriber was already reading, so a
		 * reader keeping their own copy of it costs no call of its own.
		 */
		let feed = await this.#feedRow();

		return {
			items: rows.map(itemOf),
			head: await this.getHead(),
			postsPerDay: feed?.posts_per_day ?? null,
		};
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
		let purged = false;
		let delay = POLL_CEILING_MS;

		try {
			if (!(await this.#hasSubscribers())) {
				await this.#purge();
				purged = true;
				return;
			}

			/**
			 * Read before the poll, because the poll overwrites it: the rate this feed measured
			 * last is what tells a band it is being left for a slower one from a band it is
			 * arriving at, which is the whole of the hysteresis.
			 */
			let previous = await this.#feedRow();
			let now = Date.now();
			let renewing = this.#renewalDue(previous, now);

			/**
			 * First, because a renewal is one request against a hub and a poll may spend ten
			 * seconds against a slow origin. The two fail for different reasons about different
			 * hosts, so neither defers the other.
			 */
			if (renewing && previous !== null) await this.#renewHub(previous, now);

			if (await this.#pollDue(previous, renewing, now)) {
				let outcome = await this.refresh("scheduled");
				delay = await this.#nextPollDelay(outcome, previous?.posts_per_day ?? null);
			} else {
				delay = await this.#untilNextPoll(previous, now);
			}
		} catch (error) {
			console.error("feed poll alarm failed", error);
		} finally {
			if (!purged) await this.#armNext(delay).catch(() => undefined);
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

		let feed = (await this.#feedRow()) ?? created;

		/**
		 * The first fetch is also the first look for a hub, so a feed that advertises one is
		 * subscribed to from the moment it is followed rather than at its second poll.
		 */
		if (outcome.status === "ok") await this.#reconcileHub(created, outcome.hub, now);

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
	 * A feed that is failing is retried when its own backoff lifts, and the backoff is a
	 * floor on that wait rather than a ceiling: the band is a claim about what a feed
	 * publishes, and an origin that is not answering is publishing nothing this system can
	 * see, so the backoff wins for as long as it is the longer of the two.
	 *
	 * @param outcome - What the poll that just ran reported.
	 * @param previousRate - The rate this feed measured before that poll overwrote it.
	 */
	async #nextPollDelay(
		outcome: FeedStore.RefreshResult,
		previousRate: number | null,
	): Promise<number> {
		let feed = await this.#feedRow();
		let waiting = feed?.next_attempt_at ?? null;
		let now = Date.now();
		let interval = await this.#pollInterval(previousRate, feed);

		if (waiting !== null && waiting > now) return Math.max(waiting - now, interval);

		return outcome.ok ? interval : CATCH_UP_MS;
	}

	/**
	 * How long this feed waits between polls, derived from what it has been publishing and
	 * scaled by a rule that may slow the whole system without losing the shape of the table.
	 *
	 * The subject is the feed itself, because that is what the question is about: how often
	 * a document is worth fetching is a fact about the document, and every subscriber of it
	 * is served by the one answer.
	 *
	 * @param previousRate - The rate measured before this poll, which supplies the hysteresis.
	 * @param feed - The feed's row as it now stands, or `null` for an object with no document.
	 */
	async #pollInterval(previousRate: number | null, feed: SelectFeed | null): Promise<number> {
		if (feed === null) return POLL_CEILING_MS;

		let client = await flagsFor(this.#feedId());
		let multiplier = await client.get(features.feedPollMultiplier);
		let band = pollIntervalFor(previousRate, feed.posts_per_day, feed.created_at, Date.now());
		let interval = Math.max(POLL_FLOOR_MS, band * Math.max(0, multiplier));

		/**
		 * A working subscription caps the cadence rather than replacing it. The hub already
		 * covers the fast case, so polling a firehose underneath one pays twice for a single
		 * freshness; for a quiet feed the band is already longer and the floor does nothing.
		 */
		if (feed.hub_state === "active") return Math.max(interval, HUB_POLL_FLOOR_MS);

		return interval;
	}

	/** Arms the poll, holding whatever alarm is already set unless this one is sooner. */
	async #armPoll(delay: number = POLL_CEILING_MS): Promise<void> {
		let next = Date.now() + delay;
		let armed = await this.ctx.storage.getAlarm();

		if (armed !== null && armed <= next) return;

		await this.ctx.storage.setAlarm(next);
	}

	/**
	 * The secret one notification must be signed with, for the caller holding the token
	 * half of the callback URL.
	 *
	 * The comparison is constant-time and a wrong token answers with nothing at all, so a
	 * caller probing the endpoint learns the same thing whatever it sends.
	 *
	 * @param token - The second segment of the callback URL the request arrived on.
	 */
	async hubSecretFor(token: string): Promise<FeedStore.HubCredentials | null> {
		let feed = await this.#feedRow();
		if (feed === null || feed.hub_token === null || feed.hub_secret === null) return null;
		if (!timingSafeEqual(feed.hub_token, token)) return null;

		return { secret: feed.hub_secret, feedUrl: feed.feed_url };
	}

	/**
	 * Answers a hub's verification, echoing the challenge only when the token, the topic
	 * and a subscription this object is waiting on all agree.
	 *
	 * That three-way agreement is the defence against being enrolled in somebody else's
	 * topic: a hub asked to deliver a feed this app never subscribed to is told nothing it
	 * can act on, whichever of the three it got wrong.
	 *
	 * @param input - What the hub's verification request carried.
	 * @returns The challenge to echo, or `null` for a subscription this object never made.
	 */
	async verifyHub(input: FeedStore.HubChallenge): Promise<string | null> {
		let feed = await this.#feedRow();
		if (feed === null || feed.hub_token === null) return null;
		if (!timingSafeEqual(feed.hub_token, input.token)) return null;
		if (input.mode !== "subscribe") return null;
		if (feed.hub_state !== "pending") return null;
		if (feed.hub_topic === null || feed.hub_topic !== input.topic) return null;

		let now = Date.now();
		let lease = input.leaseSeconds > 0 ? input.leaseSeconds : HUB_LEASE_SECONDS;

		/**
		 * The lease stored is the one the hub reported rather than the one this app asked
		 * for, since the hub is what decides when it stops delivering.
		 */
		await this.#db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{ hub_state: "active", hub_lease_until: now + lease * 1000, hub_misses: 0, updated_at: now },
		);

		await this.#armNext(await this.#untilNextPoll(await this.#feedRow(), now));

		return input.challenge;
	}

	/**
	 * Records one accepted notification and goes and looks.
	 *
	 * A valid signature buys a fetch rather than a write: nothing from the delivery is
	 * parsed, diffed or stored, so a hub that has been compromised cannot put a headline in
	 * anybody's timeline — it can only decide when this object retrieves the feed from the
	 * publisher's own origin.
	 */
	async notified(): Promise<FeedStore.HubNotice> {
		let now = Date.now();
		let feed = await this.#feedRow();
		if (feed === null) return { feedUrl: null, coalesced: false, inserted: 0 };

		let counted =
			feed.hub_notified_at !== null && now - feed.hub_notified_at < HUB_NOTIFICATION_WINDOW_MS
				? feed.hub_notifications
				: 0;
		let notifications = counted + 1;

		await this.#db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{
				hub_notified_at: now,
				hub_notifications: notifications,
				hub_misses: 0,
				updated_at: now,
			},
		);

		/**
		 * Each notification is a Worker request and an object wake, so a hub delivering more
		 * in a day than the feed could plausibly publish costs more than polling it outright.
		 * Past the threshold the subscription is dropped and the poller has the feed back.
		 */
		if (notifications > HUB_DAILY_NOTIFICATION_LIMIT) {
			await this.#demoteHub(feed, now, feed.hub_misses, notifications);
			return { feedUrl: feed.feed_url, coalesced: false, inserted: 0 };
		}

		let coalesced = hubCoalesced(feed.last_fetched_at, now);
		let outcome = await this.refresh("websub");

		return {
			feedUrl: feed.feed_url,
			coalesced,
			inserted: outcome.ok && outcome.status === "ok" ? outcome.inserted : 0,
		};
	}

	/**
	 * Decides what the document just served means for the subscription this feed holds.
	 *
	 * The hub is read on every poll rather than once, because a publisher adds one and
	 * drops one and the answer held has to be the one their current document gives.
	 *
	 * @param before - The feed's row as it stood before the poll overwrote it.
	 * @param advert - The hub the document advertises, absent when it advertises none.
	 * @param now - Epoch milliseconds the poll ran at.
	 */
	async #reconcileHub(before: SelectFeed, advert: HubAdvert | null, now: number): Promise<void> {
		let state = before.hub_state;
		let held = state === "active" || state === "pending";

		/**
		 * A topic on another origin is a document either broken or speaking for a feed this
		 * app did not retrieve from them, and the cost of declining is that the feed polls.
		 */
		if (advert === null || advert.topic === null) {
			if (held) {
				await this.#leaveHub(before, advert === null ? "withdrawn" : "foreign-topic");
				await this.#clearHub("none", null, now);
			}

			return;
		}

		if (advert.url === before.hub_url) {
			if (state === "active") return;

			/**
			 * A demoted hub is left alone until the cool-off runs out, which is what stops one
			 * that verifies and never delivers from being subscribed to on every poll forever.
			 */
			if (state === "failed" && before.hub_lease_until !== null && now < before.hub_lease_until) {
				return;
			}
		} else if (held) {
			await this.#leaveHub(before, "replaced");
		}

		await this.#subscribeHub(
			before,
			{ url: advert.url, topic: advert.topic, source: advert.source },
			now,
			false,
		);
	}

	/**
	 * Registers this feed's callback with a hub and waits for the verification.
	 *
	 * The row moves to `pending` before the request goes out, because a hub may call the
	 * verification callback before the subscription request returns. A request the hub
	 * refuses leaves no subscription at all, and the next poll that still sees a hub tries
	 * again.
	 *
	 * @param feed - The feed's row, for the address the events are recorded against.
	 * @param advert - The hub to register with and the topic to register under.
	 * @param now - Epoch milliseconds the request is made at.
	 * @param renewal - Whether this replaces a lease rather than starting one.
	 */
	async #subscribeHub(
		feed: SelectFeed,
		hub: { url: string; topic: string; source: HubAdvert["source"] },
		now: number,
		renewal: boolean,
	): Promise<void> {
		let secret = randomToken({ bytes: HUB_SECRET_BYTES });
		let token = randomToken({ bytes: HUB_TOKEN_BYTES });

		await this.#db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{
				hub_url: hub.url,
				hub_topic: hub.topic,
				hub_state: "pending",
				hub_secret: secret,
				hub_token: token,
				hub_lease_until: null,
				hub_misses: 0,
				updated_at: now,
			},
		);

		if (!renewal) {
			this.#record("job", {
				event: "feed.hub.discovered",
				feedUrl: feed.feed_url,
				hubUrl: hub.url,
				source: hub.source,
			});
		}

		let sent = await this.#askHub(hub.url, {
			"hub.mode": "subscribe",
			"hub.topic": hub.topic,
			"hub.callback": this.#callbackUrl(token),
			"hub.secret": secret,
			"hub.lease_seconds": String(HUB_LEASE_SECONDS),
		});

		if (!sent) {
			await this.#clearHub("none", hub.url, now);
			return;
		}

		this.#record("job", {
			event: "feed.hub.subscribed",
			feedUrl: feed.feed_url,
			hubUrl: hub.url,
			topic: hub.topic,
			renewal,
		});
	}

	/**
	 * Replaces the lease before it lapses, with a fresh secret and a fresh token.
	 *
	 * A lapse is not an incident — the feed is already polling and the next poll that still
	 * sees a hub subscribes again — so a renewal that fails costs the subscription and
	 * nothing else.
	 *
	 * @param feed - The feed's row, which carries the hub and the topic to renew under.
	 * @param now - Epoch milliseconds the renewal is sent at.
	 */
	async #renewHub(feed: SelectFeed, now: number): Promise<void> {
		if (feed.hub_url === null || feed.hub_topic === null) return;

		await this.#subscribeHub(
			feed,
			{ url: feed.hub_url, topic: feed.hub_topic, source: "document" },
			now,
			true,
		);
	}

	/**
	 * Tells a hub to stop delivering. It reports nothing back: the subscription is being
	 * abandoned either way, and a hub that keeps notifying is answered by a callback whose
	 * token has already gone.
	 *
	 * @param feed - The feed's row as it stood while the subscription was held.
	 * @param reason - What ended it, which is what the event is read by.
	 */
	async #leaveHub(feed: SelectFeed, reason: string): Promise<void> {
		if (feed.hub_url === null || feed.hub_topic === null || feed.hub_token === null) return;

		await this.#askHub(feed.hub_url, {
			"hub.mode": "unsubscribe",
			"hub.topic": feed.hub_topic,
			"hub.callback": this.#callbackUrl(feed.hub_token),
		});

		this.#record("job", {
			event: "feed.hub.unsubscribed",
			feedUrl: feed.feed_url,
			reason,
		});
	}

	/**
	 * Drops a hub that is not working and leaves the feed to the poller, holding it off
	 * until the cool-off runs out or the document advertises a different one.
	 *
	 * @param feed - The feed's row as it stood while the subscription was held.
	 * @param now - Epoch milliseconds the demotion is decided at.
	 * @param misses - Polls that found items the hub never announced.
	 * @param notifications - Notifications accepted inside the current day.
	 */
	async #demoteHub(
		feed: SelectFeed,
		now: number,
		misses: number,
		notifications: number,
	): Promise<void> {
		await this.#leaveHub(feed, "demoted");
		await this.#clearHub("failed", feed.hub_url, now);

		this.#record("job", {
			event: "feed.hub.demoted",
			feedUrl: feed.feed_url,
			misses,
			notifications,
		});
	}

	/**
	 * Counts a poll that found items no notification announced, and demotes the hub on the
	 * third of them in a row.
	 *
	 * A hub that verifies happily and then delivers nothing is the commonest way this is
	 * quietly not working, and there is no error, status or callback that says so: the
	 * fallback poll is the only thing that can see it, which is why it is not optional.
	 *
	 * @param before - The feed's row as it stood before the poll overwrote it.
	 * @param inserted - Items that poll stored.
	 * @param now - Epoch milliseconds the poll ran at.
	 */
	async #countHubMiss(before: SelectFeed, inserted: number, now: number): Promise<void> {
		if (before.hub_state !== "active" || inserted === 0) return;

		let announced =
			before.hub_notified_at !== null && before.hub_notified_at >= (before.last_fetched_at ?? 0);
		if (announced) return;

		let misses = before.hub_misses + 1;

		if (misses < HUB_MISS_LIMIT) {
			await this.#db.update(
				feedTable,
				{ id: FEED_ROW_ID },
				{ hub_misses: misses, updated_at: now },
			);
			return;
		}

		await this.#demoteHub(before, now, misses, before.hub_notifications);
	}

	/**
	 * Writes the subscription columns back to a state that holds no subscription, keeping
	 * the hub the document advertises so a demotion can tell a new one from the old.
	 *
	 * @param state - What the feed's subscription now is.
	 * @param hubUrl - The hub the document advertises, or `null` where it advertises none.
	 * @param now - Epoch milliseconds the change is written at.
	 */
	async #clearHub(state: "none" | "failed", hubUrl: string | null, now: number): Promise<void> {
		await this.#db.update(
			feedTable,
			{ id: FEED_ROW_ID },
			{
				hub_url: hubUrl,
				hub_topic: null,
				hub_state: state,
				hub_secret: null,
				hub_token: null,
				hub_lease_until: state === "failed" ? now + HUB_COOLOFF_MS : null,
				hub_misses: 0,
				updated_at: now,
			},
		);
	}

	/**
	 * Sends one WebSub request and reports whether the hub accepted it.
	 *
	 * @param hubUrl - The hub to ask.
	 * @param body - The `hub.*` fields, which WebSub defines only as a form encoding.
	 */
	async #askHub(hubUrl: string, body: Record<string, string>): Promise<boolean> {
		try {
			let response = await fetch(hubUrl, {
				method: "POST",
				headers: { "content-type": HUB_CONTENT_TYPE },
				body: new URLSearchParams(body).toString(),
				signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
			});

			return response.ok;
		} catch {
			return false;
		}
	}

	/** The address this feed's hub delivers to, which the token is the unguessable half of. */
	#callbackUrl(token: string): string {
		let path = routes.websub.action.href({ feedId: this.#feedId(), token });
		return new URL(path, this.env.PUBLIC_URL).toString();
	}

	/** Whether this feed's lease has reached the point a fresh subscription replaces it. */
	#renewalDue(feed: SelectFeed | null, now: number): boolean {
		if (feed === null || feed.hub_state !== "active" || feed.hub_lease_until === null) return false;
		return hubRenewalAt(feed.hub_lease_until) <= now;
	}

	/** How long until the lease is renewed, or `null` for a feed holding no subscription. */
	async #renewalDelay(): Promise<number | null> {
		let feed = await this.#feedRow();
		if (feed === null || feed.hub_state !== "active" || feed.hub_lease_until === null) return null;
		return Math.max(0, hubRenewalAt(feed.hub_lease_until) - Date.now());
	}

	/**
	 * Whether this firing is one a poll is owed to.
	 *
	 * An alarm with no renewal waiting on it was armed for the poll, so it polls; only a
	 * firing brought forward by a renewal has to ask whether the poll is also due, which is
	 * what keeps a six-hourly feed from being fetched every time its lease comes up.
	 *
	 * @param feed - The feed's row, or `null` for an object with no document.
	 * @param renewing - Whether this firing is also renewing a lease.
	 * @param now - Epoch milliseconds the firing happened at.
	 */
	async #pollDue(feed: SelectFeed | null, renewing: boolean, now: number): Promise<boolean> {
		if (!renewing || feed === null || feed.last_fetched_at === null) return true;

		return now >= feed.last_fetched_at + (await this.#pollInterval(feed.posts_per_day, feed));
	}

	/** How long until the next poll is owed, for a firing that did not run one. */
	async #untilNextPoll(feed: SelectFeed | null, now: number): Promise<number> {
		if (feed === null) return POLL_CEILING_MS;

		let due = (feed.last_fetched_at ?? now) + (await this.#pollInterval(feed.posts_per_day, feed));

		return Math.max(0, Math.max(due, feed.next_attempt_at ?? 0) - now);
	}

	/**
	 * Arms the object's single alarm at the earliest of the next poll and the next renewal.
	 *
	 * The two are armed one after the other because arming never lengthens a wait: whichever
	 * comes first is what the alarm holds, and the firing works out for itself which of its
	 * jobs are owed.
	 *
	 * @param pollDelay - How long until the next poll is owed.
	 */
	async #armNext(pollDelay: number): Promise<void> {
		await this.#armPoll(pollDelay);

		let renewal = await this.#renewalDelay();
		if (renewal !== null) await this.#armPoll(renewal);
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

/**
 * Whether a reason is one the failure backoff holds back. A person waiting behind a check
 * is the only caller it was never meant to hold, and a fresh subscription has no stored
 * document to answer from.
 */
function held(reason: FeedStore.RefreshReason): boolean {
	return reason === "scheduled" || reason === "websub";
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
