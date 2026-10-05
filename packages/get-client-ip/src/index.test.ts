/**
 * Tests getClientIP's handling of the CF-Connecting-IP header: an IPv4, an IPv6,
 * and the missing and malformed headers that both answer `null`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

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
});
