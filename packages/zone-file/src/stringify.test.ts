/**
 * Covers `stringify`: absolute and relative names, `$ORIGIN` and `$TTL` headers, TTLs left
 * out when they equal `$TTL`, the `$ORIGIN` an untyped record's verbatim data needs, and
 * comments written back after `;`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type * as ZoneFile from "./types.js";

import { parse } from "./parse.js";
import { stringify } from "./stringify.js";

/** A small zone with an apex SOA, MX, a CNAME to the apex and a commented TXT. */
const RECORDS: ZoneFile.RecordInput[] = [
	{
		name: "example.com",
		type: "SOA",
		primary: "ns1.example.com",
		mailbox: "hostmaster.example.com",
		serial: 2026100801,
		refresh: 7200,
		retry: 3600,
		expire: 1209600,
		minimum: 300,
	},
	{ name: "example.com", ttl: 3600, type: "MX", preference: 10, exchange: "mail.example.com" },
	{ name: "www.example.com", ttl: 300, type: "CNAME", target: "example.com" },
	{
		name: "example.com",
		type: "TXT",
		text: "v=spf1 include:_spf.example.net -all",
		strings: ["v=spf1 include:_spf.example.net -all"],
		comment: "spf",
	},
];

describe("stringify", () => {
	test("writes names relative to the origin, the apex as `@`", () => {
		expect(stringify({ origin: "example.com", ttl: 3600, records: RECORDS }, { relative: true }))
			.toBe(`$ORIGIN example.com.
$TTL 3600
@	IN	SOA	ns1 hostmaster 2026100801 7200 3600 1209600 300
@	IN	MX	10 mail
www	300	IN	CNAME	@
@	IN	TXT	"v=spf1 include:_spf.example.net -all" ; spf
`);
	});

	test("writes every name absolute by default", () => {
		expect(stringify({ origin: "example.com", ttl: 3600, records: RECORDS }))
			.toBe(`$ORIGIN example.com.
$TTL 3600
example.com.	IN	SOA	ns1.example.com. hostmaster.example.com. 2026100801 7200 3600 1209600 300
example.com.	IN	MX	10 mail.example.com.
www.example.com.	300	IN	CNAME	example.com.
example.com.	IN	TXT	"v=spf1 include:_spf.example.net -all" ; spf
`);
	});

	test("writes names outside the origin absolute in relative mode", () => {
		let text = stringify(
			{
				origin: "example.com",
				records: [{ name: "example.net", ttl: 60, type: "CNAME", target: "cdn.example.org." }],
			},
			{ relative: true },
		);
		expect(text).toBe("$ORIGIN example.com.\nexample.net.\t60\tIN\tCNAME\tcdn.example.org.\n");
	});

	test("writes no headers when the input names no origin or TTL", () => {
		expect(
			stringify({
				records: [{ name: "a.example", ttl: 5, class: "CH", type: "A", address: "192.0.2.1" }],
			}),
		).toBe("a.example.\t5\tCH\tA\t192.0.2.1\n");
		expect(stringify({ records: [] })).toBe("");
	});

	test("writes an `$ORIGIN` before untyped data read under another origin", () => {
		let zone = unwrap(
			parse('$ORIGIN a.example.\nx 60 HINFO "PC" "OS"\n$ORIGIN b.example.\ny 60 RP admin txt', {
				origin: "example.com",
			}),
		);
		let text = stringify({ origin: "a.example", records: zone.records }, { relative: true });
		expect(text).toBe(
			'$ORIGIN a.example.\nx\t60\tIN\tHINFO\t"PC" "OS"\n$ORIGIN b.example.\ny\t60\tIN\tRP\tadmin txt\n',
		);
		expect(unwrap(parse(text, { origin: "example.com" })).records).toMatchObject([
			{ name: "x.a.example", origin: "a.example" },
			{ name: "y.b.example", origin: "b.example", data: "admin txt" },
		]);
	});

	test("keeps a comment on one line", () => {
		let text = stringify({
			records: [
				{ name: "a.example", ttl: 5, type: "A", address: "192.0.2.1", comment: "one\ntwo" },
			],
		});
		expect(text).toBe("a.example.\t5\tIN\tA\t192.0.2.1 ; one two\n");
	});

	test("writes names with escapes that read back to the same labels", () => {
		let zone = unwrap(parse("a\\.b\\@c\\032d 60 CNAME \\$x.", { origin: "example.com" }));
		let text = stringify({ origin: "example.com", records: zone.records }, { relative: true });
		expect(text).toBe("$ORIGIN example.com.\na\\.b\\@c\\032d\t60\tIN\tCNAME\t\\$x.\n");
		expect(unwrap(parse(text, { origin: "example.com" })).records[0]).toMatchObject({
			name: "a\\.b\\@c\\032d.example.com",
			target: "\\$x",
		});
	});
});
