/**
 * Covers `parseCaaProperty` against RFC 8659's own examples, the whitespace and hyphens
 * its `issue` grammar allows, `iodef` schemes, and the RRset Cloudflare publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseRecordData } from "../parse-record-data.js";

import type { CAA } from "./types.js";

import { parseCaaProperty } from "./property.js";

/** A CAA record's data from its presentation text. */
function record(data: string): CAA.Record {
	return unwrap(parseRecordData("CAA", data));
}

describe("parseCaaProperty", () => {
	test("reads an issuer with parameters", () => {
		expect(parseCaaProperty(record('0 issue "digicert.com; cansignhttpexchanges=yes"'))).toEqual({
			kind: "issue",
			critical: false,
			issuer: "digicert.com",
			malformed: false,
			parameters: [{ key: "cansignhttpexchanges", value: "yes" }],
		});
	});

	test.each([
		['0 issue ";"', null, []],
		[
			'0 issue "ca1.example.net; account=230123"',
			"ca1.example.net",
			[{ key: "account", value: "230123" }],
		],
		['0 issue ""', null, []],
		['0 issue "  CA.Example.NET.  "', "ca.example.net", []],
		[
			'0 issue " ca.example.net ;  account-uri = https://x/acct/1 ; validation-methods=dns-01 "',
			"ca.example.net",
			[
				{ key: "account-uri", value: "https://x/acct/1" },
				{ key: "validation-methods", value: "dns-01" },
			],
		],
		['0 issue "; key="', null, [{ key: "key", value: "" }]],
		['0 issuewild "ca2.example.org; a=b=c"', "ca2.example.org", [{ key: "a", value: "b=c" }]],
	])("reads %s", (data, issuer, parameters) => {
		expect(parseCaaProperty(record(data))).toMatchObject({ issuer, malformed: false, parameters });
	});

	test.each([
		'0 issue "%%%%%"',
		'0 issue "ca.example.net account=1"',
		'0 issue "ca.example.net; account"',
		'0 issue "ca.example.net; a=1;"',
		'0 issue "-ca.example.net"',
		'0 issue "ca..example.net"',
	])("reads %s as malformed, forbidding issuance", (data) => {
		expect(parseCaaProperty(record(data))).toEqual({
			kind: "issue",
			critical: false,
			issuer: null,
			malformed: true,
			parameters: [],
		});
	});

	test("keeps issuewild apart from issue", () => {
		expect(parseCaaProperty(record('0 issuewild "letsencrypt.org"')).kind).toBe("issuewild");
	});

	test.each([
		["mailto:security@example.com", "mailto:security@example.com"],
		["https://iodef.example.com/", "https://iodef.example.com/"],
		["http://iodef.example.com/report", "http://iodef.example.com/report"],
		["ftp://iodef.example.com/", null],
		["not a url", null],
	])("reads iodef %s", (value, url) => {
		expect(parseCaaProperty(record(`0 iodef "${value}"`))).toEqual({
			kind: "iodef",
			critical: false,
			url,
		});
	});

	test("reads any other tag as unknown, keeping critical", () => {
		expect(parseCaaProperty(record('128 tbs "Unknown"'))).toEqual({
			kind: "unknown",
			critical: true,
			tag: "tbs",
			value: "Unknown",
		});
		expect(parseCaaProperty(record('0 contactemail "a@example.com"')).kind).toBe("unknown");
	});

	test("matches the tag case-insensitively on hand-built records", () => {
		let property = parseCaaProperty({
			type: "CAA",
			flags: 0,
			critical: false,
			tag: "ISSUE",
			value: "ca.example.net",
		});
		expect(property).toMatchObject({ kind: "issue", issuer: "ca.example.net" });
	});

	test("reads the RRset Cloudflare publishes", () => {
		let properties = [
			'0 iodef "mailto:tls-abuse@cloudflare.com"',
			'0 issue "comodoca.com"',
			'0 issue "pki.goog; cansignhttpexchanges=yes"',
			'0 issuewild "ssl.com"',
		].map((data) => parseCaaProperty(record(data)));

		expect(properties.map((property) => property.kind)).toEqual([
			"iodef",
			"issue",
			"issue",
			"issuewild",
		]);
		expect(properties.every((property) => !("malformed" in property) || !property.malformed)).toBe(
			true,
		);
	});
});
