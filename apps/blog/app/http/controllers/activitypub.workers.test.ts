/**
 * Drives content negotiation for ActivityPub through the real router inside workerd: a
 * post and the home page answer ActivityStreams to a server that asks for it, outside the
 * edge cache, while their HTML varies on `Accept` and advertises the AS2 alternate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { ArticlePost } from "~/app/repositories/posts/article";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { ACTOR_ID } from "~/config/activitypub";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";
const RUN = crypto.randomUUID().slice(0, 8);
const LIVE = `federated-${RUN}`;
const DELETED = `withdrawn-${RUN}`;
const DRAFT = `draft-${RUN}`;

/** What Mastodon sends when it fetches an object. */
const AS2 =
	'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

let db: Database;

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

/** Sends one request through the router the Worker entrypoint builds. */
function fetchPath(path: string, accept?: string) {
	let headers = accept === undefined ? undefined : { accept };
	return createApplication(environment()).fetch(new Request(new URL(path, ORIGIN), { headers }));
}

beforeAll(async () => {
	db = await migratedDatabase();
	let author = await seedAuthor(db);
	let meta = { locale: "en", content: "A **federated** body.", excerpt: "The lede." };
	await ArticlePost.create(db, {
		author_id: author,
		published_at: null,
		meta: { ...meta, slug: LIVE, title: "Federated" },
	});
	let deleted = await ArticlePost.create(db, {
		author_id: author,
		published_at: null,
		meta: { ...meta, slug: DELETED, title: "Withdrawn" },
	});
	await ArticlePost.create(db, {
		author_id: author,
		published_at: "2999-01-01T00:00:00.000Z",
		meta: { ...meta, slug: DRAFT, title: "Draft" },
	});
	await ArticlePost.destroy(db, deleted!.id);
});

describe("a post asked for as ActivityStreams", () => {
	test("answers its Article under the canonical permalink, kept out of the edge cache", async () => {
		let response = await fetchPath(`/articles/${LIVE}`, AS2);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/activity+json; charset=utf-8");
		expect(response.headers.get("vary")).toMatch(/accept/i);
		expect(response.headers.get("cache-control")).toContain("private");
		expect(response.headers.get("cache-tag")).toBeNull();

		let article = await response.json();
		expect(article).toMatchObject({
			id: `https://sergiodxa.com/articles/${LIVE}`,
			type: "Article",
			attributedTo: [ACTOR_ID],
			name: "Federated",
			summary: "The lede.",
		});
		expect(String(Object(article).content)).toContain("<strong>federated</strong>");
	});

	test("answers a deleted post's Tombstone with 410", async () => {
		let response = await fetchPath(`/articles/${DELETED}`, AS2);

		expect(response.status).toBe(410);
		expect(await response.json()).toMatchObject({
			type: "Tombstone",
			id: `https://sergiodxa.com/articles/${DELETED}`,
			formerType: "Article",
		});
	});

	test("answers a draft with an empty 404", async () => {
		let response = await fetchPath(`/articles/${DRAFT}`, AS2);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});
});

describe("a post asked for as HTML", () => {
	test("is the one variant the edge stores, varying on Accept and linking its alternate", async () => {
		let response = await fetchPath(`/articles/${LIVE}`, "text/html");
		let html = await response.text();

		expect(response.headers.get("cache-control")).toContain("public");
		expect(response.headers.get("vary")).toMatch(/accept/i);
		expect(html).toContain(
			`<link rel="alternate" type="application/activity+json" href="https://sergiodxa.com/articles/${LIVE}"`,
		);
	});
});

describe("a post asked for as Markdown", () => {
	/**
	 * Regression: Markdown negotiated from `Accept` on the extensionless URL was declared
	 * public, and the edge keys an entry by URL, so a browser could be served the Markdown.
	 */
	test("stays out of the edge cache when negotiated on the page URL", async () => {
		let response = await fetchPath(`/articles/${LIVE}`, "text/markdown");

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(response.headers.get("cache-control") ?? "").not.toContain("public");
		expect(response.headers.get("cache-tag")).toBeNull();
	});

	test("stays edge-cacheable under its own .md URL", async () => {
		let response = await fetchPath(`/articles/${LIVE}.md`);

		expect(response.headers.get("cache-control")).toContain("public");
	});
});

describe("the home page", () => {
	test("answers the actor to a server asking for ActivityStreams", async () => {
		let response = await fetchPath("/", AS2);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("private");
		expect(await response.json()).toMatchObject({ id: ACTOR_ID, preferredUsername: "hello" });
	});

	test("serves HTML varying on Accept that links the actor", async () => {
		let response = await fetchPath("/");

		expect(response.headers.get("content-type")).toContain("text/html");
		expect(response.headers.get("vary")).toMatch(/accept/i);
		expect(await response.text()).toContain(
			`<link rel="alternate" type="application/activity+json" href="${ACTOR_ID}"`,
		);
	});
});

describe("GET /.well-known/nodeinfo", () => {
	test("links the NodeInfo 2.1 document", async () => {
		let response = await fetchPath("/.well-known/nodeinfo");

		expect(await response.json()).toEqual({
			links: [
				{
					rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
					href: "https://sergiodxa.com/nodeinfo/2.1",
				},
			],
		});
	});
});
