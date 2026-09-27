/**
 * Tests for `trailingSlash()`, driven through a real `remix/router` so the
 * redirect is observed exactly as a client receives it: status, `Location`, and
 * whether the matched handler ran at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { TrailingSlashOptions } from "./index.js";

import { trailingSlash } from "./index.js";

/**
 * Builds a router whose every route answers `200 ok`, so any other status in a
 * test comes from the middleware.
 */
function createApp(options?: TrailingSlashOptions) {
	let router = createRouter({ middleware: [trailingSlash(options)] });
	router.route("ANY", "*path", () => new Response("ok"));
	return router;
}

/** Sends `path` through the middleware and returns the response, redirects unfollowed. */
async function send(options: TrailingSlashOptions | undefined, path: string, init?: RequestInit) {
	return createApp(options).fetch(new Request(`https://example.com${path}`, init));
}

describe(trailingSlash, () => {
	describe("never mode (default)", () => {
		test("redirects a path ending in / to its slash-free form with a 308", async () => {
			let response = await send(undefined, "/posts/");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/posts");
		});

		test("uses never mode when mode is set explicitly", async () => {
			let response = await send({ mode: "never" }, "/a/b/");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/a/b");
		});

		test("passes a slash-free path through to the handler", async () => {
			let response = await send(undefined, "/posts");
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("ok");
		});

		test("leaves the root path alone", async () => {
			let response = await send(undefined, "/");
			expect(response.status).toBe(200);
		});

		test("collapses a run of trailing slashes in a single redirect", async () => {
			let response = await send(undefined, "/posts///");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/posts");
		});

		test("redirects a root made only of slashes to /", async () => {
			let response = await send(undefined, "//");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/");
		});

		test("strips the slash from a file-like path too", async () => {
			let response = await send(undefined, "/robots.txt/");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/robots.txt");
		});

		test("keeps a leading-slash run as a same-origin path, never a protocol-relative one", async () => {
			let response = await send(undefined, "//evil.example/");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com//evil.example");
		});
	});

	describe("always mode", () => {
		test("redirects a path without a trailing slash to the slashed form with a 308", async () => {
			let response = await send({ mode: "always" }, "/posts");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/posts/");
		});

		test("passes a slashed path through to the handler", async () => {
			let response = await send({ mode: "always" }, "/posts/");
			expect(response.status).toBe(200);
		});

		test("leaves the root path alone", async () => {
			let response = await send({ mode: "always" }, "/");
			expect(response.status).toBe(200);
		});

		test("collapses a run of trailing slashes to one", async () => {
			let response = await send({ mode: "always" }, "/posts//");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/posts/");
		});

		test("redirects a root made only of slashes to /", async () => {
			let response = await send({ mode: "always" }, "///");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/");
		});

		test.each(["/robots.txt", "/feed.xml", "/assets/app.min.js", "/.well-known/security.txt"])(
			"leaves the file-like path %s alone",
			async (path) => {
				let response = await send({ mode: "always" }, path);
				expect(response.status).toBe(200);
			},
		);

		test("judges a file only by the last segment", async () => {
			let response = await send({ mode: "always" }, "/v1.2/docs");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/v1.2/docs/");
		});

		test("keeps a slashed path whose last segment has a dot as it is", async () => {
			let response = await send({ mode: "always" }, "/tags/node.js/");
			expect(response.status).toBe(200);
		});

		test("still collapses the trailing run of a slashed path whose last segment has a dot", async () => {
			let response = await send({ mode: "always" }, "/tags/node.js//");
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/tags/node.js/");
		});
	});

	describe("redirect contract", () => {
		test.each([
			{ mode: "never" as const, path: "/search/" },
			{ mode: "always" as const, path: "/search" },
		])("preserves the query string in $mode mode", async ({ mode, path }) => {
			let response = await send({ mode }, `${path}?q=a%20b&page=2`);
			let location = new URL(response.headers.get("Location") ?? "");
			expect(location.search).toBe("?q=a%20b&page=2");
		});

		test("preserves the origin, port included", async () => {
			let response = await createApp().fetch(new Request("http://localhost:8787/posts/"));
			expect(response.headers.get("Location")).toBe("http://localhost:8787/posts");
		});

		test("uses 308 for a POST so the client repeats the method and body", async () => {
			let response = await send(undefined, "/comments/", { method: "POST", body: "text=hi" });
			expect(response.status).toBe(308);
			expect(response.headers.get("Location")).toBe("https://example.com/comments");
		});

		test("answers before the handler runs", async () => {
			let calls = 0;
			let router = createRouter({ middleware: [trailingSlash()] });
			router.get("*path", () => {
				calls += 1;
				return new Response("ok");
			});
			await router.fetch(new Request("https://example.com/posts/"));
			expect(calls).toBe(0);
		});

		test("returns a response whose headers an outer middleware can still set", async () => {
			let router = createRouter({
				middleware: [
					async (_context, next) => {
						let response = await next();
						response.headers.set("X-Outer", "1");
						return response;
					},
					trailingSlash(),
				],
			});
			router.get("*path", () => new Response("ok"));
			let response = await router.fetch(new Request("https://example.com/posts/"));
			expect(response.headers.get("X-Outer")).toBe("1");
		});
	});
});
