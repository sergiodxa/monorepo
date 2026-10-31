/**
 * Tests the `/docs` hub: it renders inside the docs shell, points first-time readers at
 * the quickstart and the API overview, and lists every guide under its section with the
 * same prefetch-on-intent links the sidebar uses.
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
		expect(body).toContain("Uptime documentation</h1>");
		expect(body).toContain('rel="canonical"');
	});

	test("points first-time readers at the quickstart and the API overview", async () => {
		let body = await (await getDocsIndex()).text();

		expect(body).toContain("Start here");
		expect(body).toMatch(/<a href="\/docs\/quickstart" data-rmx-prefetch="intent"/);
		expect(body).toMatch(/<a href="\/docs\/api\/overview" data-rmx-prefetch="intent"/);
	});

	test("lists every guide under its section", async () => {
		let body = await (await getDocsIndex()).text();
		let main = body.slice(body.indexOf("Browse by topic"));

		for (let section of await listDocs()) {
			expect(main).toContain(`>${section.title.replace("&", "&amp;")}</h3>`);
			for (let doc of section.docs) expect(main).toContain(`href="${doc.path}"`);
		}
	});
});
