/**
 * Exercises what a poll learns about a publisher's hub, against a real SQLite database and
 * documents served by MSW, with no object around it.
 *
 * The assertions that matter are the ones about what a document is never allowed to move:
 * a `rel=self` decides the string a hub keys a subscription by and nothing else, and a
 * document speaking for another origin buys no subscription at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { SelectFeed } from "~/database/feed-schema";

import { FEED_JOURNAL, FEED_MIGRATIONS } from "~/database/feed-migrations";
import {
	feed as feedTable,
	HUB_COALESCE_MS,
	HUB_LEASE_SECONDS,
	HUB_RENEWAL_LEAD_MS,
	hubCoalesced,
	hubRenewalAt,
	hubTopicFor,
} from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";
import { FEED_ROW_ID, pollFeed } from "~/database/refresh";

/** The epoch milliseconds every test measures against, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

/** The address this app knows the feed by, which nothing read out of a document may move. */
const FEED_URL = "https://example.com/feed.xml";

/** The hub the documents in this file advertise. */
const HUB_URL = "https://hub.example.com/";

/** MSW server standing in for the origin the feed is published from. */
let server = setupServer();

let db: Database;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	let adapter = createSQLStorageDatabaseAdapter(createSqlStorage());
	await runMigrations(adapter, FEED_MIGRATIONS, FEED_JOURNAL);
	db = new Database(adapter);

	await db.create(feedTable, {
		id: FEED_ROW_ID,
		feed_url: FEED_URL,
		title: FEED_URL,
		head: 0,
		failure_count: 0,
		created_at: NOW,
		updated_at: NOW,
	});
});

/** What one document declares, with a default for everything a test ignores. */
interface Declared {
	self?: string;
	hub?: string;
	/** A `Link` header on the response, which outranks whatever the document says. */
	header?: string;
}

/** Publishes an RSS 2.0 document carrying `declared`, and one entry to notice. */
function origin(declared: Declared = {}): void {
	let relations = [
		declared.self === undefined ? "" : `<atom:link rel="self" href="${declared.self}"/>`,
		declared.hub === undefined ? "" : `<atom:link rel="hub" href="${declared.hub}"/>`,
	].join("\n");

	let document = `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
			<title>Example</title>
			<link>https://example.com</link>
			<description>An example feed</description>
			${relations}
			<item>
				<guid isPermaLink="false">g1</guid>
				<title>A post</title>
				<link>https://example.com/g1</link>
				<description>The body</description>
				<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>
			</item>
		</channel></rss>`;

	server.use(
		http.get(FEED_URL, () =>
			HttpResponse.xml(document, {
				headers: declared.header === undefined ? undefined : { link: declared.header },
			}),
		),
	);
}

/** The feed's single row, refused loudly so every test below reads what it asserts on. */
async function row(): Promise<SelectFeed> {
	let feed = await db.find(feedTable, { id: FEED_ROW_ID });
	if (feed === null) throw new Error("expected the feed row to exist");
	return feed;
}

describe("what a poll learns about a hub", () => {
	test("reports the hub the document advertises and stores it on the row", async () => {
		origin({ self: FEED_URL, hub: HUB_URL });

		let outcome = await pollFeed(db, { now: NOW });

		expect(outcome).toMatchObject({
			status: "ok",
			hub: { url: HUB_URL, source: "document", topic: FEED_URL },
		});
		expect((await row()).hub_url).toBe(HUB_URL);
	});

	test("takes the header's hub over the document's", async () => {
		origin({ self: FEED_URL, hub: HUB_URL, header: `<https://header.example.com/>; rel="hub"` });

		let outcome = await pollFeed(db, { now: NOW });

		expect(outcome).toMatchObject({
			status: "ok",
			hub: { url: "https://header.example.com/", source: "header" },
		});
	});

	test("reports no hub, and clears the stored one, when the document drops it", async () => {
		origin({ self: FEED_URL, hub: HUB_URL });
		await pollFeed(db, { now: NOW });

		origin({ self: FEED_URL });
		let outcome = await pollFeed(db, { now: NOW + 60_000 });

		expect(outcome).toMatchObject({ status: "ok", hub: null });
		expect((await row()).hub_url).toBeNull();
	});

	test("declines a topic on another origin, and subscribes to nothing", async () => {
		origin({ self: "https://elsewhere.example.net/feed.xml", hub: HUB_URL });

		let outcome = await pollFeed(db, { now: NOW });

		expect(outcome).toMatchObject({ status: "ok", hub: { url: HUB_URL, topic: null } });
	});

	test("takes a rel=self on the same origin as the topic, without moving the feed's own URL", async () => {
		origin({ self: "https://example.com/feeds/main.xml", hub: HUB_URL });

		let outcome = await pollFeed(db, { now: NOW });

		expect(outcome).toMatchObject({
			status: "ok",
			hub: { topic: "https://example.com/feeds/main.xml" },
		});

		/**
		 * The canonical URL is the catalog's, fixed so that nothing read out of a document can
		 * move it: the topic is a string a hub happens to key by, kept in a column of its own.
		 */
		expect((await row()).feed_url).toBe(FEED_URL);
	});

	test("falls back to the canonical URL as the topic when the document declares no self", async () => {
		origin({ hub: HUB_URL });

		expect(await pollFeed(db, { now: NOW })).toMatchObject({
			status: "ok",
			hub: { topic: FEED_URL },
		});
	});
});

describe("the topic a subscription is made with", () => {
	test("is the declared self on the feed's own origin", () => {
		expect(hubTopicFor(FEED_URL, "https://example.com/other.xml")).toBe(
			"https://example.com/other.xml",
		);
	});

	test("is the canonical URL when nothing was declared", () => {
		expect(hubTopicFor(FEED_URL, undefined)).toBe(FEED_URL);
	});

	test.each(["https://elsewhere.example.net/feed.xml", "not a url"])(
		"is nothing at all for %s",
		(declared) => {
			expect(hubTopicFor(FEED_URL, declared)).toBeNull();
		},
	);
});

describe("the lease and the coalescing window", () => {
	test("renews with room for two more attempts before the lease lapses", () => {
		let leaseUntil = NOW + HUB_LEASE_SECONDS * 1000;

		expect(hubRenewalAt(leaseUntil)).toBeLessThan(leaseUntil - HUB_RENEWAL_LEAD_MS);
		expect(hubRenewalAt(leaseUntil)).toBeGreaterThan(NOW);
	});

	test("answers a notification from the stored copy inside the window, and fetches outside it", () => {
		expect(hubCoalesced(NOW, NOW + HUB_COALESCE_MS - 1)).toBe(true);
		expect(hubCoalesced(NOW, NOW + HUB_COALESCE_MS)).toBe(false);
		expect(hubCoalesced(null, NOW)).toBe(false);
	});
});
