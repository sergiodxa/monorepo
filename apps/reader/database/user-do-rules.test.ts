/**
 * Drives filter rules against the object that evaluates them: a real SQLite, a real feed
 * object behind the `FEED` binding, and documents served over MSW, so an item is decided on
 * the same arrival path it takes in production.
 *
 * What is asserted here is this ADR's side of the object — that a decided item lets the
 * cursor past while a failed write does not, that the three actions do exactly what they
 * say and none of them saves, that matching is a case-insensitive substring test over the
 * stored fields, that a rule never touches a post the reader already holds, that the
 * counters move once per run, and that the preview looks backwards without writing.
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

import type { UserStore } from "~/database/user-do";

import { limitsOf } from "~/app/lib/entitlement";
import { FLAG_SET, flags } from "~/app/lib/flags";
import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { FeedDO } from "~/database/feed-do";
import { MAX_SUMMARY_LENGTH } from "~/database/refresh";
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

/** The tier rules are sold under, which every reader here takes a snapshot to reach. */
const PAID = "paid";

/** How many rules that tier allows, which is the cap the refusal is measured against. */
const RULE_LIMIT = limitsOf(PAID).rules;

const FEED_URL = "https://example.com/feed.xml";
const OTHER_URL = "https://other.example.com/feed.xml";

const HOUR_MS = 60 * 60 * 1000;

/** One entry of the RSS document an origin serves. */
interface Entry {
	guid: string;
	title: string;
	published: string;
	description?: string;
	author?: string;
}

/** An entry published a given while ago, since every rule here runs beside a velocity. */
function entryAt(guid: string, title: string, agoMs = HOUR_MS, extra: Partial<Entry> = {}): Entry {
	return { guid, title, published: new Date(Date.now() - agoMs).toUTCString(), ...extra };
}

/** Builds the RSS 2.0 document an origin answers with. */
function rss(entries: Entry[], title = "Example"): string {
	let body = entries
		.map(
			(entry) =>
				`<item><guid isPermaLink="false">${entry.guid}</guid><title>${entry.title}</title>` +
				`<link>https://example.com/${entry.guid}</link>` +
				`<pubDate>${entry.published}</pubDate>` +
				(entry.author === undefined ? "" : `<author>${entry.author}</author>`) +
				`<description>${entry.description ?? `About ${entry.title}`}</description>` +
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

/** The feed objects this run has built, one per canonical feed id. */
let feedObjects = new Map<string, Promise<FeedDO>>();

/** Every statement the reader's own database was asked to run, for the read-back assertions. */
let queries: string[] = [];

/** The feed object one id names, built on first use the way the platform builds one. */
async function feedObject(feedId: string): Promise<FeedDO> {
	let existing = feedObjects.get(feedId);
	if (existing !== undefined) return await existing;

	let built = (async () => {
		let state = createDurableObjectState({ name: feedId });
		let feed = new FeedDO(state, env);
		await state.blockConcurrencyWhile(async () => undefined);

		return feed;
	})();

	feedObjects.set(feedId, built);

	return await built;
}

/** The object the `FEED` binding hands back, which is the shipped class behind it. */
function feedStub(feedId: string) {
	return {
		async subscribe(userId: string, feedUrl: string) {
			return await (await feedObject(feedId)).subscribe(userId, feedUrl);
		},

		async unsubscribe(userId: string) {
			return await (await feedObject(feedId)).unsubscribe(userId);
		},

		async refresh(reason: "manual" | "scheduled") {
			return await (await feedObject(feedId)).refresh(reason);
		},

		async getHead() {
			return await (await feedObject(feedId)).getHead();
		},

		async getItemsAfter(cursor: number, limit?: number) {
			return await (await feedObject(feedId)).getItemsAfter(cursor, limit);
		},
	};
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	feedObjects.clear();
	queries.length = 0;

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: createKVNamespace(),
		PLATFORM_DB: catalog,
		FEED: createDurableObjectNamespace<FeedDO>((feedId) => feedStub(feedId)),
	};

	await flags.setProvider(
		new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	);
});

/**
 * Records every statement the reader's own database runs, and fails the ones a test asks
 * it to. It is installed before the object is built, since the object takes the storage
 * handle once and keeps it.
 *
 * @param state - The storage the object is about to be built on.
 * @param failing - Statements to refuse, or `null` to record without refusing any.
 */
function watchQueries(state: DurableObjectStateMock, failing: RegExp | null = null): void {
	let sql = state.storage.sql;
	let exec = sql.exec.bind(sql);

	sql.exec = ((statement: string, ...values: unknown[]) => {
		queries.push(statement);
		if (failing !== null && failing.test(statement)) throw new Error("the write failed");

		return exec(statement, ...values);
	}) as typeof sql.exec;
}

/** What a reader's object is built with, for the tests that watch or break its storage. */
interface ReaderOptions {
	/** Statements to refuse, which is how a page whose write failed is stood up. */
	failing?: RegExp | null;
	/** Whether every statement is recorded, for the reads a page is asserted not to take. */
	watching?: boolean;
}

/** Builds a reader's object, waits out the boot, and puts them on the tier rules are sold under. */
async function createReader(
	options: ReaderOptions = {},
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: `sub-${crypto.randomUUID()}` });

	/**
	 * The migrations and the tier snapshot run through the same storage, so recording starts
	 * only once the object is up and refusing starts only once a test arms it.
	 */
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	await user.setTier({ entitled: PAID, cancelled: false, readAt: Date.now(), source: "billing" });

	if (options.watching === true || options.failing != null) {
		watchQueries(state, options.failing ?? null);
	}

	return { state, user };
}

/** Serves a document at one origin and follows it, which is where most tests start. */
async function follow(
	user: UserDO,
	url = FEED_URL,
	entries: Entry[] = [],
): Promise<UserStore.FeedSummary> {
	server.use(http.get(url, () => HttpResponse.xml(rss(entries, url))));

	let followed = await user.followFeed(url);
	if (!followed.ok) throw new Error(`following ${url} failed: ${followed.reason}`);

	return followed.feed;
}

/** Publishes a document at one origin and polls the feed object for it. */
async function publish(feed: UserStore.FeedSummary, entries: Entry[]): Promise<void> {
	server.use(http.get(feed.feedUrl, () => HttpResponse.xml(rss(entries, feed.feedUrl))));

	let refreshed = await (await feedObject(feed.feedId)).refresh("manual");
	if (!refreshed.ok) throw new Error(`publishing to ${feed.feedUrl} failed: ${refreshed.status}`);
}

/** Writes a rule, failing the test rather than the assertion when the store refuses it. */
async function makeRule(user: UserDO, draft: UserStore.RuleDraft): Promise<UserStore.Rule> {
	let written = await user.createRule(draft);
	if (!written.ok) throw new Error(`writing a rule failed: ${written.reason}`);

	return written.rule;
}

/** Every post the object holds, as the columns these assertions read. */
function rows(state: DurableObjectStateMock): {
	id: string;
	title: string;
	read_at: number | null;
	saved_at: number | null;
	flagged_at: number | null;
}[] {
	return state.storage.sql
		.exec<{
			id: string;
			title: string;
			read_at: number | null;
			saved_at: number | null;
			flagged_at: number | null;
		}>("SELECT id, title, read_at, saved_at, flagged_at FROM feed_items ORDER BY published_at, id")
		.toArray();
}

/**
 * The titles the object holds, alphabetically, which is what "was it written" reads off.
 * Sorted rather than ordered by publication, since these documents differ in what they
 * say rather than in when they were published.
 */
function heldTitles(state: DurableObjectStateMock): string[] {
	return rows(state)
		.map((row) => row.title)
		.sort();
}

/** One held post by the title it reads under, for an assertion about that post's marks. */
function heldPost(state: DurableObjectStateMock, title: string) {
	return rows(state).find((row) => row.title === title);
}

/** What one subscription has ruled on, read straight off the row. */
function storedCursor(state: DurableObjectStateMock, subscriptionId: string): number {
	let [row] = state.storage.sql
		.exec("SELECT cursor FROM feeds WHERE id = ?", subscriptionId)
		.toArray();

	return Number(row?.["cursor"]);
}

/** The head one feed object has reached, which is the highest revision it would answer with. */
async function headOf(feed: UserStore.FeedSummary): Promise<number> {
	return await (await feedObject(feed.feedId)).getHead();
}

describe("what a rule does to an arriving item", () => {
	test("never writes an item a drop rule matched", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "Sponsored", action: "drop" });
		await publish(feed, [entryAt("a", "Sponsored: a thing"), entryAt("b", "A real post")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual(["A real post"]);
	});

	test("lets the cursor past a rule-dropped item, exactly as past a velocity-dropped one", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "Sponsored", action: "drop" });
		await publish(feed, [entryAt("a", "Sponsored: a thing"), entryAt("b", "Sponsored: another")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual([]);
		expect(storedCursor(state, feed.id)).toBe(await headOf(feed));
	});

	test("leaves the cursor below an item whose write failed, whether or not a rule matched it", async () => {
		for (let term of ["Sponsored", "nothing-matches-this"]) {
			let { state, user } = await createReader({ failing: /insert into "feed_items"/i });

			// A URL of its own per pass, so the second one meets a feed object with nothing in
			// it rather than the one the first pass already published to.
			let feed = await follow(user, `https://${term.toLowerCase()}.example.com/feed.xml`);

			await makeRule(user, { field: "title", value: term, action: "drop" });
			await publish(feed, [entryAt("a", "Sponsored: a thing"), entryAt("b", "A real post")]);

			await user.synchronize();

			expect(heldTitles(state), term).toEqual([]);
			expect(storedCursor(state, feed.id), term).toBe(0);
		}
	});

	test("writes an item a mark_read rule matched, read as of its arrival", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "roundup", action: "mark_read" });
		await publish(feed, [entryAt("a", "Weekly roundup"), entryAt("b", "A real post")]);

		let before = Date.now();
		await user.synchronize();

		expect(heldPost(state, "Weekly roundup")?.read_at).toBeGreaterThanOrEqual(before);
		expect(heldPost(state, "A real post")?.read_at).toBeNull();
	});

	test("writes an item a flag rule matched with the mark, and still refuses it past the velocity", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "rust", action: "flag" });
		await publish(feed, [entryAt("a", "Rust in anger"), entryAt("b", "Something else")]);
		await user.synchronize();

		expect(rows(state).find((row) => row.title === "Rust in anger")?.flagged_at).not.toBeNull();

		// The same rule on a subscription that holds three hours of posts flags nothing older
		// than that, because velocity is applied before any rule sees the item.
		await user.setVelocity(feed.id, "breaking");
		await publish(feed, [entryAt("c", "Rust from last week", 7 * 24 * HOUR_MS)]);
		await user.synchronize();

		expect(heldTitles(state)).not.toContain("Rust from last week");
	});

	test("saves nothing, whatever the action", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "a", action: "flag" });
		await makeRule(user, { field: "title", value: "b", action: "mark_read" });
		await publish(feed, [entryAt("a", "a post"), entryAt("b", "b post")]);
		await user.synchronize();

		expect(rows(state).every((row) => row.saved_at === null)).toBe(true);
	});
});

describe("the matching language", () => {
	test("folds case and normalizes both the term and the field", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		// The needle is written in a compatibility form and in upper case; the title is in the
		// composed form and in lower case, so only folding both sides can match them.
		await makeRule(user, { field: "title", value: "ＳＰＯＮＳＯＲＥＤ", action: "drop" });
		await publish(feed, [entryAt("a", "a sponsored slot"), entryAt("b", "a real post")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual(["a real post"]);
	});

	test("sees only the stored summary, which is the line under the title", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		let buried = `${"word ".repeat(MAX_SUMMARY_LENGTH)}merger`;

		await makeRule(user, { field: "summary", value: "merger", action: "drop" });
		await publish(feed, [
			entryAt("a", "Mentions it late", HOUR_MS, { description: buried }),
			entryAt("b", "Mentions it first", HOUR_MS, { description: "The merger, explained." }),
		]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual(["Mentions it late"]);
	});

	test("matches the link, which is how an outbound domain is muted", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "url", value: "/sponsored", action: "drop" });
		await publish(feed, [entryAt("sponsored-1", "A slot"), entryAt("b", "A real post")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual(["A real post"]);
	});
});

describe("where a rule applies", () => {
	test("applies a global rule to a feed followed after it was written", async () => {
		let { state, user } = await createReader();

		await makeRule(user, { field: "title", value: "Sponsored", action: "drop" });

		await follow(user, FEED_URL, [entryAt("a", "Sponsored: a thing"), entryAt("b", "A real post")]);

		expect(heldTitles(state)).toEqual(["A real post"]);
	});

	test("applies a per-feed rule to its own feed and to no other", async () => {
		let { state, user } = await createReader();
		let one = await follow(user, FEED_URL);
		let other = await follow(user, OTHER_URL);

		await makeRule(user, { feedId: one.id, field: "title", value: "brief", action: "drop" });

		await publish(one, [entryAt("a", "Daily brief")]);
		await publish(other, [entryAt("a", "Daily brief")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual(["Daily brief"]);
	});

	test("takes a feed's rules with the subscription when it is unfollowed", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { feedId: feed.id, field: "title", value: "brief", action: "drop" });
		await user.unfollowFeed(feed.id);

		expect(await user.listRules()).toEqual([]);
	});
});

describe("a set of rules, rather than a list", () => {
	test("drops an item when one rule drops it and another flags it", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "rust", action: "flag" });
		await makeRule(user, { field: "title", value: "sponsored", action: "drop" });
		await publish(feed, [entryAt("a", "Sponsored Rust content")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual([]);
	});

	test("writes one row, marked read once, for two mark_read rules matching one item", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "weekly", action: "mark_read" });
		await makeRule(user, { field: "title", value: "roundup", action: "mark_read" });
		await publish(feed, [entryAt("a", "Weekly roundup")]);
		await user.synchronize();

		let held = rows(state);
		expect(held).toHaveLength(1);
		expect(held[0]?.read_at).not.toBeNull();
	});

	test("changes nothing when rules are written in the other order, because there is no order", async () => {
		let first = await createReader();
		let second = await createReader();

		let one = await follow(first.user, FEED_URL);
		let two = await follow(second.user, FEED_URL);

		await makeRule(first.user, { field: "title", value: "rust", action: "flag" });
		await makeRule(first.user, { field: "title", value: "sponsored", action: "drop" });

		await makeRule(second.user, { field: "title", value: "sponsored", action: "drop" });
		await makeRule(second.user, { field: "title", value: "rust", action: "flag" });

		let entries = [entryAt("a", "Sponsored Rust content"), entryAt("b", "Rust in anger")];
		await publish(one, entries);
		await publish(two, entries);

		await first.user.synchronize();
		await second.user.synchronize();

		expect(heldTitles(first.state)).toEqual(heldTitles(second.state));

		// The column an order would be stored in does not exist, which is the whole of why.
		let columns = [
			...first.state.storage.sql.exec<{ name: string }>("PRAGMA table_info(rules)"),
		].map((column) => column.name);

		expect(columns).not.toContain("position");
	});
});

describe("a post the reader already holds", () => {
	test("applies an edit and runs no rule on it", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await publish(feed, [entryAt("a", "An ordinary post")]);
		await user.synchronize();

		let rule = await makeRule(user, { field: "title", value: "Sponsored", action: "drop" });

		// The publisher edits the post into something the rule matches, which puts it back in
		// front of every subscriber exactly once.
		await publish(feed, [entryAt("a", "Sponsored: an ordinary post")]);
		await user.synchronize();

		expect(heldTitles(state)).toEqual(["Sponsored: an ordinary post"]);
		expect((await user.getRule(rule.id))?.matches).toBe(0);
	});

	test("reads the held ids back only on a page where a rule fired", async () => {
		let { user } = await createReader({ watching: true });
		let feed = await follow(user);
		let readBack = /from "feed_items" where \("id" in/i;

		await makeRule(user, { field: "title", value: "nothing-matches-this", action: "drop" });
		await publish(feed, [entryAt("a", "An ordinary post")]);

		queries.length = 0;
		await user.synchronize();

		expect(queries.some((statement) => readBack.test(statement))).toBe(false);

		await makeRule(user, { field: "title", value: "ordinary", action: "drop" });
		await publish(feed, [entryAt("a", "An ordinary post"), entryAt("b", "Another ordinary post")]);

		queries.length = 0;
		await user.synchronize();

		expect(queries.some((statement) => readBack.test(statement))).toBe(true);
	});
});

describe("what a reader can see", () => {
	test("moves no counter for an item velocity refused first", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		await user.setVelocity(feed.id, "breaking");
		let rule = await makeRule(user, { field: "title", value: "old", action: "drop" });

		await publish(feed, [entryAt("a", "An old post", 7 * 24 * HOUR_MS)]);
		await user.synchronize();

		expect((await user.getRule(rule.id))?.matches).toBe(0);
	});

	test("counts a rule's matches once per run, with that run's total", async () => {
		let { user } = await createReader({ watching: true });
		let feed = await follow(user);

		let rule = await makeRule(user, { field: "title", value: "sponsored", action: "drop" });

		await publish(feed, [
			entryAt("a", "Sponsored one"),
			entryAt("b", "Sponsored two"),
			entryAt("c", "Sponsored three"),
		]);

		queries.length = 0;
		await user.synchronize();

		let counted = await user.getRule(rule.id);
		expect(counted?.matches).toBe(3);
		expect(counted?.lastMatchedAt).not.toBeNull();

		// Three items decided, one update: the tally is held in memory for the run and written
		// once when it ends.
		let updates = queries.filter((statement) => /^update "rules"/i.test(statement));
		expect(updates).toHaveLength(1);
	});

	test("reports what a run's rules decided, beside what velocity skipped", async () => {
		let { user } = await createReader();
		let feed = await follow(user);

		await makeRule(user, { field: "title", value: "sponsored", action: "drop" });
		await publish(feed, [entryAt("a", "Sponsored one"), entryAt("b", "A real post")]);

		expect((await user.synchronize()).ruled).toBe(1);
	});
});

describe("the preview, which is the only thing that looks backwards", () => {
	test("matches stored posts, writes nothing, and creates no rule", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await publish(feed, [entryAt("a", "Sponsored: a thing"), entryAt("b", "A real post")]);
		await user.synchronize();

		let previewed = await user.previewRule({
			field: "title",
			value: "Sponsored",
			action: "drop",
		});

		if (!previewed.ok) throw new Error(`the preview refused: ${previewed.reason}`);

		expect(previewed.scanned).toBe(2);
		expect(previewed.matched).toBe(1);
		expect(previewed.items.map((item) => item.title)).toEqual(["Sponsored: a thing"]);

		expect(await user.listRules()).toEqual([]);
		expect(heldTitles(state)).toEqual(["A real post", "Sponsored: a thing"]);
	});

	test("deletes no post when a rule is saved", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await publish(feed, [entryAt("a", "Sponsored: a thing"), entryAt("b", "A real post")]);
		await user.synchronize();

		await makeRule(user, { field: "title", value: "Sponsored", action: "drop" });

		expect(heldTitles(state)).toEqual(["A real post", "Sponsored: a thing"]);
	});

	test("acts on the previewed page only when the reader asks it to", async () => {
		let { state, user } = await createReader();
		let feed = await follow(user);

		await publish(feed, [entryAt("a", "Sponsored: a thing"), entryAt("b", "A real post")]);
		await user.synchronize();

		let applied = await user.applyPreviewedRule({
			field: "title",
			value: "Sponsored",
			action: "drop",
		});

		if (!applied.ok) throw new Error(`the one-off refused: ${applied.reason}`);

		expect(applied.affected).toBe(1);
		expect(heldTitles(state)).toEqual(["A real post"]);
	});
});

describe("what a tier allows", () => {
	test("refuses the rule past the cap, and refuses a free reader their first", async () => {
		let { user } = await createReader();

		for (let index = 0; index < RULE_LIMIT; index += 1) {
			await makeRule(user, { field: "title", value: `term-${index}`, action: "drop" });
		}

		let refused = await user.createRule({ field: "title", value: "one more", action: "drop" });
		expect(refused).toEqual({
			ok: false,
			reason: "rule-limit",
			limit: { limit: "rules", current: RULE_LIMIT, allowed: RULE_LIMIT, tier: PAID },
		});

		let free = createDurableObjectState({ name: `sub-${crypto.randomUUID()}` });
		let reader = new UserDO(free, env);
		await free.blockConcurrencyWhile(async () => undefined);

		expect(await reader.createRule({ field: "title", value: "anything", action: "drop" })).toEqual({
			ok: false,
			reason: "not-entitled",
		});
	});

	test("refuses a field, an action, a term and a feed the reader has no answer for", async () => {
		let { user } = await createReader();

		expect(await user.createRule({ field: "body", value: "x", action: "drop" })).toEqual({
			ok: false,
			reason: "invalid-field",
		});

		expect(await user.createRule({ field: "title", value: "x", action: "save" })).toEqual({
			ok: false,
			reason: "invalid-action",
		});

		expect(await user.createRule({ field: "title", value: "  ", action: "drop" })).toEqual({
			ok: false,
			reason: "invalid-value",
		});

		expect(
			await user.createRule({
				feedId: "feed_nobody_follows",
				field: "title",
				value: "x",
				action: "drop",
			}),
		).toEqual({ ok: false, reason: "not-following" });
	});
});
