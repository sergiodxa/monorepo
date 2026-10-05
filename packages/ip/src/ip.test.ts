/**
 * Tests the public surface of `IP` and `IP.Range`: what parses and what fails with
 * which code, RFC 5952 canonical text, value equality, JSON, and the network an
 * address sits in, which is what a rate limit keys on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { IP } from "./index.js";

/** Parse an address, failing the test if it was rejected. */
function ip(text: string): IP {
	return unwrap(IP.parse(text));
}

/** Parse a range, failing the test if it was rejected. */
function range(text: string): IP.Range {
	return unwrap(IP.Range.parse(text));
}

describe("IP.parse", () => {
	test.each([
		["203.0.113.7", 4],
		["0.0.0.0", 4],
		["255.255.255.255", 4],
		["2001:db8::1", 6],
		["[2001:db8::1]", 6],
		["::", 6],
		["::1", 6],
		["1::", 6],
		["1:2:3:4:5:6:7:8", 6],
		["1:2:3:4:5:6:7::", 6],
		["::2:3:4:5:6:7:8", 6],
		["::ffff:192.0.2.1", 6],
		["1:2:3:4:5:6:1.2.3.4", 6],
		["2001:DB8::A", 6],
	])("parses %s as IPv%i", (text, version) => {
		expect(ip(text).version).toBe(version);
	});

	test.each([
		[""],
		["unknown"],
		["example.com"],
		["1.2.3"],
		["1.2.3.4.5"],
		["256.0.0.1"],
		["010.0.0.1"],
		["0x7f.0.0.1"],
		["2130706433"],
		[" 1.2.3.4"],
		["1.2.3.4 "],
		["[1.2.3.4]"],
		["203.0.113.42, 198.51.100.1"],
		[":::"],
		["::1::2"],
		["fffff::1"],
		["1:2:3:4:5:6:7:8:9"],
		["1:2:3:4:5:6:7"],
		["1:2:3:4:5:6:7:8::"],
		["::1.2.3.4:5"],
		["1.2.3.4::"],
		[":1::"],
		["1::2:"],
		["fe80::1%eth0"],
		["[fe80::1%25eth0]"],
		["[::1"],
		["2001:db8::/32"],
	])("refuses %j", (text) => {
		let result = IP.parse(text);

		expect(isFailure(result)).toBe(true);
		if (isSuccess(result)) return;
		expect(result.error).toBeInstanceOf(IP.Error);
		expect(result.error.code).toBe("invalid-address");
		expect(result.error.input).toBe(text);
	});
});

describe("toString", () => {
	test.each([
		["2001:DB8::0:1", "2001:db8::1"],
		["2001:0db8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
		["2001:db8:0:0:1:0:0:1", "2001:db8::1:0:0:1"],
		["2001:0:0:1:0:0:0:1", "2001:0:0:1::1"],
		["2001:db8:0:1:1:1:1:1", "2001:db8:0:1:1:1:1:1"],
		["2001:db8::1:1:1:1:1", "2001:db8:0:1:1:1:1:1"],
		["0:0:0:0:0:0:0:0", "::"],
		["0:0:0:0:0:0:0:1", "::1"],
		["1:0:0:0:0:0:0:0", "1::"],
		["[2001:db8:85a3:0000:0000:8a2e:0370:7334]", "2001:db8:85a3::8a2e:370:7334"],
		["::ffff:c000:201", "::ffff:192.0.2.1"],
		["::FFFF:192.0.2.1", "::ffff:192.0.2.1"],
		["64:ff9b::192.0.2.1", "64:ff9b::c000:201"],
		["203.0.113.7", "203.0.113.7"],
	])("prints %s as %s", (text, canonical) => {
		expect(ip(text).toString()).toBe(canonical);
	});

	test("prints the same string for every spelling of one address", () => {
		let spellings = ["2001:db8::1", "2001:DB8:0::1", "[2001:db8:0:0:0:0:0:1]"];
		expect(new Set(spellings.map((text) => ip(text).toString())).size).toBe(1);
	});

	test("serializes as the canonical text through toJSON", () => {
		expect(JSON.stringify({ ip: ip("2001:DB8::0:1") })).toBe('{"ip":"2001:db8::1"}');
		expect(JSON.stringify({ range: range("10.0.0.0/8") })).toBe('{"range":"10.0.0.0/8"}');
	});
});

describe("equals", () => {
	test("compares by value", () => {
		expect(ip("2001:db8::1").equals(ip("2001:DB8:0::1"))).toBe(true);
		expect(ip("2001:db8::1").equals(ip("2001:db8::2"))).toBe(false);
	});

	test("keeps an IPv4 apart from the IPv4-mapped address carrying it", () => {
		expect(ip("10.0.0.1").equals(ip("::ffff:10.0.0.1"))).toBe(false);
		expect(ip("0.0.0.0").equals(ip("::"))).toBe(false);
	});
});

describe("immutability", () => {
	test("freezes every instance", () => {
		expect(Object.isFrozen(ip("10.0.0.1"))).toBe(true);
		expect(Object.isFrozen(range("10.0.0.0/8"))).toBe(true);
	});
});

describe("IP.Range.parse", () => {
	test.each([
		["10.0.0.0/8", "10.0.0.0/8"],
		["0.0.0.0/0", "0.0.0.0/0"],
		["203.0.113.7/32", "203.0.113.7/32"],
		["2001:DB8::/32", "2001:db8::/32"],
		["::/0", "::/0"],
		["::1/128", "::1/128"],
		["fe80::/10", "fe80::/10"],
	])("parses %s as %s", (text, canonical) => {
		let parsed = range(text);

		expect(parsed.toString()).toBe(canonical);
		expect(parsed.network.toString()).toBe(canonical.split("/")[0]);
	});

	test.each([["10.0.0.1/8"], ["2001:db8::1/32"], ["fe80::/8"]])(
		"refuses %s as host-bits-set",
		(text) => {
			let result = IP.Range.parse(text);

			expect(isFailure(result)).toBe(true);
			if (isSuccess(result)) return;
			expect(result.error.code).toBe("host-bits-set");
		},
	);

	test.each([
		["10.0.0.0"],
		["10.0.0.0/"],
		["10.0.0.0/33"],
		["::/129"],
		["10.0.0.0/08"],
		["10.0.0.0/-1"],
		["10.0.0.0/8/8"],
		["/8"],
		["example.com/8"],
	])("refuses %s as invalid-range", (text) => {
		let result = IP.Range.parse(text);

		expect(isFailure(result)).toBe(true);
		if (isSuccess(result)) return;
		expect(result.error).toBeInstanceOf(IP.Error);
		expect(result.error.code).toBe("invalid-range");
	});
});

describe("IP.Range contains", () => {
	test("tests membership at the edges of the network", () => {
		let tenNet = range("10.0.0.0/8");

		expect(tenNet.contains(ip("10.0.0.0"))).toBe(true);
		expect(tenNet.contains(ip("10.255.255.255"))).toBe(true);
		expect(tenNet.contains(ip("11.0.0.0"))).toBe(false);
		expect(tenNet.contains(ip("9.255.255.255"))).toBe(false);
	});

	test("tests membership off a group boundary", () => {
		let uniqueLocal = range("fc00::/7");

		expect(uniqueLocal.contains(ip("fdff::1"))).toBe(true);
		expect(uniqueLocal.contains(ip("fe00::1"))).toBe(false);
	});

	test("answers false across versions", () => {
		expect(range("10.0.0.0/8").contains(ip("::ffff:10.0.0.1"))).toBe(false);
		expect(range("::/0").contains(ip("10.0.0.1"))).toBe(false);
		expect(range("0.0.0.0/0").contains(ip("::1"))).toBe(false);
	});

	test("compares ranges by value", () => {
		expect(range("2001:DB8::/32").equals(range("2001:db8::/32"))).toBe(true);
		expect(range("2001:db8::/32").equals(range("2001:db8::/48"))).toBe(false);
	});
});

describe("network", () => {
	test("keys IPv4 on the full address and IPv6 on its /64", () => {
		expect(ip("203.0.113.7").network({ v4: 32, v6: 64 }).toString()).toBe("203.0.113.7/32");
		expect(ip("2001:db8:1:2:aaaa:bbbb:cccc:dddd").network({ v4: 32, v6: 64 }).toString()).toBe(
			"2001:db8:1:2::/64",
		);
	});

	test("puts every address of one /64 in the same network", () => {
		let first = ip("2001:db8:1:2::1").network({ v4: 32, v6: 64 });
		let second = ip("2001:db8:1:2:ffff::9").network({ v4: 32, v6: 64 });

		expect(first.equals(second)).toBe(true);
		expect(first.contains(ip("2001:db8:1:2::abcd"))).toBe(true);
		expect(first.contains(ip("2001:db8:1:3::1"))).toBe(false);
	});

	test("clears host bits with a prefix off an octet boundary", () => {
		expect(ip("10.1.2.3").network({ v4: 12, v6: 64 }).toString()).toBe("10.0.0.0/12");
		expect(ip("172.31.255.255").network({ v4: 12, v6: 64 }).toString()).toBe("172.16.0.0/12");
	});

	test("clamps a prefix outside the version's width", () => {
		expect(ip("10.1.2.3").network({ v4: 64, v6: 64 }).toString()).toBe("10.1.2.3/32");
		expect(ip("2001:db8::1").network({ v4: 32, v6: -8 }).toString()).toBe("::/0");
		expect(ip("2001:db8::1").network({ v4: 32, v6: Number.NaN }).toString()).toBe("::/0");
	});
});
