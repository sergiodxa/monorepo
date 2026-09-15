/**
 * Tests `GET /search`: the guard that keeps it to signed-in readers, the three things the
 * page can be saying — nothing searched for yet, nothing found, and these posts — the box
 * that holds on to what was typed, the links that walk a long result carrying the query
 * with them, a cursor the store no longer decodes, and a query made of markup, which the
 * page shows as words.
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

let { default: search } = await import("./search");

/** The two feeds the fixture posts come from, as the store carries them beside the items. */
const FEEDS: UserStore.FeedRef[] = [
	{ id: "feed-df", title: "Daring Fireball", siteUrl: "https://daringfireball.net" },
	{ id: "feed-rc", title: "Remix Changelog", siteUrl: null },
];

/** Builds a matching post, defaulting every field a test is not about. */
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

/** One page of results, with the cursors a test that is not about paging leaves off. */
function results(
	items: UserStore.Item[],
	cursors: { next: string | null; prev: string | null } = { next: null, prev: null },
): UserStore.TimelineResult {
	return { ok: true, items, feeds: FEEDS, cursors };
}

/** The URL of a search for `query`, built the way a reader's own form submission is. */
function searchFor(query: string, cursor?: string): string {
	let params = new URLSearchParams({ q: query });
	if (cursor) params.set("cursor", cursor);
	return `${routes.search.href()}?${params}`;
}

/** Dispatches a real `GET` to `path` as `viewer`, through the search controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.search, search);
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

describe("GET /search", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(searchFor("markdown"), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.searchPosts).not.toHaveBeenCalled();
	});

	test("invites a reader who has typed nothing to search, without asking the store", async () => {
		let response = await get(routes.search.href());
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Search your reading");
		expect(body).toContain("Type what you remember of a post's title or summary.");
		expect(body).not.toContain("Nothing matches");
		expect(store.searchPosts).not.toHaveBeenCalled();
	});

	test("reads a box holding only spaces as an empty one", async () => {
		let body = await (await get(searchFor("   "))).text();

		expect(body).toContain("Search your reading");
		expect(store.searchPosts).not.toHaveBeenCalled();
	});

	test("hands the store what was typed, exactly as it was typed", async () => {
		await get(searchFor("  markdown  and  the  web  "));

		expect(store.searchPosts).toHaveBeenCalledWith("  markdown  and  the  web  ", {
			cursor: null,
		});
	});

	test("renders each match with its feed, author and published date", async () => {
		store.searchPosts.mockResolvedValue(
			results([
				item({ id: "item-1", title: "Markdown and the web", author: "John Gruber" }),
				item({ id: "item-2", feedId: "feed-rc", title: "Release candidate two" }),
			]),
		);

		let response = await get(searchFor("markdown"));
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(readsAs(body)).toContain("Markdown and the web");
		expect(readsAs(body)).toContain("Release candidate two");
		expect(body).toContain("Daring Fireball");
		expect(body).toContain("Remix Changelog");
		expect(body).toContain("by John Gruber");
		expect(body).toContain("Published Jan 2, 2026");
	});

	test("counts the matches when the page it has is all of them", async () => {
		store.searchPosts.mockResolvedValue(results([item({ id: "item-1" }), item({ id: "item-2" })]));

		let body = await (await get(searchFor("markdown"))).text();

		expect(body).toContain("2 posts match “markdown”.");
	});

	test("counts one match in the singular", async () => {
		store.searchPosts.mockResolvedValue(results([item({ id: "item-1" })]));

		let body = await (await get(searchFor("markdown"))).text();

		expect(body).toContain("1 post matches “markdown”.");
	});

	test("claims no total for a result that runs past the page it was given", async () => {
		store.searchPosts.mockResolvedValue(
			results([item({ id: "item-1", title: "Markdown and the web" })], {
				next: "older-cursor",
				prev: null,
			}),
		);

		let body = await (await get(searchFor("markdown"))).text();

		expect(readsAs(body)).toContain("Markdown and the web");
		expect(body).not.toContain("1 post matches");
		expect(body).not.toContain("posts match");
	});

	test("says nothing matched, which is not the same as nothing searched for", async () => {
		let body = await (await get(searchFor("markdown"))).text();

		expect(body).toContain("Nothing matches");
		expect(body).toContain("No post in any feed you follow contains those words.");
		expect(body).not.toContain("Search your reading");
	});

	test("puts what was typed back in the box", async () => {
		let body = await (await get(searchFor("markdown"))).text();

		expect(body).toContain('value="markdown"');
		expect(body).toContain('name="q"');
		expect(body).toContain("Search your posts");
	});

	test("offers a result read and unread alike as a state, not a step", async () => {
		store.searchPosts.mockResolvedValue(
			results([item({ id: "item-1" }), item({ id: "item-2", readAt: Date.UTC(2026, 0, 3) })]),
		);

		let body = await (await get(searchFor("markdown"))).text();

		/** The ring the toggling mark draws, ticked for a read result, and the arrow a completing one would. */
		expect(body).toContain("lucide-circle-check");
		expect(body).not.toContain("lucide-undo");
	});

	test("walks a long result with hrefs carrying both the cursor and the query", async () => {
		store.searchPosts.mockResolvedValue(
			results([item({ id: "item-1" })], { next: "older-cursor", prev: "newer-cursor" }),
		);

		let body = await (await get(searchFor("markdown"))).text();

		expect(body).toContain('href="/search?q=markdown&amp;cursor=older-cursor"');
		expect(body).toContain('href="/search?q=markdown&amp;cursor=newer-cursor"');
		expect(body).toContain("Older posts");
		expect(body).toContain("Newer posts");
	});

	test("reads the cursor off the query string", async () => {
		await get(searchFor("markdown", "page-2"));

		expect(store.searchPosts).toHaveBeenCalledWith("markdown", { cursor: "page-2" });
	});

	test("answers a cursor the store cannot decode with the first page and a note", async () => {
		store.searchPosts.mockImplementation(
			async (
				_query: string,
				options: UserStore.TimelineOptions,
			): Promise<UserStore.TimelineResult> => {
				if (options.cursor) return { ok: false, reason: "bad-cursor" };
				return results([item({ id: "item-1", title: "Markdown and the web" })]);
			},
		);

		let response = await get(searchFor("markdown", "rotten"));
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("That page of posts is no longer there.");
		expect(body).toContain("Back to the newest");
		/** Starting over keeps the search, rather than dropping the reader on an empty box. */
		expect(body).toContain('href="/search?q=markdown"');
		expect(readsAs(body)).toContain("Markdown and the web");
	});

	test("shows a query made of markup as the words it is", async () => {
		let query = '<script>alert("pwned")</script>';
		store.searchPosts.mockResolvedValue(results([item({ id: "item-1", title: "A post" })]));

		let body = await (await get(searchFor(query))).text();

		expect(store.searchPosts).toHaveBeenCalledWith(query, { cursor: null });
		/** Neither the count that echoes it nor the box that holds it opens an element. */
		expect(body).not.toContain("<script>alert(");
		expect(body).toContain("&lt;script&gt;alert(");
		expect(body).toContain("&quot;pwned&quot;");
	});
});
