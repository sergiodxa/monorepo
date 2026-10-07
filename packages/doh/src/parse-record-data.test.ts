/**
 * Covers `parseRecordData`, the presentation-format reader per record type, including
 * RFC 3597 generic data, which is how some resolvers answer CAA.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { RecordDataError } from "./errors.js";
import { parseRecordData } from "./parse-record-data.js";

describe("parseRecordData", () => {
	test("reads A and AAAA addresses, AAAA in RFC 5952 form", () => {
		expect(unwrap(parseRecordData("A", "104.21.58.249"))).toEqual({
			type: "A",
			address: "104.21.58.249",
		});
		expect(unwrap(parseRecordData("AAAA", "2606:4700:3030:0:0:0:6815:3AF9"))).toEqual({
			type: "AAAA",
			address: "2606:4700:3030::6815:3af9",
		});
	});

	test("reads names lowercased without the trailing dot", () => {
		expect(unwrap(parseRecordData("CNAME", "Target.Example.COM."))).toEqual({
			type: "CNAME",
			target: "target.example.com",
		});
		expect(unwrap(parseRecordData("NS", "dora.ns.cloudflare.com."))).toEqual({
			type: "NS",
			host: "dora.ns.cloudflare.com",
		});
	});

	test("reads MX, keeping the root as a null MX exchange", () => {
		expect(unwrap(parseRecordData("MX", "10 ALT1.aspmx.l.google.com."))).toEqual({
			type: "MX",
			preference: 10,
			exchange: "alt1.aspmx.l.google.com",
		});
		expect(unwrap(parseRecordData("MX", "0 ."))).toEqual({
			type: "MX",
			preference: 0,
			exchange: ".",
		});
	});

	test("reads TXT as joined text and its strings", () => {
		expect(unwrap(parseRecordData("TXT", '"v=DKIM1; p=AAA" "BBB"'))).toEqual({
			type: "TXT",
			text: "v=DKIM1; p=AAABBB",
			strings: ["v=DKIM1; p=AAA", "BBB"],
		});
	});

	test("reads CAA with a quoted or bare value", () => {
		expect(unwrap(parseRecordData("CAA", '0 issue "letsencrypt.org"'))).toEqual({
			type: "CAA",
			flags: 0,
			critical: false,
			tag: "issue",
			value: "letsencrypt.org",
		});
		expect(unwrap(parseRecordData("CAA", "128 iodef mailto:security@example.com"))).toEqual({
			type: "CAA",
			flags: 128,
			critical: true,
			tag: "iodef",
			value: "mailto:security@example.com",
		});
	});

	test("keeps CAA reserved flag bits and lowercases the tag", () => {
		expect(unwrap(parseRecordData("CAA", '1 ISSUE "caatestsuite.com"'))).toEqual({
			type: "CAA",
			flags: 1,
			critical: false,
			tag: "issue",
			value: "caatestsuite.com",
		});
		expect(unwrap(parseRecordData("CAA", "\\# 7 81 01 61 76 61 6c 75"))).toMatchObject({
			flags: 129,
			critical: true,
			tag: "a",
			value: "valu",
		});
	});

	test("reads SOA and SRV", () => {
		expect(
			unwrap(
				parseRecordData(
					"SOA",
					"dora.ns.cloudflare.com. dns.cloudflare.com. 2053809283 10000 2400 604800 3600",
				),
			),
		).toEqual({
			type: "SOA",
			primary: "dora.ns.cloudflare.com",
			mailbox: "dns.cloudflare.com",
			serial: 2053809283,
			refresh: 10000,
			retry: 2400,
			expire: 604800,
			minimum: 3600,
		});
		expect(unwrap(parseRecordData("SRV", "10 60 5060 SIP.example.com."))).toEqual({
			type: "SRV",
			priority: 10,
			weight: 60,
			port: 5060,
			target: "sip.example.com",
		});
	});

	test("reads RFC 3597 generic data for known types", () => {
		/** `0 issue "letsencrypt.org"` as Cloudflare's resolver answers it. */
		let caa = "\\# 22 00 05 69 73 73 75 65 6c 65 74 73 65 6e 63 72 79 70 74 2e 6f 72 67";
		expect(unwrap(parseRecordData("CAA", caa))).toEqual({
			type: "CAA",
			flags: 0,
			critical: false,
			tag: "issue",
			value: "letsencrypt.org",
		});
		expect(unwrap(parseRecordData("A", "\\# 4 0A000001"))).toEqual({
			type: "A",
			address: "10.0.0.1",
		});
		expect(unwrap(parseRecordData("TXT", "\\# 6 02 68 69 02 6f 6b"))).toEqual({
			type: "TXT",
			text: "hiok",
			strings: ["hi", "ok"],
		});
		expect(unwrap(parseRecordData("MX", "\\# 6 000a 026d78 00"))).toEqual({
			type: "MX",
			preference: 10,
			exchange: "mx",
		});
	});

	test("keeps other types as raw data", () => {
		expect(unwrap(parseRecordData("HTTPS", '1 . alpn="h3,h2"'))).toEqual({
			type: "HTTPS",
			data: '1 . alpn="h3,h2"',
		});
	});

	test.each([
		["A", "999.1.1.1"],
		["A", "010.0.0.1"],
		["AAAA", "not-an-address"],
		["AAAA", "1.2.3.4"],
		["MX", "mx.example.com."],
		["MX", "70000 mx.example.com."],
		["TXT", '"open'],
		["CAA", "0 issue"],
		["SOA", "a. b. 1 2 3"],
		["SRV", "1 2 port target."],
		["CNAME", ""],
		["A", "\\# 3 0A0000"],
		["A", "\\# 4 0A0000"],
		["CAA", "\\# 4 00 00 61 62"],
	])("fails on %s %j", (type, data) => {
		let result = parseRecordData(type, data);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(RecordDataError);
	});
});
