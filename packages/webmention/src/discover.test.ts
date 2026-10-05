/**
 * Runs every webmention.rocks discovery test against `endpointOf`, then checks the
 * bounded fetch around it: redirects before a relative endpoint, refused endpoint
 * hosts, and which statuses are worth a retry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { advertise, discover, endpointOf } from "./discover.js";
import { DISCOVERY_CASES } from "./fixtures/discovery.js";

/** What every fetch in this file asks under. */
const AGENT = "ExampleSender/1.0 (+https://example.com/sender)";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The response a discovery test page is served as. */
function responseFor(headers: [string, string][], body: string): Response {
	return new Response(body, {
		headers: [...headers, ["Content-Type", "text/html; charset=UTF-8"]],
	});
}

describe("endpointOf, against the webmention.rocks discovery tests", () => {
	test("covers all 23 tests", () => {
		expect(DISCOVERY_CASES.map((entry) => entry.test)).toEqual(
			Array.from({ length: 23 }, (_, index) => index + 1),
		);
	});

	test.each(DISCOVERY_CASES)("#$test: $description", async (entry) => {
		let endpoint = await endpointOf(responseFor(entry.headers, entry.body), entry.url);
		expect(endpoint?.href).toBe(entry.endpoint);
	});

	test("finds nothing on a page that advertises nothing", async () => {
		let response = responseFor([], `<p><a href="/webmention" rel="nofollow">x</a></p>`);
		expect(await endpointOf(response, "https://example.com/post")).toBeNull();
	});

	test("reads no body that is not HTML", async () => {
		let response = new Response(`<link rel="webmention" href="/wm">`, {
			headers: { "Content-Type": "text/plain" },
		});
		expect(await endpointOf(response, "https://example.com/post")).toBeNull();
	});
});

describe("discover", () => {
	test("follows the redirect in test #23 before resolving the relative endpoint", async () => {
		let entry = DISCOVERY_CASES.find((candidate) => candidate.test === 23);
		if (!entry?.redirectedFrom) throw new Error("test #23 is missing its redirect");
		let { url, headers, body } = entry;

		server.use(
			http.get(entry.redirectedFrom, () => HttpResponse.redirect(url, 302)),
			http.get(url, () => responseFor(headers, body)),
		);

		let result = await discover(entry.redirectedFrom, { userAgent: AGENT });

		expect(isSuccess(result) && result.data?.href).toBe(entry.endpoint);
	});

	test("reads the endpoint from the markup when no header names one", async () => {
		server.use(
			http.get("https://example.com/post", () =>
				HttpResponse.html(`<html><head><link rel="webmention" href="/wm?x=1"></head></html>`),
			),
		);

		let result = await discover("https://example.com/post", { userAgent: AGENT });

		expect(isSuccess(result) && result.data?.href).toBe("https://example.com/wm?x=1");
	});

	test("refuses an endpoint on a private host", async () => {
		server.use(
			http.get(
				"https://example.com/post",
				() =>
					new HttpResponse(null, {
						headers: { Link: `<http://127.0.0.1:8080/admin>; rel="webmention"` },
					}),
			),
		);

		let result = await discover("https://example.com/post", { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test("answers null for a target that answers 404", async () => {
		server.use(
			http.get("https://example.com/missing", () => new HttpResponse(null, { status: 404 })),
		);

		let result = await discover("https://example.com/missing", { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toBeNull();
	});

	test("reports a 5xx target as retryable", async () => {
		server.use(http.get("https://example.com/down", () => new HttpResponse(null, { status: 503 })));

		let result = await discover("https://example.com/down", { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("refuses an endpoint carrying credentials or on a reserved name", async () => {
		for (let endpoint of ["https://u:p@example.com/wm", "https://wm.home.arpa/"]) {
			server.use(
				http.get(
					"https://example.com/post",
					() => new HttpResponse(null, { headers: { Link: `<${endpoint}>; rel="webmention"` } }),
				),
			);

			let result = await discover("https://example.com/post", { userAgent: AGENT });

			expect(isFailure(result) && result.error.retryable).toBe(false);
		}
	});

	test("refuses a private target before any request", async () => {
		let result = await discover("http://localhost/post", { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test("refuses a target that is not an absolute URL", async () => {
		let result = await discover("/post", { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});
});

describe("advertise", () => {
	test("writes the Link header value and the <link> attributes", () => {
		expect(advertise(new URL("https://example.com/webmention"))).toEqual({
			header: `<https://example.com/webmention>; rel="webmention"`,
			link: { rel: "webmention", href: "https://example.com/webmention" },
		});
	});

	test("keeps a relative path relative, and discovery reads it back", async () => {
		let { header } = advertise("/webmention");
		let endpoint = await endpointOf(
			new Response(null, { headers: { Link: header } }),
			"https://example.com/post",
		);
		expect(endpoint?.href).toBe("https://example.com/webmention");
	});
});
