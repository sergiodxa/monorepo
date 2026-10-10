/**
 * Tests for a post's EPUB URL, `/articles/:slug.epub` and `/tutorials/:slug.epub`, through the
 * real router and D1: a published post downloads as an ebook, while a draft or a missing slug
 * answers the same page the HTML URL would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { serializeTags } from "~/app/models/post-values";
import { migratedDatabase } from "~/app/test/d1";
import { bindModels } from "~/app/test/models";
import { seedAdmin } from "~/app/test/session";
import createApplication from "~/bootstrap/app";

/** A suffix keeping these slugs apart from other files sharing the storage. */
const SUFFIX = crypto.randomUUID().slice(0, 8);

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
function fetchPath(path: string) {
	return createApplication(environment()).fetch(new Request(new URL(path, "https://blog.test")));
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let authorId = await seedAdmin(db);
	unwrap(
		await bindModels(db).tutorials.create({
			author_id: authorId,
			published_at: null,
			meta: {
				slug: `epub-${SUFFIX}`,
				title: "Download a Tutorial",
				excerpt: "An ebook of one tutorial.",
				content: "## Setup\n\nRun `bun add`.\n\n![A screenshot](/images/setup.png)\n",
				tags: serializeTags(["remix"]),
			},
		}),
	);
	unwrap(
		await bindModels(db).tutorials.create({
			author_id: authorId,
			published_at: "2999-01-01T00:00:00.000Z",
			meta: {
				slug: `epub-draft-${SUFFIX}`,
				title: "A Draft",
				excerpt: "",
				content: "Not yet.",
				tags: serializeTags([]),
			},
		}),
	);
	unwrap(
		await bindModels(db).articles.create({
			author_id: authorId,
			published_at: null,
			meta: {
				slug: `epub-article-${SUFFIX}`,
				title: "An Article",
				locale: "en",
				content: "## Opening\n\nWords.\n",
				excerpt: "",
			},
		}),
	);
});

describe("GET /:postType/:slug.epub", () => {
	test("downloads a published tutorial as an EPUB", async () => {
		let response = await fetchPath(`/tutorials/epub-${SUFFIX}.epub`);
		let bytes = new Uint8Array(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/epub+zip");
		expect(response.headers.get("content-disposition")).toBe(
			`attachment; filename="epub-${SUFFIX}.epub"`,
		);
		expect(new TextDecoder().decode(bytes.subarray(30, 58))).toBe("mimetypeapplication/epub+zip");
		expect(new TextDecoder().decode(bytes)).toContain('<h2 id="section-setup">Setup</h2>');
	});

	test("links the EPUB from the tutorial page", async () => {
		let body = await fetchPath(`/tutorials/epub-${SUFFIX}`).then((response) => response.text());

		expect(body).toContain(`href="/tutorials/epub-${SUFFIX}.epub"`);
		expect(body).toContain("Download EPUB");
	});

	test("downloads a published article as an EPUB, linked from its page", async () => {
		let response = await fetchPath(`/articles/epub-article-${SUFFIX}.epub`);
		let bytes = new Uint8Array(await response.arrayBuffer());
		let page = await fetchPath(`/articles/epub-article-${SUFFIX}`).then((answer) => answer.text());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/epub+zip");
		expect(response.headers.get("content-disposition")).toBe(
			`attachment; filename="epub-article-${SUFFIX}.epub"`,
		);
		expect(new TextDecoder().decode(bytes)).toContain('<h2 id="section-opening">Opening</h2>');
		expect(page).toContain(`href="/articles/epub-article-${SUFFIX}.epub"`);
		expect(page).toContain("Download EPUB");
	});

	test("keeps a draft tutorial's EPUB behind the same 403 as its page", async () => {
		let response = await fetchPath(`/tutorials/epub-draft-${SUFFIX}.epub`);

		expect(response.status).toBe(403);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	test("answers a missing tutorial with the not-found page", async () => {
		let response = await fetchPath(`/tutorials/epub-missing-${SUFFIX}.epub`);

		expect(response.status).toBe(404);
	});
});
