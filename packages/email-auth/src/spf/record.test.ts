/**
 * Covers SPF record parsing with RFC 7208 Appendix A's records as fixtures, and the
 * syntax errors §4.6 turns into `permerror`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { isDomainSpec, isSpfRecord, parseSpfRecord } from "./record.js";

describe("parseSpfRecord", () => {
	test("reads Appendix A.1's records", () => {
		let record = unwrap(parseSpfRecord("v=spf1 mx/30 mx:example.org/30 -all"));
		expect(record.mechanisms).toEqual([
			{ type: "mx", qualifier: "+", term: "mx/30", domain: null, ip4Prefix: 30, ip6Prefix: 128 },
			{
				type: "mx",
				qualifier: "+",
				term: "mx:example.org/30",
				domain: "example.org",
				ip4Prefix: 30,
				ip6Prefix: 128,
			},
			{ type: "all", qualifier: "-", term: "-all" },
		]);
	});

	test("reads networks, includes and modifiers", () => {
		let record = unwrap(
			parseSpfRecord(
				"v=spf1 ip4:192.0.2.128/28 ip6:2001:db8::/32 ~include:_spf.example.com a//64 redirect=example.org exp=explain.%{d} x-custom=1",
			),
		);
		expect(record.mechanisms.map((mechanism) => mechanism.type)).toEqual([
			"ip4",
			"ip6",
			"include",
			"a",
		]);
		expect(record.mechanisms[2]?.qualifier).toBe("~");
		expect(record.mechanisms[3]).toMatchObject({ ip4Prefix: 32, ip6Prefix: 64 });
		expect(record.redirect).toBe("example.org");
		expect(record.explanation).toBe("explain.%{d}");
		expect(record.modifiers).toEqual([{ name: "x-custom", value: "1" }]);
	});

	test("reads Appendix A.3's macro-driven includes", () => {
		let record = unwrap(parseSpfRecord("v=spf1 exists:%{ir}.%{l1r+}.%{d}"));
		expect(record.mechanisms[0]).toMatchObject({ type: "exists", domain: "%{ir}.%{l1r+}.%{d}" });
	});

	test("compares mechanism names case-insensitively", () => {
		expect(unwrap(parseSpfRecord("V=SPF1 MX -ALL")).mechanisms).toHaveLength(2);
	});

	test.each([
		["v=spf1 foo -all", "not an SPF mechanism"],
		["v=spf1 include -all", "malformed"],
		["v=spf1 ip4:192.0.2.300 -all", "malformed"],
		["v=spf1 ip4:192.0.2.0/33", "malformed"],
		["v=spf1 ip6:192.0.2.1", "malformed"],
		["v=spf1 a:localhost", "malformed"],
		["v=spf1 -exists:%(ir).sbl.example.org", "malformed"],
		["v=spf1 redirect=a.example.com redirect=b.example.com", "more than once"],
		["v=spf1 all:x", "malformed"],
		["spf1 -all", "v=spf1"],
	])("rejects %s", (text, message) => {
		let record = parseSpfRecord(text);
		expect(isFailure(record) && record.error.message).toContain(message);
	});
});

describe("isSpfRecord", () => {
	test.each([
		["v=spf1", true],
		["v=spf1 -all", true],
		["v=spf10 -all", false],
		["v=DMARC1; p=none", false],
	])("%s is %s", (text, expected) => {
		expect(isSpfRecord(text)).toBe(expected);
	});
});

describe("isDomainSpec", () => {
	test.each([
		["example.com", true],
		["example.com.", true],
		["%{d}", true],
		["mobile-users._spf.%{d}", true],
		["localhost", false],
		["example.123", false],
	])("%s is %s", (spec, expected) => {
		expect(isDomainSpec(spec)).toBe(expected);
	});
});
