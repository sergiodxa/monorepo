/**
 * Tests `GET /reading`: the guard that keeps it to signed-in readers, the queue it renders
 * from what the store answered, the mark that carries a post out of it, the links that
 * walk it, the two ways an empty queue reads, a cursor the store no longer decodes, and
 * the prompt standing between a reader and clearing the whole queue at once.
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

describe("GET /reading", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.reading.href(), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.readingQueue).not.toHaveBeenCalled();
	});

	test("renders each unread post with the feed it came from and when it was published", async () => {
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
		expect(readsAs(body)).toContain("Markdown and the web");
		expect(readsAs(body)).toContain("Release candidate two");
		expect(body).toContain("Daring Fireball");
		expect(body).toContain("Remix Changelog");
		/**
		 * The queue gathers every feed, so a post names the one it came from, and dates
		 * itself against today with the full date behind the tooltip.
		 */
		expect(body).toContain("Jan 2");
		expect(body).toContain('title="Published Jan 2, 2026"');
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
		/** The mark is the whole control, so the words reach a reader through these two. */
		expect(body).toContain('aria-label="Mark as read"');
		expect(body).toContain('title="Mark as read"');
	});

	test("reports a followed title to the route that marks the post read", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [
				item({ id: "item-1" }),
				/** A feed that published no address leaves the title as words, with nothing to follow. */
				item({ id: "item-2", title: "Nowhere to go", url: null }),
			],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.reading.href())).text();

		let linked = /<a[^>]*href="https:\/\/example\.com\/post"[^>]*>/.exec(body)?.[0];
		expect(linked).toContain(`ping="${routes.items.open.href({ itemId: "item-1" })}"`);

		/** A row with no link carries no ping, rather than reporting the trip to `/null`. */
		expect(body).not.toContain('ping="null"');
		expect(body).not.toContain(routes.items.open.href({ itemId: "item-2" }));
	});

	test("marks a queued post with the tick that carries it out, not a state ring", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.reading.href())).text();

		/**
		 * The tick a completing surface wears, read off the class the icon set stamps on
		 * every glyph, which outlives a redraw of the strokes inside it.
		 */
		expect(body).toContain('class="lucide lucide-check"');
		expect(body).not.toContain("lucide-circle");
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
		store.countFeeds.mockResolvedValue(1);

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
		expect(body).toContain("That page is no longer there.");
		expect(body).toContain("Back to the newest");
		expect(readsAs(body)).toContain("Markdown and the web");
	});
});

describe("marking the whole queue read", () => {
	/** A queue with a post in it, which is what the offer to clear it waits for. */
	function queued() {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1", title: "Markdown and the web" })],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});
	}

	test("offers the sweep on the queue's own line, above the posts", async () => {
		queued();

		let body = await (await get(routes.reading.href())).text();

		let headingRow = body.slice(body.indexOf("<h1"), body.indexOf("<ol"));
		expect(headingRow).toContain("Mark everything read");
	});

	test("posts the sweep rather than linking it, so nothing follows it by accident", async () => {
		queued();

		let body = await (await get(routes.reading.href())).text();
		let form = body.match(new RegExp(`<form[^>]*action="${routes.readAll.href()}"[^>]*>`));

		expect(form?.[0]).toContain('method="post"');
		expect(body).not.toContain(`href="${routes.readAll.href()}"`);
		/** The route answers `POST`, so nothing has to be overridden into it. */
		expect(body).not.toContain('name="_method"');
	});

	test("puts the sweep behind a prompt carrying the warning, not a bare submit", async () => {
		queued();

		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain('commandfor="mark-all-read"');
		expect(body).toContain('command="show-modal"');
		expect(body).toContain('id="mark-all-read"');
		expect(body).toContain('role="alertdialog"');
		expect(readsAs(body)).toContain("this cannot be undone");
		expect(body).toContain("Cancel");
	});

	test("offers nothing to clear when the queue is already empty", async () => {
		store.countFeeds.mockResolvedValue(1);

		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain("You are all caught up");
		expect(body).not.toContain("Mark everything read");
		expect(body).not.toContain(`action="${routes.readAll.href()}"`);
		expect(body).not.toContain('role="alertdialog"');
	});

	test("says how many posts the sweep took out of the queue", async () => {
		queued();

		let one = await (await get(`${routes.reading.href()}?marked=1`)).text();
		let many = await (await get(`${routes.reading.href()}?marked=41`)).text();

		expect(readsAs(one)).toContain("1 post marked read.");
		expect(readsAs(many)).toContain("41 posts marked read.");
	});

	test("says there was nothing unread rather than counting to zero", async () => {
		store.countFeeds.mockResolvedValue(1);

		let body = await (await get(`${routes.reading.href()}?marked=0`)).text();

		expect(readsAs(body)).toContain("There was nothing unread to mark.");
		expect(readsAs(body)).not.toContain("0 posts marked read.");
	});

	test("reports nothing on an ordinary visit, or on a value that is not a count", async () => {
		queued();

		let plain = await (await get(routes.reading.href())).text();
		let bogus = await (await get(`${routes.reading.href()}?marked=all`)).text();
		let blank = await (await get(`${routes.reading.href()}?marked=`)).text();

		for (let body of [plain, bogus, blank]) {
			expect(readsAs(body)).not.toContain("marked read.");
			expect(readsAs(body)).not.toContain("There was nothing unread to mark.");
		}
	});
});
