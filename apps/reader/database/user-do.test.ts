/**
 * Drives the reader's Durable Object by construction, against real SQLite, a real feed
 * object behind the `FEED` binding, a real KV namespace holding the heads and a real
 * catalog behind `PLATFORM_DB` — the bindings are this repo's own mocks, so the feed a
 * reader synchronizes from is the class that answers in production rather than a stand-in
 * for it, and every head the reader compares against was published by that class.
 *
 * What is asserted here is the half of the split this object owns: that staleness is
 * derived from two numbers rather than stored, that the cursor only ever lands on a
 * revision this object wrote, that a timeline read reaches nothing at all, and that the
 * two rules allowed to delete a post are the reader's own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import {
	createD1Database,
	createDurableObjectNamespace,
	createDurableObjectState,
	createKVNamespace,
} from "@sdxc/cloudflare-mocks";
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { FeedStore } from "~/database/feed-do";
import type { Velocity } from "~/database/schema";
import type { UserStore } from "~/database/user-do";

import { FLAG_SET, flags } from "~/app/lib/flags";
import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { FeedDO } from "~/database/feed-do";
import { headKey } from "~/database/feed-head";
import { TIER_BUDGETS, TIER_SAVED_LIMITS } from "~/database/schema";
import { UserDO } from "~/database/user-do";

/**
 * The bindings the modules under test read off `cloudflare:workers`. The stub the test
 * project installs answers every binding with a placeholder string, which is enough for a
 * module that never reaches one and nothing like enough here: the reader reads heads out
 * of KV, names feed objects through `FEED` and exchanges a URL for an id through D1.
 *
 * Held behind a hoisted box so each test gets its own namespaces while the `env` every
 * module already captured stays the same object.
 */
let bindings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();

	return {
		...original,
		env: new Proxy(
			{},
			{
				get(_target, property: string) {
					return bindings.current[property] ?? `test-${property}`;
				},
			},
		),
	};
});

/**
 * Narrows the reader's budget, through the flag that now carries it.
 *
 * The shipped figure is a million posts, and materializing a million rows would test the
 * number rather than the rule. Every test that narrows it says what it is standing in
 * for, and the rule under test — reclaim only while over budget, only from feeds over
 * their share, and only what the reader has read — is the same rule at either figure.
 *
 * It is moved by serving a different definition rather than by mocking the constant, so
 * these tests walk the path the object walks: the flag is read, and what it answers is
 * what the sweep is held to.
 *
 * The readers here are on the free tier, so the figure is served as the fraction of that
 * tier's budget it comes to: the object multiplies the tier's number by what the flag
 * answers, which is the arithmetic the sweep does in production.
 *
 * @param posts - What the object may hold before it reclaims, and then refuses.
 */
async function setBudget(posts: number): Promise<void> {
	await flags.setProvider(
		new EngineProvider(
			createEngine({
				store: new InMemoryFlagStore({
					flags: {
						...FLAG_SET.flags,
						"reader-budget-scale": {
							variants: { standard: posts / TIER_BUDGETS.free },
							defaultVariant: "standard",
						},
					},
				}),
			}),
		),
	);
}

const SUBJECT = "sub-1";
const FEED_URL = "https://example.com/feed.xml";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** One entry of the RSS document an origin serves. */
interface Entry {
	guid: string;
	title: string;
	published: string;
}

/** Three posts a day apart, newest last, which is the document most tests start from. */
const ENTRIES: Entry[] = [
	{ guid: "a", title: "First", published: "Mon, 01 Sep 2025 10:00:00 GMT" },
	{ guid: "b", title: "Second", published: "Tue, 02 Sep 2025 10:00:00 GMT" },
	{ guid: "c", title: "Third", published: "Wed, 03 Sep 2025 10:00:00 GMT" },
];

/**
 * An entry published a given while ago, for the rules measured from `published_at`.
 *
 * @param guid - What identifies the entry within its feed.
 * @param title - What a timeline row would read.
 * @param agoMs - How long before now the world saw it.
 */
function entryAt(guid: string, title: string, agoMs: number): Entry {
	return { guid, title, published: new Date(Date.now() - agoMs).toUTCString() };
}

/** Builds the RSS 2.0 document an origin answers with. */
function rss(entries: Entry[], title = "Example"): string {
	let body = entries
		.map(
			(entry) =>
				`<item><guid isPermaLink="false">${entry.guid}</guid><title>${entry.title}</title>` +
				`<link>https://example.com/${entry.guid}</link>` +
				`<pubDate>${entry.published}</pubDate><description>About ${entry.title}</description>` +
				`</item>`,
		)
		.join("");

	return (
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<rss version="2.0"><channel>` +
		`<title>${title}</title><link>https://example.com</link>` +
		`<description>An example feed</description>${body}</channel></rss>`
	);
}

/**
 * The feed objects this run has built, one per canonical feed id, so the second reader of
 * a feed reaches the object the first one created — which is the whole point of naming it
 * after the feed.
 */
let feedObjects = new Map<string, Promise<FeedDO>>();

/** The storage behind each of them, so a test can stand a head an item never reached. */
let feedStates = new Map<string, DurableObjectStateMock>();

/** Every call the reader made to a feed object, which is what "reaches nothing" reads off. */
let feedCalls: { feedId: string; method: string; args: unknown[] }[] = [];

/** Every statement the catalog was asked to run, for the read path that must run none. */
let catalogQueries: string[] = [];

/**
 * Which page read of a run fails, counted across the run, so a test can stand a feed
 * object dying between two pages of a synchronization. Zero fails none.
 */
let pageFault = { reads: 0, failOn: 0 };

/** The feed object one id names, built on first use the way the platform builds one. */
async function feedObject(feedId: string): Promise<FeedDO> {
	let existing = feedObjects.get(feedId);
	if (existing !== undefined) return await existing;

	let built = (async () => {
		let state = createDurableObjectState({ name: feedId });
		feedStates.set(feedId, state);
		let feed = new FeedDO(state, env);

		// The runtime holds every request behind the constructor's gate; a test that calls
		// methods directly takes its own turn at it to stand where a request would.
		await state.blockConcurrencyWhile(async () => undefined);

		return feed;
	})();

	feedObjects.set(feedId, built);

	return await built;
}

/**
 * The object the `FEED` binding hands back, which records what was asked of it and then
 * asks the real feed object. The behaviour under it is the shipped class; what is added
 * is the log, since "no feed object was paged" is not a fact a real stub reports.
 */
function feedStub(feedId: string) {
	return {
		async subscribe(userId: string, feedUrl: string): Promise<FeedStore.SubscribeResult> {
			feedCalls.push({ feedId, method: "subscribe", args: [userId, feedUrl] });
			return await (await feedObject(feedId)).subscribe(userId, feedUrl);
		},

		async unsubscribe(userId: string): Promise<FeedStore.UnsubscribeResult> {
			feedCalls.push({ feedId, method: "unsubscribe", args: [userId] });
			return await (await feedObject(feedId)).unsubscribe(userId);
		},

		async refresh(reason: FeedStore.RefreshReason): Promise<FeedStore.RefreshResult> {
			feedCalls.push({ feedId, method: "refresh", args: [reason] });
			return await (await feedObject(feedId)).refresh(reason);
		},

		async getHead(): Promise<number> {
			feedCalls.push({ feedId, method: "getHead", args: [] });
			return await (await feedObject(feedId)).getHead();
		},

		async getItemsAfter(cursor: number, limit?: number): Promise<FeedStore.ItemsPage> {
			feedCalls.push({ feedId, method: "getItemsAfter", args: [cursor, limit] });

			pageFault.reads += 1;
			if (pageFault.failOn === pageFault.reads) {
				throw new Error("the feed object died between two pages");
			}

			return await (await feedObject(feedId)).getItemsAfter(cursor, limit);
		},
	};
}

/** The catalog, wrapped so a test can say the read path ran no statement against it. */
function countingCatalog(catalog: D1Database): D1Database {
	return new Proxy(catalog, {
		get(target, property) {
			if (property === "prepare" || property === "exec" || property === "batch") {
				catalogQueries.push(String(property));
			}

			return Reflect.get(target, property) as unknown;
		},
	});
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	feedObjects.clear();
	feedStates.clear();
	feedCalls.length = 0;
	catalogQueries.length = 0;
	pageFault = { reads: 0, failOn: 0 };
	await setBudget(TIER_BUDGETS.free);

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: createKVNamespace(),
		PLATFORM_DB: countingCatalog(catalog),
		FEED: createDurableObjectNamespace<FeedDO>((feedId) => feedStub(feedId)),
	};

	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(ENTRIES))));
});

/** Builds a reader's object and waits out the boot, the way a first request would. */
async function createReader(
	subject = SUBJECT,
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	// Named the way `getByName` names a real object, because the object provisions its own
	// settings row from the name it was addressed by rather than from a passed argument.
	let state = createDurableObjectState({ name: subject });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	return { state, user };
}

/** Serves a document at one origin and follows it, which is where most tests start. */
async function follow(
	user: UserDO,
	url = FEED_URL,
	entries: Entry[] = ENTRIES,
): Promise<UserStore.FeedSummary> {
	server.use(http.get(url, () => HttpResponse.xml(rss(entries, url))));

	let followed = await user.followFeed(url);
	if (!followed.ok) throw new Error(`following ${url} failed: ${followed.reason}`);

	return followed.feed;
}

/**
 * Publishes a new document at one origin and polls the feed object for it, which is what
 * moves that feed's head and gives the readers of it something above their cursor.
 *
 * Called on the object rather than through the binding, since what a publisher does is
 * not something the reader under test asked for.
 */
async function publish(feed: UserStore.FeedSummary, entries: Entry[]): Promise<void> {
	server.use(http.get(feed.feedUrl, () => HttpResponse.xml(rss(entries, feed.feedUrl))));

	let refreshed = await (await feedObject(feed.feedId)).refresh("manual");
	if (!refreshed.ok) throw new Error(`publishing to ${feed.feedUrl} failed: ${refreshed.status}`);
}

/** One subscription row, written straight into storage for a test that follows nothing. */
function seedFeed(
	state: DurableObjectStateMock,
	seed: {
		id: string;
		feedId?: string;
		velocity?: Velocity;
		cursor?: number;
		unfollowedAt?: number | null;
	},
): string {
	state.storage.sql.exec(
		`INSERT INTO feeds
			(id, feed_id, feed_url, site_url, title, description, language, image_url,
			 cursor, velocity, unfollowed_at, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?, ?, 0, 0)`,
		seed.id,
		seed.feedId ?? `feed_${seed.id}`,
		`https://${seed.id}.example.com/feed.xml`,
		seed.id,
		seed.cursor ?? 0,
		seed.velocity ?? "evergreen",
		seed.unfollowedAt ?? null,
	);

	return seed.id;
}

/** Posts of one subscription, written straight into storage. */
function seedItems(
	state: DurableObjectStateMock,
	subscriptionId: string,
	posts: readonly { id: string; publishedAt: number; readAt?: number; savedAt?: number }[],
): void {
	for (let post of posts) {
		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, 0, 0)`,
			post.id,
			subscriptionId,
			post.id,
			post.id,
			post.publishedAt,
			post.readAt ?? null,
			post.savedAt ?? null,
		);
	}
}

/** The ids of what one subscription still holds, oldest first. */
function storedItems(state: DurableObjectStateMock, subscriptionId?: string): string[] {
	let rows =
		subscriptionId === undefined
			? state.storage.sql
					.exec<{ id: string }>("SELECT id FROM feed_items ORDER BY published_at, id")
					.toArray()
			: state.storage.sql
					.exec<{ id: string }>(
						"SELECT id FROM feed_items WHERE feed_id = ? ORDER BY published_at, id",
						subscriptionId,
					)
					.toArray();

	return rows.map((row) => row.id);
}

/** What one subscription has ruled on, read straight off the row. */
function storedCursor(state: DurableObjectStateMock, subscriptionId: string): number {
	let [row] = state.storage.sql
		.exec("SELECT cursor FROM feeds WHERE id = ?", subscriptionId)
		.toArray();

	return Number(row?.["cursor"]);
}

/** The titles of a page, which is what ordering assertions compare. */
function titles(result: UserStore.TimelineResult): string[] {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	return result.items.map((item) => item.title);
}

/** Every call the reader made to a feed object, as `feedId:method`. */
function calls(method?: string): string[] {
	return feedCalls
		.filter((call) => method === undefined || call.method === method)
		.map((call) => `${call.feedId}:${call.method}`);
}

describe("what a reader is allowed to paste", () => {
	/**
	 * A subscribe button hands out `feed://…`, and both spellings of it. The scheme says
	 * the thing behind it is a feed rather than how to fetch one, so a reader who clicked
	 * such a button and pasted what they got is holding the address they meant.
	 */
	test("reads a feed:// address as the feed it points at", async () => {
		let { user } = await createReader();

		server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(ENTRIES, FEED_URL))));

		let followed = await user.followFeed(FEED_URL.replace("https://", "feed://"));
		expect(followed.ok).toBe(true);

		// And it is the same subscription the plain address names, not a second one.
		let again = await user.followFeed(FEED_URL);
		expect(again).toMatchObject({ ok: false, reason: "already-following" });
	});

	test("reads the wrapped spelling the same way", async () => {
		let { user } = await createReader();

		server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(ENTRIES, FEED_URL))));

		let followed = await user.followFeed(`feed:${FEED_URL}`);
		expect(followed.ok).toBe(true);
	});

	test("refuses a scheme nothing can fetch, rather than guessing at one", async () => {
		let { user } = await createReader();

		let followed = await user.followFeed("gopher://example.com/feed");
		expect(followed).toMatchObject({ ok: false, reason: "invalid-url" });
	});
});

describe("what a new subscription starts with", () => {
	/**
	 * A feed numbers its entries in the order it discovered them, which is the order the
	 * document listed them in, so whether the newest page carries the highest revisions or
	 * the lowest is a decision the publisher made rather than one this app can rely on.
	 * Starting at the head is what makes a subscription mean one thing either way.
	 */
	test("starts current whichever end of its document a publisher lists first", async () => {
		let newest = [
			entryAt("n-1", "Newest", HOUR_MS),
			entryAt("n-2", "Middle", DAY_MS),
			entryAt("n-3", "Oldest", 7 * DAY_MS),
		];

		let first = await createReader("newest-first");
		let feed = await follow(first.user, FEED_URL, newest);

		let second = await createReader("oldest-first");
		let mirrored = await follow(
			second.user,
			"https://mirror.example.com/feed.xml",
			[...newest].reverse(),
		);

		expect(storedCursor(first.state, feed.id)).toBe(3);
		expect(storedCursor(second.state, mirrored.id)).toBe(3);

		// Both readers hold the same three posts, and neither is owed anything.
		expect(storedItems(first.state, feed.id)).toHaveLength(3);
		expect(storedItems(second.state, mirrored.id)).toHaveLength(3);
		expect((await first.user.openReader()).freshness).toEqual({ stale: [], count: 0 });
		expect((await second.user.openReader()).freshness).toEqual({ stale: [], count: 0 });
	});

	test("takes what the feed publishes next, having taken none of its archive", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user, FEED_URL, [entryAt("a-1", "First", DAY_MS)]);

		await publish(feed, [entryAt("a-2", "Second", HOUR_MS), entryAt("a-1", "First", DAY_MS)]);

		expect((await user.openReader()).freshness).toEqual({ stale: [feed.id], count: 1 });

		await user.synchronize();

		expect(storedItems(state, feed.id)).toHaveLength(2);
	});
});

describe("staleness, derived from two numbers rather than stored", () => {
	test("reads a cursor below the published head as stale, and one level with it as current", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		// Following leaves the cursor on the greatest revision it stored, which is the head
		// the object published, so the reader is current without anything being marked.
		expect(await user.openReader()).toMatchObject({ freshness: { stale: [], count: 0 } });

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS)]);

		let opened = await user.openReader();
		expect(opened.freshness).toEqual({ stale: [feed.id], count: 1 });

		// What the check reports is what the controller hands back for synchronizing, so the
		// two name a subscription the same way.
		await user.synchronize(opened.freshness.stale);

		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
	});

	test("leaves a reader current when the published head lags the feed, and finds the work on the next check", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS)]);

		// KV is eventually consistent, so a reader can read a head the feed has already moved
		// past. Rolling the key back by hand is that read, and the items are all still in the
		// feed's object waiting for the check that does see it.
		await env.KV.put(headKey(feed.feedId), "3");

		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
		expect(storedItems(state, feed.id)).toHaveLength(3);

		await env.KV.put(headKey(feed.feedId), "4");

		expect((await user.openReader()).freshness).toEqual({ stale: [feed.id], count: 1 });

		await user.synchronize();

		expect(storedItems(state, feed.id)).toHaveLength(4);
	});

	test("leaves a reader current when the feed has published no head at all", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS)]);
		await env.KV.delete(headKey(feed.feedId));

		// An absent key means "no reason to go and look". Reading it as stale would turn an
		// empty or cold namespace into a full synchronization for every reader on every
		// request, which is a stampede set off by the failure of a hint.
		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });

		feedCalls.length = 0;
		await user.synchronize();

		expect(calls("getItemsAfter")).toEqual([]);
		expect(storedItems(state, feed.id)).toHaveLength(3);
	});

	test("leaves a reader on a cold namespace current, where every cursor is still zero", async () => {
		let { user, state } = await createReader();

		seedFeed(state, { id: "feed_cold", cursor: 0 });

		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
	});

	test("neither reads a head for an unfollowed feed nor synchronizes it", async () => {
		let { user } = await createReader();
		let kept = await follow(user);
		let left = await follow(user, "https://other.example.com/feed.xml");

		let page = await user.feedTimeline(left.id);
		if (!page.ok) throw new Error(page.reason);

		let saved = page.items[0];
		if (saved === undefined) throw new Error("expected a post to keep");

		// A feed with a saved post in it keeps its row, marked as no longer followed, which
		// is the row that must not be read from KV or synchronized again.
		expect(await user.saveItem(saved.id)).toEqual({ ok: true, saved: true });
		expect(await user.unfollowFeed(left.id)).toBe(true);

		await publish(kept, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS)]);
		await env.KV.put(headKey(left.feedId), "99");

		let reads = vi.spyOn(env.KV, "get");
		feedCalls.length = 0;

		let opened = await user.openReader();

		expect(opened.freshness).toEqual({ stale: [kept.id], count: 1 });
		expect(reads.mock.calls.flat().flat()).not.toContain(headKey(left.feedId));

		await user.synchronize();

		expect(calls("getItemsAfter")).toEqual([`${kept.feedId}:getItemsAfter`]);
	});
});

describe("opening the reader", () => {
	test("pages a timeline without reaching any feed object", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS)]);

		let namespace = bindings.current["FEED"];
		if (!isNamespaceMock(namespace)) throw new Error("expected the FEED binding's log");

		feedCalls.length = 0;
		let resolved = namespace.resolutions.length;

		await user.readingQueue({ readState: "all" });
		await user.feedTimeline(feed.id);
		await user.savedQueue();

		// Paging a frame is not opening the reader: `lazy-frame` fetches enough pages that a
		// round trip per page would be a cost with no reader-visible effect.
		expect(feedCalls).toEqual([]);
		expect(namespace.resolutions).toHaveLength(resolved);
	});

	test("answers with its page and the staleness beside it, and synchronizes nothing", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);

		await publish(feed, [entryAt("d", "Fourth", HOUR_MS), ...ENTRIES]);

		feedCalls.length = 0;

		let opened = await user.openReader({ readState: "all" });

		expect(titles(opened.timeline)).toEqual(["Third", "Second", "First"]);
		expect(opened.freshness).toEqual({ stale: [feed.id], count: 1 });

		// A count, never a promise of fresher posts: the page was read out of local storage
		// before the staleness beside it was known.
		expect(calls("getItemsAfter")).toEqual([]);
		expect(storedItems(state, feed.id)).toHaveLength(3);
	});

	test("reads two hundred and fifty subscriptions' heads in three bulk reads rather than two hundred and fifty gets", async () => {
		let { user, state } = await createReader();

		// Written straight into storage: what is under test is the shape of the read, and
		// following two hundred and fifty origins would test the follow path instead.
		for (let index = 0; index < 250; index += 1) {
			seedFeed(state, { id: `feed_bulk_${index}`, cursor: 0 });
		}

		await env.KV.put(headKey("feed_feed_bulk_7"), "4");
		await env.KV.put(headKey("feed_feed_bulk_180"), "9");

		let reads = vi.spyOn(env.KV, "get");

		let opened = await user.openReader();

		expect(opened.freshness.count).toBe(2);
		expect(reads).toHaveBeenCalledTimes(3);

		let keys = reads.mock.calls.map(([argument]) => argument);

		for (let batch of keys) {
			expect(Array.isArray(batch)).toBe(true);
			expect(batch.length).toBeLessThanOrEqual(100);
		}

		expect(keys.flat()).toHaveLength(250);
	});

	test("issues no catalog statement for a timeline, a frame, a freshness check or a mark-read", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		let page = await user.feedTimeline(feed.id);
		if (!page.ok) throw new Error(page.reason);
		let post = page.items[0];
		if (post === undefined) throw new Error("expected a post");

		// The follow path is the one that exchanges a URL for an id, so the count starts
		// after it: a subscription stores that id, and nothing that renders a page looks it
		// up again.
		catalogQueries.length = 0;

		await user.openReader();
		await user.readingQueue({ readState: "all" });
		await user.feedTimeline(feed.id);
		await user.savedQueue();
		await user.listFeeds();
		await user.getFeed(feed.id);
		await user.markRead(post.id);
		await user.markFeedRead(feed.id);
		await user.markAllRead();

		expect(catalogQueries).toEqual([]);
	});
});

describe("synchronizing a stale feed", () => {
	test("asks the feed only for the revisions above its cursor", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS), entryAt("e", "Fifth", 1000)]);

		feedCalls.length = 0;
		await user.synchronize();

		let pages = feedCalls.filter((call) => call.method === "getItemsAfter");

		expect(pages).toHaveLength(1);
		expect(pages[0]?.args[0]).toBe(3);
	});

	test("advances the cursor to the greatest revision it persisted, never to the published head", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", HOUR_MS), entryAt("e", "Fifth", 1000)]);

		// A head the feed never reached, which is what an assignment of `cursor = kvHead`
		// would swallow: every later check would read as current because the comparison it
		// feeds would be satisfied by the number it was given.
		await env.KV.put(headKey(feed.feedId), "99");

		await user.synchronize();

		expect(storedCursor(state, feed.id)).toBe(5);
		expect(storedItems(state, feed.id)).toHaveLength(5);

		// Still stale, because nothing here pretended to have ruled on 6 through 99.
		expect((await user.openReader()).freshness).toEqual({ stale: [feed.id], count: 1 });
	});

	test("advances the cursor to the answered head when the page comes back empty", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);

		// A tick can be spent on a row that was never written, which leaves a reader sitting
		// below a head they could never reach and permanently stale. The head answered here
		// is the true one, read from the feed in the same call as the empty page.
		feedStates.get(feed.feedId)?.storage.sql.exec("UPDATE feed SET head = 9 WHERE id = 1");
		await env.KV.put(headKey(feed.feedId), "9");

		await user.synchronize();

		expect(storedCursor(state, feed.id)).toBe(9);
		expect(storedItems(state, feed.id)).toHaveLength(ENTRIES.length);
		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
	});

	test("leaves the cursor on the last revision it wrote when a run dies, and writes nothing new on the retry", async () => {
		let { user, state } = await createReader();

		// A page carries two hundred items, so a run of more than one page is what it takes
		// for a death between two of them to be a thing that can happen at all.
		let many = Array.from({ length: 250 }, (_, index) =>
			entryAt(`item-${index}`, `Post ${index}`, (250 - index) * 60 * 1000),
		);

		let feed = await follow(user, FEED_URL, many.slice(0, 1));
		expect(storedCursor(state, feed.id)).toBe(1);

		await publish(feed, many);

		pageFault.failOn = 2;
		await user.synchronize();

		// Items first, then the cursor: what it points at is exactly what was written, and
		// nothing above it was claimed on the strength of a page that never landed.
		expect(storedItems(state, feed.id)).toHaveLength(201);
		expect(storedCursor(state, feed.id)).toBe(201);

		let readable = storedItems(state, feed.id)[0];
		if (readable === undefined) throw new Error("expected a post to read");
		await user.markRead(readable);

		// A run that died between the write and the cursor leaves the cursor below work
		// already done, which is the order's whole cost: the retry re-upserts rows it
		// already wrote.
		state.storage.sql.exec("UPDATE feeds SET cursor = 1 WHERE id = ?", feed.id);

		pageFault.failOn = 0;
		feedCalls.length = 0;
		await user.synchronize();

		// Each page is asked for above where the last one left the cursor, so the walk never
		// re-reads what it has ruled on and never steps over what it has not.
		expect(
			feedCalls.filter((call) => call.method === "getItemsAfter").map((call) => call.args[0]),
		).toEqual([1, 201]);

		expect(storedItems(state, feed.id)).toHaveLength(250);
		expect(storedCursor(state, feed.id)).toBe(250);

		let [row] = state.storage.sql
			.exec("SELECT read_at FROM feed_items WHERE id = ?", readable)
			.toArray();

		expect(row?.["read_at"]).not.toBeNull();
	});

	test("carries the feeds past one request's budget into the alarm, which finishes them", async () => {
		let { user, state } = await createReader();

		let feeds: UserStore.FeedSummary[] = [];
		for (let index = 0; index < 10; index += 1) {
			feeds.push(
				await follow(user, `https://feed-${index}.example.com/feed.xml`, [
					entryAt("a", "First", DAY_MS),
				]),
			);
		}

		for (let feed of feeds) {
			await publish(feed, [entryAt("a", "First", DAY_MS), entryAt("b", "Second", HOUR_MS)]);
		}

		let run = await user.synchronize();

		expect(run.synchronized).toBe(8);
		expect(run.remaining).toBe(2);

		let armed = await state.storage.getAlarm();
		expect(armed).not.toBeNull();
		expect(armed).toBeGreaterThan(Date.now());
		expect(armed).toBeLessThanOrEqual(Date.now() + 60 * 1000);

		// The platform clears an alarm as it fires it, and what a wake does is what its due
		// times say is due, so the catch-up is brought forward to the moment it delivers.
		await state.storage.deleteAlarm();
		state.storage.sql.exec(`UPDATE settings SET next_catch_up_at = ? WHERE id = 1`, Date.now());
		await user.alarm();

		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
		expect(await state.storage.getAlarm()).toBeNull();
	});

	test("keeps a page stable while newer and older posts are synchronized around it", async () => {
		let { user } = await createReader();

		let feed = await follow(user, FEED_URL, [
			entryAt("c", "Third", 3 * DAY_MS),
			entryAt("d", "Fourth", 2 * DAY_MS),
			entryAt("e", "Fifth", DAY_MS),
		]);

		let first = await user.feedTimeline(feed.id, { limit: 2 });
		expect(titles(first)).toEqual(["Fifth", "Fourth"]);

		if (!first.ok) throw new Error(first.reason);
		let next = first.cursors.next;
		expect(next).not.toBeNull();

		// One post newer than the page in hand and one older than it, arriving between two
		// reads of it. The keyset is over `(published_at, id)` and neither column ever
		// moves, so each lands where its own key says it does.
		await publish(feed, [
			entryAt("a", "Newest", 60 * 1000),
			entryAt("b", "Oldest", 10 * DAY_MS),
			entryAt("c", "Third", 3 * DAY_MS),
			entryAt("d", "Fourth", 2 * DAY_MS),
			entryAt("e", "Fifth", DAY_MS),
		]);

		await user.synchronize();

		let second = await user.feedTimeline(feed.id, { limit: 2, cursor: next });
		expect(titles(second)).toEqual(["Third", "Oldest"]);

		if (!second.ok) throw new Error(second.reason);

		// The older post was the end of the timeline, and it is the end of it still: what
		// arrived while the reader paged lands by its own key rather than shifting the walk.
		expect(second.cursors.next).toBeNull();

		// Walking back from where the reader got to returns the page they were on, rather
		// than a page the newer post has pushed everything down by.
		let back = await user.feedTimeline(feed.id, { limit: 2, cursor: second.cursors.prev });
		expect(titles(back)).toEqual(["Fifth", "Fourth"]);

		if (!back.ok) throw new Error(back.reason);
		let revised = back.items[1];
		if (revised === undefined) throw new Error("expected the post to revise");
		await user.markRead(revised.id);

		// A revised entry comes back above the cursor and lands on the row the reader
		// already has: its text changes, the column the walk is ordered by does not, and
		// neither does the answer the reader gave it.
		await publish(feed, [
			entryAt("a", "Newest", 60 * 1000),
			entryAt("b", "Oldest", 10 * DAY_MS),
			entryAt("c", "Third", 3 * DAY_MS),
			entryAt("d", "Fourth, corrected", 60 * 1000),
			entryAt("e", "Fifth", DAY_MS),
		]);

		await user.synchronize();

		let walked = await user.feedTimeline(feed.id, { limit: 10 });

		expect(titles(walked)).toEqual(["Newest", "Fifth", "Fourth, corrected", "Third", "Oldest"]);

		if (!walked.ok) throw new Error(walked.reason);
		expect(walked.items.find((item) => item.id === revised.id)?.readAt).not.toBeNull();
	});

	test("skips the items already past its velocity and still advances the cursor past them", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user, FEED_URL, [entryAt("a", "First", 30 * 60 * 1000)]);

		expect(await user.setVelocity(feed.id, "breaking")).toMatchObject({ ok: true });

		// The old one last, so it holds the greatest revision: an item dropped for being
		// past the velocity is decided rather than missed, so the cursor may pass it.
		await publish(feed, [
			entryAt("a", "First", 30 * 60 * 1000),
			entryAt("b", "Fresh", 40 * 60 * 1000),
			entryAt("c", "Ancient", 20 * HOUR_MS),
		]);

		await user.synchronize();

		expect(storedItems(state, feed.id)).toHaveLength(2);
		expect(storedCursor(state, feed.id)).toBe(3);
		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });

		// And the sharp end of it: a page whose every item is past the velocity stores
		// nothing at all, and the cursor still passes the whole of it, because "accounted
		// for" is about what the reader ruled on rather than about what was written.
		await publish(feed, [
			entryAt("a", "First", 30 * 60 * 1000),
			entryAt("b", "Fresh", 40 * 60 * 1000),
			entryAt("c", "Ancient", 20 * HOUR_MS),
			entryAt("d", "Older still", 30 * HOUR_MS),
			entryAt("e", "Older again", 40 * HOUR_MS),
		]);

		await user.synchronize();

		expect(storedItems(state, feed.id)).toHaveLength(2);
		expect(storedCursor(state, feed.id)).toBe(5);
		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
	});
});

describe("what a reader's object is allowed to delete", () => {
	test("deletes nothing for age alone, however long ago the reader read it", async () => {
		let { user, state } = await createReader();

		let feed = seedFeed(state, { id: "feed_old", velocity: "evergreen" });

		seedItems(state, feed, [
			{
				id: "item-1",
				publishedAt: Date.now() - 4 * 365 * DAY_MS,
				readAt: Date.now() - 3 * 365 * DAY_MS,
			},
			{
				id: "item-2",
				publishedAt: Date.now() - 2 * 365 * DAY_MS,
				readAt: Date.now() - 365 * DAY_MS,
			},
			{ id: "item-3", publishedAt: Date.now() - 365 * DAY_MS },
		]);

		await user.synchronize();

		// Two rules remove a post, and both are the reader's own: a velocity they set, or a
		// budget they are over. Age on an object with room for it is neither.
		expect(storedItems(state, feed)).toEqual(["item-1", "item-2", "item-3"]);
	});

	test("keeps every post while the object is under budget, however many feeds are followed", async () => {
		let { user, state } = await createReader();

		for (let index = 0; index < 5; index += 1) {
			let feed = seedFeed(state, { id: `feed_${index}` });

			seedItems(
				state,
				feed,
				Array.from({ length: 20 }, (_, post) => ({
					id: `item-${index}-${post}`,
					publishedAt: Date.now() - post * DAY_MS,
					readAt: Date.now() - post * DAY_MS,
				})),
			);
		}

		await user.synchronize();

		// The share is a division of the budget, and it is enforced only while the object is
		// over that budget — so following a second feed does not halve the history of the
		// first, and a fifty-first does not quietly take rows from the other fifty.
		expect(storedItems(state)).toHaveLength(100);
	});

	test("deletes nothing from the feeds already followed when another feed is followed", async () => {
		let { user, state } = await createReader();
		let first = await follow(user);

		// Narrowed so that a share recomputed on follow would bite: two feeds against a
		// budget of four is a share of two, and the first feed is holding three.
		await setBudget(4);

		let second = await follow(user, "https://second.example.com/feed.xml");

		expect(storedItems(state, first.id)).toHaveLength(3);
		expect(storedItems(state, second.id)).toHaveLength(3);
		expect(storedCursor(state, first.id)).toBe(3);
	});

	test("takes read posts from the feeds over their share, and none from the feeds under it", async () => {
		let { user, state } = await createReader();

		/**
		 * A budget of twelve across two feeds, so a share is six. The prolific feed is over
		 * its share while still inside the budget on its own, which is what makes this a
		 * test of the division rather than of the figure it divides: reclamation runs only
		 * over budget, only on a feed over its share, and only over what was read.
		 */
		await setBudget(12);

		let prolific = seedFeed(state, { id: "feed_prolific" });
		let quiet = seedFeed(state, { id: "feed_quiet" });

		seedItems(
			state,
			prolific,
			Array.from({ length: 12 }, (_, index) => ({
				id: `loud-${String(index).padStart(2, "0")}`,
				publishedAt: Date.now() - (12 - index) * DAY_MS,
				readAt: index < 10 ? Date.now() : undefined,
			})),
		);

		seedItems(
			state,
			quiet,
			Array.from({ length: 3 }, (_, index) => ({
				id: `quiet-${index}`,
				publishedAt: Date.now() - (3 - index) * DAY_MS,
				readAt: Date.now(),
			})),
		);

		await user.synchronize();

		// Six is this feed's share of twelve, taken oldest read first, and the two it never
		// read are not the object's to take.
		expect(storedItems(state, prolific)).toEqual([
			"loud-06",
			"loud-07",
			"loud-08",
			"loud-09",
			"loud-10",
			"loud-11",
		]);
		expect(storedItems(state, quiet)).toEqual(["quiet-0", "quiet-1", "quiet-2"]);
	});

	test("loses no post when there is nothing to reclaim, and stops materializing its worst feed", async () => {
		let { user, state } = await createReader();

		let loud = await follow(
			user,
			FEED_URL,
			Array.from({ length: 8 }, (_, index) => entryAt(`loud-${index}`, `Loud ${index}`, DAY_MS)),
		);

		let quiet = await follow(user, "https://quiet.example.com/feed.xml", [
			entryAt("q-1", "Quiet one", DAY_MS),
			entryAt("q-2", "Quiet two", DAY_MS),
		]);

		/**
		 * Eleven posts against a budget of ten, over two feeds, so a share is five: the loud
		 * feed is over its share, the quiet one is under it, and the reader has read nothing.
		 *
		 * The figures stand in for the million and its half. What is under test is the rule
		 * — over budget, over this feed's share, nothing reclaimable — and the loud feed is
		 * deliberately inside the budget on its own, since a feed that alone exceeds the
		 * whole of it is the one case a test of the share cannot tell apart from a test of
		 * the number.
		 */
		await setBudget(10);

		await publish(quiet, [
			entryAt("q-1", "Quiet one", DAY_MS),
			entryAt("q-2", "Quiet two", DAY_MS),
			entryAt("q-3", "Quiet three", HOUR_MS),
		]);

		await publish(
			loud,
			Array.from({ length: 9 }, (_, index) => entryAt(`loud-${index}`, `Loud ${index}`, DAY_MS)),
		);

		let run = await user.synchronize();

		expect(run.paused).toBe(1);
		expect(storedItems(state, loud.id)).toHaveLength(8);
		expect(storedCursor(state, loud.id)).toBe(8);

		// The feed under its share is not charged for the one over it, so it carries on.
		expect(storedItems(state, quiet.id)).toHaveLength(3);

		// Back-pressure rather than data loss: nothing the reader has is taken, and the
		// subscription stays stale, which is where the reader is told about it.
		expect((await user.openReader()).freshness).toEqual({ stale: [loud.id], count: 1 });
	});

	test("resumes a paused feed once reading brings the object back under budget", async () => {
		let { user, state } = await createReader();

		let loud = await follow(
			user,
			FEED_URL,
			Array.from({ length: 8 }, (_, index) => entryAt(`loud-${index}`, `Loud ${index}`, DAY_MS)),
		);

		// One feed, so its share is the whole budget: eight posts against five is a feed over
		// its share on an object over budget, with nothing read to reclaim.
		await setBudget(5);

		await publish(
			loud,
			Array.from({ length: 9 }, (_, index) => entryAt(`loud-${index}`, `Loud ${index}`, DAY_MS)),
		);

		expect((await user.synchronize()).paused).toBe(1);

		await user.markFeedRead(loud.id);

		// The sweep runs behind the synchronization in the same call, so what reading buys
		// is reclaimed on this run and taken up by the next. Eight posts against a budget of
		// five over one feed is a share of five, so three of what was read goes.
		await user.synchronize();
		expect(storedItems(state, loud.id)).toHaveLength(5);

		let resumed = await user.synchronize();

		expect(resumed.paused).toBe(0);
		expect(storedCursor(state, loud.id)).toBe(9);
		expect((await user.openReader()).freshness).toEqual({ stale: [], count: 0 });
	});
});

describe("velocity, which is the reader's own answer for one feed", () => {
	test("ages nothing out at the default velocity, read or unread", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user, FEED_URL, [
			entryAt("a", "Ancient", 400 * DAY_MS),
			entryAt("b", "Old", 40 * DAY_MS),
		]);

		expect(feed.velocity).toBe("evergreen");

		let page = await user.feedTimeline(feed.id);
		if (!page.ok) throw new Error(page.reason);
		let read = page.items[0];
		if (read === undefined) throw new Error("expected a post");
		await user.markRead(read.id);

		await user.setVelocity(feed.id, "evergreen");
		await user.synchronize();

		expect(storedItems(state, feed.id)).toHaveLength(2);
	});

	test("drops the posts past its window whether or not they were read", async () => {
		let { user, state } = await createReader();
		let feed = seedFeed(state, { id: "feed_news", velocity: "evergreen" });

		seedItems(state, feed, [
			{ id: "fresh-read", publishedAt: Date.now() - HOUR_MS, readAt: Date.now() },
			{ id: "fresh-unread", publishedAt: Date.now() - 2 * HOUR_MS },
			{ id: "stale-read", publishedAt: Date.now() - 5 * HOUR_MS, readAt: Date.now() },
			{ id: "stale-unread", publishedAt: Date.now() - 6 * HOUR_MS },
		]);

		// Consent given in advance, per feed, which is what makes dropping an unread post
		// acceptable here where a rule applied on the reader's behalf would not be.
		expect(await user.setVelocity(feed, "breaking")).toMatchObject({ ok: true });

		expect(storedItems(state, feed)).toEqual(["fresh-unread", "fresh-read"]);
	});

	test("keeps different posts for two readers of one feed at different velocities", async () => {
		let entries = [entryAt("a", "Recent", HOUR_MS), entryAt("b", "Yesterday", 30 * HOUR_MS)];

		let mine = await createReader("sub-mine");
		let yours = await createReader("sub-yours");

		let ours = await follow(mine.user, FEED_URL, entries);
		let theirs = await follow(yours.user, FEED_URL, entries);

		// One feed, one object, one fetch: what the two of them disagree about is what it is
		// worth to each of them, which is why the answer is a column on the subscription.
		expect(theirs.feedId).toBe(ours.feedId);
		expect(feedCalls.filter((call) => call.method === "subscribe")).toHaveLength(2);

		await mine.user.setVelocity(ours.id, "news");
		await yours.user.setVelocity(theirs.id, "essay");

		expect(storedItems(mine.state, ours.id)).toHaveLength(1);
		expect(storedItems(yours.state, theirs.id)).toHaveLength(2);
	});
});

describe("saved posts, the one answer that outlives every rule", () => {
	test("keeps a saved post through its feed's velocity, the sweep and the budget", async () => {
		let { user, state } = await createReader();
		let feed = seedFeed(state, { id: "feed_saved", velocity: "evergreen" });

		seedItems(state, feed, [
			{ id: "kept", publishedAt: Date.now() - 400 * DAY_MS, readAt: Date.now() - 300 * DAY_MS },
			{ id: "dropped", publishedAt: Date.now() - 400 * DAY_MS, readAt: Date.now() - 300 * DAY_MS },
			{ id: "recent", publishedAt: Date.now() - 1000 },
		]);

		expect(await user.saveItem("kept")).toEqual({ ok: true, saved: true });

		await user.setVelocity(feed, "breaking");

		expect(storedItems(state, feed)).toEqual(["kept", "recent"]);

		// And then the other rule, on an object with one feed and no room: everything the
		// reader read is reclaimable, and the saved post is still not.
		await setBudget(1);
		await user.markAllRead();
		await user.synchronize();

		expect(storedItems(state, feed)).toEqual(["kept"]);
	});

	test("refuses the save past the shelf and evicts none of what is on it", async () => {
		let { user, state } = await createReader();

		// The five-thousand-deep shelf is the one a paying reader has; the free tier's is a
		// thousand, and which number applies is the whole of what the tier decides here.
		await user.setTier({ entitled: "paid", cancelled: false, readAt: 1, source: "billing" });

		let feed = seedFeed(state, { id: "feed_shelf" });

		seedItems(
			state,
			feed,
			Array.from({ length: TIER_SAVED_LIMITS.paid + 1 }, (_, index) => ({
				id: `post-${String(index).padStart(4, "0")}`,
				publishedAt: Date.now() - (TIER_SAVED_LIMITS.paid + 1 - index) * 1000,
				savedAt:
					index < TIER_SAVED_LIMITS.paid
						? Date.now() - (TIER_SAVED_LIMITS.paid - index) * 1000
						: undefined,
			})),
		);

		let refused = await user.saveItem(`post-${String(TIER_SAVED_LIMITS.paid).padStart(4, "0")}`);

		// A cap that dropped the oldest save to make room would delete the one thing in this
		// design a reader explicitly asked to keep.
		expect(refused).toEqual({
			ok: false,
			reason: "full",
			limit: {
				limit: "saved",
				current: TIER_SAVED_LIMITS.paid,
				allowed: TIER_SAVED_LIMITS.paid,
				tier: "paid",
			},
		});

		let saved = await user.savedQueue({ limit: 1 });
		expect(saved.ok).toBe(true);

		let [row] = state.storage.sql
			.exec("SELECT COUNT(*) AS kept FROM feed_items WHERE saved_at IS NOT NULL")
			.toArray();

		expect(Number(row?.["kept"])).toBe(TIER_SAVED_LIMITS.paid);
		expect(storedItems(state, feed)).toHaveLength(TIER_SAVED_LIMITS.paid + 1);

		// The reader is told they are full and unsaves something, which is the answer that
		// makes room — and the shelf takes the next one the moment there is any.
		expect(await user.saveItem("post-0000", false)).toEqual({ ok: true, saved: false });

		expect(await user.saveItem(`post-${String(TIER_SAVED_LIMITS.paid).padStart(4, "0")}`)).toEqual({
			ok: true,
			saved: true,
		});
	});

	test("returns an unsaved post to the rule that would have taken it", async () => {
		let { user, state } = await createReader();
		let feed = seedFeed(state, { id: "feed_unsaved", velocity: "breaking" });

		seedItems(state, feed, [
			{ id: "kept", publishedAt: Date.now() - 20 * HOUR_MS, savedAt: Date.now() },
			{ id: "recent", publishedAt: Date.now() - 1000 },
		]);

		await user.synchronize();
		expect(storedItems(state, feed)).toEqual(["kept", "recent"]);

		expect(await user.saveItem("kept", false)).toEqual({ ok: true, saved: false });

		// No second grace period: the save was the grace period, so the next sweep is the
		// one that takes it.
		await user.synchronize();

		expect(storedItems(state, feed)).toEqual(["recent"]);
	});

	test("keeps the saved posts of an unfollowed feed and drops the rest", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);

		let page = await user.feedTimeline(feed.id);
		if (!page.ok) throw new Error(page.reason);
		let kept = page.items[0];
		if (kept === undefined) throw new Error("expected a post to keep");

		await user.saveItem(kept.id);

		expect(await user.unfollowFeed(feed.id)).toBe(true);

		expect(storedItems(state, feed.id)).toEqual([kept.id]);
		expect(calls("unsubscribe")).toEqual([`${feed.feedId}:unsubscribe`]);

		// The row is what holds the feed's name for the saved list to show, so it stays —
		// marked as no longer followed, and filtered out of the lists a reader browses.
		let [row] = state.storage.sql
			.exec("SELECT unfollowed_at FROM feeds WHERE id = ?", feed.id)
			.toArray();

		expect(row?.["unfollowed_at"]).not.toBeNull();
		expect(await user.listFeeds()).toEqual([]);

		let saved = await user.savedQueue();
		expect(titles(saved)).toEqual([kept.title]);

		// And the row goes when the last saved post from it does, since holding the feed's
		// name for that list was the only thing it was still there for.
		expect(await user.saveItem(kept.id, false)).toEqual({ ok: true, saved: false });

		expect(storedItems(state, feed.id)).toEqual([]);
		expect(state.storage.sql.exec("SELECT id FROM feeds WHERE id = ?", feed.id).toArray()).toEqual(
			[],
		);
	});
});

/** The folder one post is filed in, read straight off the row. */
function storedFolder(state: DurableObjectStateMock, itemId: string): string | null {
	let [row] = state.storage.sql
		.exec("SELECT folder_id FROM feed_items WHERE id = ?", itemId)
		.toArray();

	let folderId = row?.["folder_id"];
	return typeof folderId === "string" ? folderId : null;
}

/** Makes a folder and answers its id, failing the test where the store refused to. */
async function folderNamed(user: UserDO, title: string): Promise<string> {
	let made = await user.createFolder(title);
	if (!made.ok) throw new Error(`making the folder ${title} failed: ${made.reason}`);
	return made.folder.id;
}

describe("folders, which are a reading surface before they are filing", () => {
	test("moves a feed's posts into the folder's timeline, and leaves their read state alone", async () => {
		let { user } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");

		let queue = await user.readingQueue({ readState: "all" });
		let read = queue.ok ? queue.items[0] : undefined;
		if (read === undefined) throw new Error("expected a post to read");
		await user.markRead(read.id);

		let filed = await user.fileFeed(feed.id, { folderId });

		expect(filed).toEqual({ ok: true, folder: { id: folderId, title: "Tech" }, moved: 3 });
		expect(titles(await user.folderTimeline(folderId))).toEqual(["Third", "Second", "First"]);

		// Filing says where a post is read, never whether it was: the reader ruled on that.
		let after = await user.readingQueue({ readState: "read" });
		expect(titles(after)).toEqual([read.title]);
	});

	test("takes a feed back out, and leaves an unfiled feed out of the folder", async () => {
		let { user } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");

		await user.fileFeed(feed.id, { folderId });
		let removed = await user.fileFeed(feed.id, null);

		expect(removed).toEqual({ ok: true, folder: null, moved: 3 });
		expect(titles(await user.folderTimeline(folderId))).toEqual([]);
		expect((await user.getFeed(feed.id))?.folderId).toBeNull();
	});

	/**
	 * The folder orders nothing, so nothing a reader is holding a place in can move under
	 * them: the page after a cursor is the page it would have been.
	 */
	test("moves no row within the ordering, so a cursor in flight skips nothing", async () => {
		let { user } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");

		let first = await user.readingQueue({ readState: "all", limit: 2 });
		if (!first.ok) throw new Error(first.reason);
		expect(titles(first)).toEqual(["Third", "Second"]);

		await user.fileFeed(feed.id, { folderId });

		let next = await user.readingQueue({ readState: "all", cursor: first.cursors.next });
		expect(titles(next)).toEqual(["First"]);
	});

	/**
	 * A cursor records the exact column names it was minted for, and every timeline here is
	 * spelled by one shared ordering — so a place kept on one surface is a place the others
	 * can resume from.
	 */
	test("mints a folder's cursor over the columns every other timeline mints its own over", async () => {
		let { user } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");
		await user.fileFeed(feed.id, { folderId });

		let folderPage = await user.folderTimeline(folderId, { limit: 2 });
		if (!folderPage.ok) throw new Error(folderPage.reason);

		let feedPage = await user.feedTimeline(feed.id, { limit: 2 });
		if (!feedPage.ok) throw new Error(feedPage.reason);

		expect(titles(await user.feedTimeline(feed.id, { cursor: folderPage.cursors.next }))).toEqual([
			"First",
		]);
		expect(titles(await user.folderTimeline(folderId, { cursor: feedPage.cursors.next }))).toEqual([
			"First",
		]);
	});

	test("writes an arriving post into the folder its feed is in, on insert and on edit", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");
		await user.fileFeed(feed.id, { folderId });

		await publish(feed, [...ENTRIES, entryAt("d", "Fourth", 0)]);
		await user.synchronize();

		let arrived = await user.folderTimeline(folderId);
		expect(titles(arrived)).toContain("Fourth");

		// A publisher's correction arrives as the same item again, and lands where its feed
		// is rather than where it was when the item was first written.
		await publish(feed, [...ENTRIES, entryAt("d", "Fourth, corrected", 0)]);
		await user.synchronize();

		expect(titles(await user.folderTimeline(folderId))).toContain("Fourth, corrected");
		expect(storedItems(state, feed.id).length).toBe(4);
	});

	/**
	 * The copy on the post has exactly one source — the subscription's own column — and
	 * synchronization writes it from the row it is already holding, so a move that got
	 * halfway is corrected by the next poll rather than drifting.
	 */
	test("heals a move interrupted between the subscription and its posts", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");

		// The subscription moved and its posts did not, which is the half-written state.
		state.storage.sql.exec("UPDATE feeds SET folder_id = ? WHERE id = ?", folderId, feed.id);

		await publish(feed, [entryAt("a", "First, corrected", 3 * DAY_MS)]);
		await user.synchronize();

		expect(titles(await user.folderTimeline(folderId))).toEqual(["First, corrected"]);
	});

	test("unfiles a folder's feeds when it is deleted, and deletes no post", async () => {
		let { user, state } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");
		await user.fileFeed(feed.id, { folderId });

		expect(await user.deleteFolder(folderId)).toEqual({ ok: true, title: "Tech", feeds: 1 });

		expect(storedItems(state, feed.id).length).toBe(3);
		expect((await user.getFeed(feed.id))?.folderId).toBeNull();
		expect(await user.listFolders()).toEqual([]);
		expect(storedFolder(state, storedItems(state, feed.id)[0] ?? "")).toBeNull();
	});

	test("renames one row, and refuses a name another folder already reads under", async () => {
		let { user } = await createReader();
		let feed = await follow(user);
		let folderId = await folderNamed(user, "Tech");
		await user.fileFeed(feed.id, { folderId });
		await folderNamed(user, "News");

		expect(await user.renameFolder(folderId, "Programming")).toEqual({
			ok: true,
			folder: { id: folderId, title: "Programming" },
		});

		// The posts hold the folder by its id, which a name never was.
		expect(titles(await user.folderTimeline(folderId))).toHaveLength(3);

		expect(await user.renameFolder(folderId, "News")).toEqual({
			ok: false,
			reason: "duplicate-title",
		});
	});

	/** Filing by name is an upsert, which is what an import needs to be idempotent. */
	test("files under a name, making the folder only where the reader has none by it", async () => {
		let { user } = await createReader();
		let one = await follow(user);
		let other = await follow(user, "https://other.example.com/feed.xml", [
			entryAt("x", "Elsewhere", HOUR_MS),
		]);

		let filed = await user.fileFeed(one.id, { title: " Tech " });
		if (!filed.ok || filed.folder === null) throw new Error("expected the feed to be filed");

		let again = await user.fileFeed(other.id, { title: "Tech" });
		if (!again.ok || again.folder === null) throw new Error("expected the feed to be filed");

		expect(again.folder.id).toBe(filed.folder.id);
		expect(await user.listFolders()).toHaveLength(1);
		expect(titles(await user.folderTimeline(filed.folder.id))).toHaveLength(4);
	});

	test("reports a folder the reader does not have, and a feed they do not follow", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		expect(await user.fileFeed(feed.id, { folderId: "nope" })).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(await user.fileFeed("nope", null)).toEqual({ ok: false, reason: "not-following" });
		expect(await user.fileFeed(feed.id, { title: "   " })).toEqual({
			ok: false,
			reason: "invalid-title",
		});
		expect(await user.deleteFolder("nope")).toEqual({ ok: false, reason: "not-found" });
	});

	test("carries each feed's folder onto the list the rail is drawn from", async () => {
		let { user } = await createReader();
		let one = await follow(user);
		await follow(user, "https://other.example.com/feed.xml", [entryAt("x", "Elsewhere", HOUR_MS)]);

		let folderId = await folderNamed(user, "Tech");
		await user.fileFeed(one.id, { folderId });

		let listed = await user.listFeeds();

		expect(
			listed.map((feed) => [feed.id, feed.folderId, feed.folderTitle, feed.unreadCount]),
		).toEqual([
			[one.id, folderId, "Tech", 3],
			[expect.any(String), null, null, 1],
		]);
	});

	/**
	 * The budget counts posts and a folder stores none, so the divisor stays how many feeds
	 * the reader follows however they have filed them.
	 */
	test("changes no retention arithmetic: the share is still the budget over the feeds", async () => {
		let { user, state } = await createReader();
		let filed = seedFeed(state, { id: "filed" });
		let loose = seedFeed(state, { id: "loose" });

		seedItems(
			state,
			filed,
			Array.from({ length: 6 }, (_unused, index) => ({
				id: `filed-${index}`,
				publishedAt: index,
				readAt: 1,
			})),
		);
		seedItems(state, loose, [{ id: "loose-0", publishedAt: 0, readAt: 1 }]);

		let folderId = await folderNamed(user, "Tech");
		await user.fileFeed(filed, { folderId });

		// Four posts across two feeds, so each feed's share is two and the filed one is over
		// it by four — which is what comes back, exactly as it would unfiled.
		await setBudget(4);
		await user.synchronize();

		expect(storedItems(state, filed)).toEqual(["filed-4", "filed-5"]);
		expect(storedItems(state, loose)).toEqual(["loose-0"]);
	});
});

/** Whether a binding is the namespace mock, which is what carries the resolution log. */
function isNamespaceMock(value: unknown): value is { resolutions: readonly unknown[] } {
	return typeof value === "object" && value !== null && "resolutions" in value;
}
