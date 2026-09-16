/**
 * Tests `GET /reading/:feed`: the guard, the feed a reader does not follow, the posts and
 * paging links of one they do, the empty feed, a cursor the store no longer decodes, the
 * unfollow prompt that reaches a `DELETE` route through a browser `POST` — including that
 * it sits above the posts, where a reader finds it without scrolling past them — the
 * mark-this-feed-read control beside it with the count its redirect comes back carrying,
 * the health this page asks the feed's own object for, and the control that says how long
 * this feed's posts stay.
 *
 * Every assertion is against rendered English copy rather than a translation key, since a
 * key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { FeedStore } from "~/database/feed-do";
import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { restoreFlags, serveFlags } from "~/app/lib/test/flags";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();
vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

/**
 * The feed's own object, which answers for the checks rather than the reader's store: the
 * fetching is shared by everyone following the feed, so what the last one recorded lives
 * with it.
 */
let health = vi.fn(async (): Promise<FeedStore.Health | null> => null);
let feedStore = vi.fn((_feedId: string) => ({ health }));
vi.doMock("~/database/feed-do", () => ({ feedStore }));

let { default: feed } = await import("./feed");

const FEED_ID = "feed-df";

/** The canonical feed the subscription names, which is what its object is addressed by. */
const CANONICAL_ID = "01J0FEED000000000000000000";

/** The feed under test, as `getFeed()` answers it. */
const FEED: UserStore.FeedSummary = {
	id: FEED_ID,
	feedId: CANONICAL_ID,
	feedUrl: "https://daringfireball.net/feeds/main",
	siteUrl: "https://daringfireball.net",
	title: "Daring Fireball",
	description: "By John Gruber",
	imageUrl: null,
	velocity: "evergreen",
	unreadCount: 2,
	folderId: null,
	folderTitle: null,
};

/** What the feed's object answers with for a feed whose last check went fine. */
const HEALTHY: FeedStore.Health = {
	status: "ok",
	httpStatus: 200,
	error: null,
	failureCount: 0,
	lastFetchedAt: Date.UTC(2026, 0, 1, 12),
	head: 12,
	postsPerDay: 1,
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
		savedAt: null,
		...overrides,
	};
}

/** Dispatches a real `GET` to `path` as `viewer`, through the feed controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.feed, feed);
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
	health = vi.fn(async (): Promise<FeedStore.Health | null> => null);
	feedStore.mockClear();
});

describe("GET /reading/:feed", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.feed.href({ feed: FEED_ID }), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.getFeed).not.toHaveBeenCalled();
	});

	test("answers a feed this reader does not follow with 404", async () => {
		let response = await get(routes.feed.href({ feed: "feed-nobody-follows" }));

		expect(response.status).toBe(404);

		let body = await response.text();
		expect(body).toContain("Feed not found");
		expect(body).toContain("You do not follow a feed with that address.");
		expect(body).toContain("Back to your reading");
		expect(body).toContain(`href="${routes.reading.index.href()}"`);
		expect(store.feedTimeline).not.toHaveBeenCalled();
	});

	test("heads the page with the feed's title, which links out to its site", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let response = await get(routes.feed.href({ feed: FEED_ID }));
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

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();
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

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();

		expect(readsAs(body)).toContain("Markdown and the web");
		expect(readsAs(body)).toContain("An older one");
		expect(body).toContain("by John Gruber");
		expect(body).toContain('title="Published Jan 2, 2026"');
		/**
		 * The page is headed by the feed, so the list under it names the author instead:
		 * repeating one name down every row of its own page says nothing.
		 */
		expect(body.slice(body.indexOf("<ol"))).not.toContain(FEED.title);
		/** The mark is the whole control, so the words reach a reader through these two. */
		expect(body).toContain('aria-label="Mark as read"');
		expect(body).toContain('title="Mark as read"');
		expect(body).toContain('aria-label="Mark as unread"');
		expect(body).toContain('title="Mark as unread"');
		expect(body).toContain(`name="returnTo" value="${routes.feed.href({ feed: FEED_ID })}"`);
	});

	test("marks a feed's posts with the ring that says which state each is in", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" }), item({ id: "item-2", readAt: Date.UTC(2026, 0, 3, 12) })],
			feeds: [FEED_REF],
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();

		/**
		 * The ring the unread post wears and the ticked ring the read one wears, each read
		 * off the class the icon set stamps on it, which outlives a redraw of its strokes.
		 *
		 * Counted inside the list: the header's mark-this-feed-read carries the ticked ring
		 * too, which is the same thing said about every post at once.
		 */
		let list = body.slice(body.indexOf("<ol"), body.indexOf("</ol>"));
		expect(list.match(/class="lucide lucide-circle"/g)).toHaveLength(1);
		expect(list.match(/class="lucide lucide-circle-check"/g)).toHaveLength(1);
	});

	test("walks the feed with hrefs carrying the cursor it was given", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: [FEED_REF],
			cursors: { next: "older-cursor", prev: null },
		});

		let path = `${routes.feed.href({ feed: FEED_ID })}?cursor=page-2`;
		let body = await (await get(path)).text();

		expect(store.feedTimeline).toHaveBeenCalledWith(FEED_ID, { cursor: "page-2", limit: 25 });
		expect(body).toContain(`href="${routes.feed.href({ feed: FEED_ID })}?cursor=older-cursor"`);
		expect(body).toContain("Older posts");
		expect(body).not.toContain("Newer posts");
	});

	test("says so when the feed holds nothing", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();

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

		let path = `${routes.feed.href({ feed: FEED_ID })}?cursor=rotten`;
		let response = await get(path);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("That page is no longer there.");
		expect(body).toContain("Back to the newest");
		expect(readsAs(body)).toContain("Markdown and the web");
	});

	test("offers the unfollow form, naming the feed and overriding the method", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();

		expect(body).toContain(`action="${routes.feeds.unfollow.href({ feedId: FEED_ID })}"`);
		expect(body).toContain('method="post"');
		expect(body).toContain('name="_method" value="DELETE"');
		expect(body).toContain("Stop following Daring Fireball?");
		expect(body).toContain("Unfollow");
		expect(body).toContain("Cancel");
	});

	test("puts unfollowing behind a prompt rather than a bare submit", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();

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

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();

		/** The actions sit beside the page's name, inside the header row the two share. */
		let header = body.slice(body.indexOf("<h1"), body.indexOf("<ol"));
		expect(header).toContain("Unfollow");
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

		let body = await (await get(routes.feed.href({ feed: FEED_ID }))).text();
		let [, linked, plain] = body.slice(body.indexOf("<ol"), body.indexOf("</ol>")).split("<li");

		expect(linked).toContain('target="_blank"');
		expect(linked).toContain('rel="noopener noreferrer"');
		/** The outbound mark, which only a link that leaves the app wears. */
		expect(linked).toContain("lucide-external-link");
		/**
		 * The mark sits outside the span that clips, so it survives a title too long for
		 * its row — which is most of them. Inside it, the ellipsis would eat the only
		 * thing saying the words are a link.
		 */
		expect(linked).toContain("web</span><svg");

		expect(plain).toContain("Nowhere to go");
		expect(plain).not.toContain("<a ");
		expect(plain).not.toContain("lucide-external-link");
	});
});

describe("checking a feed now", () => {
	test("offers the check alongside the way to unfollow", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(body).toContain(`action="${routes.feeds.refresh.href({ feedId: FEED_ID })}"`);
		expect(body).toContain("Check feed");
	});

	test("posts the check rather than linking it, so nothing follows it by accident", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.feeds.refresh.href({ feedId: FEED_ID })}"[^>]*>`),
		);

		expect(form?.[0]).toContain('method="post"');
	});

	test("says so when the check brought posts in", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(`${routes.feed.href({ feed: FEED_ID })}?checked=new`).then((r) =>
			r.text(),
		);

		expect(readsAs(body)).toContain("New posts arrived.");
	});

	test("says so when there was nothing new", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(`${routes.feed.href({ feed: FEED_ID })}?checked=none`).then((r) =>
			r.text(),
		);

		expect(readsAs(body)).toContain("Nothing new since the last check.");
	});

	test("says the feed could not be reached, and that the schedule will retry", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(`${routes.feed.href({ feed: FEED_ID })}?checked=failed`).then((r) =>
			r.text(),
		);

		expect(readsAs(body)).toContain("could not be reached just now");
		expect(readsAs(body)).toContain("next scheduled check will try again");
	});

	test("reports nothing on an ordinary visit, or on a value it does not know", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let plain = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let bogus = await get(`${routes.feed.href({ feed: FEED_ID })}?checked=wat`).then((r) =>
			r.text(),
		);

		for (let body of [plain, bogus]) {
			expect(readsAs(body)).not.toContain("New posts arrived.");
			expect(readsAs(body)).not.toContain("Nothing new since the last check.");
			expect(readsAs(body)).not.toContain("could not be reached just now");
		}
	});
});

describe("marking a feed read", () => {
	test("offers the mark beside the check and the way to unfollow", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.feedTimeline.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1", title: "Markdown and the web" })],
			feeds: [FEED_REF],
			cursors: { next: null, prev: null },
		});

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(body).toContain(`action="${routes.feeds.read.href({ feedId: FEED_ID })}"`);

		/** The three actions share the header's row with the feed's name, in reading order. */
		let header = body.slice(body.indexOf("<h1"), body.indexOf("<ol"));
		expect(header).toContain("Check feed");
		expect(header).toContain("Mark feed read");
		expect(header).toContain("Unfollow");
		expect(header.indexOf("Check feed")).toBeLessThan(header.indexOf("Mark feed read"));
		expect(header.indexOf("Mark feed read")).toBeLessThan(header.indexOf("Unfollow"));

		/** Each one carries its own mark, which is what it says on a row too narrow for words. */
		expect(header).toContain("lucide-refresh-cw");
		expect(header).toContain("lucide-circle-check");
		expect(header).toContain("lucide-unlink");
	});

	test("posts the mark rather than linking it, so nothing follows it by accident", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.feeds.read.href({ feedId: FEED_ID })}"[^>]*>`),
		);

		expect(form?.[0]).toContain('method="post"');
		expect(body).not.toContain(`href="${routes.feeds.read.href({ feedId: FEED_ID })}"`);
	});

	test("marks the feed on the first click, with no prompt in the way", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(body).not.toContain(`commandfor="mark-${FEED_ID}"`);
		expect(body.match(/role="alertdialog"/g)).toHaveLength(1);
	});

	test("says how many posts the mark took out of the queue", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let one = await get(`${routes.feed.href({ feed: FEED_ID })}?marked=1`).then((r) => r.text());
		let many = await get(`${routes.feed.href({ feed: FEED_ID })}?marked=12`).then((r) => r.text());

		expect(readsAs(one)).toContain("1 post marked read.");
		expect(readsAs(many)).toContain("12 posts marked read.");
	});

	test("says there was nothing unread rather than counting to zero", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(`${routes.feed.href({ feed: FEED_ID })}?marked=0`).then((r) => r.text());

		expect(readsAs(body)).toContain("There was nothing unread to mark.");
		expect(readsAs(body)).not.toContain("0 posts marked read.");
	});

	test("reports nothing on an ordinary visit, or on a value that is not a count", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let plain = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let bogus = await get(`${routes.feed.href({ feed: FEED_ID })}?marked=lots`).then((r) =>
			r.text(),
		);
		let blank = await get(`${routes.feed.href({ feed: FEED_ID })}?marked=`).then((r) => r.text());

		for (let body of [plain, bogus, blank]) {
			expect(readsAs(body)).not.toContain("marked read.");
			expect(readsAs(body)).not.toContain("There was nothing unread to mark.");
		}
	});

	test("says one outcome when a hand-made URL carries both parameters", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(`${routes.feed.href({ feed: FEED_ID })}?marked=3&checked=new`).then((r) =>
			r.text(),
		);

		expect(readsAs(body)).toContain("3 posts marked read.");
		expect(readsAs(body)).not.toContain("New posts arrived.");
	});
});

describe("a feed's health", () => {
	test("says what the publisher calls this feed, under its name", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("By John Gruber");
	});

	/**
	 * The checks belong to the feed rather than to the subscription, so the page asks the
	 * object that made them, addressed by the canonical id the subscription carries.
	 */
	test("asks the feed's own object, by the id the subscription names", async () => {
		store.getFeed.mockResolvedValue(FEED);

		await get(routes.feed.href({ feed: FEED_ID }));

		expect(feedStore).toHaveBeenCalledWith(CANONICAL_ID);
		expect(health).toHaveBeenCalled();
	});

	test("says when the feed was last checked, with the full date behind it", async () => {
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({ ...HEALTHY, lastFetchedAt: Date.UTC(2020, 0, 2, 12) });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("Checked Jan 2, 2020");
		expect(body).toContain('title="Jan 2, 2020');
	});

	test("says so plainly for a feed nobody has checked yet", async () => {
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({ ...HEALTHY, lastFetchedAt: null });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("Not checked yet");
	});

	/** An object that has never answered is a feed nobody has checked, which is what it is. */
	test("reads a feed whose object answers with nothing as one never checked", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("Not checked yet");
		expect(readsAs(body)).not.toContain("checks failed");
	});

	test("says how many checks failed and what the last one recorded", async () => {
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({
			...HEALTHY,
			status: "http_error",
			httpStatus: 500,
			failureCount: 3,
		});

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("The last 3 checks failed");
		expect(readsAs(body)).toContain("The site answered with an error");
	});

	test("says nothing about failures for a feed that is fine", async () => {
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue(HEALTHY);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).not.toContain("check failed");
		expect(readsAs(body)).not.toContain("checks failed");
	});
});

describe("what a flag moves about the suggestion", () => {
	afterEach(() => restoreFlags());

	/**
	 * How much a feed has to publish before the question is worth asking is a judgement
	 * about people, and the number nobody has measured. Moving it moves who is asked, and
	 * moves nothing else: no subscription is written either way.
	 */
	test("asks nobody when the rate is set above what the feed publishes", async () => {
		await serveFlags({ "velocity-suggestion-rate": 40 });
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({ ...HEALTHY, postsPerDay: 12 });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).not.toContain("This feed publishes about");
		expect(store.setVelocity).not.toHaveBeenCalled();
	});

	test("asks about a quieter feed when the rate is set below it", async () => {
		await serveFlags({ "velocity-suggestion-rate": 2 });
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({ ...HEALTHY, postsPerDay: 3 });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("This feed publishes about 3 posts a day");
		expect(store.setVelocity).not.toHaveBeenCalled();
	});
});

describe("how long this feed's posts stay", () => {
	test("offers every span, each a submit carrying its own value", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, velocity: "news" });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		/** Each row submits the form it sits in, which is what asks for no script. */
		for (let velocity of ["breaking", "news", "article", "essay", "evergreen"]) {
			expect(body).toMatch(new RegExp(`<button[^>]*\\bname="velocity"[^>]*\\bvalue="${velocity}"`));
		}

		expect(readsAs(body)).toContain("3 hours");
		expect(readsAs(body)).toContain("Forever");
	});

	/** The trigger wears the answer, so the setting reads without opening anything. */
	test("says which span is set on the control that changes it", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, velocity: "news" });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let trigger = /<button[^>]*\bcommandfor="velocity-[^"]*"[^>]*>[\s\S]*?<\/button>/.exec(
			body,
		)?.[0];

		expect(readsAs(trigger ?? "")).toContain("News");
		expect(trigger).toContain('aria-label="How long these posts stay"');

		// And the row for that span is the one marked as chosen.
		expect(body).toMatch(/<button[^>]*\bvalue="news"[^>]*\baria-selected="true"/);
	});

	/** A plain form and a submit, so a browser running no script sets a span the same way. */
	test("posts the choice to the feed's own velocity route", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(body).toContain(
			`<form method="post" action="${routes.feeds.velocity.href({ feedId: FEED_ID })}"`,
		);
	});

	test("ties the trigger to the menu it opens, and names both", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		let opens = /<button[^>]*\bcommandfor="([^"]+)"[^>]*\bcommand="toggle-popover"/.exec(body)?.[1];
		expect(opens).toBeDefined();
		expect(body).toContain(`id="${opens}"`);

		// The menu carries the name too, since a reader who opens it is reading it alone.
		expect(body).toMatch(
			/aria-label="How long these posts stay"[\s\S]*aria-label="How long these posts stay"/,
		);
	});

	/**
	 * The measurement is put to the reader as a question. Asserting the field still shows
	 * what they chose is the point of the test: a suggestion that set anything would be the
	 * one thing this control is not allowed to do.
	 */
	test("asks about a busy feed nothing ages out of, and changes nothing", async () => {
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({ ...HEALTHY, postsPerDay: 40 });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).toContain("This feed publishes about 40 posts a day");
		expect(body).toMatch(/<button[^>]*\bvalue="evergreen"[^>]*\baria-selected="true"/);
		expect(store.setVelocity).not.toHaveBeenCalled();
	});

	test("says nothing about a feed publishing at a rate anybody could read", async () => {
		store.getFeed.mockResolvedValue(FEED);
		health.mockResolvedValue({ ...HEALTHY, postsPerDay: 2 });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).not.toContain("posts a day");
	});

	/** A reader who already chose a span has answered the question this would ask. */
	test("says nothing about a busy feed whose posts already age out", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, velocity: "news" });
		health.mockResolvedValue({ ...HEALTHY, postsPerDay: 40 });

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(readsAs(body)).not.toContain("posts a day");
	});

	test("reports what a submission came back with", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let saved = await get(`${routes.feed.href({ feed: FEED_ID })}?velocity=saved`).then((r) =>
			r.text(),
		);
		expect(readsAs(saved)).toContain("Saved.");

		let refused = await get(`${routes.feed.href({ feed: FEED_ID })}?velocity=invalid`).then((r) =>
			r.text(),
		);
		expect(readsAs(refused)).toContain("That is not one of the spans on offer.");
	});
});

describe("which folder this feed reads in", () => {
	/** The folders this reader has, which the filing control offers one submit each for. */
	const FOLDERS = [
		{ id: "01J0FOLDER00000000000000A1", title: "Tech" },
		{ id: "01J0FOLDER00000000000000A2", title: "News" },
	];

	test("offers every folder the reader has, each as a submit of its own", async () => {
		store.getFeed.mockResolvedValue(FEED);
		store.listFolders.mockResolvedValue(FOLDERS);

		let body = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());

		expect(body).toContain(
			`<form method="post" action="${routes.folders.file.href({ feedId: FEED_ID })}"`,
		);

		for (let folder of FOLDERS) {
			expect(body).toMatch(
				new RegExp(`<button[^>]*\\bname="folderId"[^>]*\\bvalue="${folder.id}"`),
			);
		}
	});

	/** The trigger wears the answer, so the filing is legible without opening anything. */
	test("says the folder it is in, and says so when it is in none", async () => {
		store.getFeed.mockResolvedValue({ ...FEED, folderId: FOLDERS[0]?.id, folderTitle: "Tech" });
		store.listFolders.mockResolvedValue(FOLDERS);

		let filed = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let trigger = /<button[^>]*\bcommandfor="folder-[^"]*"[^>]*>[\s\S]*?<\/button>/.exec(filed);
		expect(readsAs(trigger?.[0] ?? "")).toContain("Tech");

		store.getFeed.mockResolvedValue(FEED);
		let unfiled = await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text());
		let none = /<button[^>]*\bcommandfor="folder-[^"]*"[^>]*>[\s\S]*?<\/button>/.exec(unfiled);
		expect(readsAs(none?.[0] ?? "")).toContain("No folder");
	});

	/** Taking an unfiled feed out of nothing does nothing, so it is offered to neither. */
	test("offers the way out of a folder only to a feed that is in one", async () => {
		store.listFolders.mockResolvedValue(FOLDERS);

		store.getFeed.mockResolvedValue({ ...FEED, folderId: FOLDERS[0]?.id, folderTitle: "Tech" });
		expect(readsAs(await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text()))).toContain(
			"Take out of this folder",
		);

		store.getFeed.mockResolvedValue(FEED);
		expect(
			readsAs(await get(routes.feed.href({ feed: FEED_ID })).then((r) => r.text())),
		).not.toContain("Take out of this folder");
	});

	test("reports what a filing submission came back with", async () => {
		store.getFeed.mockResolvedValue(FEED);

		let filed = await get(`${routes.feed.href({ feed: FEED_ID })}?folder=filed`).then((r) =>
			r.text(),
		);
		expect(readsAs(filed)).toContain("Filed.");

		let removed = await get(`${routes.feed.href({ feed: FEED_ID })}?folder=unfiled`).then((r) =>
			r.text(),
		);
		expect(readsAs(removed)).toContain("Taken out of its folder.");
	});
});
