/**
 * Exercises the refresh path against a real SQLite database and feed documents served by
 * MSW. The assertions that matter are the ones about writes that must not happen: a 304
 * and an unchanged document each have to leave every `feed_items` row untouched, and a
 * re-published post may not move the columns a cursor and a reader's read state rest on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { InsertFeedItem, SelectFeed, SelectFeedItem } from "~/database/schema";

import { feedItems, feeds } from "~/database/schema";

import { runMigrations } from "./migrations";
import { pruneFeed, refreshDueFeeds, refreshFeed } from "./refresh";

/** The epoch milliseconds every test measures against, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

/** One hour, the unit the backoff assertions are written in. */
const HOUR = 60 * 60 * 1000;

/** The feed every single-feed test polls. */
const FEED_URL = "https://example.com/feed.xml";

/** MSW server standing in for the origins the feeds are published from. */
let server = setupServer();

let sql: ReturnType<typeof createSqlStorage>;
let db: Database;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	sql = createSqlStorage();
	let adapter = createSQLStorageDatabaseAdapter(sql);
	await runMigrations(adapter);
	db = new Database(adapter);
});

/** One entry of a generated document, with a default for everything a test ignores. */
interface Entry {
	guid: string;
	title?: string;
	description?: string;
	pubDate?: string;
	link?: string;
}

/** An RSS 2.0 document carrying `entries`, which is what the origins answer with. */
function rss(entries: Entry[]): string {
	let items = entries.map(
		(entry) => `<item>
			<guid isPermaLink="false">${entry.guid}</guid>
			<title>${entry.title ?? "A post"}</title>
			<link>${entry.link ?? `https://example.com/${entry.guid}`}</link>
			<description>${entry.description ?? "The body"}</description>
			<pubDate>${entry.pubDate ?? "Tue, 01 Sep 2026 00:00:00 GMT"}</pubDate>
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

/** Answers `url` with a document built from `entries`. */
function serve(url: string, entries: Entry[]): void {
	server.use(http.get(url, () => HttpResponse.xml(rss(entries))));
}

/** Answers `url` with a status and no document, for the failure branches. */
function serveStatus(url: string, status: number): void {
	server.use(http.get(url, () => new HttpResponse(null, { status })));
}

/** Stores a feed, defaulting every polling column to the state of a fresh subscription. */
async function storeFeed(overrides: Partial<SelectFeed> = {}): Promise<SelectFeed> {
	let id = overrides.id ?? "feed-1";

	await db.create(
		feeds,
		{
			id,
			feed_url: FEED_URL,
			site_url: "https://example.com",
			title: "Example",
			description: null,
			language: null,
			image_url: null,
			etag: null,
			last_modified: null,
			last_fetched_at: null,
			last_status: null,
			last_http_status: null,
			last_error: null,
			failure_count: 0,
			next_attempt_at: null,
			created_at: NOW,
			updated_at: NOW,
			...overrides,
		},
		{ touch: false },
	);

	return loadFeed(id);
}

/** Stores one post directly, for the tests about retention rather than about parsing. */
async function storeItem(values: InsertFeedItem & { id: string }): Promise<void> {
	await db.create(
		feedItems,
		{
			feed_id: "feed-1",
			guid: values.id,
			title: "A post",
			url: null,
			summary: null,
			content: null,
			author: null,
			published_at: NOW,
			content_hash: "hash",
			read_at: null,
			created_at: NOW,
			updated_at: NOW,
			...values,
		},
		{ touch: false },
	);
}

/** The stored feed, so a second poll is given the validators the first one wrote. */
async function loadFeed(id = "feed-1"): Promise<SelectFeed> {
	let feed = await db.findOne(feeds, { where: { id } });
	if (feed === null) throw new Error(`No feed stored as ${id}`);
	return feed;
}

/** One stored post, addressed the way a feed document addresses it. */
async function loadItem(guid: string): Promise<SelectFeedItem> {
	let item = await db.findOne(feedItems, { where: { guid } });
	if (item === null) throw new Error(`No item stored as ${guid}`);
	return item;
}

/** Every post of a feed, oldest first, for asserting what survived. */
function storedItems(feedId = "feed-1"): Promise<SelectFeedItem[]> {
	return db.findMany(feedItems, { where: { feed_id: feedId }, orderBy: ["published_at", "asc"] });
}

/**
 * Watches the statements a run executes, so a test can assert that a poll wrote no post
 * at all rather than that it wrote the same values back.
 */
function watchWrites() {
	let exec = vi.spyOn(sql, "exec");

	return {
		/** Statements that wrote to `feed_items`, which an unchanged poll leaves empty. */
		itemWrites(): string[] {
			return exec.mock.calls
				.map(([statement]) => String(statement))
				.filter((statement) => /feed_items/.test(statement))
				.filter((statement) => /^\s*(insert|update|delete)/i.test(statement));
		},
		restore: () => exec.mockRestore(),
	};
}

describe("refreshFeed", () => {
	test("stamps a 304 without parsing or touching a post", async () => {
		let feed = await storeFeed({
			etag: "v1",
			failure_count: 3,
			next_attempt_at: NOW - 1,
			last_status: "http_error",
			last_http_status: 500,
			last_error: "Failed to fetch feed: 500",
		});
		await storeItem({ id: "i1", guid: "g1" });

		server.use(
			http.get(FEED_URL, ({ request }) =>
				request.headers.get("if-none-match") === "v1"
					? new HttpResponse(null, { status: 304 })
					: HttpResponse.xml(rss([{ guid: "g1" }])),
			),
		);

		let writes = watchWrites();
		let outcome = await refreshFeed(db, feed, { now: NOW });
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "not_modified" });

		let stored = await loadFeed();
		expect(stored.last_status).toBe("not_modified");
		expect(stored.last_http_status).toBe(304);
		expect(stored.last_fetched_at).toBe(NOW);
		expect(stored.failure_count).toBe(0);
		expect(stored.next_attempt_at).toBeNull();
		expect(stored.last_error).toBeNull();
		expect(stored.etag).toBe("v1");
	});

	test("writes no post when the document came back unchanged", async () => {
		let feed = await storeFeed();
		serve(FEED_URL, [{ guid: "g1" }, { guid: "g2" }]);

		expect(await refreshFeed(db, feed, { now: NOW })).toEqual({
			status: "ok",
			inserted: 2,
			updated: 0,
		});

		let writes = watchWrites();
		let outcome = await refreshFeed(db, await loadFeed(), { now: NOW + HOUR });
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "ok", inserted: 0, updated: 0 });
	});

	test("inserts an entry the document did not carry before", async () => {
		let feed = await storeFeed();
		serve(FEED_URL, [{ guid: "g1" }]);
		await refreshFeed(db, feed, { now: NOW });

		serve(FEED_URL, [{ guid: "g2" }, { guid: "g1" }]);

		let writes = watchWrites();
		let outcome = await refreshFeed(db, await loadFeed(), { now: NOW + HOUR });
		/** Proves the watcher the no-write assertions rest on sees a write when there is one. */
		expect(writes.itemWrites()).toHaveLength(1);
		writes.restore();

		expect(outcome).toEqual({ status: "ok", inserted: 1, updated: 0 });
		expect((await storedItems()).map((item) => item.guid).sort()).toEqual(["g1", "g2"]);
	});

	test("updates an edited entry while leaving read_at, id and published_at alone", async () => {
		let feed = await storeFeed();
		serve(FEED_URL, [{ guid: "g1", title: "First draft", description: "A typo" }]);
		await refreshFeed(db, feed, { now: NOW });

		await db.updateMany(feedItems, { read_at: NOW + 1 }, { where: { guid: "g1" }, touch: false });
		let before = await loadItem("g1");

		serve(FEED_URL, [{ guid: "g1", title: "First draft", description: "The typo, fixed" }]);
		let outcome = await refreshFeed(db, await loadFeed(), { now: NOW + HOUR });

		expect(outcome).toEqual({ status: "ok", inserted: 0, updated: 1 });

		let after = await loadItem("g1");
		expect(after.content).toContain("The typo, fixed");
		expect(after.content_hash).not.toBe(before.content_hash);
		expect(after.id).toBe(before.id);
		expect(after.published_at).toBe(before.published_at);
		expect(after.read_at).toBe(NOW + 1);
	});

	test("treats an entry re-dated with identical content as unchanged", async () => {
		let feed = await storeFeed();
		serve(FEED_URL, [{ guid: "g1", pubDate: "Tue, 01 Sep 2026 00:00:00 GMT" }]);
		await refreshFeed(db, feed, { now: NOW });
		let before = await loadItem("g1");

		serve(FEED_URL, [{ guid: "g1", pubDate: "Wed, 09 Sep 2026 12:00:00 GMT" }]);

		let writes = watchWrites();
		let outcome = await refreshFeed(db, await loadFeed(), { now: NOW + HOUR });
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "ok", inserted: 0, updated: 0 });
		expect((await loadItem("g1")).published_at).toBe(before.published_at);
	});

	test("keeps a post the new document no longer carries", async () => {
		let feed = await storeFeed();
		serve(FEED_URL, [{ guid: "g1" }, { guid: "g2" }]);
		await refreshFeed(db, feed, { now: NOW });

		serve(FEED_URL, [{ guid: "g2" }]);
		await refreshFeed(db, await loadFeed(), { now: NOW + HOUR });

		expect((await storedItems()).map((item) => item.guid).sort()).toEqual(["g1", "g2"]);
	});

	test("records an error status in its own column and backs the feed off", async () => {
		let feed = await storeFeed();
		serveStatus(FEED_URL, 404);

		let outcome = await refreshFeed(db, feed, { now: NOW });
		expect(outcome).toMatchObject({ status: "http_error", httpStatus: 404 });

		let stored = await loadFeed();
		expect(stored.last_status).toBe("http_error");
		expect(stored.last_http_status).toBe(404);
		expect(stored.last_error).toContain("404");
		expect(stored.failure_count).toBe(1);
		expect(stored.next_attempt_at).toBe(NOW + 5 * 60 * 1000);
	});

	test("caps the backoff at a day however long a feed has been failing", async () => {
		let feed = await storeFeed({ failure_count: 40 });
		serveStatus(FEED_URL, 500);

		await refreshFeed(db, feed, { now: NOW });

		let stored = await loadFeed();
		expect(stored.failure_count).toBe(41);
		expect(stored.next_attempt_at).toBe(NOW + 24 * HOUR);
	});

	test("lengthens the wait with each consecutive failure", async () => {
		let first = await storeFeed({ failure_count: 1 });
		serveStatus(FEED_URL, 500);
		await refreshFeed(db, first, { now: NOW });

		expect((await loadFeed()).next_attempt_at).toBe(NOW + 10 * 60 * 1000);
	});

	test("reports a document that is not a feed as a parse failure", async () => {
		let feed = await storeFeed();
		server.use(http.get(FEED_URL, () => HttpResponse.text("not xml at all")));

		let outcome = await refreshFeed(db, feed, { now: NOW });

		expect(outcome.status).toBe("parse_error");
		expect((await loadFeed()).last_status).toBe("parse_error");
		expect((await loadFeed()).last_http_status).toBeNull();
	});

	test("clears the failure state once the feed answers again", async () => {
		let feed = await storeFeed({
			failure_count: 4,
			next_attempt_at: NOW - 1,
			last_status: "network_error",
			last_error: "Failed to fetch feed: fetch failed",
		});
		serve(FEED_URL, [{ guid: "g1" }]);

		await refreshFeed(db, feed, { now: NOW });

		let stored = await loadFeed();
		expect(stored.last_status).toBe("ok");
		expect(stored.failure_count).toBe(0);
		expect(stored.next_attempt_at).toBeNull();
		expect(stored.last_error).toBeNull();
	});

	test("falls back to first-seen when the entry publishes no date", async () => {
		let feed = await storeFeed();
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.xml(`<?xml version="1.0"?>
					<rss version="2.0"><channel>
						<title>Example</title><link>https://example.com</link><description>d</description>
						<item><guid isPermaLink="false">g1</guid><title>Undated</title></item>
					</channel></rss>`),
			),
		);

		await refreshFeed(db, feed, { now: NOW });

		expect((await loadItem("g1")).published_at).toBe(NOW);
	});

	test("inserts more entries than one statement can bind", async () => {
		let feed = await storeFeed();
		let entries = Array.from({ length: 30 }, (_, index) => ({ guid: `g${index}` }));
		serve(FEED_URL, entries);

		expect(await refreshFeed(db, feed, { now: NOW })).toEqual({
			status: "ok",
			inserted: 30,
			updated: 0,
		});
		expect(await storedItems()).toHaveLength(30);
	});
});

describe("refreshDueFeeds", () => {
	test("leaves a feed inside its backoff alone", async () => {
		await storeFeed({
			id: "waiting",
			feed_url: "https://waiting.test/feed.xml",
			next_attempt_at: NOW + HOUR,
		});
		await storeFeed({ id: "due", feed_url: "https://due.test/feed.xml" });
		serve("https://due.test/feed.xml", [{ guid: "g1" }]);

		let run = await refreshDueFeeds(db, { now: NOW });

		expect(run).toEqual({ attempted: 1, remaining: 0 });
		expect((await loadFeed("waiting")).last_fetched_at).toBeNull();
		expect((await loadFeed("due")).last_status).toBe("ok");
	});

	test("reports what the budget left behind", async () => {
		for (let index of [1, 2, 3]) {
			let url = `https://feed${index}.test/feed.xml`;
			await storeFeed({ id: `feed-${index}`, feed_url: url, last_fetched_at: index });
			serve(url, [{ guid: `g${index}` }]);
		}

		expect(await refreshDueFeeds(db, { now: NOW, limit: 2 })).toEqual({
			attempted: 2,
			remaining: 1,
		});
	});

	test("takes the stalest feeds first, so no feed is permanently skipped", async () => {
		await storeFeed({ id: "fresh", feed_url: "https://fresh.test/feed.xml", last_fetched_at: NOW });
		await storeFeed({ id: "stale", feed_url: "https://stale.test/feed.xml", last_fetched_at: 1 });
		serve("https://stale.test/feed.xml", [{ guid: "g1" }]);

		await refreshDueFeeds(db, { now: NOW, limit: 1 });

		expect((await loadFeed("stale")).last_fetched_at).toBe(NOW);
		expect((await loadFeed("fresh")).last_fetched_at).toBe(NOW);
		expect((await loadFeed("stale")).last_status).toBe("ok");
		expect((await loadFeed("fresh")).last_status).toBeNull();
	});

	test("resolves rather than rejects when every origin is failing", async () => {
		await storeFeed();
		serveStatus(FEED_URL, 503);

		await expect(refreshDueFeeds(db, { now: NOW })).resolves.toEqual({
			attempted: 1,
			remaining: 0,
		});
		expect((await loadFeed()).last_status).toBe("http_error");
	});

	test("prunes each feed it refreshed", async () => {
		let feed = await storeFeed();
		serve(FEED_URL, [{ guid: "g1" }, { guid: "g2" }]);
		await refreshFeed(db, feed, { now: NOW });
		await db.updateMany(
			feedItems,
			{ read_at: NOW },
			{ where: { feed_id: "feed-1" }, touch: false },
		);

		serve(FEED_URL, [{ guid: "g1" }, { guid: "g2" }]);
		await refreshDueFeeds(db, { now: NOW + HOUR, retention: 1 });

		expect(await storedItems()).toHaveLength(1);
	});

	test("does nothing at all when no feed is due", async () => {
		await storeFeed({ next_attempt_at: NOW + HOUR });

		expect(await refreshDueFeeds(db, { now: NOW })).toEqual({ attempted: 0, remaining: 0 });
	});
});

describe("pruneFeed", () => {
	/** Five posts, oldest to newest, so the cap has something to count down through. */
	async function storeFivePosts(): Promise<void> {
		for (let index of [1, 2, 3, 4, 5]) {
			await storeItem({ id: `i${index}`, guid: `g${index}`, published_at: index * 1000 });
		}
	}

	test("drops the read posts beyond the cap", async () => {
		await storeFivePosts();
		await db.updateMany(
			feedItems,
			{ read_at: NOW },
			{ where: { feed_id: "feed-1" }, touch: false },
		);

		expect(await pruneFeed(db, "feed-1", 2)).toBe(3);
		expect((await storedItems()).map((item) => item.id)).toEqual(["i4", "i5"]);
	});

	test("keeps an unread post however far beyond the cap it sits", async () => {
		await storeFivePosts();
		await db.updateMany(
			feedItems,
			{ read_at: NOW },
			{ where: { feed_id: "feed-1" }, touch: false },
		);
		await db.updateMany(feedItems, { read_at: null }, { where: { id: "i1" }, touch: false });

		expect(await pruneFeed(db, "feed-1", 2)).toBe(2);
		expect((await storedItems()).map((item) => item.id)).toEqual(["i1", "i4", "i5"]);
	});

	test("deletes nothing from a feed inside the cap", async () => {
		await storeFivePosts();
		await db.updateMany(
			feedItems,
			{ read_at: NOW },
			{ where: { feed_id: "feed-1" }, touch: false },
		);

		expect(await pruneFeed(db, "feed-1", 10)).toBe(0);
		expect(await storedItems()).toHaveLength(5);
	});

	test("leaves another feed's posts where they are", async () => {
		await storeFivePosts();
		await storeItem({ id: "other", feed_id: "feed-2", guid: "go", published_at: 1, read_at: NOW });
		await db.updateMany(
			feedItems,
			{ read_at: NOW },
			{ where: { feed_id: "feed-1" }, touch: false },
		);

		await pruneFeed(db, "feed-1", 1);

		expect(await storedItems("feed-2")).toHaveLength(1);
	});
});
