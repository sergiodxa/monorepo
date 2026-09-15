/**
 * Tests `GET /feeds/:feedId`: the guard, the feed a reader does not follow, the posts and
 * paging links of one they do, the empty feed, a cursor the store no longer decodes, and
 * the unfollow prompt that reaches a `DELETE` route through a browser `POST` — including
 * that it sits above the posts, where a reader finds it without scrolling past them.
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

/**
 * The copy a reader sees, with the markup carrying it stripped out. A title whose last
 * word travels with its outbound mark is split across elements, and what matters is that
 * the words still read as one line.
 */
function readsAs(html: string): string {
	return html.replace(/<[^>]*>/g, "");
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

	test("heads the page with the feed's title, which links out to its site", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let response = await get(routes.feeds.show.href({ feedId: FEED_ID }));
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(">Daring Fireball</title>");

		let heading = body.slice(body.indexOf("<h1"), body.indexOf("</h1>"));
		expect(heading).toContain('href="https://daringfireball.net"');
		expect(heading).toContain("Daring Fireball");
		/** Named for a reader who meets the link without seeing the outbound mark beside it. */
		expect(heading).toContain("Visit site");
		/** Leaving the app opens a tab of its own, so the reading position survives it. */
		expect(heading).toContain('target="_blank"');
		expect(heading).toContain('rel="noopener noreferrer"');
	});

	test("heads a feed that names no site with plain, unlinked text", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, siteUrl: null });

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();
		let heading = body.slice(body.indexOf("<h1"), body.indexOf("</h1>"));

		expect(heading).toContain("Daring Fireball");
		expect(heading).not.toContain("<a");
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

		expect(readsAs(body)).toContain("Markdown and the web");
		expect(readsAs(body)).toContain("An older one");
		expect(body).toContain("by John Gruber");
		expect(body).toContain("Published Jan 2, 2026");
		/** The mark is the whole control, so the words reach a reader through these two. */
		expect(body).toContain('aria-label="Mark as read"');
		expect(body).toContain('title="Mark as read"');
		expect(body).toContain('aria-label="Mark as unread"');
		expect(body).toContain('title="Mark as unread"');
		expect(body).toContain(
			`name="returnTo" value="${routes.feeds.show.href({ feedId: FEED_ID })}"`,
		);
	});

	test("marks a feed's posts with the ring that says which state each is in", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" }), item({ id: "item-2", readAt: Date.UTC(2026, 0, 3, 12) })],
			feeds: [FEED_REF],
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		/** The ring both posts wear, and the tick only the read one adds to it. */
		expect(body.match(/<circle cx="12" cy="12" r="8"/g)).toHaveLength(2);
		expect(body).toContain('d="m8.5 12 2.5 2.5 4.5-5"');
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
		expect(readsAs(body)).toContain("Markdown and the web");
	});

	test("offers the unfollow form, naming the feed and overriding the method", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		expect(body).toContain(`action="${routes.feeds.unfollow.href({ feedId: FEED_ID })}"`);
		expect(body).toContain('method="post"');
		expect(body).toContain('name="_method" value="DELETE"');
		expect(body).toContain("Stop following Daring Fireball?");
		expect(body).toContain("Unfollow");
		expect(body).toContain("Cancel");
	});

	test("puts unfollowing behind a prompt rather than a bare submit", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		expect(body).toContain(`commandfor="unfollow-${FEED_ID}"`);
		expect(body).toContain('command="show-modal"');
		expect(body).toContain(`id="unfollow-${FEED_ID}"`);
		expect(body).toContain('role="alertdialog"');
	});

	test("puts the unfollow control on the feed's own line, above the posts", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1", title: "Markdown and the web" })],
			feeds: [FEED_REF],
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();

		/** The actions sit beside the heading, inside the row the two share. */
		let headingRow = body.slice(body.indexOf("<h1"), body.indexOf("<ol"));
		expect(headingRow).toContain("Unfollow");
		expect(body.indexOf("Unfollow")).toBeLessThan(body.indexOf("Markdown and the"));
	});

	test("marks a post's title as leaving the app, and leaves an address-less one plain", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, siteUrl: null });
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [
				item({ id: "item-1", title: "Markdown and the web" }),
				item({ id: "item-2", title: "Nowhere to go", url: null }),
			],
			feeds: [FEED_REF],
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.feeds.show.href({ feedId: FEED_ID }))).text();
		let [, linked, plain] = body.slice(body.indexOf("<ol"), body.indexOf("</ol>")).split("<li");

		expect(linked).toContain('target="_blank"');
		expect(linked).toContain('rel="noopener noreferrer"');
		/** The first stroke of the outbound mark, which only a link that leaves wears. */
		expect(linked).toContain('d="M13 5h6v6"');
		/** The last word and the mark travel as one, so a wrap never strands the mark. */
		expect(linked).toContain("web<svg");

		expect(plain).toContain("Nowhere to go");
		expect(plain).not.toContain("<a ");
		expect(plain).not.toContain('d="M13 5h6v6"');
	});
});
