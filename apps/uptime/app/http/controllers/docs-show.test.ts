/**
 * Tests the `/docs/*slug` controller. A real slug renders its document inside the docs
 * shell (breadcrumb, rail, titled code, feedback, support and pager) with its own canonical
 * link; `.md` serves the source, and an unknown slug renders the unindexed 404.
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

import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { SEO } from "~/app/initializers/seo";
import { apiProblems } from "~/app/services/api/problems";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import routes from "~/routes/web";

import docsShow from "./docs-show";

/** Renders through `renderToString`, sufficient for this page's plain-element tree. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/docs/*slug` as an anonymous visitor. */
async function getDocsShow(slug: string, search = "") {
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
	router.map(routes.docs.show, docsShow);

	let request = new Request(`https://uptime.test${routes.docs.show.href({ slug })}${search}`);
	return router.fetch(request);
}

describe("GET /docs/*slug", () => {
	test("renders a real doc's frontmatter as the page header", async () => {
		let response = await getDocsShow("concepts/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>HTTP Monitors | Documentation - Uptime</title>");
		expect(body).toMatch(/<h1[^>]*>HTTP Monitors<\/h1>/);
		expect(body).toMatch(/Last updated[\s\S]*?<time[^>]*datetime="\d{4}-\d{2}-\d{2}"/i);
	});

	test("emits the canonical URL and the doc's own frontmatter description in <head>", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toContain(
			`<link rel="canonical" href="${SEO.baseUrl}${routes.docs.show.href({ slug: "concepts/http-monitors" })}" />`,
		);
		expect(body).toMatch(/<meta name="description" content="[^"]+" \/>/);
	});

	test("marks the current page's sidebar link and builds a Docs > section > page breadcrumb", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toMatch(/href="\/docs\/concepts\/http-monitors"[^>]*aria-current="page"/);
		expect(body).toContain(">Docs</a>");
		expect(body).not.toContain('href="/docs/concepts"');
	});

	test("lists the page's headings in the On this page rail, linked to their ids", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toContain('id="configuration-options"');
		expect(body).toContain('href="#configuration-options"');
		expect(body).toContain("On this page");
	});

	test("pages within the section and links its neighbours with rel", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toMatch(
			/href="\/docs\/concepts\/monitors"[^>]*rel="prev"|rel="prev"[^>]*href="\/docs\/concepts\/monitors"/,
		);
		expect(body).toMatch(/rel="next"/);
	});

	test("titles every code block and gives it a copy button", async () => {
		let body = await (await getDocsShow("api/resources/http-monitors")).text();

		expect(body).toContain('data-slot="code-block"');
		expect(body).toContain("Copy code");
		expect(body).toContain("Terminal");
	});

	test("paints the code fences a doc carries", async () => {
		let body = await (await getDocsShow("api/resources/http-monitors")).text();

		expect(body).toContain('class="token ');
	});

	test("renders an API page's scopes, errors and schemas from the OpenAPI document", async () => {
		let body = await (await getDocsShow("api/resources/http-monitors")).text();

		expect(body).not.toContain("<!-- operation:");
		expect(body).toContain("Required scope:");
		expect(body).toContain("idempotency-key-reused");
		expect(body).toContain("Response Schema");
	});

	test("closes every page with feedback, a route to support and a copy-page action", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toContain('action="/docs/feedback"');
		expect(body).toContain('value="/docs/concepts/http-monitors"');
		expect(body).toContain("Still stuck?");
		expect(body).toContain('href="/docs/contact?page=%2Fdocs%2Fconcepts%2Fhttp-monitors"');
		expect(body).toContain("Copy page");
		expect(body).toContain("/docs/concepts/http-monitors.md");
	});

	test("thanks the reader under the page header, where the reloaded page opens", async () => {
		let body = await (await getDocsShow("concepts/http-monitors", "?feedback=sent")).text();

		let thanks = body.indexOf("Thanks — your answer helps us improve this page.");
		expect(thanks).toBeGreaterThan(-1);
		expect(thanks).toBeLessThan(body.indexOf('id="configuration-options"'));
		expect(body).not.toContain('action="/docs/feedback"');
	});

	test("serves a page's Markdown source at its .md twin", async () => {
		let response = await getDocsShow("concepts/http-monitors.md");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		expect(await response.text()).toContain("title: HTTP Monitors");
	});

	test("renders the signed-out dashboard CTA as a sign-in button", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toContain("Start monitoring");
	});

	test("sends every API problem type's URL to the error reference", async () => {
		for (let entry of apiProblems.entries()) {
			let slug = new URL(entry.type).pathname.replace(/^\/docs\//, "");
			let response = await getDocsShow(slug);

			expect(response.status).toBe(307);
			expect(response.headers.get("Location")).toBe("/docs/api/errors");
		}
	});

	test("sends the retired overview page to the hub for good", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe("/docs");
	});

	test("renders a 404 that searches for the missing page", async () => {
		let response = await getDocsShow("guides/web-hooks");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("<title>Page Not Found | Documentation - Uptime</title>");
		expect(body).toContain("Page Not Found");
		expect(body).toContain('action="/docs/search"');
		expect(body).toContain('value="web hooks"');
		expect(body).not.toContain('rel="canonical"');
	});
});
