/**
 * Drives search against the object that owns it: a real SQLite, the reader's own rows, and
 * the bounded step a page of a search actually runs as.
 *
 * What is asserted here is that a search matches the three columns on the row and nothing
 * else, that the tier's window and the step's floor between them decide how far one page
 * walks, that a step filling no page still continues — through a cursor minted from the
 * floor rather than from a row — that the cursors a search mints and the ones the plain
 * timeline mints are the same object, that what stopped a page is reported as the step, the
 * window or the end of the archive, and that a kept query stores a narrowing and refuses
 * the twenty-first rather than evicting one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectNamespace, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { decodeCursor } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Tier } from "~/app/lib/entitlement";
import type { FeedDO } from "~/database/feed-do";
import type { UserStore } from "~/database/user-do";

import { limitsOf } from "~/app/lib/entitlement";
import { FLAG_SET, flags } from "~/app/lib/flags";
import { SAVED_SEARCH_LIMIT } from "~/database/schema";
import { UserDO } from "~/database/user-do";

/** The bindings the modules under test read off `cloudflare:workers`. */
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** The moment every test here runs at, so a window derived from the clock is decidable. */
const NOW = Date.UTC(2026, 5, 1);

const FEED_ID = "feed-1";

/** The step shipped by default, which is what a test overrides to widen or narrow a page. */
const DEFAULT_STEP_DAYS = 90;

/** Puts one number behind the flag that decides how far a search page walks. */
async function setStep(days: number): Promise<void> {
	await flags.setProvider(
		new EngineProvider(
			createEngine({
				store: new InMemoryFlagStore({
					flags: {
						...FLAG_SET.flags,
						"reader-search-step-days": {
							variants: { season: days },
							defaultVariant: "season",
						},
					},
				}),
			}),
		),
	);
}

/** The feed object as this file needs it, which is only what unfollowing tells it. */
function feedStub() {
	return {
		async unsubscribe(): Promise<{ remaining: boolean }> {
			return { remaining: false };
		},
	};
}

beforeEach(async () => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);

	bindings.current = {
		KV: createKVNamespace(),
		FEED: createDurableObjectNamespace<FeedDO>(() => feedStub()),
	};

	await flags.setProvider(
		new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Builds a reader's object, waits out the boot a first request would, and sets their tier. */
async function createReader(
	tier: Tier = "paid",
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: `sub-${crypto.randomUUID()}` });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	if (tier !== "free") {
		await user.setTier({ entitled: tier, cancelled: false, readAt: Date.now(), source: "billing" });
	}

	return { state, user };
}

/** One subscription row, written straight into storage for a test that follows nothing. */
function seedFeed(state: DurableObjectStateMock, id = FEED_ID): void {
	state.storage.sql.exec(
		`INSERT INTO feeds
			(id, feed_id, feed_url, site_url, title, description, language, image_url,
			 cursor, velocity, unfollowed_at, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, 0, 'evergreen', NULL, 0, 0)`,
		id,
		`canonical-${id}`,
		`https://${id}.example.com/feed.xml`,
		id,
	);
}

/** One stored post, in the columns a search reads and the ones it must leave alone. */
interface Post {
	id: string;
	publishedAt: number;
	title?: string;
	summary?: string | null;
	author?: string | null;
	url?: string | null;
	readAt?: number | null;
	folderId?: string | null;
}

/** Posts of one subscription, written straight into storage. */
function seedItems(state: DurableObjectStateMock, posts: readonly Post[], feedId = FEED_ID): void {
	for (let post of posts) {
		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 folder_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 0)`,
			post.id,
			feedId,
			post.id,
			post.title ?? post.id,
			post.url ?? null,
			post.summary ?? null,
			post.author ?? null,
			post.publishedAt,
			post.readAt ?? null,
			post.folderId ?? null,
		);
	}
}

/** The ids of one page, which is what ordering and stability assertions compare. */
function ids(result: UserStore.TimelineResult): string[] {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	return result.items.map((item) => item.id);
}

/** The span a searched page reported, which a page of a plain list never carries. */
function spanOf(result: UserStore.TimelineResult): UserStore.SearchSpan {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	if (result.search === null) throw new Error("expected a searched page");

	return result.search;
}

/** The cursors a page offers, so a boundary can be followed and read back. */
function cursorsOf(result: UserStore.TimelineResult): { next: string | null; prev: string | null } {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	return result.cursors;
}

/** The ordering values a cursor carries, for asserting what a boundary was minted from. */
function boundaryOf(cursor: string): { columns: string[]; values: unknown[] } {
	let decoded = decodeCursor(cursor);
	if (isFailure(decoded)) throw new Error("expected a cursor this app minted");

	return { columns: decoded.data.columns, values: decoded.data.values };
}

describe("readingQueue, searched", () => {
	test("matches the title, the summary and the author, and nothing else on the row", async () => {
		let { state, user } = await createReader();
		seedFeed(state);

		seedItems(state, [
			{ id: "by-title", publishedAt: NOW - DAY_MS, title: "The beacon problem" },
			{ id: "by-summary", publishedAt: NOW - 2 * DAY_MS, summary: "a beacon, of sorts" },
			{ id: "by-author", publishedAt: NOW - 3 * DAY_MS, author: "Beacon Smith" },
			{
				id: "by-url",
				publishedAt: NOW - 4 * DAY_MS,
				url: "https://example.com/beacon",
				title: "Something else",
			},
		]);

		let page = await user.readingQueue({ readState: "all", query: "beacon" });

		expect(ids(page)).toEqual(["by-title", "by-summary", "by-author"]);
	});

	test("matches a pattern holding % or _ as those characters", async () => {
		let { state, user } = await createReader();
		seedFeed(state);

		seedItems(state, [
			{ id: "literal", publishedAt: NOW - DAY_MS, title: "100% cotton" },
			{ id: "wild", publishedAt: NOW - 2 * DAY_MS, title: "100 percent cotton" },
			{ id: "underscore", publishedAt: NOW - 3 * DAY_MS, title: "read_at explained" },
			{ id: "nearby", publishedAt: NOW - 4 * DAY_MS, title: "readXat explained" },
		]);

		expect(ids(await user.readingQueue({ readState: "all", query: "100%" }))).toEqual(["literal"]);
		expect(ids(await user.readingQueue({ readState: "all", query: "read_at" }))).toEqual([
			"underscore",
		]);
	});

	test("excludes a post published below the floor, and searches everything on a null window", async () => {
		let { state: freeState, user: free } = await createReader("free");
		seedFeed(freeState);
		seedItems(freeState, [
			{ id: "recent", publishedAt: NOW - 10 * DAY_MS, title: "beacon here" },
			{ id: "ancient", publishedAt: NOW - 100 * DAY_MS, title: "beacon there" },
		]);

		expect(limitsOf("free").searchWindowDays).toBe(30);
		expect(ids(await free.readingQueue({ readState: "all", query: "beacon" }))).toEqual(["recent"]);

		/** A tier whose window is null searches every stored post, given a step that reaches. */
		await setStep(365);

		let { state, user } = await createReader("paid");
		seedFeed(state);
		seedItems(state, [
			{ id: "recent", publishedAt: NOW - 10 * DAY_MS, title: "beacon here" },
			{ id: "ancient", publishedAt: NOW - 100 * DAY_MS, title: "beacon there" },
		]);

		expect(limitsOf("paid").searchWindowDays).toBeNull();
		expect(ids(await user.readingQueue({ readState: "all", query: "beacon" }))).toEqual([
			"recent",
			"ancient",
		]);
	});

	test("mints a filled page's next cursor from the last post shown", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 2 * DAY_MS, title: "beacon two" },
			{ id: "three", publishedAt: NOW - 3 * DAY_MS, title: "beacon three" },
		]);

		let page = await user.readingQueue({ readState: "all", query: "beacon", limit: 2 });
		expect(ids(page)).toEqual(["one", "two"]);

		let next = cursorsOf(page).next;
		expect(next).not.toBeNull();
		expect(boundaryOf(next ?? "").values).toEqual([NOW - 2 * DAY_MS, "two"]);
	});

	test("mints a barren step's next cursor from the step's own floor", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [{ id: "ancient", publishedAt: NOW - 200 * DAY_MS, title: "beacon there" }]);

		let page = await user.readingQueue({ readState: "all", query: "beacon" });

		expect(ids(page)).toEqual([]);

		let next = cursorsOf(page).next;
		expect(next).not.toBeNull();
		expect(boundaryOf(next ?? "")).toEqual({
			columns: ["published_at", "id"],
			values: [NOW - DEFAULT_STEP_DAYS * DAY_MS, ""],
		});
	});

	test("resumes strictly below the floor, skipping no post sitting on it", async () => {
		let { state, user } = await createReader();
		seedFeed(state);

		/** One post exactly on the floor, one just under it, and one a step further down. */
		seedItems(state, [
			{ id: "on-floor", publishedAt: NOW - DEFAULT_STEP_DAYS * DAY_MS, title: "beacon on" },
			{ id: "under", publishedAt: NOW - DEFAULT_STEP_DAYS * DAY_MS - 1, title: "beacon under" },
			{ id: "deeper", publishedAt: NOW - 120 * DAY_MS, title: "beacon deeper" },
		]);

		let first = await user.readingQueue({ readState: "all", query: "beacon" });
		expect(ids(first)).toEqual(["on-floor"]);

		let second = await user.readingQueue({
			readState: "all",
			query: "beacon",
			cursor: cursorsOf(first).next,
		});

		expect(ids(second)).toEqual(["under", "deeper"]);
	});

	test("offers a way on and a way back from a step holding nothing", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [{ id: "ancient", publishedAt: NOW - 400 * DAY_MS, title: "beacon there" }]);

		let first = await user.readingQueue({ readState: "all", query: "beacon" });

		let second = await user.readingQueue({
			readState: "all",
			query: "beacon",
			cursor: cursorsOf(first).next,
		});

		expect(ids(second)).toEqual([]);
		expect(cursorsOf(second).next).not.toBeNull();
		expect(cursorsOf(second).prev).not.toBeNull();
	});

	test("mints a cursor the plain timeline seeks with, and follows one it minted", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 2 * DAY_MS, title: "beacon two" },
			{ id: "three", publishedAt: NOW - 3 * DAY_MS, title: "beacon three" },
		]);

		let searched = await user.readingQueue({ readState: "all", query: "beacon", limit: 2 });

		/** The cursor a search minted, followed by the queue with the box cleared. */
		let plain = await user.readingQueue({ readState: "all", cursor: cursorsOf(searched).next });
		expect(ids(plain)).toEqual(["three"]);

		/** And the reverse: a cursor the plain timeline minted, followed by a search. */
		let timeline = await user.readingQueue({ readState: "all", limit: 1 });
		let back = await user.readingQueue({
			readState: "all",
			query: "beacon",
			cursor: cursorsOf(timeline).next,
		});

		expect(ids(back)).toEqual(["two", "three"]);
	});

	test("keeps paging a cursor minted before the window moved, repeating and losing nothing", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 2 * DAY_MS, title: "beacon two" },
			{ id: "three", publishedAt: NOW - 3 * DAY_MS, title: "beacon three" },
		]);

		let first = await user.readingQueue({ readState: "all", query: "beacon", limit: 2 });
		let cursor = cursorsOf(first).next;

		/** The window is derived at read time, so moving the clock moves where a walk stops. */
		vi.setSystemTime(NOW + 10 * DAY_MS);

		let second = await user.readingQueue({
			readState: "all",
			query: "beacon",
			limit: 2,
			cursor,
		});

		expect(ids(second)).toEqual(["three"]);
		expect([...ids(first), ...ids(second)]).toEqual(["one", "two", "three"]);
	});

	test("composes with each read state", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "unread", publishedAt: NOW - DAY_MS, title: "beacon unread" },
			{ id: "read", publishedAt: NOW - 2 * DAY_MS, title: "beacon read", readAt: NOW },
		]);

		expect(ids(await user.readingQueue({ readState: "all", query: "beacon" }))).toEqual([
			"unread",
			"read",
		]);
		expect(ids(await user.readingQueue({ readState: "unread", query: "beacon" }))).toEqual([
			"unread",
		]);
		expect(ids(await user.readingQueue({ readState: "read", query: "beacon" }))).toEqual(["read"]);
	});

	test("narrows to one feed and to one folder, each as a predicate on the same list", async () => {
		let { state, user } = await createReader();
		seedFeed(state, "feed-1");
		seedFeed(state, "feed-2");

		seedItems(state, [{ id: "here", publishedAt: NOW - DAY_MS, title: "beacon here" }], "feed-1");
		seedItems(
			state,
			[{ id: "there", publishedAt: NOW - 2 * DAY_MS, title: "beacon there", folderId: "folder-1" }],
			"feed-2",
		);

		expect(
			ids(await user.readingQueue({ readState: "all", query: "beacon", feedId: "feed-1" })),
		).toEqual(["here"]);

		expect(
			ids(await user.readingQueue({ readState: "all", query: "beacon", folderId: "folder-1" })),
		).toEqual(["there"]);
	});

	test("reports the window where the tier stopped it, rather than the end of the archive", async () => {
		let { state, user } = await createReader("free");
		seedFeed(state);
		seedItems(state, [
			{ id: "recent", publishedAt: NOW - DAY_MS, title: "beacon here" },
			{ id: "ancient", publishedAt: NOW - 400 * DAY_MS, title: "beacon there" },
		]);

		let span = spanOf(await user.readingQueue({ readState: "all", query: "beacon" }));

		expect(span.stoppedAt).toBe("window");
		expect(span.windowDays).toBe(30);
		expect(span.reachedAt).toBe(NOW - 30 * DAY_MS);
	});

	test("reports the end of the archive where the oldest stored post was reached", async () => {
		await setStep(365);

		let { state, user } = await createReader("paid");
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 200 * DAY_MS, title: "beacon two" },
		]);

		let page = await user.readingQueue({ readState: "all", query: "beacon" });
		let span = spanOf(page);

		expect(span.stoppedAt).toBe("archive");
		expect(span.windowDays).toBeNull();
		expect(cursorsOf(page).next).toBeNull();
	});

	test("reports the step where one is all that stopped it", async () => {
		let { state, user } = await createReader("paid");
		seedFeed(state);
		seedItems(state, [
			{ id: "recent", publishedAt: NOW - DAY_MS, title: "beacon here" },
			{ id: "ancient", publishedAt: NOW - 400 * DAY_MS, title: "beacon there" },
		]);

		let span = spanOf(await user.readingQueue({ readState: "all", query: "beacon" }));

		expect(span.stoppedAt).toBe("step");
		expect(span.reachedAt).toBe(NOW - DEFAULT_STEP_DAYS * DAY_MS);
	});

	test("records what a search examined and whether it was exhausted, and never the query", async () => {
		let written = vi.spyOn(console, "log").mockImplementation(() => undefined);

		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 2 * DAY_MS, title: "nothing here" },
			{ id: "three", publishedAt: NOW - 3 * DAY_MS, title: "nothing there" },
		]);

		await user.readingQueue({ readState: "all", query: "beacon" });

		let records = written.mock.calls
			.map(([record]) => record)
			.filter(
				(record): record is Record<string, unknown> =>
					typeof record === "object" && record !== null && "event" in record,
			);

		let search = records.find((record) => record.event === "user.search");

		expect(search).toBeDefined();
		expect(search?.examined).toBe(3);
		expect(search?.matched).toBe(1);
		expect(search?.exhausted).toBe(true);
		expect(search?.windowDays).toBeNull();
		expect(search?.stepDays).toBe(DEFAULT_STEP_DAYS);
		expect(search?.readState).toBe("all");
		expect(search?.scoped).toBe(false);

		expect(JSON.stringify(search)).not.toContain("beacon");
	});
});

describe("taggedQueue, searched", () => {
	test("pages a searched label on the label list's own keys", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 2 * DAY_MS, title: "beacon two" },
			{ id: "other", publishedAt: NOW - 3 * DAY_MS, title: "nothing here" },
		]);

		let tag = await user.createTag("Reading");
		if (!tag.ok) throw new Error("expected the label to be created");

		for (let itemId of ["one", "two", "other"]) {
			let applied = await user.tagItem(itemId, { tagId: tag.tag.id });
			if (!applied.ok) throw new Error(`expected ${itemId} to be labelled`);
		}

		let page = await user.taggedQueue(tag.tag.id, { query: "beacon", limit: 1 });
		expect(ids(page)).toEqual(["one"]);

		let boundary = boundaryOf(cursorsOf(page).next ?? "");
		expect(boundary.columns).toEqual(["published_at", "id"]);
		expect(boundary.values).toEqual([NOW - DAY_MS, "one"]);

		let second = await user.taggedQueue(tag.tag.id, {
			query: "beacon",
			limit: 1,
			cursor: cursorsOf(page).next,
		});

		expect(ids(second)).toEqual(["two"]);
	});
});

describe("saved searches", () => {
	test("stores the narrowing a reader kept, and answers it back as one", async () => {
		let { state, user } = await createReader();
		seedFeed(state);

		let kept = await user.createSearch({
			name: "Beacons",
			query: "beacon",
			readState: "unread",
			feedId: FEED_ID,
		});

		if (!kept.ok) throw new Error(`expected the search to be kept, got ${kept.reason}`);

		expect(kept.search).toMatchObject({
			name: "Beacons",
			query: "beacon",
			readState: "unread",
			feedId: FEED_ID,
		});

		expect(await user.listSearches()).toEqual([kept.search]);
		expect(await user.getSearch(kept.search.id)).toEqual(kept.search);
	});

	test("resolves to the same page the words it holds produce when typed", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [
			{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" },
			{ id: "two", publishedAt: NOW - 2 * DAY_MS, title: "nothing here" },
		]);

		let kept = await user.createSearch({
			name: "Beacons",
			query: "beacon",
			readState: "all",
			feedId: null,
		});

		if (!kept.ok) throw new Error("expected the search to be kept");

		let typed = await user.readingQueue({ readState: "all", query: "beacon" });
		let opened = await user.readingQueue({
			readState: kept.search.readState,
			query: kept.search.query,
			feedId: kept.search.feedId,
		});

		expect(ids(opened)).toEqual(ids(typed));
	});

	test("refuses a name nobody can read, and a query that narrows nothing", async () => {
		let { user } = await createReader();

		expect(
			await user.createSearch({ name: " ", query: "x", readState: "all", feedId: null }),
		).toEqual({ ok: false, reason: "invalid-name" });

		expect(
			await user.createSearch({ name: "Blank", query: "   ", readState: "all", feedId: null }),
		).toEqual({ ok: false, reason: "invalid-query" });
	});

	test("refuses the twenty-first, and evicts none of the twenty", async () => {
		let { user } = await createReader();

		for (let order = 0; order < SAVED_SEARCH_LIMIT; order++) {
			let kept = await user.createSearch({
				name: `Search ${order}`,
				query: `term ${order}`,
				readState: "all",
				feedId: null,
			});

			if (!kept.ok) throw new Error(`expected ${order} to be kept, got ${kept.reason}`);
		}

		expect(
			await user.createSearch({
				name: "One too many",
				query: "term",
				readState: "all",
				feedId: null,
			}),
		).toEqual({ ok: false, reason: "full", limit: SAVED_SEARCH_LIMIT });

		expect(await user.listSearches()).toHaveLength(SAVED_SEARCH_LIMIT);
	});

	test("forgets one, which deletes no post", async () => {
		let { state, user } = await createReader();
		seedFeed(state);
		seedItems(state, [{ id: "one", publishedAt: NOW - DAY_MS, title: "beacon one" }]);

		let kept = await user.createSearch({
			name: "Beacons",
			query: "beacon",
			readState: "all",
			feedId: null,
		});

		if (!kept.ok) throw new Error("expected the search to be kept");

		expect(await user.deleteSearch(kept.search.id)).toEqual({ ok: true });
		expect(await user.listSearches()).toEqual([]);
		expect(await user.deleteSearch(kept.search.id)).toEqual({ ok: false, reason: "not-found" });

		expect(ids(await user.readingQueue({ readState: "all", query: "beacon" }))).toEqual(["one"]);
	});
});
