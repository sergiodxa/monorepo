/**
 * Drives the WebSub path the way a publisher's hub does: inside workerd, through the app's
 * own router and the `FEED` binding, against a hub and an origin served by MSW.
 *
 * What only the deployment can show is asserted here — that a notification reaches the
 * object through the route with cross-origin protection and the edge limit in front of it,
 * that a delivery which does not verify is answered exactly as one that does, and that a
 * ping buys a fetch rather than a write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { Hex, hmac } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import application from "~/bootstrap/app";
import schema from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { HUB_DAILY_NOTIFICATION_LIMIT, HUB_POLL_FLOOR_MS } from "~/database/feed-schema";
import { registerFeed } from "~/database/registry";
import routes from "~/routes/web";

/** The hub every feed in this file advertises. */
const HUB_URL = "https://hub.example.com/";

/** Notifications one feed's callback answers in a minute, as the controller registers it. */
const NOTIFICATIONS_PER_MINUTE = 60;

/** The origin the app is reached at in a test, which only the router's own URLs use. */
const ORIGIN = "https://reader.test";

/** MSW server standing in for the publishers' origins and for the hub. */
let server = setupServer();

/** Every request the hub was sent, in the order it received them. */
let asked: URLSearchParams[] = [];

/** The app's own router, so a delivery passes the middleware a real one passes. */
let router: Router;

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });

	server.use(
		http.post(HUB_URL, async ({ request }) => {
			asked.push(new URLSearchParams(await request.text()));
			return new HttpResponse(null, { status: 202 });
		}),
	);

	let statements = schema
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join(" ")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");

	for (let statement of statements) await env.PLATFORM_DB.exec(`${statement};`);

	router = application({ kv: env.KV, cookieSecret: "test-cookie-secret", secure: false });
});

afterEach(() => {
	asked = [];
});

afterAll(() => server.close());

/** A feed URL no other test in this file uses, since every store here outlives a test. */
function feedUrl(): string {
	return `https://${crypto.randomUUID()}.example.com/feed.xml`;
}

/** A reader nobody else in this file subscribes as. */
function reader(): string {
	return `sub-${crypto.randomUUID()}`;
}

/** What one document declares, with a default for everything a test ignores. */
interface Published {
	guids?: string[];
	hub?: string | null;
	self?: string;
}

/** The origin one feed is published from, and a count of what it was actually asked for. */
interface Origin {
	publish(published: Published): void;
	fail(status: number): void;
	fetches(): number;
}

/** Publishes an RSS 2.0 document at `url` and counts what is asked of it. */
function origin(url: string, published: Published = { guids: ["g1"] }): Origin {
	let current = published;
	let status = 200;
	let fetched = 0;

	server.use(
		http.get(url, () => {
			fetched += 1;
			if (status !== 200) return new HttpResponse(null, { status });
			return HttpResponse.xml(rss(url, current));
		}),
	);

	return {
		publish(next) {
			current = next;
			status = 200;
		},
		fail(next) {
			status = next;
		},
		fetches: () => fetched,
	};
}

/** An RSS 2.0 document declaring its relations through the Atom namespace. */
function rss(url: string, published: Published): string {
	let hub = published.hub === null ? undefined : (published.hub ?? HUB_URL);

	let items = (published.guids ?? ["g1"]).map(
		(guid) => `<item>
			<guid isPermaLink="false">${guid}</guid>
			<title>A post</title>
			<link>https://example.com/${guid}</link>
			<description>The body</description>
			<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>
		</item>`,
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
			<title>Example</title>
			<link>https://example.com</link>
			<description>An example feed</description>
			<atom:link rel="self" href="${published.self ?? url}"/>
			${hub === undefined ? "" : `<atom:link rel="hub" href="${hub}"/>`}
			${items.join("\n")}
		</channel></rss>`;
}

/** The feed's single row, read straight out of the object's own storage. */
function feedRow(feedId: string): Promise<Record<string, unknown>> {
	return runInDurableObject(env.FEED.getByName(feedId), (_instance, state) =>
		state.storage.sql.exec("select * from feed where id = 1").one(),
	);
}

/** Writes columns on the feed's row, for a state a test would otherwise wait days for. */
function setFeedRow(feedId: string, columns: Record<string, number | string>): Promise<void> {
	let assignments = Object.keys(columns)
		.map((column) => `${column} = ?`)
		.join(", ");

	return runInDurableObject(env.FEED.getByName(feedId), (_instance, state) => {
		state.storage.sql.exec(
			`update feed set ${assignments} where id = 1`,
			...Object.values(columns),
		);
	});
}

/** The alarm the object has armed, which is what says when its next job is owed. */
function armedAlarm(feedId: string): Promise<number | null> {
	return runInDurableObject(env.FEED.getByName(feedId), (_instance, state) =>
		state.storage.getAlarm(),
	);
}

/** A feed followed by one reader, left holding whatever subscription its document earned. */
async function following(published?: Published): Promise<{ feedId: string; source: Origin }> {
	let url = feedUrl();
	let source = origin(url, published ?? { guids: ["g1"] });
	let feedId = await registerFeed(url, "Example");

	await env.FEED.getByName(feedId).subscribe(reader(), url);

	return { feedId, source };
}

/** The verification a hub makes, answered through the app's own router. */
function verify(
	feedId: string,
	token: string,
	query: { mode?: string; topic: string; challenge?: string; leaseSeconds?: number },
): Promise<Response> {
	let path = routes.websub.index.href({ feedId, token });
	let search = new URLSearchParams({
		"hub.mode": query.mode ?? "subscribe",
		"hub.topic": query.topic,
		"hub.challenge": query.challenge ?? "a-challenge",
		"hub.lease_seconds": String(query.leaseSeconds ?? 864_000),
	});

	return router.fetch(new Request(new URL(`${path}?${search}`, ORIGIN)));
}

/** One notification, signed with `secret` unless a test supplies its own header. */
async function notify(
	feedId: string,
	token: string,
	options: { secret?: string; signature?: string; body?: string } = {},
): Promise<Response> {
	let body = options.body ?? "<?xml version='1.0'?><rss/>";
	let headers: Record<string, string> = { "content-type": "application/rss+xml" };

	if (options.signature !== undefined) headers["x-hub-signature"] = options.signature;
	else if (options.secret !== undefined) {
		let mac = unwrap(await hmac.sign(options.secret, new TextEncoder().encode(body)));
		headers["x-hub-signature"] = `sha256=${Hex.encode(mac)}`;
	}

	return router.fetch(
		new Request(new URL(routes.websub.action.href({ feedId, token }), ORIGIN), {
			method: "POST",
			headers,
			body,
		}),
	);
}

/** A feed whose subscription a hub has verified, with the credentials it was given. */
async function subscribed(published?: Published) {
	let { feedId, source } = await following(published);
	let row = await feedRow(feedId);
	let token = String(row.hub_token);
	let topic = String(row.hub_topic);

	let echoed = await verify(feedId, token, { topic });
	expect(echoed.status).toBe(200);

	return { feedId, source, token, topic, secret: String(row.hub_secret) };
}

describe("subscribing", () => {
	test("sends the callback, a fresh secret and a fresh lease, and leaves the row pending", async () => {
		let { feedId } = await following();
		let row = await feedRow(feedId);

		expect(asked).toHaveLength(1);
		expect(asked[0]?.get("hub.mode")).toBe("subscribe");
		expect(asked[0]?.get("hub.topic")).toBe(row.hub_topic);
		expect(asked[0]?.get("hub.lease_seconds")).toBe("864000");
		expect(asked[0]?.get("hub.secret")).toBe(row.hub_secret);
		expect(asked[0]?.get("hub.callback")).toContain(String(row.hub_token));

		expect(row.hub_state).toBe("pending");
		expect(row.hub_url).toBe(HUB_URL);
		expect(String(row.hub_secret).length).toBeGreaterThan(20);
	});

	test("mints a token and a secret nobody else's feed holds", async () => {
		let first = await feedRow((await following()).feedId);
		let second = await feedRow((await following()).feedId);

		expect(first.hub_token).not.toBe(second.hub_token);
		expect(first.hub_secret).not.toBe(second.hub_secret);
	});

	test("subscribes to nothing when the document's rel=self names another origin", async () => {
		let { feedId } = await following({
			guids: ["g1"],
			self: "https://elsewhere.example.net/f.xml",
		});

		expect(asked).toHaveLength(0);
		expect((await feedRow(feedId)).hub_state).toBe("none");
	});

	test("subscribes to nothing when the feed advertises no hub", async () => {
		let { feedId } = await following({ guids: ["g1"], hub: null });

		expect(asked).toHaveLength(0);
		expect((await feedRow(feedId)).hub_state).toBe("none");
	});

	test("leaves the feed's canonical URL and its catalog id where they were", async () => {
		let url = feedUrl();
		origin(url, { guids: ["g1"], self: "https://example.com/feeds/main.xml" });
		let feedId = await registerFeed(url, "Example");

		await env.FEED.getByName(feedId).subscribe(reader(), url);

		expect((await feedRow(feedId)).feed_url).toBe(url);
		expect(await registerFeed(url, "Example")).toBe(feedId);
	});
});

describe("verification", () => {
	test("echoes a challenge the token, the topic and a pending subscription all agree on", async () => {
		let { feedId } = await following();
		let row = await feedRow(feedId);

		let response = await verify(feedId, String(row.hub_token), {
			topic: String(row.hub_topic),
			challenge: "the-challenge",
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("the-challenge");

		let verified = await feedRow(feedId);
		expect(verified.hub_state).toBe("active");
		expect(Number(verified.hub_lease_until)).toBeGreaterThan(Date.now());
	});

	test("refuses a challenge for a topic the row never subscribed to", async () => {
		let { feedId } = await following();
		let row = await feedRow(feedId);

		let response = await verify(feedId, String(row.hub_token), {
			topic: "https://attacker.example.net/feed.xml",
		});

		expect(response.status).toBe(404);
		expect((await feedRow(feedId)).hub_state).toBe("pending");
	});

	test("refuses a challenge carrying the wrong token", async () => {
		let { feedId } = await following();
		let row = await feedRow(feedId);

		let response = await verify(feedId, "not-the-token", { topic: String(row.hub_topic) });

		expect(response.status).toBe(404);
	});

	test("refuses a challenge for a subscription already verified", async () => {
		let { feedId, token, topic } = await subscribed();

		expect((await verify(feedId, token, { topic })).status).toBe(404);
	});
});

describe("notification", () => {
	test("a signed delivery fetches the feed and stores nothing from the body", async () => {
		let { feedId, source, token, secret } = await subscribed();
		let before = source.fetches();

		source.publish({ guids: ["g2", "g1"] });
		await setFeedRow(feedId, { last_fetched_at: 0 });

		let response = await notify(feedId, token, {
			secret,
			body: "<?xml version='1.0'?><rss><channel><item><guid>forged</guid></item></channel></rss>",
		});

		expect(response.status).toBe(202);
		expect(source.fetches()).toBe(before + 1);

		/**
		 * A hub is not the publisher, so a delivery cannot put a headline in anybody's
		 * timeline: what is stored is what the origin served, and the forged entry is not it.
		 */
		let stored = await env.FEED.getByName(feedId).getItemsAfter(0);
		expect(stored.items.map((item) => item.guid)).toContain("g2");
		expect(stored.items.map((item) => item.guid)).not.toContain("forged");
	});

	test("answers an unsigned and a wrongly signed delivery exactly as a good one", async () => {
		let { feedId, source, token, secret } = await subscribed();
		let before = source.fetches();

		let unsigned = await notify(feedId, token);
		let wrong = await notify(feedId, token, { signature: `sha256=${"0".repeat(64)}` });
		let malformed = await notify(feedId, token, { signature: "md5=whatever" });

		expect([unsigned.status, wrong.status, malformed.status]).toEqual([202, 202, 202]);
		expect(await unsigned.text()).toBe("");

		/** A refusal tells a prober nothing, and it costs the publisher nothing either. */
		expect(source.fetches()).toBe(before);

		expect((await notify(feedId, token, { secret })).status).toBe(202);
	});

	test("answers a delivery carrying the wrong token with 404, without waking the object", async () => {
		let { feedId, source } = await subscribed();
		let before = source.fetches();

		expect((await notify(feedId, "not-the-token")).status).toBe(404);
		expect(source.fetches()).toBe(before);
	});

	test("asks the origin once however many deliveries arrive inside the window", async () => {
		let { feedId, source, token, secret } = await subscribed();
		let before = source.fetches();
		await setFeedRow(feedId, { last_fetched_at: 0 });

		await notify(feedId, token, { secret });
		await notify(feedId, token, { secret });
		await notify(feedId, token, { secret });

		expect(source.fetches()).toBe(before + 1);
	});

	test("changes nothing downstream when the origin has nothing new", async () => {
		let { feedId, token, secret } = await subscribed();
		let head = await env.FEED.getByName(feedId).getHead();

		await setFeedRow(feedId, { last_fetched_at: 0 });
		expect((await notify(feedId, token, { secret })).status).toBe(202);

		expect(await env.FEED.getByName(feedId).getHead()).toBe(head);
		expect(await env.KV.get(`feed:${feedId}:head`)).toBe(String(head));
		expect((await env.FEED.getByName(feedId).getItemsAfter(head)).items).toEqual([]);
	});

	test("performs no fetch inside the failure backoff, while a manual check still does", async () => {
		let { feedId, source, token, secret } = await subscribed();

		source.fail(500);
		await env.FEED.getByName(feedId).refresh("manual");
		let failed = source.fetches();

		expect(Number((await feedRow(feedId)).next_attempt_at)).toBeGreaterThan(Date.now());

		await setFeedRow(feedId, { last_fetched_at: 0 });
		await notify(feedId, token, { secret });
		expect(source.fetches()).toBe(failed);

		/** A person is waiting behind a check, which is the one reason the backoff never holds. */
		await env.FEED.getByName(feedId).refresh("manual");
		expect(source.fetches()).toBe(failed + 1);
	});

	test("drops a hub delivering more in a day than the feed could publish", async () => {
		let { feedId, source, token, secret } = await subscribed();
		let before = source.fetches();

		await setFeedRow(feedId, {
			hub_notifications: HUB_DAILY_NOTIFICATION_LIMIT,
			hub_notified_at: Date.now(),
		});

		expect((await notify(feedId, token, { secret })).status).toBe(202);

		let row = await feedRow(feedId);
		expect(row.hub_state).toBe("failed");
		expect(row.hub_token).toBeNull();
		expect(asked.at(-1)?.get("hub.mode")).toBe("unsubscribe");

		/** Dropping the subscription leaves the feed to the poller, which never stopped. */
		expect(source.fetches()).toBe(before);
		expect((await env.FEED.getByName(feedId).refresh("manual")).ok).toBe(true);
	});
});

describe("the edge limit", () => {
	test("refuses a feed's callback past its budget without reaching the object", async () => {
		let { feedId, source } = await subscribed();
		let before = source.fetches();

		let statuses: number[] = [];
		for (let attempt = 0; attempt < NOTIFICATIONS_PER_MINUTE + 5; attempt++) {
			statuses.push((await notify(feedId, "not-the-token")).status);
		}

		expect(statuses).toContain(429);
		expect(source.fetches()).toBe(before);
	});
});

describe("the alarm's three jobs", () => {
	test("polls a hub-backed feed no more often than the floor", async () => {
		let { feedId } = await subscribed();

		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		let armed = await armedAlarm(feedId);
		expect(armed).not.toBeNull();
		expect(Number(armed) - Date.now()).toBeGreaterThanOrEqual(HUB_POLL_FLOOR_MS - 5_000);
	});

	test("re-subscribes when the lease reaches its renewal window", async () => {
		let { feedId, topic } = await subscribed();
		asked = [];

		await setFeedRow(feedId, { hub_lease_until: Date.now() + 60_000, last_fetched_at: Date.now() });
		await runDurableObjectAlarm(env.FEED.getByName(feedId));

		expect(asked.map((body) => body.get("hub.mode"))).toContain("subscribe");
		expect(asked.at(-1)?.get("hub.topic")).toBe(topic);

		let row = await feedRow(feedId);
		expect(row.hub_state).toBe("pending");

		/** A re-subscription mints a fresh token, so a leaked one is retired by one row. */
		expect(asked.at(-1)?.get("hub.callback")).toContain(String(row.hub_token));
	});

	test("demotes a hub whose feed keeps publishing things it never announced", async () => {
		let { feedId, source } = await subscribed();
		asked = [];

		for (let round of [2, 3, 4]) {
			source.publish({ guids: [`g${round}`, "g1"] });
			/** The hub last spoke before the previous poll, so anything found since is a miss. */
			await setFeedRow(feedId, { last_fetched_at: Date.now(), hub_notified_at: 1 });
			await env.FEED.getByName(feedId).refresh("scheduled");
		}

		let row = await feedRow(feedId);
		expect(row.hub_state).toBe("failed");
		expect(row.hub_token).toBeNull();
		expect(asked.at(-1)?.get("hub.mode")).toBe("unsubscribe");
	});
});

describe("leaving", () => {
	test("tells the hub to stop when the last reader goes, and still schedules the purge", async () => {
		let url = feedUrl();
		origin(url);
		let feedId = await registerFeed(url, "Example");
		let mine = reader();

		await env.FEED.getByName(feedId).subscribe(mine, url);
		let token = String((await feedRow(feedId)).hub_token);
		asked = [];

		expect(await env.FEED.getByName(feedId).unsubscribe(mine)).toEqual({ remaining: false });

		expect(asked).toHaveLength(1);
		expect(asked[0]?.get("hub.mode")).toBe("unsubscribe");
		expect(asked[0]?.get("hub.callback")).toContain(token);

		let row = await feedRow(feedId);
		expect(row.hub_token).toBeNull();
		expect(row.hub_state).toBe("none");
		expect(Number(row.purge_at)).toBeGreaterThan(Date.now());

		/** A hub that keeps notifying is answered without anything being woken. */
		expect((await notify(feedId, token)).status).toBe(404);
	});

	test("keeps the subscription while anybody still follows the feed", async () => {
		let url = feedUrl();
		origin(url);
		let feedId = await registerFeed(url, "Example");
		let mine = reader();

		await env.FEED.getByName(feedId).subscribe(mine, url);
		await env.FEED.getByName(feedId).subscribe(reader(), url);
		asked = [];

		expect(await env.FEED.getByName(feedId).unsubscribe(mine)).toEqual({ remaining: true });
		expect(asked).toHaveLength(0);
		expect((await feedRow(feedId)).hub_token).not.toBeNull();
	});
});
