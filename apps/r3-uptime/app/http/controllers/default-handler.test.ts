/**
 * Tests the fetch-router's default (catch-all 404) handler: any request that matches
 * no route renders the shared not-found page with a 404 status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

import defaultHandler from "./default-handler";

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
		let router = createRouter({
			middleware: [renderWith(createTestRenderer) as Middleware],
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
