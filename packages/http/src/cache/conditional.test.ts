/**
 * Tests for `conditional()`.
 *
 * The header allow-list and the `Vary` case are the important assertions: a `304`
 * that leaks payload headers confuses clients, and one that omits `Vary` lets a
 * shared cache serve a negotiated variant to the wrong client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { conditional } from "./conditional";

/** The modification time the fixtures below advertise. */
const LAST_MODIFIED = "Wed, 21 Oct 2015 07:28:00 GMT";

/** Builds a request carrying the given conditional headers. */
function createRequest(headers: HeadersInit, method = "GET"): Request {
	return new Request("https://example.com/page", { method, headers });
}

/** Builds a fully-headed 200 response, including headers a 304 must drop. */
function createResponse(headers?: HeadersInit): Response {
	return new Response("<h1>Hello</h1>", {
		status: 200,
		headers: headers ?? {
			"Content-Type": "text/html",
			"Cache-Control": "public, max-age=60",
			"Content-Location": "/en/page",
			Date: LAST_MODIFIED,
			ETag: '"abc"',
			Expires: "Wed, 21 Oct 2015 08:28:00 GMT",
			Vary: "accept-language",
			"X-Request-Id": "42",
		},
	});
}

describe(conditional, () => {
	test("answers a matching If-None-Match with an empty 304", async () => {
		let response = await conditional(createRequest({ "If-None-Match": '"abc"' }), createResponse());

		expect(response.status).toBe(304);
		expect(response.statusText).toBe("Not Modified");
		expect(await response.text()).toBe("");
	});

	test("carries only the headers a 304 is allowed to carry", async () => {
		let response = await conditional(createRequest({ "If-None-Match": '"abc"' }), createResponse());

		expect([...response.headers.keys()].sort()).toEqual([
			"cache-control",
			"content-location",
			"date",
			"etag",
			"expires",
			"vary",
		]);
		expect(response.headers.get("Content-Type")).toBeNull();
		expect(response.headers.get("X-Request-Id")).toBeNull();
	});

	test("repeats Vary, so a shared cache still knows which variant was validated", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"abc"', "Accept-Language": "en" }),
			createResponse({ ETag: '"abc"', Vary: "accept-language" }),
		);

		expect(response.status).toBe(304);
		expect(response.headers.get("Vary")).toBe("accept-language");
	});

	test("compares entity tags weakly, so W/ on the request still matches", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": 'W/"abc"' }),
			createResponse({ ETag: '"abc"' }),
		);

		expect(response.status).toBe(304);
	});

	test("compares entity tags weakly, so W/ on the response still matches", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"abc"' }),
			createResponse({ ETag: 'W/"abc"' }),
		);

		expect(response.status).toBe(304);
	});

	test("matches any of the tags the client lists", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"other", "abc"' }),
			createResponse({ ETag: '"abc"' }),
		);

		expect(response.status).toBe(304);
	});

	test("treats a wildcard as a match, since a representation exists", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": "*" }),
			createResponse({ ETag: '"abc"' }),
		);

		expect(response.status).toBe(304);
	});

	test("sends the body when the tags differ", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"stale"' }),
			createResponse({ ETag: '"abc"' }),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<h1>Hello</h1>");
	});

	test("sends the body when the response has no entity tag to compare", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"abc"' }),
			createResponse({ "Content-Type": "text/html" }),
		);

		expect(response.status).toBe(200);
	});

	test("answers 304 when If-Modified-Since is the modification time", async () => {
		let response = await conditional(
			createRequest({ "If-Modified-Since": LAST_MODIFIED }),
			createResponse({ "Last-Modified": LAST_MODIFIED }),
		);

		expect(response.status).toBe(304);
	});

	test("sends the body when the content changed after the client's copy", async () => {
		let response = await conditional(
			createRequest({ "If-Modified-Since": "Wed, 21 Oct 2015 07:27:00 GMT" }),
			createResponse({ "Last-Modified": LAST_MODIFIED }),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<h1>Hello</h1>");
	});

	test("answers 304 when the client's copy is newer than the content", async () => {
		let response = await conditional(
			createRequest({ "If-Modified-Since": "Wed, 21 Oct 2015 07:29:00 GMT" }),
			createResponse({ "Last-Modified": LAST_MODIFIED }),
		);

		expect(response.status).toBe(304);
	});

	test("ignores If-Modified-Since when the response has no Last-Modified", async () => {
		let response = await conditional(
			createRequest({ "If-Modified-Since": LAST_MODIFIED }),
			createResponse({ "Content-Type": "text/html" }),
		);

		expect(response.status).toBe(200);
	});

	test("lets an entity tag decide even when a date also arrives", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"stale"', "If-Modified-Since": LAST_MODIFIED }),
			createResponse({ ETag: '"abc"', "Last-Modified": LAST_MODIFIED }),
		);

		expect(response.status).toBe(200);
	});

	test("answers a conditional HEAD, which also carries no body", async () => {
		let response = await conditional(
			createRequest({ "If-None-Match": '"abc"' }, "HEAD"),
			createResponse({ ETag: '"abc"' }),
		);

		expect(response.status).toBe(304);
	});

	test("passes a non-GET method through untouched", async () => {
		let original = createResponse({ ETag: '"abc"' });
		let response = await conditional(createRequest({ "If-None-Match": '"abc"' }, "POST"), original);

		expect(response).toBe(original);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<h1>Hello</h1>");
	});

	test("passes a request with no validators through untouched", async () => {
		let original = createResponse();
		let response = await conditional(createRequest({}), original);

		expect(response).toBe(original);
		expect(response.status).toBe(200);
	});

	test("never downgrades a response that is not a 200", async () => {
		let original = new Response("<h1>Not Found</h1>", {
			status: 404,
			headers: { ETag: '"abc"' },
		});
		let response = await conditional(createRequest({ "If-None-Match": '"abc"' }), original);

		expect(response).toBe(original);
		expect(response.status).toBe(404);
	});
});
