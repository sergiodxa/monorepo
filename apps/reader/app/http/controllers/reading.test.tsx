/**
 * Tests `GET /reading`, which is the app's only list of posts: the guard that keeps it to
 * signed-in readers, the queue it renders from what the store answered, the filter naming
 * which of its posts the page holds, the words a reader narrows it by and the two of those
 * composing, the mark that says whether a post has been read, the links that walk the queue
 * carrying both narrowings, what an empty queue says under each of them, a cursor the store
 * no longer decodes, the enhancement that fetches the next page as the reader scrolls, the
 * two subscription-wide controls the header carries, and the prompt standing between a
 * reader and clearing the whole queue at once.
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

/**
 * Every module a page's islands can name, globbed exactly as `bootstrap/browser.ts` globs
 * them, so this resolves an island the way the browser will rather than the way a test
 * author assumed it would.
 */
const CLIENT_MODULES = import.meta.glob(["../../../resources/**/*.{ts,tsx}"]);

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

	test("renders each post with the feed it came from and when it was published", async () => {
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

	test("marks a post with the ring saying which of the two states it is in", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" }), item({ id: "item-2", readAt: Date.UTC(2026, 0, 3, 12) })],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let body = await (await get(routes.reading.href())).text();

		/**
		 * The two rings, read off the class the icon set stamps on every glyph, which
		 * outlives a redraw of the strokes inside it. The page holds both states now, so the
		 * mark names the one a post is in rather than offering to finish it.
		 *
		 * Counted inside the list: the header's filters wear the same two rings, since what
		 * they narrow the page to is what a row's mark says about the post beside it.
		 */
		let list = body.slice(body.indexOf("<ol"), body.indexOf("</ol>"));
		expect(list.match(/class="lucide lucide-circle"/g)).toHaveLength(1);
		expect(list.match(/class="lucide lucide-circle-check"/g)).toHaveLength(1);
		expect(body).not.toContain("lucide-undo");
	});

	test("reads the cursor off the query string", async () => {
		await get(`${routes.reading.href()}?cursor=page-2`);

		expect(store.readingQueue).toHaveBeenCalledWith({
			cursor: "page-2",
			readState: "all",
			query: "",
			limit: 25,
		});
	});

	test("walks the queue with hrefs rather than bare cursors", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next: "older-cursor", prev: "newer-cursor" },
		});

		let body = await (await get(routes.reading.href())).text();

		/** The older link carries where the page it leads to begins, which is past this row. */
		expect(body).toContain(`href="${routes.reading.href()}?cursor=older-cursor&amp;from=2"`);
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

	test("points a reader who follows nothing at the box that follows one", async () => {
		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain("Nothing to read yet");
		expect(readsAs(body)).toContain("into the box above");
		/** The box it names is on this page, so there is nowhere to send them. */
		expect(body).toContain(`action="${routes.feeds.follow.href()}"`);
		expect(body).not.toContain("You are all caught up");
	});

	test("says of an empty queue what each filter was asking for", async () => {
		store.countFeeds.mockResolvedValue(1);

		let all = await (await get(routes.reading.href())).text();
		let unread = await (await get(`${routes.reading.href()}?show=unread`)).text();
		let read = await (await get(`${routes.reading.href()}?show=read`)).text();

		expect(all).toContain("Nothing here yet");
		expect(all).toContain("The feeds you follow have published nothing so far.");

		expect(unread).toContain("You are all caught up");
		expect(read).toContain("Nothing read yet");

		/** Somebody following feeds is never invited to follow their first one. */
		for (let body of [all, unread, read]) expect(body).not.toContain("Nothing to read yet");
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

describe("filtering the queue", () => {
	/** A page of the queue with a post on it, whichever filter is asking for it. */
	function queued(cursors: { next: string | null; prev: string | null }) {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors,
		});
	}

	test("holds every post until the URL asks for less", async () => {
		await get(routes.reading.href());

		expect(store.readingQueue).toHaveBeenCalledWith({
			cursor: null,
			readState: "all",
			query: "",
			limit: 25,
		});
	});

	test("narrows to the state the URL names", async () => {
		await get(`${routes.reading.href()}?show=unread`);
		expect(store.readingQueue).toHaveBeenLastCalledWith({
			cursor: null,
			readState: "unread",
			query: "",
			limit: 25,
		});

		await get(`${routes.reading.href()}?show=read`);
		expect(store.readingQueue).toHaveBeenLastCalledWith({
			cursor: null,
			readState: "read",
			query: "",
			limit: 25,
		});
	});

	test("shows every post for a value nobody wrote, rather than erroring", async () => {
		let response = await get(`${routes.reading.href()}?show=everything`);

		expect(response.status).toBe(200);
		expect(store.readingQueue).toHaveBeenCalledWith({
			cursor: null,
			readState: "all",
			query: "",
			limit: 25,
		});
	});

	test("marks the filter being read and leaves the others as ways out of it", async () => {
		queued({ next: null, prev: null });

		let body = await (await get(`${routes.reading.href()}?show=unread`)).text();

		expect(body).toMatch(/<a href="\/reading\?show=unread" aria-current="page"/);
		expect(body).toContain('<a href="/reading" data-color');
		expect(body).toContain('<a href="/reading?show=read" data-color');
		/** Exactly one filter is the view being read, and one section is the page it is on. */
		expect(body.match(/aria-current="page"/g)).toHaveLength(2);
	});

	test("carries the filter through the links that page the queue", async () => {
		queued({ next: "older-cursor", prev: "newer-cursor" });

		let body = await (await get(`${routes.reading.href()}?show=read`)).text();

		expect(body).toContain(
			`href="${routes.reading.href()}?show=read&amp;cursor=older-cursor&amp;from=2"`,
		);
		expect(body).toContain(`href="${routes.reading.href()}?show=read&amp;cursor=newer-cursor"`);
	});

	test("offers the filters on an empty queue, which is how a reader leaves one", async () => {
		store.countFeeds.mockResolvedValue(1);

		let body = await (await get(`${routes.reading.href()}?show=read`)).text();

		expect(body).toContain("Nothing read yet");
		expect(body).toContain('<a href="/reading" data-color');
		expect(body).toContain('<a href="/reading?show=unread" data-color');
	});
});

describe("paging into a frame", () => {
	/** A page of the queue with an older page behind it. */
	function queued(next: string | null) {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next, prev: null },
		});
	}

	test("sends the link a reader walks the queue with, and defers the page behind it", async () => {
		queued("older-cursor");

		let body = await (await get(routes.reading.href())).text();

		/** The link is what the server sends and what a browser running no script keeps. */
		expect(body).toContain(`href="${routes.reading.href()}?cursor=older-cursor&amp;from=2"`);
		expect(body).toContain("Older posts");
		/** And the piece that replaces it is the same page asked for as a fragment. */
		expect(body).toContain(`"src":"/reading?cursor=older-cursor&from=2&frame=older"`);
		expect(body).toContain('"exportName":"LazyFrame"');
	});

	/**
	 * Every other assertion here is about the addresses an island carries. This one is about
	 * the islands themselves, each of which is a file path and an export name written into
	 * the page as text and resolved by the browser some time later. Get either wrong and the
	 * page still renders, still carries the right addresses, and still passes every test
	 * above — the enhancement simply never comes up, and the reader is left with the plain
	 * links and no sign that anything was meant to replace them.
	 *
	 * Resolved through the same glob the browser entry resolves them through, so a module
	 * that has moved out of its reach fails here rather than in a browser nobody is watching.
	 */
	test("names every island by a module and an export the browser can reach", async () => {
		queued("older-cursor");

		let body = await (await get(routes.reading.href())).text();

		let islands = [...body.matchAll(/"exportName":"([^"]+)","moduleUrl":"([^"]+)"/g)].map(
			([, exportName, moduleUrl]) => ({ exportName, moduleUrl }),
		);

		/** The page defers its next page and marks every row, so it mounts both of them. */
		expect(new Set(islands.map((island) => island.moduleUrl))).toEqual(
			new Set(["/resources/components/lazy-frame.tsx", "/resources/components/read-toggle.tsx"]),
		);

		for (let { exportName, moduleUrl } of islands) {
			let load = CLIENT_MODULES[`../../..${moduleUrl}`];
			expect(load, `nothing the browser can load at ${moduleUrl}`).toBeDefined();

			let module = await load!();
			expect(Reflect.get(module as object, String(exportName))).toBeTypeOf("function");
		}
	});

	test("defers nothing at the end of the queue, and says the list has one", async () => {
		queued(null);

		let body = await (await get(routes.reading.href())).text();

		expect(body).not.toContain('"exportName":"LazyFrame"');
		expect(body).not.toContain("Older posts");
		expect(readsAs(body)).toContain("You have reached the end.");
	});

	test("hands the frame the two addresses that say where the reader is", async () => {
		queued("older-cursor");

		let body = await (await get(`${routes.reading.href()}?q=remix&show=unread`)).text();

		/** The page the frame holds, which the address bar carries once the reader is in it. */
		expect(body).toContain('"url":"/reading?q=remix&show=unread&cursor=older-cursor&from=2"');
		/** And this one, which it goes back to when they scroll above it: the queue itself. */
		expect(body).toContain('"parentUrl":"/reading?q=remix&show=unread"');
	});

	test("says a page below the first is a place of its own, and carries the narrowing", async () => {
		queued("deeper-cursor");

		let body = await (
			await get(`${routes.reading.href()}?q=remix&cursor=older-cursor&from=26&frame=older`)
		).text();

		expect(body).toContain('"parentUrl":"/reading?q=remix&cursor=older-cursor&from=26"');
		expect(body).toContain('"url":"/reading?q=remix&cursor=deeper-cursor&from=27"');
	});

	test("numbers the first page from its first row", async () => {
		queued("older-cursor");

		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain('<ol start="1"');
	});

	test("answers a frame with the rows alone, numbered on from the page above", async () => {
		queued("deeper-cursor");

		let response = await get(`${routes.reading.href()}?cursor=older-cursor&from=26&frame=older`);
		let body = await response.text();

		expect(response.status).toBe(200);
		/** A fragment is written into a document that already has one, so it opens none. */
		expect(body).not.toContain("<!DOCTYPE");
		expect(body).not.toContain("<html");
		expect(body).not.toContain("Mark all read");
		expect(body).toContain('<ol start="26"');
		/** And it ends with the frame that carries the reader on from it. */
		expect(body).toContain(`"src":"/reading?cursor=deeper-cursor&from=27&frame=older"`);
	});

	test("numbers from one for a cursor followed with nothing saying how far in it is", async () => {
		queued("older-cursor");

		let body = await (await get(`${routes.reading.href()}?cursor=older-cursor`)).text();

		/** A cursor records where to read from and not how far in that is, so it says nothing. */
		expect(body).not.toContain("<ol start=");
		/** And the page below it cannot be numbered either, so it is asked for without one. */
		expect(body).toContain(`"src":"/reading?cursor=older-cursor&frame=older"`);
	});

	test("stops a frame whose cursor the store no longer decodes, rather than starting again", async () => {
		store.readingQueue.mockImplementation(
			async (options: UserStore.ReadingQueueOptions): Promise<UserStore.TimelineResult> => {
				if (options.cursor) return { ok: false, reason: "bad-cursor" };
				return {
					ok: true,
					items: [item({ id: "item-1" })],
					feeds: FEEDS,
					cursors: { next: null, prev: null },
				};
			},
		);

		let body = await (await get(`${routes.reading.href()}?cursor=rotten&frame=older`)).text();

		expect(body).toContain("That page is no longer there.");
		expect(body).toContain("Back to the newest");
		/** Rather than the newest page appearing again underneath itself. */
		expect(body).not.toContain("<ol");
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

	test("offers the sweep in the header, beside the name of the page it clears", async () => {
		queued();

		let body = await (await get(routes.reading.href())).text();

		let header = body.slice(body.indexOf("<h1"), body.indexOf("<ol"));
		expect(header).toContain("Mark everything read");
		/** The words are there for a wide row and the mark stands for them on a narrow one. */
		expect(header).toContain("lucide-check-check");
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

		expect(body).toContain("Nothing here yet");
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

describe("searching the queue", () => {
	/** A page of the queue with a post on it, whichever narrowing is asking for it. */
	function queued(cursors: { next: string | null; prev: string | null }) {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1", title: "Markdown and the web" })],
			feeds: FEEDS,
			cursors,
		});
	}

	test("hands the store the words exactly as they were typed", async () => {
		await get(`${routes.reading.href()}?q=${encodeURIComponent("  markdown  and  the  web  ")}`);

		expect(store.readingQueue).toHaveBeenCalledWith({
			cursor: null,
			readState: "all",
			query: "  markdown  and  the  web  ",
			limit: 25,
		});
	});

	test("says in the heading what the queue was narrowed to", async () => {
		queued({ next: null, prev: null });

		let body = await (await get(`${routes.reading.href()}?q=remix`)).text();

		expect(readsAs(body)).toContain("Reading about “remix”");
	});

	test("prints what a reader searched for as text, whatever they typed", async () => {
		queued({ next: null, prev: null });

		let query = '<img src=x onerror="alert(1)">';
		let body = await (await get(`${routes.reading.href()}?q=${encodeURIComponent(query)}`)).text();

		/**
		 * The heading prints the query as a text node, which the renderer escapes, so the
		 * reader is shown the characters they typed and the document gains no element.
		 */
		expect(body).toContain("&lt;img src=x onerror=");
		expect(body).not.toContain("<img src=x");
		/** Nor does putting it back in the search box open the attribute holding it. */
		expect(body).not.toMatch(/value="[^"]*"[^>]*onerror/);
	});

	test("composes the words with the filter, which is the whole point of one surface", async () => {
		queued({ next: null, prev: null });

		let body = await (await get(`${routes.reading.href()}?q=remix&show=unread`)).text();

		expect(store.readingQueue).toHaveBeenCalledWith({
			cursor: null,
			readState: "unread",
			query: "remix",
			limit: 25,
		});

		/** Every filter keeps the words, so choosing one never drops the other. */
		expect(body).toContain('href="/reading?q=remix"');
		expect(body).toContain('href="/reading?q=remix&amp;show=read"');
		expect(body).toMatch(/<a href="\/reading\?q=remix&amp;show=unread" aria-current="page"/);
	});

	test("carries both narrowings through the links that page the queue", async () => {
		queued({ next: "older-cursor", prev: "newer-cursor" });

		let body = await (await get(`${routes.reading.href()}?q=remix&show=unread`)).text();

		expect(body).toContain(
			'href="/reading?q=remix&amp;show=unread&amp;cursor=older-cursor&amp;from=2"',
		);
		expect(body).toContain('href="/reading?q=remix&amp;show=unread&amp;cursor=newer-cursor"');
		/** And the piece the frame fetches under the reader is the same page. */
		expect(body).toContain(
			'"src":"/reading?q=remix&show=unread&cursor=older-cursor&from=2&frame=older"',
		);
	});

	test("narrows nothing for a box holding only space", async () => {
		queued({ next: null, prev: null });

		let body = await (await get(`${routes.reading.href()}?q=${encodeURIComponent("   ")}`)).text();

		/** The heading says the queue rather than claiming a search nobody made. */
		expect(readsAs(body)).toContain("Reading");
		expect(readsAs(body)).not.toContain("Reading about");
		expect(body).toContain('href="/reading?show=unread"');
	});

	test("says of an empty result which of the two narrowings came up empty", async () => {
		store.countFeeds.mockResolvedValue(1);

		let all = await (await get(`${routes.reading.href()}?q=remix`)).text();
		let unread = await (await get(`${routes.reading.href()}?q=remix&show=unread`)).text();
		let read = await (await get(`${routes.reading.href()}?q=remix&show=read`)).text();

		expect(all).toContain("Nothing matches");
		expect(readsAs(all)).toContain("No post in any feed you follow contains those words.");

		expect(unread).toContain("Nothing unread matches");
		expect(read).toContain("Nothing read matches");

		/** A search that found nothing never reads as a queue that holds nothing. */
		for (let body of [all, unread, read]) expect(body).not.toContain("Nothing here yet");
	});

	test("puts the words back in the box, so refining a search edits them", async () => {
		queued({ next: null, prev: null });

		let body = await (await get(`${routes.reading.href()}?q=remix`)).text();

		expect(body).toContain('name="q"');
		expect(body).toContain('value="remix"');
		/** The box is keyed on the page it was drawn for, so a stale query never survives. */
		expect(body).toContain('data-rmx-key="sidebar-search:/reading?remix"');
	});

	test("submits the box to the queue itself, which is now the only list of posts", async () => {
		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain(`<form method="get" action="${routes.reading.href()}"`);
	});
});

describe("acting on every feed at once", () => {
	test("offers the sweep of every feed in the header, as a button rather than a link", async () => {
		let body = await (await get(routes.reading.href())).text();

		let form = body.match(new RegExp(`<form[^>]*action="${routes.feeds.refreshAll.href()}"[^>]*>`));
		expect(form?.[0]).toContain('method="post"');
		expect(body).toContain('aria-label="Check all"');
		/** The arrows a page is fetched again with stand for the words on a narrow row. */
		expect(body).toContain("lucide-refresh-cw");
		expect(body).not.toContain(`href="${routes.feeds.refreshAll.href()}"`);
	});

	test("offers one field to follow another feed, named without taking width to say so", async () => {
		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain(
			`<form id="follow-feed" method="post" action="${routes.feeds.follow.href()}"`,
		);
		expect(body).toContain('<label for="follow-feed-url"');
		expect(body).toContain("Feed or site address");
		expect(body).toContain('placeholder="Follow a feed or site…"');
		/** The return key sends it, so no submit takes room on the row. */
		expect(body).not.toContain('<button type="submit" form="follow-feed"');
	});

	test("carries the narrowing back with every form in the header", async () => {
		store.readingQueue.mockResolvedValue({
			ok: true,
			items: [item({ id: "item-1" })],
			feeds: FEEDS,
			cursors: { next: null, prev: null },
		});

		let body = await (await get(`${routes.reading.href()}?q=remix&show=unread`)).text();

		expect(body.match(/<input type="hidden" name="q" value="remix" \/>/g)).toHaveLength(3);
		expect(body.match(/<input type="hidden" name="show" value="unread" \/>/g)).toHaveLength(3);
	});

	test("reports what a sweep of every feed got through", async () => {
		store.countFeeds.mockResolvedValue(1);

		let body = await (await get(`${routes.reading.href()}?swept=4&fresh=2&failed=0`)).text();

		expect(readsAs(body)).toContain("Checked 4 feeds.");
		expect(readsAs(body)).toContain("2 feeds had new posts.");
		expect(readsAs(body)).not.toContain("could not be reached");
	});

	test("says nothing was new rather than counting to zero, and names what failed", async () => {
		store.countFeeds.mockResolvedValue(1);

		let quiet = await (await get(`${routes.reading.href()}?swept=3&fresh=0&failed=0`)).text();
		let broken = await (await get(`${routes.reading.href()}?swept=3&fresh=1&failed=2`)).text();

		expect(readsAs(quiet)).toContain("No feed had anything new.");
		expect(readsAs(broken)).toContain("2 feeds could not be reached.");
	});

	test("reports nothing on an ordinary visit, or on a value that is not a count", async () => {
		store.countFeeds.mockResolvedValue(1);

		let plain = await (await get(routes.reading.href())).text();
		let bogus = await (await get(`${routes.reading.href()}?swept=lots`)).text();

		for (let body of [plain, bogus]) expect(readsAs(body)).not.toContain("Checked");
	});
});

describe("the sidebar beside the queue", () => {
	test("lists every feed the reader follows, with nothing capping the list", async () => {
		store.listFeeds.mockResolvedValue(
			Array.from({ length: 40 }, (_unused, index) => ({
				id: `feed-${index}`,
				feedUrl: `https://example.com/${index}.xml`,
				siteUrl: null,
				title: `Feed ${String(index).padStart(2, "0")}`,
				description: null,
				imageUrl: null,
				lastFetchedAt: null,
				lastStatus: null,
				failureCount: 0,
				unreadCount: index,
			})),
		);

		let body = await (await get(routes.reading.href())).text();

		expect(body).toContain(`href="${routes.feed.href({ feed: "feed-0" })}"`);
		expect(body).toContain(`href="${routes.feed.href({ feed: "feed-39" })}"`);
		expect(body).toContain("Feed 39");
	});
});
