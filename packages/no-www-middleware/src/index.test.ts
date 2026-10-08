/**
 * Tests for `noWWW()`, driven through a real `remix/router` so the redirect is observed
 * exactly as a client receives it: status, `Location`, and whether the matched handler ran.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { noWWW } from "./index.js";

/**
 * Builds a router whose every route answers `200 ok`, so any other status in a test comes
 * from the middleware.
 */
function createApp() {
	let router = createRouter({ middleware: [noWWW()] });
	router.route("ANY", "*path", () => new Response("ok"));
	return router;
}

/** Sends `url` through the middleware and returns the response, redirects unfollowed. */
async function send(url: string, init?: RequestInit) {
	return createApp().fetch(new Request(url, init));
}

describe(noWWW, () => {
	test("redirects a www. hostname to the apex domain with a 308", async () => {
		let response = await send("https://www.example.com/posts");
		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe("https://example.com/posts");
	});

	test("passes an apex hostname through to the handler", async () => {
		let response = await send("https://example.com/posts");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	test("passes a hostname that only contains www elsewhere through", async () => {
		let response = await send("https://blog.www.example.com/");
		expect(response.status).toBe(200);
	});

	test("passes a hostname starting with www but no dot after it through", async () => {
		let response = await send("https://wwwexample.com/");
		expect(response.status).toBe(200);
	});

	test("matches the prefix regardless of the case the client sent", async () => {
		let response = await send("https://WWW.Example.com/");
		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe("https://example.com/");
	});

	test("strips only the leading www. label", async () => {
		let response = await send("https://www.www.example.com/");
		expect(response.headers.get("Location")).toBe("https://www.example.com/");
	});

	test("preserves scheme, port, path and query string", async () => {
		let response = await send("http://www.localhost:8787/search/?q=a%20b&page=2");
		expect(response.headers.get("Location")).toBe("http://localhost:8787/search/?q=a%20b&page=2");
	});

	test("uses 308 for a POST so the client repeats the method and body", async () => {
		let response = await send("https://www.example.com/comments", {
			method: "POST",
			body: "text=hi",
		});
		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe("https://example.com/comments");
	});

	test("answers before the handler runs", async () => {
		let calls = 0;
		let router = createRouter({ middleware: [noWWW()] });
		router.get("*path", () => {
			calls += 1;
			return new Response("ok");
		});
		await router.fetch(new Request("https://www.example.com/posts"));
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
				noWWW(),
			],
		});
		router.get("*path", () => new Response("ok"));
		let response = await router.fetch(new Request("https://www.example.com/posts"));
		expect(response.headers.get("X-Outer")).toBe("1");
	});
});
