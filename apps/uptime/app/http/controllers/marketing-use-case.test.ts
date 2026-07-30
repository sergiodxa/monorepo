/**
 * Tests the `/use-cases/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `useCases` record renders that page's content (200) along with its canonical URL and
 * `FAQPage` structured data, and an unknown slug renders the same not-found page the
 * router's `defaultHandler` uses (404).
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
import { useCases } from "~/resources/content/marketing";
import routes from "~/routes/web";

import marketingUseCase from "./marketing-use-case";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/use-cases/:slug` as an anonymous visitor. */
async function getUseCase(slug: string) {
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
	router.map(routes.marketing.useCase, marketingUseCase);

	let request = new Request(`https://uptime.test${routes.marketing.useCase.href({ slug })}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /use-cases/:slug", () => {
	test("renders a real use-case page", async () => {
		let slug = Object.keys(useCases)[0];
		if (!slug) throw new Error("expected at least one use-case page");
		let content = useCases[slug]!;

		let response = await getUseCase(slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${content.metaTitle}</title>`);
		expect(body).toContain(content.title);
	});

	test("advertises its canonical URL and FAQ structured data", async () => {
		let slug = Object.keys(useCases)[0];
		if (!slug) throw new Error("expected at least one use-case page");
		let content = useCases[slug]!;

		let response = await getUseCase(slug);

		let body = await response.text();
		// Canonical on the production origin, not the `uptime.test` host that served it.
		expect(body).toContain(
			`<link rel="canonical" href="https://uptime.sergiodxa.com/use-cases/${slug}"`,
		);
		if (content.faqs.length > 0) expect(body).toContain('"@type":"FAQPage"');
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getUseCase("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});
});
