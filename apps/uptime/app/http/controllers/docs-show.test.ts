/**
 * Tests the `/docs/*slug` controller. A real slug renders its document inside the docs
 * shell — breadcrumb, "On this page" rail, titled code, alerts and pager — with its own
 * canonical link and description; an unknown slug renders the unindexed not-found page.
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
async function getDocsShow(slug: string) {
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

	let request = new Request(`https://uptime.test${routes.docs.show.href({ slug })}`);
	return router.fetch(request);
}

describe("GET /docs/*slug", () => {
	test("renders a real doc's frontmatter and parsed content", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Overview | Documentation - Uptime</title>");
		expect(body).toContain(">Overview</h1>");
		expect(body).toContain("Last updated: 2026-02-14");
		expect(body).toContain("Key Features");
	});

	test("emits the canonical URL and the doc's own frontmatter description in <head>", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(
			`<link rel="canonical" href="${SEO.baseUrl}${routes.docs.show.href({ slug: "overview" })}" />`,
		);
		expect(body).toContain(
			'<meta name="description" content="Monitor your websites, APIs, servers, and scheduled tasks. Get alerted when something goes wrong and share status with your users." />',
		);
	});

	test("marks the current page's sidebar link active and builds a Docs > section > page breadcrumb", async () => {
		let response = await getDocsShow("concepts/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain('href="/docs/concepts/http-monitors" aria-current="page"');
		expect(body).toContain(">Docs</a>");
		expect(body).toContain(">Concepts</a>");
		expect(body).toMatch(/aria-current="page"[^>]*>HTTP Monitors<\/a>/);
	});

	test("lists the page's headings in the On this page rail, linked to their ids", async () => {
		let body = await (await getDocsShow("concepts/http-monitors")).text();

		expect(body).toContain('id="configuration-options"');
		expect(body).toContain('href="#configuration-options"');
		expect(body).toContain('aria-label="On this page"');
	});

	test("closes the page with links to its neighbours in sidebar order", async () => {
		let body = await (await getDocsShow("quickstart")).text();

		expect(body).toMatch(/<a href="\/docs\/overview" rel="prev"/);
		expect(body).toMatch(/<a href="\/docs\/concepts\/monitors" rel="next"/);
	});

	test("titles every code block and gives it a copy button aimed at its code", async () => {
		let body = await (await getDocsShow("api/resources/http-monitors")).text();
		let ids = [...body.matchAll(/<code id="(code-[a-z0-9]+)"/g)].map((match) => match[1]);

		expect(ids.length).toBeGreaterThan(0);
		for (let id of ids) expect(body).toContain(`commandfor="${id}"`);
		expect(body).toContain('aria-label="Copy code"');
	});

	test("draws a GitHub alert as a labelled aside", async () => {
		let body = await (await getDocsShow("quickstart")).text();

		expect(body).toMatch(/<aside aria-label="Tip" data-color="success"/);
	});

	test("only links the docs root breadcrumb — intermediate path segments have no real page", async () => {
		let response = await getDocsShow("api/resources/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();

		expect(body).toContain(`href="${routes.docs.index.href()}"`);
		expect(body).not.toContain('href="/docs/api"');
		expect(body).not.toContain('href="/docs/api/resources"');
	});

	test("paints the code fences a doc carries", async () => {
		let response = await getDocsShow("api/resources/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain('class="language-bash"');
		expect(body).toContain('class="token ');
	});

	test("renders an API page's scopes, errors and schemas from the OpenAPI document", async () => {
		let response = await getDocsShow("api/resources/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).not.toContain("<!-- operation:");
		expect(body).toContain("Required scope:");
		expect(body).toContain("idempotency-key-reused");
		expect(body).toContain("Response Schema");
	});

	test("renders the signed-out dashboard CTA as a sign-in button", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Start Monitoring");
	});

	test("sends every API problem type's URL to the error reference", async () => {
		for (let entry of apiProblems.entries()) {
			let slug = new URL(entry.type).pathname.replace(/^\/docs\//, "");
			let response = await getDocsShow(slug);

			expect(response.status).toBe(307);
			expect(response.headers.get("Location")).toBe("/docs/api/errors");
		}
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getDocsShow("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("<title>Page Not Found | Documentation - Uptime</title>");
		expect(body).toContain(">Page Not Found</h1>");
		expect(body).toContain("The documentation page you're looking for doesn't exist.");
		expect(body).not.toContain('rel="canonical"');
	});
});
