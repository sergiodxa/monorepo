/**
 * Tests getClientIP's discovery: a platform's single-address header, the
 * Forwarded and X-Forwarded-For lists read from the right, the Cloudflare
 * runtime marker, and every forged or conflicting combination answering `null`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { CLIENT_IP_HEADERS, getClientIP } from "./index.js";

/** The address getClientIP answers for the given headers, as text. */
function read(init: HeadersInit): string | null {
	return getClientIP(new Request("https://example.com", { headers: init }))?.toString() ?? null;
}

/** A request carrying Cloudflare's `cf` marker, as the Workers runtime delivers one. */
function cloudflareRequest(init: HeadersInit): Request {
	let request = new Request("https://example.com", { headers: init });
	Object.defineProperty(request, "cf", { value: { country: "US" } });
	return request;
}

describe("getClientIP", () => {
	test("parses an IPv4 address", () => {
		let ip = getClientIP(new Headers({ "CF-Connecting-IP": "203.0.113.42" }));

		expect(ip?.version).toBe(4);
		expect(ip?.toString()).toBe("203.0.113.42");
	});

	test("parses an IPv6 address into its canonical text", () => {
		expect(read({ "CF-Connecting-IP": "2001:0db8:85a3:0000:0000:8a2e:0370:7334" })).toBe(
			"2001:db8:85a3::8a2e:370:7334",
		);
	});

	test.each(
		CLIENT_IP_HEADERS.filter((name) => name !== "CloudFront-Viewer-Address").map((name) => [name]),
	)("discovers %s", (name) => {
		expect(read({ [name]: "203.0.113.42" })).toBe("203.0.113.42");
	});

	test.each([["X-Forwarded-For"], ["X-Vercel-Forwarded-For"]])("discovers %s", (name) => {
		expect(read({ [name]: "10.0.0.1, 203.0.113.42" })).toBe("203.0.113.42");
	});

	test("drops the port CloudFront appends to the viewer address", () => {
		expect(read({ "CloudFront-Viewer-Address": "203.0.113.42:46532" })).toBe("203.0.113.42");
		expect(
			read({ "CloudFront-Viewer-Address": "2001:0db8:85a3:0000:0000:8a2e:0370:7334:46532" }),
		).toBe("2001:db8:85a3::8a2e:370:7334");
	});

	test("returns null for a CloudFront viewer address without a port", () => {
		expect(read({ "CloudFront-Viewer-Address": "203.0.113.42" })).toBeNull();
	});

	test("returns null without any header", () => {
		expect(read({})).toBeNull();
	});

	test.each([["unknown"], [""], ["10.0.0"], ["example.com"], ["203.0.113.42, 198.51.100.1"]])(
		"returns null for the malformed header %j",
		(value) => {
			expect(read({ "X-Real-IP": value })).toBeNull();
		},
	);

	test("returns null for a header repeated across several lines", () => {
		let headers = new Headers();
		headers.append("CF-Connecting-IP", "203.0.113.42");
		headers.append("CF-Connecting-IP", "198.51.100.1");

		expect(getClientIP(headers)).toBeNull();
	});
});

describe("getClientIP with several headers", () => {
	test("answers the address every present header agrees on", () => {
		expect(read({ "Fly-Client-IP": "203.0.113.42", "X-Real-IP": "203.0.113.42" })).toBe(
			"203.0.113.42",
		);
	});

	test("returns null when a client adds a header naming another address", () => {
		expect(read({ "X-Client-IP": "10.0.0.1", "Fly-Client-IP": "203.0.113.42" })).toBeNull();
	});

	test("returns null when a client adds a malformed header", () => {
		expect(read({ "True-Client-IP": "nope", "Fly-Client-IP": "203.0.113.42" })).toBeNull();
	});

	test("prefers a platform header over the proxy lists", () => {
		let headers = { "Fly-Client-IP": "203.0.113.42", "X-Forwarded-For": "203.0.113.42, 10.0.0.9" };

		expect(read(headers)).toBe("203.0.113.42");
	});
});

describe("getClientIP with X-Forwarded-For", () => {
	test("answers the entry the proxy appended, not the one the client wrote", () => {
		expect(read({ "X-Forwarded-For": "10.0.0.1, 203.0.113.42" })).toBe("203.0.113.42");
	});

	test("joins repeated header lines in order", () => {
		let headers = new Headers();
		headers.append("X-Forwarded-For", "10.0.0.1");
		headers.append("X-Forwarded-For", "203.0.113.42");

		expect(getClientIP(headers)?.toString()).toBe("203.0.113.42");
	});

	test("drops a port the proxy appended", () => {
		expect(read({ "X-Forwarded-For": "203.0.113.42:4711" })).toBe("203.0.113.42");
		expect(read({ "X-Forwarded-For": "[2001:db8::1]:4711" })).toBe("2001:db8::1");
		expect(read({ "X-Forwarded-For": "2001:db8::1" })).toBe("2001:db8::1");
	});

	test.each([["10.0.0.1, unknown"], ["10.0.0.1, "], ["203.0.113.42:port"]])(
		"returns null when the last entry of %j is not an address",
		(value) => {
			expect(read({ "X-Forwarded-For": value })).toBeNull();
		},
	);
});

describe("getClientIP with Forwarded", () => {
	test("reads the for parameter of the last element", () => {
		let value = "for=10.0.0.1, for=203.0.113.42;proto=https;by=198.51.100.9";

		expect(read({ Forwarded: value })).toBe("203.0.113.42");
	});

	test("reads a quoted IPv6 address with a port", () => {
		expect(read({ Forwarded: 'For="[2001:db8:cafe::17]:4711"' })).toBe("2001:db8:cafe::17");
	});

	test("keeps an unclosed quote the client wrote from swallowing the proxy's element", () => {
		expect(read({ Forwarded: 'for="10.0.0.1, for=203.0.113.42' })).toBe("203.0.113.42");
	});

	test("returns null when it disagrees with X-Forwarded-For", () => {
		expect(read({ Forwarded: "for=10.0.0.1", "X-Forwarded-For": "203.0.113.42" })).toBeNull();
	});

	test.each([["for=unknown"], ["for=_hidden"], ["proto=https"], ["for=10.0.0.1, by=203.0.113.1"]])(
		"returns null for %j",
		(value) => {
			expect(read({ Forwarded: value })).toBeNull();
		},
	);
});

describe("getClientIP on Cloudflare Workers", () => {
	test("reads CF-Connecting-IP and ignores every other header", () => {
		let request = cloudflareRequest({
			"CF-Connecting-IP": "203.0.113.42",
			"X-Client-IP": "10.0.0.1",
		});

		expect(getClientIP(request)?.toString()).toBe("203.0.113.42");
	});

	test("returns null without CF-Connecting-IP instead of trusting another header", () => {
		let request = cloudflareRequest({ "X-Real-IP": "10.0.0.1", "X-Forwarded-For": "10.0.0.2" });

		expect(getClientIP(request)).toBeNull();
	});
});
