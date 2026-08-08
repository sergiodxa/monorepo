/**
 * Tests for `headRequests()`.
 *
 * The contract is that a `HEAD` becomes indistinguishable from its `GET` except
 * for the missing body: same status, same headers, same middleware chain — so a
 * guard that refuses the `GET` refuses the `HEAD` too, and a route with no `GET`
 * stays unreachable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";

import { createRouter } from "remix/fetch-router";

import { headRequests } from "./head-requests";

/** Refuses every request with a 401, standing in for an app's auth guard. */
const requireAuth: Middleware = (_context, _next) => {
	return new Response("unauthorized", { status: 401 });
};

/** Builds a router with the middleware installed and a few representative routes. */
function createTestRouter() {
	let router = createRouter({
		middleware: [headRequests()],
		defaultHandler: () => new Response("not found", { status: 404 }),
	});

	router.get("/page", () => {
		return new Response("hello", {
			status: 200,
			headers: { "Content-Type": "text/html; charset=utf-8", "Content-Length": "5" },
		});
	});

	router.get("/redirect", () => {
		return new Response(null, { status: 303, headers: { Location: "/page" } });
	});

	router.post("/submit", () => new Response("created", { status: 201 }));

	router.get("/private", { middleware: [requireAuth], handler: () => new Response("secret") });

	router.get("/method", (context) => new Response(context.method));

	return router;
}

describe(headRequests, () => {
	test("answers a HEAD to a GET route with the GET's status and headers, and no body", async () => {
		let router = createTestRouter();

		let get = await router.fetch(new Request("https://example.com/page"));
		let head = await router.fetch(new Request("https://example.com/page", { method: "HEAD" }));

		expect(head.status).toBe(get.status);
		expect(head.headers.get("Content-Type")).toBe(get.headers.get("Content-Type"));
		expect(head.headers.get("Content-Length")).toBe(get.headers.get("Content-Length"));
		expect(await head.text()).toBe("");
	});

	test("keeps a redirect's status and Location", async () => {
		let router = createTestRouter();

		let response = await router.fetch(
			new Request("https://example.com/redirect", { method: "HEAD" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/page");
	});

	test("still 404s a HEAD to a route that has no GET", async () => {
		let router = createTestRouter();

		let response = await router.fetch(
			new Request("https://example.com/submit", { method: "HEAD" }),
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	test("404s a HEAD to a path with no route at all", async () => {
		let router = createTestRouter();

		let response = await router.fetch(
			new Request("https://example.com/missing", { method: "HEAD" }),
		);

		expect(response.status).toBe(404);
	});

	test("does not bypass an auth guard", async () => {
		let router = createTestRouter();

		let get = await router.fetch(new Request("https://example.com/private"));
		let head = await router.fetch(new Request("https://example.com/private", { method: "HEAD" }));

		expect(get.status).toBe(401);
		expect(head.status).toBe(401);
		expect(await head.text()).toBe("");
	});

	test("presents the request to the rest of the chain as a GET", async () => {
		let seen: string[] = [];
		let router = createRouter({ middleware: [headRequests()] });
		router.get("/method", (context) => {
			seen.push(context.method);
			return new Response("ok");
		});

		await router.fetch(new Request("https://example.com/method", { method: "HEAD" }));

		expect(seen).toEqual(["GET"]);
	});

	test("leaves a GET request untouched", async () => {
		let router = createTestRouter();

		let response = await router.fetch(new Request("https://example.com/method"));

		expect(await response.text()).toBe("GET");
	});

	test("leaves a POST request untouched", async () => {
		let router = createTestRouter();

		let response = await router.fetch(
			new Request("https://example.com/submit", { method: "POST" }),
		);

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("created");
	});
});
