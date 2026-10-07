/**
 * Drives `/search` and the MCP `search_posts` tool through the real router inside workerd,
 * against the D1 binding the app's migrations build, so the FTS5 index, its triggers and
 * the page's paging headers are checked the way production runs them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { parseLinkHeader } from "@sdxc/pagination";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";

/** A word no other test file writes, so this file's matches are exactly its own posts. */
const TOKEN = `zq${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

const PAST = "2026-03-01T12:00:00.000Z";

/** Fields these tests read off an MCP response body. */
interface McpBody {
	result?: { content?: Array<{ text?: string }>; isError?: boolean };
	error?: { code?: number };
}

/** What `search_posts` answers, as the tool serializes it. */
interface SearchOutput {
	query: string;
	count: number;
	results: Array<Record<string, unknown> & { slug: string }>;
}

/** Reads a tool call's JSON text back. */
function outputOf(body: McpBody): SearchOutput {
	return JSON.parse(body.result?.content?.[0]?.text ?? "{}") as SearchOutput;
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

/** Requests one page through the real router. */
function get(path: string): Promise<Response> {
	return createApplication(environment()).fetch(new Request(new URL(path, ORIGIN)));
}

/** Calls the `search_posts` tool through the real router, as an MCP client would. */
async function searchPosts(args: Record<string, unknown>): Promise<McpBody> {
	let response = await createApplication(environment()).fetch(
		new Request(new URL("/mcp", ORIGIN), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
				"Mcp-Method": "tools/call",
				"Mcp-Name": "search_posts",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: {
					name: "search_posts",
					arguments: args,
					_meta: {
						[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
						[MetaKey.ClientCapabilities]: {},
					},
				},
			}),
		}),
	);
	return (await response.json()) as McpBody;
}

/** The `href` of each `Link` relation, keyed by relation. */
function linksOf(response: Response): Record<string, URL> {
	let links: Record<string, URL> = {};
	for (let link of parseLinkHeader(response.headers.get("Link"))) {
		for (let rel of link.rels) links[rel] = new URL(link.target, ORIGIN);
	}
	return links;
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);

	for (let index = 1; index <= 3; index++) {
		await ArticlePost.create(db, {
			author_id: author,
			published_at: PAST,
			meta: {
				slug: `${TOKEN}-article-${index}`,
				title: `${TOKEN} article ${index}`,
				locale: "en",
				content: "Body",
				excerpt: `Notes on part ${index}.`,
			},
		});
	}

	await TutorialPost.create(db, {
		author_id: author,
		published_at: PAST,
		meta: {
			slug: `${TOKEN}-tutorial`,
			title: "A tutorial on something else",
			excerpt: `This one only mentions ${TOKEN} <b>in passing</b>.`,
			content: `A body that mentions ${TOKEN} once.`,
			tags: ["remix"],
		},
	});

	await GlossaryPost.create(db, {
		author_id: author,
		meta: { slug: `${TOKEN}-term`, term: "Term", definition: `Defined by ${TOKEN}.` },
	});

	await ArticlePost.create(db, {
		author_id: author,
		published_at: "2099-01-01T00:00:00.000Z",
		meta: {
			slug: `${TOKEN}-preview`,
			title: `${TOKEN} preview`,
			locale: "en",
			content: "Body",
		},
	});
});

describe("GET /search", () => {
	test("renders the form alone for a blank box", async () => {
		let response = await get("/search");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('<form method="get" action="/search"');
		expect(html).toContain('name="q"');
		expect(html).not.toContain('aria-label="Search results"');
	});

	test("folds the search tips under the field, one definition list of syntax chips", async () => {
		let html = await (await get("/search")).text();
		let tips = html.slice(html.indexOf("<details"), html.indexOf("</details>"));

		expect(tips).toMatch(/<summary[^>]*>[\s\S]*Search tips<\/summary>/);
		expect(tips).not.toMatch(/<details[^>]* open/);
		expect(tips.match(/<dt>/g)).toHaveLength(8);
		expect(tips).toMatch(/<code[^>]*>tag:remix<\/code>/);
	});

	test("renders published matches with the matched words marked, previews left out", async () => {
		let response = await get(`/search?q=${TOKEN}`);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Total-Count")).toBe("5");
		expect(html).toContain(`<mark`);
		expect(html).toMatch(new RegExp(`<mark[^>]*>${TOKEN}</mark> article 1`));
		expect(html).toContain(`href="/articles/${TOKEN}-article-1"`);
		expect(html).toContain(`href="/glossary#${TOKEN}-term"`);
		expect(html).toContain("&lt;b&gt;in passing&lt;/b&gt;");
		expect(html).not.toContain(`${TOKEN}-preview`);
	});

	test("ranks a title match above a body match", async () => {
		let html = await (await get(`/search?q=${TOKEN}`)).text();

		expect(html.indexOf(`${TOKEN}-article-1`)).toBeLessThan(html.indexOf(`${TOKEN}-tutorial`));
	});

	test("pages with the query carried into every Link and pager URL", async () => {
		let response = await get(`/search?q=${TOKEN}&perPage=2&page=2`);
		let html = await response.text();
		let links = linksOf(response);

		expect(response.status).toBe(200);
		expect(Object.keys(links).sort()).toEqual(["first", "last", "next", "prev"]);
		for (let link of Object.values(links)) {
			expect(link.pathname).toBe("/search");
			expect(link.searchParams.get("q")).toBe(TOKEN);
		}
		expect(links.next?.searchParams.get("page")).toBe("3");
		expect(html).toContain('aria-current="page"');
		expect(html).toContain(`href="/search?q=${TOKEN}&amp;perPage=2&amp;page=3"`);
	});

	test("says so when nothing matches", async () => {
		let response = await get(`/search?q=${TOKEN}nothing`);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("No posts match");
	});

	test("answers 400 with the reason for a query holding nothing to find", async () => {
		let response = await get(`/search?q=${encodeURIComponent(`-${TOKEN}`)}`);
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(html).toContain("A search needs at least one term to find.");
		expect(html).toContain('aria-invalid="true"');
	});

	test("redirects malformed paging to the query's first page", async () => {
		let response = await get(`/search?q=${TOKEN}&page=0`);

		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe(`/search?q=${TOKEN}`);
	});
});

describe("the search_posts MCP tool", () => {
	test("answers the same output shape, best match first, previews left out", async () => {
		let body = await searchPosts({ query: TOKEN, kind: "article", limit: 2 });
		let output = outputOf(body);

		expect(body.result?.isError).toBeUndefined();
		expect(output.query).toBe(TOKEN);
		expect(output.count).toBe(2);
		expect(output.results[0]).toEqual({
			kind: "article",
			title: expect.stringContaining(TOKEN),
			slug: expect.stringMatching(new RegExp(`^${TOKEN}-article-\\d$`)),
			url: expect.stringMatching(new RegExp(`^/articles/${TOKEN}-article-\\d$`)),
			excerpt: expect.stringMatching(/^Notes on part \d\.$/),
			tags: [],
			publishedAt: PAST,
		});
	});

	test("narrows by tag", async () => {
		let body = await searchPosts({ query: TOKEN, tag: "Remix" });
		let output = outputOf(body);

		expect(output.results.map((result) => result.slug)).toEqual([`${TOKEN}-tutorial`]);
	});

	test("answers a tool error a model can act on for a query holding nothing to find", async () => {
		let body = await searchPosts({ query: `-${TOKEN}` });

		expect(body.result?.isError).toBe(true);
		expect(body.result?.content?.[0]?.text).toContain("at least one term");
	});
});
