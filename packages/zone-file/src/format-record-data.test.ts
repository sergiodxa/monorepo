/**
 * Covers `formatRecordData`: one canonical spelling per typed type, the escapes TXT and CAA
 * values need, and the round trip through `parseRecordData` that lets a zone file's record
 * and a resolver's generic form compare equal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type * as ZoneFile from "./types.js";

import { formatRecordData } from "./format-record-data.js";
import { parseRecordData } from "./parse-record-data.js";

/** Presentation and generic RDATA the parser reads, each of which must survive a print and re-read. */
const FIXTURES: [string, string][] = [
	["A", "104.21.58.249"],
	["A", "\\# 4 0A000001"],
	["AAAA", "2606:4700:3030:0:0:0:6815:3AF9"],
	["CNAME", "Target.Example.COM."],
	["NS", "dora.ns.cloudflare.com."],
	["MX", "10 ALT1.aspmx.l.google.com."],
	["MX", "0 ."],
	["MX", "\\# 6 000a 026d78 00"],
	["TXT", '"v=DKIM1; p=AAA" "BBB"'],
	["TXT", "\\# 6 02 68 69 02 6f 6b"],
	["TXT", '"caf\\195\\169 \\"quoted\\" back\\\\slash"'],
	["TXT", '""'],
	["CAA", '0 issue "letsencrypt.org"'],
	["CAA", "128 iodef mailto:security@example.com"],
	["CAA", '1 ISSUE "caatestsuite.com"'],
	["CAA", '0 issue "pki.goog; cansignhttpexchanges=yes"'],
	["CAA", "\\# 22 00 05 69 73 73 75 65 6c 65 74 73 65 6e 63 72 79 70 74 2e 6f 72 67"],
	["SOA", "dora.ns.cloudflare.com. dns.cloudflare.com. 2053809283 10000 2400 604800 3600"],
	["SRV", "10 60 5060 SIP.example.com."],
	["HTTPS", '1 . alpn="h3,h2"'],
];

/** The record types with typed fields. */
type TypedType = "A" | "AAAA" | "CNAME" | "NS" | "MX" | "TXT" | "CAA" | "SRV" | "SOA";

/** Any typed record's data, so one table holds a case per type. */
type TypedData = { [Type in TypedType]: ZoneFile.RecordData<Type> }[TypedType];

describe("formatRecordData", () => {
	test.each<[TypedData, string]>([
		[{ type: "A", address: "192.0.2.1" }, "192.0.2.1"],
		[{ type: "AAAA", address: "2001:db8::1" }, "2001:db8::1"],
		[{ type: "CNAME", target: "edge.example.net" }, "edge.example.net."],
		[{ type: "NS", host: "ns1.example.com" }, "ns1.example.com."],
		[{ type: "MX", preference: 10, exchange: "mx.example.com" }, "10 mx.example.com."],
		[{ type: "MX", preference: 0, exchange: "." }, "0 ."],
		[{ type: "TXT", text: "ab", strings: ["a", "b"] }, '"a" "b"'],
		[
			{ type: "CAA", flags: 128, critical: true, tag: "tbs", value: "Unknown" },
			'128 tbs "Unknown"',
		],
		[
			{ type: "SRV", priority: 10, weight: 60, port: 5060, target: "sip.example.com" },
			"10 60 5060 sip.example.com.",
		],
		[
			{
				type: "SOA",
				primary: "ns.example.com",
				mailbox: "hostmaster.example.com",
				serial: 1,
				refresh: 7200,
				retry: 3600,
				expire: 1209600,
				minimum: 300,
			},
			"ns.example.com. hostmaster.example.com. 1 7200 3600 1209600 300",
		],
	])("prints %j", (data, expected) => {
		expect(formatRecordData(data)).toBe(expected);
	});

	test("prints an untyped record's data as is", () => {
		expect(formatRecordData({ type: "HTTPS", data: '1 . alpn="h3,h2"' })).toBe('1 . alpn="h3,h2"');
	});

	test("escapes quotes, backslashes and octets outside printable ASCII", () => {
		expect(formatRecordData({ type: "TXT", text: 'café "x" \\', strings: ['café "x" \\'] })).toBe(
			'"caf\\195\\169 \\"x\\" \\\\"',
		);
		expect(
			formatRecordData({
				type: "CAA",
				flags: 0,
				critical: false,
				tag: "iodef",
				value: "mailto:a\tb",
			}),
		).toBe('0 iodef "mailto:a\\009b"');
	});

	test("prints a CAA record from its generic and presentation forms as one string", () => {
		let generic = unwrap(
			parseRecordData("CAA", "\\# 19 00 05 69 73 73 75 65 63 6f 6d 6f 64 6f 63 61 2e 63 6f 6d"),
		);
		let text = unwrap(parseRecordData("CAA", '0 ISSUE "comodoca.com"'));

		expect(formatRecordData(generic)).toBe('0 issue "comodoca.com"');
		expect(formatRecordData(text)).toBe('0 issue "comodoca.com"');
	});

	test.each(FIXTURES)("round-trips %s %j through parseRecordData", (type, data) => {
		let parsed = unwrap(parseRecordData(type, data));
		expect(unwrap(parseRecordData(type, formatRecordData(parsed)))).toEqual(parsed);
	});
});
