/**
 * Drives `/colors` through the real router inside workerd, holding the page to the static
 * lifetime: its tokens ship with the code, so the edge keeps it until the next deploy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { STATIC_PAGE } from "~/app/initializers/cache";
import { createWebRouter } from "~/app/initializers/router";

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

describe("GET /colors", () => {
	test("is cached at the edge until the next deploy, with no tag to purge", async () => {
		let response = await createWebRouter(environment()).fetch(
			new Request("https://blog.test/colors"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe(STATIC_PAGE);
		expect(response.headers.has("cache-tag")).toBe(false);
	});
});
