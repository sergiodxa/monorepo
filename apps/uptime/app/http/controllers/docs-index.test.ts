/**
 * Tests the `/docs` hub: it renders inside the docs shell, opens on a search field,
 * points first-time readers at the quickstart, and routes every section from a card
 * that says what the section covers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";

import { database } from "@sdxc/database-middleware";
import { renderToString } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import docsIndex from "~/app/http/controllers/docs-index";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { listDocs } from "~/app/services/docs";
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

/** Dispatches a real GET request to `/docs` as an anonymous visitor. */
async function getDocsIndex() {
	let { db } = createTestDatabase();

	let router = createRouter({
		middleware: [
			asyncContext(),
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
	router.map(routes.docs.index, docsIndex);

	return router.fetch(new Request(`https://uptime.test${routes.docs.index.href()}`));
}

describe("GET /docs", () => {
	test("renders the hub with its own title and canonical link", async () => {
		let response = await getDocsIndex();

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Documentation - Uptime</title>");
		expect(body).toMatch(/<h1[^>]*>How can we help\?<\/h1>/);
		expect(body).toContain('rel="canonical"');
	});

	test("opens on a search field that searches every page's body", async () => {
		let body = await (await getDocsIndex()).text();

		expect(body).toContain('action="/docs/search"');
		expect(body).toContain('name="q"');
	});

	test("starts first-time readers at the quickstart", async () => {
		let body = await (await getDocsIndex()).text();

		expect(body).toContain("Where should I start?");
		expect(body).toContain('href="/docs/quickstart"');
	});

	test("routes every section from a card that says what it covers", async () => {
		let body = await (await getDocsIndex()).text();
		let main = body.slice(body.indexOf("Browse by section"));

		for (let section of await listDocs()) {
			expect(main).toContain(section.title.replace("&", "&amp;"));
			expect(main).toContain(`href="${section.docs[0]?.path}"`);
		}
		expect(main).toContain("Every endpoint, with its fields, scopes and examples.");
	});
});
