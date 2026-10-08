/**
 * Reads whole zone files: the RFC 1035 section 5.3 example with its `$INCLUDE`, a BIND-style
 * zone using every directive, and a real Cloudflare export, pinning each record they declare
 * and checking that each prints and reads back to the same records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type * as ZoneFile from "./types.js";

import { formatRecordData } from "./format-record-data.js";
import { parse } from "./parse.js";
import { stringify } from "./stringify.js";

/** A fixture's text. */
function fixture(name: string): string {
	return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

/** Serves the fixtures a zone `$INCLUDE`s, by the file name it writes. */
const INCLUDED: Record<string, string> = {
	"<SUBSYS>ISI-MAILBOXES.TXT": "rfc1035-mailboxes.zone",
	"hosts.zone": "bind-hosts.zone",
};

/** Reads an included fixture by the name the zone gives it. */
function include(fileName: string): string | null {
	let name = INCLUDED[fileName];
	return name === undefined ? null : fixture(name);
}

/** A record as one master-file line: name, TTL, class, type and canonical data. */
function line(record: ZoneFile.Record): string {
	return [record.name, record.ttl ?? "-", record.class, record.type, formatRecordData(record)].join(
		" ",
	);
}

/** A record without where it was read, which a printed copy does not keep. */
function content(record: ZoneFile.Record): Partial<ZoneFile.Record> {
	let { file: _file, line: _line, endLine: _endLine, ...rest } = record;
	return rest;
}

/** Prints a zone both ways and expects each to read back to the same records. */
function expectRoundTrip(zone: ZoneFile.Zone, origin: string): void {
	for (let relative of [false, true]) {
		let reread = unwrap(parse(stringify(zone, { relative }), { origin }));
		expect(reread.rejected).toEqual([]);
		expect(reread.records.map(content)).toEqual(zone.records.map(content));
	}
}

describe("the RFC 1035 section 5.3 example", () => {
	let zone = unwrap(parse(fixture("rfc1035.zone"), { origin: "isi.edu", include }));

	test("reads every record, the included mailboxes after the zone's own", () => {
		expect(zone.rejected).toEqual([]);
		expect(zone.records.map(line)).toEqual([
			"isi.edu - IN SOA venera.isi.edu. action\\.domains.isi.edu. 20 7200 600 3600000 60",
			"isi.edu - IN NS a.isi.edu.",
			"isi.edu - IN NS venera.isi.edu.",
			"isi.edu - IN NS vaxa.isi.edu.",
			"isi.edu - IN MX 10 venera.isi.edu.",
			"isi.edu - IN MX 20 vaxa.isi.edu.",
			"a.isi.edu - IN A 26.3.0.103",
			"venera.isi.edu - IN A 10.1.0.52",
			"venera.isi.edu - IN A 128.9.0.32",
			"vaxa.isi.edu - IN A 10.2.0.27",
			"vaxa.isi.edu - IN A 128.9.0.33",
			"moe.isi.edu - IN MB A.ISI.EDU.",
			"larry.isi.edu - IN MB A.ISI.EDU.",
			"curley.isi.edu - IN MB A.ISI.EDU.",
			"stooges.isi.edu - IN MG MOE",
			"stooges.isi.edu - IN MG LARRY",
			"stooges.isi.edu - IN MG CURLEY",
		]);
	});

	test("places each record where it was written", () => {
		expect(zone.records[0]).toMatchObject({ line: 1, endLine: 6, comment: "MINIMUM" });
		expect(zone.records[16]).toMatchObject({
			file: "<SUBSYS>ISI-MAILBOXES.TXT",
			line: 6,
			origin: "isi.edu",
		});
	});

	test("prints and reads back to the same records", () => {
		expectRoundTrip(zone, "isi.edu");
	});
});

describe("a BIND-style zone with every directive", () => {
	let zone = unwrap(parse(fixture("bind.zone"), { origin: "example.org", include }));

	test("reads every record, with each TTL, origin and owner applied", () => {
		expect(zone.rejected).toEqual([]);
		expect(zone.records.map(line)).toEqual([
			"example.org 3600 IN SOA ns1.example.org. hostmaster.example.org. 2026100801 7200 3600 1209600 300",
			"example.org 3600 IN NS ns1.example.org.",
			"example.org 3600 IN NS ns2.example.net.",
			"example.org 3600 IN MX 10 mail.example.org.",
			"example.org 3600 IN MX 20 mail.backup.example.net.",
			'example.org 3600 IN TXT "v=spf1 mx -all"',
			'example.org 3600 IN CAA 0 issue "letsencrypt.org"',
			"ns1.example.org 3600 IN A 192.0.2.53",
			"ns1.example.org 3600 IN AAAA 2001:db8::53",
			"mail.example.org 300 IN A 192.0.2.25",
			"www.example.org 3600 IN CNAME example.org.",
			"ftp.example.org 1800 IN CNAME www.example.org.",
			"_imaps._tcp.example.org 3600 IN SRV 0 1 993 mail.example.org.",
			'_dmarc.example.org 3600 IN TXT "v=DMARC1; p=reject; " "rua=mailto:dmarc@example.org"',
			'long.example.org 3600 IN TXT "part one " "part two"',
			"alpha.hosts.example.org 300 IN A 192.0.2.101",
			"beta.hosts.example.org 300 IN A 192.0.2.102",
			'beta.hosts.example.org 300 IN TXT "beta\'s note"',
			"gamma.hosts.example.org 1800 IN A 192.0.2.103",
			"53.2.0.192.in-addr.arpa 3600 IN PTR ns1.example.org.",
			"25.2.0.192.in-addr.arpa 3600 IN PTR mail.example.org.",
			"legacy.example.org 3600 IN DNAME example.com.",
			'svc.example.org 3600 IN HTTPS 1 . alpn="h3,h2" ipv4hint=192.0.2.80',
			"odd.example.org 3600 IN TYPE65280 \\# 3 abcdef",
		]);
		expect(zone.origin).toBe("example.org");
	});

	test("prints and reads back to the same records", () => {
		expectRoundTrip(zone, "example.org");
	});
});

describe("a Cloudflare export", () => {
	let text = fixture("cloudflare-export.zone");

	test("reads every record, its `cf_tags` metadata kept as the comment", () => {
		let zone = unwrap(parse(text, { origin: "sergiodxa.com" }));
		expect(zone.rejected).toEqual([]);
		expect(zone.records).toHaveLength(45);
		expect(zone.records.find((record) => record.name === "gh.sergiodxa.com")).toMatchObject({
			type: "CNAME",
			ttl: 1,
			target: "gh-ds9.pages.dev",
			comment: "cf_tags=cf-proxied:true",
		});
		expectRoundTrip(zone, "sergiodxa.com");
	});

	test("reads the dotless SOA owner as relative by default, and as the apex under `origin-suffix`", () => {
		let rfc = unwrap(parse(text, { origin: "sergiodxa.com" }));
		let suffix = unwrap(parse(text, { origin: "sergiodxa.com", relativeNames: "origin-suffix" }));
		expect(rfc.records[0]).toMatchObject({ type: "SOA", name: "sergiodxa.com.sergiodxa.com" });
		expect(suffix.records[0]).toMatchObject({ type: "SOA", name: "sergiodxa.com", line: 27 });
	});

	test("returns a record listed twice as two records", () => {
		let zone = unwrap(parse(text, { origin: "sergiodxa.com" }));
		let resend = zone.records.filter(
			(record) => record.type === "TXT" && record.name === "_dmarc.sergiodxa.com",
		);
		expect(resend.map(line)).toEqual([
			'_dmarc.sergiodxa.com 1 IN TXT "v=DMARC1; p=none;"',
			'_dmarc.sergiodxa.com 1 IN TXT "v=DMARC1; p=none;"',
			'_dmarc.sergiodxa.com 1 IN TXT "v=DMARC1;  p=none; rua=mailto:99a61f40ca6c42b994009fbaa7695167@dmarc-reports.cloudflare.net"',
		]);
	});
});
