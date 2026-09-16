/**
 * Drives the clock the freshness comparison runs on against the object that holds it: a
 * real SQLite, real feed objects behind the `FEED` binding, a real KV holding the heads
 * and a real catalog behind `PLATFORM_DB`.
 *
 * What is asserted here is that a wake is derived from three due times rather than
 * remembered, that a tier decides whether there is a wake at all, that a scheduled check
 * is an open without the timeline and under the same bounds, and that a lease that has run
 * out stops the wakes without anything having to arrive.
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

import { limitsOf } from "~/app/lib/entitlement";
import { nextCheckAt, phaseOffset, SWEEP_INTERVAL_MS } from "~/app/lib/schedule";
import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { FeedDO } from "~/database/feed-do";
import { headKey } from "~/database/feed-head";
import { UserDO } from "~/database/user-do";

/** Every wide event the object wrote, in the order it wrote them. */
let emitted = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));

vi.mock("~/bootstrap/logger", () => ({
	logger: {
		open(kind: string, fields: Record<string, unknown>) {
			return { emit: () => emitted.events.push({ kind, ...fields }) };
		},
	},
}));

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

const SUBJECT = "sub-schedule";
const FEED_URL = "https://example.com/feed.xml";

/** A fixed moment a snapshot claims to have been read at, so orderings are arithmetic. */
const READ_AT = 1_800_000_000_000;

/** Feeds one run synchronizes, which a scheduled check works under unchanged. */
const SYNC_FEEDS_PER_REQUEST = 8;

/** How long the leftovers of a bounded run wait before carrying on. */
const CATCH_UP_MS = 60 * 1000;

/** What the paid tier buys, which is what a paid reader's wakes are spaced by. */
const PAID_INTERVAL_MS = limitsOf("paid").checkIntervalMs ?? 0;

/** The feed objects this run has built, one per canonical feed id. */
let feedObjects = new Map<string, Promise<FeedDO>>();

/** Every statement the catalog was asked to run, for the checks that must run none. */
let catalogQueries: string[] = [];

/** Every method a feed object was asked for, so a check says what it asked feeds about. */
let feedCalls: string[] = [];

/** How many reads the heads cost, so a check that stops being one round trip is visible. */
let headReads = { count: 0, failing: false };

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

/** The object the `FEED` binding hands back, recording what the reader asked it for. */
function feedStub(feedId: string) {
	return {
		async subscribe(userId: string, feedUrl: string): Promise<FeedStore.SubscribeResult> {
			feedCalls.push("subscribe");
			return await (await feedObject(feedId)).subscribe(userId, feedUrl);
		},

		async unsubscribe(userId: string): Promise<FeedStore.UnsubscribeResult> {
			feedCalls.push("unsubscribe");
			return await (await feedObject(feedId)).unsubscribe(userId);
		},

		async refresh(reason: FeedStore.RefreshReason): Promise<FeedStore.RefreshResult> {
			feedCalls.push("refresh");
			return await (await feedObject(feedId)).refresh(reason);
		},

		async getHead(): Promise<number> {
			feedCalls.push("getHead");
			return await (await feedObject(feedId)).getHead();
		},

		async getItemsAfter(cursor: number, limit?: number): Promise<FeedStore.ItemsPage> {
			feedCalls.push("getItemsAfter");
			return await (await feedObject(feedId)).getItemsAfter(cursor, limit);
		},
	};
}

/** The catalog, wrapped so a test can say a scheduled path ran no statement against it. */
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

/** The heads, wrapped so a test can count the reads a check cost and fail one of them. */
function countingKV(kv: KVNamespace): KVNamespace {
	return new Proxy(kv, {
		get(target, property, receiver) {
			if (property !== "get") return Reflect.get(target, property, receiver) as unknown;

			return (...args: unknown[]) => {
				headReads.count += 1;
				if (headReads.failing) throw new Error("the heads are unreachable");

				return (target.get as (...rest: unknown[]) => unknown)(...args);
			};
		},
	});
}

/** An RSS 2.0 document carrying one post per title. */
function rss(titles: string[]): string {
	let items = titles.map(
		(title, order) =>
			`<item><guid isPermaLink="false">${title}</guid><title>${title}</title>` +
			`<link>https://example.com/${order}</link>` +
			`<pubDate>Tue, 0${order + 1} Sep 2025 00:00:00 GMT</pubDate></item>`,
	);

	return (
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<rss version="2.0"><channel><title>Example</title>` +
		`<link>https://example.com</link><description>An example feed</description>` +
		`${items.join("")}</channel></rss>`
	);
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	feedObjects.clear();
	catalogQueries.length = 0;
	feedCalls.length = 0;
	emitted.events.length = 0;
	headReads = { count: 0, failing: false };

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: countingKV(createKVNamespace()),
		PLATFORM_DB: countingCatalog(catalog),
		FEED: createDurableObjectNamespace<FeedDO>((feedId) => feedStub(feedId)),
	};

	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(["First"]))));
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

/** Puts a reader on a tier the way the one writer of the column does. */
async function upgrade(user: UserDO, tier: "paid" | "premium", readAt = READ_AT): Promise<void> {
	await user.setTier({ entitled: tier, cancelled: false, readAt, source: "billing" });
}

/** The settings row, read without going through an RPC. */
function schedule(state: DurableObjectStateMock): Record<string, number | null> {
	let [row] = state.storage.sql.exec(`SELECT * FROM settings WHERE id = 1`).toArray();

	return {
		lastOpenedAt: (row?.["last_opened_at"] ?? null) as number | null,
		nextCheckAt: (row?.["next_check_at"] ?? null) as number | null,
		nextSweepAt: (row?.["next_sweep_at"] ?? null) as number | null,
		nextCatchUpAt: (row?.["next_catch_up_at"] ?? null) as number | null,
	};
}

/** Writes due times straight into storage, which is how a test makes a job due. */
function setSchedule(
	state: DurableObjectStateMock,
	values: Partial<Record<"next_check_at" | "next_sweep_at" | "next_catch_up_at", number | null>>,
): void {
	for (let [column, value] of Object.entries(values)) {
		state.storage.sql.exec(`UPDATE settings SET ${column} = ? WHERE id = 1`, value);
	}
}

/** Puts the reader's last open however far in the past a dormancy rung needs it. */
function setLastOpened(state: DurableObjectStateMock, at: number | null): void {
	state.storage.sql.exec(`UPDATE settings SET last_opened_at = ? WHERE id = 1`, at);
}

/** Subscriptions written straight into storage, for a test that follows nothing. */
function seedFeeds(state: DurableObjectStateMock, count: number, velocity = "evergreen"): string[] {
	let ids: string[] = [];

	for (let index = 0; index < count; index++) {
		let id = `feed-${index}`;

		state.storage.sql.exec(
			`INSERT INTO feeds
				(id, feed_id, feed_url, site_url, title, description, language, image_url,
				 cursor, velocity, unfollowed_at, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, 0, ?, NULL, 0, 0)`,
			id,
			`canonical-${index}`,
			`https://${id}.example.com/feed.xml`,
			id,
			velocity,
		);

		ids.push(id);
	}

	return ids;
}

/** One post of a seeded subscription, published however long ago the test needs. */
function seedItem(state: DurableObjectStateMock, subscriptionId: string, publishedAt: number) {
	state.storage.sql.exec(
		`INSERT INTO feed_items
			(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
			 created_at, updated_at)
		 VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, 0, 0)`,
		`${subscriptionId}-item`,
		subscriptionId,
		`${subscriptionId}-item`,
		subscriptionId,
		publishedAt,
	);
}

/** Says a feed has moved, which is the whole of what a reader compares against. */
async function publishHeads(count: number, head: number): Promise<void> {
	let kv = bindings.current["KV"] as KVNamespace;
	for (let index = 0; index < count; index++) {
		await kv.put(headKey(`canonical-${index}`), String(head));
	}
}

/** How many rows of one table the object holds, read without going through an RPC. */
function rowCount(state: DurableObjectStateMock, table: string): number {
	let [row] = state.storage.sql.exec(`SELECT COUNT(*) AS total FROM ${table}`).toArray();
	return Number(row?.["total"]);
}

/** Whether a wake sits on the grid one interval and one subject imply. */
function onGrid(subject: string, intervalMs: number, at: number): boolean {
	return (at - phaseOffset(subject, intervalMs)) % intervalMs === 0;
}

/** Every event of one name the object wrote. */
function eventsNamed(name: string): Record<string, unknown>[] {
	return emitted.events.filter((event) => event["event"] === name);
}

describe("what a tier arms", () => {
	test("a free reader's object arms no alarm and never wakes on its own", async () => {
		let { state, user } = await createReader();

		expect(await state.storage.getAlarm()).toBeNull();
		expect(schedule(state).nextCheckAt).toBeNull();
		expect(schedule(state).nextSweepAt).toBeNull();

		await user.openReader();

		expect(await state.storage.getAlarm()).toBeNull();
	});

	test("a paid reader's object wakes within its interval, a premium one within theirs", async () => {
		let paid = await createReader("sub-paid");
		await upgrade(paid.user, "paid");

		let premium = await createReader("sub-premium");
		await upgrade(premium.user, "premium");

		let paidAlarm = await paid.state.storage.getAlarm();
		let premiumAlarm = await premium.state.storage.getAlarm();

		expect(paidAlarm).toBeGreaterThan(Date.now());
		expect(paidAlarm).toBeLessThanOrEqual(Date.now() + (limitsOf("paid").checkIntervalMs ?? 0));

		expect(premiumAlarm).toBeGreaterThan(Date.now());
		expect(premiumAlarm).toBeLessThanOrEqual(
			Date.now() + (limitsOf("premium").checkIntervalMs ?? 0),
		);
	});

	test("two subjects on one tier take different phases, each stable across reschedules", async () => {
		let first = await createReader("sub-phase-first");
		await upgrade(first.user, "paid");

		let second = await createReader("sub-phase-second");
		await upgrade(second.user, "paid");

		let firstWake = schedule(first.state).nextCheckAt;
		expect(firstWake).not.toBe(schedule(second.state).nextCheckAt);

		await first.user.openReader();
		expect(schedule(first.state).nextCheckAt).toBe(firstWake);
	});

	test("a settings row written before this migration reads as free rather than as null", async () => {
		let state = createDurableObjectState({ name: SUBJECT });
		let user = new UserDO(state, env);
		await state.blockConcurrencyWhile(async () => undefined);

		state.storage.sql.exec(`DELETE FROM settings`);
		state.storage.sql.exec(
			`INSERT INTO settings (id, subject, created_at, updated_at) VALUES (1, ?, 0, 0)`,
			SUBJECT,
		);

		let settings = await user.ensureUser(SUBJECT);

		expect(settings.tier).toBe("free");
		expect(await state.storage.getAlarm()).toBeNull();
	});

	test("an upgrade re-arms at once, and a drop to free clears the check and leaves the rest", async () => {
		let { state, user } = await createReader();

		await upgrade(user, "premium");
		expect(schedule(state).nextCheckAt).not.toBeNull();

		setSchedule(state, { next_catch_up_at: READ_AT });

		await user.setTier({
			entitled: "free",
			cancelled: true,
			readAt: READ_AT + 1000,
			source: "billing",
		});

		expect(schedule(state).nextCheckAt).toBeNull();
		expect(schedule(state).nextSweepAt).toBeNull();
		expect(schedule(state).nextCatchUpAt).toBe(READ_AT);
		expect(await state.storage.getAlarm()).toBe(READ_AT);
	});

	test("a lease that has run out is free, and the object stops arming checks", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		state.storage.sql.exec(`UPDATE settings SET grace_until = ? WHERE id = 1`, Date.now() - 1);

		await user.alarm();

		expect(schedule(state).nextCheckAt).toBeNull();
		expect(await state.storage.getAlarm()).toBeNull();
	});

	test("the tier a snapshot moved is reported with where it came from", async () => {
		let { user } = await createReader();
		await upgrade(user, "paid");

		expect(eventsNamed("user.tier")[0]).toMatchObject({
			from: "free",
			to: "paid",
			source: "billing",
		});
	});
});

describe("the dormancy ladder", () => {
	test("an account past ninety days without an open checks on the slowest rung", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		setLastOpened(state, Date.now() - 200 * 24 * 60 * 60 * 1000);
		await user.alarm();

		let wake = schedule(state).nextCheckAt ?? 0;

		expect(onGrid(SUBJECT, PAID_INTERVAL_MS * 24, wake)).toBe(true);
		expect(wake).toBeLessThanOrEqual(Date.now() + PAID_INTERVAL_MS * 24);
	});

	test("an open resets dormancy, and the next wake uses the unmultiplied interval", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		setLastOpened(state, Date.now() - 200 * 24 * 60 * 60 * 1000);
		await user.alarm();

		await user.openReader();

		let wake = schedule(state).nextCheckAt ?? 0;

		expect(schedule(state).lastOpenedAt).toBeGreaterThan(0);
		expect(onGrid(SUBJECT, PAID_INTERVAL_MS, wake)).toBe(true);
		expect(wake).toBeLessThanOrEqual(Date.now() + PAID_INTERVAL_MS);
	});
});

describe("what a scheduled check does", () => {
	test("reads the heads, derives staleness and synchronizes without a timeline", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		let followed = await user.followFeed(FEED_URL);
		if (!followed.ok) throw new Error(`following failed: ${followed.reason}`);

		server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(["First", "Second"]))));
		await (await feedObject(followed.feed.feedId)).refresh("manual");

		emitted.events.length = 0;
		setSchedule(state, { next_check_at: Date.now() - 1 });
		await user.alarm();

		expect(rowCount(state, "feed_items")).toBe(2);
		expect(eventsNamed("user.freshness")[0]).toMatchObject({
			trigger: "scheduled",
			tier: "paid",
			stale: 1,
		});
	});

	test("finding nothing stale writes no items and re-arms", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, 3);

		setSchedule(state, { next_check_at: Date.now() - 1 });
		await user.alarm();

		expect(rowCount(state, "feed_items")).toBe(0);
		expect(feedCalls).toEqual([]);
		expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now());
		expect(eventsNamed("user.freshness")[0]).toMatchObject({ trigger: "scheduled", stale: 0 });
	});

	test("obeys the per-run bounds a request does, and defers the rest to the catch-up", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, SYNC_FEEDS_PER_REQUEST + 2);
		await publishHeads(SYNC_FEEDS_PER_REQUEST + 2, 5);

		setSchedule(state, { next_check_at: Date.now() - 1 });
		await user.alarm();

		expect(feedCalls.filter((call) => call === "getItemsAfter")).toHaveLength(
			SYNC_FEEDS_PER_REQUEST,
		);

		let after = schedule(state);

		expect(after.nextCatchUpAt).toBeLessThanOrEqual(Date.now() + CATCH_UP_MS);
		expect(after.nextCheckAt).not.toBeNull();
		expect(await state.storage.getAlarm()).toBe(after.nextCatchUpAt);
	});

	test("the catch-up carries the leftovers and the check stays armed behind it", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, SYNC_FEEDS_PER_REQUEST + 2);
		await publishHeads(SYNC_FEEDS_PER_REQUEST + 2, 5);

		setSchedule(state, { next_check_at: Date.now() - 1 });
		await user.alarm();

		let armedCheck = schedule(state).nextCheckAt;

		feedCalls.length = 0;
		setSchedule(state, { next_catch_up_at: Date.now() - 1 });
		await user.alarm();

		expect(feedCalls.filter((call) => call === "getItemsAfter").length).toBeGreaterThan(0);
		expect(schedule(state).nextCheckAt).toBe(armedCheck);
	});

	test("issues one bulk read per hundred subscriptions rather than one per subscription", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, 150);

		headReads.count = 0;
		setSchedule(state, { next_check_at: Date.now() - 1 });
		await user.alarm();

		expect(headReads.count).toBe(2);
	});

	test("reads no catalog and tells no feed object who subscribes to it", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, 3);
		await publishHeads(3, 5);

		catalogQueries.length = 0;
		feedCalls.length = 0;

		setSchedule(state, { next_check_at: Date.now() - 1 });
		await user.alarm();

		expect(catalogQueries).toEqual([]);
		expect(new Set(feedCalls)).toEqual(new Set(["getItemsAfter"]));
	});
});

describe("a wake", () => {
	test("with catch-up, check and sweep all due runs all three, catch-up first", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		setSchedule(state, {
			next_catch_up_at: Date.now() - 1,
			next_check_at: Date.now() - 1,
			next_sweep_at: Date.now() - 1,
		});

		await user.alarm();

		let after = schedule(state);

		expect(after.nextCatchUpAt).toBeNull();
		expect(after.nextCheckAt).toBeGreaterThan(Date.now());
		expect(after.nextSweepAt).toBeGreaterThan(Date.now());

		expect(eventsNamed("user.scheduled")[0]).toMatchObject({
			tier: "paid",
			due: "catchUp,check,sweep",
		});

		// The catch-up's own synchronization sweeps as it ends, so the first retention
		// event of the wake is the one leftovers produced rather than the sweep's own.
		expect(eventsNamed("user.retention").length).toBeGreaterThan(1);
	});

	test("with nothing due re-arms to the earliest due time and does no work", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, 2);
		await publishHeads(2, 5);

		feedCalls.length = 0;
		await user.alarm();

		expect(feedCalls).toEqual([]);
		expect(eventsNamed("user.scheduled")[0]).toMatchObject({ due: "" });
		expect(await state.storage.getAlarm()).toBe(schedule(state).nextCheckAt);
	});

	test("resolves when a job throws, and the next wake is still armed", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");
		seedFeeds(state, 2);

		setSchedule(state, { next_check_at: Date.now() - 1 });
		headReads.failing = true;

		await expect(user.alarm()).resolves.toBeUndefined();

		headReads.failing = false;

		expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now());
		expect(schedule(state).nextCheckAt).toBeGreaterThan(Date.now());
	});

	test("sweeps on its own due time for an object that synchronized nothing", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		let [subscription] = seedFeeds(state, 1, "breaking");
		seedItem(state, subscription ?? "", Date.now() - 10 * 60 * 60 * 1000);

		expect(rowCount(state, "feed_items")).toBe(1);

		setSchedule(state, { next_sweep_at: Date.now() - 1 });
		await user.alarm();

		expect(rowCount(state, "feed_items")).toBe(0);
		expect(schedule(state).nextSweepAt).toBeGreaterThan(Date.now() + SWEEP_INTERVAL_MS - 10_000);
	});
});

describe("where the alarm points", () => {
	test("the earliest due time wins, whichever job holds it", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		let soon = Date.now() + 1000;
		setSchedule(state, { next_catch_up_at: soon });
		await user.openReader();

		expect(await state.storage.getAlarm()).toBe(soon);
	});

	test("a paid reader's wake sits on the grid the subject and the interval imply", async () => {
		let { state, user } = await createReader();
		await upgrade(user, "paid");

		let wake = schedule(state).nextCheckAt ?? 0;

		expect(onGrid(SUBJECT, PAID_INTERVAL_MS, wake)).toBe(true);
		expect(wake).toBe(nextCheckAt(SUBJECT, PAID_INTERVAL_MS, wake - PAID_INTERVAL_MS));
	});
});
