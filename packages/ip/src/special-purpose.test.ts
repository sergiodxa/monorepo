/**
 * Tests the special-purpose table row by row, at each row's first and last address,
 * and the address fixtures a URL-fetching guard refuses and allows, so a mistyped
 * prefix or a dropped row shows up as a named failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { IP } from "./ip.js";
import { SPECIAL_PURPOSE_RANGES } from "./special-purpose.js";

/** Parse an address, failing the test if it was rejected. */
function ip(text: string): IP {
	return unwrap(IP.parse(text));
}

/**
 * Each row's first and last address with the classification each one gets. An end
 * that a longer row also covers takes that row's classification.
 */
const ROW_ENDS: readonly (readonly [
	string,
	string,
	IP.Classification,
	string,
	IP.Classification,
])[] = [
	["0.0.0.0/8", "0.0.0.0", "unspecified", "0.255.255.255", "reserved"],
	["0.0.0.0/32", "0.0.0.0", "unspecified", "0.0.0.0", "unspecified"],
	["10.0.0.0/8", "10.0.0.0", "private", "10.255.255.255", "private"],
	["100.64.0.0/10", "100.64.0.0", "shared", "100.127.255.255", "shared"],
	["127.0.0.0/8", "127.0.0.0", "loopback", "127.255.255.255", "loopback"],
	["169.254.0.0/16", "169.254.0.0", "link-local", "169.254.255.255", "link-local"],
	["172.16.0.0/12", "172.16.0.0", "private", "172.31.255.255", "private"],
	["192.0.0.0/24", "192.0.0.0", "reserved", "192.0.0.255", "reserved"],
	["192.0.0.9/32", "192.0.0.9", "public", "192.0.0.9", "public"],
	["192.0.0.10/32", "192.0.0.10", "public", "192.0.0.10", "public"],
	["192.0.2.0/24", "192.0.2.0", "documentation", "192.0.2.255", "documentation"],
	["192.88.99.0/24", "192.88.99.0", "reserved", "192.88.99.255", "reserved"],
	["192.168.0.0/16", "192.168.0.0", "private", "192.168.255.255", "private"],
	["198.18.0.0/15", "198.18.0.0", "benchmarking", "198.19.255.255", "benchmarking"],
	["198.51.100.0/24", "198.51.100.0", "documentation", "198.51.100.255", "documentation"],
	["203.0.113.0/24", "203.0.113.0", "documentation", "203.0.113.255", "documentation"],
	["224.0.0.0/4", "224.0.0.0", "multicast", "239.255.255.255", "multicast"],
	["240.0.0.0/4", "240.0.0.0", "reserved", "255.255.255.255", "reserved"],
	["255.255.255.255/32", "255.255.255.255", "reserved", "255.255.255.255", "reserved"],
	["::/0", "::", "unspecified", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "multicast"],
	["::/128", "::", "unspecified", "::", "unspecified"],
	["::1/128", "::1", "loopback", "::1", "loopback"],
	["64:ff9b:1::/48", "64:ff9b:1::", "reserved", "64:ff9b:1:ffff:ffff:ffff:ffff:ffff", "reserved"],
	["100::/64", "100::", "discard", "100::ffff:ffff:ffff:ffff", "discard"],
	["100:0:0:1::/64", "100:0:0:1::", "reserved", "100::1:ffff:ffff:ffff:ffff", "reserved"],
	["2000::/3", "2000::", "public", "3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "public"],
	["2001::/23", "2001::", "teredo", "2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff", "reserved"],
	["2001::/32", "2001::", "teredo", "2001:0:ffff:ffff:ffff:ffff:ffff:ffff", "teredo"],
	["2001:1::1/128", "2001:1::1", "public", "2001:1::1", "public"],
	["2001:1::2/128", "2001:1::2", "public", "2001:1::2", "public"],
	["2001:1::3/128", "2001:1::3", "public", "2001:1::3", "public"],
	["2001:2::/48", "2001:2::", "benchmarking", "2001:2:0:ffff:ffff:ffff:ffff:ffff", "benchmarking"],
	["2001:3::/32", "2001:3::", "public", "2001:3:ffff:ffff:ffff:ffff:ffff:ffff", "public"],
	["2001:4:112::/48", "2001:4:112::", "public", "2001:4:112:ffff:ffff:ffff:ffff:ffff", "public"],
	["2001:20::/28", "2001:20::", "public", "2001:2f:ffff:ffff:ffff:ffff:ffff:ffff", "public"],
	["2001:30::/28", "2001:30::", "public", "2001:3f:ffff:ffff:ffff:ffff:ffff:ffff", "public"],
	[
		"2001:db8::/32",
		"2001:db8::",
		"documentation",
		"2001:db8:ffff:ffff:ffff:ffff:ffff:ffff",
		"documentation",
	],
	[
		"3fff::/20",
		"3fff::",
		"documentation",
		"3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff",
		"documentation",
	],
	["5f00::/16", "5f00::", "reserved", "5f00:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "reserved"],
	["fc00::/7", "fc00::", "unique-local", "fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "unique-local"],
	["fe80::/10", "fe80::", "link-local", "febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "link-local"],
	["ff00::/8", "ff00::", "multicast", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "multicast"],
];

describe("SPECIAL_PURPOSE_RANGES", () => {
	test("lists every row exactly once in the fixtures", () => {
		expect(ROW_ENDS.map(([range]) => range)).toEqual(
			SPECIAL_PURPOSE_RANGES.map((row) => row.range),
		);
	});

	test("cites an RFC on every row", () => {
		for (let row of SPECIAL_PURPOSE_RANGES) expect(row.rfc).toMatch(/^RFC \d+$/);
	});

	test.each(ROW_ENDS)(
		"%s runs from %s (%s) to %s (%s)",
		(text, first, firstClass, last, lastClass) => {
			let range = unwrap(IP.Range.parse(text));

			expect(range.contains(ip(first))).toBe(true);
			expect(range.contains(ip(last))).toBe(true);
			expect(ip(first).classification).toBe(firstClass);
			expect(ip(last).classification).toBe(lastClass);
		},
	);

	test("classifies the inside of a block whose ends a longer row claims", () => {
		expect(ip("::2").classification).toBe("reserved");
		expect(ip("4000::1").classification).toBe("reserved");
		expect(ip("fec0::1").classification).toBe("reserved");
		expect(ip("2001:100::1").classification).toBe("reserved");
	});
});

describe("isPublic", () => {
	test.each([
		["0.0.0.0", "this-network"],
		["0.1.2.3", "this-network"],
		["10.0.0.1", "RFC1918 10/8"],
		["10.255.255.254", "RFC1918 10/8"],
		["100.64.0.1", "carrier-grade NAT"],
		["100.127.255.254", "carrier-grade NAT"],
		["127.0.0.1", "loopback"],
		["127.255.255.254", "loopback"],
		["169.254.1.1", "link-local"],
		["169.254.169.254", "cloud instance metadata"],
		["172.16.0.1", "RFC1918 172.16/12"],
		["172.31.255.254", "RFC1918 172.16/12"],
		["192.0.0.1", "IETF protocol assignments"],
		["192.0.2.1", "TEST-NET-1"],
		["192.168.0.1", "RFC1918 192.168/16"],
		["192.168.255.254", "RFC1918 192.168/16"],
		["198.18.0.1", "benchmarking"],
		["198.51.100.1", "TEST-NET-2"],
		["203.0.113.1", "TEST-NET-3"],
		["224.0.0.1", "multicast"],
		["239.255.255.255", "multicast"],
		["240.0.0.1", "reserved"],
		["255.255.255.255", "broadcast"],
	])("refuses %s (%s)", (address) => {
		expect(ip(address).isPublic).toBe(false);
	});

	test.each([
		["::", "unspecified"],
		["::1", "loopback"],
		["::2", "IPv4-compatible"],
		["100::1", "discard-only"],
		["2001::1", "Teredo"],
		["2001:db8::1", "documentation"],
		["fc00::1", "unique-local"],
		["fd12:3456:789a::1", "unique-local"],
		["fe80::1", "link-local"],
		["febf:ffff::1", "link-local"],
		["ff02::1", "multicast"],
		["::ffff:127.0.0.1", "IPv4-mapped loopback"],
		["::ffff:7f00:1", "IPv4-mapped loopback, group notation"],
		["::ffff:169.254.169.254", "IPv4-mapped metadata address"],
		["::ffff:10.0.0.1", "IPv4-mapped RFC1918"],
		["64:ff9b::a9fe:a9fe", "NAT64-wrapped metadata address"],
		["64:ff9b::7f00:1", "NAT64-wrapped loopback"],
		["64:ff9b::a00:1", "NAT64-wrapped RFC1918"],
		["2002:7f00:1::", "6to4-wrapped loopback"],
		["2002:a9fe:a9fe::", "6to4-wrapped metadata address"],
	])("refuses %s (%s)", (address) => {
		expect(ip(address).isPublic).toBe(false);
	});

	test.each([
		["8.8.8.8"],
		["1.1.1.1"],
		["93.184.216.34"],
		["172.32.0.1"],
		["100.128.0.1"],
		["192.0.0.9"],
		["2606:4700:4700::1111"],
		["2a00:1450:4001:80f::200e"],
		["::ffff:8.8.8.8"],
		["64:ff9b::808:808"],
		["2002:808:808::"],
	])("allows the public address %s", (address) => {
		expect(ip(address).isPublic).toBe(true);
	});
});

describe("embeddedIPv4", () => {
	test.each([
		["::ffff:10.0.0.1", "10.0.0.1"],
		["::ffff:7f00:1", "127.0.0.1"],
		["64:ff9b::a00:1", "10.0.0.1"],
		["2002:a9fe:a9fe::1", "169.254.169.254"],
	])("reads %s as %s", (outer, inner) => {
		let embedded = ip(outer).embeddedIPv4;

		expect(embedded?.version).toBe(4);
		expect(embedded?.toString()).toBe(inner);
	});

	test.each([["10.0.0.1"], ["2001:db8::1"], ["::a00:1"], ["64:ff9b:1::a00:1"]])(
		"answers null for %s",
		(address) => {
			expect(ip(address).embeddedIPv4).toBeNull();
		},
	);

	test("classifies the whole address by the IPv4 inside it", () => {
		expect(ip("::ffff:10.0.0.1").classification).toBe("private");
		expect(ip("64:ff9b::7f00:1").classification).toBe("loopback");
	});
});
