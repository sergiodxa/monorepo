/**
 * Tests the blog's cache vocabulary against the middleware that consumes it:
 * that a post declaration survives to the response headers for a reader, and
 * that the same declaration is refused once the visitor carries a session, which
 * is what keeps an admin's preview of an unpublished post off the edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRecordingCache, NON_CACHEABLE_POLICY } from "@sdxc/workers-cache";
import workersCache from "@sdxc/workers-cache/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { PUBLIC_PAGE, TAGS } from "./cache";

/**
 * Serves one post route through the real middleware, registered the way the
 * composition root registers it.
 */
function fetchPost(headers?: HeadersInit) {
	let cache = createRecordingCache();
	let router = createRouter({ middleware: [workersCache({ cache: () => cache })] });

	router.get("/articles/hello", (ctx) => {
		ctx.cache(PUBLIC_PAGE, TAGS.post("articles", "hello"));
		return new Response("post");
	});

	return router.fetch(new Request("https://blog.test/articles/hello", { headers }));
}

describe("the post cache declaration", () => {
	test("reaches a reader as a public policy carrying the post's tag", async () => {
		let response = await fetchPost();

		expect(response.headers.get("Cache-Control")).toBe(PUBLIC_PAGE);
		expect(response.headers.get("Cache-Tag")).toBe("post:articles:hello");
	});

	test("keeps browsers revalidating, so a purge is never raced by a stale copy", () => {
		expect(PUBLIC_PAGE).toContain("max-age=0");
		expect(PUBLIC_PAGE).toContain("must-revalidate");
	});

	test("is refused for an identified visitor, tag included", async () => {
		let response = await fetchPost({ Cookie: "session=abc" });

		expect(response.headers.get("Cache-Control")).toBe(NON_CACHEABLE_POLICY);
		expect(response.headers.get("Cache-Tag")).toBeNull();
	});
});
