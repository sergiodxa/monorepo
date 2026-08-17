import { describe, expect, test } from "vitest";

import { getClientIP } from "./index";

describe("getClientIP", () => {
	test("returns IP address from CF-Connecting-IP header", () => {
		let request = new Request("https://example.com", {
			headers: {
				"CF-Connecting-IP": "203.0.113.42",
			},
		});

		expect(getClientIP(request)).toBe("203.0.113.42");
	});

	test("returns null when CF-Connecting-IP header is missing", () => {
		let request = new Request("https://example.com");

		expect(getClientIP(request)).toBeNull();
	});

	test("handles IPv6 addresses", () => {
		let request = new Request("https://example.com", {
			headers: {
				"CF-Connecting-IP": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
			},
		});

		expect(getClientIP(request)).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
	});

	test("handles multiple header values correctly", () => {
		let headers = new Headers();
		headers.append("CF-Connecting-IP", "203.0.113.42");
		headers.append("CF-Connecting-IP", "198.51.100.1");

		let request = new Request("https://example.com", { headers });

		expect(getClientIP(request)).toBe("203.0.113.42, 198.51.100.1");
	});
});
