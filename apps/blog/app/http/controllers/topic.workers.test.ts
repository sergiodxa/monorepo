/**
 * Requests topic pages and feeds through the real router over a migrated D1: a kind's topic
 * at its old address, an author's topic under `/topics/` with its feeds, the glossary listing
 * every entry by term, and the addresses that name no topic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { JSONFeed } from "@sdxc/json-feed";
import { isFailure, succeeded } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vite-plus/test";

import { createWebRouter } from "~/app/initializers/router";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

const ORIGIN = "https://blog.test";
const RUN = generateUUID().slice(0, 8);
const TAG = `topictag${RUN}`;
const TOPIC_SLUG = `tagged-${RUN}`;
const MANY_TAG = `manytag${RUN}`;
const MANY_SLUG = `many-${RUN}`;
const MANY = 25;

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

/** Fails the test naming the refused write's issues, so a broken fixture says why. */
function created<T>(result: Result<T, ValidationError>, label: string): T {
	if (isFailure(result)) throw new Error(`${label}: ${JSON.stringify(result.error.issues)}`);
	return result.data;
}

/** Requests one path through the real router, without following redirects. */
function request(path: string) {
	return createWebRouter(environment()).fetch(new Request(new URL(path, ORIGIN)));
}

/** Requests a page that must answer 200, and reads its HTML. */
async function html(path: string) {
	let response = await request(path);
	expect(response.status, path).toBe(200);
	return response.text();
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);
	let models = bindModels(db);
	for (let [index, title] of ["Older tagged", "Newer tagged"].entries()) {
		created(
			await models.tutorials.create({
				author_id: author,
				published_at: `2026-0${index + 1}-01T12:00:00.000Z`,
				meta: {
					slug: `${TOPIC_SLUG}-${index}`,
					title: `${title} ${RUN}`,
					excerpt: "A tagged tutorial.",
					content: "Body.",
					tags: JSON.stringify([TAG]),
				},
			}),
			"tutorial",
		);
	}
	for (let index = 0; index < MANY; index++) {
		created(
			await models.tutorials.create({
				author_id: author,
				published_at: `2025-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
				meta: {
					slug: `${MANY_SLUG}-${index}`,
					title: `Many ${index} ${RUN}`,
					excerpt: "One of many tutorials.",
					content: "Body.",
					tags: JSON.stringify([MANY_TAG]),
				},
			}),
			"many tutorials",
		);
	}
	for (let term of ["Zebra", "Aardvark"]) {
		created(
			await models.glossary.create({
				author_id: author,
				meta: {
					slug: `${term.toLowerCase()}-${RUN}`,
					term: `${term} ${RUN}`,
					definition: "A word.",
				},
			}),
			"glossary entry",
		);
	}
	created(
		await models.topics.create({
			slug: TOPIC_SLUG,
			title: `Tagged ${RUN}`,
			description: "Posts **tagged** for a test.",
			query: `tag:${TAG}`,
		}),
		"topic",
	);
	created(
		await models.topics.create({
			slug: MANY_SLUG,
			title: `Many ${RUN}`,
			description: "More posts than one page held.",
			query: `tag:${MANY_TAG}`,
		}),
		"many topic",
	);
});

/** Whether a page lists every one of the many tutorials, newest first, with no pager. */
function expectEveryMany(page: string) {
	let positions = Array.from({ length: MANY }, (_, index) =>
		page.indexOf(`Many ${MANY - 1 - index} ${RUN}<`),
	);
	expect(positions.every((position) => position >= 0)).toBe(true);
	expect(positions).toEqual([...positions].sort((a, b) => a - b));
	expect(page).not.toContain('rel="next"');
	expect(page).not.toContain("Topic pages");
}

describe("a topic with more matches than one page once held", () => {
	test("its kind's page lists every one of them, newest first", async () => {
		expectEveryMany(await html("/tutorials"));
	});

	test("an author's topic page lists every one of them, newest first", async () => {
		expectEveryMany(await html(`/topics/${MANY_SLUG}`));
	});

	test("an old paged address renders the whole list", async () => {
		expectEveryMany(await html(`/topics/${MANY_SLUG}?page=2`));
		expectEveryMany(await html("/tutorials?page=2&perPage=5"));
	});
});

describe("a kind's topic", () => {
	test("keeps its address and shows the title, description and feeds it always had", async () => {
		let page = await html("/tutorials");
		expect(page).toContain("Learn about Remix, React, and more.");
		expect(page).toContain("Subscribe to my tutorials using");
		expect(page).toContain('href="/tutorials.rss"');
		expect(page).toContain('href="/tutorials.atom"');
		expect(page).toContain('href="/tutorials.json"');
		expect(page.indexOf(`Newer tagged ${RUN}`)).toBeLessThan(page.indexOf(`Older tagged ${RUN}`));
	});

	test("keeps an acronym title's case in its subscribe line", async () => {
		let page = await html("/til");
		expect(page).toContain("Subscribe to my TIL using");
	});

	test("the glossary lists every entry by term, each at its anchor", async () => {
		let page = await html("/glossary");
		expect(page).toContain(`id="aardvark-${RUN}"`);
		expect(page.indexOf(`Aardvark ${RUN}`)).toBeLessThan(page.indexOf(`Zebra ${RUN}`));
	});

	test("its feed lives beside its page, and a name no kind has answers 404", async () => {
		let feed = RSS.parse(await (await request("/glossary.rss")).text());
		expect(feed.items.map((item) => item.link)).toContain(`${ORIGIN}/glossary#zebra-${RUN}`);
		expect((await request("/nothing.rss")).status).toBe(404);
		expect((await request(`/${TOPIC_SLUG}.json`)).status).toBe(404);
	});

	test("under /topics/ redirects to its own address", async () => {
		let response = await request("/topics/articles.atom");
		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("/articles.atom");
	});
});

describe("an author's topic", () => {
	test("renders its Markdown description and its query's results, newest first", async () => {
		let page = await html(`/topics/${TOPIC_SLUG}`);
		expect(page).toContain("<strong>tagged</strong>");
		expect(page).toContain(`Subscribe to Tagged ${RUN} using`);
		expect(page).toContain(`href="/topics/${TOPIC_SLUG}.rss"`);
		expect(page.indexOf(`Newer tagged ${RUN}`)).toBeLessThan(page.indexOf(`Older tagged ${RUN}`));
	});

	test("serves its feeds newest first", async () => {
		let response = await request(`/topics/${TOPIC_SLUG}.json`);
		expect(response.status).toBe(200);
		let feed = JSONFeed.parse(await response.text());
		succeeded(feed);
		expect(feed.data.feed.title).toBe(`Tagged ${RUN} — Sergio Xalambrí`);
		expect(feed.data.items.map((item) => item.title)).toEqual([
			`Newer tagged ${RUN}`,
			`Older tagged ${RUN}`,
		]);
	});

	test("is where a post's tag links, while its kind label links to the kind's topic", async () => {
		let page = await html(`/tutorials/${TOPIC_SLUG}-0`);
		expect(page).toContain(`href="/topics/${TOPIC_SLUG}"`);
		expect(page).toMatch(/href="\/tutorials"[^>]*>Tutorial<\/a>/);
	});

	test("is listed on /topics and in the sitemap, and a slug no topic has answers 404", async () => {
		let index = await html("/topics");
		expect(index).toContain(`href="/topics/${TOPIC_SLUG}"`);
		expect(index).toContain('href="/articles"');
		expect(await html("/sitemap.xml")).toContain(`${ORIGIN}/topics/${TOPIC_SLUG}<`);
		expect((await request("/topics/no-such-topic")).status).toBe(404);
		expect((await request(`/topics/${TOPIC_SLUG}.xml`)).status).toBe(404);
	});
});
