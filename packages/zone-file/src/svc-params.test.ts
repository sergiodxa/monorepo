/**
 * Covers SVCB and HTTPS data against the RFC 9460 Appendix D test vectors: the presentation
 * form, the wire form as RFC 3597 generic data, the canonical print, and the failure cases
 * the appendix lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { formatRecordData } from "./format-record-data.js";
import { parseRecordData } from "./parse-record-data.js";
import { parse } from "./parse.js";

/** `foo.example.com.` in wire form. */
const FOO_EXAMPLE_COM = "03 666f6f 07 6578616d706c65 03 636f6d 00";

/** `foo.example.org.` in wire form. */
const FOO_EXAMPLE_ORG = "03 666f6f 07 6578616d706c65 03 6f7267 00";

/** Spells hex octets as RFC 3597 generic data, counting the length. */
function generic(hex: string): string {
	let octets = hex.replace(/\s+/g, "");
	return `\\# ${octets.length / 2} ${octets}`;
}

describe("SVCB and HTTPS data", () => {
	test.each([
		[
			"AliasMode (D.1)",
			"HTTPS",
			"0 foo.example.com.",
			`0000 ${FOO_EXAMPLE_COM}`,
			{ priority: 0, target: "foo.example.com", params: {} },
		],
		[
			"the owner as target (D.2, figure 2)",
			"SVCB",
			"1 .",
			"0001 00",
			{ priority: 1, target: ".", params: {} },
		],
		[
			"a port (D.2, figure 3)",
			"SVCB",
			"16 foo.example.com. port=53",
			`0010 ${FOO_EXAMPLE_COM} 0003 0002 0035`,
			{ priority: 16, target: "foo.example.com", params: { port: 53 } },
		],
		[
			"a generic key (D.2, figure 4)",
			"SVCB",
			"1 foo.example.com. key667=hello",
			`0001 ${FOO_EXAMPLE_COM} 029b 0005 68656c6c6f`,
			{ priority: 1, target: "foo.example.com", params: { other: { 667: "hello" } } },
		],
		[
			"two IPv6 hints (D.2, figure 6)",
			"SVCB",
			'1 foo.example.com. ipv6hint="2001:db8::1,2001:db8::53:1"',
			`0001 ${FOO_EXAMPLE_COM} 0006 0020 20010db8000000000000000000000001 20010db8000000000000000000530001`,
			{
				priority: 1,
				target: "foo.example.com",
				params: { ipv6Hint: ["2001:db8::1", "2001:db8::53:1"] },
			},
		],
		[
			"an IPv4-mapped IPv6 hint (D.2, figure 7)",
			"SVCB",
			'1 example.com. ipv6hint="2001:db8:122:344::192.0.2.33"',
			"0001 07 6578616d706c65 03 636f6d 00 0006 0010 20010db80122034400000000c0000221",
			{
				priority: 1,
				target: "example.com",
				params: { ipv6Hint: ["2001:db8:122:344::c000:221"] },
			},
		],
		[
			"mandatory keys out of order (D.2, figure 8)",
			"SVCB",
			"16 foo.example.org. alpn=h2,h3-19 mandatory=ipv4hint,alpn ipv4hint=192.0.2.1",
			`0010 ${FOO_EXAMPLE_ORG} 0000 0004 0001 0004 0001 0009 02 6832 05 68332d3139 0004 0004 c0000201`,
			{
				priority: 16,
				target: "foo.example.org",
				params: { mandatory: ["alpn", "ipv4hint"], alpn: ["h2", "h3-19"], ipv4Hint: ["192.0.2.1"] },
			},
		],
		[
			"an escaped comma and backslash in alpn (D.2, figure 9)",
			"SVCB",
			'16 foo.example.org. alpn="f\\\\\\\\oo\\\\,bar,h2"',
			`0010 ${FOO_EXAMPLE_ORG} 0001 000c 08 665c6f6f2c626172 02 6832`,
			{ priority: 16, target: "foo.example.org", params: { alpn: ["f\\oo,bar", "h2"] } },
		],
		[
			"the same alpn written with decimal escapes (D.2, figure 9)",
			"SVCB",
			"16 foo.example.org. alpn=f\\\\\\092oo\\092,bar,h2",
			`0010 ${FOO_EXAMPLE_ORG} 0001 000c 08 665c6f6f2c626172 02 6832`,
			{ priority: 16, target: "foo.example.org", params: { alpn: ["f\\oo,bar", "h2"] } },
		],
	])("reads %s from its presentation and wire forms", (_, type, text, wire, fields) => {
		let expected = { type, ...fields };
		expect(unwrap(parseRecordData(type, text))).toEqual(expected);
		expect(unwrap(parseRecordData(type, generic(wire)))).toEqual(expected);
	});

	test("reads the registered keys past the RFC 9460 vectors", () => {
		expect(
			unwrap(
				parseRecordData(
					"HTTPS",
					'1 . alpn=h2 no-default-alpn ech=AEj+DQBE ohttp dohpath="/q{?dns}" key3=443',
				),
			),
		).toEqual({
			type: "HTTPS",
			priority: 1,
			target: ".",
			params: {
				alpn: ["h2"],
				noDefaultAlpn: true,
				port: 443,
				ech: "AEj+DQBE",
				dohPath: "/q{?dns}",
				ohttp: true,
			},
		});
	});

	test("prints keys in number order with value-list escapes", () => {
		let parsed = unwrap(
			parseRecordData(
				"SVCB",
				"16 foo.example.org. alpn=h2,h3-19 mandatory=ipv4hint,alpn ipv4hint=192.0.2.1",
			),
		);
		expect(formatRecordData(parsed)).toBe(
			'16 foo.example.org. mandatory=alpn,ipv4hint alpn="h2,h3-19" ipv4hint=192.0.2.1',
		);
		expect(
			formatRecordData(unwrap(parseRecordData("SVCB", '1 . alpn="f\\\\\\\\oo\\\\,bar,h2"'))),
		).toBe('1 . alpn="f\\\\\\\\oo\\\\,bar,h2"');
		expect(formatRecordData(unwrap(parseRecordData("HTTPS", "0 foo.example.com.")))).toBe(
			"0 foo.example.com.",
		);
	});

	test.each([
		["a repeated key (D.3, figure 11)", "1 foo.example.com. key123=abc key123=def"],
		["mandatory without a value (D.3, figure 12)", "1 foo.example.com. mandatory"],
		["alpn without a value (D.3, figure 12)", "1 foo.example.com. alpn"],
		["port without a value (D.3, figure 12)", "1 foo.example.com. port"],
		["an empty mandatory (D.3, figure 12)", "1 foo.example.com. mandatory="],
		["an empty alpn (D.3, figure 12)", "1 foo.example.com. alpn="],
		["an empty port (D.3, figure 12)", "1 foo.example.com. port="],
		["a value for no-default-alpn (D.3, figure 13)", "1 foo.example.com. no-default-alpn=abc"],
		["a mandatory key that is missing (D.3, figure 14)", "1 foo.example.com. mandatory=key123"],
		["mandatory listing itself (D.3, figure 15)", "1 foo.example.com. mandatory=mandatory"],
		[
			"a repeated mandatory key (D.3, figure 16)",
			"1 foo.example.com. mandatory=key123,key123 key123=abc",
		],
		["an unknown key name", "1 . flavor=vanilla"],
		["the reserved key 65535", "1 . key65535=x"],
		["a port out of range", "1 . port=65536"],
		["an IPv6 address as an IPv4 hint", "1 . ipv4hint=2001:db8::1"],
		["a missing target", "1"],
	])("fails on %s", (_, text) => {
		expect(isFailure(parseRecordData("SVCB", text))).toBe(true);
	});

	test.each([
		["keys out of order", `0001 00 0003 0002 0035 0001 0003 02 6832`],
		["a value overrunning the data", "0001 00 0003 0004 0035"],
		["a port of the wrong length", "0001 00 0003 0001 35"],
	])("fails on wire data with %s", (_, wire) => {
		expect(isFailure(parseRecordData("SVCB", generic(wire)))).toBe(true);
	});

	test("qualifies a relative target in a zone file and keeps the root", () => {
		let zone = unwrap(
			parse('@ HTTPS 1 . alpn="h3,h2"\n_dns SVCB 1 dns port=853', { origin: "example.net" }),
		);
		expect(zone.rejected).toEqual([]);
		expect(zone.records.map(formatRecordData)).toEqual([
			'1 . alpn="h3,h2"',
			"1 dns.example.net. port=853",
		]);
	});
});
