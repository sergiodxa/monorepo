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
 * The refresh run is driven from here rather than exercised, so the alarm's own
 * guarantees — that it resolves however the run went, and re-arms either way — are what
 * these assertions read. Everything else the module exports stays real, since the row a
 * follow writes is built out of it.
 */
let refreshDueFeeds = vi.hoisted(() => vi.fn());
vi.mock("~/database/refresh", async (importOriginal) => ({
	...(await importOriginal<typeof import("~/database/refresh")>()),
	refreshDueFeeds,
}));

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

/** The reader every test builds its object as, unless it names another. */
const SUBJECT = "sub-1";

/**
 * Builds a reader's object and waits out the boot. The runtime holds requests behind the
 * constructor's `blockConcurrencyWhile`; a test calls methods directly, so it takes its
 * own turn at the same gate to stand where a request would.
 */
async function createUser(
	subject = SUBJECT,
): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	// Named the way `getByName` names a real object, because the object provisions its own
	// settings row from the name it was addressed by rather than from a passed argument.
	let state = createDurableObjectState({ name: subject });
	let user = new UserDO(state, env);
	await state.blockConcurrencyWhile(async () => undefined);
	return { state, user };
}

/** Builds a signed-in reader following the example feed, which is where most tests start. */
async function createReaderWithFeed() {
	let { state, user } = await createUser();
	await user.ensureUser(SUBJECT);

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

/**
 * A reader is created by whichever call reached their object first, since there is no
 * sign-up step, and a session outlives a deploy — so an object can hold the feeds somebody
 * follows while no sign-in has ever written their settings row.
 */
describe("an object no sign-in has provisioned", () => {
	test("follows a feed and reports the retrieval under the subject it was named with", async () => {
		let { user } = await createUser("sub-unprovisioned");

		let followed = await user.followFeed(FEED_URL);
		expect(followed.ok).toBe(true);

		expect(await user.getSettings()).toMatchObject({
			subject: "sub-unprovisioned",
			refreshIntervalHours: 1,
		});
	});

	test("arms the schedule on the follow, so the subscription is actually swept", async () => {
		let { state, user } = await createUser("sub-unprovisioned");

		expect(await state.storage.getAlarm()).toBeNull();

		await user.followFeed(FEED_URL);

		expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now());
	});

	test("saves a cadence instead of failing on the row nothing wrote", async () => {
		let { user } = await createUser("sub-unprovisioned");

		expect(await user.getSettings()).toBeNull();

		expect(await user.setRefreshInterval(6)).toEqual({
			ok: true,
			settings: { subject: "sub-unprovisioned", refreshIntervalHours: 6, lastRefreshedAt: null },
		});
	});

	test("raises where it was reached when the object carries no name to write", async () => {
		let state = createDurableObjectState();
		let user = new UserDO(state, env);
		await state.blockConcurrencyWhile(async () => undefined);

		// An id built from a raw string or minted unique carries no name, and the rows are
		// keyed on the reader's subject, so there is nothing to provision the row as.
		await expect(user.setRefreshInterval(6)).rejects.toThrow("must be addressed by name");
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

	test("records the retrieval, so a new reader is not told their feeds were never checked", async () => {
		let { user } = await createReaderWithFeed();

		// Following retrieves the feed and stores what it carried, which is exactly what a
		// scheduled sweep does; the settings page would otherwise report none until one ran.
		expect((await user.getSettings())?.lastRefreshedAt).toBeGreaterThan(0);
	});

	test("stores a post under an id of the shape every path mints", async () => {
		let { user } = await createReaderWithFeed();

		let page = await user.readingQueue();
		expect(page.ok).toBe(true);
		if (!page.ok) return;

		expect(page.items.every((item) => /^item_[\da-z]{26}$/.test(item.id))).toBe(true);
	});

	test("counts the unread posts beside each feed", async () => {
		let { user, feed } = await createReaderWithFeed();

		expect((await user.listFeeds()).feeds).toEqual([{ ...feed, unreadCount: 5 }]);
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

		expect((await user.listFeeds()).feeds).toHaveLength(1);
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

describe("checkFeedNow", () => {
	/** A sixth post, as an origin that published while the reader was reading serves it. */
	const PUBLISHED: Entry = {
		guid: "f",
		title: "Sixth",
		published: "Sat, 06 Sep 2025 10:00:00 GMT",
	};

	/** Serves the feed with {@link PUBLISHED} at the end of it. */
	function publishOne() {
		server.use(http.get(FEED_URL, () => HttpResponse.xml(rss([...ENTRIES, PUBLISHED]))));
	}

	test("stores what the origin published since the last poll", async () => {
		let { user, feed } = await createReaderWithFeed();
		publishOne();

		expect(await user.checkFeedNow(feed.id)).toEqual({ ok: true, inserted: 1, updated: 0 });

		expect(titles(await user.readingQueue())).toEqual([
			"Sixth",
			"Fifth",
			"Fourth",
			"Third",
			"Second",
			"First",
		]);
	});

	test("reports a document that carried nothing the reader had not seen", async () => {
		let { user, feed } = await createReaderWithFeed();

		expect(await user.checkFeedNow(feed.id)).toEqual({ ok: true, inserted: 0, updated: 0 });
	});

	test("reports an origin answering 304 as nothing new", async () => {
		let { user, feed } = await createReaderWithFeed();
		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 304 })));

		expect(await user.checkFeedNow(feed.id)).toEqual({ ok: true, inserted: 0, updated: 0 });
	});

	test("checks a feed inside its backoff window, which is the one a reader asks about", async () => {
		let { user, feed } = await createReaderWithFeed();

		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 503 })));
		expect(await user.checkFeedNow(feed.id)).toEqual({ ok: false, reason: "check-failed" });
		expect((await user.getFeed(feed.id))?.failureCount).toBe(1);

		// The failure above put the next attempt minutes out, and asking now reads past it.
		publishOne();

		expect(await user.checkFeedNow(feed.id)).toEqual({ ok: true, inserted: 1, updated: 0 });
		expect((await user.getFeed(feed.id))?.failureCount).toBe(0);
	});

	test("records the check, so the reader is told when their posts were last brought up", async () => {
		let { user, feed } = await createReaderWithFeed();
		publishOne();

		let before = (await user.getSettings())?.lastRefreshedAt ?? 0;

		await user.checkFeedNow(feed.id);

		expect((await user.getSettings())?.lastRefreshedAt).toBeGreaterThanOrEqual(before);
		expect((await user.getSettings())?.lastRefreshedAt).toBeGreaterThan(0);
	});

	test("records a 304 too, since the stored copy is the current one", async () => {
		let { user, feed } = await createReaderWithFeed();
		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 304 })));

		await user.checkFeedNow(feed.id);

		expect((await user.getSettings())?.lastRefreshedAt).toBeGreaterThan(0);
	});

	test("records nothing for a check that never reached the origin", async () => {
		let { user, feed } = await createReaderWithFeed();

		server.use(http.get(FEED_URL, () => HttpResponse.error()));

		// The follow that set this reader up stamped, so this is a number rather than null
		// and a stamp written again would move it.
		let before = (await user.getSettings())?.lastRefreshedAt;
		expect(before).toBeGreaterThan(0);

		expect(await user.checkFeedNow(feed.id)).toEqual({ ok: false, reason: "check-failed" });
		expect((await user.getSettings())?.lastRefreshedAt).toBe(before);
	});

	test("reports a feed this reader does not follow rather than throwing", async () => {
		let { user } = await createReaderWithFeed();

		await expect(user.checkFeedNow("feed_missing")).resolves.toEqual({
			ok: false,
			reason: "not-following",
		});
	});

	test("reports a failing check without taking the call down with it", async () => {
		let { user, feed } = await createReaderWithFeed();
		server.use(http.get(FEED_URL, () => HttpResponse.error()));

		await expect(user.checkFeedNow(feed.id)).resolves.toEqual({
			ok: false,
			reason: "check-failed",
		});

		expect(titles(await user.readingQueue())).toHaveLength(5);
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

		expect((await user.listFeeds()).feeds).toEqual([]);
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

describe("the first refresh after a follow", () => {
	/**
	 * The one assertion that holds the two write paths to the same digest. A follow and a
	 * refresh each build the row that stores a post; the moment they project or hash a
	 * different set of fields, an untouched feed re-writes every post it carries on the very
	 * next poll, and a reader's list churns without a single error anywhere.
	 */
	test("writes no post, because a follow and a refresh hash the same fields", async () => {
		let { refreshDueFeeds: run } =
			await vi.importActual<typeof import("~/database/refresh")>("~/database/refresh");
		refreshDueFeeds.mockImplementation(run);

		let { state, user } = await createReaderWithFeed();

		let exec = vi.spyOn(state.storage.sql, "exec");
		await user.alarm();
		let writes = exec.mock.calls
			.map(([statement]) => String(statement))
			.filter((statement) => /feed_items/.test(statement))
			.filter((statement) => /^\s*(insert|update|delete)/i.test(statement));
		exec.mockRestore();

		expect(writes).toEqual([]);
		expect(titles(await user.readingQueue())).toHaveLength(5);
	});
});
