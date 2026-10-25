/**
 * Walks a feed's history (RFC 5005 §3–4) against MSW serving the specification's own
 * subscription and archive documents, storing into a real SQLite database: the chain is
 * followed to its end within both budgets, a refusal ends it, a fault asks for a retry,
 * and a retried walk passes the pages it stored with conditional requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Feed } from "@sdxc/feed";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { HistoryStore } from "~/app/services/history";

import { feedModels } from "~/app/models/feed";
import { walkHistory } from "~/app/services/history";
import { FEED_ROW_ID, historyStartOf, storeHistory } from "~/app/services/refresh";
import { FEED_JOURNAL, FEED_MIGRATIONS } from "~/database/feed-migrations";
import { feed as feedTable, items } from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";

/** The epoch milliseconds every write is stamped with. */
const NOW = 1_800_000_000_000;

const SUBSCRIPTION_URL = "http://example.org/index.atom";
const NOVEMBER_URL = "http://example.org/2003/11/index.atom";
const OCTOBER_URL = "http://example.org/2003/10/index.atom";

/** RFC 5005 §4, "Atom-formatted Subscription Document". */
const SUBSCRIPTION = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
 <title>Example Feed</title>
 <link href="http://example.org/"/>
 <link rel="self" href="http://example.org/index.atom"/>
 <link rel="prev-archive"
  href="http://example.org/2003/11/index.atom"/>
 <updated>2003-12-13T18:30:02Z</updated>
 <author>
   <name>John Doe</name>
 </author>
 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
 <entry>
   <title>Atom-Powered Robots Run Amok</title>
   <link href="http://example.org/2003/12/13/atom03"/>
   <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
   <updated>2003-12-13T18:30:02Z</updated>
   <summary>Some text.</summary>
 </entry>
</feed>`;

/** RFC 5005 §4, "Atom-formatted Archive Document". */
const NOVEMBER = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
 xmlns:fh="http://purl.org/syndication/history/1.0">
 <title>Example Feed</title>
 <link rel="current" href="http://example.org/index.atom"/>
 <link rel="self" href="http://example.org/2003/11/index.atom"/>
 <fh:archive/>
 <link rel="prev-archive"
  href="http://example.org/2003/10/index.atom"/>
 <updated>2003-11-24T12:00:00Z</updated>
 <author>
   <name>John Doe</name>
 </author>
 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
 <entry>
   <title>Atom-Powered Robots Scheduled To Run Amok</title>
   <link href="http://example.org/2003/11/24/robots_coming"/>
   <id>urn:uuid:cdef5c6d5-gff8-4ebb-assa-80dwe44efkjo</id>
   <updated>2003-11-24T12:00:00Z</updated>
   <summary>Some text from an old, different entry.</summary>
 </entry>
</feed>`;

/** The archive before November, shaped like it and the oldest: it names no prev-archive. */
const OCTOBER = NOVEMBER.replace(
	`<link rel="prev-archive"
  href="http://example.org/2003/10/index.atom"/>`,
	"",
)
	.replace("http://example.org/2003/11/index.atom", OCTOBER_URL)
	.replace("urn:uuid:cdef5c6d5-gff8-4ebb-assa-80dwe44efkjo", "urn:uuid:0a1b2c3d-october-entry")
	.replace("Scheduled To Run Amok", "Rumoured");

let server = setupServer();
let db: Database;

/** Every request the origin received, as method and URL with any validator it carried. */
let requests: { url: string; ifNoneMatch: string | null }[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	requests = [];
	let adapter = createSQLStorageDatabaseAdapter(createSqlStorage());
	await runMigrations(adapter, FEED_MIGRATIONS, FEED_JOURNAL);
	db = new Database(adapter);

	await feedModels.bind({ db }).feed.create({
		id: FEED_ROW_ID,
		feed_url: SUBSCRIPTION_URL,
		title: "Example Feed",
		head: 0,
		failure_count: 0,
		created_at: NOW,
		updated_at: NOW,
	});
});

/**
 * Serves `body` at `url` with an ETag naming the URL, answering 304 to a request that
 * sends it back, the way an archive that never changes is served.
 */
function archive(url: string, body: string) {
	let etag = `"${url}"`;

	return http.get(url, ({ request }) => {
		let ifNoneMatch = request.headers.get("if-none-match");
		requests.push({ url, ifNoneMatch });

		if (ifNoneMatch === etag) return new HttpResponse(null, { status: 304, headers: { etag } });
		return HttpResponse.text(body, { headers: { "content-type": "application/atom+xml", etag } });
	});
}

/** The feed's object as a walk sees it, over the test's own database. */
function store(): HistoryStore {
	let models = feedModels.bind({ db });

	return {
		async historyPage(url) {
			let page = await models.pages.at(url);
			if (page === null) return null;
			return {
				url,
				etag: page.etag,
				lastModified: page.last_modified,
				nextUrl: page.next_url,
			};
		},

		async storeHistory(page, entries) {
			let stored = await storeHistory(db, entries, NOW);
			await models.pages.record({
				url: page.url,
				etag: page.etag,
				last_modified: page.lastModified,
				next_url: page.nextUrl,
				fetched_at: NOW,
			});
			return stored;
		},
	};
}

/** The guids stored, oldest decided first. */
async function storedGuids(): Promise<string[]> {
	let rows = await db.findMany(items, { orderBy: [["revision", "asc"]] });
	return rows.map((row) => row.guid);
}

describe("historyStartOf", () => {
	test("walks an archived feed from its subscription document's prev-archive", () => {
		let feed = unwrap(Feed.parse(SUBSCRIPTION));
		expect(historyStartOf(feed)).toEqual({ url: NOVEMBER_URL, rel: "prev-archive" });
	});

	test("walks a paged feed from its next page", () => {
		let paged = SUBSCRIPTION.replace('rel="prev-archive"', 'rel="next"');
		expect(historyStartOf(unwrap(Feed.parse(paged)))).toEqual({ url: NOVEMBER_URL, rel: "next" });
	});

	test("prefers prev-archive when a document names both", () => {
		let both = SUBSCRIPTION.replace(
			"<updated>",
			'<link rel="next" href="http://example.org/index.atom?page=2"/><updated>',
		);
		expect(historyStartOf(unwrap(Feed.parse(both)))?.rel).toBe("prev-archive");
	});

	test("has nothing to walk for a feed naming neither", () => {
		let alone = SUBSCRIPTION.replace(/<link rel="prev-archive"\s+href="[^"]+"\/>/, "");
		expect(historyStartOf(unwrap(Feed.parse(alone)))).toBeNull();
	});
});

describe("storeHistory", () => {
	test("stores only entries the feed does not hold, leaving a held one as it was", async () => {
		let subscription = unwrap(Feed.parse(SUBSCRIPTION)).items;
		await storeHistory(db, subscription, NOW);
		let held = await db.findOne(items, { where: { guid: subscription[0]?.guid ?? "" } });

		let edited = subscription.map((item) => ({ ...item, title: "Rewritten in an archive" }));
		let stored = await storeHistory(
			db,
			[...edited, ...unwrap(Feed.parse(NOVEMBER)).items],
			NOW + 1,
		);

		expect(stored).toEqual({ inserted: 1, head: 2 });
		expect(await db.findOne(items, { where: { guid: held?.guid ?? "" } })).toEqual(held);
		expect((await db.find(feedTable, { id: FEED_ROW_ID }))?.head).toBe(2);
	});
});

describe("walkHistory", () => {
	test("follows prev-archive to the oldest archive, storing each one's entries", async () => {
		server.use(archive(NOVEMBER_URL, NOVEMBER), archive(OCTOBER_URL, OCTOBER));

		let outcome = await walkHistory(store(), { url: NOVEMBER_URL, rel: "prev-archive" });

		expect(outcome).toEqual({ status: "done", reason: "end", pages: 2, inserted: 2 });
		expect(await storedGuids()).toEqual([
			"urn:uuid:cdef5c6d5-gff8-4ebb-assa-80dwe44efkjo",
			"urn:uuid:0a1b2c3d-october-entry",
		]);
	});

	test("follows next through a paged feed", async () => {
		let page2 = "http://example.org/pages/2.atom";
		let page3 = "http://example.org/pages/3.atom";
		server.use(
			archive(
				page2,
				NOVEMBER.replace('rel="prev-archive"', 'rel="next"').replace(OCTOBER_URL, page3),
			),
			archive(page3, OCTOBER),
		);

		let outcome = await walkHistory(store(), { url: page2, rel: "next" });

		expect(outcome).toMatchObject({ status: "done", reason: "end", pages: 2, inserted: 2 });
	});

	test("stops at the page budget", async () => {
		server.use(archive(NOVEMBER_URL, NOVEMBER), archive(OCTOBER_URL, OCTOBER));

		let outcome = await walkHistory(
			store(),
			{ url: NOVEMBER_URL, rel: "prev-archive" },
			{ pageLimit: 1 },
		);

		expect(outcome).toEqual({ status: "done", reason: "page-limit", pages: 1, inserted: 1 });
		expect(requests.map((request) => request.url)).toEqual([NOVEMBER_URL]);
	});

	test("stops at the entry budget, cutting the page that reaches it", async () => {
		server.use(archive(NOVEMBER_URL, NOVEMBER), archive(OCTOBER_URL, OCTOBER));

		let outcome = await walkHistory(
			store(),
			{ url: NOVEMBER_URL, rel: "prev-archive" },
			{ entryLimit: 1 },
		);

		expect(outcome).toEqual({ status: "done", reason: "entry-limit", pages: 1, inserted: 1 });
	});

	test("stops where an archive points back at one it already walked", async () => {
		server.use(
			archive(NOVEMBER_URL, NOVEMBER),
			archive(
				OCTOBER_URL,
				OCTOBER.replace(
					"<fh:archive/>",
					`<fh:archive/><link rel="prev-archive" href="${NOVEMBER_URL}"/>`,
				),
			),
		);

		let outcome = await walkHistory(store(), { url: NOVEMBER_URL, rel: "prev-archive" });

		expect(outcome).toMatchObject({ status: "done", reason: "loop", pages: 2 });
	});

	test("ends, keeping what it stored, when the publisher refuses an archive", async () => {
		server.use(
			archive(NOVEMBER_URL, NOVEMBER),
			http.get(OCTOBER_URL, () => new HttpResponse(null, { status: 410 })),
		);

		let outcome = await walkHistory(store(), { url: NOVEMBER_URL, rel: "prev-archive" });

		expect(outcome).toEqual({ status: "done", reason: "refused", pages: 2, inserted: 1 });
	});

	test("asks for a retry on a fault, which passes stored pages with a 304", async () => {
		server.use(
			archive(NOVEMBER_URL, NOVEMBER),
			http.get(OCTOBER_URL, () => new HttpResponse(null, { status: 503 }), { once: true }),
		);

		let first = await walkHistory(store(), { url: NOVEMBER_URL, rel: "prev-archive" });
		expect(first).toMatchObject({ status: "retry", pages: 2, inserted: 1 });

		server.use(archive(OCTOBER_URL, OCTOBER));
		requests = [];

		let retried = await walkHistory(store(), { url: NOVEMBER_URL, rel: "prev-archive" });

		expect(retried).toEqual({ status: "done", reason: "end", pages: 2, inserted: 1 });
		expect(requests).toEqual([
			{ url: NOVEMBER_URL, ifNoneMatch: `"${NOVEMBER_URL}"` },
			{ url: OCTOBER_URL, ifNoneMatch: null },
		]);
	});
});
