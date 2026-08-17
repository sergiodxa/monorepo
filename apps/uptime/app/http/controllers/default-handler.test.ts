/**
 * Tests the fetch-router's default (catch-all 404) handler: any request that matches
 * no route renders the shared not-found page with a 404 status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import i18n from "~/app/http/middleware/i18n";

import defaultHandler from "./default-handler";

/** Sets the `Auth` context state directly, standing in for the real session-backed `auth` middleware. `i18n`'s language detection reads the signed-in viewer to look up their saved language preference. */
function seedAuth(): Middleware {
	return (ctx, next) => {
		ctx.set(Auth, { ok: false });
		return next();
	};
}

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

describe("default handler", () => {
	test("renders the not-found page with a 404 status for any unmatched route", async () => {
		// `i18n` (rather than a stub) — `defaultHandler` renders its copy through
		// `ctx.i18next.t()`, and the global `i18n` middleware wraps the whole
		// router (see `bootstrap/app.tsx`), `defaultHandler` included.
		let router = createRouter({
			middleware: [
				asyncContext(),
				seedAuth(),
				i18n as Middleware,
				renderWith(createTestRenderer) as Middleware,
			],
			defaultHandler,
		});

		let response = await router.fetch(new Request("https://uptime.test/this-route-does-not-exist"));

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
		expect(body).toContain("The page you're looking for doesn't exist or may have moved.");
		expect(body).toContain("Go back home");
	});
});
