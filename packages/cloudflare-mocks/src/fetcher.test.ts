/**
 * Tests for the fetcher mock: the handler answers, every request is recorded as a real
 * `Request` whatever shape the caller passed, and a handler that throws still leaves the
 * request behind as evidence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createFetcher } from "./fetcher.js";

describe("createFetcher", () => {
	test("answers with the handler's response", async () => {
		let fetcher = createFetcher(() => new Response("ok", { status: 201 }));

		let response = await fetcher.fetch("https://example.com/");

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("ok");
	});

	test("hands the handler a Request built from a URL string", async () => {
		let fetcher = createFetcher((request) => new Response(request.url));

		let response = await fetcher.fetch("https://example.com/logo.png");

		expect(await response.text()).toBe("https://example.com/logo.png");
	});

	test("preserves method and headers from the init", async () => {
		let fetcher = createFetcher(
			(request) => new Response(`${request.method}:${request.headers.get("x-tenant") ?? ""}`),
		);

		let response = await fetcher.fetch("https://example.com/", {
			method: "POST",
			headers: { "x-tenant": "acme" },
		});

		expect(await response.text()).toBe("POST:acme");
	});

	test("records the requests it answered", async () => {
		let fetcher = createFetcher(() => new Response(null, { status: 404 }));

		await fetcher.fetch("https://example.com/one");
		await fetcher.fetch(new Request("https://example.com/two", { method: "DELETE" }));

		expect(fetcher.requests.map((request) => request.url)).toEqual([
			"https://example.com/one",
			"https://example.com/two",
		]);
		expect(fetcher.requests[1]?.method).toBe("DELETE");
	});

	test("records a request whose handler threw", async () => {
		let fetcher = createFetcher(() => {
			throw new Error("upstream down");
		});

		await expect(fetcher.fetch("https://example.com/boom")).rejects.toThrow("upstream down");

		expect(fetcher.requests).toHaveLength(1);
	});

	test("records a clone, so the handler can still read the body", async () => {
		let fetcher = createFetcher(async (request) => new Response(await request.text()));

		let response = await fetcher.fetch("https://example.com/", {
			method: "POST",
			body: "payload",
		});

		expect(await response.text()).toBe("payload");
		expect(await fetcher.requests[0]?.text()).toBe("payload");
	});

	test("reset discards the recorded requests", async () => {
		let fetcher = createFetcher(() => new Response("ok"));

		await fetcher.fetch("https://example.com/");
		fetcher.reset();

		expect(fetcher.requests).toHaveLength(0);
	});

	test("rejects raw socket connections", () => {
		let fetcher = createFetcher(() => new Response("ok"));

		expect(() => fetcher.connect("example.com:443")).toThrow("not implemented");
	});
});
