/**
 * Tests `GET /reading/:feed/:item`: that the post is rendered from the reader's own row
 * before anything external is asked for, that opening it is the only thing that reaches a
 * publisher, that every way the fetch can fail leaves the excerpt and the link standing
 * and answers `200`, and that neither a tier without extraction nor the flag turned off
 * fetches anything at all.
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
import type { Article } from "~/app/lib/article";
import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { restoreFlags, serveFlags } from "~/app/lib/test/flags";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

/** The subscription the fixture post came from, which the page names above the article. */
const FEED_ID = "feed-df";

/** The post the fixture opens, which every path in this file addresses. */
const ITEM_ID = "item-1";

/** What the reader already had, which an extraction has to beat to be worth anything. */
const SUMMARY = "The opening sentence of the post, as the feed published it.";

let store = createUserStoreDouble();
vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

/**
 * Every reach for an article the page makes. Held as one instance each for the life of
 * the file, since the module under test binds what the mock hands it at import.
 */
const peek = vi.fn<(url: string) => Promise<Article | null>>();
const read = vi.fn<(post: { url: string; summary: string | null }) => Promise<Article>>();

vi.doMock("~/app/lib/article", () => ({ peekArticle: peek, readArticle: read }));

let { default: post } = await import("./post");

/** An entry holding an article, which is what a successful extraction writes. */
function extracted(
	html = "<p>The whole of the article, far longer than the excerpt.</p>",
): Article {
	return { outcome: "extracted", html, title: "A post", byline: "Ada", storedAt: Date.now() };
}

/** An entry holding no article, which is what every failing outcome writes. */
function nothing(outcome: Article["outcome"]): Article {
	return { outcome, html: null, title: null, byline: null, storedAt: Date.now() };
}

/** The feed the post came from, as the store answers it beside the post. */
function feed(): UserStore.FeedSummary {
	return {
		id: FEED_ID,
		feedId: "catalog-df",
		feedUrl: "https://daringfireball.net/feed.xml",
		siteUrl: "https://daringfireball.net",
		title: "Daring Fireball",
		description: null,
		imageUrl: null,
		velocity: "article",
		unreadCount: 0,
		folderId: null,
		folderTitle: null,
		pinnedAt: null,
		postsPerDay: null,
		notify: false,
	};
}

/** The post the store answers with, and what the reader's tier allows doing to it. */
function opened(overrides: Partial<UserStore.OpenedPost> = {}): UserStore.OpenedPost {
	return {
		item: {
			id: ITEM_ID,
			feedId: FEED_ID,
			title: "Markdown and the web",
			url: "https://daringfireball.net/post",
			summary: SUMMARY,
			author: "John Gruber",
			publishedAt: Date.UTC(2026, 0, 2, 12),
			readAt: null,
			savedAt: null,
			flaggedAt: null,
			tags: [],
		},
		feed: feed(),
		/** The paid tier, since extraction is what that tier is bought for. */
		fullText: true,
		...overrides,
	};
}

/** Dispatches a real `GET` to `path` as `viewer`, through the post controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.post, post);
	return fetchRoute(router, path);
}

/** The post's own address, which is what a row in the timeline links to. */
const PATH = routes.post.href({ feed: FEED_ID, item: ITEM_ID });

/** The copy a reader sees, with the markup carrying it stripped out. */
function readsAs(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

beforeEach(async () => {
	store = createUserStoreDouble();
	peek.mockReset();
	peek.mockResolvedValue(null);
	read.mockReset();
	read.mockResolvedValue(extracted());
	await restoreFlags();
});

describe("GET /reading/:feed/:item", () => {
	test("sends an anonymous visitor to sign in rather than to a publisher", async () => {
		let response = await get(PATH, null);

		expect(response.status).toBe(303);
		expect(read).not.toHaveBeenCalled();
	});

	test("renders the post from the reader's own row, and the article under it", async () => {
		store.openPost.mockResolvedValue(opened());
		peek.mockResolvedValue(extracted());

		let response = await get(PATH);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Markdown and the web");
		expect(readsAs(body)).toContain(SUMMARY);
		expect(body).toContain('href="https://daringfireball.net/post"');
		expect(readsAs(body)).toContain("The whole of the article");
	});

	test("carries a policy that lets an article load images and do nothing else", async () => {
		store.openPost.mockResolvedValue(opened());

		let response = await get(PATH);
		let policy = response.headers.get("content-security-policy") ?? "";

		expect(policy).toContain("default-src 'none'");
		expect(policy).toContain("img-src https:");
		expect(policy).toContain("frame-ancestors 'none'");
	});

	test("answers a post this reader does not hold with the not-found page", async () => {
		store.openPost.mockResolvedValue(null);

		let response = await get(PATH);

		expect(response.status).toBe(404);
		expect(readsAs(await response.text())).toContain("That post is not here");
		expect(read).not.toHaveBeenCalled();
	});

	test("answers a post addressed under the wrong feed with the not-found page", async () => {
		store.openPost.mockResolvedValue(opened());

		let response = await get(routes.post.href({ feed: "feed-other", item: ITEM_ID }));

		expect(response.status).toBe(404);
		expect(read).not.toHaveBeenCalled();
	});

	test("tells a reader whose plan does not carry extraction, and fetches nothing", async () => {
		store.openPost.mockResolvedValue(opened({ fullText: false }));

		let response = await get(PATH);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(readsAs(body)).toContain("part of the paid plan");
		expect(readsAs(body)).toContain(SUMMARY);
		expect(body).toContain('href="https://daringfireball.net/post"');
		expect(peek).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
	});

	test("fetches nothing at all with the flag turned off", async () => {
		await serveFlags({ "article-extraction": false });
		store.openPost.mockResolvedValue(opened());

		let response = await get(PATH);

		expect(response.status).toBe(200);
		expect(peek).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
	});

	test("fetches nothing for a post whose feed gave it no address", async () => {
		store.openPost.mockResolvedValue(opened({ item: { ...opened().item, url: null } }));

		let response = await get(PATH);

		expect(response.status).toBe(200);
		expect(peek).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
	});

	/**
	 * The page is answered from the reader's own row and the article arrives in a frame, so
	 * a miss on the shared cache costs the reader nothing in front of their page.
	 */
	test("leaves the article to a frame when the shared cache holds nothing", async () => {
		store.openPost.mockResolvedValue(opened());

		let response = await get(PATH);
		let body = await response.text();

		expect(readsAs(body)).toContain("Fetching the article");
		expect(body).toContain(`${PATH}?frame=article`);
		expect(read).not.toHaveBeenCalled();
	});
});

describe("when the page could not be read", () => {
	test.each([
		["refused", "This site does not allow reading here."],
		["timeout", "This page took too long to read."],
		["empty", "There is nothing to read here."],
	] as const)("renders the excerpt, the link and %s, and answers 200", async (outcome, copy) => {
		store.openPost.mockResolvedValue(opened());
		peek.mockResolvedValue(nothing(outcome));

		let response = await get(PATH);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(readsAs(body)).toContain(copy);
		expect(readsAs(body)).toContain(SUMMARY);
		expect(body).toContain('href="https://daringfireball.net/post"');
	});
});

describe("the article frame", () => {
	test("answers with the article alone, and is the only path that extracts", async () => {
		store.openPost.mockResolvedValue(opened());

		let response = await get(`${PATH}?frame=article`);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(readsAs(body)).toContain("The whole of the article");
		expect(body).not.toContain("Markdown and the web");
		expect(read).toHaveBeenCalledWith({ url: "https://daringfireball.net/post", summary: SUMMARY });
	});
});
