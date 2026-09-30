/**
 * Reads the Atom and JSON Feed documents back through the parsers that read everybody
 * else's feeds, so the served content type, WebSub advertisement, item links, and each
 * stream's content are checked by what a feed reader actually sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Atom } from "@sdxc/atom";
import { JSONFeed } from "@sdxc/json-feed";
import { succeeded } from "@sdxc/result";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { ArticlePost } from "~/app/repositories/posts/article";
import { LikePost } from "~/app/repositories/posts/like";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";
const SLUG = `syndication-${crypto.randomUUID().slice(0, 8)}`;
const ARTICLE_URL = `${ORIGIN}/articles/${SLUG}`;
const BOOKMARK_URL = `https://example.com/saved-${SLUG}`;
const FUTURE_SLUG = `${SLUG}-future`;

/** The value of a result the test expects to have succeeded, failing the test otherwise. */
function ok<T, E extends Error>(result: Result<T, E>): T {
	succeeded(result);
	return result.data;
}

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

/** Fetches one path through the real router. */
async function fetchPath(path: string) {
	let response = await createApplication(environment()).fetch(new Request(new URL(path, ORIGIN)));
	expect(response.status).toBe(200);
	return response;
}

let articleId = "";

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);
	let article = await ArticlePost.create(db, {
		author_id: author,
		published_at: "2026-09-01T12:00:00.000Z",
		meta: { slug: SLUG, title: "Syndicated", locale: "en", content: "Body." },
	});
	articleId = article?.id ?? "";
	await ArticlePost.create(db, {
		author_id: author,
		published_at: "2999-01-01T00:00:00.000Z",
		meta: { slug: FUTURE_SLUG, title: "Not yet", locale: "en", content: "Later." },
	});
	await LikePost.create(db, {
		author_id: author,
		published_at: "2026-09-02T12:00:00.000Z",
		meta: { url: BOOKMARK_URL, title: "A saved page" },
	});
});

describe("the Atom feed", () => {
	test("serves an Atom document advertising its hub", async () => {
		let response = await fetchPath("/atom.xml");
		expect(response.headers.get("content-type")).toBe("application/atom+xml; charset=utf-8");
		expect(response.headers.get("link")).toContain(`<${ORIGIN}/atom.xml>; rel="self"`);

		let atom = ok(Atom.parse(await response.text()));
		let links = [atom.feed.link ?? []].flat();
		expect(links).toContainEqual({
			rel: "self",
			href: `${ORIGIN}/atom.xml`,
			type: "application/atom+xml",
		});
		expect(links.some((link) => link.rel === "hub")).toBe(true);
	});

	test("carries published items with absolute links and IRI ids", async () => {
		let atom = ok(Atom.parse(await (await fetchPath("/atom.xml")).text()));

		let article = atom.entries.find((entry) => entry.id === `urn:uuid:${articleId}`);
		expect(article?.title).toBe("Syndicated");
		expect(article?.link).toEqual({ rel: "alternate", href: ARTICLE_URL });
		expect(article?.published).toBe("2026-09-01T12:00:00.000Z");

		let hrefs = atom.entries.flatMap((entry) => [entry.link ?? []].flat().map((l) => l.href));
		expect(hrefs).toContain(BOOKMARK_URL);
		expect(hrefs.some((href) => href.includes(FUTURE_SLUG))).toBe(false);
	});
});

describe("the JSON Feed", () => {
	test("serves a JSON Feed document advertising its hub", async () => {
		let response = await fetchPath("/feed.json");
		expect(response.headers.get("content-type")).toBe("application/feed+json; charset=utf-8");
		expect(response.headers.get("link")).toContain(`<${ORIGIN}/feed.json>; rel="self"`);

		let feed = ok(JSONFeed.parse(await response.text()));
		expect(feed.feed.feedUrl).toBe(`${ORIGIN}/feed.json`);
		expect(feed.feed.hubs?.[0]?.type).toBe("WebSub");
	});

	test("carries published items newest first", async () => {
		let feed = ok(JSONFeed.parse(await (await fetchPath("/feed.json")).text()));

		let urls = feed.items.map((item) => item.url);
		expect(urls.indexOf(BOOKMARK_URL)).toBeLessThan(urls.indexOf(ARTICLE_URL));
		expect(urls.some((url) => url?.includes(FUTURE_SLUG))).toBe(false);

		let article = feed.items.find((item) => item.id === articleId);
		expect(article?.title).toBe("Syndicated");
		expect(article?.contentText).toBe(ARTICLE_URL);
	});
});

describe("the per-type feeds", () => {
	test("the articles feeds carry articles and leave bookmarks out", async () => {
		let atom = ok(Atom.parse(await (await fetchPath("/articles.atom")).text()));
		let hrefs = atom.entries.flatMap((entry) => [entry.link ?? []].flat().map((l) => l.href));
		expect(hrefs).toContain(ARTICLE_URL);
		expect(hrefs).not.toContain(BOOKMARK_URL);
		expect(atom.feed.title).toBe("Articles — Sergio Xalambrí");

		let feed = ok(JSONFeed.parse(await (await fetchPath("/articles.json")).text()));
		expect(feed.items.map((item) => item.url)).toContain(ARTICLE_URL);
		expect(feed.items.map((item) => item.url)).not.toContain(BOOKMARK_URL);
		expect(feed.feed.feedUrl).toBe(`${ORIGIN}/articles.json`);
		expect(feed.feed.homePageUrl).toBe(`${ORIGIN}/articles`);
	});

	test("the bookmarks feeds carry bookmarks and leave articles out", async () => {
		let atom = ok(Atom.parse(await (await fetchPath("/bookmarks.atom")).text()));
		let hrefs = atom.entries.flatMap((entry) => [entry.link ?? []].flat().map((l) => l.href));
		expect(hrefs).toContain(BOOKMARK_URL);
		expect(hrefs).not.toContain(ARTICLE_URL);

		let feed = ok(JSONFeed.parse(await (await fetchPath("/bookmarks.json")).text()));
		expect(feed.items.map((item) => item.url)).toEqual([BOOKMARK_URL]);
	});

	test("the tutorials feeds answer in every format", async () => {
		for (let path of ["/tutorials.rss", "/tutorials.atom", "/tutorials.json"]) {
			let response = await fetchPath(path);
			expect(response.headers.get("link")).toContain(`<${ORIGIN}${path}>; rel="self"`);
		}
	});

	test("the RSS feeds keep serving their items", async () => {
		let body = await (await fetchPath("/articles.rss")).text();
		expect(body).toContain(ARTICLE_URL);
		expect(body).not.toContain(BOOKMARK_URL);
	});
});
