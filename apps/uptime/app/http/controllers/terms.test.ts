/**
 * Tests the `/terms` controller: it renders the static Terms of Service page inside
 * the shared document/marketing chrome for both anonymous and signed-in viewers, with
 * the `MarketingLayout` header CTA switching between the two, and emits its canonical
 * URL, meta description, and article Open Graph type in `<head>`. The canonical URL is
 * always built from the product's own origin, regardless of the host a request arrives on.
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

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import terms from "./terms";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Sets the `Auth` context state directly, standing in for the real session-backed `auth` middleware. */
function seedAuth(viewer: Viewer | null): Middleware {
	return (ctx, next) => {
		if (viewer) ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		else ctx.set(Auth, { ok: false });
		return next();
	};
}

/**
 * Dispatches a real GET request to `/terms` with the given signed-in state. Includes
 * the real `i18n` middleware (required by `getViewer()`'s downstream usage in the
 * shared chrome) backed by an empty test database.
 */
async function getTerms(viewer: Viewer | null) {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			seedAuth(viewer),
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.legal.terms, terms);

	let request = new Request(`https://uptime.test${routes.legal.terms.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /terms", () => {
	test("renders the Terms of Service page for an anonymous visitor", async () => {
		let response = await getTerms(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Terms of Service | Uptime</title>");
		expect(body).toContain("<h1>Terms of Service</h1>");
		expect(body).toContain(`action="${routes.auth.action.href()}"`);
	});

	test("emits the canonical URL, meta description, and article Open Graph type in <head>", async () => {
		let response = await getTerms(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(
			`<link rel="canonical" href="${SEO.baseUrl}${routes.legal.terms.href()}" />`,
		);
		expect(body).toContain(
			'<meta name="description" content="Terms of Service for Uptime, the uptime monitoring service by Sergio Xalambrí." />',
		);
		expect(body).toContain('<meta property="og:type" content="article" />');
	});

	test("renders the Terms of Service page for a signed-in viewer", async () => {
		let viewer: Viewer = {
			id: "user-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			avatar: "",
		};

		let response = await getTerms(viewer);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<h1>Terms of Service</h1>");
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});
});
