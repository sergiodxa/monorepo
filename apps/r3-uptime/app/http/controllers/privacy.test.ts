/**
 * Tests the `/privacy` controller: it renders the static Privacy Policy page inside
 * the shared document/marketing chrome for both anonymous and signed-in viewers, with
 * the `MarketingLayout` header CTA switching between the two.
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

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import privacy from "./privacy";

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
 * Dispatches a real GET request to `/privacy` with the given signed-in state. Includes
 * the real `i18n` middleware (required by `getViewer()`'s downstream usage in the
 * shared chrome) backed by an empty test database.
 */
async function getPrivacy(viewer: Viewer | null) {
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
	router.map(routes.legal.privacy, privacy);

	let request = new Request(`https://uptime.test${routes.legal.privacy.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /privacy", () => {
	test("renders the Privacy Policy page for an anonymous visitor", async () => {
		let response = await getPrivacy(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Privacy Policy | Uptime</title>");
		expect(body).toContain("<h1>Privacy Policy</h1>");
		// Anonymous: the header CTA is a sign-in form posting to the auth action.
		expect(body).toContain(`action="${routes.auth.action.href()}"`);
	});

	test("renders the Privacy Policy page for a signed-in viewer", async () => {
		let viewer: Viewer = {
			id: "user-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			avatar: "",
		};

		let response = await getPrivacy(viewer);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<h1>Privacy Policy</h1>");
		// Signed in: the header CTA links straight to the dashboard instead.
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});
});
