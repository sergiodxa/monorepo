/**
 * Drives the reader's Durable Object the way the app does: inside workerd, through the
 * `USER` binding this app's wrangler config declares, by name, over real RPC, against the
 * real KV namespace the heads are published into and the real feed objects beside it.
 *
 * What only the deployment can show is asserted here — that the binding names a class the
 * runtime finds, that the migration tag gives that class SQLite-backed storage for the
 * schema to run against, that the constructor's gate holds the first requests until it
 * has, that one reader's rows are invisible to another, that a freshness check over more
 * subscriptions than one bulk read carries is still answered, and that the catch-up alarm
 * is one the platform accepts and delivers. The behaviour behind those methods belongs to
 * the tests that build the object directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { UserStore } from "~/database/user-do";

import schema from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { headKey } from "~/database/feed-head";

/** Feeds one request synchronizes behind the page it has already answered. */
const SYNC_FEEDS_PER_REQUEST = 8;

/** How long the catch-up waits before carrying on with whatever a run left behind. */
const CATCH_UP_MS = 60 * 1000;

/** MSW server standing in for the origins the feeds are published from. */
let server = setupServer();

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });

	// The shipped migration rather than a `CREATE TABLE` written for the tests, so the
	// catalog a follow writes to is the one `wrangler d1 migrations` applies. D1's `exec`
	// reads one statement per line, so the prose is dropped and what is left of each
	// statement is folded onto a line of its own.
	let statements = schema
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join(" ")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");

	for (let statement of statements) await env.PLATFORM_DB.exec(`${statement};`);
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * A subject no other test in this file uses. Durable Object storage outlives a test, and
 * `getByName` hands back whatever object that name already has, so each test gets its own
 * reader rather than sharing one and depending on the order they ran in.
 */
function subject(): string {
	return `sub-${crypto.randomUUID()}`;
}

/** An origin no other test in this file publishes from, for the same reason. */
function feedUrl(): string {
	return `https://${crypto.randomUUID()}.example.com/feed.xml`;
}

/** An RSS 2.0 document carrying one post per title. */
function rss(titles: string[]): string {
	let items = titles.map(
		(title, order) => `<item>
			<guid isPermaLink="false">${title}</guid>
			<title>${title}</title>
			<link>https://example.com/${order}</link>
			<description>About ${title}</description>
			<pubDate>Tue, 0${order + 1} Sep 2026 00:00:00 GMT</pubDate>
		</item>`,
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0"><channel>
			<title>Example</title>
			<link>https://example.com</link>
			<description>An example feed</description>
			${items.join("\n")}
		</channel></rss>`;
}

/** Publishes a document at one origin, for whoever fetches it next. */
function publish(url: string, titles: string[]): void {
	server.use(http.get(url, () => HttpResponse.xml(rss(titles))));
}

/** Subscriptions written straight into a reader's storage, for a test that follows nothing. */
async function seedFeeds(
	stub: DurableObjectStub<import("~/database/user-do").UserDO>,
	rows: readonly { id: string; feedId: string; cursor: number }[],
): Promise<void> {
	await runInDurableObject(stub, (_instance, state) => {
		for (let row of rows) {
			state.storage.sql.exec(
				`INSERT INTO feeds
					(id, feed_id, feed_url, title, cursor, velocity, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 'evergreen', 0, 0)`,
				row.id,
				row.feedId,
				`https://${row.id}.example.com/feed.xml`,
				row.id,
				row.cursor,
			);
		}
	});
}

/** How many posts a reader's object is holding, read without going through a page. */
async function storedPosts(
	stub: DurableObjectStub<import("~/database/user-do").UserDO>,
): Promise<number> {
	return await runInDurableObject(stub, (_instance, state) => {
		let [row] = state.storage.sql
			.exec<{ total: number }>("SELECT COUNT(*) AS total FROM feed_items")
			.toArray();

		return row?.total ?? 0;
	});
}

describe("the USER binding", () => {
	test("creates a reader on a first sign-in, with no refresh to report yet", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		expect(await stub.getSettings()).toBeNull();

		// The row exists only because the schema does, which needs the class to hold
		// SQLite rather than the key-value storage a `new_classes` migration would give it.
		expect(await stub.ensureUser(name)).toEqual({ subject: name, lastRefreshedAt: null });
	});

	test("answers every request that raced the boot, because the constructor gates them", async () => {
		let stub = env.USER.getByName(subject());

		// All five reach a cold object at once, while the migration is still creating the
		// tables they query; `blockConcurrencyWhile` is what holds them until it has.
		let [stored, feeds, queue, timeline, opened] = await Promise.all([
			stub.getSettings(),
			stub.listFeeds(),
			stub.readingQueue(),
			stub.feedTimeline("feed_00000000000000000000000000"),
			stub.openReader(),
		]);

		expect(stored).toBeNull();
		expect(feeds).toEqual([]);
		expect(queue).toEqual({
			ok: true,
			items: [],
			feeds: [],
			cursors: { next: null, prev: null },
		});
		expect(timeline.ok).toBe(true);
		expect(opened.freshness).toEqual({ stale: [], count: 0 });
	});

	test("keeps one reader's storage out of another's", async () => {
		let mine = subject();
		let yours = subject();

		let url = feedUrl();
		publish(url, ["First", "Second"]);

		await env.USER.getByName(mine).ensureUser(mine);
		let followed = await env.USER.getByName(mine).followFeed(url);
		expect(followed.ok).toBe(true);

		// A name nobody has signed in under reads as an empty object rather than as the
		// reader next to it, which is what the whole per-reader design rests on.
		expect(await env.USER.getByName(yours).getSettings()).toBeNull();
		expect(await env.USER.getByName(yours).listFeeds()).toEqual([]);
		expect(await env.USER.getByName(yours).countFeeds()).toBe(0);

		expect(await env.USER.getByName(mine).countFeeds()).toBe(1);
	});

	test("resolves the same subject to the same object every time it is addressed", async () => {
		let name = subject();

		await env.USER.getByName(name).ensureUser(name);

		// A fresh handle, built from the subject alone the way each request builds one.
		expect(await env.USER.getByName(name).getSettings()).toEqual({
			subject: name,
			lastRefreshedAt: null,
		});

		expect(env.USER.getByName(name).id.toString()).toBe(env.USER.getByName(name).id.toString());
	});

	test("carries a follow refusal back as a plain object a caller can switch on", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		await stub.ensureUser(name);

		// A URL rejected before any lookup, so the assertion is about the boundary alone.
		let result: UserStore.FollowResult = await stub.followFeed("mailto:reader@example.com");

		expect(result).toEqual({ ok: false, reason: "invalid-url", feedId: null });
		expect(result).not.toBeInstanceOf(Error);

		let reason = result.ok ? "followed" : result.reason;
		expect(reason).toBe("invalid-url");
	});

	test("reports a velocity the column would refuse across the boundary instead of throwing", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		await stub.ensureUser(name);

		// A thrown error would arrive here as a bare `Error`, since the platform serializes
		// one by name and message; a refusal arrives as the union the caller switches on.
		let result: UserStore.VelocityResult = await stub.setVelocity("feed_missing", "hourly");

		expect(result).toEqual({ ok: false, reason: "invalid-velocity" });
		expect(result).not.toBeInstanceOf(Error);
	});

	test("arms no alarm for a reader with nothing left to catch up on", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		await stub.ensureUser(name);
		await stub.synchronize();

		// The alarm exists for leftovers alone now that nothing here fetches, so a reader
		// who is caught up costs no wakes at all.
		expect(
			await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm()),
		).toBeNull();
	});
});

/**
 * The methods the signed-in surface calls before a reader has followed anything. Every one
 * of them can be the first call an object ever answers, so what is asserted here is that
 * they cross the RPC boundary and run against the schema the migration tag gives the class.
 */
describe("a reader who follows nothing yet", () => {
	test("counts no subscriptions and exports none", async () => {
		let stub = env.USER.getByName(subject());

		expect(await stub.countFeeds()).toBe(0);
		expect(await stub.exportFeeds()).toEqual([]);
	});

	test("clears an empty queue and reports the nothing it cleared", async () => {
		let stub = env.USER.getByName(subject());

		expect(await stub.markAllRead()).toBe(0);
		expect(await stub.markFeedRead("feed_00000000000000000000000000")).toBe(0);
	});

	test("keeps an empty shelf, which is a page like any other", async () => {
		let stub = env.USER.getByName(subject());

		expect(await stub.savedQueue()).toEqual({
			ok: true,
			items: [],
			feeds: [],
			cursors: { next: null, prev: null },
		});

		expect(await stub.saveItem("item_missing")).toEqual({ ok: false, reason: "not-found" });
	});

	test("searches an object whose table the drop migration has already run against", async () => {
		let stub = env.USER.getByName(subject());

		// The column the body was stored in is gone here, so a search that reads `summary`
		// is what says the migration ran and left the table the statement expects.
		let found: UserStore.TimelineResult = await stub.readingQueue({
			readState: "all",
			query: "anything",
		});

		expect(found).toEqual({ ok: true, items: [], feeds: [], cursors: { next: null, prev: null } });
	});

	test("narrows the reading queue by the read state it is asked for", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		await stub.ensureUser(name);

		// Posts seeded straight into the object's own SQLite: workerd reaches no origin
		// here, so the rows a follow would bring in are written by hand and what the three
		// statements read back is what the assertion is about.
		await runInDurableObject(stub, (_instance, state) => {
			for (let [order, title] of ["First", "Second", "Third"].entries()) {
				state.storage.sql.exec(
					`INSERT INTO feed_items
					 (id, feed_id, guid, title, published_at, read_at, created_at, updated_at)
					 VALUES (?, 'feed_seed', ?, ?, ?, ?, 0, 0)`,
					`item_seed_${order}`,
					`guid-${order}`,
					title,
					order,
					title === "First" ? 1 : null,
				);
			}
		});

		let titles = async (readState: UserStore.ReadState) => {
			let page: UserStore.TimelineResult = await stub.readingQueue({ readState });
			if (!page.ok) throw new Error(`expected a page, got ${page.reason}`);
			return page.items.map((item) => item.title);
		};

		expect(await titles("all")).toEqual(["Third", "Second", "First"]);
		expect(await titles("unread")).toEqual(["Third", "Second"]);
		expect(await titles("read")).toEqual(["First"]);
	});

	test("carries a bad cursor back as a refusal rather than an error", async () => {
		let stub = env.USER.getByName(subject());

		expect(await stub.readingQueue({ cursor: "not-a-cursor" })).toEqual({
			ok: false,
			reason: "bad-cursor",
		});

		expect(
			await stub.readingQueue({ readState: "all", query: "anything", cursor: "not-a-cursor" }),
		).toEqual({ ok: false, reason: "bad-cursor" });
	});

	test("sweeps nothing and still records that the reader is up to date", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		expect(await stub.checkAllFeedsNow()).toEqual({
			checked: 0,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		});

		let stored = await stub.getSettings();

		expect(stored?.subject).toBe(name);
		expect(stored?.lastRefreshedAt).toBeGreaterThan(0);
	});
});

/**
 * The freshness index as the platform's own KV answers it: the heads are read out of the
 * namespace the app binds, with its real bulk limit and its real answer for a key nobody
 * has written.
 */
describe("what a sweep of posts reports back", () => {
	/**
	 * The number a reader is shown has to be posts. What a write reports is rows of storage,
	 * and a post lives in the table and in every partial index it qualifies for, so marking
	 * one read writes several rows — which is invisible against a mock that counts a write
	 * per row and only shows up here, against the storage a reader actually has.
	 */
	test("counts the posts it marked rather than the rows storage wrote", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		let url = feedUrl();

		publish(url, ["One", "Two", "Three"]);
		let followed = await stub.followFeed(url);
		if (!followed.ok) throw new Error(`following ${url} failed: ${followed.reason}`);

		expect(await storedPosts(stub)).toBe(3);
		expect(await stub.markFeedRead(followed.feed.id)).toBe(3);

		// And nothing left unread, so a second sweep has nothing to count.
		expect(await stub.markFeedRead(followed.feed.id)).toBe(0);
	});

	test("counts the posts one sweep of every feed marked", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		let url = feedUrl();

		publish(url, ["One", "Two"]);
		let followed = await stub.followFeed(url);
		if (!followed.ok) throw new Error(`following ${url} failed: ${followed.reason}`);

		expect(await stub.markAllRead()).toBe(2);
		expect(await stub.markAllRead()).toBe(0);
	});
});

describe("the freshness index", () => {
	test("reads a cursor below the published head as stale, and one level with it as current", async () => {
		let stub = env.USER.getByName(subject());

		await seedFeeds(stub, [
			{ id: "feed_behind", feedId: `feed_${crypto.randomUUID()}`, cursor: 7 },
			{ id: "feed_level", feedId: `feed_${crypto.randomUUID()}`, cursor: 7 },
		]);

		let rows = await stub.listFeeds();
		let behind = rows.find((row) => row.id === "feed_behind");
		let level = rows.find((row) => row.id === "feed_level");
		if (behind === undefined || level === undefined) throw new Error("expected both feeds");

		await env.KV.put(headKey(behind.feedId), "8");
		await env.KV.put(headKey(level.feedId), "7");

		expect((await stub.openReader()).freshness).toEqual({ stale: ["feed_behind"], count: 1 });
	});

	test("leaves a reader current when no head has been published for a feed", async () => {
		let stub = env.USER.getByName(subject());

		await seedFeeds(stub, [
			{ id: "feed_quiet", feedId: `feed_${crypto.randomUUID()}`, cursor: 0 },
			{ id: "feed_read", feedId: `feed_${crypto.randomUUID()}`, cursor: 42 },
		]);

		// An absent key means "no reason to go and look". Reading it as stale would turn a
		// cold namespace into a full synchronization for every reader on every request.
		expect((await stub.openReader()).freshness).toEqual({ stale: [], count: 0 });

		let run = await stub.synchronize();
		expect(run).toEqual({ synchronized: 0, items: 0, remaining: 0, paused: 0 });
	});

	test("answers a page and the staleness beside it without materializing anything", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);
		let url = feedUrl();

		publish(url, ["First", "Second"]);
		let followed = await stub.followFeed(url);
		if (!followed.ok) throw new Error(`following failed: ${followed.reason}`);

		publish(url, ["First", "Second", "Third"]);
		await env.FEED.getByName(followed.feed.feedId).refresh("manual");

		let opened = await stub.openReader({ readState: "all" });

		expect(opened.freshness).toEqual({ stale: [followed.feed.id], count: 1 });

		// A count, never a promise of fresher posts: the page was read out of local storage
		// before the staleness beside it was known.
		if (!opened.timeline.ok) throw new Error(opened.timeline.reason);
		expect(opened.timeline.items).toHaveLength(2);
		expect(await storedPosts(stub)).toBe(2);
	});

	test("answers a reader following two hundred and fifty feeds, which no one bulk read carries", async () => {
		let stub = env.USER.getByName(subject());

		let seeds = Array.from({ length: 250 }, (_, index) => ({
			id: `feed_bulk_${index}`,
			feedId: `feed_${crypto.randomUUID()}`,
			cursor: 0,
		}));

		await seedFeeds(stub, seeds);

		let stale = seeds.slice(0, 3);
		for (let seed of stale) await env.KV.put(headKey(seed.feedId), "5");

		// Workers KV refuses a bulk read over a hundred keys outright, so a check that
		// answers at all over two hundred and fifty subscriptions is one that chunked them.
		// How many reads that took is counted where the namespace can be instrumented.
		let opened = await stub.openReader();

		expect(opened.freshness.count).toBe(3);
		expect([...opened.freshness.stale].sort()).toEqual(stale.map((seed) => seed.id).sort());
	});
});

describe("the catch-up alarm", () => {
	test("carries the feeds past one request's budget into an alarm the platform delivers", async () => {
		let name = subject();
		let stub = env.USER.getByName(name);

		let followed: UserStore.FeedSummary[] = [];

		for (let index = 0; index < SYNC_FEEDS_PER_REQUEST + 1; index += 1) {
			let url = feedUrl();
			publish(url, ["First"]);

			let result = await stub.followFeed(url);
			if (!result.ok) throw new Error(`following failed: ${result.reason}`);

			publish(url, ["First", "Second"]);
			await env.FEED.getByName(result.feed.feedId).refresh("manual");

			followed.push(result.feed);
		}

		let run = await stub.synchronize();

		expect(run.synchronized).toBe(SYNC_FEEDS_PER_REQUEST);
		expect(run.remaining).toBe(1);

		let armed = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());
		expect(armed).not.toBeNull();
		expect(armed).toBeLessThanOrEqual(Date.now() + CATCH_UP_MS);

		// The platform's own delivery of it, rather than a direct call: what is asserted is
		// that the alarm this object arms is one workerd runs, and that it finishes the work.
		expect(await runDurableObjectAlarm(stub)).toBe(true);

		expect((await stub.openReader()).freshness).toEqual({ stale: [], count: 0 });
		expect(await storedPosts(stub)).toBe(2 * followed.length);
	});
});
