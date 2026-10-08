/**
 * Covers `parse` one grammar construct at a time — comments, quoting, parentheses, names,
 * owners, TTLs, classes, types and each directive — and one test per rejection reason, so
 * every row of the master-file grammar has an assertion of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type * as ZoneFile from "./types.js";

import { ZoneFileError } from "./errors.js";
import { parse } from "./parse.js";

/** Parses against `example.com`, asserting the size limit was not tripped. */
function read(text: string, options: Partial<ZoneFile.ParseOptions> = {}): ZoneFile.Zone {
	return unwrap(parse(text, { origin: "example.com", ...options }));
}

/** The one record a single-record file declares. */
function only(text: string, options: Partial<ZoneFile.ParseOptions> = {}): ZoneFile.Record {
	let zone = read(text, options);
	expect(zone.rejected).toEqual([]);
	expect(zone.records).toHaveLength(1);
	return zone.records[0] as ZoneFile.Record;
}

describe("parse", () => {
	describe("comments", () => {
		test("keeps a record's trailing comment and skips comment-only lines", () => {
			let zone = read("; header\n\nwww 300 IN A 192.0.2.1 ;  web server \n   ; indented note\n");
			expect(zone.rejected).toEqual([]);
			expect(zone.records).toEqual([
				{
					name: "www.example.com",
					ttl: 300,
					class: "IN",
					type: "A",
					address: "192.0.2.1",
					file: null,
					line: 3,
					endLine: 3,
					comment: "web server",
				},
			]);
		});

		test("reads a comment that touches the data", () => {
			expect(only("www 300 IN A 192.0.2.1;web").comment).toBe("web");
		});
	});

	describe("quoted strings", () => {
		test("keeps `;` and parentheses inside quotes as data", () => {
			expect(only('@ 300 IN TXT "v=spf1 a; mx (all)" ; spf')).toMatchObject({
				text: "v=spf1 a; mx (all)",
				comment: "spf",
			});
		});

		test('decodes `\\"`, `\\\\` and `\\DDD` escapes', () => {
			expect(only('@ 300 IN TXT "say \\"hi\\" a\\\\b caf\\195\\169"')).toMatchObject({
				strings: ['say "hi" a\\b café'],
			});
		});

		test("rejects a quote left open at the end of a line", () => {
			let zone = read('@ 300 IN TXT "open\n"close"');
			expect(zone.records).toEqual([]);
			expect(zone.rejected[0]).toMatchObject({ line: 1, reason: "malformed" });
		});
	});

	describe("parentheses", () => {
		test("join lines into one entry and drop the comments inside", () => {
			let text = [
				"@ 3600 IN SOA ns1 hostmaster (",
				"    2026100801 ; serial",
				"    7200 3600 1209600 300 ) ; soa",
				"www 300 IN A 192.0.2.1",
			].join("\n");
			let zone = read(text);
			expect(zone.rejected).toEqual([]);
			expect(zone.records[0]).toMatchObject({
				type: "SOA",
				primary: "ns1.example.com",
				mailbox: "hostmaster.example.com",
				serial: 2026100801,
				minimum: 300,
				line: 1,
				endLine: 3,
				comment: "soa",
			});
			expect(zone.records[1]).toMatchObject({ name: "www.example.com", line: 4, endLine: 4 });
		});

		test("reject an entry whose parentheses never close, through the end of the file", () => {
			let zone = read("@ 3600 IN SOA ns1 hostmaster ( 1 2\n3 4 5\nwww A 192.0.2.1");
			expect(zone.records).toEqual([]);
			expect(zone.rejected).toEqual([
				expect.objectContaining({ line: 1, endLine: 3, reason: "malformed" }),
			]);
		});

		test("reject a closing parenthesis without an opening one, and nesting", () => {
			let zone = read("www A 192.0.2.1 )\nmail ( A ( 192.0.2.2 ) )");
			expect(zone.records).toEqual([]);
			expect(zone.rejected.map((rejection) => rejection.reason)).toEqual([
				"malformed",
				"malformed",
			]);
		});
	});

	describe("names", () => {
		test("reads `@` as the current origin, in owners and in RDATA", () => {
			expect(only("@ 300 IN CNAME @")).toMatchObject({
				name: "example.com",
				target: "example.com",
			});
		});

		test("appends the origin to relative owners and typed RDATA names", () => {
			let zone = read(
				[
					"mail 300 IN MX 10 mx",
					"_sip._tcp 300 IN SRV 0 5 5060 sip",
					"@ 300 IN NS ns1",
					"4.2 300 IN PTR host",
					"old 300 IN DNAME new",
					"@ 300 IN SOA ns1 hostmaster 1 2 3 4 5",
				].join("\n"),
			);
			expect(zone.rejected).toEqual([]);
			expect(zone.records).toMatchObject([
				{ name: "mail.example.com", exchange: "mx.example.com" },
				{ name: "_sip._tcp.example.com", target: "sip.example.com" },
				{ name: "example.com", host: "ns1.example.com" },
				{ name: "4.2.example.com", type: "PTR", target: "host.example.com" },
				{ name: "old.example.com", type: "DNAME", target: "new.example.com" },
				{ primary: "ns1.example.com", mailbox: "hostmaster.example.com" },
			]);
		});

		test("keeps absolute names and lowercases every name", () => {
			expect(only("WWW.Example.NET. 300 IN CNAME Edge.CDN.example.")).toMatchObject({
				name: "www.example.net",
				target: "edge.cdn.example",
			});
		});

		test("resolves `\\.` and `\\DDD` escapes to the canonical presentation form", () => {
			expect(only("a\\.b\\065 300 IN CNAME c\\032d.")).toMatchObject({
				name: "a\\.ba.example.com",
				target: "c\\032d",
			});
		});

		test("reads a dotless name ending in the origin as relative under RFC 1035", () => {
			expect(only("example.com 300 IN A 192.0.2.1").name).toBe("example.com.example.com");
		});

		test("reads it as absolute under `origin-suffix`", () => {
			let options = { relativeNames: "origin-suffix" } as const;
			expect(only("example.com 300 IN A 192.0.2.1", options).name).toBe("example.com");
			expect(only("www.example.com 300 IN CNAME example.com", options)).toMatchObject({
				name: "www.example.com",
				target: "example.com",
			});
			expect(only("www 300 IN A 192.0.2.1", options).name).toBe("www.example.com");
		});

		test("rejects an owner with an empty label or a label over 63 octets", () => {
			let zone = read(`a..b 300 IN A 192.0.2.1\n${"x".repeat(64)} 300 IN A 192.0.2.1`);
			expect(zone.records).toEqual([]);
			expect(zone.rejected.map((rejection) => rejection.reason)).toEqual([
				"malformed",
				"malformed",
			]);
		});
	});

	describe("blank owners", () => {
		test("take the previous entry's owner", () => {
			let zone = read("www 300 IN A 192.0.2.1\n\t300 IN A 192.0.2.2\n  IN AAAA 2001:db8::1");
			expect(zone.records.map((record) => record.name)).toEqual([
				"www.example.com",
				"www.example.com",
				"www.example.com",
			]);
		});
	});

	describe("TTL and class", () => {
		test("read in either order, both optional", () => {
			let zone = read(
				[
					"a 300 IN A 192.0.2.1",
					"b IN 300 A 192.0.2.2",
					"c 600 A 192.0.2.3",
					"d CH A 192.0.2.4",
					"e A 192.0.2.5",
				].join("\n"),
			);
			expect(zone.records.map((record) => [record.name, record.ttl, record.class])).toEqual([
				["a.example.com", 300, "IN"],
				["b.example.com", 300, "IN"],
				["c.example.com", 600, "IN"],
				["d.example.com", 600, "CH"],
				["e.example.com", 600, "CH"],
			]);
		});

		test("read BIND units, combined and case-insensitive", () => {
			let zone = read("a 1h30m A 192.0.2.1\nb 2W A 192.0.2.2\nc 1d2h3m4s A 192.0.2.3");
			expect(zone.records.map((record) => record.ttl)).toEqual([5400, 1_209_600, 93_784]);
		});

		test("reject a TTL over 2³¹−1", () => {
			let zone = read("a 2147483647 A 192.0.2.1\nb 2147483648 A 192.0.2.2");
			expect(zone.records.map((record) => record.ttl)).toEqual([2_147_483_647]);
			expect(zone.rejected).toEqual([expect.objectContaining({ line: 2, reason: "malformed" })]);
		});

		test("inherit: explicit, then `$TTL`, then the previous record's, then the option", () => {
			let zone = read(
				[
					"a A 192.0.2.1",
					"b 300 A 192.0.2.2",
					"c A 192.0.2.3",
					"$TTL 900",
					"d A 192.0.2.4",
					"e 60 A 192.0.2.5",
					"f A 192.0.2.6",
				].join("\n"),
				{ ttl: 30 },
			);
			expect(zone.records.map((record) => record.ttl)).toEqual([30, 300, 300, 900, 60, 900]);
		});

		test("leave the TTL `null` when nothing states one", () => {
			expect(only("a A 192.0.2.1").ttl).toBeNull();
		});

		test("read every class mnemonic and `CLASSnnn`", () => {
			let zone = read(
				[
					"a IN A 192.0.2.1",
					"b CH A 192.0.2.2",
					"c hs A 192.0.2.3",
					"d CS A 192.0.2.4",
					"e CLASS1 A 192.0.2.5",
					"f CLASS254 TYPE65280 \\# 0",
				].join("\n"),
			);
			expect(zone.rejected).toEqual([]);
			expect(zone.records.map((record) => record.class)).toEqual([
				"IN",
				"CH",
				"HS",
				"CS",
				"IN",
				"CLASS254",
			]);
		});
	});

	describe("types", () => {
		test("read any mnemonic, keeping untyped data as written with its origin", () => {
			expect(only('www 300 IN HTTPS 1 . alpn="h3,h2"')).toEqual({
				name: "www.example.com",
				ttl: 300,
				class: "IN",
				type: "HTTPS",
				data: '1 . alpn="h3,h2"',
				origin: "example.com",
				file: null,
				line: 1,
				endLine: 1,
				comment: null,
			});
		});

		test("read `TYPEnnn` as the mnemonic it has", () => {
			expect(only("www 300 IN TYPE1 192.0.2.1")).toMatchObject({ type: "A", address: "192.0.2.1" });
		});

		test("read RFC 3597 generic data for typed and untyped types", () => {
			let zone = read("a 300 IN A \\# 4 C0000201\nb 300 IN TYPE731 \\# 2 abcd");
			expect(zone.records).toMatchObject([
				{ type: "A", address: "192.0.2.1" },
				{ type: "TYPE731", data: "\\# 2 abcd" },
			]);
		});

		test("join unquoted TXT words as separate character-strings", () => {
			expect(only("@ 300 IN TXT v=spf1 -all")).toMatchObject({
				text: "v=spf1-all",
				strings: ["v=spf1", "-all"],
			});
		});
	});

	describe("$ORIGIN", () => {
		test("changes the origin for later entries, a relative argument appended to it", () => {
			let zone = read(
				[
					"a 300 A 192.0.2.1",
					"$ORIGIN sub",
					"b 300 A 192.0.2.2",
					"$ORIGIN other.example.",
					"c 300 CNAME d",
				].join("\n"),
			);
			expect(zone.records).toMatchObject([
				{ name: "a.example.com" },
				{ name: "b.sub.example.com" },
				{ name: "c.other.example", target: "d.other.example" },
			]);
			expect(zone.origin).toBe("other.example");
		});
	});

	describe("$INCLUDE", () => {
		let files: Record<string, string> = {
			"mail.zone": "mx 300 A 192.0.2.10\n$ORIGIN elsewhere.example.\n$TTL 60\nx A 192.0.2.11",
			"loop.zone": "$INCLUDE loop.zone",
		};
		let include = (fileName: string) => files[fileName] ?? null;

		test("reads the file under the given or current origin, then restores the origin and $TTL", () => {
			let zone = read(
				["$TTL 900", "$INCLUDE mail.zone", "$INCLUDE mail.zone sub", "after A 192.0.2.1"].join(
					"\n",
				),
				{ include },
			);
			expect(zone.rejected).toEqual([]);
			expect(
				zone.records.map((record) => [record.name, record.ttl, record.file, record.line]),
			).toEqual([
				["mx.example.com", 300, "mail.zone", 1],
				["x.elsewhere.example", 60, "mail.zone", 4],
				["mx.sub.example.com", 300, "mail.zone", 1],
				["x.elsewhere.example", 60, "mail.zone", 4],
				["after.example.com", 900, null, 4],
			]);
			expect(zone.origin).toBe("example.com");
		});

		test("passes the file name and its origin to the option", () => {
			let calls: [string, string][] = [];
			read('$INCLUDE "a file.zone" Sub', {
				include: (fileName, origin) => {
					calls.push([fileName, origin]);
					return "";
				},
			});
			expect(calls).toEqual([["a file.zone", "sub.example.com"]]);
		});

		test("rejects nesting past 8 files, at the line that would go deeper", () => {
			let zone = read("$INCLUDE loop.zone", { include });
			expect(zone.rejected).toEqual([
				expect.objectContaining({ file: "loop.zone", line: 1, reason: "include" }),
			]);
		});

		test("counts included bytes toward `maxBytes`", () => {
			let result = parse("$INCLUDE big.zone", {
				origin: "example.com",
				maxBytes: 100,
				include: () => "a".repeat(100),
			});
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error.bytes).toBe(117);
		});
	});

	describe("the size limit", () => {
		test("fails the whole parse past `maxBytes`, counting UTF-8 bytes", () => {
			let result = parse("é".repeat(51), { origin: "example.com", maxBytes: 100 });
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(ZoneFileError);
				expect(result.error).toMatchObject({ code: "too-large", bytes: 102 });
			}
			expect(isFailure(parse("é".repeat(50), { origin: "example.com", maxBytes: 100 }))).toBe(
				false,
			);
		});
	});

	describe("rejections", () => {
		test("`malformed`: a missing type or RDATA", () => {
			let zone = read('www 300 IN\nmail 300 IN A\n"quoted" A 192.0.2.1');
			expect(zone.rejected).toMatchObject([
				{ line: 1, reason: "malformed", input: "www 300 IN" },
				{ line: 2, reason: "malformed" },
				{ line: 3, reason: "malformed" },
			]);
		});

		test("`invalid-data`: RDATA that does not fit its type, with the codec's message", () => {
			expect(read("www 300 IN A 999.1.1.1").rejected).toEqual([
				{
					file: null,
					line: 1,
					endLine: 1,
					input: "www 300 IN A 999.1.1.1",
					reason: "invalid-data",
					message: 'Invalid A record data: "999.1.1.1"',
				},
			]);
		});

		test("`missing-owner`: a blank owner before any record", () => {
			expect(read("\t300 IN A 192.0.2.1").rejected).toMatchObject([{ reason: "missing-owner" }]);
		});

		test("`include`: `$INCLUDE` without the option, or a file it has no text for", () => {
			expect(read("$INCLUDE a.zone").rejected).toMatchObject([{ reason: "include" }]);
			expect(read("$INCLUDE a.zone", { include: () => null }).rejected).toMatchObject([
				{ reason: "include" },
			]);
		});

		test("`unsupported-directive`: `$GENERATE` and any other `$` word", () => {
			let zone = read("$GENERATE 1-3 host$ A 192.0.2.$\n$FOO bar");
			expect(zone.records).toEqual([]);
			expect(zone.rejected).toMatchObject([
				{
					line: 1,
					reason: "unsupported-directive",
					message: "$GENERATE is not a supported directive",
				},
				{ line: 2, reason: "unsupported-directive" },
			]);
		});

		test("keep the records around a rejected entry", () => {
			let zone = read("a 300 A 192.0.2.1\nb 300 A nope\nc 300 A 192.0.2.3");
			expect(zone.records.map((record) => record.name)).toEqual(["a.example.com", "c.example.com"]);
			expect(zone.rejected).toHaveLength(1);
		});
	});

	test("returns records outside the origin, repeats and every class for the caller to judge", () => {
		let zone = read("a 300 A 192.0.2.1\na 300 A 192.0.2.1\nexample.net. 300 CH A 192.0.2.1");
		expect(zone.rejected).toEqual([]);
		expect(zone.records).toHaveLength(3);
	});
});
