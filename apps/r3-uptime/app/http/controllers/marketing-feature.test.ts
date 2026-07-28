/**
 * Tests the `/features/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `features` record renders that page's content (200) along with its canonical URL and
 * `SoftwareApplication`/`FAQPage` structured data, and an unknown slug renders the same
 * not-found page the router's `defaultHandler` uses (404).
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
import { features } from "~/resources/content/marketing";
import routes from "~/routes/web";

import marketingFeature from "./marketing-feature";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/features/:slug` as an anonymous visitor. */
async function getFeature(slug: string) {
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
	router.map(routes.marketing.feature, marketingFeature);

	let request = new Request(`https://uptime.test${routes.marketing.feature.href({ slug })}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /features/:slug", () => {
	test("renders a real feature page", async () => {
		let slug = Object.keys(features)[0];
		if (!slug) throw new Error("expected at least one feature page");
		let content = features[slug]!;

		let response = await getFeature(slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${content.metaTitle}</title>`);
		expect(body).toContain(content.title);
	});

	test("advertises its canonical URL and structured data", async () => {
		let slug = Object.keys(features)[0];
		if (!slug) throw new Error("expected at least one feature page");
		let content = features[slug]!;

		let response = await getFeature(slug);

		let body = await response.text();
		// Canonical on the production origin, not the `uptime.test` host that served it.
		expect(body).toContain(
			`<link rel="canonical" href="https://uptime.sergiodxa.com/features/${slug}"`,
		);
		// A feature page's subject is a capability of the product.
		expect(body).toContain('"@type":"SoftwareApplication"');
		if (content.faqs.length > 0) expect(body).toContain('"@type":"FAQPage"');
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getFeature("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});
});
