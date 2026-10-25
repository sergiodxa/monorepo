/**
 * Polls a complete feed (RFC 5005 §2) against a real SQLite database: an entry the
 * document stops listing becomes a tombstone at a fresh revision, a listed tombstone comes
 * back, and a feed without `fh:complete` never loses an entry by omitting it.
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

import type { SelectItem } from "~/database/feed-schema";

import { feedModels } from "~/app/models/feed";
import { FEED_ROW_ID, pollFeed } from "~/app/services/refresh";
import { FEED_JOURNAL, FEED_MIGRATIONS } from "~/database/feed-migrations";
import { items } from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";

/** The epoch milliseconds every poll runs at, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

/** The queue document of RFC 5005's complete-feed example. */
const FEED_URL = "http://netmovies.example.com/jdoe/queue/index.atom";

/** The two DVDs of the queue: the RFC's Casablanca, and one more for it to lose. */
const CASABLANCA = {
	id: "urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a",
	title: "Casablanca",
	summary: "Here's looking at you, kid...",
};
const METROPOLIS = {
	id: "urn:uuid:7c6f2a3e-0d5b-4e0a-9f55-0c5ab1d0e111",
	title: "Metropolis",
	summary: "The mediator between head and hands must be the heart.",
};

let server = setupServer();
let db: Database;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	let adapter = createSQLStorageDatabaseAdapter(createSqlStorage());
	await runMigrations(adapter, FEED_MIGRATIONS, FEED_JOURNAL);
	db = new Database(adapter);

	await feedModels.bind({ db }).feed.create({
		id: FEED_ROW_ID,
		feed_url: FEED_URL,
		title: FEED_URL,
		head: 0,
		failure_count: 0,
		created_at: NOW,
		updated_at: NOW,
	});
});

/**
 * RFC 5005's "Atom-formatted Complete Feed", listing `entries`. `complete: false` drops
 * the `fh:complete` element and nothing else.
 */
function queue(entries: (typeof CASABLANCA)[], complete = true): string {
	let listed = entries.map(
		(entry) => `<entry>
			<title>${entry.title}</title>
			<link href="http://netmovies.example.com/movies/${entry.title}"/>
			<id>${entry.id}</id>
			<updated>2003-12-13T18:30:02Z</updated>
			<summary>${entry.summary}</summary>
		</entry>`,
	);

	return `<?xml version="1.0" encoding="utf-8"?>
		<feed xmlns="http://www.w3.org/2005/Atom"
		 xmlns:fh="http://purl.org/syndication/history/1.0">
		 <title>NetMovies Queue</title>
		 <subtitle>The DVDs you'll receive next.</subtitle>
		 <link href="http://example.com/"/>
		 ${complete ? "<fh:complete/>" : ""}
		 <link rel="self" href="${FEED_URL}"/>
		 <updated>2003-12-13T18:30:02Z</updated>
		 <author><name>John Doe</name></author>
		 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
		 ${listed.join("\n")}
		</feed>`;
}

/** Answers the queue's URL with a document listing `entries`. */
function serve(entries: (typeof CASABLANCA)[], complete = true): void {
	server.use(
		http.get(FEED_URL, () =>
			HttpResponse.text(queue(entries, complete), {
				headers: { "content-type": "application/atom+xml" },
			}),
		),
	);
}

/** One stored item, by the guid the document gives it. */
async function loadItem(guid: string): Promise<SelectItem> {
	let stored = await db.findOne(items, { where: { guid } });
	if (stored === null) throw new Error(`No item stored as ${guid}`);
	return stored;
}

describe("a complete feed", () => {
	test("turns an entry it stops listing into a tombstone at a fresh revision", async () => {
		serve([CASABLANCA, METROPOLIS]);
		await pollFeed(db, { now: NOW });
		let before = await loadItem(METROPOLIS.id);

		serve([CASABLANCA]);
		let outcome = await pollFeed(db, { now: NOW + 1000 });

		expect(outcome).toMatchObject({ status: "ok", inserted: 0, edited: 0, removed: 1, head: 3 });

		let removed = await loadItem(METROPOLIS.id);
		expect(removed.removed_at).toBe(NOW + 1000);
		expect(removed.revision).toBe(3);
		expect(removed.sequence).toBe(before.sequence);
		expect((await loadItem(CASABLANCA.id)).removed_at).toBeNull();
	});

	test("leaves a tombstone out of the newest page a new subscriber is handed", async () => {
		serve([CASABLANCA, METROPOLIS]);
		await pollFeed(db, { now: NOW });
		serve([CASABLANCA]);
		await pollFeed(db, { now: NOW + 1000 });

		let models = feedModels.bind({ db });
		expect((await models.items.newest(50)).map((item) => item.guid)).toEqual([CASABLANCA.id]);
		expect((await models.items.pageAfter(2, 50)).map((item) => item.guid)).toEqual([METROPOLIS.id]);
	});

	test("removes a tombstone once, leaving it alone on the next poll", async () => {
		serve([CASABLANCA, METROPOLIS]);
		await pollFeed(db, { now: NOW });
		serve([CASABLANCA]);
		await pollFeed(db, { now: NOW + 1000 });

		expect(await pollFeed(db, { now: NOW + 2000 })).toMatchObject({ removed: 0, head: 3 });
	});

	test("brings back an entry it lists again, at a fresh revision", async () => {
		serve([CASABLANCA, METROPOLIS]);
		await pollFeed(db, { now: NOW });
		serve([CASABLANCA]);
		await pollFeed(db, { now: NOW + 1000 });

		serve([CASABLANCA, METROPOLIS]);
		let outcome = await pollFeed(db, { now: NOW + 2000 });

		expect(outcome).toMatchObject({ edited: 1, removed: 0, head: 4 });
		expect(await loadItem(METROPOLIS.id)).toMatchObject({ removed_at: null, revision: 4 });
	});

	test("points at no history, since it already holds every entry", async () => {
		serve([CASABLANCA]);
		expect(await pollFeed(db, { now: NOW })).toMatchObject({ history: null });
	});
});

describe("a feed without fh:complete", () => {
	test("keeps an entry it stops listing", async () => {
		serve([CASABLANCA, METROPOLIS], false);
		await pollFeed(db, { now: NOW });

		serve([CASABLANCA], false);
		expect(await pollFeed(db, { now: NOW + 1000 })).toMatchObject({ removed: 0, head: 2 });
		expect((await loadItem(METROPOLIS.id)).removed_at).toBeNull();
	});
});
