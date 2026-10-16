/**
 * Requests `<page>.png` cards through the real router over a migrated D1 and the real R2
 * binding: a post advertises its card and the card renders and is stored, a listing's and a
 * topic's cards render, a post's other formats still answer, and a non-page has no card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

const ORIGIN = "https://blog.test";
const SLUG = `card-${generateUUID().slice(0, 8)}`;

/** Deferred writes the route hands off, awaited by a test that reads storage after them. */
const PENDING: Array<Promise<unknown>> = [];

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
		waitUntil: (promise) => void PENDING.push(promise),
	};
}

/** Requests one path through the real router. */
function request(path: string) {
	return createWebRouter(environment()).fetch(new Request(new URL(path, ORIGIN)));
}

/** The `content` of the page's `<meta>` naming `key`, whatever order its attributes are in. */
function metaContent(html: string, key: string): string | undefined {
	let tag = html.match(/<meta\b[^>]*>/g)?.find((candidate) => candidate.includes(`"${key}"`));
	return tag ? /\scontent="([^"]*)"/.exec(tag)?.[1] : undefined;
}

/** The card URL a page advertises in its `og:image` tag, as a path on this site. */
async function advertisedCard(path: string): Promise<string> {
	let response = await request(path);
	expect(response.status, path).toBe(200);
	let image = metaContent(await response.text(), "og:image");
	expect(image, path).toBeDefined();
	let url = new URL((image ?? "").replaceAll("&amp;", "&"));
	return `${url.pathname}${url.search}`;
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);
	let created = await bindModels(db).articles.create({
		author_id: author,
		published_at: "2026-10-02T12:00:00.000Z",
		meta: {
			slug: SLUG,
			title: "Cards Drawn in a Worker",
			excerpt: "How every page here gets its social card.",
			content: "Body.",
		},
	});
	if (isFailure(created)) throw new Error(JSON.stringify(created.error.issues));
});

describe("GET <page>.png", () => {
	test("a post advertises a large card that renders and is stored", async () => {
		let page = await (await request(`/articles/${SLUG}`)).text();
		expect(metaContent(page, "twitter:card")).toBe("summary_large_image");
		expect(page.match(/"twitter:card"/g)).toHaveLength(1);

		let card = await advertisedCard(`/articles/${SLUG}`);
		expect(card).toMatch(new RegExp(`^/articles/${SLUG}\\.png\\?v=[0-9a-z]+$`));

		let response = await request(card);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		let bytes = new Uint8Array(await response.arrayBuffer());
		expect(Array.from(bytes.slice(1, 4))).toEqual([80, 78, 71]);

		await Promise.all(PENDING);
		let stored = await env.SOCIAL_CARDS.list({ prefix: "1/" });
		expect(stored.objects.length).toBeGreaterThan(0);
	});

	test("a listing's card renders from its feed", async () => {
		let card = await advertisedCard("/articles");
		expect(card).toMatch(/^\/articles\.png\?v=/);
		expect((await request(card)).status).toBe(200);
	});

	test("the home page's card lives under index", async () => {
		let card = await advertisedCard("/");
		expect(card).toMatch(/^\/index\.png\?v=/);
		expect((await request(card)).status).toBe(200);
	});

	test("a post's markdown twin still answers as markdown", async () => {
		let response = await request(`/articles/${SLUG}.md`);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("markdown");
	});

	test("a path that is no published page has no card", async () => {
		expect((await request("/articles/no-such-post.png")).status).toBe(404);
		expect((await request("/index.png.png")).status).toBe(404);
	});
});
