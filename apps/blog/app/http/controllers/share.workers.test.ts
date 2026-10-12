/**
 * Tests for sharing posts on X through the real router and D1: a reader's "Discuss on X" link on
 * a post page, the author's "Post on X" links in the CMS, and the save-time check that refuses
 * a teaser too long for X while keeping what the author typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { serializeTags } from "~/app/models/post-values";
import { discussIntent, shareIntent } from "~/app/services/share";
import { permalink } from "~/app/services/webmention";
import { migratedDatabase } from "~/app/test/d1";
import { bindModels } from "~/app/test/models";
import { seedAdmin, signedInCookie } from "~/app/test/session";
import routes from "~/routes/web";

/** A suffix keeping these slugs apart from other files sharing the storage. */
const SUFFIX = generateUUID().slice(0, 8);

/** The article every test reads or edits. */
const SLUG = `share-${SUFFIX}`;

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

/** Builds the router and sends one request through it, the way the Worker entrypoint does. */
function fetchPath(path: string, init?: RequestInit) {
	return createWebRouter(environment()).fetch(
		new Request(new URL(path, "https://blog.test"), init),
	);
}

/** `href` as the HTML escapes it inside an attribute. */
function attribute(href: string): string {
	return href.replaceAll("&", "&amp;");
}

let db: Database;
let cookie = "";
let articleId = "";

beforeAll(async () => {
	db = await migratedDatabase();
	let adminId = await seedAdmin(db);
	cookie = await signedInCookie(adminId, environment().COOKIE_SESSION_SECRET);
	let article = unwrap(
		await bindModels(db).articles.create({
			author_id: adminId,
			published_at: null,
			meta: {
				slug: SLUG,
				title: "Sharing on X",
				locale: "en",
				excerpt: "What the index shows.",
				teaser: "Why intents beat the API",
				content: "Body.",
			},
		}),
	);
	articleId = article.id;
	unwrap(
		await bindModels(db).tutorials.create({
			author_id: adminId,
			published_at: null,
			meta: {
				slug: `share-tutorial-${SUFFIX}`,
				title: "Share a Tutorial",
				excerpt: "Stands in for the teaser.",
				content: "Steps.",
				tags: serializeTags([]),
			},
		}),
	);
});

/** Sends the CMS form as the signed-in admin's browser would, from the CMS itself. */
function submit(path: string, fields: Record<string, string>) {
	let body = new FormData();
	for (let [name, value] of Object.entries(fields)) body.set(name, value);
	return fetchPath(path, {
		method: "POST",
		body,
		headers: { cookie, "sec-fetch-site": "same-origin" },
	});
}

/** Reads a CMS page as the signed-in admin. */
async function cmsPage(path: string): Promise<string> {
	let response = await fetchPath(path, { headers: { cookie } });
	expect(response.status).toBe(200);
	return await response.text();
}

describe("Discuss on X", () => {
	test("links a public post to X prefilled with its title and canonical permalink", async () => {
		let response = await fetchPath(`/articles/${SLUG}`);
		let body = await response.text();
		let url = permalink({ postType: "articles", slug: SLUG }).href;

		expect(response.status).toBe(200);
		expect(body).toContain("Discuss on X");
		expect(body).toContain(attribute(discussIntent({ title: "Sharing on X", permalink: url })));
	});

	test("shares the canonical permalink when the page is reached on another host", async () => {
		let body = await (await fetchPath(`/articles/${SLUG}`)).text();
		let requestUrl = `https://blog.test/articles/${SLUG}`;

		expect(new URL(permalink({ postType: "articles", slug: SLUG })).origin).not.toBe(
			"https://blog.test",
		);
		expect(body).not.toContain(
			attribute(discussIntent({ title: "Sharing on X", permalink: requestUrl })),
		);
	});
});

describe("Post on X", () => {
	test("offers every article row the author's share text, teaser included", async () => {
		let body = await cmsPage(routes.cms.articles.index.href());
		let url = permalink({ postType: "articles", slug: SLUG }).href;

		expect(body).toContain(
			attribute(shareIntent(`📝 Sharing on X\n\nWhy intents beat the API\n\n${url}`)),
		);
	});

	test("lets a tutorial's excerpt stand in for its blank teaser", async () => {
		let body = await cmsPage(routes.cms.tutorials.index.href());
		let url = permalink({ postType: "tutorials", slug: `share-tutorial-${SUFFIX}` }).href;

		expect(body).toContain(
			attribute(shareIntent(`🛠️ Share a Tutorial\n\nStands in for the teaser.\n\n${url}`)),
		);
	});

	test("shows the link on a saved post's edit page, with the teaser and its count", async () => {
		let body = await cmsPage(routes.cms.articles.edit.href({ id: articleId }));

		expect(body).toContain("Post on X");
		expect(body).toContain('value="Why intents beat the API"');
		expect(body).toContain("of 238 characters left on X");
	});

	test("leaves the link off the form for a post not saved yet", async () => {
		let body = await cmsPage(routes.cms.articles.new.href());

		expect(body).toContain("Teaser for X");
		expect(body).not.toContain("Post on X");
	});
});

describe("the teaser check on save", () => {
	test("refuses a teaser too long for X, naming how much to cut and keeping the form", async () => {
		let teaser = "a".repeat(240);
		let response = await submit(routes.cms.articles.update.href({ id: articleId }), {
			_method: "PUT",
			title: "Sharing on X",
			slug: SLUG,
			locale: "en",
			teaser,
			content: "Edited body.",
		});
		let body = await response.text();

		expect(response.status).toBe(422);
		expect(body).toContain("The teaser is 2 characters too long to share on X");
		expect(body).toContain(`value="${teaser}"`);
		expect(body).toContain("Edited body.");

		let stored = await bindModels(db).articles.find(articleId);
		expect(stored?.meta.teaser).toBe("Why intents beat the API");
		expect(stored?.meta.content).toBe("Body.");
	});

	test("re-runs on a title change, refusing a teaser the longer title leaves no room for", async () => {
		let response = await submit(routes.cms.articles.update.href({ id: articleId }), {
			_method: "PUT",
			title: `Sharing on X ${"b".repeat(230)}`,
			slug: SLUG,
			locale: "en",
			teaser: "Why intents beat the API",
			content: "Body.",
		});

		expect(response.status).toBe(422);
	});

	test("refuses a new tutorial with an overlong teaser without creating it", async () => {
		let slug = `share-rejected-${SUFFIX}`;
		let response = await submit(routes.cms.tutorials.index.href(), {
			title: "Rejected",
			slug,
			excerpt: "x",
			teaser: "c".repeat(300),
			content: "Steps.",
		});

		expect(response.status).toBe(422);
		expect(await bindModels(db).tutorials.findBySlug(slug)).toBeNull();
	});
});
