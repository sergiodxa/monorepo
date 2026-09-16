/**
 * Drives entitlement against the object that enforces it: a real SQLite, a real feed
 * object behind the `FEED` binding, a real KV holding the heads and a real catalog behind
 * `PLATFORM_DB`.
 *
 * What is asserted here is the half of ADR-012 this object owns — that a limit is a local
 * comparison reaching neither the catalog nor a platform, that the tier has exactly one
 * writer and refuses a stale snapshot, and that a tier change deletes nothing and is undone
 * by one column write.
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
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { FeedStore } from "~/database/feed-do";

import { TIER_LIMITS } from "~/app/lib/entitlement";
import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { FeedDO } from "~/database/feed-do";
import { UserDO } from "~/database/user-do";

/**
 * The bindings the object reads off `cloudflare:workers`. Held behind a hoisted box so
 * each test gets its own namespaces while the `env` every module already captured stays
 * the same object.
 */
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

const SUBJECT = "sub-tier";
const FEED_URL = "https://example.com/feed.xml";

/** A fixed moment a snapshot claims to have been read at, so orderings are arithmetic. */
const READ_AT = 1_800_000_000_000;

/** The feed objects this run has built, one per canonical feed id. */
let feedObjects = new Map<string, Promise<FeedDO>>();

/** Every statement the catalog was asked to run, for the checks that must run none. */
let catalogQueries: string[] = [];

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

/** The object the `FEED` binding hands back, which is the shipped class behind a name. */
function feedStub(feedId: string) {
	return {
		async subscribe(userId: string, feedUrl: string): Promise<FeedStore.SubscribeResult> {
			return await (await feedObject(feedId)).subscribe(userId, feedUrl);
		},

		async unsubscribe(userId: string): Promise<FeedStore.UnsubscribeResult> {
			return await (await feedObject(feedId)).unsubscribe(userId);
		},

		async refresh(reason: FeedStore.RefreshReason): Promise<FeedStore.RefreshResult> {
			return await (await feedObject(feedId)).refresh(reason);
		},

		async getHead(): Promise<number> {
			return await (await feedObject(feedId)).getHead();
		},

		async getItemsAfter(cursor: number, limit?: number): Promise<FeedStore.ItemsPage> {
			return await (await feedObject(feedId)).getItemsAfter(cursor, limit);
		},
	};
}

/** The catalog, wrapped so a test can say a limit check ran no statement against it. */
function countingCatalog(catalog: D1Database): D1Database {
	return new Proxy(catalog, {
		get(target, property) {
			if (property === "prepare" || property === "exec" || property === "batch") {
				catalogQueries.push(String(property));
			}

			return Reflect.get(target, property) as unknown;
		},
	});
}

/** Builds the RSS 2.0 document an origin answers with. */
function rss(title: string): string {
	return (
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<rss version="2.0"><channel><title>${title}</title>` +
		`<link>https://example.com</link><description>An example feed</description>` +
		`<item><guid isPermaLink="false">a</guid><title>First</title>` +
		`<link>https://example.com/a</link>` +
		`<pubDate>Mon, 01 Sep 2025 10:00:00 GMT</pubDate></item>` +
		`</channel></rss>`
	);
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	feedObjects.clear();
	catalogQueries.length = 0;

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: createKVNamespace(),
		PLATFORM_DB: countingCatalog(catalog),
		FEED: createDurableObjectNamespace<FeedDO>((feedId) => feedStub(feedId)),
	};

	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss("Example"))));
});

/** Builds a reader's object and waits out the boot, the way a first request would. */
async function createReader(
	subject = SUBJECT,
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: subject });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);

	return { state, user };
}

/** Subscriptions written straight into storage, for a test that follows nothing. */
function seedFeeds(state: DurableObjectStateMock, count: number, from = 0): string[] {
	let ids: string[] = [];

	for (let index = from; index < from + count; index++) {
		let id = `feed-${index}`;

		state.storage.sql.exec(
			`INSERT INTO feeds
				(id, feed_id, feed_url, site_url, title, description, language, image_url,
				 cursor, velocity, unfollowed_at, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, 0, 'evergreen', NULL, 0, 0)`,
			id,
			`canonical-${index}`,
			`https://${id}.example.com/feed.xml`,
			id,
		);

		ids.push(id);
	}

	return ids;
}

/** Posts of one subscription, written straight into storage, saved or not. */
function seedItems(
	state: DurableObjectStateMock,
	subscriptionId: string,
	count: number,
	saved: boolean,
	prefix = "item",
): string[] {
	let ids: string[] = [];

	for (let index = 0; index < count; index++) {
		let id = `${subscriptionId}-${prefix}-${index}`;

		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, 0, 0)`,
			id,
			subscriptionId,
			id,
			id,
			index,
			saved ? 1 : null,
		);

		ids.push(id);
	}

	return ids;
}

/** How many rows of one table the object holds, read without going through an RPC. */
function rowCount(state: DurableObjectStateMock, table: string): number {
	let [row] = state.storage.sql.exec(`SELECT COUNT(*) AS total FROM ${table}`).toArray();
	return Number(row?.["total"]);
}

describe("the tier a reader's object holds", () => {
	test("a new reader is free, from the default, with no lapse and no confirmed read", async () => {
		let { user } = await createReader();
		let settings = await user.ensureUser(SUBJECT);

		expect(settings.tier).toBe("free");
		expect(settings.tierSource).toBe("default");
		expect(settings.graceUntil).toBeNull();
		expect(settings.tierCheckedAt).toBe(0);
	});

	test("an upgrade takes effect on the snapshot that reports it", async () => {
		let { user } = await createReader();
		await user.ensureUser(SUBJECT);

		let applied = await user.setTier({
			entitled: "premium",
			cancelled: false,
			readAt: READ_AT,
			source: "billing",
		});

		expect(applied).toEqual({ ok: true, from: "free", to: "premium", graceUntil: null });
		expect((await user.entitlement()).tier).toBe("premium");
	});

	test("a snapshot older than the stored read is refused, so the later read wins", async () => {
		let { user } = await createReader();
		await user.ensureUser(SUBJECT);

		await user.setTier({
			entitled: "paid",
			cancelled: false,
			readAt: READ_AT,
			source: "billing",
		});

		let late = await user.setTier({
			entitled: "free",
			cancelled: true,
			readAt: READ_AT - 1000,
			source: "billing",
		});

		expect(late).toEqual({ ok: false, reason: "stale", tier: "paid", graceUntil: null });
		expect((await user.entitlement()).tier).toBe("paid");
	});

	test("a tier a person granted is not lowered by what the platform says", async () => {
		let { user } = await createReader();
		await user.ensureUser(SUBJECT);

		await user.setTier({
			entitled: "premium",
			cancelled: false,
			readAt: READ_AT,
			source: "grant",
		});

		let lowered = await user.setTier({
			entitled: "free",
			cancelled: true,
			readAt: READ_AT + 1000,
			source: "billing",
		});

		expect(lowered).toEqual({ ok: false, reason: "granted", tier: "premium", graceUntil: null });
	});

	test("a lapse opens a window and moves no tier, and the drop waits for it", async () => {
		let { user } = await createReader();
		await user.ensureUser(SUBJECT);

		await user.setTier({ entitled: "paid", cancelled: false, readAt: 1, source: "billing" });

		let lapsed = await user.setTier({
			entitled: "free",
			cancelled: false,
			readAt: 2,
			source: "billing",
		});

		expect(lapsed).toEqual({
			ok: true,
			from: "paid",
			to: "paid",
			graceUntil: expect.any(Number),
		});
		expect((await user.entitlement()).tier).toBe("paid");
	});
});

describe("where a limit is enforced", () => {
	test("a limit check reads the local tier and runs no statement against the catalog", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);
		seedFeeds(state, TIER_LIMITS.free.feeds);

		catalogQueries.length = 0;

		let refused = await user.followFeed("https://another.example.com/feed.xml");

		expect(refused.ok).toBe(false);
		expect(catalogQueries).toEqual([]);
	});

	test("a reader over the feed cap is refused and told how many the plan follows", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);
		seedFeeds(state, TIER_LIMITS.free.feeds);

		let refused = await user.followFeed("https://another.example.com/feed.xml");

		expect(refused).toEqual({
			ok: false,
			reason: "over-limit",
			feedId: null,
			limit: {
				limit: "feeds",
				current: TIER_LIMITS.free.feeds,
				allowed: TIER_LIMITS.free.feeds,
				tier: "free",
			},
		});
	});

	test("an import over the cap follows nothing and reports every URL it refused", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);
		seedFeeds(state, TIER_LIMITS.free.feeds);

		let imported = await user.importFeeds([
			{ feedUrl: "https://one.example.com/feed.xml" },
			{ feedUrl: "https://two.example.com/feed.xml" },
			{ feedUrl: "https://three.example.com/feed.xml" },
		]);

		expect(imported.added).toBe(0);
		expect([...imported.failed].sort()).toEqual([
			"https://one.example.com/feed.xml",
			"https://three.example.com/feed.xml",
			"https://two.example.com/feed.xml",
		]);
	});

	test("a reader over the saved cap keeps every saved post and is refused the next", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);

		await user.setTier({ entitled: "paid", cancelled: false, readAt: 1, source: "billing" });

		let [subscription] = seedFeeds(state, 1);
		let held = TIER_LIMITS.free.saved + 50;
		seedItems(state, subscription!, held, true);
		let [spare] = seedItems(state, `${subscription!}-spare`, 1, false);

		await user.setTier({ entitled: "free", cancelled: true, readAt: 2, source: "billing" });

		let refused = await user.saveItem(spare!);

		expect(refused).toEqual({
			ok: false,
			reason: "full",
			limit: { limit: "saved", current: held, allowed: TIER_LIMITS.free.saved, tier: "free" },
		});

		let entitlement = await user.entitlement();

		expect(entitlement.saved).toBe(held);
		expect(entitlement.over.map((refusal) => refusal.limit)).toContain("saved");
	});
});

describe("what a downgrade does, and does not do", () => {
	test("a tier drop deletes no post, no feed and no saved item", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);

		await user.setTier({ entitled: "premium", cancelled: false, readAt: 1, source: "billing" });

		let subscriptions = seedFeeds(state, 12);
		for (let subscription of subscriptions) seedItems(state, subscription, 10, false);
		seedItems(state, subscriptions[0]!, 5, true, "kept");

		let feedsBefore = rowCount(state, "feeds");
		let itemsBefore = rowCount(state, "feed_items");

		await user.setTier({ entitled: "free", cancelled: true, readAt: 2, source: "billing" });

		expect(rowCount(state, "feeds")).toBe(feedsBefore);
		expect(rowCount(state, "feed_items")).toBe(itemsBefore);
		expect((await user.entitlement()).tier).toBe("free");
	});

	test("the subscription list still exports while the reader is over every limit", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);
		seedFeeds(state, TIER_LIMITS.free.feeds + 5);
		seedItems(state, "feed-0", TIER_LIMITS.free.saved + 1, true);

		let exported = await user.exportFeeds();

		expect(exported).toHaveLength(TIER_LIMITS.free.feeds + 5);
	});

	test("resubscribing restores every refused operation with one column write", async () => {
		let { state, user } = await createReader();
		await user.ensureUser(SUBJECT);
		seedFeeds(state, TIER_LIMITS.free.feeds);

		let refused = await user.followFeed(FEED_URL);
		expect(refused.ok).toBe(false);

		await user.setTier({ entitled: "paid", cancelled: false, readAt: 1, source: "billing" });

		let followed = await user.followFeed(FEED_URL);

		expect(followed.ok).toBe(true);
		expect((await user.entitlement()).over).toEqual([]);
	});
});
