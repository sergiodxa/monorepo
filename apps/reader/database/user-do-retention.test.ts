/**
 * Drives retention against the object that performs it: a real SQLite, a real feed object
 * behind the `FEED` binding, a real KV holding the heads and a real catalog behind
 * `PLATFORM_DB`.
 *
 * What is asserted here is that the budget a sweep is held to is the one the reader's own
 * tier carries, that moving between tiers moves that number and nothing else, and that
 * every rule allowed to delete a post is still the reader's own.
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

import type { Tier } from "~/app/lib/entitlement";
import type { FeedStore } from "~/database/feed-do";
import type { Velocity } from "~/database/schema";

import { TIERS } from "~/app/lib/entitlement";
import { FLAG_SET, flags } from "~/app/lib/flags";
import { logger } from "~/bootstrap/logger";
import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { FeedDO } from "~/database/feed-do";
import { TIER_BUDGETS, TIER_SAVED_LIMITS } from "~/database/schema";
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

const SUBJECT = "sub-retention";
const FEED_URL = "https://example.com/feed.xml";

/**
 * What every tier's budget is scaled down by, so an object that would take a quarter of a
 * million rows to fill takes ten. It narrows the number under test and leaves the rule
 * alone: a sweep reclaims only while over budget, only from feeds over their share, and
 * only what the reader has read, at either figure.
 */
const SCALE = 1 / 25_000;

/** What each tier holds at {@link SCALE}, which is what every count below is read against. */
const SCALED: Record<Tier, number> = {
	free: Math.round(TIER_BUDGETS.free * SCALE),
	paid: Math.round(TIER_BUDGETS.paid * SCALE),
	premium: Math.round(TIER_BUDGETS.premium * SCALE),
};

/** One entry of the RSS document an origin serves. */
interface Entry {
	guid: string;
	title: string;
	published: string;
}

/** Three posts a day apart, newest last, which is the document the pause tests start from. */
const ENTRIES: Entry[] = [
	{ guid: "a", title: "First", published: "Mon, 01 Sep 2025 10:00:00 GMT" },
	{ guid: "b", title: "Second", published: "Tue, 02 Sep 2025 10:00:00 GMT" },
	{ guid: "c", title: "Third", published: "Wed, 03 Sep 2025 10:00:00 GMT" },
];

/** Builds the RSS 2.0 document an origin answers with. */
function rss(entries: Entry[], title = "Example"): string {
	let body = entries
		.map(
			(entry) =>
				`<item><guid isPermaLink="false">${entry.guid}</guid><title>${entry.title}</title>` +
				`<link>https://example.com/${entry.guid}</link>` +
				`<pubDate>${entry.published}</pubDate><description>About ${entry.title}</description>` +
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

/** The catalog, wrapped so a test can say the sweep ran no statement against it. */
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

/**
 * Narrows every tier's budget by the same fraction, by serving a different definition
 * rather than by mocking the constant, so these tests walk the path the object walks: the
 * tier carries the number, the flag scales it, and what comes out is what the sweep obeys.
 */
async function setBudgetScale(scale: number): Promise<void> {
	await flags.setProvider(
		new EngineProvider(
			createEngine({
				store: new InMemoryFlagStore({
					flags: {
						...FLAG_SET.flags,
						"reader-budget-scale": {
							variants: { standard: scale },
							defaultVariant: "standard",
						},
					},
				}),
			}),
		),
	);
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	feedObjects.clear();
	catalogQueries.length = 0;
	await setBudgetScale(SCALE);

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: createKVNamespace(),
		PLATFORM_DB: countingCatalog(catalog),
		FEED: createDurableObjectNamespace<FeedDO>((feedId) => feedStub(feedId)),
	};

	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(ENTRIES))));
});

/** Builds a reader's object and waits out the boot, the way a first request would. */
async function createReader(
	subject = SUBJECT,
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: subject });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);
	await user.ensureUser(subject);

	return { state, user };
}

/**
 * Puts a reader on a tier the way the billing path does, which is the only writer of it.
 *
 * @param cancelled - Whether the reader asked for the subscription to stop, which is what
 * drops a tier at once rather than opening a lapse window and keeping the higher one.
 */
async function putOnTier(user: UserDO, tier: Tier, readAt = 1, cancelled = false): Promise<void> {
	let applied = await user.setTier({ entitled: tier, cancelled, readAt, source: "billing" });
	if (!applied.ok) throw new Error(`moving to ${tier} failed: ${applied.reason}`);
}

/** One subscription row, written straight into storage for a test that follows nothing. */
function seedFeed(state: DurableObjectStateMock, id: string, velocity: Velocity = "evergreen") {
	state.storage.sql.exec(
		`INSERT INTO feeds
			(id, feed_id, feed_url, site_url, title, description, language, image_url,
			 cursor, velocity, unfollowed_at, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, 0, ?, NULL, 0, 0)`,
		id,
		`canonical-${id}`,
		`https://${id}.example.com/feed.xml`,
		id,
		velocity,
	);

	return id;
}

/**
 * Posts of one subscription, written straight into storage, published a second apart so
 * the oldest of them is the one a reclamation reaches first.
 *
 * @param seed - How many to write, and what the reader has already done with them.
 */
function seedItems(
	state: DurableObjectStateMock,
	subscriptionId: string,
	seed: { count: number; read?: boolean; saved?: boolean; publishedAt?: number; prefix?: string },
): string[] {
	let ids: string[] = [];

	for (let index = 0; index < seed.count; index++) {
		let id = `${subscriptionId}-${seed.prefix ?? "item"}-${index}`;

		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, 0, 0)`,
			id,
			subscriptionId,
			id,
			id,
			(seed.publishedAt ?? 0) + index,
			seed.read === true ? 1 : null,
			seed.saved === true ? 1 : null,
		);

		ids.push(id);
	}

	return ids;
}

/** How many rows of one table the object holds, read without going through an RPC. */
function rowCount(state: DurableObjectStateMock, table: string, where = "1 = 1"): number {
	let [row] = state.storage.sql
		.exec(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`)
		.toArray();

	return Number(row?.["total"]);
}

/** The fields of the one retention event a run emitted, which is what a sweep reports. */
function retentionEvent(open: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
	let calls = open.mock.calls as unknown as [string, Record<string, unknown>][];
	let recorded = calls.filter(([, fields]) => fields["event"] === "user.retention");
	let last = recorded.at(-1);

	if (last === undefined) throw new Error("the run emitted no retention event");

	return last[1];
}

describe("the budget a sweep is held to", () => {
	test("a reader with no tier recorded is budgeted as free", async () => {
		let { state, user } = await createReader();
		let feed = seedFeed(state, "feed-a");
		seedItems(state, feed, { count: SCALED.free + 2, read: true });

		expect((await user.entitlement()).limits.posts).toBe(TIER_BUDGETS.free);

		await user.synchronize();

		expect(rowCount(state, "feed_items")).toBe(SCALED.free);
	});

	test("each tier reclaims at its own budget, and at no other", async () => {
		for (let tier of TIERS) {
			let { state, user } = await createReader(`${SUBJECT}-${tier}`);
			await putOnTier(user, tier);

			let feed = seedFeed(state, "feed-a");
			seedItems(state, feed, { count: SCALED[tier] + 5, read: true });

			await user.synchronize();

			expect(rowCount(state, "feed_items")).toBe(SCALED[tier]);
		}
	});

	test("a reader under their tier's budget loses no post, however many feeds they follow", async () => {
		let { state, user } = await createReader();

		for (let index = 0; index < SCALED.free - 2; index++) {
			seedItems(state, seedFeed(state, `feed-${index}`), { count: 1, read: true });
		}

		await user.synchronize();

		expect(rowCount(state, "feed_items")).toBe(SCALED.free - 2);
	});

	test("the per-feed share is the tier's budget divided by the subscription count", async () => {
		let { state, user } = await createReader();

		/** Two feeds against ten posts is a share of five: one feed is over it and one is not. */
		seedItems(state, seedFeed(state, "feed-over"), { count: 8, read: true });
		seedItems(state, seedFeed(state, "feed-under"), { count: 4, read: true });

		await user.synchronize();

		expect(rowCount(state, "feed_items", "feed_id = 'feed-over'")).toBe(SCALED.free / 2);
		expect(rowCount(state, "feed_items", "feed_id = 'feed-under'")).toBe(4);
	});

	test("the sweep reads the tier from the object's own settings and queries no catalog", async () => {
		let { state, user } = await createReader();
		seedItems(state, seedFeed(state, "feed-a"), { count: SCALED.free + 2, read: true });

		catalogQueries.length = 0;

		await user.synchronize();

		expect(catalogQueries).toEqual([]);
	});

	test("the retention event says which tier was applied and what it allowed", async () => {
		let { state, user } = await createReader();
		await putOnTier(user, "paid");
		seedItems(state, seedFeed(state, "feed-a"), { count: SCALED.paid + 3, read: true });

		let open = vi.spyOn(logger, "open");

		await user.synchronize();

		expect(retentionEvent(open)).toMatchObject({
			tier: "paid",
			budget: SCALED.paid,
			reclaimed: 3,
		});

		open.mockRestore();
	});

	test("an unknown tier is refused by the CHECK rather than silently budgeted", async () => {
		let { state } = await createReader();

		expect(() => {
			state.storage.sql.exec("UPDATE settings SET tier = 'enterprise'");
		}).toThrow();
	});
});

describe("what moving between tiers does to what is stored", () => {
	test("an upgrade raises the budget and reclaims nothing that was already stored", async () => {
		let { state, user } = await createReader();
		seedItems(state, seedFeed(state, "feed-a"), { count: SCALED.free + 4, read: true });

		await putOnTier(user, "paid");
		await user.synchronize();

		expect(rowCount(state, "feed_items")).toBe(SCALED.free + 4);
	});

	test("a downgrade deletes no post, and the object applies back-pressure instead", async () => {
		let { state, user } = await createReader();
		await putOnTier(user, "premium");

		/** Nothing read, so an object over the lower budget has nothing it may reclaim. */
		seedItems(state, seedFeed(state, "feed-a"), { count: SCALED.free + 4 });

		let open = vi.spyOn(logger, "open");

		await putOnTier(user, "free", 2, true);
		await user.synchronize();

		expect(rowCount(state, "feed_items")).toBe(SCALED.free + 4);
		expect(retentionEvent(open)).toMatchObject({ reclaimed: 0, paused: 1, tier: "free" });

		open.mockRestore();
	});

	test("a downgraded reader's saved posts survive the downgrade intact", async () => {
		let { state, user } = await createReader();
		await putOnTier(user, "premium");

		let feed = seedFeed(state, "feed-a");
		seedItems(state, feed, { count: SCALED.free + 6, read: true });
		seedItems(state, feed, { count: 5, read: true, saved: true, prefix: "kept" });

		await putOnTier(user, "free", 2, true);
		await user.synchronize();

		expect(rowCount(state, "feed_items", "saved_at IS NOT NULL")).toBe(5);
	});

	test("a refresh of the tier column materializes nothing and takes nothing", async () => {
		let { state, user } = await createReader();
		await putOnTier(user, "paid");
		seedItems(state, seedFeed(state, "feed-a"), { count: 6, read: true });

		await putOnTier(user, "paid", 2);

		expect(rowCount(state, "feed_items")).toBe(6);
		expect((await user.entitlement()).tier).toBe("paid");
	});
});

describe("the rules a tier does not move", () => {
	test("saved posts stay exempt from reclamation on every tier", async () => {
		for (let tier of TIERS) {
			let { state, user } = await createReader(`${SUBJECT}-saved-${tier}`);
			await putOnTier(user, tier);

			let feed = seedFeed(state, "feed-a");
			seedItems(state, feed, { count: 4, read: true, saved: true, prefix: "kept" });
			seedItems(state, feed, { count: SCALED[tier] + 6, read: true });

			await user.synchronize();

			expect(rowCount(state, "feed_items", "saved_at IS NOT NULL")).toBe(4);
		}
	});

	test("a velocity ages posts out identically on all three tiers", async () => {
		for (let tier of TIERS) {
			let { state, user } = await createReader(`${SUBJECT}-velocity-${tier}`);
			await putOnTier(user, tier);

			let feed = seedFeed(state, "feed-a", "breaking");

			/** Published at the epoch, which is past every window the column offers. */
			seedItems(state, feed, { count: 3 });
			seedItems(state, feed, { count: 2, publishedAt: Date.now(), prefix: "fresh" });

			await user.synchronize();

			expect(rowCount(state, "feed_items")).toBe(2);
		}
	});

	test("a free reader at budget with nothing read loses no post, and their worst feed pauses", async () => {
		let { state, user } = await createReader();

		seedItems(state, seedFeed(state, "feed-loud"), { count: 9 });
		seedItems(state, seedFeed(state, "feed-quiet"), { count: 3 });

		let open = vi.spyOn(logger, "open");

		await user.synchronize();

		expect(rowCount(state, "feed_items")).toBe(12);
		expect(retentionEvent(open)).toMatchObject({ reclaimed: 0, paused: 1 });

		open.mockRestore();
	});

	test("the per-tier saved limit refuses the next save and evicts none", async () => {
		let { state, user } = await createReader();

		let feed = seedFeed(state, "feed-a");
		seedItems(state, feed, { count: TIER_SAVED_LIMITS.free, saved: true, prefix: "kept" });
		let [spare] = seedItems(state, feed, { count: 1, prefix: "spare" });

		let refused = await user.saveItem(spare!);

		expect(refused).toEqual({
			ok: false,
			reason: "full",
			limit: {
				limit: "saved",
				current: TIER_SAVED_LIMITS.free,
				allowed: TIER_SAVED_LIMITS.free,
				tier: "free",
			},
		});

		expect(rowCount(state, "feed_items", "saved_at IS NOT NULL")).toBe(TIER_SAVED_LIMITS.free);
	});

	test("a saved limit lowered by a downgrade refuses new saves and removes no existing one", async () => {
		let { state, user } = await createReader();
		await putOnTier(user, "premium");

		let feed = seedFeed(state, "feed-a");
		let held = TIER_SAVED_LIMITS.free + 200;
		seedItems(state, feed, { count: held, saved: true, prefix: "kept" });
		let [spare] = seedItems(state, feed, { count: 1, prefix: "spare" });

		await putOnTier(user, "free", 2, true);

		expect(await user.saveItem(spare!)).toMatchObject({ ok: false, reason: "full" });
		expect(rowCount(state, "feed_items", "saved_at IS NOT NULL")).toBe(held);
	});
});

describe("a feed that stopped taking posts", () => {
	test("resumes when reading brings the object back under its budget", async () => {
		let { state, user } = await createReader();

		/** Two posts of room, against a feed already holding three of them. */
		await setBudgetScale(2 / TIER_BUDGETS.free);

		let followed = await user.followFeed(FEED_URL);
		if (!followed.ok) throw new Error(`following failed: ${followed.reason}`);

		expect(rowCount(state, "feed_items")).toBe(3);

		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.xml(
					rss([
						...ENTRIES,
						{ guid: "d", title: "Fourth", published: "Thu, 04 Sep 2025 10:00:00 GMT" },
					]),
				),
			),
		);

		await (await feedObject(followed.feed.feedId)).refresh("manual");

		let held = await user.synchronize();

		expect(held.paused).toBe(1);
		expect(rowCount(state, "feed_items")).toBe(3);

		await user.markAllRead();
		await user.synchronize();

		/** The sweep took what was read, which is what leaves room for what was waiting. */
		let resumed = await user.synchronize();

		expect(resumed.paused).toBe(0);
		expect(rowCount(state, "feed_items", "id LIKE '%' AND read_at IS NULL")).toBeGreaterThan(0);
	});
});
