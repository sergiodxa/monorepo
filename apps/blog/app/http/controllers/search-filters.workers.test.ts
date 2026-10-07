/**
 * Drives the search syntax's fields and filters through `/search`, the dialog's frame and
 * the MCP tool inside workerd, against the D1 binding the app's migrations build: `title:`,
 * `tag:`, `kind:` and `lang:` with their exclusions and alternatives, and the newest-first
 * order a search of filters alone lists in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
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
const TOKEN = `zl${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

/** A tag only this file's tutorials carry. */
const TAG = `tag${TOKEN}`;

/** The public links of this file's posts, by what each one is. */
const POSTS = {
	spanish: `/articles/${TOKEN}-es`,
	english: `/articles/${TOKEN}-en`,
	older: `/tutorials/${TOKEN}-older`,
	newer: `/tutorials/${TOKEN}-newer`,
	term: `/glossary#${TOKEN}-term`,
};

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

/** The links of this file's posts a `/search` page lists for `q`, in the order it lists them. */
async function found(q: string): Promise<Array<string>> {
	let response = await createApplication(environment()).fetch(
		new Request(new URL(`/search?${new URLSearchParams({ q })}`, ORIGIN)),
	);
	let html = await response.text();
	let links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? "");
	return [...new Set(links.filter((link) => link.includes(TOKEN) && !link.startsWith("/search")))];
}

/** The slugs `search_posts` answers for `query` and any other arguments, as an MCP client reads them. */
async function searchPosts(
	query: string,
	extra: Record<string, unknown> = {},
): Promise<Array<string>> {
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
					arguments: { query, ...extra },
					_meta: {
						[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
						[MetaKey.ClientCapabilities]: {},
					},
				},
			}),
		}),
	);
	let body = (await response.json()) as { result?: { content?: Array<{ text?: string }> } };
	let output = JSON.parse(body.result?.content?.[0]?.text ?? "{}") as {
		results?: Array<{ slug: string }>;
	};
	return (output.results ?? []).map((result) => result.slug);
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);

	await ArticlePost.create(db, {
		author_id: author,
		published_at: "2026-01-01T12:00:00.000Z",
		meta: {
			slug: `${TOKEN}-es`,
			title: `${TOKEN} en español`,
			locale: "es-AR",
			content: "Cuerpo",
			excerpt: "Un artículo.",
		},
	});

	await ArticlePost.create(db, {
		author_id: author,
		published_at: "2026-02-01T12:00:00.000Z",
		meta: {
			slug: `${TOKEN}-en`,
			title: `${TOKEN} in English`,
			locale: "en",
			content: "Body",
			excerpt: "An article.",
		},
	});

	/** Created before the newer tutorial, so their ids run opposite to their dates. */
	await TutorialPost.create(db, {
		author_id: author,
		published_at: "2025-12-01T12:00:00.000Z",
		meta: {
			slug: `${TOKEN}-older`,
			title: "An older tutorial",
			excerpt: "A tutorial.",
			content: `A body naming ${TOKEN}.`,
			tags: [TAG, "React Router"],
		},
	});

	await TutorialPost.create(db, {
		author_id: author,
		published_at: "2026-03-01T12:00:00.000Z",
		meta: {
			slug: `${TOKEN}-newer`,
			title: "A newer tutorial",
			excerpt: "A tutorial.",
			content: `A body naming ${TOKEN}.`,
			tags: [TAG],
		},
	});

	await GlossaryPost.create(db, {
		author_id: author,
		published_at: "2026-01-15T12:00:00.000Z",
		meta: { slug: `${TOKEN}-term`, term: "Term", definition: `Defined by ${TOKEN}.` },
	});
});

describe("title:", () => {
	test("matches the word in titles only", async () => {
		expect((await found(`title:${TOKEN}`)).sort()).toEqual([POSTS.english, POSTS.spanish].sort());
	});
});

describe("tag:", () => {
	test("narrows to tutorials whose tags hold the value, compared without case", async () => {
		expect((await found(`${TOKEN} tag:${TAG.toUpperCase()}`)).sort()).toEqual(
			[POSTS.newer, POSTS.older].sort(),
		);
		expect(await found(`${TOKEN} tag:"react router"`)).toEqual([POSTS.older]);
	});

	test("matches a whole tag, never a word inside one", async () => {
		expect(await found(`${TOKEN} tag:react`)).toEqual([]);
	});

	test("leaves the tagged posts out when excluded", async () => {
		expect((await found(`${TOKEN} -tag:${TAG}`)).sort()).toEqual(
			[POSTS.english, POSTS.spanish, POSTS.term].sort(),
		);
	});

	test("accepts any of the values joined with OR", async () => {
		expect(await found(`${TOKEN} tag:nothing OR tag:"react router"`)).toEqual([POSTS.older]);
	});
});

describe("kind:", () => {
	test("narrows to one kind, spelled singular or plural", async () => {
		expect((await found(`${TOKEN} kind:tutorials`)).sort()).toEqual(
			[POSTS.newer, POSTS.older].sort(),
		);
		expect(await found(`${TOKEN} kind:glossary`)).toEqual([POSTS.term]);
	});

	test("matches nothing for a kind that does not exist", async () => {
		expect(await found(`${TOKEN} kind:recipe`)).toEqual([]);
	});

	test("leaves a kind out when excluded", async () => {
		expect(await found(`${TOKEN} -kind:article -kind:tutorial`)).toEqual([POSTS.term]);
	});
});

describe("lang:", () => {
	test("matches a language by its primary subtag, `es` reaching `es-AR`", async () => {
		expect(await found(`${TOKEN} lang:es`)).toEqual([POSTS.spanish]);
		expect(await found(`${TOKEN} lang:ES-ar`)).toEqual([POSTS.spanish]);
	});

	test("reads locale: and language: as aliases, and a language by its name", async () => {
		expect(await found(`${TOKEN} locale:es`)).toEqual([POSTS.spanish]);
		expect(await found(`${TOKEN} language:spanish`)).toEqual([POSTS.spanish]);
		expect(await found(`${TOKEN} lang:español`)).toEqual([POSTS.spanish]);
	});

	test("counts a post with no language of its own as English", async () => {
		expect((await found(`${TOKEN} lang:en`)).sort()).toEqual(
			[POSTS.english, POSTS.newer, POSTS.older, POSTS.term].sort(),
		);
	});

	test("leaves a language out when excluded", async () => {
		expect(await found(`${TOKEN} -lang:en`)).toEqual([POSTS.spanish]);
	});
});

describe("a search of filters alone", () => {
	test("lists newest first, not in the order the posts were written", async () => {
		expect(await found(`tag:${TAG}`)).toEqual([POSTS.newer, POSTS.older]);
	});

	test("lists newest first across kinds", async () => {
		expect(await found(`tag:${TAG} OR tag:nothing kind:tutorial`)).toEqual([
			POSTS.newer,
			POSTS.older,
		]);
	});

	test("lists newest first in the dialog too", async () => {
		let response = await createApplication(environment()).fetch(
			new Request(new URL(`/frames/search?${new URLSearchParams({ q: `tag:${TAG}` })}`, ORIGIN)),
		);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html.indexOf(POSTS.newer)).toBeGreaterThan(-1);
		expect(html.indexOf(POSTS.newer)).toBeLessThan(html.indexOf(POSTS.older));
	});
});

describe("the search_posts MCP tool", () => {
	test("reads the same filters in its query", async () => {
		expect(await searchPosts(`${TOKEN} lang:es`)).toEqual([`${TOKEN}-es`]);
		expect(await searchPosts(`tag:${TAG}`)).toEqual([`${TOKEN}-newer`, `${TOKEN}-older`]);
	});

	test("reads OR, a filter and an exclusion in one query", async () => {
		expect((await searchPosts(`${TOKEN} español OR english kind:article`)).sort()).toEqual(
			[`${TOKEN}-en`, `${TOKEN}-es`].sort(),
		);
		expect(await searchPosts(`${TOKEN} español OR english kind:article -lang:es`)).toEqual([
			`${TOKEN}-en`,
		]);
		expect(await searchPosts(`${TOKEN} español OR english -español`)).toEqual([`${TOKEN}-en`]);
	});

	test("narrows further by its kind and tag arguments, which hold beside the query's filters", async () => {
		expect(await searchPosts(`tag:${TAG}`, { kind: "tutorial" })).toEqual([
			`${TOKEN}-newer`,
			`${TOKEN}-older`,
		]);
		expect(await searchPosts(`tag:${TAG}`, { kind: "article" })).toEqual([]);
		expect(await searchPosts(TOKEN, { tag: "React Router" })).toEqual([`${TOKEN}-older`]);
	});
});
