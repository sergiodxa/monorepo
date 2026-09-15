/**
 * Tests `GET /reading`: the guard that keeps it to signed-in readers, the queue it renders
 * from what the store answered, the links that walk it, the two ways an empty queue reads,
 * and a cursor the store no longer decodes.
 *
 * Every assertion is against rendered English copy rather than a translation key, since a
 * key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();
vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: reading } = await import("./reading");

/** The two feeds the fixture posts come from, as the store carries them beside the items. */
const FEEDS: UserStore.FeedRef[] = [
	{ id: "feed-df", title: "Daring Fireball", siteUrl: "https://daringfireball.net" },
	{ id: "feed-rc", title: "Remix Changelog", siteUrl: null },
];

/** One followed feed, as `listFeeds()` answers it, for telling the two empty queues apart. */
const FOLLOWED: UserStore.FeedSummary = {
	id: "feed-df",
	feedUrl: "https://daringfireball.net/feeds/main",
	siteUrl: "https://daringfireball.net",
	title: "Daring Fireball",
	description: null,
	imageUrl: null,
	lastFetchedAt: null,
	lastStatus: null,
	failureCount: 0,
	unreadCount: 0,
};

/** Builds a queue item, defaulting every field a test is not about. */
function item(overrides: Partial<UserStore.Item> & Pick<UserStore.Item, "id">): UserStore.Item {
	return {
		feedId: "feed-df",
		title: "A post",
		url: "https://example.com/post",
		summary: null,
		author: null,
		/** Midday, so the date reads the same whatever timezone the test host runs in. */
		publishedAt: Date.UTC(2026, 0, 2, 12),
		readAt: null,
		...overrides,
	};
}

/** Dispatches a real `GET` to `path` as `viewer`, through the queue controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.reading, reading);
	return fetchRoute(router, path);
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("GET /reading", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.reading.href(), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.readingQueue).not.toHaveBeenCalled();
	});

	test("renders each unread post with its feed, author and published date", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [
				item({ id: "item-1", title: "Markdown and the web", author: "John Gruber" }),
				item({ id: "item-2", feedId: "feed-rc", title: "Release candidate two" }),
			],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let response = await get(routes.reading.href());
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Markdown and the web");
		expect(body).toContain("Release candidate two");
		expect(body).toContain("Daring Fireball");
		expect(body).toContain("Remix Changelog");
		expect(body).toContain("by John Gruber");
		expect(body).toContain("Published Jan 2, 2026");
	});

	test("gives every post a mark-read form returning to this page", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let body = await (await get(`${routes.reading.href()}?cursor=page-2`)).text();

		expect(body).toContain(`action="${routes.items.read.href({ itemId: "item-1" })}"`);
		expect(body).toContain('name="read" value="true"');
		expect(body).toContain(`name="returnTo" value="${routes.reading.href()}?cursor=page-2"`);
		expect(body).toContain("Mark as read");
	});

	test("reads the cursor off the query string", async () => {
		await get(`${routes.reading.href()}?cursor=page-2`);

		expect(store.readingQueue).toHaveBeenCalledWith({ cursor: "page-2" });
	});

	test("walks the queue with hrefs rather than bare cursors", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next: "older-cursor", prev: "newer-cursor" },
		});

		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain(`href="${routes.reading.href()}?cursor=older-cursor"`);
		expect(body).toContain(`href="${routes.reading.href()}?cursor=newer-cursor"`);
		expect(body).toContain("Older posts");
		expect(body).toContain("Newer posts");
	});

	test("drops the paging links at both ends of the queue", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.reading.href())).text();

		expect(body).not.toContain("Older posts");
		expect(body).not.toContain("Newer posts");
	});

	test("invites a reader who follows nothing to follow their first feed", async () => {
		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain("Nothing to read yet");
		expect(body).toContain("Follow your first feed");
		expect(body).toContain(`href="${routes.feeds.index.href()}"`);
		expect(body).not.toContain("You are all caught up");
	});

	test("tells a reader who has read everything that they are caught up", async () => {
		store.listFeeds.mockResolvedValue([FOLLOWED]);

		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain("You are all caught up");
		expect(body).not.toContain("Nothing to read yet");
	});

	test("answers a cursor the store cannot decode with the newest page and a note", async () => {
		store.readingQueue.mockImplementation(
			async (options: UserStore.TimelineOptions): Promise<UserStore.TimelineResult> => {
				if (options.cursor) return { ok: false, reason: "bad-cursor" };
				return {
					ok: true,
					items: [item({ id: "item-1", title: "Markdown and the web" })],
					feeds: FEEDS,
					cursors: { next: null, prev: null },
				};
			},
		);

		let response = await get(`${routes.reading.href()}?cursor=rotten`);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("That page of posts is no longer there.");
		expect(body).toContain("Back to the newest");
		expect(body).toContain("Markdown and the web");
	});
});
