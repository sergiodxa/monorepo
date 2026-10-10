/**
 * Drives the feed object's models over the shipped feed migrations on an in-memory
 * SQLStorage: the single-row reads and writes, the subscriber set, and the two item reads
 * a subscriber is served from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { NotFound } from "@sdxc/data-model";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { FeedModels } from "~/database/models/feed";

import { FEED_JOURNAL, FEED_MIGRATIONS } from "~/database/feed-migrations";
import { HUB_COOLOFF_MS } from "~/database/feed-schema";
import { runMigrations } from "~/database/migrations";
import { feedModels } from "~/database/models/feed";
import { FEED_ROW_ID } from "~/database/refresh";

/** The epoch milliseconds every write is stamped with, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

let models: FeedModels;

beforeEach(async () => {
	let adapter = createSQLStorageDatabaseAdapter(createSqlStorage());
	await runMigrations(adapter, FEED_MIGRATIONS, FEED_JOURNAL);
	models = feedModels.bind({ db: new Database(adapter, { now: () => NOW }) });
});

/** Writes the feed's row the way a first subscription does. */
async function initialize(): Promise<void> {
	unwrap(
		await models.feed.create({
			id: FEED_ROW_ID,
			feed_url: "https://example.com/feed.xml",
			title: "Example",
			created_at: NOW,
			updated_at: NOW,
		}),
	);
}

/** Stores one item at `revision`, published at `publishedAt`. */
async function item(id: string, revision: number, publishedAt: number): Promise<void> {
	unwrap(
		await models.items.create({
			id,
			guid: id,
			sequence: revision,
			revision,
			title: id,
			published_at: publishedAt,
			content_hash: id,
		}),
	);
}

describe("the feed row", () => {
	test("reads as null before the first subscription writes it", async () => {
		expect(await models.feed.current()).toBeNull();
	});

	test("fails a change with NotFound while the object holds no feed", async () => {
		let changed = await models.feed.change({ purge_at: NOW });

		expect(isFailure(changed) && changed.error instanceof NotFound).toBe(true);
	});

	test("writes a change onto the one row and touches updated_at", async () => {
		await initialize();

		let changed = await models.feed.change({ purge_at: NOW + 1 });

		expect(isSuccess(changed)).toBe(true);
		expect(await models.feed.current()).toMatchObject({
			purge_at: NOW + 1,
			updated_at: NOW,
			head: 0,
			hub_state: "none",
		});
	});

	test("moves a subscription from pending to active under the lease the hub granted", async () => {
		await initialize();

		unwrap(
			await models.feed.awaitHub(
				{ url: "https://hub.example.com/", topic: "t", secret: "s", token: "k" },
				NOW,
			),
		);
		expect(await models.feed.current()).toMatchObject({
			hub_state: "pending",
			hub_token: "k",
			hub_lease_until: null,
		});

		unwrap(await models.feed.activateHub(600, NOW));
		expect(await models.feed.current()).toMatchObject({
			hub_state: "active",
			hub_lease_until: NOW + 600_000,
			hub_lease_seconds: 600,
		});
	});

	test("holds a failed hub off for the cool-off and clears a dropped one outright", async () => {
		await initialize();

		unwrap(await models.feed.clearHub("failed", "https://hub.example.com/", NOW));
		expect(await models.feed.current()).toMatchObject({
			hub_state: "failed",
			hub_url: "https://hub.example.com/",
			hub_token: null,
			hub_lease_until: NOW + HUB_COOLOFF_MS,
		});

		unwrap(await models.feed.clearHub("none", null, NOW));
		expect(await models.feed.current()).toMatchObject({
			hub_state: "none",
			hub_url: null,
			hub_lease_until: null,
		});
	});
});

describe("subscribers", () => {
	test("keeps one row and the first timestamp for a reader following twice", async () => {
		await models.subscribers.follow("pat", NOW);
		await models.subscribers.follow("pat", NOW + 1);

		expect(await models.subscribers.query().all()).toEqual([
			{ user_id: "pat", subscribed_at: NOW },
		]);
	});

	test("answers whether anybody is left as followers come and go", async () => {
		expect(await models.subscribers.anyone()).toBe(false);

		await models.subscribers.follow("pat", NOW);
		expect(await models.subscribers.anyone()).toBe(true);

		await models.subscribers.unfollow("pat");
		await models.subscribers.unfollow("pat");
		expect(await models.subscribers.anyone()).toBe(false);
	});
});

describe("items", () => {
	test("pages the revisions above a cursor oldest first", async () => {
		await item("a", 1, NOW + 3);
		await item("b", 2, NOW + 1);
		await item("c", 3, NOW + 2);

		let page = await models.items.pageAfter(1, 1);
		expect(page.map((row) => row.id)).toEqual(["b"]);

		let rest = await models.items.pageAfter(1, 10);
		expect(rest.map((row) => row.id)).toEqual(["b", "c"]);
	});

	test("hands over the newest by publication, ties broken by id", async () => {
		await item("a", 1, NOW);
		await item("b", 2, NOW);
		await item("c", 3, NOW - 1);

		let newest = await models.items.newest(2);
		expect(newest.map((row) => row.id)).toEqual(["b", "a"]);
	});
});
