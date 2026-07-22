/**
 * Tests the `/vs/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `comparisons` record renders that page's content plus its head-to-head comparison
 * table (200), and an unknown slug renders the same not-found page the router's
 * `defaultHandler` uses (404).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { comparisons } from "~/resources/content/marketing";
import routes from "~/routes/web";

import marketingComparison from "./marketing-comparison";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/**
 * Dispatches a real GET request to `/vs/:slug` as an anonymous visitor. Includes the
 * real `i18n` middleware — this controller renders its FAQ section header through
 * `ctx.i18next.t()` — backed by an empty test database.
 */
async function getComparison(slug: string) {
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
	router.map(routes.marketing.comparison, marketingComparison);

	let request = new Request(`https://uptime.test${routes.marketing.comparison.href({ slug })}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /vs/:slug", () => {
	test("renders a real comparison page with its head-to-head table", async () => {
		let slug = Object.keys(comparisons)[0];
		if (!slug) throw new Error("expected at least one comparison page");
		let content = comparisons[slug]!;

		let response = await getComparison(slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${content.metaTitle}</title>`);
		expect(body).toContain(content.title);
		expect(body).toContain(`>${content.competitor}</th>`);
		expect(body).toContain(`>${content.rows[0]!.label}</td>`);
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getComparison("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});
});
