/**
 * Tests the `/features/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `features` record renders that page's content (200) along with its canonical URL and
 * `SoftwareApplication`/`FAQPage` structured data, and an unknown slug renders the same
 * not-found page the router's `defaultHandler` uses (404). Every page's steps sit beside a
 * mockup, code stage or diagram.
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
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
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
	router.map(routes.marketing.feature, marketingFeature);

	let request = new Request(`https://uptime.test${routes.marketing.feature.href({ slug })}`);
	return router.fetch(request);
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
		expect(body).toContain(
			`<link rel="canonical" href="https://uptime.sergiodxa.com/features/${slug}"`,
		);
		expect(body).toContain('"@type":"SoftwareApplication"');
		if (content.faqs.length > 0) expect(body).toContain('"@type":"FAQPage"');
	});

	test.each(Object.keys(features))(
		"shows a product visual beside the %s page's steps",
		async (slug) => {
			let response = await getFeature(slug);

			let body = await response.text();
			let band = body.slice(body.indexOf('id="how-it-works"'), body.indexOf('id="faq"'));
			expect(band).toContain(features[slug]!.steps[0]!.title);
			expect(band).toMatch(/role="img"|data-variant="code"|<ol[^>]*aria-label=/);
		},
	);

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getFeature("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});

	test("permanently redirects browser-flows to the dedicated landing", async () => {
		let response = await getFeature("browser-flows");

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe(routes.browserFlows.href());
	});
});
