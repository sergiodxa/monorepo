/**
 * Exercises one feed's polling against a real SQLite database and documents served by
 * MSW, with no object around it — which is what `pollFeed` taking a `Database` is for.
 *
 * The assertions that matter are the ones about writes that must not happen and about a
 * counter that must not go backwards: a 304 and an unchanged document each have to leave
 * every `items` row alone, a re-published entry may not move the columns a subscriber's
 * copy is joined and sorted by, and a sweep that empties the table may not hand a later
 * item a number some subscriber has already walked past.
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

import type { InsertFeed, InsertItem, SelectFeed, SelectItem } from "~/database/feed-schema";

import { FEED_JOURNAL, FEED_MIGRATIONS } from "~/database/feed-migrations";
import { feed as feedTable, items } from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";
import {
	digest,
	displayableOf,
	DIGEST_PREFETCH,
	FEED_ROW_ID,
	MAX_SUMMARY_LENGTH,
	measurePostsPerDay,
	pollFeed,
	pruneItems,
} from "~/database/refresh";

/** The epoch milliseconds every test measures against, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

/** One hour, the unit a second poll's clock and the backoff assertions are written in. */
const HOUR = 60 * 60 * 1000;

/** One day, which is both the cap on a backoff and the window a rate is measured over. */
const DAY = 24 * HOUR;

/** The feed this object holds, since an object holds exactly one. */
const FEED_URL = "https://example.com/feed.xml";

/** MSW server standing in for the origin the feed is published from. */
let server = setupServer();

let sql: ReturnType<typeof createSqlStorage>;
let db: Database;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	sql = createSqlStorage();
	let adapter = createSQLStorageDatabaseAdapter(sql);
	await runMigrations(adapter, FEED_MIGRATIONS, FEED_JOURNAL);
	db = new Database(adapter);
});

/** One entry of a generated document, with a default for everything a test ignores. */
interface Entry {
	guid: string;
	title?: string;
	description?: string;
	pubDate?: string;
	link?: string;
	/**
	 * A `content:encoded` body. A feed publishing both is what leaves `description` the
	 * summary it was written to be, which is the only field of a post's text that is stored.
	 */
	content?: string;
}

/** An RSS 2.0 document carrying `entries`, which is what the origin answers with. */
function rss(entries: Entry[]): string {
	let published = entries.map(
		(entry) => `<item>
			<guid isPermaLink="false">${entry.guid}</guid>
			<title>${entry.title ?? "A post"}</title>
			<link>${entry.link ?? `https://example.com/${entry.guid}`}</link>
			<description>${entry.description ?? "The body"}</description>
			${entry.content === undefined ? "" : `<content:encoded>${entry.content}</content:encoded>`}
			<pubDate>${entry.pubDate ?? "Tue, 01 Sep 2026 00:00:00 GMT"}</pubDate>
		</item>`,
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
			<title>Example</title>
			<link>https://example.com</link>
			<description>An example feed</description>
			${published.join("\n")}
		</channel></rss>`;
}

/** Wraps a body in CDATA, which is how a feed carries markup through an XML element. */
function cdata(body: string): string {
	return `<![CDATA[${body}]]>`;
}

/** Answers the feed's URL with a document built from `entries`. */
function serve(entries: Entry[]): void {
	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(entries))));
}

/** Answers the feed's URL with a status and no document, for the failure branches. */
function serveStatus(status: number): void {
	server.use(http.get(FEED_URL, () => new HttpResponse(null, { status })));
}

/** Stores the feed's single row, defaulting every column to a fresh subscription's state. */
async function storeFeed(overrides: InsertFeed = {}): Promise<SelectFeed> {
	await db.create(
		feedTable,
		{
			id: FEED_ROW_ID,
			feed_url: FEED_URL,
			site_url: null,
			title: FEED_URL,
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
			head: 0,
			posts_per_day: null,
			purge_at: null,
			created_at: NOW,
			updated_at: NOW,
			...overrides,
		},
		{ touch: false },
	);

	return loadFeed();
}

/** Stores one item directly, for the tests about retention rather than about parsing. */
async function storeItem(values: InsertItem & { id: string; revision: number }): Promise<void> {
	await db.create(
		items,
		{
			guid: values.id,
			sequence: values.revision,
			title: "A post",
			url: null,
			summary: null,
			author: null,
			published_at: NOW,
			content_hash: "hash",
			created_at: NOW,
			updated_at: NOW,
			...values,
		},
		{ touch: false },
	);
}

/** The feed's row, which is where the counter and the validators a poll reads live. */
async function loadFeed(): Promise<SelectFeed> {
	let stored = await db.find(feedTable, { id: FEED_ROW_ID });
	if (stored === null) throw new Error("No feed stored");
	return stored;
}

/** One stored item, addressed the way the document addresses it. */
async function loadItem(guid: string): Promise<SelectItem> {
	let stored = await db.findOne(items, { where: { guid } });
	if (stored === null) throw new Error(`No item stored as ${guid}`);
	return stored;
}

/** Every stored item in the order this object decided them, for asserting what survived. */
function storedItems(): Promise<SelectItem[]> {
	return db.findMany(items, { orderBy: [["revision", "asc"]] });
}

/**
 * Watches the statements a run executes, so a test can assert that a poll wrote no item
 * at all rather than that it wrote the same values back.
 */
function watchWrites() {
	let exec = vi.spyOn(sql, "exec");

	return {
		/** Statements that wrote to `items`, which an unchanged poll leaves empty. */
		itemWrites(): string[] {
			return exec.mock.calls
				.map(([statement]) => String(statement))
				.filter((statement) => /\bitems\b/.test(statement))
				.filter((statement) => /^\s*(insert|update|delete)/i.test(statement));
		},
		restore: () => exec.mockRestore(),
	};
}

describe("pollFeed", () => {
	test("reports an object nothing has subscribed to as a feed it cannot reach", async () => {
		// No row means no address to fetch, and the caller's only question is whether this
		// feed refreshed — so it is answered as a value rather than as a throw.
		expect(await pollFeed(db, { now: NOW })).toEqual({
			status: "network_error",
			message: expect.any(String),
		});
	});

	test("stores an entry the feed did not carry before", async () => {
		await storeFeed();
		serve([{ guid: "g1" }]);

		expect(await pollFeed(db, { now: NOW })).toEqual({
			status: "ok",
			inserted: 1,
			edited: 0,
			head: 1,
			hub: null,
		});

		serve([{ guid: "g2" }, { guid: "g1" }]);

		expect(await pollFeed(db, { now: NOW + HOUR })).toEqual({
			status: "ok",
			inserted: 1,
			edited: 0,
			head: 2,
			hub: null,
		});

		expect((await storedItems()).map((item) => item.guid)).toEqual(["g1", "g2"]);
	});

	test("stores the same entries twice without duplicating one of them", async () => {
		await storeFeed();
		serve([{ guid: "g1" }, { guid: "g2" }]);
		await pollFeed(db, { now: NOW });

		let writes = watchWrites();
		let outcome = await pollFeed(db, { now: NOW + HOUR });
		// Without the unique guid a feed that re-serves an entry duplicates it on every
		// poll forever, so the assertion is that the second poll touched no row at all.
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "ok", inserted: 0, edited: 0, head: 2, hub: null });
		expect(await storedItems()).toHaveLength(2);
	});

	test("gives each newly discovered entry a sequence above every one before it", async () => {
		await storeFeed();
		serve([{ guid: "g1" }, { guid: "g2" }]);
		await pollFeed(db, { now: NOW });

		serve([{ guid: "g3" }, { guid: "g2" }, { guid: "g1" }]);
		await pollFeed(db, { now: NOW + HOUR });

		let sequences = (await storedItems()).map((item) => item.sequence);

		expect(sequences).toEqual([1, 2, 3]);
		expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
	});

	test("writes one tick to both columns when it discovers an entry", async () => {
		await storeFeed();
		serve([{ guid: "g1" }, { guid: "g2" }]);

		await pollFeed(db, { now: NOW });

		for (let item of await storedItems()) expect(item.revision).toBe(item.sequence);
		expect((await loadFeed()).head).toBe(2);
	});

	test("mints an item id carrying the type it identifies", async () => {
		await storeFeed();
		serve([{ guid: "g1" }]);

		await pollFeed(db, { now: NOW });

		// It is copied verbatim into every subscriber's own row, so it has to say what it
		// names wherever it turns up.
		expect((await loadItem("g1")).id).toMatch(/^item_[\da-z]{26}$/);
	});

	test("moves only the revision when a publisher edits an entry it already stored", async () => {
		await storeFeed();
		serve([{ guid: "g1", description: "A typo", content: "The full body" }]);
		await pollFeed(db, { now: NOW });
		await pollFeed(db, { now: NOW + HOUR });
		let before = await loadItem("g1");

		serve([{ guid: "g1", description: "The typo, fixed", content: "The full body" }]);
		let outcome = await pollFeed(db, { now: NOW + 2 * HOUR });

		expect(outcome).toEqual({ status: "ok", inserted: 0, edited: 1, head: 2, hub: null });

		let after = await loadItem("g1");
		expect(after.summary).toBe("The typo, fixed");
		expect(after.content_hash).not.toBe(before.content_hash);
		// A fresh revision is what puts the correction back in front of every subscriber
		// exactly once; the three frozen columns are what keeps it the same post to each.
		expect(after.revision).toBe(2);
		expect(after.sequence).toBe(before.sequence);
		expect(after.id).toBe(before.id);
		expect(after.published_at).toBe(before.published_at);
	});

	test("hands an edit and a discovery in one document a tick each", async () => {
		await storeFeed();
		serve([{ guid: "g1", description: "First" }]);
		await pollFeed(db, { now: NOW });

		serve([{ guid: "g2" }, { guid: "g1", description: "Second" }]);

		expect(await pollFeed(db, { now: NOW + HOUR })).toEqual({
			status: "ok",
			inserted: 1,
			edited: 1,
			head: 3,
			hub: null,
		});

		// Every tick is spent once, so the two decisions leave no revision unaccounted for
		// and none shared: a subscriber walking the order sees each of them exactly once.
		expect((await storedItems()).map((item) => item.revision).sort((a, b) => a - b)).toEqual([
			2, 3,
		]);
	});

	test("reads an entry re-dated with the same words as unchanged", async () => {
		await storeFeed();
		serve([{ guid: "g1", pubDate: "Tue, 01 Sep 2026 00:00:00 GMT" }]);
		await pollFeed(db, { now: NOW });
		let before = await loadItem("g1");

		// Feeds that re-date every entry on every poll exist, which is why the digest is
		// taken over what a reader sees and leaves the date out of it.
		serve([{ guid: "g1", pubDate: "Wed, 09 Sep 2026 12:00:00 GMT" }]);

		let writes = watchWrites();
		let outcome = await pollFeed(db, { now: NOW + HOUR });
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "ok", inserted: 0, edited: 0, head: 1, hub: null });
		expect((await loadItem("g1")).published_at).toBe(before.published_at);
	});

	test("keeps an item the document has stopped carrying", async () => {
		await storeFeed();
		serve([{ guid: "g1" }, { guid: "g2" }]);
		await pollFeed(db, { now: NOW });

		serve([{ guid: "g2" }]);
		await pollFeed(db, { now: NOW + HOUR });

		expect((await storedItems()).map((item) => item.guid)).toEqual(["g1", "g2"]);
	});

	test("stamps a 304 without parsing a document or touching an item", async () => {
		await storeFeed({
			etag: "v1",
			failure_count: 3,
			next_attempt_at: NOW - 1,
			last_status: "http_error",
			last_http_status: 500,
			last_error: "Failed to fetch feed: 500",
		});
		await storeItem({ id: "item_1", revision: 1 });

		server.use(
			http.get(FEED_URL, ({ request }) =>
				request.headers.get("if-none-match") === "v1"
					? new HttpResponse(null, { status: 304 })
					: HttpResponse.xml(rss([{ guid: "item_1" }, { guid: "unseen" }])),
			),
		);

		let writes = watchWrites();
		let outcome = await pollFeed(db, { now: NOW });
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "not_modified" });

		let stored = await loadFeed();
		expect(stored.last_status).toBe("not_modified");
		expect(stored.last_http_status).toBe(304);
		expect(stored.last_fetched_at).toBe(NOW);
		// The head is the number this feed publishes, and a 304 is the feed saying it has
		// published nothing since the last time it answered.
		expect(stored.head).toBe(0);
		// Dropping the validators here would send the next poll without preconditions and
		// spend a whole document on a feed that has not changed.
		expect(stored.etag).toBe("v1");
		expect(stored.failure_count).toBe(0);
		expect(stored.next_attempt_at).toBeNull();
		expect(stored.last_error).toBeNull();
	});

	test("records the status behind a refusal and backs the feed off", async () => {
		await storeFeed();
		serveStatus(404);

		expect(await pollFeed(db, { now: NOW })).toMatchObject({
			status: "http_error",
			httpStatus: 404,
		});

		let stored = await loadFeed();
		// The category, the code and the message are kept apart so a view can say a feed
		// 404s by reading a column rather than by reading prose.
		expect(stored.last_status).toBe("http_error");
		expect(stored.last_http_status).toBe(404);
		expect(stored.last_error).toContain("404");
		expect(stored.failure_count).toBe(1);
		expect(stored.next_attempt_at).toBe(NOW + 5 * 60 * 1000);
	});

	test("lengthens the wait with each consecutive failure", async () => {
		await storeFeed({ failure_count: 1 });
		serveStatus(500);

		await pollFeed(db, { now: NOW });

		expect((await loadFeed()).next_attempt_at).toBe(NOW + 10 * 60 * 1000);
	});

	test("caps the wait at a day however long a feed has been failing", async () => {
		await storeFeed({ failure_count: 40 });
		serveStatus(500);

		await pollFeed(db, { now: NOW });

		let stored = await loadFeed();
		// A feed whose origin has been gone for days is still retried daily, so it
		// recovers on its own once the origin comes back.
		expect(stored.failure_count).toBe(41);
		expect(stored.next_attempt_at).toBe(NOW + DAY);
	});

	test("reports a document that is not a feed as a parse failure", async () => {
		await storeFeed();
		server.use(http.get(FEED_URL, () => HttpResponse.text("not xml at all")));

		expect((await pollFeed(db, { now: NOW })).status).toBe("parse_error");

		let stored = await loadFeed();
		expect(stored.last_status).toBe("parse_error");
		expect(stored.last_http_status).toBeNull();
	});

	test("resolves rather than rejects when an origin cannot be reached at all", async () => {
		await storeFeed();
		server.use(http.get(FEED_URL, () => HttpResponse.error()));

		// The alarm that drives this must never reject: a rejected alarm is retried by the
		// platform, which would re-fetch an origin that has already answered.
		await expect(pollFeed(db, { now: NOW })).resolves.toMatchObject({
			status: "network_error",
		});
		expect((await loadFeed()).failure_count).toBe(1);
	});

	test("leaves the backoff behind once the feed answers again", async () => {
		await storeFeed({
			failure_count: 4,
			next_attempt_at: NOW - 1,
			last_status: "network_error",
			last_error: "Failed to fetch feed: fetch failed",
		});
		serve([{ guid: "g1" }]);

		await pollFeed(db, { now: NOW });

		let stored = await loadFeed();
		expect(stored.last_status).toBe("ok");
		expect(stored.failure_count).toBe(0);
		expect(stored.next_attempt_at).toBeNull();
		expect(stored.last_error).toBeNull();
	});

	test("takes the feed's description of itself from the document it answered with", async () => {
		await storeFeed();
		serve([{ guid: "g1" }]);

		await pollFeed(db, { now: NOW });

		let stored = await loadFeed();
		expect(stored.title).toBe("Example");
		expect(stored.site_url).toBe("https://example.com/");
		expect(stored.description).toBe("An example feed");
	});

	test("cuts a summary past the cap and stores what it hashed", async () => {
		await storeFeed();
		serve([{ guid: "g1", description: "word ".repeat(200), content: "A body of its own" }]);
		await pollFeed(db, { now: NOW });

		let summary = (await loadItem("g1")).summary ?? "";
		// Capping near what the timeline renders is what makes a row's cost predictable, and
		// the marker is what says the line was cut rather than the sentence stopped. The
		// marker counts toward the cap, so the cap is what a row holds rather than what it
		// holds before the thing that says it was cut.
		expect(summary.length).toBeLessThanOrEqual(MAX_SUMMARY_LENGTH);
		expect(summary.endsWith("…")).toBe(true);
		expect(summary).toBe(`${"word ".repeat(55).trimEnd()}…`);

		// The next poll re-hashes the cut summary, so the entry reads as unchanged rather
		// than as edited on every poll for as long as the publisher leaves it alone.
		let writes = watchWrites();
		let outcome = await pollFeed(db, { now: NOW + HOUR });
		expect(writes.itemWrites()).toEqual([]);
		writes.restore();

		expect(outcome).toEqual({ status: "ok", inserted: 0, edited: 0, head: 1, hub: null });
	});

	test("draws a line to read out of the body when the feed publishes no summary", async () => {
		await storeFeed();
		serve([
			{ guid: "g1", description: cdata("<p>An opening line. <strong>Then</strong> a second.</p>") },
		]);

		await pollFeed(db, { now: NOW });

		// Most RSS publishes a bare description, which a feed reports as the body with no
		// summary beside it, so the visible text of that body is the line under the title.
		expect((await loadItem("g1")).summary).toBe("An opening line. Then a second.");
	});

	test("resolves the entities a body carries into the characters they stand for", async () => {
		await storeFeed();
		serve([{ guid: "g1", description: cdata("<p>Tea &amp; toast, the caf&#8217;s own.</p>") }]);

		await pollFeed(db, { now: NOW });

		expect((await loadItem("g1")).summary).toBe("Tea & toast, the caf’s own.");
	});

	test("keeps the summary a publisher wrote when the entry carries a body beside it", async () => {
		await storeFeed();
		serve([
			{
				guid: "g1",
				description: "The publisher's own words.",
				content: cdata("<p>A body far longer than the summary beside it.</p>"),
			},
		]);

		await pollFeed(db, { now: NOW });

		expect((await loadItem("g1")).summary).toBe("The publisher's own words.");
	});

	test("stores no line at all for an entry carrying neither a summary nor a body", async () => {
		await storeFeed();
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.xml(`<?xml version="1.0"?>
					<rss version="2.0"><channel>
						<title>Example</title><link>https://example.com</link><description>d</description>
						<item><guid isPermaLink="false">g1</guid><title>Bare</title></item>
					</channel></rss>`),
			),
		);

		await pollFeed(db, { now: NOW });

		expect((await loadItem("g1")).summary).toBeNull();
	});

	test("falls back to first-seen when the entry publishes no date", async () => {
		await storeFeed();
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.xml(`<?xml version="1.0"?>
					<rss version="2.0"><channel>
						<title>Example</title><link>https://example.com</link><description>d</description>
						<item><guid isPermaLink="false">g1</guid><title>Undated</title></item>
					</channel></rss>`),
			),
		);

		await pollFeed(db, { now: NOW });

		// The column a timeline sorts on has to be total, and a nullable one leaves a hole
		// in the index every keyset page walks.
		expect((await loadItem("g1")).published_at).toBe(NOW);
	});

	test("stores more entries than one statement can bind", async () => {
		await storeFeed();
		serve(Array.from({ length: 30 }, (_, index) => ({ guid: `g${index}` })));

		expect(await pollFeed(db, { now: NOW })).toEqual({
			status: "ok",
			inserted: 30,
			edited: 0,
			head: 30,
			hub: null,
		});
		expect(await storedItems()).toHaveLength(30);
	});

	test("records what the feed publishes alongside the items it stored", async () => {
		await storeFeed();
		let published = new Date(NOW - DAY).toUTCString();
		serve([
			{ guid: "g1", pubDate: published },
			{ guid: "g2", pubDate: published },
			{ guid: "g3", pubDate: published },
		]);

		await pollFeed(db, { now: NOW });

		// Measured once here and handed to everyone following the feed, the same way the
		// fetch and the parse already are.
		expect((await loadFeed()).posts_per_day).toBeCloseTo(0.1, 5);
	});
});

describe("what a poll costs whatever the table holds", () => {
	/** Answers `304` to a poll carrying the stored validator, as an unchanged feed does. */
	function serveNotModified(entries: Entry[]): void {
		server.use(
			http.get(FEED_URL, ({ request }) =>
				request.headers.get("if-none-match") === "v1"
					? new HttpResponse(null, { status: 304 })
					: HttpResponse.xml(rss(entries)),
			),
		);
	}

	test("recomputes the rate on a 304, and reaches zero once the window has slid past", async () => {
		await storeFeed({ etag: "v1", posts_per_day: 1 });
		await storeItem({ id: "item_1", revision: 1, published_at: NOW - 2 * DAY });
		serveNotModified([{ guid: "item_1" }]);

		await pollFeed(db, { now: NOW });
		expect((await loadFeed()).posts_per_day).toBeCloseTo(1 / 30, 5);

		// A feed that stopped publishing answers 304 forever, so this is the only path on
		// which its rate can fall — and falling to zero is what the dormant cadence reads.
		await pollFeed(db, { now: NOW + 31 * DAY });
		expect((await loadFeed()).posts_per_day).toBe(0);
	});

	test("prefetches at most the bound, whatever the table holds", async () => {
		await storeFeed();
		for (let revision of [1, 2, 3]) await storeItem({ id: `item_${revision}`, revision });
		serve([{ guid: "g1" }]);

		let exec = vi.spyOn(sql, "exec");
		await pollFeed(db, { now: NOW });

		let reads = exec.mock.calls
			.map(([statement]) => String(statement))
			.filter(
				(statement) => /^\s*select/i.test(statement) && /"guid".*"content_hash"/.test(statement),
			);
		exec.mockRestore();

		// A feed at the retention ceiling would otherwise be classified by pulling a
		// million guids and digests into an isolate with a hundred and twenty-eight
		// megabytes, which is a busy feed that stops polling rather than one that costs.
		expect(reads).not.toEqual([]);
		for (let read of reads) {
			expect(read).toMatch(new RegExp(`limit\\s+${DIGEST_PREFETCH}\\b`, "i"));
		}
	});

	test("recognizes an entry below the prefetch window by its exact lookup", async () => {
		let sunk = DIGEST_PREFETCH + 1;
		await storeFeed({ head: sunk });
		await storeItem({
			id: "item_old",
			guid: "old",
			revision: 1,
			content_hash: await digest({
				title: "A post",
				url: "https://example.com/old",
				summary: "The body",
				author: null,
				enclosure_url: null,
				enclosure_type: null,
				enclosure_length: null,
			}),
		});
		for (let revision = 2; revision <= sunk; revision += 1) {
			await storeItem({ id: `item_${revision}`, revision });
		}

		serve([{ guid: "old" }]);

		// A thousand is a cache hit rate rather than a correctness boundary: what the
		// window did not answer for gets one seek on the unique index instead, so the
		// entry is read as unchanged rather than decided as new.
		expect(await pollFeed(db, { now: NOW + HOUR })).toEqual({
			status: "ok",
			inserted: 0,
			edited: 0,
			head: sunk,
			hub: null,
		});
		expect(await storedItems()).toHaveLength(sunk);
	});

	test("writes no second row for an insert that conflicts on its guid", async () => {
		await storeFeed();
		serve([{ guid: "g1" }]);

		// Two polls of one object, each classifying the entry as new because neither has
		// written yet. The unique index is what decides, and the loser writes nothing
		// rather than aborting a chunk of rows that were all new.
		await Promise.all([pollFeed(db, { now: NOW }), pollFeed(db, { now: NOW })]);

		expect(await storedItems()).toHaveLength(1);
	});
});

describe("measurePostsPerDay", () => {
	test("reports what the feed published over the window, spread across its days", async () => {
		for (let index of [1, 2, 3]) {
			await storeItem({ id: `item_${index}`, revision: index, published_at: NOW - index * DAY });
		}

		expect(await measurePostsPerDay(db, NOW)).toBeCloseTo(0.1, 5);
	});

	test("leaves out what a site published before it went quiet", async () => {
		await storeItem({ id: "item_1", revision: 1, published_at: NOW - 31 * DAY });
		await storeItem({ id: "item_2", revision: 2, published_at: NOW - 2 * DAY });

		// A rate a site used to run at stops describing it, which is the point of taking
		// the figure over a window rather than over everything ever stored.
		expect(await measurePostsPerDay(db, NOW)).toBeCloseTo(1 / 30, 5);
	});

	test("reports nothing published as a rate of nothing", async () => {
		expect(await measurePostsPerDay(db, NOW)).toBe(0);
	});
});

describe("pruneItems", () => {
	/** Five items in the order this object decided them, for the cap to count down through. */
	async function storeFiveItems(): Promise<void> {
		for (let revision of [1, 2, 3, 4, 5]) {
			await storeItem({
				id: `item_${revision}`,
				revision,
				published_at: NOW - revision * HOUR,
			});
		}
	}

	test("keeps the newest items by revision and drops everything below them", async () => {
		await storeFiveItems();

		expect(await pruneItems(db, 2, 5)).toBe(3);
		// By revision rather than by date: a publisher posting an entry dated four years
		// ago has published something new, and the newest two here are the oldest by date.
		expect((await storedItems()).map((item) => item.revision)).toEqual([4, 5]);
	});

	test("deletes nothing from a feed inside the cap", async () => {
		await storeFiveItems();

		expect(await pruneItems(db, 10, 5)).toBe(0);
		expect(await storedItems()).toHaveLength(5);
	});

	test("skips the probe entirely while the head is at or below the ceiling", async () => {
		await storeFiveItems();

		let exec = vi.spyOn(sql, "exec");
		expect(await pruneItems(db, 5, 5)).toBe(0);
		let statements = exec.mock.calls.map(([statement]) => String(statement));
		exec.mockRestore();

		// The counter takes a tick per insert, so it is never below the number of items
		// ever written: one integer comparison stands in for an offset probe that would
		// otherwise step through the whole index after every successful poll.
		expect(statements).toEqual([]);
	});

	test("empties the table when it is asked to keep nothing", async () => {
		await storeFiveItems();

		expect(await pruneItems(db, 0, 5)).toBe(5);
		expect(await storedItems()).toEqual([]);
	});

	test("leaves the head where it is, so a sweep has nothing to publish", async () => {
		await storeFeed({ head: 5 });
		await storeFiveItems();

		await pruneItems(db, 1, 5);

		expect((await loadFeed()).head).toBe(5);
	});

	test("hands the next discovery a revision above everything a sweep deleted", async () => {
		await storeFeed();
		serve([{ guid: "g1" }, { guid: "g2" }]);
		await pollFeed(db, { now: NOW });

		await pruneItems(db, 0, 2);

		serve([{ guid: "g3" }]);
		await pollFeed(db, { now: NOW + HOUR });

		// The counter lives in the feed's row rather than being a rowid, which SQLite
		// reuses after a delete: a number handed out twice would strand every cursor
		// above it and tell a subscriber to forget what they already have.
		expect((await storedItems()).map((item) => item.revision)).toEqual([3]);
		expect((await loadFeed()).head).toBe(3);
	});
});

/**
 * The one media file an entry attaches, which is what a play button is drawn from. No
 * duration and no poster image, because no format carries either reliably, so the columns
 * hold what the document actually said and nothing inferred.
 */
describe("displayableOf", () => {
	/** One entry of a parsed document, with only what these assertions turn on. */
	function entry(enclosures?: { url: string; type?: string; length?: number }[]) {
		return { guid: "one", title: "An episode", enclosures };
	}

	test("keeps three nulls for an entry attaching nothing", () => {
		let resolved = displayableOf(entry());

		expect(resolved.enclosure_url).toBeNull();
		expect(resolved.enclosure_type).toBeNull();
		expect(resolved.enclosure_length).toBeNull();
	});

	test("keeps an audio attachment, with what the publisher claimed about it", () => {
		let resolved = displayableOf(
			entry([{ url: "https://example.com/ep.mp3", type: "audio/mpeg", length: 1024 }]),
		);

		expect(resolved.enclosure_url).toBe("https://example.com/ep.mp3");
		expect(resolved.enclosure_type).toBe("audio/mpeg");
		expect(resolved.enclosure_length).toBe(1024);
	});

	test("keeps the first audio or video one and no other", () => {
		let resolved = displayableOf(
			entry([
				{ url: "https://example.com/cover.png", type: "image/png" },
				{ url: "https://example.com/ep.mp3", type: "audio/mpeg" },
				{ url: "https://example.com/ep.mp4", type: "video/mp4" },
			]),
		);

		expect(resolved.enclosure_url).toBe("https://example.com/ep.mp3");
		expect(resolved.enclosure_type).toBe("audio/mpeg");
	});

	test("keeps nothing from a feed attaching only images", () => {
		let resolved = displayableOf(
			entry([
				{ url: "https://example.com/one.png", type: "image/png" },
				{ url: "https://example.com/two.png", type: "image/png" },
			]),
		);

		expect(resolved.enclosure_url).toBeNull();
	});

	/** A publisher who attached a file and said nothing about it gets no player. */
	test("keeps nothing from an attachment with no type at all", () => {
		expect(displayableOf(entry([{ url: "https://example.com/mystery" }])).enclosure_url).toBeNull();
	});
});
