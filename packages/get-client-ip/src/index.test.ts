/**
 * Tests getClientIP: the default CF-Connecting-IP header, a configured single
 * address header, and the X-Forwarded-For and Forwarded lists read from the right
 * so an entry the client wrote never answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { ClientIPOptions } from "./index.js";

import { getClientIP } from "./index.js";

/** A request carrying the given `CF-Connecting-IP` header, or none. */
function requestFrom(header?: string): Request {
	let headers = new Headers();
	if (header !== undefined) headers.set("CF-Connecting-IP", header);
	return new Request("https://example.com", { headers });
}

describe("getClientIP", () => {
	test("parses an IPv4 address", () => {
		let ip = getClientIP(requestFrom("203.0.113.42"));

		expect(ip?.version).toBe(4);
		expect(ip?.toString()).toBe("203.0.113.42");
	});

	test("parses an IPv6 address into its canonical text", () => {
		let ip = getClientIP(requestFrom("2001:0db8:85a3:0000:0000:8a2e:0370:7334"));

		expect(ip?.version).toBe(6);
		expect(ip?.toString()).toBe("2001:db8:85a3::8a2e:370:7334");
	});

	test("returns null when the header is missing", () => {
		expect(getClientIP(requestFrom())).toBeNull();
	});

	test.each([["unknown"], [""], ["10.0.0"], ["example.com"]])(
		"returns null for the malformed header %j",
		(header) => {
			expect(getClientIP(requestFrom(header))).toBeNull();
		},
	);

	test("returns null for a header repeated across several lines", () => {
		let headers = new Headers();
		headers.append("CF-Connecting-IP", "203.0.113.42");
		headers.append("CF-Connecting-IP", "198.51.100.1");

		expect(getClientIP(new Request("https://example.com", { headers }))).toBeNull();
	});

	test("reads the headers of a request or a bare Headers", () => {
		let headers = new Headers({ "CF-Connecting-IP": "203.0.113.42" });

		expect(getClientIP(headers)?.toString()).toBe("203.0.113.42");
	});
});

/** The address getClientIP answers for one header value under the given options. */
function readWith(name: string, value: string, options: ClientIPOptions = {}): string | null {
	let headers = new Headers({ [name]: value });
	return getClientIP(headers, { header: name, ...options })?.toString() ?? null;
}

describe("getClientIP with a configured header", () => {
	test("reads only the configured header", () => {
		let headers = new Headers({ "X-Real-IP": "203.0.113.42", "CF-Connecting-IP": "198.51.100.1" });

		expect(getClientIP(headers, { header: "X-Real-IP" })?.toString()).toBe("203.0.113.42");
	});

	test("ignores every other header a client sends", () => {
		let headers = new Headers({
			"X-Client-IP": "10.0.0.1",
			"X-Forwarded-For": "10.0.0.2",
			"True-Client-IP": "10.0.0.3",
		});

		expect(getClientIP(headers, { header: "Fly-Client-IP" })).toBeNull();
		expect(getClientIP(headers)).toBeNull();
	});

	test("matches the header name case-insensitively", () => {
		expect(readWith("x-forwarded-for", "10.0.0.1, 203.0.113.42")).toBe("203.0.113.42");
	});

	test("reads an unlisted header as a single address", () => {
		expect(readWith("X-My-Proxy-IP", "203.0.113.42")).toBe("203.0.113.42");
		expect(readWith("X-My-Proxy-IP", "203.0.113.42, 198.51.100.1")).toBeNull();
	});
});

describe("getClientIP with X-Forwarded-For", () => {
	test("answers the entry the trusted proxy appended, not the one the client wrote", () => {
		expect(readWith("X-Forwarded-For", "10.0.0.1, 203.0.113.42")).toBe("203.0.113.42");
	});

	test("counts trusted proxies from the right", () => {
		let value = "10.0.0.1, 203.0.113.42, 198.51.100.9";

		expect(readWith("X-Forwarded-For", value, { proxies: 2 })).toBe("203.0.113.42");
	});

	test("joins repeated header lines in order", () => {
		let headers = new Headers();
		headers.append("X-Forwarded-For", "10.0.0.1");
		headers.append("X-Forwarded-For", "203.0.113.42");

		expect(getClientIP(headers, { header: "X-Forwarded-For" })?.toString()).toBe("203.0.113.42");
	});

	test("drops a port the proxy appended", () => {
		expect(readWith("X-Forwarded-For", "203.0.113.42:4711")).toBe("203.0.113.42");
		expect(readWith("X-Forwarded-For", "[2001:db8::1]:4711")).toBe("2001:db8::1");
		expect(readWith("X-Forwarded-For", "2001:db8::1")).toBe("2001:db8::1");
	});

	test("returns null when the list is shorter than the proxy count", () => {
		expect(readWith("X-Forwarded-For", "203.0.113.42", { proxies: 2 })).toBeNull();
	});

	test.each([[0], [-1], [1.5], [Number.NaN]])("returns null for a proxy count of %d", (proxies) => {
		expect(readWith("X-Forwarded-For", "203.0.113.42", { proxies })).toBeNull();
	});

	test.each([["10.0.0.1, unknown"], ["10.0.0.1, "], ["10.0.0.1, 203.0.113.42:port"]])(
		"returns null when the trusted entry of %j is not an address",
		(value) => {
			expect(readWith("X-Forwarded-For", value)).toBeNull();
		},
	);
});

describe("getClientIP with Forwarded", () => {
	test("reads the for parameter of the last element", () => {
		let value = "for=10.0.0.1, for=203.0.113.42;proto=https;by=198.51.100.9";

		expect(readWith("Forwarded", value)).toBe("203.0.113.42");
	});

	test("reads a quoted IPv6 address with a port", () => {
		expect(readWith("Forwarded", 'For="[2001:db8:cafe::17]:4711"')).toBe("2001:db8:cafe::17");
	});

	test("counts trusted proxies from the right", () => {
		let value = "for=10.0.0.1, for=203.0.113.42, for=198.51.100.9";

		expect(readWith("Forwarded", value, { proxies: 2 })).toBe("203.0.113.42");
	});

	test("keeps an unclosed quote the client wrote from swallowing the proxy's element", () => {
		expect(readWith("Forwarded", 'for="10.0.0.1, for=203.0.113.42')).toBe("203.0.113.42");
	});

	test.each([["for=unknown"], ["for=_hidden"], ["proto=https"], ["for=10.0.0.1, by=203.0.113.1"]])(
		"returns null for %j",
		(value) => {
			expect(readWith("Forwarded", value)).toBeNull();
		},
	);
});
