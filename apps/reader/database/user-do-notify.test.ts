/**
 * Drives the notification step against the object that owns it: a real SQLite, real feed
 * objects behind the `FEED` binding, a real KV holding the heads, and every push service
 * answer coming back through MSW.
 *
 * What is asserted here is that only a wake notifies, that forty posts across nine feeds
 * are one interruption, that a gap and a quiet window defer rather than drop, and that each
 * response a push service can give does exactly one thing to the device it was about.
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

import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { FeedDO } from "~/database/feed-do";
import { headKey } from "~/database/feed-head";
import { PUSH_GAP_MS } from "~/database/notify";
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

/** The bindings and secrets the object reads off `cloudflare:workers`. */
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

const SUBJECT = "sub-notify";

/**
 * The application server's key pair, taken from RFC 8291's own published example so the
 * signature and the encryption below run over material the specification vouches for.
 */
const VAPID = {
	publicKey:
		"BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
	privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
	subject: "mailto:notifications@example.com",
};

/** The client key material one browser hands over, from the same published example. */
const DEVICE_KEYS = {
	p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
	auth: "BTBZMqHH6r4Tts7J_aSIgg",
};

/** The host every registered endpoint in this file points at. */
const PUSH_HOST = "https://push.example.test";

/** A fixed moment a tier snapshot claims to have been read at. */
const READ_AT = 1_800_000_000_000;

/** The feed objects this run has built, one per canonical feed id. */
let feedObjects = new Map<string, Promise<FeedDO>>();

/** Every delivery a push service received, in the order it received them. */
let deliveries: { url: string; authorization: string; encoding: string; body: string }[] = [];

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

/** The object the `FEED` binding hands back. */
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

/** Answers every delivery with one status, recording what arrived. */
function pushAnswers(status: number | ((url: string) => number)): void {
	server.use(
		http.post(`${PUSH_HOST}/*`, async ({ request }) => {
			deliveries.push({
				url: request.url,
				authorization: request.headers.get("authorization") ?? "",
				encoding: request.headers.get("content-encoding") ?? "",
				body: Buffer.from(await request.arrayBuffer()).toString("base64"),
			});

			let answered = typeof status === "number" ? status : status(request.url);

			return new HttpResponse(null, { status: answered });
		}),
	);
}

beforeEach(async () => {
	feedObjects.clear();
	emitted.events.length = 0;
	deliveries.length = 0;

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: createKVNamespace(),
		PLATFORM_DB: catalog,
		FEED: createDurableObjectNamespace<FeedDO>((feedId) => feedStub(feedId)),
		VAPID_PUBLIC_KEY: VAPID.publicKey,
		VAPID_PRIVATE_KEY: VAPID.privateKey,
		VAPID_SUBJECT: VAPID.subject,
		/** No mail transport, so the email channel stays closed unless a test opens one. */
		EMAIL: "",
		EMAIL_FROM: "",
		APP_URL: "https://reader.example.test",
	};

	pushAnswers(201);
});

/** Builds a reader's object on a tier that wakes, which is what notifies. */
async function createReader(
	subject = SUBJECT,
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState({ name: subject });
	let user = new UserDO(state, env);

	await state.blockConcurrencyWhile(async () => undefined);
	await user.ensureUser(subject, "reader@example.com");
	await user.setTier({ entitled: "premium", cancelled: false, readAt: READ_AT, source: "billing" });

	return { state, user };
}

/** A subscription written straight into storage, opted in or not. */
function seedFeed(
	state: DurableObjectStateMock,
	id: string,
	title: string,
	notify: boolean,
	index = 0,
): void {
	state.storage.sql.exec(
		`INSERT INTO feeds (id, feed_id, feed_url, title, cursor, velocity, notify, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 0, 'evergreen', ?, 0, 0)`,
		id,
		`canonical-${index}`,
		`https://${id}.example.com/feed.xml`,
		title,
		notify ? 1 : 0,
	);
}

/** A post this object wrote at a given moment, which is what a summary counts. */
function seedItem(
	state: DurableObjectStateMock,
	id: string,
	feedId: string,
	writtenAt: number = Date.now(),
): void {
	state.storage.sql.exec(
		`INSERT INTO feed_items
			(id, feed_id, guid, title, url, summary, author, published_at, created_at, updated_at)
		 VALUES (?, ?, ?, 'A secret post title', 'https://example.com/secret', 'A secret summary',
		         'A secret author', 0, ?, ?)`,
		id,
		feedId,
		id,
		writtenAt,
		writtenAt,
	);
}

/** Reads one column off the settings row, without going through an RPC. */
function settingsColumn(state: DurableObjectStateMock, column: string): unknown {
	let [row] = state.storage.sql.exec(`SELECT ${column} FROM settings WHERE id = 1`).toArray();
	return row?.[column] ?? null;
}

/** Writes one column of the settings row, which is how a test makes a job due. */
function setSettings(state: DurableObjectStateMock, column: string, value: unknown): void {
	state.storage.sql.exec(`UPDATE settings SET ${column} = ? WHERE id = 1`, value);
}

/** Every device row the object holds. */
function devices(state: DurableObjectStateMock): Record<string, unknown>[] {
	return state.storage.sql
		.exec(`SELECT * FROM push_subscriptions ORDER BY endpoint`)
		.toArray() as Record<string, unknown>[];
}

/** Registers one browser and turns the push channel on. */
async function registerDevice(user: UserDO, name = "device-1"): Promise<string> {
	let endpoint = `${PUSH_HOST}/${name}`;

	await user.registerDevice({ endpoint, ...DEVICE_KEYS, userAgent: name, locale: "en" });
	await user.setChannels({ push: true, email: false });

	return endpoint;
}

/** Makes the scheduled check due and runs the one alarm, the way the platform would. */
async function wake(state: DurableObjectStateMock, user: UserDO, now = Date.now()): Promise<void> {
	setSettings(state, "next_check_at", now - 1);
	await user.alarm();
}

/** The URL the one really-followed feed of this file is published at. */
const FEED_URL = "https://example.com/feed.xml";

/** Follows a feed for real, so the object behind it holds items a check can read. */
async function followOne(user: UserDO): Promise<{ id: string; feedId: string }> {
	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(["First", "Second"]))));

	let followed = await user.followFeed(FEED_URL);
	if (!followed.ok) throw new Error(`following answered ${followed.reason}`);

	return { id: followed.feed.id, feedId: followed.feed.feedId };
}

/**
 * Puts the subscription back behind its feed, with the posts it had gone. The next check
 * materializes them again, which is what a check finding something new does.
 */
async function makeStale(state: DurableObjectStateMock, feedId: string): Promise<void> {
	state.storage.sql.exec(`DELETE FROM feed_items`);
	state.storage.sql.exec(`UPDATE feeds SET cursor = 0`);

	await (bindings.current["KV"] as KVNamespace).put(headKey(feedId), "99");
}

/** Every event of one name the object wrote. */
function eventsNamed(name: string): Record<string, unknown>[] {
	return emitted.events.filter((event) => event["event"] === name);
}

describe("what a check notifies about", () => {
	test("a scheduled check that materializes posts sends one notification", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		let followed = await followOne(user);
		await user.setFeedNotify(followed.id, true);
		await makeStale(state, followed.feedId);

		await wake(state, user);

		expect(deliveries).toHaveLength(1);
		expect(settingsColumn(state, "last_notified_at")).not.toBeNull();
	});

	test("forty posts across nine feeds send one notification naming at most three feeds", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		for (let index = 0; index < 9; index++) {
			seedFeed(state, `feed-${index}`, `Feed ${index}`, true, index);
			for (let post = 0; post < 5; post++)
				seedItem(state, `i${index}-${post}`, `feed-${index}`, 10);
		}

		await wake(state, user);

		expect(deliveries).toHaveLength(1);

		let [event] = eventsNamed("user.notify");
		expect(event?.["posts"]).toBe(45);
		expect(event?.["feeds"]).toBe(9);
	});

	test("a check finding posts only in silent feeds sends nothing and writes no timestamp", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", false);
		seedItem(state, "i1", "feed-a", 10);

		await wake(state, user);

		expect(deliveries).toHaveLength(0);
		expect(settingsColumn(state, "last_notified_at")).toBeNull();
	});

	test("a single post notifies, with no count threshold in the way", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await wake(state, user);

		expect(deliveries).toHaveLength(1);
	});

	test("the payload carries a count and feed titles, and no post title, URL or author", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await wake(state, user);

		let [delivery] = deliveries;

		/**
		 * The body is a ciphertext, so what it does not carry is asserted over its bytes: a
		 * post's title, URL and author never reach it in any encoding.
		 */
		let decoded = Buffer.from(delivery?.body ?? "", "base64").toString("binary");

		expect(decoded).not.toContain("A secret post title");
		expect(decoded).not.toContain("A secret summary");
		expect(decoded).not.toContain("A secret author");
		expect(delivery?.encoding).toBe("aes128gcm");
		expect(delivery?.authorization).toContain("vapid t=");
	});
});

describe("what leaves an opt-in alone", () => {
	test("following a feed leaves it silent", async () => {
		let { state, user } = await createReader();

		server.use(
			http.get("https://example.com/feed.xml", () => HttpResponse.xml(rss(["First"]))),
			http.get("https://example.com/", () => HttpResponse.xml(rss(["First"]))),
		);

		let followed = await user.followFeed("https://example.com/feed.xml");

		expect(followed.ok).toBe(true);
		expect(followed.ok && followed.feed.notify).toBe(false);
		expect(state.storage.sql.exec(`SELECT notify FROM feeds`).toArray()).toEqual([{ notify: 0 }]);
	});

	test("importing a document opts none of its feeds in", async () => {
		let { state, user } = await createReader();

		server.use(http.get("https://example.com/feed.xml", () => HttpResponse.xml(rss(["First"]))));

		await user.importFeeds([{ feedUrl: "https://example.com/feed.xml" }]);

		expect(state.storage.sql.exec(`SELECT notify FROM feeds`).toArray()).toEqual([{ notify: 0 }]);
	});

	test("a plan change switches nothing on", async () => {
		let { state, user } = await createReader("sub-plan");

		seedFeed(state, "feed-a", "Alpha", false);

		await user.setTier({
			entitled: "premium",
			cancelled: false,
			readAt: READ_AT + 1,
			source: "billing",
		});

		expect(state.storage.sql.exec(`SELECT notify FROM feeds`).toArray()).toEqual([{ notify: 0 }]);
		expect(settingsColumn(state, "notify_push")).toBe(0);
		expect(settingsColumn(state, "notify_email")).toBe(0);
	});
});

describe("what bounds an interruption", () => {
	test("a second check inside the minimum gap sends nothing and advances no timestamp", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await wake(state, user);
		let first = settingsColumn(state, "last_notified_at");

		seedItem(state, "i2", "feed-a", Date.now());
		await wake(state, user);

		expect(deliveries).toHaveLength(1);
		expect(settingsColumn(state, "last_notified_at")).toBe(first);
		expect(eventsNamed("user.notify.suppressed")[0]?.["reason"]).toBe("gap");
	});

	test("the check after the gap carries everything since the last notification", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await wake(state, user);

		/** Two more posts, and a last notification far enough back for the gap to be over. */
		seedItem(state, "i2", "feed-a");
		seedItem(state, "i3", "feed-a");
		setSettings(state, "last_notified_at", Date.now() - PUSH_GAP_MS - 1);

		await wake(state, user);

		expect(deliveries).toHaveLength(2);

		/** Two, not one: the summary was never about the check that sent it. */
		expect(eventsNamed("user.notify")[1]?.["posts"]).toBe(2);
	});

	test("a notification inside quiet hours is held, and the next check outside them carries it", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		/** A window covering every hour of the day but the one this check runs in. */
		let hour = new Date().getUTCHours();
		await user.setQuietHours({ enabled: true, from: hour, to: (hour + 1) % 24 });

		await wake(state, user);

		expect(deliveries).toHaveLength(0);
		expect(settingsColumn(state, "last_notified_at")).toBeNull();
		expect(eventsNamed("user.notify.suppressed")[0]?.["reason"]).toBe("quiet-hours");

		await user.setQuietHours({ enabled: false, from: hour, to: (hour + 1) % 24 });
		await wake(state, user);

		expect(deliveries).toHaveLength(1);
		expect(settingsColumn(state, "last_notified_at")).not.toBeNull();
	});

	test("feeds opted in with no channel on are reported rather than sent", async () => {
		let { state, user } = await createReader();

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await wake(state, user);

		expect(deliveries).toHaveLength(0);
		expect(eventsNamed("user.notify.suppressed")[0]?.["reason"]).toBe("no-channel");
	});
});

describe("where notification runs, and where it must not", () => {
	test("synchronization a reader's own request started notifies nothing", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await user.synchronize();

		expect(deliveries).toHaveLength(0);
		expect(settingsColumn(state, "last_notified_at")).toBeNull();
	});

	test("opening the reader notifies nothing", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await user.openReader();

		expect(deliveries).toHaveLength(0);
	});

	test("a delivery that fails leaves every cursor and the alarm exactly as they were", async () => {
		let { state, user } = await createReader();
		await registerDevice(user);

		let followed = await followOne(user);
		await user.setFeedNotify(followed.id, true);
		await makeStale(state, followed.feedId);

		server.use(http.post(`${PUSH_HOST}/*`, () => HttpResponse.error()));

		await wake(state, user);

		let [feed] = state.storage.sql
			.exec(`SELECT cursor FROM feeds WHERE id = ?`, followed.id)
			.toArray();

		expect(Number(feed?.["cursor"])).toBeGreaterThan(0);
		expect(await state.storage.getAlarm()).not.toBeNull();
		expect(settingsColumn(state, "last_notified_at")).toBeNull();
	});
});

describe("what a refusal does to a device", () => {
	/** Seeds an opted-in feed with one post, which is what every case below notifies about. */
	async function readerWithSomethingToSay() {
		let reader = await createReader();

		seedFeed(reader.state, "feed-a", "Alpha", true);
		seedItem(reader.state, "i1", "feed-a", 10);

		return reader;
	}

	test("a 410 deletes the row now rather than counting it", async () => {
		let { state, user } = await readerWithSomethingToSay();
		await registerDevice(user);

		pushAnswers(410);
		await wake(state, user);

		expect(devices(state)).toHaveLength(0);
		expect(eventsNamed("push.expired")[0]?.["status"]).toBe(410);
	});

	test("a 429 increments the count and keeps the row", async () => {
		let { state, user } = await readerWithSomethingToSay();
		await registerDevice(user);

		pushAnswers(429);
		await wake(state, user);

		expect(devices(state)[0]?.["failure_count"]).toBe(1);
	});

	/** Our own signature being wrong, which no reader's device should be deleted for. */
	test("a 403 keeps the row, uncounted, and records what happened", async () => {
		let { state, user } = await readerWithSomethingToSay();
		await registerDevice(user);

		pushAnswers(403);
		await wake(state, user);

		expect(devices(state)).toHaveLength(1);
		expect(devices(state)[0]?.["failure_count"]).toBe(0);
		expect(eventsNamed("push.rejected")[0]?.["status"]).toBe(403);
	});

	test("ten consecutive transient failures delete the row", async () => {
		let { state, user } = await readerWithSomethingToSay();
		await registerDevice(user);

		pushAnswers(503);

		state.storage.sql.exec(`UPDATE push_subscriptions SET failure_count = 9`);
		await wake(state, user);

		expect(devices(state)).toHaveLength(0);
	});

	test("one acceptance clears a count a run of failures built up", async () => {
		let { state, user } = await readerWithSomethingToSay();
		await registerDevice(user);

		state.storage.sql.exec(`UPDATE push_subscriptions SET failure_count = 5`);
		await wake(state, user);

		expect(devices(state)[0]?.["failure_count"]).toBe(0);
		expect(devices(state)[0]?.["last_delivered_at"]).not.toBeNull();
	});

	test("two devices, one accepting and one failing, advance the timestamp once", async () => {
		let { state, user } = await readerWithSomethingToSay();

		await registerDevice(user, "device-1");
		await registerDevice(user, "device-2");

		pushAnswers((url) => (url.endsWith("device-1") ? 201 : 500));

		await wake(state, user);

		expect(deliveries).toHaveLength(2);
		expect(settingsColumn(state, "last_notified_at")).not.toBeNull();
		expect(devices(state)).toHaveLength(2);
	});

	test("the alarm resolves and re-arms when every delivery fails", async () => {
		let { state, user } = await readerWithSomethingToSay();
		await registerDevice(user);

		pushAnswers(500);

		await expect(wake(state, user)).resolves.toBeUndefined();

		expect(await state.storage.getAlarm()).not.toBeNull();
		expect(settingsColumn(state, "last_notified_at")).toBeNull();
	});
});

describe("registering a browser", () => {
	test("re-registering one endpoint updates a row rather than creating a second", async () => {
		let { state, user } = await createReader();

		let endpoint = `${PUSH_HOST}/device-1`;

		await user.registerDevice({ endpoint, ...DEVICE_KEYS, userAgent: "Firefox", locale: "en" });
		let again = await user.registerDevice({
			endpoint,
			...DEVICE_KEYS,
			userAgent: "Firefox, later",
			locale: "es",
		});

		expect(again.devices).toBe(1);
		expect(devices(state)).toHaveLength(1);
		expect(devices(state)[0]?.["user_agent"]).toBe("Firefox, later");
		expect(devices(state)[0]?.["locale"]).toBe("es");
	});

	test("forgetting a browser stops it being notified", async () => {
		let { state, user } = await createReader();

		seedFeed(state, "feed-a", "Alpha", true);
		seedItem(state, "i1", "feed-a", 10);

		await registerDevice(user);
		let [device] = await user.notifications().then((held) => held.devices);

		expect(await user.forgetDevice(device?.id ?? "")).toBe(true);

		await wake(state, user);

		expect(deliveries).toHaveLength(0);
	});

	/** An endpoint is a bearer capability for one device, so only its host leaves the object. */
	test("the device list names a push service rather than handing back an endpoint", async () => {
		let { user } = await createReader();
		await registerDevice(user);

		let held = await user.notifications();

		expect(held.devices[0]?.service).toBe("push.example.test");
		expect(JSON.stringify(held)).not.toContain("/device-1");
	});
});

describe("the email channel", () => {
	test("a plan that does not sell email refuses the switch rather than storing it", async () => {
		let { state, user } = await createReader("sub-paid");

		await user.setTier({
			entitled: "paid",
			cancelled: true,
			readAt: READ_AT + 1,
			source: "billing",
		});

		let result = await user.setChannels({ push: false, email: true });

		expect(result).toEqual({ ok: false, reason: "not-entitled" });
		expect(settingsColumn(state, "notify_email")).toBe(0);
	});

	test("sign-in writes the address the channel would send to", async () => {
		let { state, user } = await createReader("sub-address");

		expect(settingsColumn(state, "email")).toBe("reader@example.com");

		await user.ensureUser("sub-address", "moved@example.com");

		expect(settingsColumn(state, "email")).toBe("moved@example.com");
	});
});
