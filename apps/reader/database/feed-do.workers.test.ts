/**
 * Drives the canonical feed object the way the app does: inside workerd, through the
 * `FEED` binding this app's wrangler config declares, by name, over real RPC, against the
 * real KV namespace and the real D1 catalog beside it.
 *
 * What only the deployment can show is asserted here — that ten thousand followers of a
 * feed are one object and one fetch, that a publication is one KV write and a poll that
 * found nothing is none, and that a feed nobody follows leaves nothing behind in any of
 * the three stores.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { FeedStore } from "~/database/feed-do";

import schema from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { POLL_WARMUP_INTERVAL_MS, PURGE_GRACE_MS } from "~/database/feed-schema";
import { registerFeed } from "~/database/registry";

/** The wait a feed serves after its first failure, which is the shortest one there is. */
const BACKOFF_MS = 5 * 60 * 1000;

/** MSW server standing in for the origins the feeds are published from. */
let server = setupServer();

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });

	// The shipped migration rather than a `CREATE TABLE` written for the tests, so the
	// catalog these objects write to is the one `wrangler d1 migrations` applies. D1's
	// `exec` reads one statement per line, so the prose is dropped and what is left of
	// each statement is folded onto a line of its own.
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
 * A URL no other test in this file uses. Durable Object storage, KV and D1 all outlive a
 * test, and the whole point of the catalog is that one URL is one feed, so each test gets
 * a feed of its own rather than depending on the order the tests ran in.
 */
function feedUrl(): string {
	return `https://${crypto.randomUUID()}.example.com/feed.xml`;
}

/** A reader nobody else in this file subscribes as. */
function reader(): string {
	return `sub-${crypto.randomUUID()}`;
}

/** One entry of a published document, with a default for everything a test ignores. */
interface Entry {
	guid: string;
	title?: string;
	description?: string;
}

/** An RSS 2.0 document carrying `entries`, which is what an origin answers with. */
function rss(entries: Entry[]): string {
	let published = entries.map(
		(entry) => `<item>
			<guid isPermaLink="false">${entry.guid}</guid>
			<title>${entry.title ?? "A post"}</title>
			<link>https://example.com/${entry.guid}</link>
			<description>${entry.description ?? "The body"}</description>
			<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>
		</item>`,
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0"><channel>
			<title>Example</title>
			<link>https://example.com</link>
			<description>An example feed</description>
			${published.join("\n")}
		</channel></rss>`;
}

/** The origin one feed is published from, and a count of what it was actually asked for. */
interface Origin {
	/** Serves these entries from here on, to whoever asks next. */
	publish(entries: Entry[]): void;
	/** Answers with a status and no document, for the branch that backs a feed off. */
	fail(status: number): void;
	/** Answers `304` to a poll that echoes the validator, as an unchanged feed does. */
	validate(etag: string): void;
	/** How many times the feed has actually been fetched, which is the point of all this. */
	fetches(): number;
}

/** Publishes `entries` at `url`, and counts what is asked of it. */
function origin(url: string, entries: Entry[] = []): Origin {
	let document = rss(entries);
	let status = 200;
	let etag: string | null = null;
	let fetched = 0;

	server.use(
		http.get(url, ({ request }) => {
			fetched += 1;

			if (status !== 200) return new HttpResponse(null, { status });

			if (etag !== null && request.headers.get("if-none-match") === etag) {
				return new HttpResponse(null, { status: 304, headers: { etag } });
			}

			return HttpResponse.xml(document, {
				headers: etag === null ? undefined : { etag },
			});
		}),
	);

	return {
		publish(next) {
			document = rss(next);
			status = 200;
		},
		fail(next) {
			status = next;
		},
		validate(next) {
			etag = next;
		},
		fetches: () => fetched,
	};
}

/** Where a feed publishes its head, which is all the freshness index is allowed to hold. */
function headKey(feedId: string): string {
	return `feed:${feedId}:head`;
}

/** The catalog row behind a feed, read without going through the registry's own SQL. */
async function catalogRow(feedId: string): Promise<Record<string, unknown> | null> {
	return await env.PLATFORM_DB.prepare("select * from feeds where id = ?").bind(feedId).first();
}

/** The alarm the object has armed, which is what says whether it is polling or purging. */
function armedAlarm(feedId: string): Promise<number | null> {
	return runInDurableObject(env.FEED.getByName(feedId), (_instance, state) =>
		state.storage.getAlarm(),
	);
}

/** A subscription, refused loudly here so every test below reads what it asserts on. */
function joined(result: FeedStore.SubscribeResult) {
	if (!result.ok) throw new Error(`expected a subscription, got ${result.reason}`);
	return result;
}

describe("following a feed", () => {
	test("fetches the document once however many readers follow it", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }, { guid: "g2" }]);
		let feedId = await registerFeed(url, "Example");

		let first = joined(await env.FEED.getByName(feedId).subscribe(reader(), url));
		let second = joined(await env.FEED.getByName(feedId).subscribe(reader(), url));

		// The traffic a publisher sees is a function of how many feeds are followed rather
		// than of how many people follow each one: the second follower reaches an object
		// that has already done the fetching.
		expect(source.fetches()).toBe(1);
		expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
		expect(second.head).toBe(first.head);
	});

	test("hands both readers one object, addressed by the id the catalog assigned", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let again = await registerFeed(url, "Example");

		await env.FEED.getByName(feedId).subscribe(reader(), url);

		expect(again).toBe(feedId);
		expect(env.FEED.getByName(again).id.toString()).toBe(env.FEED.getByName(feedId).id.toString());
	});

	test("publishes one head for the feed and nothing addressed to a reader", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }, { guid: "g2" }]);
		let feedId = await registerFeed(url, "Example");
		let mine = reader();
		let yours = reader();

		let subscription = joined(await env.FEED.getByName(feedId).subscribe(mine, url));
		await env.FEED.getByName(feedId).subscribe(yours, url);

		expect(await env.KV.get(headKey(feedId))).toBe(String(subscription.head));

		let keys = (await env.KV.list()).keys.map((key) => key.name);

		// Per-reader state in a shared store would be the fan-out this design removed,
		// wearing a different name, so the whole namespace holds one key for this feed.
		expect(keys.filter((name) => name.includes(feedId))).toEqual([headKey(feedId)]);
		expect(keys.some((name) => name.includes(mine) || name.includes(yours))).toBe(false);
	});

	test("hands a new subscriber the feed's own description of itself", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");

		let subscription = joined(await env.FEED.getByName(feedId).subscribe(reader(), url));

		expect(subscription.feed).toMatchObject({
			feedUrl: url,
			title: "Example",
			siteUrl: "https://example.com/",
		});
		// The measured rate comes back with the metadata, so a feed that is obviously a
		// firehose can be slowed down the moment it is followed rather than afterwards.
		expect(subscription.feed.postsPerDay).toBeGreaterThanOrEqual(0);
	});

	test("refuses a feed nobody can retrieve, leaving nothing for the next reader to join", async () => {
		let url = feedUrl();
		origin(url).fail(500);
		let feedId = await registerFeed(url, "Example");

		expect(await env.FEED.getByName(feedId).subscribe(reader(), url)).toEqual({
			ok: false,
			reason: "unreachable",
		});

		// A refusal crosses the boundary as a value: a thrown error would arrive as a bare
		// `Error` the caller cannot tell one refusal from another by.
		expect(await env.FEED.getByName(feedId).getHead()).toBe(0);
	});
});

describe("polling", () => {
	test("publishes the new head, and stamps the catalog, when a poll stores something", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		source.publish([{ guid: "g2" }, { guid: "g1" }]);
		let outcome = await env.FEED.getByName(feedId).refresh("manual");

		expect(outcome).toEqual({ ok: true, status: "ok", inserted: 1, edited: 0, head: 2 });
		expect(await env.KV.get(headKey(feedId))).toBe("2");
		expect(await catalogRow(feedId)).toMatchObject({ last_active_at: expect.any(Number) });
	});

	test("writes no head for a poll that stored nothing new", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		// Dropped so that a publication is visible as the key coming back, rather than as
		// a value that would have looked the same either way.
		await env.KV.delete(headKey(feedId));

		let outcome = await env.FEED.getByName(feedId).refresh("manual");

		expect(outcome).toEqual({ ok: true, status: "ok", inserted: 0, edited: 0, head: 1 });
		expect(source.fetches()).toBe(2);
		expect(await env.KV.get(headKey(feedId))).toBeNull();
		// The stamp moves only when a poll actually stored something, which is what makes
		// the column mean what a list of feeds would suggest it means.
		expect(await catalogRow(feedId)).toMatchObject({ last_active_at: null });
	});

	test("publishes no head and moves no stamp when the origin answers 304", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		source.validate("v1");
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		await env.KV.delete(headKey(feedId));
		let outcome = await env.FEED.getByName(feedId).refresh("manual");

		expect(outcome).toEqual({ ok: true, status: "not_modified", head: 1 });
		expect(await env.KV.get(headKey(feedId))).toBeNull();
		expect(await catalogRow(feedId)).toMatchObject({ last_active_at: null });
	});

	test("refreshes on demand whenever a reader asks, and waits out a backoff when scheduled", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		source.fail(503);
		expect(await env.FEED.getByName(feedId).refresh("manual")).toMatchObject({
			ok: false,
			status: "http_error",
		});

		let failed = source.fetches();
		source.publish([{ guid: "g2" }, { guid: "g1" }]);

		// The schedule stays off an origin that has been failing, and says so as a feed
		// that has nothing new rather than as a failure of its own.
		expect(await env.FEED.getByName(feedId).refresh("scheduled")).toEqual({
			ok: true,
			status: "not_modified",
			head: 1,
		});
		expect(source.fetches()).toBe(failed);

		// A reader asking on the spot is the one case the backoff was never meant to hold
		// back: a failing feed is exactly the one they came here to ask about.
		expect(await env.FEED.getByName(feedId).refresh("manual")).toEqual({
			ok: true,
			status: "ok",
			inserted: 1,
			edited: 0,
			head: 2,
		});
		expect(source.fetches()).toBe(failed + 1);
	});

	test("keeps a failing feed at its band while the backoff is shorter than one", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		source.fail(503);
		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		// The band is already a floor on how often anything is touched, so one failure on
		// a feed polled hourly costs its readers nothing: five minutes is shorter than the
		// band and changes nothing about when the next attempt happens.
		let armed = await armedAlarm(feedId);
		expect(armed).toBeGreaterThan(Date.now() + BACKOFF_MS);
		expect(armed).toBeLessThanOrEqual(Date.now() + POLL_WARMUP_INTERVAL_MS);
		expect(source.fetches()).toBe(2);
	});

	test("waits out a backoff that has grown past its band", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		// A reader asking on the spot ignores the backoff, which is what lets one climb:
		// five, ten, twenty, forty and eighty minutes, the last of them past the band.
		source.fail(503);
		for (let attempt = 0; attempt < 5; attempt += 1) {
			await env.FEED.getByName(feedId).refresh("manual");
		}

		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		// The band is a claim about what a feed publishes, and an origin that is not
		// answering is publishing nothing this system can see, so the backoff wins.
		let armed = await armedAlarm(feedId);
		expect(armed).toBeGreaterThan(Date.now() + POLL_WARMUP_INTERVAL_MS);
		expect(armed).toBeLessThanOrEqual(Date.now() + 16 * BACKOFF_MS);
	});

	test("returns a feed to its band on the first answer, a 304 included", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		source.validate("v1");
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		source.fail(503);
		for (let attempt = 0; attempt < 5; attempt += 1) {
			await env.FEED.getByName(feedId).refresh("manual");
		}

		source.publish([{ guid: "g1" }]);
		expect(await env.FEED.getByName(feedId).refresh("manual")).toMatchObject({
			status: "not_modified",
		});

		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		// An unchanged feed is an answering feed, so the wait that was protecting a
		// struggling origin is gone and the band is what decides again.
		expect(await armedAlarm(feedId)).toBeLessThanOrEqual(Date.now() + POLL_WARMUP_INTERVAL_MS);
	});

	test("polls on the alarm while anybody is subscribed, and comes back at its band", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		source.publish([{ guid: "g2" }, { guid: "g1" }]);
		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		expect(source.fetches()).toBe(2);
		expect(await env.FEED.getByName(feedId).getHead()).toBe(2);

		// A feed inside its first day is polled hourly whatever its document measured:
		// a document carries only its newest entries, so a truncated one can only make a
		// feed look slower than it is, and slow is the expensive answer to be wrong about.
		let armed = await armedAlarm(feedId);
		expect(armed).toBeGreaterThan(Date.now() + POLL_WARMUP_INTERVAL_MS - 10_000);
		expect(armed).toBeLessThanOrEqual(Date.now() + POLL_WARMUP_INTERVAL_MS);
	});

	test("reports what the last poll recorded, with the head the hint approximates", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		source.fail(404);
		await env.FEED.getByName(feedId).refresh("manual");

		expect(await env.FEED.getByName(feedId).health()).toMatchObject({
			status: "http_error",
			httpStatus: 404,
			failureCount: 1,
			head: 1,
		});
	});
});

describe("synchronizing a subscriber", () => {
	test("answers with the revisions above a cursor, oldest first", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }, { guid: "g2" }, { guid: "g3" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		let whole = await env.FEED.getByName(feedId).getItemsAfter(0);

		// The order this object decided things in, so a subscriber can stop anywhere and
		// come back to a cursor with no hole under it.
		expect(whole.items.map((item) => item.revision)).toEqual([1, 2, 3]);
		expect(whole.head).toBe(3);

		let rest = await env.FEED.getByName(feedId).getItemsAfter(2);
		expect(rest.items.map((item) => item.revision)).toEqual([3]);

		let current = await env.FEED.getByName(feedId).getItemsAfter(3);
		expect(current.items).toEqual([]);
	});

	test("answers no more than the page a caller asked for", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }, { guid: "g2" }, { guid: "g3" }]);
		let feedId = await registerFeed(url, "Example");
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		let page = await env.FEED.getByName(feedId).getItemsAfter(0, 2);

		expect(page.items.map((item) => item.revision)).toEqual([1, 2]);
		expect(page.head).toBe(3);
	});

	test("puts an edited item back in front of a subscriber whose cursor had passed it", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1", description: "A typo" }]);
		let feedId = await registerFeed(url, "Example");
		let subscription = joined(await env.FEED.getByName(feedId).subscribe(reader(), url));
		let [stored] = subscription.items;

		source.publish([{ guid: "g1", description: "The typo, fixed" }]);
		await env.FEED.getByName(feedId).refresh("manual");

		let page = await env.FEED.getByName(feedId).getItemsAfter(1);

		// Without the second counter a correction would never reach a reader who had
		// already materialized the item, whose sequence is below their cursor forever.
		expect(page.items.map((item) => item.summary)).toEqual(["The typo, fixed"]);
		expect(page.items.map((item) => item.id)).toEqual([stored?.id]);
		expect(page.head).toBe(2);
	});
});

describe("the end of a feed's life", () => {
	test("keeps polling while anybody is left, and says so", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let mine = reader();
		await env.FEED.getByName(feedId).subscribe(mine, url);
		await env.FEED.getByName(feedId).subscribe(reader(), url);

		expect(await env.FEED.getByName(feedId).unsubscribe(mine)).toEqual({ remaining: true });

		expect(await catalogRow(feedId)).toMatchObject({ retired_at: null });
		expect(await armedAlarm(feedId)).toBeLessThanOrEqual(Date.now() + POLL_WARMUP_INTERVAL_MS);
	});

	test("stops polling, retires the catalog row and schedules the purge on the last leaving", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let only = reader();
		await env.FEED.getByName(feedId).subscribe(only, url);

		expect(await env.FEED.getByName(feedId).unsubscribe(only)).toEqual({ remaining: false });

		// The row stays: a feed serving out its week is visible as exactly that, and a
		// reader who follows it again inside the week gets the same id and the same items.
		expect(await catalogRow(feedId)).toMatchObject({ retired_at: expect.any(Number) });

		let armed = await armedAlarm(feedId);
		expect(armed).toBeGreaterThan(Date.now() + PURGE_GRACE_MS - 10_000);
		expect(armed).toBeLessThanOrEqual(Date.now() + PURGE_GRACE_MS);
	});

	test("calls the purge off for a reader who follows the feed again inside the week", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let only = reader();
		await env.FEED.getByName(feedId).subscribe(only, url);
		await env.FEED.getByName(feedId).unsubscribe(only);

		let rejoined = joined(await env.FEED.getByName(feedId).subscribe(reader(), url));

		// One fetch, not a re-download of everything the feed has ever published: the
		// items are all still here, which is the point of the grace period.
		expect(source.fetches()).toBe(1);
		expect(rejoined.items.map((item) => item.guid)).toEqual(["g1"]);
		expect(await catalogRow(feedId)).toMatchObject({ retired_at: null });
		expect(await armedAlarm(feedId)).toBeLessThanOrEqual(Date.now() + POLL_WARMUP_INTERVAL_MS);
	});

	test("purges the head, the catalog row and the items when the week runs out", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let only = reader();
		await env.FEED.getByName(feedId).subscribe(only, url);
		await env.FEED.getByName(feedId).unsubscribe(only);

		// An alarm firing with subscribers polls; an alarm firing without them purges,
		// which is a question about the subscribers table rather than about a flag.
		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		expect(await env.KV.get(headKey(feedId))).toBeNull();
		expect(await catalogRow(feedId)).toBeNull();
	});

	test("keeps none of the feed's rows in its own storage either", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let only = reader();
		await env.FEED.getByName(feedId).subscribe(only, url);
		await env.FEED.getByName(feedId).unsubscribe(only);

		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		/**
		 * The rows are what a purge is for, and they are gone. The tables stand: this
		 * instance is still live and still answering calls, so it is left looking like an
		 * object nobody has subscribed to yet rather than one whose every method fails on a
		 * missing table until the runtime happens to evict it.
		 */
		let held = await runInDurableObject(env.FEED.getByName(feedId), (_instance, state) => ({
			feed: state.storage.sql.exec("select count(*) as held from feed").one()["held"],
			items: state.storage.sql.exec("select count(*) as held from items").one()["held"],
			subscribers: state.storage.sql.exec("select count(*) as held from subscribers").one()["held"],
		}));

		expect(held).toEqual({ feed: 0, items: 0, subscribers: 0 });
	});

	test("answers a call that arrives after the purge rather than failing on a dropped table", async () => {
		let url = feedUrl();
		origin(url, [{ guid: "g1" }]);
		let feedId = await registerFeed(url, "Example");
		let only = reader();
		await env.FEED.getByName(feedId).subscribe(only, url);
		await env.FEED.getByName(feedId).unsubscribe(only);

		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		// A purged object is an object with no feed row, which every method here already
		// has an answer for; the schema it reads that answer out of goes with the purge.
		expect(await env.FEED.getByName(feedId).getHead()).toBe(0);
		expect(await env.FEED.getByName(feedId).health()).toBeNull();
	});

	test("reinitializes and republishes both for the next reader to follow the feed", async () => {
		let url = feedUrl();
		let source = origin(url, [{ guid: "g1" }, { guid: "g2" }]);
		let feedId = await registerFeed(url, "Example");
		let only = reader();
		await env.FEED.getByName(feedId).subscribe(only, url);
		await env.FEED.getByName(feedId).unsubscribe(only);
		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		// The purge took the row with it, so following the URL again mints a fresh id, and
		// the object it names has never fetched anything.
		let revived = await registerFeed(url, "Example");
		let subscription = joined(await env.FEED.getByName(revived).subscribe(reader(), url));

		expect(revived).not.toBe(feedId);
		expect(source.fetches()).toBe(2);
		expect(subscription.items.map((item) => item.guid).sort()).toEqual(["g1", "g2"]);
		expect(await env.KV.get(headKey(revived))).toBe(String(subscription.head));
		expect(await catalogRow(revived)).not.toBeNull();
	});
});
