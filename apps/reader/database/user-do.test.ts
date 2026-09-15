/**
 * Drives the reader's Durable Object by construction, against real SQLite and working
 * alarms, with MSW answering every feed it retrieves. The assertions that matter are the
 * ones a controller cannot make for itself: that the schedule is armed once and re-armed
 * on demand, that a refusal is reported rather than thrown, and that a timeline pages
 * forward and back through the cursors it minted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStore } from "./user-do";

import { UserDO } from "./user-do";

/**
 * The refresh path is driven from here rather than exercised, so the alarm's own
 * guarantees — that it resolves however the run went, and re-arms either way — are what
 * these assertions read.
 */
let refreshDueFeeds = vi.hoisted(() => vi.fn());
vi.mock("~/database/refresh", () => ({ refreshDueFeeds }));

const FEED_URL = "https://example.com/feed.xml";
const SITE_URL = "https://example.com/";
const HOUR_MS = 60 * 60 * 1000;

/** One entry of the RSS document the origin serves. */
interface Entry {
	guid: string;
	title: string;
	published: string;
}

/** Five posts a day apart, newest last, so ordering assertions have something to sort. */
const ENTRIES: Entry[] = [
	{ guid: "a", title: "First", published: "Mon, 01 Sep 2025 10:00:00 GMT" },
	{ guid: "b", title: "Second", published: "Tue, 02 Sep 2025 10:00:00 GMT" },
	{ guid: "c", title: "Third", published: "Wed, 03 Sep 2025 10:00:00 GMT" },
	{ guid: "d", title: "Fourth", published: "Thu, 04 Sep 2025 10:00:00 GMT" },
	{ guid: "e", title: "Fifth", published: "Fri, 05 Sep 2025 10:00:00 GMT" },
];

/** Builds the RSS 2.0 document the origin answers with. */
function rss(entries: Entry[]): string {
	let items = entries
		.map(
			(entry) =>
				`<item><guid isPermaLink="false">${entry.guid}</guid><title>${entry.title}</title>` +
				`<link>https://example.com/${entry.guid}</link>` +
				`<pubDate>${entry.published}</pubDate><description>About ${entry.title}</description></item>`,
		)
		.join("");

	return (
		`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>` +
		`<title>Example</title><link>https://example.com</link>` +
		`<description>An example feed</description>${items}</channel></rss>`
	);
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	refreshDueFeeds.mockReset();
	refreshDueFeeds.mockResolvedValue({ attempted: 0, remaining: 0 });
	server.use(http.get(FEED_URL, () => HttpResponse.xml(rss(ENTRIES))));
});

/**
 * Builds a reader's object and waits out the boot. The runtime holds requests behind the
 * constructor's `blockConcurrencyWhile`; a test calls methods directly, so it takes its
 * own turn at the same gate to stand where a request would.
 */
async function createUser(): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let state = createDurableObjectState();
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);
	return { state, user };
}

/** Builds a signed-in reader following the example feed, which is where most tests start. */
async function createReaderWithFeed() {
	let { state, user } = await createUser();
	await user.ensureUser("sub-1");

	let followed = await user.followFeed(FEED_URL);
	if (!followed.ok) throw new Error(`following failed: ${followed.reason}`);

	return { state, user, feed: followed.feed };
}

/** The titles of a page, which is what ordering and read-state assertions compare. */
function titles(result: UserStore.TimelineResult): string[] {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	return result.items.map((item) => item.title);
}

/** The cursors of a page, for walking it forward and back. */
function cursors(result: UserStore.TimelineResult): { next: string | null; prev: string | null } {
	if (!result.ok) throw new Error(`expected a page, got ${result.reason}`);
	return result.cursors;
}

describe("ensureUser", () => {
	test("creates the reader's row on a first sign-in", async () => {
		let { user } = await createUser();

		expect(await user.getSettings()).toBeNull();

		expect(await user.ensureUser("sub-1")).toEqual({
			subject: "sub-1",
			refreshIntervalHours: 1,
			lastRefreshedAt: null,
		});

		expect(await user.getSettings()).toEqual({
			subject: "sub-1",
			refreshIntervalHours: 1,
			lastRefreshedAt: null,
		});
	});

	test("arms the refresh schedule for the reader's interval", async () => {
		let { state, user } = await createUser();
		await user.ensureUser("sub-1");

		let scheduled = await state.storage.getAlarm();

		expect(scheduled).not.toBeNull();
		expect(scheduled).toBeGreaterThan(Date.now() + HOUR_MS - 5_000);
		expect(scheduled).toBeLessThanOrEqual(Date.now() + HOUR_MS);
	});

	test("leaves an armed alarm where it is, so an active reader still refreshes", async () => {
		let { state, user } = await createUser();
		await user.ensureUser("sub-1");

		let first = await state.storage.getAlarm();
		await user.ensureUser("sub-1");

		expect(await state.storage.getAlarm()).toBe(first);
	});
});

describe("setRefreshInterval", () => {
	test("reports a cadence the schema would refuse instead of throwing", async () => {
		let { user } = await createUser();
		await user.ensureUser("sub-1");

		expect(await user.setRefreshInterval(2)).toEqual({ ok: false, reason: "invalid-interval" });
		expect((await user.getSettings())?.refreshIntervalHours).toBe(1);
	});

	test("stores an offered cadence and re-arms the alarm for it", async () => {
		let { state, user } = await createUser();
		await user.ensureUser("sub-1");
		await user.setRefreshInterval(24);

		let scheduled = await state.storage.getAlarm();
		expect(scheduled).toBeGreaterThan(Date.now() + 24 * HOUR_MS - 5_000);

		let result = await user.setRefreshInterval(1);

		expect(result).toEqual({
			ok: true,
			settings: { subject: "sub-1", refreshIntervalHours: 1, lastRefreshedAt: null },
		});

		// Moving from daily to hourly waits an hour, rather than out the rest of the day.
		expect(await state.storage.getAlarm()).toBeLessThanOrEqual(Date.now() + HOUR_MS);
	});
});

describe("followFeed", () => {
	test("stores the feed and every post it carried", async () => {
		let { user } = await createUser();
		await user.ensureUser("sub-1");

		let result = await user.followFeed(FEED_URL);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.items).toBe(5);
		expect(result.feed).toMatchObject({
			feedUrl: FEED_URL,
			siteUrl: SITE_URL,
			title: "Example",
			description: "An example feed",
			lastStatus: "ok",
			failureCount: 0,
		});
		expect(result.feed.id.startsWith("feed_")).toBe(true);
	});

	test("counts the unread posts beside each feed", async () => {
		let { user, feed } = await createReaderWithFeed();

		expect(await user.listFeeds()).toEqual([{ ...feed, unreadCount: 5 }]);
		expect(await user.getFeed(feed.id)).toEqual({ ...feed, unreadCount: 5 });
		expect(await user.getFeed("feed_missing")).toBeNull();
	});

	test("names the existing subscription when the same URL is followed twice", async () => {
		let { user, feed } = await createReaderWithFeed();

		expect(await user.followFeed(FEED_URL)).toEqual({
			ok: false,
			reason: "already-following",
			feedId: feed.id,
		});

		expect(await user.listFeeds()).toHaveLength(1);
	});

	test("refuses something that is not an HTTP URL", async () => {
		let { user } = await createUser();
		await user.ensureUser("sub-1");

		for (let input of ["", "   ", "mailto:someone@example.com", "http://"]) {
			expect(await user.followFeed(input)).toEqual({
				ok: false,
				reason: "invalid-url",
				feedId: null,
			});
		}
	});

	test("tells a page advertising no feed apart from an origin that refused", async () => {
		let { user } = await createUser();
		await user.ensureUser("sub-1");

		server.use(
			http.get("https://plain.example/", () =>
				HttpResponse.html("<!doctype html><title>Nothing here</title>"),
			),
			http.get("https://broken.example/", () => new HttpResponse(null, { status: 503 })),
		);

		expect(await user.followFeed("plain.example")).toEqual({
			ok: false,
			reason: "not-found",
			feedId: null,
		});

		expect(await user.followFeed("broken.example")).toEqual({
			ok: false,
			reason: "unreachable",
			feedId: null,
		});
	});
});

describe("readingQueue", () => {
	test("answers the unread posts newest first", async () => {
		let { user } = await createReaderWithFeed();

		let page = await user.readingQueue();

		expect(titles(page)).toEqual(["Fifth", "Fourth", "Third", "Second", "First"]);
		expect(cursors(page)).toEqual({ next: null, prev: null });
	});

	test("labels a page with the feeds its posts came from", async () => {
		let { user, feed } = await createReaderWithFeed();

		let page = await user.readingQueue({ limit: 2 });

		expect(page.ok).toBe(true);
		if (!page.ok) return;

		expect(page.feeds).toEqual([{ id: feed.id, title: "Example", siteUrl: SITE_URL }]);
		expect(page.items.every((item) => item.feedId === feed.id)).toBe(true);
	});

	test("pages forward and back through the cursors it minted", async () => {
		let { user } = await createReaderWithFeed();

		let first = await user.readingQueue({ limit: 2 });
		expect(titles(first)).toEqual(["Fifth", "Fourth"]);
		expect(cursors(first).prev).toBeNull();

		let second = await user.readingQueue({ limit: 2, cursor: cursors(first).next });
		expect(titles(second)).toEqual(["Third", "Second"]);

		let third = await user.readingQueue({ limit: 2, cursor: cursors(second).next });
		expect(titles(third)).toEqual(["First"]);
		expect(cursors(third).next).toBeNull();

		let back = await user.readingQueue({ limit: 2, cursor: cursors(second).prev });
		expect(titles(back)).toEqual(["Fifth", "Fourth"]);
	});

	test("reports a cursor it cannot decode rather than answering the first page", async () => {
		let { user } = await createReaderWithFeed();

		expect(await user.readingQueue({ cursor: "not-a-cursor" })).toEqual({
			ok: false,
			reason: "bad-cursor",
		});

		expect(await user.feedTimeline("feed_missing", { cursor: "not-a-cursor" })).toEqual({
			ok: false,
			reason: "bad-cursor",
		});
	});
});

describe("markRead", () => {
	test("takes a post out of the queue and leaves it in the feed's timeline", async () => {
		let { user, feed } = await createReaderWithFeed();

		let page = await user.readingQueue({ limit: 1 });
		expect(page.ok).toBe(true);
		if (!page.ok) return;

		let newest = page.items[0];
		expect(newest).toBeDefined();
		if (newest === undefined) return;

		expect(await user.markRead(newest.id)).toBe(true);

		expect(titles(await user.readingQueue())).toEqual(["Fourth", "Third", "Second", "First"]);
		expect(titles(await user.feedTimeline(feed.id))).toEqual([
			"Fifth",
			"Fourth",
			"Third",
			"Second",
			"First",
		]);

		expect((await user.getFeed(feed.id))?.unreadCount).toBe(4);

		expect(await user.markRead(newest.id, false)).toBe(true);
		expect(titles(await user.readingQueue())).toHaveLength(5);
	});

	test("reports a post this reader does not hold", async () => {
		let { user } = await createReaderWithFeed();
		expect(await user.markRead("item_missing")).toBe(false);
	});
});

describe("unfollowFeed", () => {
	test("drops the subscription and every post behind it", async () => {
		let { user, feed } = await createReaderWithFeed();

		expect(await user.unfollowFeed(feed.id)).toBe(true);

		expect(await user.listFeeds()).toEqual([]);
		expect(await user.getFeed(feed.id)).toBeNull();
		expect(titles(await user.readingQueue())).toEqual([]);
		expect(titles(await user.feedTimeline(feed.id))).toEqual([]);
	});

	test("reports a feed that was never followed", async () => {
		let { user } = await createReaderWithFeed();
		expect(await user.unfollowFeed("feed_missing")).toBe(false);
	});
});

describe("alarm", () => {
	test("stamps the run and comes back for the reader's interval", async () => {
		let { state, user } = await createUser();
		await user.ensureUser("sub-1");

		await user.alarm();

		expect(refreshDueFeeds).toHaveBeenCalledTimes(1);
		expect((await user.getSettings())?.lastRefreshedAt).toBeGreaterThan(0);
		expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now() + HOUR_MS - 5_000);
	});

	test("comes back in a minute while feeds are still due", async () => {
		let { state, user } = await createUser();
		await user.ensureUser("sub-1");
		refreshDueFeeds.mockResolvedValue({ attempted: 20, remaining: 4 });

		await user.alarm();

		expect(await state.storage.getAlarm()).toBeLessThanOrEqual(Date.now() + 60_000);
	});

	test("resolves and keeps the heartbeat when the refresh path throws", async () => {
		let { state, user } = await createUser();
		await user.ensureUser("sub-1");
		refreshDueFeeds.mockRejectedValue(new Error("every origin is down"));

		let failures = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await expect(user.alarm()).resolves.toBeUndefined();

		expect(failures).toHaveBeenCalled();
		expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now() + HOUR_MS - 5_000);

		failures.mockRestore();
	});
});
