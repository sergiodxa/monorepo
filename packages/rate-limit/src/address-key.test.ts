/**
 * Tests the address budget key: the prefix lengths it asks an address to widen
 * to, the range text it keys on, and the shared bucket a missing address falls
 * into instead of skipping the limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RateLimitAddress } from "./address-key.js";

import { addressKey, UNKNOWN_ADDRESS_KEY } from "./address-key.js";

/**
 * An address whose network answers with the given text per version, recording
 * the prefix lengths it was asked for.
 */
function address(version: 4 | 6, text: string) {
	let requested: { v4: number; v6: number }[] = [];
	let value: RateLimitAddress = {
		network(prefixes) {
			requested.push(prefixes);
			let prefix = version === 4 ? prefixes.v4 : prefixes.v6;
			return { toString: () => `${text}/${prefix}` };
		},
	};
	return { value, requested };
}

describe("addressKey", () => {
	test("keeps an IPv4 address whole", () => {
		expect(addressKey(address(4, "203.0.113.42").value)).toBe("203.0.113.42/32");
	});

	test("widens an IPv6 address to its /64", () => {
		expect(addressKey(address(6, "2001:db8:85a3::").value)).toBe("2001:db8:85a3::/64");
	});

	test("asks for a /32 and a /64 in a single call", () => {
		let { value, requested } = address(6, "2001:db8::");

		addressKey(value);

		expect(requested).toEqual([{ v4: 32, v6: 64 }]);
	});

	test("puts a request with no address in the shared bucket", () => {
		expect(addressKey(null)).toBe(UNKNOWN_ADDRESS_KEY);
		expect(addressKey(undefined)).toBe("unknown");
	});
});
