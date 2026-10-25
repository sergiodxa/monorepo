/**
 * Tests for the normalization both record channels share. They pin the folding rules directly,
 * because a rule that drifts on one side turns every record into a silent change on the next
 * check.
 *
 * The load-bearing block is the last one: the same record written the way a zone file writes it
 * and the way the resolver answers it must fold to one string, or every imported record reads
 * as removed-and-re-added on the first check after the import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ZoneFile } from "@sdxc/zone-file";

import { describe, expect, test } from "vitest";

import type { DnsRecordType } from "~/app/services/dns/record-value";

import {
	DNS_RECORD_TYPES,
	isDnsRecordType,
	normalizeDnsName,
	normalizeDnsRecordValue,
	storedRecordValue,
} from "~/app/services/dns/record-value";

describe("DNS_RECORD_TYPES", () => {
	test("covers the ten types a domain monitor sweeps, and no more", () => {
		expect([...DNS_RECORD_TYPES]).toEqual([
			"A",
			"AAAA",
			"CNAME",
			"MX",
			"TXT",
			"NS",
			"CAA",
			"TLSA",
			"DS",
			"SVCB",
		]);
	});
});

describe("isDnsRecordType", () => {
	test("accepts the tracked types and nothing else", () => {
		expect(isDnsRecordType("A")).toBe(true);
		expect(isDnsRecordType("TXT")).toBe(true);
		expect(isDnsRecordType("MX")).toBe(true);
		expect(isDnsRecordType("CAA")).toBe(true);
		expect(isDnsRecordType("TLSA")).toBe(true);
		expect(isDnsRecordType("DS")).toBe(true);
		expect(isDnsRecordType("SVCB")).toBe(true);
		expect(isDnsRecordType("HTTPS")).toBe(false);
		expect(isDnsRecordType("a")).toBe(false);
		expect(isDnsRecordType("SOA")).toBe(false);
	});
});

describe("normalizeDnsName", () => {
	test.each([
		["Example.COM.", "example.com"],
		["example.com", "example.com"],
		["WWW.Example.COM.", "www.example.com"],
		["  WWW.example.com.  ", "www.example.com"],
	])("folds %j to %j", (input, expected) => {
		expect(normalizeDnsName(input)).toBe(expected);
	});

	test("leaves the root itself alone rather than folding it to an empty name", () => {
		expect(normalizeDnsName(".")).toBe(".");
	});
});

describe("AAAA canonical form", () => {
	test.each([
		["2606:4700:3030:0000:0000:0000:6815:3AF9", "2606:4700:3030::6815:3af9"],
		["2606:4700:3030::6815:3af9", "2606:4700:3030::6815:3af9"],
		["2606:4700:3037:0000::AC43:A682", "2606:4700:3037::ac43:a682"],
		["2001:DB8:0:0:0:0:0:1", "2001:db8::1"],
		["2001:0db8::0001", "2001:db8::1"],
		["0:0:0:0:0:0:0:1", "::1"],
		["0:0:0:0:0:0:0:0", "::"],
		["::", "::"],
		["2001:db8:0:0:1:0:0:1", "2001:db8::1:0:0:1"],
		["2001:DB8:0:1:1:1:1:1", "2001:db8:0:1:1:1:1:1"],
		["::ffff:192.0.2.1", "::ffff:c000:201"],
	])("rewrites %j as %j", (input, expected) => {
		expect(normalizeDnsRecordValue("AAAA", input)).toBe(expected);
	});

	test.each([
		["2001:0:0:1:2001:0:0:1", "2001::1:2001:0:0:1"],
		["2001:0:0:1:0:0:0:1", "2001:0:0:1::1"],
		["1:0:0:1:0:0:1:1", "1::1:0:0:1:1"],
	])("elides the longest run of zero groups, leftmost on a tie: %j", (input, expected) => {
		expect(normalizeDnsRecordValue("AAAA", input)).toBe(expected);
	});
});

/** The identity rules for data that parses, which both input channels share. */
describe("normalizeDnsRecordValue on valid data", () => {
	test.each([
		["A", "104.21.58.249", "104.21.58.249"],
		["A", " 1.2.3.4 ", "1.2.3.4"],
		["AAAA", "2606:4700:3030:0:0:0:6815:3AF9", "2606:4700:3030::6815:3af9"],
		["CNAME", "GH-ds9.Pages.dev.", "gh-ds9.pages.dev"],
		["CNAME", "Target.Example.NET.", "target.example.net"],
		["NS", "dora.ns.cloudflare.com.", "dora.ns.cloudflare.com"],
		["NS", "DORA.ns.cloudflare.com.", "dora.ns.cloudflare.com"],
		["MX", "5 ASPMX.L.google.com.", "5 aspmx.l.google.com"],
		/** A preference is part of the record, so it is kept — and re-printed, so `05` is `5`. */
		["MX", "05 aspmx.l.google.com.", "5 aspmx.l.google.com"],
		["MX", "05 ALT1.aspmx.L.Google.com.", "5 alt1.aspmx.l.google.com"],
		["MX", "10\tmx.example.com.", "10 mx.example.com"],
		["TXT", '"a" "b"', "ab"],
		["TXT", '"v=spf1 -all"', "v=spf1 -all"],
		["TXT", '"v=DKIM1; p=AAA" "BBB"', "v=DKIM1; p=AAABBB"],
		/** SPF and DMARC both depend on the spacing inside a character-string. */
		["TXT", '"v=DMARC1;  p=none;"', "v=DMARC1;  p=none;"],
		/** DKIM base64 depends on the case. */
		["TXT", '"p=MIGfMA0GCSqGSIb3"', "p=MIGfMA0GCSqGSIb3"],
		["TXT", '"say \\"hi\\""', 'say "hi"'],
		/**
		 * Unquoted data is one character-string with spaces in it, not several: this is the shape
		 * a person types into an expected-value box, and splitting it would fold it to `v=spf1-all`
		 * while the resolver's own quoted answer keeps the space.
		 */
		["TXT", "  v=spf1 -all  ", "v=spf1 -all"],
		["CAA", '0 issue "letsencrypt.org"', '0 issue "letsencrypt.org"'],
		/** Tags match case-insensitively and a value may be written bare; both print one way. */
		["CAA", "0 ISSUE letsencrypt.org", '0 issue "letsencrypt.org"'],
		[
			"CAA",
			'0 issuewild "digicert.com; cansignhttpexchanges=yes"',
			'0 issuewild "digicert.com; cansignhttpexchanges=yes"',
		],
		/** RFC 7671 §5.1's DANE-EE example: the association data is stored as lowercase hex. */
		[
			"TLSA",
			"3 1 1 0C72AC70B745AC19998811B131D662C9AC69DBDBE7CB23E5B514B56664C5D3D6",
			"3 1 1 0c72ac70b745ac19998811b131d662c9ac69dbdbe7cb23e5b514b56664c5d3d6",
		],
		/** RFC 6698 §2.3: a hex payload split by whitespace is one association. */
		[
			"TLSA",
			"0 0 1 d2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971",
			"0 0 1 d2abde240d7cd3ee6b4b28c54df034b97983a1d16e8a410e4561cb106618e971",
		],
		/** RFC 4034 §5.4. */
		[
			"DS",
			"60485 5 1 2BB183AF5F22588179A53B0A98631FAD1A292118",
			"60485 5 1 2bb183af5f22588179a53b0a98631fad1a292118",
		],
		/**
		 * RFC 9460 Appendix D: parameters print in key order with `mandatory` sorted, and the
		 * target loses its trailing dot like every other stored name.
		 */
		[
			"SVCB",
			"16 foo.example.org. alpn=h2,h3-19 mandatory=ipv4hint,alpn ipv4hint=192.0.2.1",
			'16 foo.example.org mandatory=alpn,ipv4hint alpn="h2,h3-19" ipv4hint=192.0.2.1',
		],
		["SVCB", "0 SVC.Example.NET.", "0 svc.example.net"],
		/** The root target means "this owner name" and keeps its dot. */
		["SVCB", "1 . alpn=h2", '1 . alpn="h2"'],
	] as const)("reads a %s of %j as %j", (type, data, expected) => {
		expect(normalizeDnsRecordValue(type, data)).toBe(expected);
	});
});

describe("normalizeDnsRecordValue on invalid data", () => {
	/**
	 * The whole point of the total reading: a value that fails to parse is still the record's
	 * identity, so dropping it would report a record the customer still publishes as `missing`
	 * — a false alert — where carrying it through at worst leaves a record that never changes.
	 */
	test.each([
		["A", "not-an-address", "not-an-address"],
		["AAAA", "NOT:AN:ADDRESS:::1", "not:an:address:::1"],
		/** A hand-typed expected MX value is a bare host, carried through as one. */
		["MX", "MX.Example.com.", "mx.example.com"],
		["MX", "aspmx.l.google.com.", "aspmx.l.google.com"],
		/** A non-numeric preference like `high` is kept exactly as written. */
		["MX", "high mx.example.com.", "high mx.example.com"],
		["TXT", '"open', "open"],
		/** CAA has no partial reading to fold toward, so the trimmed text is its identity. */
		["CAA", "  issue letsencrypt.org  ", "issue letsencrypt.org"],
		/** Hex that is not hex still folds its case and spacing, as valid data would. */
		["TLSA", "3 1 1 0C72 ZZ", "3 1 1 0c72zz"],
		["DS", "60485 5 1 2BB1 83ZZ", "60485 5 1 2bb183zz"],
		["DS", "60485 5", "60485 5"],
		/** An unknown parameter keeps its text; only the target folds. */
		["SVCB", "1 Foo.Example.ORG. bogus", "1 foo.example.org bogus"],
	] as const)("carries an unparseable %s of %j through as %j", (type, data, expected) => {
		expect(normalizeDnsRecordValue(type, data)).toBe(expected);
	});
});

describe("the two input channels agree", () => {
	/**
	 * Left is the presentation a zone-file export writes, right is the `data` field the DoH
	 * API answers with. Every pair is a record that exists, read off both channels.
	 */
	let pairs: [type: DnsRecordType, zoneFile: string, resolver: string][] = [
		["CNAME", "dkim.dm-0m73q9wy.sg2.convertkit.com.", "dkim.dm-0m73q9wy.sg2.convertkit.com."],
		["NS", "dora.ns.cloudflare.com.", "dora.ns.cloudflare.com."],
		["MX", "10 mx.example.com.", "10 mx.example.com."],
		["MX", "05 mx.example.com.", "5 mx.example.com."],
		["TXT", '"v=DMARC1; p=none;"', '"v=DMARC1; p=none;"'],
		[
			"TXT",
			'"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48I" "m4KXwaf9xUJCWF6nxeD+qG6Fyruw1QlIDAQAB"',
			'"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48I" "m4KXwaf9xUJCWF6nxeD+qG6Fyruw1QlIDAQAB"',
		],
		["AAAA", "2606:4700:3037:0:0:0:AC43:A682", "2606:4700:3037::ac43:a682"],
		["A", "104.21.58.249", "104.21.58.249"],
		/**
		 * The `sergiodxa.com` export's CAA line against the resolver's two answers for it:
		 * presentation form, and the RFC 3597 generic form some resolvers send for CAA.
		 */
		["CAA", '0 issue "letsencrypt.org"', '0 issue "letsencrypt.org"'],
		[
			"CAA",
			'0 issue "letsencrypt.org"',
			"\\# 22 00 05 69 73 73 75 65 6c 65 74 73 65 6e 63 72 79 70 74 2e 6f 72 67",
		],
		/** RFC 7671 §5.1's TLSA, as presentation form and as the RFC 3597 generic form. */
		[
			"TLSA",
			"3 1 1 0C72AC70B745AC19998811B131D662C9AC69DBDBE7CB23E5B514B56664C5D3D6",
			"\\# 35 03 01 01 0c72ac70b745ac19998811b131d662c9ac69dbdbe7cb23e5b514b56664c5d3d6",
		],
		/** RFC 4034 §5.4's DS, both ways. */
		[
			"DS",
			"60485 5 1 2BB183AF5F22588179A53B0A98631FAD1A292118",
			"\\# 24 ec45 05 01 2bb183af5f22588179a53b0a98631fad1a292118",
		],
		/** RFC 9460 Appendix D's ServiceMode SVCB, both ways. */
		[
			"SVCB",
			"16 foo.example.org. alpn=h2,h3-19 mandatory=ipv4hint,alpn ipv4hint=192.0.2.1",
			"\\# 48 0010 03666f6f076578616d706c65036f726700 00000004 00010004 0001000902683205" +
				"68332d3139 00040004c0000201",
		],
	];

	for (let [recordType, zoneFile, resolver] of pairs) {
		test(`${recordType} ${zoneFile.slice(0, 40)}`, () => {
			expect(normalizeDnsRecordValue(recordType, zoneFile)).toBe(
				normalizeDnsRecordValue(recordType, resolver),
			);
		});
	}

	test("an embedded dotted quad and its hex spelling are one AAAA record", () => {
		expect(normalizeDnsRecordValue("AAAA", "::ffff:192.0.2.1")).toBe(
			normalizeDnsRecordValue("AAAA", "::ffff:c000:201"),
		);
	});

	test("the DKIM chunk join carries no separator, so neither channel can add one", () => {
		let joined = normalizeDnsRecordValue("TXT", '"…0H4cpYH9+3JJ78k" "m4KXwaf9xUJCWF6nxeD"');

		expect(joined).toBe("…0H4cpYH9+3JJ78km4KXwaf9xUJCWF6nxeD");
		expect(joined).not.toContain('" "');
	});
});

describe("TXT escapes", () => {
	test.each([
		['"say \\"hi\\""', 'say "hi"'],
		['"a\\\\b"', "a\\b"],
		['"a\\;b"', "a;b"],
		['"caf\\195\\169"', "caf\u00e9"],
	])("decodes %j as %j", (data, expected) => {
		expect(normalizeDnsRecordValue("TXT", data)).toBe(expected);
	});
});

describe("storedRecordValue", () => {
	/**
	 * A resolver's answer reaches the sweep as typed records, a zone file as presentation text;
	 * both must land on one stored value or every imported record diffs as changed.
	 */
	let cases: [record: ZoneFile.RecordData<DnsRecordType>, zoneFile: string][] = [
		[{ type: "A", address: "104.21.58.249" }, "104.21.58.249"],
		[{ type: "AAAA", address: "2606:4700:3030::6815:3af9" }, "2606:4700:3030:0:0:0:6815:3AF9"],
		[{ type: "CNAME", target: "gh-ds9.pages.dev" }, "GH-ds9.Pages.dev."],
		[{ type: "NS", host: "dora.ns.cloudflare.com" }, "dora.ns.cloudflare.com."],
		[
			{ type: "MX", preference: 5, exchange: "alt1.aspmx.l.google.com" },
			"05 ALT1.aspmx.l.google.com.",
		],
		[{ type: "MX", preference: 0, exchange: "." }, "0 ."],
		[
			{ type: "TXT", text: "v=DKIM1; p=AAABBB", strings: ["v=DKIM1; p=AAA", "BBB"] },
			'"v=DKIM1; p=AAA" "BBB"',
		],
		[
			{ type: "CAA", flags: 0, critical: false, tag: "issue", value: "letsencrypt.org" },
			'0 issue "letsencrypt.org"',
		],
		[
			{
				type: "TLSA",
				usage: 3,
				selector: 1,
				matchingType: 1,
				certificateAssociation: "0c72ac70b745ac19998811b131d662c9ac69dbdbe7cb23e5b514b56664c5d3d6",
			},
			"3 1 1 0C72AC70B745AC19998811B131D662C9AC69DBDBE7CB23E5B514B56664C5D3D6",
		],
		[
			{
				type: "DS",
				keyTag: 60485,
				algorithm: 5,
				digestType: 1,
				digest: "2bb183af5f22588179a53b0a98631fad1a292118",
			},
			"60485 5 1 2BB183AF5F22588179A53B0A98631FAD1A292118",
		],
		[
			{
				type: "SVCB",
				priority: 16,
				target: "foo.example.org",
				params: { mandatory: ["alpn", "ipv4hint"], alpn: ["h2", "h3-19"], ipv4Hint: ["192.0.2.1"] },
			},
			"16 foo.example.org. alpn=h2,h3-19 mandatory=ipv4hint,alpn ipv4hint=192.0.2.1",
		],
	];

	for (let [record, zoneFile] of cases) {
		test(`${record.type} ${zoneFile}`, () => {
			expect(storedRecordValue(record)).toBe(normalizeDnsRecordValue(record.type, zoneFile));
		});
	}
});
