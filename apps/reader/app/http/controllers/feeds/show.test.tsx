/**
 * Tests `GET /feeds/:feedId`: the guard, the feed a reader does not follow, the posts and
 * paging links of one they do, the empty feed, a cursor the store no longer decodes, and
 * the unfollow form that reaches a `DELETE` route through a browser `POST`.
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

let { default: show } = await import("./show");

const FEED_ID = "feed-df";

/** The feed under test, as `getFeed()` answers it. */
const FEED: UserStore.FeedSummary = {
	id: FEED_ID,
	feedUrl: "https://daringfireball.net/feeds/main",
	siteUrl: "https://daringfireball.net",
	title: "Daring Fireball",
	description: "By John Gruber",
	imageUrl: null,
	lastFetchedAt: null,
	lastStatus: null,
	failureCount: 0,
	unreadCount: 2,
};

/** The same feed as the timeline carries it beside the posts it produced. */
const FEED_REF: UserStore.FeedRef = {
	id: FEED_ID,
	title: FEED.title,
	siteUrl: FEED.siteUrl,
};

/** Builds one of the feed's posts, defaulting every field a test is not about. */
function item(overrides: Partial<UserStore.Item> & Pick<UserStore.Item, "id">): UserStore.Item {
	return {
		feedId: FEED_ID,
		title: "A post",
		url: "https://daringfireball.net/post",
		summary: null,
		author: null,
		/** Midday, so the date reads the same whatever timezone the test host runs in. */
		publishedAt: Date.UTC(2026, 0, 2, 12),
		readAt: null,
		...overrides,
	};
}

/** Dispatches a real `GET` to `path` as `viewer`, through the feed controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.feeds.show, show);
	return fetchRoute(router, path);
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("GET /feeds/:feedId", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.feeds.show.href({ feedId: FEED_ID }), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.getFeed).not.toHaveBeenCalled();
	});

	test("answers a feed this reader does not follow with 404", async () => {
		let response = await get(routes.feeds.show.href({ feedId: "feed-nobody-follows" }));

		expect(response.status).toBe(404);

		let body = await response.text();
		expect(body).toContain("Feed not found");
		expect(body).toContain("You do not follow a feed with that address.");
		expect(body).toContain("Back to your feeds");
		expect(body).toContain(`href="${routes.feeds.index.href()}"`);
		expect(store.feedTimeline).not.toHaveBeenCalled();
	});

	test("heads the page with the feed's title and links out to its site", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let response = await get(routes.feeds.show.href({ feedId: FEED_ID }));
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(">Daring Fireball</title>");
		expect(body).toContain("<h1");
		expect(body).toContain("Daring Fireball");
		expect(body).toContain("Visit site");
		expect(body).toContain('href="https://daringfireball.net"');
	});

	test("leaves out the site link for a feed that names no site", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, siteUrl: null });

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		expect(body).not.toContain("Visit site");
	});

	test("renders the feed's posts, read and unread alike", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [
				item({ id: "item-1", title: "Markdown and the web", author: "John Gruber" }),
				item({ id: "item-2", title: "An older one", readAt: Date.UTC(2026, 0, 3, 12) }),
			],
			feeds: [FEED_REF],
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		expect(body).toContain("Markdown and the web");
		expect(body).toContain("An older one");
		expect(body).toContain("by John Gruber");
		expect(body).toContain("Published Jan 2, 2026");
		expect(body).toContain("Mark as read");
		expect(body).toContain("Mark as unread");
		expect(body).toContain(
			`name="returnTo" value="${routes.feeds.show.href({ feedId: FEED_ID })}"`,
		);
	});

	test("walks the feed with hrefs carrying the cursor it was given", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: [FEED_REF],
			cursors: { next: "older-cursor", prev: null },
		});

		let path = `${routes.feeds.show.href({ feedId: FEED_ID })}?cursor=page-2`;
		let body = await (await get(path)).text();

		expect(store.feedTimeline).toHaveBeenCalledWith(FEED_ID, { cursor: "page-2" });
		expect(body).toContain(
			`href="${routes.feeds.show.href({ feedId: FEED_ID })}?cursor=older-cursor"`,
		);
		expect(body).toContain("Older posts");
		expect(body).not.toContain("Newer posts");
	});

	test("says so when the feed holds nothing", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		expect(body).toContain("No posts yet");
		expect(body).toContain("This feed has published nothing since you started following it.");
	});

	test("answers a cursor the store cannot decode with the newest page and a note", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockImplementation(
			async (
				_feedId: string,
				options: UserStore.TimelineOptions,
			): Promise<UserStore.TimelineResult> => {
				if (options.cursor) return { ok: false, reason: "bad-cursor" };
				return {
					ok: true,
					items: [item({ id: "item-1", title: "Markdown and the web" })],
					feeds: [FEED_REF],
					cursors: { next: null, prev: null },
				};
			},
		);

		let path = `${routes.feeds.show.href({ feedId: FEED_ID })}?cursor=rotten`;
		let response = await get(path);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("That page of posts is no longer there.");
		expect(body).toContain("Back to the newest");
		expect(body).toContain("Markdown and the web");
	});

	test("offers the unfollow form, naming the feed and overriding the method", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		expect(body).toContain(`action="${routes.feeds.unfollow.href({ feedId: FEED_ID })}"`);
		expect(body).toContain('method="post"');
		expect(body).toContain('name="_method" value="DELETE"');
		expect(body).toContain("Stop following Daring Fireball?");
		expect(body).toContain("Unfollow");
	});
});
