/**
 * Tests the `/docs/search` page: a body-only word finds its page, a question finds the
 * section that answers it, and a search with no match still offers somewhere to go.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";

import { database } from "@sdxc/database-middleware";
import { log } from "@sdxc/logger/middleware";
import { renderToString } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import docsSearch from "~/app/http/controllers/docs-search";
import docsShow from "~/app/http/controllers/docs-show";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import routes from "~/routes/web";

/** Renders through `renderToString`, sufficient for this page's plain-element tree. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/**
 * Dispatches a real GET request to `/docs/search` as an anonymous visitor, through a
 * router that also maps the wildcard doc route, so the search route must win the match.
 */
async function search(query?: string) {
	let { db } = createTestDatabase();
	let router = createRouter({
		middleware: [
			asyncContext(),
			log() as Middleware,
			database(db),
			models(),
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			i18n as Middleware,
			testAssets(),
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.docs.search, docsSearch);
	router.map(routes.docs.show, docsShow);

	let url = new URL(`https://uptime.test${routes.docs.search.href()}`);
	if (query !== undefined) url.searchParams.set("q", query);
	return router.fetch(new Request(url));
}

describe("GET /docs/search", () => {
	test("answers ahead of the wildcard doc route, and stays out of search engines", async () => {
		let response = await search();

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Search the docs");
		expect(body).toContain('content="noindex, follow"');
	});

	test("finds a page by a word only its body uses", async () => {
		let body = await (await search("webhook")).text();

		expect(body).toContain('href="/docs/concepts/alerts');
		expect(body).toContain("<mark");
	});

	test("reads past the question words of a question", async () => {
		let body = await (await search("how do I pause alerts during maintenance")).text();

		expect(body).toContain('href="/docs/concepts/maintenance');
	});

	test("offers popular pages and support when nothing matches", async () => {
		let body = await (await search("zzqx")).text();

		expect(body).toContain("Nothing matches “zzqx”.");
		expect(body).toContain("Popular pages");
		expect(body).toContain('href="mailto:hello@sergiodxa.com"');
	});
});
