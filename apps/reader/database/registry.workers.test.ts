/**
 * Drives the feed catalog the way the follow path does: inside workerd, against the real
 * D1 this app's wrangler config binds as `PLATFORM_DB`, with the shipped migration as the
 * schema. What only a real SQLite can show is asserted here — that `UNIQUE (feed_url)` is
 * what makes two people following one feed converge on one id, and that the upsert is
 * spelled the one way that answers the second follower.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import schema from "~/database/catalog-migrations/0001-feeds.sql?raw";
import {
	deleteFeed,
	registerFeed,
	retireFeed,
	reviveFeed,
	stampActivity,
} from "~/database/registry";

/**
 * A URL no other test in this file uses. D1 keeps its rows for the length of a test, and
 * the whole point of the catalog is that one URL is one row, so each test gets its own
 * feed rather than depending on the order they ran in.
 */
function feedUrl(): string {
	return `https://${crypto.randomUUID()}.example.com/feed.xml`;
}

/** The catalog row behind an id, read without going through the registry's own SQL. */
async function rowOf(feedId: string): Promise<Record<string, unknown> | null> {
	return await env.PLATFORM_DB.prepare("select * from feeds where id = ?").bind(feedId).first();
}

/** How many rows the catalog holds for one URL, which is the convergence assertion. */
async function rowsFor(url: string): Promise<number> {
	let row = await env.PLATFORM_DB.prepare("select count(*) as total from feeds where feed_url = ?")
		.bind(url)
		.first<{ total: number }>();

	return row?.total ?? 0;
}

beforeAll(async () => {
	// The shipped migration rather than a `CREATE TABLE` written for the tests, so the
	// constraints asserted below are the ones `wrangler d1 migrations` actually applies.
	// D1's `exec` reads one statement per line, so the prose is dropped and what is left
	// of each statement is folded onto a line of its own.
	let statements = schema
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join(" ")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");

	for (let statement of statements) await env.PLATFORM_DB.exec(`${statement};`);
});

describe("registerFeed", () => {
	test("mints a feed id for a URL nobody has followed", async () => {
		let url = feedUrl();
		let feedId = await registerFeed(url, "Overreacted");

		// The prefix is what makes the id say what it names, everywhere a feed is referred
		// to: the object's name, the freshness key, and a reader's subscription.
		expect(feedId).toMatch(/^feed_[0-9a-z]+$/);
		expect(await rowOf(feedId)).toMatchObject({
			feed_url: url,
			title: "Overreacted",
			last_active_at: null,
			retired_at: null,
		});
	});

	test("hands the second follower of a URL the id the first one minted", async () => {
		let url = feedUrl();

		let first = await registerFeed(url, "Overreacted");
		let second = await registerFeed(url, "Dan Abramov");

		expect(second).toBe(first);
		expect(await rowsFor(url)).toBe(1);
		// The first follower's title stands: the upsert writes the URL onto itself and
		// nothing else, and the feed's own object is what a stale title is corrected from.
		expect(await rowOf(first)).toMatchObject({ title: "Overreacted" });
	});

	test("answers a conflicting follow, where the insert that does nothing answers nothing", async () => {
		let url = feedUrl();
		await registerFeed(url, "Overreacted");

		// The shape that looks right and is not: SQLite returns no row for a conflicting
		// insert that does nothing, so spelled this way every follower after the first
		// would silently get back no id at all.
		let ignored = await env.PLATFORM_DB.prepare(
			"insert into feeds (id, feed_url, title, created_at) values (?, ?, ?, ?) on conflict (feed_url) do nothing returning id",
		)
			.bind("feed_never_minted", url, "Overreacted", Date.now())
			.all<{ id: string }>();

		expect(ignored.results).toEqual([]);
		// Writing the URL back onto itself is what makes the statement always answer.
		await expect(registerFeed(url, "Overreacted")).resolves.toMatch(/^feed_/);
	});

	test("converges two concurrent first follows of one URL on one row and one id", async () => {
		let url = feedUrl();

		let [mine, yours] = await Promise.all([
			registerFeed(url, "Overreacted"),
			registerFeed(url, "Overreacted"),
		]);

		// Both went through the unique index, so the loser of the race was handed the
		// winner's id, which names the object that already exists and holds the items.
		expect(mine).toBe(yours);
		expect(await rowsFor(url)).toBe(1);
	});
});

describe("the rest of a feed's life", () => {
	test("stamps activity, which a feed that published nothing never moves", async () => {
		let feedId = await registerFeed(feedUrl(), "Overreacted");

		expect(await stampActivity(feedId)).toBe(true);
		expect(await rowOf(feedId)).toMatchObject({ last_active_at: expect.any(Number) });
	});

	test("reports a stamp against a purged feed as not landed rather than throwing", async () => {
		expect(await stampActivity("feed_00000000000000000000000000")).toBe(false);
	});

	test("retires a feed without losing its id, and revives it for a subscriber inside the week", async () => {
		let url = feedUrl();
		let feedId = await registerFeed(url, "Overreacted");

		await retireFeed(feedId);
		expect(await rowOf(feedId)).toMatchObject({ retired_at: expect.any(Number) });

		await reviveFeed(feedId);
		expect(await rowOf(feedId)).toMatchObject({ retired_at: null });
		// The row it came back to is the one it was retired from, which is what keeps the
		// re-following reader on the object that still holds their items.
		expect(await registerFeed(url, "Overreacted")).toBe(feedId);
	});

	test("deletes the row the purge clears the object with, and mints a fresh id after", async () => {
		let url = feedUrl();
		let feedId = await registerFeed(url, "Overreacted");

		expect(await deleteFeed(feedId)).toBe(true);
		expect(await rowOf(feedId)).toBeNull();

		// Which is why only the purge may delete: the next follower gets a new id, a new
		// object, and no way to reach whatever the old one was holding.
		expect(await registerFeed(url, "Overreacted")).not.toBe(feedId);
	});

	test("reports deleting a feed that is already gone rather than throwing", async () => {
		expect(await deleteFeed("feed_00000000000000000000000000")).toBe(false);
	});
});
