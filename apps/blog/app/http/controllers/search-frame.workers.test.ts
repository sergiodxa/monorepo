/**
 * Drives the search dialog's frame endpoint and the pages that embed it through the real
 * router inside workerd, against the D1 binding the app's migrations build, so the dialog
 * every public page carries is checked with the search index production runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vite-plus/test";

import { createWebRouter } from "~/app/initializers/router";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

const ORIGIN = "https://blog.test";

/** A word no other test file writes, so this file's matches are exactly its own posts. */
const TOKEN = `zf${generateUUID().replaceAll("-", "").slice(0, 10)}`;

const PAST = "2026-03-01T12:00:00.000Z";

/** A word only the articles without a matching summary carry, in their bodies alone. */
const BODY_WORD = `zb${generateUUID().replaceAll("-", "").slice(0, 10)}`;

/** A word one article and two tutorials carry, so its matches span two kinds. */
const KIND_WORD = `zk${generateUUID().replaceAll("-", "").slice(0, 10)}`;

/** How many articles match {@link TOKEN}, more than the dialog lists. */
const ARTICLE_COUNT = 8;

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

/** Requests one URL through the real router. */
function get(path: string): Promise<Response> {
	return createWebRouter(environment()).fetch(new Request(new URL(path, ORIGIN)));
}

/** How many times `needle` occurs in `haystack`. */
function count(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);

	for (let index = 1; index <= ARTICLE_COUNT; index++) {
		unwrap(
			await bindModels(db).articles.create({
				author_id: author,
				published_at: PAST,
				meta: {
					slug: `${TOKEN}-article-${index}`,
					title: `${TOKEN} article ${index}`,
					locale: "en",
					content: "Body",
					excerpt: `Notes on part ${index}.`,
				},
			}),
		);
	}

	unwrap(
		await bindModels(db).articles.create({
			author_id: author,
			published_at: PAST,
			meta: {
				slug: `${BODY_WORD}-unsummarized`,
				title: "An article with no summary",
				locale: "en",
				content: `# Setup\n\nFirst install **the tools**, then read [the ${BODY_WORD} guide](https://example.com).`,
			},
		}),
	);

	unwrap(
		await bindModels(db).articles.create({
			author_id: author,
			published_at: PAST,
			meta: {
				slug: `${BODY_WORD}-summarized`,
				title: "An article whose summary misses",
				locale: "en",
				excerpt: "A summary about something else.",
				content: `Long before the point, the body finally says ${BODY_WORD} near the end.`,
			},
		}),
	);

	unwrap(
		await bindModels(db).articles.create({
			author_id: author,
			published_at: PAST,
			meta: {
				slug: `${KIND_WORD}-article`,
				title: `${KIND_WORD} article`,
				locale: "en",
				content: "Body",
			},
		}),
	);

	for (let index = 1; index <= 2; index++) {
		unwrap(
			await bindModels(db).tutorials.create({
				author_id: author,
				published_at: PAST,
				meta: {
					slug: `${KIND_WORD}-tutorial-${index}`,
					title: `${KIND_WORD} tutorial ${index}`,
					excerpt: "A tutorial.",
					content: "Body",
				},
			}),
		);
	}
});

describe("GET /frames/search", () => {
	test("renders the top six matches with the matched words marked and a link to all of them", async () => {
		let response = await get(`/frames/search?q=${TOKEN}`);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(count(html, `href="/articles/${TOKEN}-article-`)).toBe(6);
		expect(html).toMatch(new RegExp(`<mark[^>]*>${TOKEN}</mark> article`));
		expect(html).toContain(`Top 6 of ${ARTICLE_COUNT} results`);
		expect(html).toContain(`href="/search?q=${TOKEN}"`);
		expect(html).toContain(`See all ${ARTICLE_COUNT} results →`);
	});

	test("keeps the box a GET form to the full results page, holding the text asked for", async () => {
		let html = await (await get(`/frames/search?q=${TOKEN}`)).text();

		expect(html).toContain('<form method="get" action="/search"');
		expect(html).toMatch(
			new RegExp(`<input type="search" id="site-search-q" name="q"[^>]*value="${TOKEN}"`),
		);
		expect(html).toContain('"moduleUrl":"/assets/resources/components/search-box.js"');
	});

	test("renders the box alone for a blank query, its status empty", async () => {
		let response = await get("/frames/search");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('name="q"');
		expect(html).toMatch(/<p role="status"[^>]*><\/p>/);
		expect(html).not.toContain("<ol");
		expect(html).not.toContain("See all");
	});

	test("describes a match from its body as plain text when its summary does not hold it", async () => {
		let html = await (await get(`/frames/search?q=${BODY_WORD}`)).text();
		let rows = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));

		expect(count(rows, "<li")).toBe(2);
		expect(count(rows, `<mark>${BODY_WORD}</mark>`)).toBe(2);
		expect(rows).toContain("the tools");
		expect(rows).not.toContain("**");
		expect(rows).not.toContain("](");
		expect(rows).not.toContain("A summary about something else.");
	});

	test("answers 200 with the reason for text that cannot run, never an error page", async () => {
		let response = await get(`/frames/search?q=${encodeURIComponent(`-${TOKEN}`)}`);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("A search needs at least one term to find.");
		expect(html).not.toContain("<html");
	});

	test("says so when nothing matches", async () => {
		let html = await (await get(`/frames/search?q=${TOKEN}nothing`)).text();

		expect(html).toContain("No posts match");
		expect(html).not.toContain("See all");
	});

	test("is cached like the search page and kept out of search indexes", async () => {
		let response = await get(`/frames/search?q=${TOKEN}`);

		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=0, s-maxage=60, must-revalidate",
		);
		expect(response.headers.get("x-robots-tag")).toBe("noindex");
	});
});

describe("GET /frames/search kind tabs", () => {
	/** The tab links the frame rendered, by the kind each narrows to. */
	function tabs(html: string): Array<string> {
		return Array.from(html.matchAll(/data-search-kind="([a-z]*)"/g), (found) => found[1] ?? "");
	}

	test("lists All then each kind with matches, each counted and linked to /search narrowed to it", async () => {
		let html = await (await get(`/frames/search?q=${KIND_WORD}`)).text();

		expect(tabs(html)).toEqual(["", "article", "tutorial"]);
		expect(html).toMatch(/aria-current="true"[^>]*>All<span[^>]*>3<\/span>/);
		expect(html).toMatch(/>Tutorials<span[^>]*>2<\/span>/);
		expect(html).toContain(`href="/search?q=${KIND_WORD}+kind%3Atutorial"`);
	});

	test("narrows the rows, the total and See all to the kind asked for", async () => {
		let html = await (await get(`/frames/search?q=${KIND_WORD}&kind=tutorial`)).text();

		expect(count(html, `href="/tutorials/${KIND_WORD}-tutorial-`)).toBe(2);
		expect(html).not.toContain(`href="/articles/${KIND_WORD}-article"`);
		expect(html).toMatch(/aria-current="true"[^>]*>Tutorials/);
		expect(html).toContain("Top matches");
	});

	test("falls back to All for a kind with no matches or one it does not know", async () => {
		for (let kind of ["glossary", "nonsense"]) {
			let html = await (await get(`/frames/search?q=${KIND_WORD}&kind=${kind}`)).text();

			expect(html).toMatch(/aria-current="true"[^>]*>All/);
			expect(count(html, `href="/tutorials/${KIND_WORD}-tutorial-`)).toBe(2);
			expect(html).toContain(`href="/articles/${KIND_WORD}-article"`);
		}
	});

	test("leaves See all out while every match is listed", async () => {
		let html = await (await get(`/frames/search?q=${KIND_WORD}`)).text();

		expect(html).not.toContain("See all");
	});

	test("shows no tabs while one kind holds every match", async () => {
		let html = await (await get(`/frames/search?q=${TOKEN}`)).text();

		expect(tabs(html)).toEqual([]);
	});
});

describe("every public page", () => {
	test.each([
		"/",
		"/articles",
		"/tutorials",
		"/glossary",
		"/search",
		`/articles/${TOKEN}-article-1`,
	])(
		"%s opens the search dialog from its navigation, with the search form inside",
		async (path) => {
			let html = await (await get(path)).text();
			let dialog = html.slice(html.indexOf("<dialog"), html.indexOf("</dialog>"));

			let trigger = html.match(/<a [^>]*data-search-trigger[^>]*>/)?.[0] ?? "";
			expect(trigger).toContain('href="/search"');
			expect(trigger).toContain('aria-label="Search"');
			expect(html).toContain('aria-keyshortcuts="Meta+K Control+K /"');
			expect(dialog).toContain('id="site-search"');
			expect(dialog).toContain('aria-label="Search"');
			expect(dialog).toContain('closedby="any"');
			expect(dialog).toContain('<form method="get" action="/search"');
			expect(dialog).toContain('id="site-search-q"');
			expect(html).not.toMatch(/<a[^>]*href="\/search"[^>]*>Search<\/a>/);
		},
	);

	test("the 404 page carries the dialog too", async () => {
		let response = await get("/nothing-is-here");
		let html = await response.text();

		expect(response.status).toBe(404);
		expect(html).toContain('<form method="get" action="/search"');
	});

	test("the search page keeps its own box apart from the dialog's, with one autofocus", async () => {
		let html = await (await get(`/search?q=${TOKEN}`)).text();

		expect(count(html, 'id="search-q"')).toBe(1);
		expect(count(html, 'id="site-search-q"')).toBe(1);
		expect(count(html, "autofocus")).toBe(1);
	});

	test("the search page focuses its own box only when it holds no query", async () => {
		let blank = await (await get("/search")).text();
		let searched = await (await get(`/search?q=${TOKEN}`)).text();

		expect(blank).toMatch(/<input[^>]*id="search-q"[^>]*autofocus/);
		expect(searched).not.toMatch(/<input[^>]*id="search-q"[^>]*autofocus/);
	});

	test("the search page opens its dialog on the same query, results already rendered", async () => {
		let html = await (await get(`/search?q=${TOKEN}`)).text();
		let dialog = html.slice(html.indexOf("<dialog"), html.indexOf("</dialog>"));

		expect(dialog).toMatch(new RegExp(`id="site-search-q"[^>]*value="${TOKEN}"`));
		expect(dialog).toContain(`Top 6 of ${ARTICLE_COUNT} results`);
		expect(html).toContain(`"src":"/frames/search?q=${TOKEN}"`);
	});

	test("every other page opens its dialog blank", async () => {
		let html = await (await get("/articles")).text();

		expect(html).toContain('"src":"/frames/search"');
		expect(html).toMatch(/id="site-search-q"[^>]*value=""/);
	});
});
