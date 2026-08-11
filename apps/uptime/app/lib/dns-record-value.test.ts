/**
 * Tests for the normalization both record channels share. They pin the folding rules directly,
 * because a rule that drifts on one side turns every record into a change on the next check
 * rather than failing anything visibly.
 *
 * The load-bearing block is the last one: the same record written the way a zone file writes it
 * and the way the resolver answers it must fold to one string, or every imported record reads
 * as removed-and-re-added on the first check after the import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import {
	canonicalizeIpv6,
	DNS_RECORD_TYPES,
	isDnsRecordType,
	isIpv4Address,
	normalizeDnsName,
	normalizeDnsRecordValue,
	parseDnsRecordValue,
	readCharacterStrings,
} from "~/app/lib/dns-record-value";

describe("DNS_RECORD_TYPES", () => {
	test("covers the six types a domain monitor sweeps, and no more", () => {
		expect([...DNS_RECORD_TYPES]).toEqual(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]);
	});
});

describe("isDnsRecordType", () => {
	test("accepts the tracked types and nothing else", () => {
		expect(isDnsRecordType("A")).toBe(true);
		expect(isDnsRecordType("TXT")).toBe(true);
		expect(isDnsRecordType("MX")).toBe(true);
		expect(isDnsRecordType("a")).toBe(false);
	});

	test("does not admit CAA or SOA, which need a decoder before they can be an identity", () => {
		expect(isDnsRecordType("CAA")).toBe(false);
		expect(isDnsRecordType("SOA")).toBe(false);
	});
});

describe("normalizeDnsName", () => {
	test.each([
		["Example.COM.", "example.com"],
		["example.com", "example.com"],
		["WWW.Example.COM.", "www.example.com"],
		["  WWW.example.com.  ", "www.example.com"],
	])("folds %p to %p", (input, expected) => {
		expect(normalizeDnsName(input)).toBe(expected);
	});

	test("leaves the root itself alone rather than folding it to an empty name", () => {
		expect(normalizeDnsName(".")).toBe(".");
	});
});

describe("isIpv4Address", () => {
	test.each(["1.1.1.1", "104.21.58.249", "0.0.0.0", "255.255.255.255"])("accepts %p", (value) => {
		expect(isIpv4Address(value)).toBe(true);
	});

	test.each([
		"256.1.1.1",
		"1.1.1",
		"1.1.1.1.1",
		/** Ambiguous: read as octal by some resolvers and as decimal by others. */
		"010.1.1.1",
		"1.1.1.-1",
	])("refuses %p", (value) => {
		expect(isIpv4Address(value)).toBe(false);
	});
});

describe("canonicalizeIpv6", () => {
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
	])("rewrites %p as %p", (input, expected) => {
		expect(canonicalizeIpv6(input)).toBe(expected);
	});

	test.each([
		"192.0.2.1",
		"2001:db8::1::2",
		"2001:db8:0:0:0:0:0:0:1",
		"fe80::1%eth0",
		"gggg::1",
		"",
	])("refuses %p", (value) => {
		expect(canonicalizeIpv6(value)).toBeNull();
	});

	test.each([
		["2001:0:0:1:2001:0:0:1", "2001::1:2001:0:0:1"],
		["2001:0:0:1:0:0:0:1", "2001:0:0:1::1"],
		["1:0:0:1:0:0:1:1", "1::1:0:0:1:1"],
	])("elides the longest run of zero groups, leftmost on a tie: %p", (input, expected) => {
		expect(canonicalizeIpv6(input)).toBe(expected);
	});
});

describe("readCharacterStrings", () => {
	test("joins several character-strings with nothing between them", () => {
		expect(readCharacterStrings('"v=DKIM1; p=AAA" "BBB"')).toBe("v=DKIM1; p=AAABBB");
	});

	test("keeps whitespace and case inside a string", () => {
		expect(readCharacterStrings('"v=DMARC1;  P=none;"')).toBe("v=DMARC1;  P=none;");
	});

	test("unescapes a quote and a backslash, and keeps every other escape", () => {
		expect(readCharacterStrings('"say \\"hi\\""')).toBe('say "hi"');
		expect(readCharacterStrings('"a\\\\b"')).toBe("a\\b");
		expect(readCharacterStrings('"a\\;b"')).toBe("a\\;b");
	});

	test("reads a bare word as a character-string", () => {
		expect(readCharacterStrings("bare")).toBe("bare");
	});

	test("refuses a string that is never closed", () => {
		expect(readCharacterStrings('"open')).toBeNull();
	});
});

/**
 * The rules themselves, which both readings share. Every case here is also a case of
 * {@link normalizeDnsRecordValue}, since the total reading is this one plus a fallback.
 */
describe("parseDnsRecordValue", () => {
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
	] as const)("reads a %s of %p as %p", (type, data, expected) => {
		expect(parseDnsRecordValue(type, data)).toBe(expected);
	});

	test.each([
		["A", "not-an-address"],
		["A", "999.1.1.1"],
		["AAAA", "1.1.1.1"],
		["AAAA", "NOT:AN:ADDRESS:::1"],
		["CNAME", ""],
		/** A bare host is not an MX record: the preference is half of what an MX says. */
		["MX", "aspmx.l.google.com."],
		["MX", "high aspmx.l.google.com."],
		["MX", "10"],
		["TXT", '"unterminated'],
	] as const)("refuses a %s of %p", (type, data) => {
		expect(parseDnsRecordValue(type, data)).toBeNull();
	});
});

describe("normalizeDnsRecordValue", () => {
	test.each([
		["A", "104.21.58.249", "104.21.58.249"],
		["AAAA", "2606:4700:3030:0:0:0:6815:3AF9", "2606:4700:3030::6815:3af9"],
		["CNAME", "GH-ds9.Pages.dev.", "gh-ds9.pages.dev"],
		["NS", "dora.ns.cloudflare.com.", "dora.ns.cloudflare.com"],
		["MX", "05 aspmx.l.google.com.", "5 aspmx.l.google.com"],
		["TXT", '"a" "b"', "ab"],
	] as const)("agrees with the strict reading on a %s of %p", (type, data, expected) => {
		expect(normalizeDnsRecordValue(type, data)).toBe(expected);
		expect(parseDnsRecordValue(type, data)).toBe(expected);
	});

	/**
	 * The whole point of the total reading. A value that cannot be parsed is still the record's
	 * identity, and dropping it would make a record the customer still publishes read as
	 * `missing` on the next sweep — a false alert, where carrying it through is at worst a
	 * record that never appears to change.
	 */
	test.each([
		["A", "not-an-address", "not-an-address"],
		["AAAA", "NOT:AN:ADDRESS:::1", "not:an:address:::1"],
		/** A hand-typed expected MX value is a bare host; it is carried, not given a preference. */
		["MX", "MX.Example.com.", "mx.example.com"],
		["MX", "aspmx.l.google.com.", "aspmx.l.google.com"],
		/** Kept as written rather than folded to `NaN`. */
		["MX", "high mx.example.com.", "high mx.example.com"],
		["TXT", '"open', "open"],
	] as const)("carries an unparseable %s of %p through as %p", (type, data, expected) => {
		expect(parseDnsRecordValue(type, data)).toBeNull();
		expect(normalizeDnsRecordValue(type, data)).toBe(expected);
	});
});

describe("the two input channels agree", () => {
	/**
	 * Left is the presentation a zone-file export writes, right is the `data` field the DoH
	 * API answers with. Every pair is a record that exists, read off both channels.
	 */
	let pairs: [
		type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS",
		zoneFile: string,
		resolver: string,
	][] = [
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
