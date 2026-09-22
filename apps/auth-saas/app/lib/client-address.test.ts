/**
 * Tests `clientAddressKey`'s handling of IPv4, IPv6 (compressed, expanded,
 * and zoned), and a missing `CF-Connecting-IP` header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { clientAddressKey } from "./client-address";

function requestFrom(ip: string | null): Request {
	let headers = new Headers();
	if (ip) headers.set("CF-Connecting-IP", ip);
	return new Request("https://example.com", { headers });
}

describe("clientAddressKey", () => {
	test("keeps an IPv4 address whole", () => {
		expect(clientAddressKey(requestFrom("203.0.113.42"))).toBe("203.0.113.42");
	});

	test("falls back to a shared bucket when the header is absent", () => {
		expect(clientAddressKey(requestFrom(null))).toBe("unknown");
	});

	test("buckets a fully-expanded IPv6 address to its /64 prefix", () => {
		expect(clientAddressKey(requestFrom("2001:0db8:85a3:0000:0000:8a2e:0370:7334"))).toBe(
			"2001:0db8:85a3:0000",
		);
	});

	test("buckets a compressed IPv6 address to the same /64 prefix", () => {
		expect(clientAddressKey(requestFrom("2001:db8:85a3::8a2e:370:7334"))).toBe("2001:db8:85a3:0");
	});

	test("puts two addresses in the same /64 into the same bucket", () => {
		let first = clientAddressKey(requestFrom("2001:db8:85a3::1"));
		let second = clientAddressKey(requestFrom("2001:db8:85a3::ffff"));
		expect(first).toBe(second);
	});

	test("puts two addresses in different /64s into different buckets", () => {
		let first = clientAddressKey(requestFrom("2001:db8:85a3:0::1"));
		let second = clientAddressKey(requestFrom("2001:db8:85a3:1::1"));
		expect(first).not.toBe(second);
	});

	test("drops a zone id before bucketing", () => {
		expect(clientAddressKey(requestFrom("fe80::1%eth0"))).toBe("fe80:0:0:0");
	});

	test("buckets the unspecified address", () => {
		expect(clientAddressKey(requestFrom("::1"))).toBe("0:0:0:0");
	});
});
