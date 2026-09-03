/**
 * Tests the `/docs/*slug` controller. A real slug (backed by Markdown under
 * `resources/docs/**`) renders its parsed Markdoc content inside the shared
 * `DocsLayout` chrome, with a canonical link and frontmatter description in
 * `<head>`. An unknown slug renders the router's shared not-found page,
 * reserving the canonical link for indexable pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import i18n from "~/app/http/middleware/i18n";
import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
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
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.docs.show, docsShow);

	let request = new Request(`https://uptime.test${routes.docs.show.href({ slug })}`);
	return container.scope(() => router.fetch(request));
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

	test("marks the current page's sidebar link active and builds a docs > ... breadcrumb", async () => {
		let response = await getDocsShow("concepts/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain('href="/docs/concepts/http-monitors" aria-current="page"');
		expect(body).toContain(">docs<");
		expect(body).toContain(">concepts<");
		expect(body).toContain(">http monitors<");
	});

	test("only links the docs root breadcrumb — intermediate path segments have no real page", async () => {
		let response = await getDocsShow("api/resources/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();

		expect(body).toContain(`href="${routes.docs.index.href()}"`);
		expect(body).not.toContain('href="/docs/api"');
		expect(body).not.toContain('href="/docs/api/resources"');
	});

	test("renders the signed-out dashboard CTA as a sign-in button", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Start Monitoring");
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getDocsShow("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("<title>Page Not Found | Documentation - Uptime</title>");
		expect(body).toContain("<h1>Page Not Found</h1>");
		expect(body).toContain("The documentation page you're looking for doesn't exist.");
		expect(body).not.toContain('rel="canonical"');
	});
});
