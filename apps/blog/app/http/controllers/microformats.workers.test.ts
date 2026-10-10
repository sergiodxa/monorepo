/**
 * Reads the blog's own rendered pages back with the microformats parser that reads
 * everybody else's, so the `h-entry`, `h-card`, `h-feed` and `rel="me"` markup is
 * checked by what an IndieWeb consumer actually sees rather than by class names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { findItem, parse } from "@sdxc/microformats";
import { readCard, readEntry, readFeed } from "@sdxc/microformats/vocabulary";
import { succeeded, unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";
import { PROFILE } from "~/config/profile";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";
const SLUG = `microformats-${crypto.randomUUID().slice(0, 8)}`;
const PUBLISHED_AT = "2026-09-01T12:00:00.000Z";
const BOOKMARK_URL = `https://example.com/saved-${SLUG}`;
const UNTITLED_URL = `https://example.com/untitled-${SLUG}`;

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

/** Renders one page through the real router and parses it with the page's own URL as base. */
async function parsePage(path: string) {
	let url = new URL(path, ORIGIN).href;
	let response = await createApplication(environment()).fetch(new Request(url));
	expect(response.status).toBe(200);
	return ok(parse(await response.text(), url));
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);
	unwrap(
		await bindModels(db).articles.create({
			author_id: author,
			published_at: PUBLISHED_AT,
			meta: {
				slug: SLUG,
				title: "Marked Up",
				locale: "en",
				content: "Some body text with [a link](https://example.org/).",
			},
		}),
	);
	unwrap(
		await bindModels(db).likes.create({
			author_id: author,
			published_at: PUBLISHED_AT,
			meta: {
				url: BOOKMARK_URL,
				title: "A saved page",
				description: "What the page says about itself.",
			},
		}),
	);
	unwrap(
		await bindModels(db).likes.create({
			author_id: author,
			published_at: PUBLISHED_AT,
			meta: { url: UNTITLED_URL, title: "" },
		}),
	);
});

describe("the post page", () => {
	test("is an h-entry with its name, permalink, date and content", async () => {
		let document = await parsePage(`/articles/${SLUG}`);
		let item = findItem(document, "h-entry");
		expect(item).not.toBeNull();

		let entry = ok(readEntry(item!));
		expect(entry.name).toBe("Marked Up");
		expect(entry.url).toBe(`${ORIGIN}/articles/${SLUG}`);
		expect(entry.uid).toBe(`${ORIGIN}/articles/${SLUG}`);
		expect(entry.published?.instant?.toISOString()).toBe(PUBLISHED_AT);
		expect(entry.content?.value).toContain("Some body text");
		expect(entry.content?.html).toContain('href="https://example.org/"');
	});

	test("names its author with an h-card", async () => {
		let document = await parsePage(`/articles/${SLUG}`);
		let entry = ok(readEntry(findItem(document, "h-entry")!));

		expect(entry.author?.name).toBe(PROFILE.name);
		expect(entry.author?.url).toBe(PROFILE.canonical.origin);
	});

	test("carries the site h-card and the owner's rel=me profiles", async () => {
		let document = await parsePage(`/articles/${SLUG}`);
		let card = ok(readCard(findItem(document, "h-card")!));

		expect(card.name).toBe(PROFILE.name);
		expect(card.url).toBe(PROFILE.canonical.origin);
		expect(card.uid).toBe(PROFILE.canonical.origin);
		expect(card.photo?.value).toBe(PROFILE.github.avatar);
		expect(document.rels.me).toEqual(
			expect.arrayContaining([PROFILE.github.profile, PROFILE.x.profile]),
		);
	});
});

describe("the listings", () => {
	test("the home page is an h-feed whose entries link to their permalinks", async () => {
		let document = await parsePage("/");
		let feed = ok(readFeed(findItem(document, "h-feed")!));
		let entry = feed.entries.find((it) => it.url === `${ORIGIN}/articles/${SLUG}`);

		expect(feed.name).toBe(PROFILE.name);
		expect(entry?.published?.instant?.toISOString()).toBe(PUBLISHED_AT);
	});

	test("the bookmarks page marks each entry as a bookmark of the saved page", async () => {
		let document = await parsePage("/bookmarks");
		let feed = ok(readFeed(findItem(document, "h-feed")!));
		let entry = feed.entries.find((it) => it.bookmarkOf[0]?.url === BOOKMARK_URL);

		expect(entry?.name).toBe("A saved page");
		expect(entry?.summary).toBe("What the page says about itself.");
		expect(entry?.published?.instant?.toISOString()).toBe(PUBLISHED_AT);
	});

	test("the bookmarks page names an untitled bookmark by its address and gives it no summary", async () => {
		let document = await parsePage("/bookmarks");
		let feed = ok(readFeed(findItem(document, "h-feed")!));
		let entry = feed.entries.find((it) => it.bookmarkOf[0]?.url === UNTITLED_URL);

		expect(entry?.name).toBe(`example.com/untitled-${SLUG}`);
		expect(entry?.summary).toBeNull();
	});
});
